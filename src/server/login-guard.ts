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
 * Luật đăng nhập (K5, K6, K7, L1, L3, L7, R1, R2, R3 - `.bangiao/bao-mat.md`), đúng thứ tự:
 * 1. "Đặt chỗ" NGUYÊN TỬ cho IP (`ipKey = ip.trim() || 'unknown'`, R3 - không còn IP rỗng nào bỏ
 *    qua giới hạn) NGAY TRƯỚC bcrypt (R2 - đóng race TOCTOU khi nhiều yêu cầu chạy đồng thời cùng
 *    đọc số đếm cũ trước khi ai kịp ghi); hết chỗ -> `ip_limited` (không kiểm mật khẩu, không bcrypt).
 * 2. Không có tài khoản: vẫn chạy bcrypt giả (K6), ghi throttle theo email; đủ ngưỡng trong 24h thì
 *    cũng báo `locked` như tài khoản thật (không lộ email không tồn tại).
 * 3. Tài khoản đang khoá -> vẫn chạy bcrypt giả (L1, tránh timing oracle phân biệt được với nhánh
 *    email lạ ở bước 2) rồi trả `locked` ngay, không nói mật khẩu đúng/sai.
 * 4. Tài khoản chỉ Google (`passwordHash === ''`) -> vẫn chạy bcrypt giả (không lộ timing), đi Y HỆT
 *    nhánh email lạ ở bước 2 (ghi/đếm chung theo email, R1 - trước đây nhánh này luôn trả `invalid`
 *    trong khi email lạ báo `locked` từ lần 5, lộ ra email nào là tài khoản chỉ Google), KHÔNG tăng
 *    bộ đếm tài khoản, KHÔNG bị khoá (`lockedAt`) vì sai ở form mật khẩu (L7, quyết định chủ dự án
 *    2026-09-27: tránh DoS tài khoản chỉ Google bằng cách cố tình nhập sai mật khẩu nhiều lần).
 * 5. Mật khẩu sai, hoặc tài khoản bị tắt -> tăng bộ đếm tài khoản; lần vừa chạm ngưỡng thì ghi
 *    nhật ký `login_locked`. Chỗ IP đã đặt ở bước 1 GIỮ NGUYÊN (tính là 1 lần sai theo IP).
 * 6. Đúng: rút lại chỗ IP đã đặt ở bước 1 (không tính lượt đúng vào giới hạn IP), rồi xác nhận
 *    NGUYÊN TỬ qua `resetFailedLogin` (L3) - vì `account` chỉ là bản chụp đọc ở đầu hàm, có thể đã
 *    bị các yêu cầu sai đồng thời khoá xong trước khi chạy tới đây (race TOCTOU); `resetFailedLogin`
 *    phải tự kiểm lại tại thời điểm ghi (`locked_at IS NULL`) chứ không được dựa vào bản chụp cũ -
 *    `false` nghĩa là đã bị khoá, coi như `locked`, KHÔNG được coi là đăng nhập thành công.
 */
