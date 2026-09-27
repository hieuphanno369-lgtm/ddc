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
 * Luật đăng nhập (K5, K6, K7 - ke-hoach.md), đúng thứ tự:
 * 1. IP đã sai đủ ngưỡng trong cửa sổ trượt -> `ip_limited` (không kiểm mật khẩu).
 * 2. Không có tài khoản: vẫn chạy bcrypt giả (K6), ghi throttle theo email lẫn IP; đủ ngưỡng
 *    trong 24h thì cũng báo `locked` như tài khoản thật (không lộ email không tồn tại).
 * 3. Tài khoản đang khoá -> `locked` ngay, không nói mật khẩu đúng/sai.
 * 4. Mật khẩu sai, hoặc tài khoản chỉ Google (`passwordHash === ''`), hoặc bị tắt -> tăng bộ đếm,
 *    ghi IP sai; lần vừa chạm ngưỡng thì ghi nhật ký `login_locked`.
 * 5. Đúng: xoá bộ đếm sai (nếu có) rồi trả tài khoản.
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
    await recordIpFail();
    return { ok: false, reason: 'locked' };
  }

  const isGoogleOnly = account.passwordHash === '';
  const passwordMatches = isGoogleOnly ? (verifyPassword(password, DUMMY_HASH), false) : verifyPassword(password, account.passwordHash);

  if (!passwordMatches || !account.isActive) {
    const result = await store.registerFailedLogin(email, LOGIN_LOCK_THRESHOLD, nowIso);
    await recordIpFail();
    if (result?.justLocked) {
      await logActivity({ name: account.name || email, email }, 'login_locked', String(result.count));
    }
    return { ok: false, reason: result?.locked ? 'locked' : 'invalid' };
  }

  if (account.failedLoginCount > 0) await store.resetFailedLogin(email);
  return { ok: true, account };
}
