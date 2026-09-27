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

type RequestLogDetail = 'sent' | 'no_account' | 'google_only' | 'inactive';

async function logRequest(email: string, detail: RequestLogDetail): Promise<void> {
  await logActivity({ name: email, email }, 'password_reset_request', detail);
}

/**
 * L6 (bao-mat.md) - phần còn lại sau khi ghi throttle (đọc tài khoản, sinh token, lưu, soạn + gửi
 * mail) chạy NỀN, cùng khuôn `queueAuthEmail`/`queueAlertNotifications`: nối tiếp nhau trong 1
 * chuỗi Promise, không `await` từ `requestPasswordReset` - thời gian phản hồi không còn phụ thuộc
 * việc tài khoản có tồn tại hay không (trước đây nhánh "có tài khoản, gửi được" tốn thêm nhiều việc
 * đồng bộ hơn hẳn 3 nhánh còn lại, tạo timing oracle yếu bổ sung cho S3).
 */
let resetRequestQueueTail: Promise<void> = Promise.resolve();

/** CHỈ dùng trong test - đợi hàng đợi xử lý xin đặt lại mật khẩu (L6) chạy xong. */
export function __resetRequestQueueIdleForTest(): Promise<void> {
  return resetRequestQueueTail.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * R6 (bao-mat.md vòng 2) - việc nền dùng `.catch()` nên 1 việc NÉM LỖI không chặn việc sau (chuỗi
 * `.then()` vẫn tiếp tục vì `.catch()` biến kết quả thành "đã xong"); nhưng 1 việc bị TREO (không
 * bao giờ resolve/reject - ví dụ SMTP treo mạng) thì `.then()` của việc sau sẽ chờ mãi mãi, chặn cả
 * hàng đợi. `withTimeout` ép việc quá `ms` bị coi là lỗi để hàng đợi không bị treo theo.
 */
const RESET_JOB_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`qua han ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function finishPasswordResetRequest(
  store: AuthStore,
  mailer: ResetMailer,
  smtp: SmtpConfig,
  email: string,
  ip: string,
  locale: Locale,
  baseUrl: string,
  now: Date,
): Promise<void> {
  const account = await store.getAccountState(email);
  if (!account) {
    // L4 - KHÔNG lưu chuỗi email thô do người gọi tự chọn (attacker-controlled, không xác minh
    // được là email thật nào) vào `activity_log`; chỉ ghi lại rằng CÓ 1 yêu cầu cho email lạ.
    await logActivity({ name: 'khong-ton-tai', email: 'khong-ton-tai' }, 'password_reset_request', 'no_account');
    return;
  }
  if (account.passwordHash === '') {
    await logRequest(email, 'google_only');
    return;
  }
  if (!account.isActive) {
    await logRequest(email, 'inactive');
    return;
  }

  const { token, tokenHash } = generateResetToken();
  const expiresAtIso = new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString();
  await store.replaceResetToken(email, tokenHash, expiresAtIso, ip);
  const link = `${baseUrl.replace(/\/$/, '')}/${locale}/dat-lai-mat-khau?token=${token}`;
  const { subject, text } = await mailer.compose(locale, email, link);
  mailer.queue(smtp, email, subject, text);
  await logRequest(email, 'sent');
}

/**
 * Luật (K3, K5, K6, K8, K9, K11, S1-S4, L4, L6, R2, R3, R6 - ke-hoach.md + bao-mat.md), đúng thứ tự:
 * 1. Chưa cấu hình gửi email (thiếu SMTP hoặc `NEXTAUTH_URL`) -> `smtp_missing`, TRƯỚC mọi xử lý
 *    theo email (không nói riêng cho từng email).
 * 2. Email không hợp lệ -> `accepted` (không lộ định dạng email nào được chấp nhận).
 * 3. `ipKey = ip.trim() || 'unknown'` (R3 - không còn IP rỗng nào bỏ qua giới hạn), rồi "đặt chỗ"
 *    NGUYÊN TỬ (R2 - đếm + ghi trong CÙNG 1 lượt, đóng race TOCTOU khi nhiều yêu cầu chạy đồng thời)
 *    cho IP (10/giờ) TRƯỚC (N1, vòng bảo mật 3 - trước đây đặt chỗ email TRƯỚC IP, nên 1 IP đã hết
 *    lượt vẫn kịp ghi 1 dòng email của nạn nhân TRƯỚC KHI biết IP đã hết lượt, tự IP đó khoá được
 *    lượt xin link của mọi email); IP hết chỗ -> `accepted` NGAY, KHÔNG đụng tới email. Còn chỗ IP
 *    mới "đặt chỗ" cho email (3/giờ); email hết chỗ -> nhả lại đúng chỗ IP vừa đặt rồi mới `accepted`
 *    (giống cách `checkCredentials` nhả chỗ IP khi mật khẩu đúng). Hết chỗ ở CHIỀU NÀO cũng KHÔNG ghi
 *    log (L4 - nhánh này có thể bị spam liên tục khi đã lộ giới hạn, ghi log mỗi lần sẽ phình
 *    `activity_log` vô ích).
 * 4. Còn chỗ cả 2 chiều -> trả `accepted` NGAY (L6) - phần còn lại (đọc tài khoản, sinh token, gửi
 *    mail) chạy NỀN có timeout (R6 - 1 việc bị treo không chặn việc sau), xem
 *    `finishPasswordResetRequest`:
 *    - Không có tài khoản, tài khoản chỉ Google, hoặc bị tắt -> ghi log, không tạo token (K9).
 *    - Sinh token, xoá token cũ của email (K3), gửi link dựng từ `baseUrl` (K11 - không bao giờ từ
 *      header Host) - kể cả khi tài khoản đang khoá (đặt lại xong vẫn khoá, không mở khoá qua đây).
 * Toàn bộ nhánh (trừ nhánh 1) đều trả `{ status: 'accepted' }` giống nhau - không lộ email tồn tại (S3).
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

  const { ip, locale, baseUrl } = input;
  // R3 - ip rỗng (không xác định được IP thật) LUÔN gom vào khoá 'unknown', không còn bỏ qua giới hạn.
  const ipKey = ip.trim() || 'unknown';
  const nowIso = now.toISOString();
  const sinceIso = new Date(now.getTime() - RESET_WINDOW_MS).toISOString();
  // N1 (bao-mat.md vòng 3) - "đặt chỗ" NGUYÊN TỬ cho IP TRƯỚC, chỉ khi IP còn chỗ mới đụng tới email:
  // trước đây đặt chỗ email TRƯỚC IP, nên 1 IP đã hết lượt vẫn kịp ghi 1 dòng email của nạn nhân
  // TRƯỚC KHI biết IP đã hết lượt - 1 IP gửi rác đủ 10 yêu cầu là khoá được lượt xin link của MỌI
  // email (kể cả email chưa từng bị đụng tới), không cần biết email đó là gì.
  const ipReserved = await store.reserveThrottle('reset_req_ip', ipKey, nowIso, sinceIso, RESET_IP_LIMIT);
  if (ipReserved === null) {
    // L4 - KHÔNG ghi activity_log ở nhánh bị giới hạn (tránh phình dữ liệu khi bị spam).
    return { status: 'accepted' };
  }
  const emailReserved = await store.reserveThrottle('reset_req_email', email, nowIso, sinceIso, RESET_EMAIL_LIMIT);
  if (emailReserved === null) {
    // Email hết chỗ: nhả lại đúng chỗ IP vừa đặt - lượt này không nên tính vào giới hạn IP vì nó bị
    // chặn bởi giới hạn EMAIL, không phải do IP này thật sự đang bị lạm dụng.
    await store.releaseThrottle(ipReserved);
    return { status: 'accepted' };
  }

  // L6/R6 - phần còn lại chạy nền có timeout, trả `accepted` ngay sau khi đặt chỗ throttle.
  resetRequestQueueTail = resetRequestQueueTail
    .then(() => withTimeout(finishPasswordResetRequest(store, mailer, smtp, email, ip, locale, baseUrl, now), RESET_JOB_TIMEOUT_MS))
    .catch((e) => {
      console.error('[password-reset] loi xu ly nen', e instanceof Error ? e.message : String(e));
    });

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