export async function checkCredentials(
  store: AuthStore,
  input: { email: string; password: string; ip: string },
  now: Date = new Date(),
): Promise<CredentialResult> {
  const { email, password, ip } = input;
  const nowIso = now.toISOString();
  // R3 (bao-mat.md vòng 2) - `ip` rỗng (không xác định được IP thật) LUÔN gom vào khoá `'unknown'`,
  // KHÔNG còn nhánh bỏ qua giới hạn IP như trước (fail-open cũ: `ip === ''` thì coi như vô hạn).
  const ipKey = ip.trim() || 'unknown';

  // R2 - "đặt chỗ" NGUYÊN TỬ cho lượt này ở NGAY ĐẦU hàm, TRƯỚC bcrypt và trước khi biết lượt này
  // đúng hay sai mật khẩu: đóng race TOCTOU khi N yêu cầu chạy đồng thời (`Promise.all`) cùng đọc
  // thấy số đếm CŨ trước khi ai kịp ghi, khiến cả N đều lọt qua và chạy bcrypt (xem `reserveThrottle`
  // ở `types.ts`/`mock-repo-auth.ts`). Nếu cuối cùng lượt này ĐÚNG mật khẩu (không tính là 1 lần
  // sai) thì `releaseIpSlot()` rút chỗ vừa đặt ra.
  const sinceIso = new Date(now.getTime() - IP_FAIL_WINDOW_MS).toISOString();
  const ipReserved = await store.reserveThrottle('login_fail_ip', ipKey, nowIso, sinceIso, IP_FAIL_LIMIT);
  if (!ipReserved) return { ok: false, reason: 'ip_limited' };
  let ipSlotReleased = false;
  const releaseIpSlot = async () => {
    if (ipSlotReleased) return;
    ipSlotReleased = true;
    await store.releaseThrottle('login_fail_ip', ipKey, nowIso);
  };

  const account = await store.getAccountState(email);

  if (!account) {
    verifyPassword(password, DUMMY_HASH);
    await store.recordThrottle('login_fail_unknown_email', email, nowIso);
    const sinceUnknownIso = new Date(now.getTime() - UNKNOWN_EMAIL_WINDOW_MS).toISOString();
    const count = await store.countThrottle('login_fail_unknown_email', email, sinceUnknownIso);
    return { ok: false, reason: count >= LOGIN_LOCK_THRESHOLD ? 'locked' : 'invalid' };
  }

  if (account.lockedAt !== null) {
    // L1 - chạy bcrypt giả TRƯỚC KHI trả, để nhánh này tốn thời gian giống hệt nhánh email lạ ở
    // trên (không cho kẻ tấn công đo thời gian phân biệt "email tồn tại và đã khoá" với "email lạ").
    verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: 'locked' };
  }

  const isGoogleOnly = account.passwordHash === '';
  if (isGoogleOnly) {
    // R1 (bao-mat.md vòng 2, giữ đúng quyết định L7) - đi Y HỆT nhánh "email lạ" ở trên: ghi/đếm
    // CHUNG 1 kho theo email (`login_fail_unknown_email`), KHÔNG gọi `registerFailedLogin`, KHÔNG
    // đặt `lockedAt` (không ảnh hưởng đăng nhập Google thật). Trước đây nhánh này luôn trả `invalid`
    // trong khi nhánh email lạ báo `locked` từ lần 5 - lộ ra email nào là tài khoản chỉ Google (sai
    // 5 lần vẫn `invalid` mãi = chắc chắn tồn tại). Nay `reason` giống hệt nhánh email lạ.
    verifyPassword(password, DUMMY_HASH);
    await store.recordThrottle('login_fail_unknown_email', email, nowIso);
    const sinceUnknownIso = new Date(now.getTime() - UNKNOWN_EMAIL_WINDOW_MS).toISOString();
    const count = await store.countThrottle('login_fail_unknown_email', email, sinceUnknownIso);
    return { ok: false, reason: count >= LOGIN_LOCK_THRESHOLD ? 'locked' : 'invalid' };
  }

  const passwordMatches = verifyPassword(password, account.passwordHash);

  if (!passwordMatches || !account.isActive) {
    const result = await store.registerFailedLogin(email, LOGIN_LOCK_THRESHOLD, nowIso);
    if (result?.justLocked) {
      await logActivity({ name: account.name || email, email }, 'login_locked', String(result.count));
    }
    return { ok: false, reason: result?.locked ? 'locked' : 'invalid' };
  }

  // Đúng mật khẩu: lượt này KHÔNG tính là 1 lần sai theo IP - rút lại chỗ đã đặt ở đầu hàm.
  await releaseIpSlot();

  // L3 - xác nhận nguyên tử, LUÔN gọi (kể cả `failedLoginCount === 0`): xem docstring hàm.
  const confirmed = await store.resetFailedLogin(email);
  if (!confirmed) return { ok: false, reason: 'locked' };
  return { ok: true, account };
}
