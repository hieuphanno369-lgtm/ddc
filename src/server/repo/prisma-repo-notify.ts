import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';
import { audit } from './prisma-repo-entry';
import type {
  AlertLog, AlertSeverity, NotifyChannel, NotifyChannelForSend, NotifyChannelInput, NotifyChannelSettings,
  NotifyFinish, NotifyKind, NotifyRecipient, NotifyRecipientInput,
} from './types';

/** Date | null → ISO string | null (khớp prisma-repo.ts). */
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

type PrismaAlertLogRow = Awaited<ReturnType<typeof prisma.alertLog.findFirstOrThrow>>;

/** Cắt tối đa 500 ký tự (khớp notifyError trong schema). */
const MAX_NOTIFY_ERROR_LENGTH = 500;

/** Chỉ lấy đúng 7 khoá đã khai trong NotifyChannelSettings, sai kiểu thì bỏ. */
export function parseSettings(json: unknown): NotifyChannelSettings {
  if (typeof json !== 'object' || json === null) return {};
  const obj = json as Record<string, unknown>;
  const out: NotifyChannelSettings = {};
  if (obj.webhookFormat === 'generic' || obj.webhookFormat === 'slack' || obj.webhookFormat === 'teams') {
    out.webhookFormat = obj.webhookFormat;
  }
  if (typeof obj.webhookHost === 'string') out.webhookHost = obj.webhookHost;
  if (typeof obj.smtpHost === 'string') out.smtpHost = obj.smtpHost;
  if (typeof obj.smtpPort === 'number') out.smtpPort = obj.smtpPort;
  if (typeof obj.smtpSecure === 'boolean') out.smtpSecure = obj.smtpSecure;
  if (typeof obj.smtpUser === 'string') out.smtpUser = obj.smtpUser;
  if (typeof obj.fromAddress === 'string') out.fromAddress = obj.fromAddress;
  return out;
}

function toAlertLog(a: PrismaAlertLogRow): AlertLog {
  return {
    id: a.id,
    projectId: a.projectId,
    alertType: a.alertType as AlertSeverity,
    ruleTriggered: a.ruleTriggered,
    message: a.message,
    openedAt: a.openedAt.toISOString(),
    closedAt: iso(a.closedAt),
    owner: a.owner,
    action: a.action,
    deadline: a.deadline,
    ruleCode: a.ruleCode,
    dedupeKey: a.dedupeKey,
    closedBy: a.closedBy,
    closeNote: a.closeNote,
    notifyChannel: a.notifyChannel,
    notifySentAt: iso(a.notifySentAt),
    notifyError: a.notifyError,
    notifyAttempts: a.notifyAttempts,
  };
}

function toNotifyChannel(c: {
  id: number; kind: string; name: string; isEnabled: boolean; minSeverity: string; settings: unknown;
  secretHint: string; secretEnc: string | null; updatedAt: Date; updatedBy: string;
}): NotifyChannel {
  return {
    id: c.id,
    kind: c.kind as NotifyKind,
    name: c.name,
    isEnabled: c.isEnabled,
    minSeverity: c.minSeverity as AlertSeverity,
    settings: parseSettings(c.settings),
    secretHint: c.secretHint,
    hasSecret: c.secretEnc != null,
    updatedAt: c.updatedAt.toISOString(),
    updatedBy: c.updatedBy,
  };
}

/**
 * Hàm repo P3B (Task 4) - hợp nhất vào `repo` qua `index.ts` (Object.assign), KHÔNG sửa trực tiếp
 * `prisma-repo.ts` để giảm xung đột với A (file nóng).
 */
