import type { RepoData } from '@/data/seed/history';
import { audit as auditMock } from './mock-repo-entry';
import type {
  AlertLog, NotifyChannel, NotifyChannelForSend, NotifyChannelInput, NotifyChannelSettings,
  NotifyFinish, NotifyRecipient, NotifyRecipientInput,
} from './types';

export interface NotifyMockDeps {
  getData: () => RepoData;
  persist: () => void;
}

type MockChannel = NotifyChannel & { secretEnc: string | null };

interface NotifyMockStore {
  channels: MockChannel[];
  recipients: NotifyRecipient[];
}

const globalForNotify = globalThis as unknown as { __ddcNotifyMock?: NotifyMockStore };

function store(): NotifyMockStore {
  globalForNotify.__ddcNotifyMock ??= { channels: [], recipients: [] };
  return globalForNotify.__ddcNotifyMock;
}

/** Test gọi khi cần reset kho kênh/người nhận thông báo (khuôn `repo.reset()` của mock-repo.ts). */
export function resetNotifyMock(): void {
  delete globalForNotify.__ddcNotifyMock;
}

/** Chỉ lấy đúng 7 khoá đã khai (giữ nhất quán với `parseSettings` bên prisma-repo-notify.ts). */
function cleanSettings(settings: NotifyChannelSettings): NotifyChannelSettings {
  const out: NotifyChannelSettings = {};
  if (settings.webhookFormat != null) out.webhookFormat = settings.webhookFormat;
  if (settings.webhookHost != null) out.webhookHost = settings.webhookHost;
  if (settings.smtpHost != null) out.smtpHost = settings.smtpHost;
  if (settings.smtpPort != null) out.smtpPort = settings.smtpPort;
  if (settings.smtpSecure != null) out.smtpSecure = settings.smtpSecure;
  if (settings.smtpUser != null) out.smtpUser = settings.smtpUser;
  if (settings.fromAddress != null) out.fromAddress = settings.fromAddress;
  return out;
}

function toPublicChannel(c: MockChannel): NotifyChannel {
  const { secretEnc: _secretEnc, ...rest } = c;
  return { ...rest, hasSecret: c.secretEnc != null };
}

const MAX_NOTIFY_ERROR_LENGTH = 500;

/**
 * Hàm repo P3B (Task 4) cho mock-repo - hợp nhất qua `Object.assign` ở mock-repo.ts, KHÔNG sửa
 * trực tiếp `coreRepo`. Kho lưu ở `globalThis.__ddcNotifyMock` (tách khỏi `RepoData`/`SEED_VERSION`
 * - K10, ke-hoach.md P3B) - alert đọc/ghi qua `getData().alerts` như thường.
 */
