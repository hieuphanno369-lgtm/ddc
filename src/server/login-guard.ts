import { hashPassword, verifyPassword } from '@/lib/password';
import { logActivity } from '@/lib/activity';
import {
  ACCOUNT_GUESS_WINDOW_MS,
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
 * gian phản hồi không lộ tài khoản nào tồn tại. Hash sinh 1 LẦN (cost 10, giống mật khẩu thật, không
 * phải bí mật, chỉ dùng để tốn đúng bằng ấy thời gian CPU), rồi giữ lại cho các lần gọi sau.
 * S-1 (bao-mat.md vòng 4) - `hashPassword` giờ bất đồng bộ (`bcryptjs.hash`), không còn tính được
 * ngay lúc load module (top-level) như trước; tính LƯỜI (lazy) ở lần gọi đầu tiên.
 */
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('khong-ton-tai-mat-khau-nay-dung-de-can-thoi-gian');
  return dummyHashPromise;
}

/**
 * R5-3 (bao-mat.md vòng 5, Thấp) - "khuôn" trả lời DÙNG CHUNG cho 2 nhánh cần giống hệt nhau về thời
 * gian: tài khoản THẬT đang bị khoá (`lockedAt !== null`), VÀ (mới từ vòng 5) tài khoản THẬT hết chỗ
 * giữ đoán mật khẩu (`reserveAccountGuess` trả `null`, xem R5-1) - trước vòng 5, nhánh hết chỗ trả
 * `locked` NGAY không bcrypt, lộ thời gian phản hồi khác nhánh đã khoá hẳn (S-3, vòng 4). Chạy bcrypt
 * giả (L1) + đúng 1 `recordThrottle`/`countThrottle` kind `login_locked_probe` (S-3, vòng 4 - kết quả
 * không dùng để quyết định gì, chỉ để cân thời gian với nhánh "email lạ").
 */
async function respondAccountLocked(
  store: AuthStore,
  email: string,
  password: string,
  now: Date,
  nowIso: string,
): Promise<CredentialResult> {
  await verifyPassword(password, await getDummyHash());
  await store.recordThrottle('login_locked_probe', email, nowIso);
  const sinceProbeIso = new Date(now.getTime() - UNKNOWN_EMAIL_WINDOW_MS).toISOString();
  await store.countThrottle('login_locked_probe', email, sinceProbeIso);
  return { ok: false, reason: 'locked' };
}

