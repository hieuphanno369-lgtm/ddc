/**
 * K5 - hằng số chính sách khoá đăng nhập + giới hạn xin link đặt lại mật khẩu. Dùng chung cho
 * `src/server/login-guard.ts`, `src/server/password-reset.ts`, `src/server/repo/*-auth.ts`.
 */

/** Khoá tài khoản ở lần sai liên tiếp thứ 5. */
export const LOGIN_LOCK_THRESHOLD = 5;

/** IP bị chặn khi có 20 lần đăng nhập sai trong 15 phút (cửa sổ trượt). */
export const IP_FAIL_LIMIT = 20;
export const IP_FAIL_WINDOW_MS = 15 * 60_000;

/** Email không tồn tại: sai 5 lần trong 24 giờ cũng hiện "đã bị khoá" như tài khoản thật (K6). */
export const UNKNOWN_EMAIL_WINDOW_MS = 24 * 3_600_000;

/** Xin link đặt lại tối đa 3 lần/giờ/email và 10 lần/giờ/IP. */
export const RESET_EMAIL_LIMIT = 3;
export const RESET_IP_LIMIT = 10;
export const RESET_WINDOW_MS = 3_600_000;

/** Token đặt lại mật khẩu hết hạn sau 30 phút. */
export const RESET_TOKEN_TTL_MS = 30 * 60_000;

/** Dọn dữ liệu tạm (auth_throttle, token đặt lại đã dùng/hết hạn) cũ hơn 24 giờ. */
export const AUTH_DATA_RETENTION_MS = 24 * 3_600_000;

/**
 * R7 phần 3, G4 (bao-mat.md, đề xuất Task 5 - K5) - chỉ để hạn chế `activity_log` bị spam bởi các
 * lần Google từ chối lặp lại của CÙNG 1 email, KHÔNG phải khoá đăng nhập (Google không đi qua form
 * mật khẩu nên không dùng `LOGIN_LOCK_THRESHOLD`/`IP_FAIL_LIMIT`) - tái dùng đúng ngưỡng/cửa sổ của
 * `login_fail_unknown_email` (cùng mục đích "hạn chế ghi log theo email").
 */
export const GOOGLE_DENIED_LIMIT = 5;
export const GOOGLE_DENIED_WINDOW_MS = UNKNOWN_EMAIL_WINDOW_MS;

/**
 * S-1 (bao-mat.md vong 4) - gioi han so lan GUI dat lai mat khau (`/dat-lai-mat-khau`) tinh theo IP,
 * chan tu choi dich vu CPU tu nguoi khong dang nhap (moi lan gui phai cho hashPassword chay). Tai
 * dung dung gia tri cua `IP_FAIL_LIMIT`/`IP_FAIL_WINDOW_MS` (20 lan/15 phut) - cung muc "1 IP dang
 * sau NAT/proxy chung" da duoc chap nhan lam nguong hop ly cho dang nhap; tach hang so rieng vi day
 * la 1 hanh dong khac (gui token dat lai, khong phai dang nhap sai mat khau).
 */
export const RESET_SUBMIT_IP_LIMIT = 20;
export const RESET_SUBMIT_IP_WINDOW_MS = 15 * 60_000;

export const EMAIL_MAX_LENGTH = 254;

/** trim + hạ chữ thường; rỗng, dài hơn 254, không có đúng 1 '@' -> null. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH) return null;
  if (email.split('@').length !== 2) return null;
  return email;
}