export const notifyRepoPrisma = {
  async listNotifyChannels(): Promise<NotifyChannel[]> {
    const rows = await prisma.notifyChannel.findMany({ orderBy: { id: 'asc' } });
    return rows.map((c) => toNotifyChannel(c));
  },

  async getNotifyRecipients(channelId?: number): Promise<NotifyRecipient[]> {
    const rows = await prisma.notifyRecipient.findMany({
      ...(channelId != null ? { where: { channelId } } : {}),
      orderBy: [{ channelId: 'asc' }, { email: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      channelId: r.channelId,
      email: r.email,
      minSeverity: r.minSeverity as AlertSeverity,
      isEnabled: r.isEnabled,
    }));
  },

  async saveNotifyChannel(input: NotifyChannelInput, by: string): Promise<{ id: number } | 'not_found'> {
    const settingsJson = input.settings as unknown as Prisma.InputJsonValue;
    const newSnapshot = JSON.stringify({
      kind: input.kind, name: input.name, isEnabled: input.isEnabled, minSeverity: input.minSeverity, settings: input.settings,
    });

    if (input.id != null) {
      const existing = await prisma.notifyChannel.findUnique({ where: { id: input.id } });
      if (!existing) return 'not_found';
      const oldSnapshot = JSON.stringify({
        kind: existing.kind, name: existing.name, isEnabled: existing.isEnabled, minSeverity: existing.minSeverity,
        settings: existing.settings,
      });
      const secretData =
        input.secret === null
          ? { secretEnc: null, secretHint: '' }
          : input.secret
            ? { secretEnc: input.secret.enc, secretHint: input.secret.hint }
            : {};
      await prisma.notifyChannel.update({
        where: { id: input.id },
        data: { name: input.name, isEnabled: input.isEnabled, minSeverity: input.minSeverity, settings: settingsJson, updatedBy: by, ...secretData },
      });
      await audit(prisma, 'notify_channel', String(input.id), 'update', oldSnapshot, newSnapshot, by);
      if (input.secret === null) {
        await audit(prisma, 'notify_channel', String(input.id), 'secret', existing.secretHint, '(xoá)', by);
      } else if (input.secret) {
        await audit(prisma, 'notify_channel', String(input.id), 'secret', existing.secretHint, input.secret.hint, by);
      }
      return { id: input.id };
    }

    const created = await prisma.notifyChannel.create({
      data: {
        kind: input.kind,
        name: input.name,
        isEnabled: input.isEnabled,
        minSeverity: input.minSeverity,
        settings: settingsJson,
        secretEnc: input.secret ? input.secret.enc : null,
        secretHint: input.secret ? input.secret.hint : '',
        updatedBy: by,
      },
    });
    await audit(prisma, 'notify_channel', String(created.id), 'create', '', newSnapshot, by);
    if (input.secret) await audit(prisma, 'notify_channel', String(created.id), 'secret', '', input.secret.hint, by);
    return { id: created.id };
  },

  async deleteNotifyChannel(id: number, by: string): Promise<boolean> {
    const existing = await prisma.notifyChannel.findUnique({ where: { id } });
    if (!existing) return false;
    await prisma.notifyChannel.delete({ where: { id } });
    await audit(
      prisma, 'notify_channel', String(id), 'delete',
      JSON.stringify({ kind: existing.kind, name: existing.name, isEnabled: existing.isEnabled, minSeverity: existing.minSeverity, settings: existing.settings }),
      '', by,
    );
    return true;
  },

  async saveNotifyRecipient(
    input: NotifyRecipientInput,
    by: string,
  ): Promise<{ id: number } | 'not_found' | 'duplicate' | 'wrong_kind'> {
    const email = input.email.trim().toLowerCase();
    const channel = await prisma.notifyChannel.findUnique({ where: { id: input.channelId } });
    if (!channel) return 'not_found';
    if (channel.kind !== 'email') return 'wrong_kind';

    if (input.id != null) {
      const existing = await prisma.notifyRecipient.findUnique({ where: { id: input.id } });
      if (!existing) return 'not_found';
      try {
        await prisma.notifyRecipient.update({
          where: { id: input.id },
          data: { channelId: input.channelId, email, minSeverity: input.minSeverity, isEnabled: input.isEnabled },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate';
        throw e;
      }
      await audit(
        prisma, 'notify_recipient', String(input.id), 'update',
        `${existing.email}/${existing.minSeverity}/${existing.isEnabled}`, `${email}/${input.minSeverity}/${input.isEnabled}`, by,
      );
      return { id: input.id };
    }

    try {
      const created = await prisma.notifyRecipient.create({
        data: { channelId: input.channelId, email, minSeverity: input.minSeverity, isEnabled: input.isEnabled },
      });
      await audit(prisma, 'notify_recipient', String(created.id), 'create', '', `${email}/${input.minSeverity}/${input.isEnabled}`, by);
      return { id: created.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate';
      throw e;
    }
  },

  async deleteNotifyRecipient(id: number, by: string): Promise<boolean> {
    const existing = await prisma.notifyRecipient.findUnique({ where: { id } });
    if (!existing) return false;
    await prisma.notifyRecipient.delete({ where: { id } });
    await audit(prisma, 'notify_recipient', String(id), 'delete', `${existing.email}/${existing.minSeverity}/${existing.isEnabled}`, '', by);
    return true;
  },

  async getChannelsForSend(opts: { onlyEnabled: boolean; ids?: number[] }): Promise<NotifyChannelForSend[]> {
    const rows = await prisma.notifyChannel.findMany({
      where: { ...(opts.onlyEnabled ? { isEnabled: true } : {}), ...(opts.ids ? { id: { in: opts.ids } } : {}) },
      orderBy: { id: 'asc' },
      include: { recipients: true },
    });
    return rows.map((c) => ({
      ...toNotifyChannel(c),
      secretEnc: c.secretEnc,
      recipients: c.recipients.map((r) => ({
        id: r.id,
        channelId: r.channelId,
        email: r.email,
        minSeverity: r.minSeverity as AlertSeverity,
        isEnabled: r.isEnabled,
      })),
    }));
  },

  async getAlertsByIds(ids: number[]): Promise<AlertLog[]> {
    const rows = await prisma.alertLog.findMany({ where: { id: { in: ids } } });
    return rows.map((a) => toAlertLog(a));
  },

  /** closedAt null, notifySentAt null, 1 <= notifyAttempts < maxAttempts, openedAt >= openedSinceIso, tăng dần theo openedAt. */
  async getAlertsForNotifyRetry(maxAttempts: number, openedSinceIso: string, limit: number): Promise<AlertLog[]> {
    const rows = await prisma.alertLog.findMany({
      where: {
        closedAt: null,
        notifySentAt: null,
        notifyAttempts: { gte: 1, lt: maxAttempts },
        openedAt: { gte: new Date(openedSinceIso) },
      },
      orderBy: { openedAt: 'asc' },
      take: limit,
    });
    return rows.map((a) => toAlertLog(a));
  },

  async claimAlertNotify(id: number, expectedAttempts: number): Promise<boolean> {
    const result = await prisma.alertLog.updateMany({
      where: { id, notifyAttempts: expectedAttempts, notifySentAt: null, closedAt: null },
      data: { notifyAttempts: { increment: 1 } },
    });
    return result.count === 1;
  },

  async finishAlertNotify(id: number, r: NotifyFinish): Promise<void> {
    await prisma.alertLog.update({
      where: { id },
      data: {
        notifyChannel: r.sentChannels,
        notifySentAt: r.sentAt ? new Date(r.sentAt) : null,
        notifyError: r.error ? r.error.slice(0, MAX_NOTIFY_ERROR_LENGTH) : null,
      },
    });
  },
};
