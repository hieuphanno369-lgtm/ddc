import { getTranslations } from 'next-intl/server';
import { repo } from '@/server/repo';
import { logger } from '@/lib/logger';
import { sendEmail, type SmtpConfig } from './notify/email';
import { smtpConfigFromChannel } from './notify/dispatch';
import type { ResetMailer } from './password-reset';

/**
 * Q6=(a) - kênh email đầu tiên (id nhỏ nhất) có ĐỦ cấu hình SMTP hợp lệ, kể cả khi kênh đó đang
 * tắt gửi cảnh báo (`isEnabled: false`) - tắt cảnh báo không nên làm hỏng quên mật khẩu.
 */
export async function getAuthSmtpConfig(): Promise<SmtpConfig | null> {
  const channels = (await repo.getChannelsForSend({ onlyEnabled: false }))
    .filter((c) => c.kind === 'email')
    .sort((a, b) => a.id - b.id);
  for (const ch of channels) {
    const cfg = smtpConfigFromChannel(ch);
    if (cfg.ok) return cfg.cfg;
  }
  return null;
}

/** Hàng đợi gửi nền riêng cho email quên mật khẩu, cùng khuôn `queueAlertNotifications`. */
let authMailQueueTail: Promise<void> = Promise.resolve();

/** K8 - xếp hàng, KHÔNG `await`: thời gian phản hồi không phụ thuộc việc gửi email xong hay chưa. */
export function queueAuthEmail(cfg: SmtpConfig, to: string, subject: string, text: string): void {
  authMailQueueTail = authMailQueueTail
    .then(() => sendEmail(cfg, [to], subject, text))
    .then((r) => {
      // S13 - KHÔNG log địa chỉ nhận hay nội dung, chỉ mã lỗi.
      if (!r.ok) logger.error('auth_mail.send_failed', { errCode: String(r.error) });
    })
    .catch(() => {
      logger.error('auth_mail.unexpected');
    });
}

/** CHỈ dùng trong test - đợi hàng đợi gửi email quên mật khẩu chạy xong. */
export function __authMailQueueIdleForTest(): Promise<void> {
  return authMailQueueTail.then(
    () => undefined,
    () => undefined,
  );
}

export const resetMailer: ResetMailer = {
  getSmtp: getAuthSmtpConfig,
  async compose(locale, email, link) {
    const t = await getTranslations({ locale, namespace: 'authSecurity' });
    return { subject: t('mailSubject'), text: t('mailBody', { email, link }) };
  },
  queue: queueAuthEmail,
};
