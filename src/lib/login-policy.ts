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
 * S-1 - giới hạn số lần GỬI đặt lại mật khẩu (`/dat-lai-mat-khau`) tính theo IP, chặn từ chối dịch
 * vụ CPU từ người không đăng nhập (mỗi lần gửi phải chạy hashPassword). Dùng đúng giá trị của
 * `IP_FAIL_LIMIT`/`IP_FAIL_WINDOW_MS` (20 lần/15 phút), cùng mức "1 IP đứng sau NAT/proxy chung" đã
 * chấp nhận cho đăng nhập; tách hằng số riêng vì đây là hành động khác (gửi token đặt lại, không
 * phải đăng nhập sai mật khẩu).
 */
export const RESET_SUBMIT_IP_LIMIT = 20;
export const RESET_SUBMIT_IP_WINDOW_MS = 15 * 60_000;

/**
 * R4-2 (bao-mat.md vòng 4, Thấp) - cửa sổ "giữ chỗ" NGUYÊN TỬ theo TÀI KHOẢN (email) TRƯỚC bcrypt ở
 * `checkCredentials` (đăng nhập) và `changePasswordAction` (đổi mật khẩu): nhiều yêu cầu ĐỒNG THỜI
 * cho CÙNG 1 email đều đọc `failedLoginCount` CŨ (chưa ai kịp ghi `registerFailedLogin`) nên đều lọt
 * qua kiểm tra `lockedAt` và đều chạy bcrypt thật, vượt hẳn `LOGIN_LOCK_THRESHOLD`. Bộ đếm khoá
 * CHÍNH THỨC vẫn là `failedLoginCount`/`registerFailedLogin`, không đổi.
 * R5-2 (bao-mat.md vòng 5, Thấp) - vòng 4 dùng cửa sổ 5 GIÂY, ngắn hơn thời gian 1 lượt có thể cần
 * để xử lý xong khi server bị dồn tải (nhiều bcrypt cùng chạy, `bcryptjs` JS thuần chạy chậm hẳn đi) -
 * 1 chỗ giữ có thể "hết hạn" (rơi khỏi cửa sổ đếm) TRƯỚC KHI được rút đúng cách, khiến 1 lượt khác
 * lọt qua dù chỗ kia trên thực tế vẫn đang được xử lý. Nới ra 5 PHÚT (cùng mốc với
 * `ACCESS_RECHECK_INTERVAL_MS`) - đủ dài để không bao giờ bị "hết hạn" khi còn đang xử lý dở, chỉ còn
 * tác dụng dọn dòng mồ côi nếu tiến trình crash giữa chừng không kịp `releaseThrottle` (không còn
 * dùng để giới hạn concurrency theo thời gian như vòng 4 - từ vòng 5, `reserveAccountGuess` đếm số
 * chỗ ĐANG GIỮ thật sự, xem `types.ts`).
 */
export const ACCOUNT_GUESS_WINDOW_MS = 5 * 60_000;

export const EMAIL_MAX_LENGTH = 254;

/** trim + hạ chữ thường; rỗng, dài hơn 254, không có đúng 1 '@' -> null. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH) return null;
  if (email.split('@').length !== 2) return null;
  return email;
}

/**
 * P3F-3 - đăng ký tài khoản (trang công khai `/dang-ky`): 10 lần/giờ/IP và 3 lần/giờ/email (đếm cho MỌI email, kể
 * cả email đã có tài khoản, nên hết lượt không lộ email có tồn tại hay không).
 */
export const SIGNUP_IP_LIMIT = 10;
export const SIGNUP_EMAIL_LIMIT = 3;
export const SIGNUP_WINDOW_MS = 3_600_000;
export const SIGNUP_NAME_MAX = 100;
export const SIGNUP_PASSWORD_MIN = 8;
/** Chặn gửi chuỗi quá dài vào bcrypt. */
export const SIGNUP_PASSWORD_MAX = 128;
