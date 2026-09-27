import { logActivity } from '@/lib/activity';
import { hashPassword } from '@/lib/password';
import { normalizeEmail, RESET_EMAIL_LIMIT, RESET_IP_LIMIT, RESET_TOKEN_TTL_MS, RESET_WINDOW_MS } from '@/lib/login-policy';
import { generateResetToken, hashResetToken, isWellFormedResetToken } from '@/lib/reset-token';
import type { Locale } from '@/i18n/routing';
import type { AuthStore } from './repo/types';
import type { SmtpConfig } from './notify/email';

export interface ResetMailer {
  getSmtp(): Promise<SmtpConfig | null>;
  compose(locale: Locale, email: string, link: string): Promise<{ subject: string; text: string }>;
  /** Xếp hàng gửi nền - không throw, không được `await` (thời gian phản hồi không phụ thuộc email). */
  queue(cfg: SmtpConfig, to: string, subject: string, text: string): void;
}

type RequestLogDetail = 'sent' | 'no_account' | 'google_only' | 'inactive' | 'rate_limited';

async function logRequest(email: string, detail: RequestLogDetail): Promise<void> {
  await logActivity({ name: email, email }, 'password_reset_request', detail);
}

/**
 * Luật (K3, K5, K6, K8, K9, K11, S1-S4 - ke-hoach.md), đúng thứ tự:
 * 1. Chưa cấu hình gửi email (thiếu SMTP hoặc `NEXTAUTH_URL`) -> `smtp_missing`, TRƯỚC mọi xử lý
 *    theo email (không nói riêng cho từng email).
 * 2. Email không hợp lệ -> `accepted` (không lộ định dạng email nào được chấp nhận).
 * 3. Giới hạn theo IP (10/giờ) hoặc theo email (3/giờ) -> `accepted`, không tạo token.
 * 4. Không có tài khoản, tài khoản chỉ Google, hoặc bị tắt -> `accepted`, không tạo token
 *    (K9: có mật khẩu mới cũng không đăng nhập được).
 * 5. Sinh token, xoá token cũ của email (K3), gửi link dựng từ `baseUrl` (K11 - không bao giờ từ
 *    header Host) - kể cả khi tài khoản đang khoá (đặt lại xong vẫn khoá, không mở khoá qua đây).
 * Toàn bộ nhánh đều trả `{ status: 'accepted' }` giống nhau (trừ nhánh 1) - không lộ email tồn tại (S3).
 */
export async function requestPasswordReset(
  store: AuthStore,
  mailer: ResetMailer,
  input: { email: unknown; ip: string; locale: Locale; baseUrl: string | undefined },
  now: Date = new Date(),
): Promise<{ status: 'accepted' | 'smtp_missing' }> {
  const smtp = await mailer.getSmtp();
  if (!smtp || !input.baseUrl) return { status: 'smtp_missing' };

  const email = normalizeEmail(input.email);
  if (!email) return { status: 'accepted' };

  const { ip } = input;
  const sinceIso = new Date(now.getTime() - RESET_WINDOW_MS).toISOString();
  const ipLimited = ip !== '' && (await store.countThrottle('reset_req_ip', ip, sinceIso)) >= RESET_IP_LIMIT;
  const emailLimited = (await store.countThrottle('reset_req_email', email, sinceIso)) >= RESET_EMAIL_LIMIT;
  if (ipLimited || emailLimited) {
    await logRequest(email, 'rate_limited');
    return { status: 'accepted' };
  }
  const nowIso = now.toISOString();
  await store.recordThrottle('reset_req_email', email, nowIso);
  if (ip !== '') await store.recordThrottle('reset_req_ip', ip, nowIso);

  const account = await store.getAccountState(email);
  if (!account) {
    await logRequest(email, 'no_account');
    return { status: 'accepted' };
  }
  if (account.passwordHash === '') {
    await logRequest(email, 'google_only');
    return { status: 'accepted' };
  }
  if (!account.isActive) {
    await logRequest(email, 'inactive');
    return { status: 'accepted' };
  }

  const { token, tokenHash } = generateResetToken();
  const expiresAtIso = new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString();
  await store.replaceResetToken(email, tokenHash, expiresAtIso, ip);
  const link = `${input.baseUrl.replace(/\/$/, '')}/${input.locale}/dat-lai-mat-khau?token=${token}`;
  const { subject, text } = await mailer.compose(input.locale, email, link);
  mailer.queue(smtp, email, subject, text);
  await logRequest(email, 'sent');
  return { status: 'accepted' };
}

/**
 * K4 - token dùng nguyên tử (`consumeResetToken` trong repo là 1 lệnh khoá tất cả), 2 request
 * đồng thời chỉ 1 cái thắng. Kiểm độ dài mật khẩu TRƯỚC khi đụng token (mật khẩu ngắn không đốt
 * token của người dùng).
 */
export async function resetPasswordWithToken(
  store: AuthStore,
  input: { token: unknown; newPassword: string },
  now: Date = new Date(),
): Promise<{ ok: true; locked: boolean } | { ok: false; error: 'invalid_token' | 'too_short' }> {
  if (!isWellFormedResetToken(input.token)) return { ok: false, error: 'invalid_token' };
  if (input.newPassword.length < 8) return { ok: false, error: 'too_short' };

  const nowIso = now.toISOString();
  const result = await store.consumeResetToken(hashResetToken(input.token), hashPassword(input.newPassword), nowIso);
  if (!result.ok) return { ok: false, error: 'invalid_token' };

  await logActivity({ name: result.name || result.email, email: result.email }, 'password_reset_done');
  return { ok: true, locked: result.locked };
}

/** S12 - trang đặt lại chỉ ĐỌC token ở GET (không tiêu token) để quyết hiện form hay báo lỗi. */
export async function isResetTokenUsable(store: AuthStore, token: unknown, now: Date = new Date()): Promise<boolean> {
  if (!isWellFormedResetToken(token)) return false;
  return store.peekResetToken(hashResetToken(token), now.toISOString());
}
