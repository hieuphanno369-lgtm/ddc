import { repo } from '@/server/repo';
import { openSecret } from '@/lib/secret-box';
import { logger } from '@/lib/logger';
import { noticeFromAlert, noticeSubject, noticeText, severityPasses, webhookPayload, type AlertNotice } from '@/lib/notify-message';
import type { AlertLog, NotifyChannelForSend } from '@/server/repo/types';
import { sendEmail, type SmtpConfig } from './email';
import { sendWebhook } from './webhook';
import type { SendResult } from './types';

export const NOTIFY_MAX_ATTEMPTS = 3;
export const NOTIFY_RETRY_WINDOW_DAYS = 7;
export const NOTIFY_RETRY_BATCH = 50;

export interface DispatchDeps {
  sendWebhook?: typeof sendWebhook;
  sendEmail?: typeof sendEmail;
  baseUrl?: string;
}

export interface DispatchStats {
  sent: number;
  failed: number;
  skipped: number;
}

function channelTag(ch: NotifyChannelForSend): string {
  return `${ch.kind}:${ch.id}`;
}

function parseSentChannels(notifyChannel: string | null): Set<string> {
  return new Set(
    (notifyChannel ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Kênh bật, khớp mức độ, chưa gửi OK lần nào; kênh email phải còn >= 1 người nhận qua lọc mức độ. */
function candidateChannels(alert: AlertLog, channels: NotifyChannelForSend[]): NotifyChannelForSend[] {
  const already = parseSentChannels(alert.notifyChannel);
  return channels.filter((ch) => {
    if (!ch.isEnabled) return false;
    if (!severityPasses(alert.alertType, ch.minSeverity)) return false;
    if (already.has(channelTag(ch))) return false;
    if (ch.kind === 'email') {
      const eligible = ch.recipients.filter((r) => r.isEnabled && severityPasses(alert.alertType, r.minSeverity));
      if (eligible.length === 0) return false;
    }
    return true;
  });
}

/** secretEnc không giải mã được -> mã lỗi tương ứng (không throw). */
function tryOpenSecret(secretEnc: string): { ok: true; value: string } | { ok: false; error: 'secret_key_missing' | 'secret_decrypt_failed' } {
  try {
    return { ok: true, value: openSecret(secretEnc) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return { ok: false, error: msg === 'secret_key_missing' ? 'secret_key_missing' : 'secret_decrypt_failed' };
  }
}

/**
 * Dựng `SmtpConfig` từ 1 kênh thông báo email - tách khỏi `sendToChannel` để `src/server/auth-mail.ts`
 * (P3E, quên mật khẩu) dùng lại, không phải chép lại logic mở secret/mặc định port/secure.
 */
export function smtpConfigFromChannel(
  ch: NotifyChannelForSend,
): { ok: true; cfg: SmtpConfig } | { ok: false; error: 'bad_config' | 'secret_key_missing' | 'secret_decrypt_failed' } {
  if (!ch.settings.smtpHost || !ch.settings.fromAddress) return { ok: false, error: 'bad_config' };

  let pass: string | null = null;
  if (ch.secretEnc) {
    const opened = tryOpenSecret(ch.secretEnc);
    if (!opened.ok) return opened;
    pass = opened.value;
  }

  return {
    ok: true,
    cfg: {
      host: ch.settings.smtpHost,
      port: ch.settings.smtpPort ?? 587,
      secure: ch.settings.smtpSecure ?? false,
      user: ch.settings.smtpUser || null,
      pass,
      from: ch.settings.fromAddress,
    },
  };
}

/**
 * Gửi 1 kênh (dùng cho cả gửi thật lẫn "Gửi thử"). `severityFilter=false`: bỏ lọc mức độ người
 * nhận (Gửi thử coi mọi người nhận đang bật là hợp lệ, bất kể mức độ tối thiểu của họ).
 */
export async function sendToChannel(
  ch: NotifyChannelForSend,
  n: AlertNotice,
  deps: DispatchDeps = {},
  severityFilter = true,
): Promise<SendResult> {
  const sendWebhookFn = deps.sendWebhook ?? sendWebhook;
  const sendEmailFn = deps.sendEmail ?? sendEmail;

  if (ch.kind === 'webhook') {
    if (!ch.secretEnc) return { ok: false, error: 'secret_missing' };
    const opened = tryOpenSecret(ch.secretEnc);
    if (!opened.ok) return opened;
    return sendWebhookFn(opened.value, webhookPayload(ch.settings.webhookFormat ?? 'generic', n));
  }

  const recipients = ch.recipients.filter((r) => r.isEnabled && (!severityFilter || severityPasses(n.severity, r.minSeverity)));
  const emails = recipients.map((r) => r.email);
  if (emails.length === 0) return { ok: false, error: 'no_recipients' };

  const smtp = smtpConfigFromChannel(ch);
  if (!smtp.ok) return smtp;

  return sendEmailFn(smtp.cfg, emails, noticeSubject(n), noticeText(n));
}

/** Xử lý 1 alert: chọn kênh đích, giành quyền gửi (K5), gửi lần lượt, ghi kết quả. KHÔNG throw. */
async function processAlert(alert: AlertLog, channels: NotifyChannelForSend[], deps: DispatchDeps): Promise<'sent' | 'failed' | 'skipped'> {
  if (alert.closedAt || alert.notifySentAt || alert.notifyAttempts >= NOTIFY_MAX_ATTEMPTS) return 'skipped';

  const targets = candidateChannels(alert, channels);
  if (targets.length === 0) return 'skipped';

  const claimed = await repo.claimAlertNotify(alert.id, alert.notifyAttempts);
  if (!claimed) return 'skipped';

  try {
    const project = await repo.getProject(alert.projectId);
    const baseUrl = deps.baseUrl ?? process.env.NEXTAUTH_URL;
    const notice = noticeFromAlert(alert, project?.projectName ?? '-', baseUrl);

    const sentTags = parseSentChannels(alert.notifyChannel);
    const failedTags: string[] = [];
    for (const ch of targets) {
      const result = await sendToChannel(ch, notice, deps);
      if (result.ok) sentTags.add(channelTag(ch));
      else failedTags.push(`${channelTag(ch)}=${result.error}`);
    }

    const allOk = failedTags.length === 0;
    await repo.finishAlertNotify(alert.id, {
      sentChannels: sentTags.size > 0 ? [...sentTags].join(',') : null,
      sentAt: allOk ? new Date().toISOString() : null,
      error: allOk ? null : failedTags.join('; '),
    });
    return allOk ? 'sent' : 'failed';
  } catch {
    // Khong bao gio in URL/bi mat - chi id alert.
    logger.error('notify.alert_failed', { alertId: alert.id });
    return 'failed';
  }
}

/** Gửi thông báo cho các alert vừa mở (móc từ alert-engine). KHÔNG throw. */
export async function dispatchAlertNotifications(alertIds: number[], deps: DispatchDeps = {}): Promise<DispatchStats> {
  const stats: DispatchStats = { sent: 0, failed: 0, skipped: 0 };
  if (alertIds.length === 0) return stats;
  try {
    const channels = await repo.getChannelsForSend({ onlyEnabled: true });
    if (channels.length === 0) return { sent: 0, failed: 0, skipped: alertIds.length };

    const alerts = await repo.getAlertsByIds(alertIds);
    for (const alert of alerts) stats[await processAlert(alert, channels, deps)]++;
    stats.skipped += alertIds.length - alerts.length;
    return stats;
  } catch {
    logger.error('notify.dispatch_failed');
    return { sent: stats.sent, failed: stats.failed, skipped: alertIds.length - stats.sent - stats.failed };
  }
}

/** Thử lại các alert đã gửi lỗi/dở dang - chạy mỗi lần `runDueJobs` và trong job `alerts_daily`. */
export async function retryPendingNotifications(deps: DispatchDeps = {}): Promise<DispatchStats> {
  const stats: DispatchStats = { sent: 0, failed: 0, skipped: 0 };
  try {
    const channels = await repo.getChannelsForSend({ onlyEnabled: true });
    if (channels.length === 0) return stats;

    const since = new Date(Date.now() - NOTIFY_RETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const alerts = await repo.getAlertsForNotifyRetry(NOTIFY_MAX_ATTEMPTS, since, NOTIFY_RETRY_BATCH);
    for (const alert of alerts) stats[await processAlert(alert, channels, deps)]++;
    return stats;
  } catch {
    logger.error('notify.retry_failed');
    return stats;
  }
}

/** Xếp hàng chạy nền, nối tiếp nhau trong tiến trình (Node thường trú trên VPS); KHÔNG throw, KHÔNG await được từ ngoài. */
let notifyQueueTail: Promise<void> = Promise.resolve();

export function queueAlertNotifications(alertIds: number[]): void {
  if (alertIds.length === 0) return;
  notifyQueueTail = notifyQueueTail
    .then(() => dispatchAlertNotifications(alertIds))
    .then(() => undefined)
    .catch(() => undefined);
}

/** CHỈ dùng trong test - đợi hàng đợi gửi thông báo chạy xong. */
export function __notifyQueueIdleForTest(): Promise<void> {
  return notifyQueueTail.then(
    () => undefined,
    () => undefined,
  );
}