/**
 * Luật đăng nhập (K5, K6, K7, L1, L3, L7, R1, R2, R3, G2 - `.bangiao/bao-mat.md`), đúng thứ tự:
 * 0. G2 (vòng bảo mật 3) - chuẩn hoá `email = input.email.trim().toLowerCase()` TRƯỚC khi dùng làm
 *    khoá throttle (không còn 2 khoá khác nhau cho cùng 1 email chỉ vì hoa/thường hay khoảng trắng).
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
  const { password, ip } = input;
  // G2 (bao-mat.md vòng 3) - chuẩn hoá email TRƯỚC khi dùng làm khoá throttle: trước đây
  // `login_fail_unknown_email` khoá theo chuỗi thô người gọi gõ, nên "A@Foo.com", " a@foo.com " và
  // "a@foo.com" bị đếm thành 3 khoá khác nhau (bộ đếm/khoá theo email lạ có thể bị lách qua bằng biến
  // thể hoa/thường hoặc khoảng trắng).
  const email = input.email.trim().toLowerCase();
  const nowIso = now.toISOString();
  // R3 (bao-mat.md vòng 2) - `ip` rỗng (không xác định được IP thật) LUÔN gom vào khoá `'unknown'`,
  // KHÔNG còn nhánh bỏ qua giới hạn IP như trước (fail-open cũ: `ip === ''` thì coi như vô hạn).
  const ipKey = ip.trim() || 'unknown';

  // R2 - "đặt chỗ" NGUYÊN TỬ cho lượt này ở NGAY ĐẦU hàm, TRƯỚC bcrypt và trước khi biết lượt này
  // đúng hay sai mật khẩu: đóng race TOCTOU khi N yêu cầu chạy đồng thời (`Promise.all`) cùng đọc
  // thấy số đếm CŨ trước khi ai kịp ghi, khiến cả N đều lọt qua và chạy bcrypt (xem `reserveThrottle`
  // ở `types.ts`/`mock-repo-auth.ts`). Nếu cuối cùng lượt này ĐÚNG mật khẩu (không tính là 1 lần
  // sai) thì `store.releaseThrottle(ipReserved)` rút chỗ vừa đặt ra (gọi đúng 1 lần duy nhất ở nhánh
  // "đúng" bên dưới, không cần cờ chống gọi trùng).
  const sinceIso = new Date(now.getTime() - IP_FAIL_WINDOW_MS).toISOString();
  const ipReserved = await store.reserveThrottle('login_fail_ip', ipKey, nowIso, sinceIso, IP_FAIL_LIMIT);
  if (ipReserved === null) return { ok: false, reason: 'ip_limited' };

  const account = await store.getAccountState(email);

  if (!account) {
    await verifyPassword(password, await getDummyHash());
    await store.recordThrottle('login_fail_unknown_email', email, nowIso);
    const sinceUnknownIso = new Date(now.getTime() - UNKNOWN_EMAIL_WINDOW_MS).toISOString();
    const count = await store.countThrottle('login_fail_unknown_email', email, sinceUnknownIso);
    return { ok: false, reason: count >= LOGIN_LOCK_THRESHOLD ? 'locked' : 'invalid' };
  }

  if (account.lockedAt !== null) {
    // L1 (bao-mat.md vòng 1)/R5-3 (vòng 5) - dùng chung 1 "khuôn" trả lời với nhánh hết chỗ đoán bên
    // dưới (xem `respondAccountLocked`): chạy bcrypt giả TRƯỚC KHI trả, để tốn thời gian giống hệt
    // nhánh email lạ ở trên (không cho kẻ tấn công đo thời gian phân biệt "email tồn tại và đã khoá"
    // với "email lạ").
    return respondAccountLocked(store, email, password, now, nowIso);
  }

  const isGoogleOnly = account.passwordHash === '';
  if (isGoogleOnly) {
    // R1 (bao-mat.md vòng 2, giữ đúng quyết định L7) - đi Y HỆT nhánh "email lạ" ở trên: ghi/đếm
    // CHUNG 1 kho theo email (`login_fail_unknown_email`), KHÔNG gọi `registerFailedLogin`, KHÔNG
    // đặt `lockedAt` (không ảnh hưởng đăng nhập Google thật). Trước đây nhánh này luôn trả `invalid`
    // trong khi nhánh email lạ báo `locked` từ lần 5 - lộ ra email nào là tài khoản chỉ Google (sai
    // 5 lần vẫn `invalid` mãi = chắc chắn tồn tại). Nay `reason` giống hệt nhánh email lạ.
    await verifyPassword(password, await getDummyHash());
    await store.recordThrottle('login_fail_unknown_email', email, nowIso);
    const sinceUnknownIso = new Date(now.getTime() - UNKNOWN_EMAIL_WINDOW_MS).toISOString();
    const count = await store.countThrottle('login_fail_unknown_email', email, sinceUnknownIso);
    return { ok: false, reason: count >= LOGIN_LOCK_THRESHOLD ? 'locked' : 'invalid' };
  }

  // R5-1 (bao-mat.md vòng 5, Thấp) - thay `reserveThrottle` chung (vòng 4, R4-2) bằng
  // `reserveAccountGuess` (đọc `failedLoginCount`/`lockedAt` TƯƠI từ DB ngay trong giao dịch giữ chỗ,
  // đếm đúng số chỗ ĐANG GIỮ chứ không phải số dòng trong 1 cửa sổ thời gian) - xem JSDoc ở
  // `types.ts` vì sao cách cũ có thể để lọt quá `LOGIN_LOCK_THRESHOLD` lượt bcrypt thật khi có nhiều
  // yêu cầu chạy chồng chéo phức tạp (không chỉ đơn thuần `Promise.all` đồng loạt).
  const sinceAccountIso = new Date(now.getTime() - ACCOUNT_GUESS_WINDOW_MS).toISOString();
  const accountReserved = await store.reserveAccountGuess('login_fail_account', email, nowIso, sinceAccountIso, LOGIN_LOCK_THRESHOLD);
  if (accountReserved === null) {
    // R5-3 (bao-mat.md vòng 5, Thấp) - TRƯỚC ĐÂY nhánh hết chỗ trả `locked` NGAY (không bcrypt), lộ
    // ra thời gian phản hồi khác nhánh "đã khoá thật" (có bcrypt giả) - đo được khi 1 tài khoản THẬT
    // có mật khẩu đang ở gần ngưỡng khoá khác với "đã khoá hẳn"/"email lạ". Đi Y HỆT nhánh `lockedAt`
    // ở trên (dùng chung `respondAccountLocked`) - màn Đổi mật khẩu không có kiểu bcrypt-giả này nên
    // không cần áp dụng tương tự.
    return respondAccountLocked(store, email, password, now, nowIso);
  }

  // R5-1 - CHỈ rút chỗ SAU KHI `registerFailedLogin` (nhánh sai) hoặc `resetFailedLogin` (nhánh đúng)
  // chạy XONG, dùng try/finally bao trọn cả đoạn (kể cả khi có lỗi ném ra) - rút quá sớm (ngay sau
  // bcrypt, như vòng 4) là đúng gốc lỗi R5-1.
  try {
    const passwordMatches = await verifyPassword(password, account.passwordHash);

    if (!passwordMatches || !account.isActive) {
      const result = await store.registerFailedLogin(email, LOGIN_LOCK_THRESHOLD, nowIso);
      if (result?.justLocked) {
        await logActivity({ name: account.name || email, email }, 'login_locked', String(result.count));
      }
      return { ok: false, reason: result?.locked ? 'locked' : 'invalid' };
    }

    // Đúng mật khẩu: lượt này KHÔNG tính là 1 lần sai theo IP - rút lại chỗ đã đặt ở đầu hàm.
    await store.releaseThrottle(ipReserved);

    // L3 - xác nhận nguyên tử, LUÔN gọi (kể cả `failedLoginCount === 0`): xem docstring hàm.
    const confirmed = await store.resetFailedLogin(email);
    if (!confirmed) return { ok: false, reason: 'locked' };
    return { ok: true, account };
  } finally {
    await store.releaseThrottle(accountReserved);
  }
}
