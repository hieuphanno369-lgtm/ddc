import { hashPassword, verifyPassword } from '@/lib/password';
import { logActivity } from '@/lib/activity';
import {
  IP_FAIL_LIMIT,
  IP_FAIL_WINDOW_MS,
  LOGIN_LOCK_THRESHOLD,
  UNKNOWN_EMAIL_WINDOW_MS,
} from '@/lib/login-policy';
import type { AuthAccountState, AuthStore } from './repo/types';

export type CredentialResult =
  | { ok: true; account: AuthAccountState }
  | { ok: false; reason: 'invalid' | 'locked' | 'ip_limited' };

/**
 * K6 - email không có tài khoản (hoặc tài khoản chỉ Google) vẫn chạy 1 lần bcrypt giả để thời
 * gian phản hồi không lộ tài khoản nào tồn tại. Hash sinh 1 lần lúc load module (cost 10, giống
 * mật khẩu thật) - không phải bí mật, chỉ dùng để tốn đúng bằng ấy thời gian CPU.
 */
const DUMMY_HASH = hashPassword('khong-ton-tai-mat-khau-nay-dung-de-can-thoi-gian');

/**
 * Luật đăng nhập (K5, K6, K7, L1, L3, L7 - `.bangiao/bao-mat.md`), đúng thứ tự:
 * 1. IP đã sai đủ ngưỡng trong cửa sổ trượt -> `ip_limited` (không kiểm mật khẩu).
 * 2. Không có tài khoản: vẫn chạy bcrypt giả (K6), ghi throttle theo email lẫn IP; đủ ngưỡng
 *    trong 24h thì cũng báo `locked` như tài khoản thật (không lộ email không tồn tại).
 * 3. Tài khoản đang khoá -> vẫn chạy bcrypt giả (L1, tránh timing oracle phân biệt được với nhánh
 *    email lạ ở bước 2) rồi trả `locked` ngay, không nói mật khẩu đúng/sai.
 * 4. Tài khoản chỉ Google (`passwordHash === ''`) -> vẫn chạy bcrypt giả (không lộ timing) nhưng
 *    KHÔNG tăng bộ đếm, KHÔNG bị khoá vì sai ở form mật khẩu (L7, quyết định chủ dự án 2026-09-27:
 *    tránh DoS tài khoản chỉ Google bằng cách cố tình nhập sai mật khẩu nhiều lần).
 * 5. Mật khẩu sai, hoặc tài khoản bị tắt -> tăng bộ đếm, ghi IP sai; lần vừa chạm ngưỡng thì ghi
 *    nhật ký `login_locked`.
 * 6. Đúng: xác nhận NGUYÊN TỬ qua `resetFailedLogin` (L3) - vì `account` chỉ là bản chụp đọc ở đầu
 *    hàm, có thể đã bị các yêu cầu sai đồng thời khoá xong trước khi chạy tới đây (race TOCTOU);
 *    `resetFailedLogin` phải tự kiểm lại tại thời điểm ghi (`locked_at IS NULL`) chứ không được dựa
 *    vào bản chụp cũ - `false` nghĩa là đã bị khoá, coi như `locked`, KHÔNG được coi là đăng nhập
 *    thành công.
 */
export async function checkCredentials(
  store: AuthStore,
  input: { email: string; password: string; ip: string },
  now: Date = new Date(),
): Promise<CredentialResult> {
  const { email, password, ip } = input;
  const nowIso = now.toISOString();

  if (ip !== '') {
    const sinceIso = new Date(now.getTime() - IP_FAIL_WINDOW_MS).toISOString();
    if ((await store.countThrottle('login_fail_ip', ip, sinceIso)) >= IP_FAIL_LIMIT) {
      return { ok: false, reason: 'ip_limited' };
    }
  }

  const recordIpFail = async () => {
    if (ip !== '') await store.recordThrottle('login_fail_ip', ip, nowIso);
  };

  const account = await store.getAccountState(email);

  if (!account) {
    verifyPassword(password, DUMMY_HASH);
    await store.recordThrottle('login_fail_unknown_email', email, nowIso);
    await recordIpFail();
    const sinceIso = new Date(now.getTime() - UNKNOWN_EMAIL_WINDOW_MS).toISOString();
    const count = await store.countThrottle('login_fail_unknown_email', email, sinceIso);
    return { ok: false, reason: count >= LOGIN_LOCK_THRESHOLD ? 'locked' : 'invalid' };
  }

  if (account.lockedAt !== null) {
    // L1 - chạy bcrypt giả TRƯỚC KHI trả, để nhánh này tốn thời gian giống hệt nhánh email lạ ở
    // trên (không cho kẻ tấn công đo thời gian phân biệt "email tồn tại và đã khoá" với "email lạ").
    verifyPassword(password, DUMMY_HASH);
    await recordIpFail();
    return { ok: false, reason: 'locked' };
  }

  const isGoogleOnly = account.passwordHash === '';
  if (isGoogleOnly) {
    // L7 - vẫn chạy bcrypt giả (không lộ timing tài khoản nào chỉ Google) nhưng KHÔNG tăng bộ đếm
    // và KHÔNG khoá tài khoản qua đường này (tránh DoS tài khoản chỉ Google bằng form mật khẩu).
    verifyPassword(password, DUMMY_HASH);
    await recordIpFail();
    return { ok: false, reason: 'invalid' };
  }

  const passwordMatches = verifyPassword(password, account.passwordHash);

  if (!passwordMatches || !account.isActive) {
    const result = await store.registerFailedLogin(email, LOGIN_LOCK_THRESHOLD, nowIso);
    await recordIpFail();
    if (result?.justLocked) {
      await logActivity({ name: account.name || email, email }, 'login_locked', String(result.count));
    }
    return { ok: false, reason: result?.locked ? 'locked' : 'invalid' };
  }

  // L3 - xác nhận nguyên tử, LUÔN gọi (kể cả `failedLoginCount === 0`): xem docstring hàm.
  const confirmed = await store.resetFailedLogin(email);
  if (!confirmed) return { ok: false, reason: 'locked' };
  return { ok: true, account };
}
