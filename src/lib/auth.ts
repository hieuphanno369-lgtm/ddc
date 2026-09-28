import { cookies, headers } from 'next/headers';
import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { decode as decodeSessionToken, encode as encodeSessionToken } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { AuthAccountState, Role, UserAccount } from '@/server/repo/types';
import { prisma } from '@/server/db';
import { repo } from '@/server/repo/mock-repo';
import { logActivity } from '@/lib/activity';
import { normalizeEmail, GOOGLE_DENIED_LIMIT, GOOGLE_DENIED_WINDOW_MS } from '@/lib/login-policy';
import { clientIpFrom } from '@/lib/client-ip';
import { requireAuthSecret } from '@/lib/env';
import { googleAccessDecision, type GoogleProfileLite } from '@/server/google-access';
import { checkCredentials } from '@/server/login-guard';
import { getAuthStore } from '@/server/auth-store';

export type Access = { role: Role; canViewFinance: boolean };

// T-1 (danh-gia-bao-mat.md, phương án b; nay là quyết định lâu dài QĐ-10): data-entry
// luôn canViewFinance=true, giống admin - tránh "cảm giác an toàn giả" khi Quản trị tắt được nút
// nhưng /nhap-lieu vẫn lộ số tiền cho role này.
const alwaysOnFinance = (r: Role) => r === 'admin' || r === 'data-entry';

/**
 * Q6 (2026-09-25, chủ dự án chốt): canViewFinance đọc theo TỪNG người từ cột DB `user_roles.canViewFinance`
 * (Quản trị bật/tắt được - xem `setUserCanViewFinanceAction`), KHÔNG còn suy từ role. Admin luôn xem được
 * bất kể cột DB.
 */
export function accessFromAccount(a: Pick<UserAccount, 'role' | 'canViewFinance'>): Access {
  return { role: a.role, canViewFinance: alwaysOnFinance(a.role) ? true : a.canViewFinance };
}

/**
 * K14 (đóng L-11): fail-closed - không có tài khoản hoặc DB lỗi trả `null` (không còn fallback
 * ROLE_SEED/viewer). Quyền dựng thẳng từ 1 lần đọc tài khoản (không đọc thêm lần thứ 2).
 */
export async function resolveAccess(email: string): Promise<Access | null> {
  if (process.env.DATABASE_URL) {
    try {
      const row = await prisma.userRole.findUnique({ where: { email: email.toLowerCase() } });
      if (!row) return null;
      return accessFromAccount({ role: row.role as Role, canViewFinance: row.canViewFinance });
    } catch {
      return null;
    }
  }
  const u = repo.getUserRoles().find((x) => x.email === email.toLowerCase());
  if (!u) return null;
  return accessFromAccount(u);
}

async function touchLastLogin(email: string) {
  if (process.env.DATABASE_URL) {
    try {
      await prisma.userRole.update({ where: { email: email.toLowerCase() }, data: { lastLoginAt: new Date() } });
    } catch {
      /* ignore */
    }
    return;
  }
  repo.updateLastLogin(email);
}

/**
 * T-5 (danh-gia-bao-mat.md): chu ky doc lai quyen (role/canViewFinance/isActive) trong callback jwt,
 * thay vi chi luc dang nhap - tat quyen/khoa tai khoan co hieu luc trong vai phut thay vi phai cho
 * toi 8h (session maxAge).
 */
export const ACCESS_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Dùng chung cho nhánh đăng nhập lẫn nhánh kiểm lại định kỳ trong callback `jwt`: tài khoản null
 * hoặc bị tắt (`isActive=false`) -> `token.invalid = true`; ngược lại gán quyền qua `accessFromAccount`.
 */
function applyAccountToToken(token: JWT, account: AuthAccountState | null): void {
  if (!account || !account.isActive) {
    // Tài khoản bị khoá/tắt hoặc đã bị xoá khỏi DB - vô hiệu session ở callback session().
    token.invalid = true;
  } else {
    const access = accessFromAccount(account);
    token.role = access.role;
    token.canViewFinance = access.canViewFinance;
    token.invalid = false;
  }
  token.accessCheckedAt = Date.now();
}

