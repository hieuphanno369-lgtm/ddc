import type { SendResult } from './types';

/**
 * Stub tạm (Task 6, P3B) để Task 6/8 biên dịch được trước khi có trả lời Q1 (Task 7 thay bằng
 * nodemailer thật). Luôn trả lỗi rõ ràng, KHÔNG throw.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

export async function sendEmail(
  _cfg: SmtpConfig,
  _to: string[],
  _subject: string,
  _text: string,
): Promise<SendResult> {
  return { ok: false, error: 'email_unavailable' };
}
