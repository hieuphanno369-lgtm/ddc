import { logActivity } from '@/lib/activity';
import { hashPassword } from '@/lib/password';
import {
  SIGNUP_EMAIL_LIMIT,
  SIGNUP_IP_LIMIT,
  SIGNUP_NAME_MAX,
  SIGNUP_PASSWORD_MAX,
  SIGNUP_PASSWORD_MIN,
  SIGNUP_WINDOW_MS,
  normalizeEmail,
} from '@/lib/login-policy';
import { isCompanyEmail } from '@/lib/signup-policy';
import type { SignupStore } from './repo/signup-types';
import type { AuthStore } from './repo/types';

export type SignupField = 'name' | 'department' | 'email_domain' | 'too_short' | 'too_long';
export type SignupResult =
  | { status: 'accepted' }
  | { status: 'invalid'; field: SignupField }
  | { status: 'rate_limited' };

export interface SignupInput {
  name: unknown;
  departmentId: unknown;
  email: unknown;
  password: unknown;
  locale: 'vi' | 'en';
  ip: string;
}

/** Tên và email cố định ghi vào nhật ký khi đăng ký trùng: không lưu email do người gọi tự gõ. */
const DUPLICATE_LOG_ID = 'dang-ky-trung';

/**
 * Phần còn lại sau khi băm mật khẩu (kiểm email đã có, ghi DB, ghi nhật ký) chạy NỀN theo hàng đợi có timeout,
 * đúng khuôn `resetRequestQueueTail` của `password-reset.ts` (K10): thời gian phản hồi không phụ thuộc email
 * mới hay đã có, nên không có timing oracle về việc email đã đăng ký.
 */
let signupQueueTail: Promise<void> = Promise.resolve();

/** CHỈ dùng trong test - đợi hàng đợi xử lý đăng ký chạy xong. */
export function __signupQueueIdleForTest(): Promise<void> {
  return signupQueueTail.then(
    () => undefined,
    () => undefined,
  );
}

/** Việc nền quá hạn bị coi là lỗi để 1 việc bị treo không chặn cả hàng đợi (khuôn R6 của password-reset). */
const SIGNUP_JOB_TIMEOUT_MS = 30_000;

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

async function finishSignup(
  signup: SignupStore,
  row: { email: string; name: string; departmentId: number | null; passwordHash: string; locale: 'vi' | 'en'; ip: string },
  now: Date,
): Promise<void> {
  const duplicate = () =>
    logActivity({ name: DUPLICATE_LOG_ID, email: DUPLICATE_LOG_ID }, 'signup_request', 'duplicate');
  if (await signup.emailTaken(row.email)) {
    await duplicate();
    return;
  }
  const result = await signup.createRequest({
    email: row.email,
    name: row.name,
    departmentId: row.departmentId,
    passwordHash: row.passwordHash,
    locale: row.locale,
    requestIp: row.ip,
    createdAtIso: now.toISOString(),
  });
  if (result === 'duplicate') {
    await duplicate();
    return;
  }
  await logActivity({ name: row.name, email: row.email }, 'signup_request', 'created');
}

/** Kiểm dữ liệu nhập theo thứ tự name -> department -> email_domain -> password, trả lỗi đầu tiên. */
async function validate(
  signup: SignupStore,
  input: SignupInput,
): Promise<
  | { ok: true; name: string; email: string; password: string; departmentId: number | null }
  | { ok: false; field: SignupField }
> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > SIGNUP_NAME_MAX) return { ok: false, field: 'name' };

  const active = await signup.listActiveDepartments();
  const rawDepartment = input.departmentId ?? null;
  let departmentId: number | null = null;
  if (active.length > 0) {
    if (typeof rawDepartment !== 'number' || !Number.isInteger(rawDepartment) || !active.some((d) => d.id === rawDepartment)) {
      return { ok: false, field: 'department' };
    }
    departmentId = rawDepartment;
  } else if (rawDepartment !== null) {
    return { ok: false, field: 'department' };
  }

  const email = normalizeEmail(input.email);
  if (!email || !isCompanyEmail(email)) return { ok: false, field: 'email_domain' };

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length < SIGNUP_PASSWORD_MIN) return { ok: false, field: 'too_short' };
  if (password.length > SIGNUP_PASSWORD_MAX) return { ok: false, field: 'too_long' };

  return { ok: true, name, email, password, departmentId };
}

/**
 * Đăng ký tài khoản chờ admin bật (trang công khai, KHÔNG cần đăng nhập). Thứ tự (K10-K12):
 * 1. Kiểm dữ liệu nhập - chỉ phụ thuộc dữ liệu nhập và danh mục phòng ban công khai, không đọc tài khoản.
 * 2. "Đặt chỗ" nguyên tử theo IP (10/giờ) rồi theo email (3/giờ); email hết chỗ thì nhả lại chỗ IP.
 *    Hết chỗ ở chiều nào cũng KHÔNG băm, KHÔNG ghi nhật ký -> `rate_limited`. Giới hạn tính cho MỌI email nên
 *    không lộ email có tồn tại hay không.
 * 3. Băm mật khẩu cho MỌI yêu cầu còn lại (email mới, đã có tài khoản, đang chờ đều tốn cùng chi phí).
 * 4. Việc nền: email đã có (tài khoản hoặc đăng ký chờ) thì chỉ ghi nhật ký `duplicate`; email mới thì tạo đăng ký.
 * 5. Luôn trả `accepted` giống nhau.
 */
export async function requestSignup(
  signup: SignupStore,
  auth: AuthStore,
  input: SignupInput,
  now: Date = new Date(),
): Promise<SignupResult> {
  const checked = await validate(signup, input);
  if (!checked.ok) return { status: 'invalid', field: checked.field };

  const ipKey = input.ip.trim() || 'unknown';
  const nowIso = now.toISOString();
  const sinceIso = new Date(now.getTime() - SIGNUP_WINDOW_MS).toISOString();
  const ipReserved = await auth.reserveThrottle('signup_ip', ipKey, nowIso, sinceIso, SIGNUP_IP_LIMIT);
  if (ipReserved === null) return { status: 'rate_limited' };
  const emailReserved = await auth.reserveThrottle('signup_email', checked.email, nowIso, sinceIso, SIGNUP_EMAIL_LIMIT);
  if (emailReserved === null) {
    await auth.releaseThrottle(ipReserved);
    return { status: 'rate_limited' };
  }

  const passwordHash = await hashPassword(checked.password);

  const row = {
    email: checked.email,
    name: checked.name,
    departmentId: checked.departmentId,
    passwordHash,
    locale: input.locale,
    ip: input.ip.trim(),
  };
  signupQueueTail = signupQueueTail
    .then(() => withTimeout(finishSignup(signup, row, now), SIGNUP_JOB_TIMEOUT_MS))
    .catch((e) => {
      // Chỉ log tên lỗi (message có thể chứa thông tin hạ tầng), khuôn password-reset.
      console.error('[signup] loi xu ly nen', e instanceof Error ? e.name : String(e));
    });

  return { status: 'accepted' };
}