export const authOptions: NextAuthOptions = {
  // Getter: lỗi nổ lúc DÙNG secret (mỗi request), không nổ lúc import module.
  get secret() {
    return requireAuthSecret();
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Task 6 (D3) - nối vào `checkCredentials`/`AuthStore` thật: khoá sau 5 lần sai, giới hạn
        // theo IP, không lộ tài khoản chỉ Google/tài khoản không tồn tại (K5-K7, L1, L7, R1-R3, G2).
        const email = normalizeEmail(credentials?.email);
        const password = credentials?.password ?? '';
        if (!email || !password) return null;
        const ip = clientIpFrom(await headers());
        try {
          const result = await checkCredentials(getAuthStore(), { email, password, ip });
          if (!result.ok) {
            if (result.reason === 'locked' || result.reason === 'ip_limited') throw new Error(result.reason);
            return null;
          }
          await touchLastLogin(email);
          return { id: result.account.email, email: result.account.email, name: result.account.name };
        } catch (e) {
          // G5 - `locked`/`ip_limited` PHẢI ném nguyên văn (next-auth cần đúng 2 chuỗi này ở
          // `res.error`); lỗi khác (ví dụ Prisma mất kết nối) thì KHÔNG log `e.message` (có thể chứa
          // chuỗi kết nối DB), trả `null` (next-auth hiện `CredentialsSignin` chung).
          if (e instanceof Error && (e.message === 'locked' || e.message === 'ip_limited')) throw e;
          console.error('[authorize]', e instanceof Error ? e.name : String(e));
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // session tối đa 8 giờ
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user.email?.toLowerCase() ?? '';
      if (account?.provider === 'google') {
        // S9: chỉ vào khi email đã xác minh, có trong danh sách admin thêm, đang hoạt động,
        // chưa bị khoá - `lockedAt` thật từ Task 5 (không còn cứng `null` như bản Task 3).
        const found = email ? await getAuthStore().getAccountState(email) : null;
        const decision = googleAccessDecision(
          profile as GoogleProfileLite,
          found ? { isActive: found.isActive, lockedAt: found.lockedAt } : null,
        );
        if (decision !== 'allow') {
          // L8 (bao-mat.md) - ghi lại lần bị từ chối kèm lý do, để admin thấy được ai đã thử vào
          // bằng Google không hợp lệ. KHÔNG ghi token/link nào (decision chỉ là 1 trong 5 giá trị cố định).
          // R7 (bao-mat.md vòng 2) - nhánh `unverified` nghĩa là Google CHƯA xác minh email, nên
          // toàn bộ `profile`/`user` (kể cả `name`) là dữ liệu KHÔNG đáng tin (ai đó có thể tự khai
          // tên bất kỳ); dùng tên CỐ ĐỊNH thay vì `user.name` để admin không hiểu nhầm là tên thật.
          const who = decision === 'unverified' ? { name: '(email chua xac minh)', email } : { name: user.name ?? email, email };
          // R7 phần 3, G4 (bao-mat.md) - hạn chế `activity_log` bị spam bởi các lần Google từ chối
          // lặp lại của CÙNG 1 email: "đặt chỗ" TRƯỚC khi ghi log; còn chỗ (`id` khác null) thì ghi
          // như cũ, hết chỗ thì VẪN từ chối đăng nhập (return false) nhưng KHÔNG ghi log thêm (giống
          // cách `requestPasswordReset` bỏ log khi hết chỗ IP - L4, tránh việc chặn spam log lại làm
          // log bị spam).
          if (email) {
            const now = new Date();
            const sinceIso = new Date(now.getTime() - GOOGLE_DENIED_WINDOW_MS).toISOString();
            const reserved = await getAuthStore().reserveThrottle('google_denied', email, now.toISOString(), sinceIso, GOOGLE_DENIED_LIMIT);
            if (reserved !== null) {
              try {
                await logActivity(who, 'login_google_denied', decision);
              } catch {
                /* ignore */
              }
            }
          }
          return false;
        }
      }
      try {
        await logActivity({ name: user.name ?? email, email }, 'login');
      } catch {
        /* ignore */
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // R2-1 (bao-mat.md vòng 2, CAO) - ĐÃ BỎ nhánh riêng làm mới token khi `trigger === 'update'`.
      // Lỗ hổng cũ: `POST /api/auth/session` (kèm csrfToken lấy công khai) sinh `trigger: 'update'`
      // cho BẤT KỲ ai đang giữ cookie phiên (kể cả cookie bị đánh cắp) - nhánh cũ luôn gọi
      // `applyAccountToToken` (có thể hạ `invalid` từ true về false) rồi ghi đè `token.pwdAt` bằng
      // mốc mới nhất trong DB, tức là "hồi sinh" được MỌI phiên đã bị đá do đổi mật khẩu, xoá sạch
      // tác dụng của S8/S-2. Nhánh update giờ CHỈ được phép SIẾT CHẶT thêm (đặt `invalid = true` nếu
      // phát hiện mật khẩu đã đổi sau lúc phiên này đăng nhập), KHÔNG BAO GIỜ nới lỏng - không gọi
      // `applyAccountToToken`, không đụng `token.pwdAt`. Việc cấp cookie MỚI cho phiên vừa tự đổi mật
      // khẩu (đã qua kiểm mật khẩu hiện tại) là việc của `reissueSessionCookie` (server-side, chạy
      // ngay trong `changePasswordAction`), không còn dựa vào client gọi `update()` nữa.
      if (trigger === 'update') {
        const email = token.email;
        if (typeof email === 'string' && email) {
          const account = await getAuthStore().getAccountState(email);
          // R3-4 (bao-mat.md vòng 3, Thấp) - tài khoản không còn/đã bị TẮT (isActive=false) cũng phải
          // vô hiệu ngay ở nhánh này, nhất quán với nhánh kiểm định kỳ (`applyAccountToToken`) - trước
          // đây nhánh update chỉ so `passwordChangedAt`, bỏ qua `isActive`, nên 1 tài khoản vừa bị tắt
          // (chưa qua ACCESS_RECHECK_INTERVAL_MS) vẫn nhận role/canViewFinance trong phản hồi JSON của
          // `POST /api/auth/session` dù middleware/trang khác đã coi phiên là hợp lệ tới lúc đó.
          if (!account || !account.isActive) {
            token.invalid = true;
          } else {
            const changedAtMs = account.passwordChangedAt ? Date.parse(account.passwordChangedAt) : 0;
            if (changedAtMs > (token.pwdAt ?? 0)) token.invalid = true;
          }
        }
        return token;
      }
      if (user?.email) {
        // K14 (đóng L-11): 1 lần đọc tài khoản (getAccountState), quyền dựng thẳng từ đó - không
        // gọi resolveAccess() thêm lần nữa (trước đây đọc DB 2 lần: findAccount() ở authorize/signIn
        // rồi resolveAccess() ở đây). Task 7 - dùng `AuthStore.getAccountState` thay vì `findAccount`
        // cục bộ để có sẵn `passwordChangedAt` (S8), không cần thêm cột này vào `UserAccount`.
        const account = await getAuthStore().getAccountState(user.email);
        applyAccountToToken(token, account);
        if (account) token.name = account.name || token.name;
        // S8 (Task 7) - lưu mốc đổi mật khẩu LÚC đăng nhập; dùng để phát hiện phiên cũ khi mật khẩu
        // bị đổi (đặt lại qua email/admin đặt mật khẩu tạm) SAU thời điểm này.
        token.pwdAt = account?.passwordChangedAt ? Date.parse(account.passwordChangedAt) : 0;
        return token;
      }
      // T-5: token đã có (không phải lần đăng nhập) - đọc lại quyền định kỳ mỗi
      // ACCESS_RECHECK_INTERVAL_MS thay vì chỉ tin token cũ tới khi hết hạn (8h).
      const email = token.email;
      if (typeof email === 'string' && email) {
        const last = typeof token.accessCheckedAt === 'number' ? token.accessCheckedAt : 0;
        if (Date.now() - last > ACCESS_RECHECK_INTERVAL_MS) {
          // R4-1b (bao-mat.md vòng 4, Trung) - `invalid` phải "dính": nếu token ĐÃ bị đánh dấu vô
          // hiệu từ trước (vd `invalidateCurrentSessionCookie` khi khoá tài khoản do đoán sai mật
          // khẩu hiện tại - R4-1a), nhánh kiểm định kỳ này KHÔNG BAO GIỜ được hạ nó về hợp lệ lại.
          // `applyAccountToToken` bên dưới có thể tạm đặt lại `invalid = false` (chỉ dựa theo
          // `isActive` hiện tại của DB), rồi phép so `changedAtMs > pwdAt` có thể (hoặc không) đặt
          // lại `true` - nếu DB CHƯA (hoặc không) phản ánh lý do vô hiệu ban đầu bằng
          // `passwordChangedAt` thì kết quả cuối vẫn phải là `true` vì token này đã từng bị vô hiệu.
          const wasInvalid = token.invalid === true;
          const account = await getAuthStore().getAccountState(email);
          applyAccountToToken(token, account);
          // S8 - mật khẩu đã đổi SAU lúc token này đăng nhập (`token.pwdAt`) -> vô hiệu, dù
          // isActive/lockedAt bình thường (không cho phiên cũ dùng mật khẩu đã bị lộ tiếp tục sống,
          // trễ tối đa `ACCESS_RECHECK_INTERVAL_MS` như mọi kiểm lại định kỳ khác - T-5).
          const changedAtMs = account?.passwordChangedAt ? Date.parse(account.passwordChangedAt) : 0;
          if (changedAtMs > (token.pwdAt ?? 0)) token.invalid = true;
          if (wasInvalid) token.invalid = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.invalid) {
        // T-5: isActive=false hoặc tài khoản không còn trong DB - vô hiệu session ngay, không cho
        // dùng tiếp tới khi hết hạn 8h.
        if (session.user) session.user.email = null;
        return session;
      }
      if (session.user) {
        (session.user as { role?: Role }).role = (token.role as Role) ?? 'viewer';
        session.user.canViewFinance = token.canViewFinance ?? false;
      }
      return session;
    },
  },
};

/**
 * R2-1 (bao-mat.md vòng 2, CAO) - Cách vá 1: thay vì để client gọi `update()` (mở đường cho phiên bị
 * đánh cắp "hồi sinh" qua `POST /api/auth/session` - xem callback `jwt` ở trên), CHỈ request đã đi
 * qua `changePasswordAction` (đã kiểm `currentPassword` đúng) mới được phép cấp lại cookie phiên MỚI
 * cho CHÍNH phiên hiện tại, ngay phía server, sau khi đổi mật khẩu thành công.
 * Không tin dữ liệu client gửi lên: đọc token TỪ COOKIE HIỆN TẠI của chính request này (không nhận
 * tham số nào từ ngoài ngoài `email` đã được `changePasswordAction` xác thực). Dùng chung
 * `secret`/`session.maxAge` của `authOptions` (không nhân bản hằng số); tên cookie + thuộc tính khớp
 * `defaultCookies` của next-auth (không có `authOptions.cookies` tuỳ biến nên next-auth dùng đúng mặc
 * định này) - `secureCookie` suy từ `NEXTAUTH_URL` (không bao giờ tin header `Host`, cùng quy ước
 * K11), đúng quy tắc mặc định mà `next-auth/jwt`'s `getToken()` và `middleware.ts` đang dùng khi đọc
 * token. Không xử lý cookie bị chia nhỏ (chunk) - payload JWT của app này nhỏ (email/role/pwdAt...),
 * không chạm ngưỡng ~4KB next-auth mới chia nhỏ cookie.
 * Dùng chung cho `reissueSessionCookie` (cấp lại cookie sau khi tự đổi mật khẩu) và
 * `invalidateCurrentSessionCookie` (R3-2 - đá ngay phiên hiện tại khi tài khoản bị khoá do đoán sai
 * mật khẩu hiện tại nhiều lần) - cả 2 chỉ được sửa cookie của ĐÚNG người gọi (`token.email === email`),
 * không bao giờ đụng tới cookie của người khác.
 */
async function withOwnSessionCookie(email: string, tag: string, mutate: (token: JWT) => Promise<void>): Promise<void> {
  try {
    const secureCookie = process.env.NEXTAUTH_URL?.startsWith('https://') ?? !!process.env.VERCEL;
    const cookieName = secureCookie ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
    const store = await cookies();
    const raw = store.get(cookieName)?.value;
    if (!raw) return; // không có cookie phiên nào đang mở trong request này - bỏ qua, không phải lỗi

    const secret = requireAuthSecret();
    const token = await decodeSessionToken({ token: raw, secret });
    // Chỉ sửa cookie của ĐÚNG người mà bên gọi đã xác thực (email đã qua requireAuth ở actions.ts).
    if (!token || token.email !== email) return;

    await mutate(token);

    const maxAge = authOptions.session?.maxAge ?? 8 * 60 * 60;
    const newRaw = await encodeSessionToken({ token, secret, maxAge });
    store.set(cookieName, newRaw, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: secureCookie,
      maxAge,
    });
  } catch (e) {
    // Sửa cookie ở đây chỉ là tiện ích/hàng rào thêm - lỗi ở đây KHÔNG được làm hỏng hành động đã
    // thành công (đổi mật khẩu, khoá tài khoản); không log message (có thể chứa dữ liệu nhạy cảm).
    console.error(`[${tag}]`, e instanceof Error ? e.name : String(e));
  }
}

/**
 * R3-1 (bao-mat.md vòng 3, Trung) - nhận thêm `newHash` (hash mới mà `changePasswordAction` VỪA GHI
 * qua `setPasswordIfHash`, không phải đọc lại DB rồi tin ngay): giữa lúc ghi xong (T2) và lúc hàm này
 * đọc lại tài khoản (T3) vẫn còn 1 khe hở race - 1 request KHÁC (admin đặt mật khẩu tạm, đặt lại qua
 * email) có thể đã ghi đè mật khẩu SAU T2. Nếu chỉ tin DB một cách vô điều kiện như bản cũ, hàm này sẽ
 * "hồi sinh" nhầm phiên bằng 1 mốc `pwdAt` không còn đúng - xoá sạch tác dụng của lần đổi mật khẩu
 * KHÁC vừa thắng. Nay so `passwordHash` MỚI NHẤT trong DB với `newHash`: khớp (trường hợp bình
 * thường, không có race) thì làm mới `pwdAt` như cũ; khác (bị ghi đè sau khi request này đã ghi) thì
 * vô hiệu ngay (fail-closed) thay vì hồi sinh nhầm.
 * R4-3 (bao-mat.md vòng 4, Thấp) - so trực tiếp `passwordHash` thay vì so lệch mốc giờ `changedAtIso`
 * như bản cũ: so hash không phụ thuộc độ chính xác đồng hồ (nhiều instance) hay 2 lần ghi trùng mili
 * giây, tránh bỏ sót race mà phép so mốc giờ có thể bỏ lọt.
 */
export async function reissueSessionCookie(email: string, newHash: string): Promise<void> {
  await withOwnSessionCookie(email, 'reissueSessionCookie', async (token) => {
    const account = await getAuthStore().getAccountState(email);
    applyAccountToToken(token, account);
    const dbChangedAtMs = account?.passwordChangedAt ? Date.parse(account.passwordChangedAt) : 0;
    token.pwdAt = dbChangedAtMs;
    // R4-3 (bao-mat.md vòng 4, Thấp) - so trực tiếp HASH hiện tại trong DB với `newHash` vừa ghi
    // (thay vì so lệch mốc giờ `changedAtIso`): tránh bỏ sót khi lệch đồng hồ giữa nhiều instance
    // hoặc 2 lần ghi trùng mili giây - so hash không phụ thuộc độ chính xác của đồng hồ.
    if (!account || account.passwordHash !== newHash) token.invalid = true;
  });
}

/**
 * R3-2 (bao-mat.md vòng 3, Trung, chủ dự án chốt 2026-09-28) - tài khoản vừa bị KHOÁ ngay trong
 * `changePasswordAction` (đủ 5 lần đoán sai mật khẩu hiện tại): khác với khoá do đăng nhập sai (Q1 =
 * phương án a - không cắt phiên đang mở, chỉ chặn đăng nhập MỚI), ở đây kẻ đoán mật khẩu ĐANG GIỮ
 * chính phiên đó (có thể là cookie bị đánh cắp) nên phiên hiện tại PHẢI bị đá ngay, không chờ
 * `ACCESS_RECHECK_INTERVAL_MS`. Chỉ đặt `token.invalid = true` (không đổi `role`/`pwdAt`/... gì
 * khác) - lần request kế tiếp của phiên này (middleware hoặc `session()` callback) sẽ tự đẩy về
 * `/login`.
 */
export async function invalidateCurrentSessionCookie(email: string): Promise<void> {
  await withOwnSessionCookie(email, 'invalidateCurrentSessionCookie', async (token) => {
    token.invalid = true;
  });
}