export function makeNotifyMockRepo({ getData, persist }: NotifyMockDeps) {
  return {
    listNotifyChannels(): NotifyChannel[] {
      return [...store().channels].sort((a, b) => a.id - b.id).map(toPublicChannel);
    },

    getNotifyRecipients(channelId?: number): NotifyRecipient[] {
      return store()
        .recipients.filter((r) => channelId == null || r.channelId === channelId)
        .sort((a, b) => (a.channelId !== b.channelId ? a.channelId - b.channelId : a.email.localeCompare(b.email)));
    },

    saveNotifyChannel(input: NotifyChannelInput, by: string): { id: number } | 'not_found' {
      const s = store();
      const settings = cleanSettings(input.settings);
      const newSnapshot = JSON.stringify({ kind: input.kind, name: input.name, isEnabled: input.isEnabled, minSeverity: input.minSeverity, settings });

      if (input.id != null) {
        const existing = s.channels.find((c) => c.id === input.id);
        if (!existing) return 'not_found';
        const oldSnapshot = JSON.stringify({
          kind: existing.kind, name: existing.name, isEnabled: existing.isEnabled, minSeverity: existing.minSeverity, settings: existing.settings,
        });
        existing.name = input.name;
        existing.isEnabled = input.isEnabled;
        existing.minSeverity = input.minSeverity;
        existing.settings = settings;
        existing.updatedAt = new Date().toISOString();
        existing.updatedBy = by;
        if (input.secret === null) {
          existing.secretEnc = null;
          existing.secretHint = '';
        } else if (input.secret) {
          existing.secretEnc = input.secret.enc;
          existing.secretHint = input.secret.hint;
        }
        auditMock(getData(), 'notify_channel', String(input.id), 'update', oldSnapshot, newSnapshot, by);
        if (input.secret === null) auditMock(getData(), 'notify_channel', String(input.id), 'secret', existing.secretHint, '(xoá)', by);
        else if (input.secret) auditMock(getData(), 'notify_channel', String(input.id), 'secret', existing.secretHint, input.secret.hint, by);
        return { id: input.id };
      }

      const id = s.channels.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      const created: MockChannel = {
        id,
        kind: input.kind,
        name: input.name,
        isEnabled: input.isEnabled,
        minSeverity: input.minSeverity,
        settings,
        secretHint: input.secret ? input.secret.hint : '',
        secretEnc: input.secret ? input.secret.enc : null,
        hasSecret: input.secret != null,
        updatedAt: new Date().toISOString(),
        updatedBy: by,
      };
      s.channels.push(created);
      auditMock(getData(), 'notify_channel', String(id), 'create', '', newSnapshot, by);
      if (input.secret) auditMock(getData(), 'notify_channel', String(id), 'secret', '', input.secret.hint, by);
      return { id };
    },

    deleteNotifyChannel(id: number, by: string): boolean {
      const s = store();
      const existing = s.channels.find((c) => c.id === id);
      if (!existing) return false;
      s.channels = s.channels.filter((c) => c.id !== id);
      s.recipients = s.recipients.filter((r) => r.channelId !== id);
      auditMock(
        getData(), 'notify_channel', String(id), 'delete',
        JSON.stringify({ kind: existing.kind, name: existing.name, isEnabled: existing.isEnabled, minSeverity: existing.minSeverity, settings: existing.settings }),
        '', by,
      );
      return true;
    },

    saveNotifyRecipient(input: NotifyRecipientInput, by: string): { id: number } | 'not_found' | 'duplicate' | 'wrong_kind' {
      const s = store();
      const email = input.email.trim().toLowerCase();
      const channel = s.channels.find((c) => c.id === input.channelId);
      if (!channel) return 'not_found';
      if (channel.kind !== 'email') return 'wrong_kind';

      if (input.id != null) {
        const existing = s.recipients.find((r) => r.id === input.id);
        if (!existing) return 'not_found';
        const dup = s.recipients.some((r) => r.id !== input.id && r.channelId === input.channelId && r.email === email);
        if (dup) return 'duplicate';
        const oldTag = `${existing.email}/${existing.minSeverity}/${existing.isEnabled}`;
        existing.channelId = input.channelId;
        existing.email = email;
        existing.minSeverity = input.minSeverity;
        existing.isEnabled = input.isEnabled;
        auditMock(getData(), 'notify_recipient', String(input.id), 'update', oldTag, `${email}/${input.minSeverity}/${input.isEnabled}`, by);
        return { id: input.id };
      }

      const dup = s.recipients.some((r) => r.channelId === input.channelId && r.email === email);
      if (dup) return 'duplicate';
      const id = s.recipients.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      const created: NotifyRecipient = { id, channelId: input.channelId, email, minSeverity: input.minSeverity, isEnabled: input.isEnabled };
      s.recipients.push(created);
      auditMock(getData(), 'notify_recipient', String(id), 'create', '', `${email}/${input.minSeverity}/${input.isEnabled}`, by);
      return { id };
    },

    deleteNotifyRecipient(id: number, by: string): boolean {
      const s = store();
      const existing = s.recipients.find((r) => r.id === id);
      if (!existing) return false;
      s.recipients = s.recipients.filter((r) => r.id !== id);
      auditMock(getData(), 'notify_recipient', String(id), 'delete', `${existing.email}/${existing.minSeverity}/${existing.isEnabled}`, '', by);
      return true;
    },

    getChannelsForSend(opts: { onlyEnabled: boolean; ids?: number[] }): NotifyChannelForSend[] {
      return store()
        .channels.filter((c) => (!opts.onlyEnabled || c.isEnabled) && (!opts.ids || opts.ids.includes(c.id)))
        .sort((a, b) => a.id - b.id)
        .map((c) => ({
          ...toPublicChannel(c),
          secretEnc: c.secretEnc,
          recipients: store()
            .recipients.filter((r) => r.channelId === c.id)
            .sort((a, b) => a.email.localeCompare(b.email)),
        }));
    },

    getAlertsByIds(ids: number[]): AlertLog[] {
      return getData().alerts.filter((a) => ids.includes(a.id));
    },

    /** closedAt null, notifySentAt null, 1 <= notifyAttempts < maxAttempts, openedAt >= openedSinceIso, tăng dần. */
    getAlertsForNotifyRetry(maxAttempts: number, openedSinceIso: string, limit: number): AlertLog[] {
      return getData()
        .alerts.filter(
          (a) => a.closedAt == null && a.notifySentAt == null && a.notifyAttempts >= 1 && a.notifyAttempts < maxAttempts && a.openedAt >= openedSinceIso,
        )
        .sort((a, b) => (a.openedAt < b.openedAt ? -1 : a.openedAt > b.openedAt ? 1 : 0))
        .slice(0, limit);
    },

    claimAlertNotify(id: number, expectedAttempts: number): boolean {
      const a = getData().alerts.find((x) => x.id === id);
      if (!a || a.notifyAttempts !== expectedAttempts || a.notifySentAt != null || a.closedAt != null) return false;
      a.notifyAttempts += 1;
      persist();
      return true;
    },

    finishAlertNotify(id: number, r: NotifyFinish): void {
      const a = getData().alerts.find((x) => x.id === id);
      if (!a) return;
      a.notifyChannel = r.sentChannels;
      a.notifySentAt = r.sentAt;
      a.notifyError = r.error ? r.error.slice(0, MAX_NOTIFY_ERROR_LENGTH) : null;
      persist();
    },
  };
}
