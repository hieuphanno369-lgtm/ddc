import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { Role, UserAccount } from '@/server/repo/types';
import { prisma } from '@/server/db';
import { repo } from '@/server/repo/mock-repo';
import { logActivity } from '@/lib/activity';
import { verifyPassword } from '@/lib/password';
import { requireAuthSecret } from '@/lib/env';
import { googleAccessDecision, type GoogleProfileLite } from '@/server/google-access';

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

async function findAccount(email: string): Promise<UserAccount | null> {
  const e = email.toLowerCase();
  if (process.env.DATABASE_URL) {
    try {
      const row = await prisma.userRole.findUnique({ where: { email: e } });
      if (!row) return null;
      return {
        email: row.email,
        name: row.name,
        passwordHash: row.passwordHash,
        role: row.role as Role,
        canViewFinance: row.canViewFinance,
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      };
    } catch {
      return null;
    }
  }
  return repo.findAccount(e) ?? null;
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
function applyAccountToToken(token: JWT, account: UserAccount | null): void {
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
        // TODO: rate-limit login chống brute-force - dùng src/lib/rate-limit.ts.
        const email = (credentials?.email ?? '').toLowerCase().trim();
        const password = credentials?.password ?? '';
        if (!email || !password) return null;
        const account = await findAccount(email);
        if (!account || !account.isActive || !account.passwordHash) return null;
        if (!verifyPassword(password, account.passwordHash)) return null;
        // TODO: thiếu flow "quên mật khẩu" self-service - admin mất pass = chết cứng. Blocker pre-prod.
        await touchLastLogin(email);
        return { id: email, email, name: account.name };
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
        // chưa bị khoá (lockedAt thật sẽ nối vào ở Task 6, sau khi có cột DB - Task 5).
        const found = email ? await findAccount(email) : null;
        const decision = googleAccessDecision(
          profile as GoogleProfileLite,
          found ? { isActive: found.isActive, lockedAt: null } : null,
        );
        if (decision !== 'allow') {
          // L8 (bao-mat.md) - ghi lại lần bị từ chối kèm lý do, để admin thấy được ai đã thử vào
          // bằng Google không hợp lệ. KHÔNG ghi token/link nào (decision chỉ là 1 trong 5 giá trị cố định).
          // R7 (bao-mat.md vòng 2) - nhánh `unverified` nghĩa là Google CHƯA xác minh email, nên
          // toàn bộ `profile`/`user` (kể cả `name`) là dữ liệu KHÔNG đáng tin (ai đó có thể tự khai
          // tên bất kỳ); dùng tên CỐ ĐỊNH thay vì `user.name` để admin không hiểu nhầm là tên thật.
          // R7 (chưa làm, để Task 5-6) - báo cáo bảo mật đề nghị giới hạn tần suất ghi
          // `login_google_denied`; callback này KHÔNG có `AuthStore`/bảng đếm nào để tiêm vào (khác
          // `checkCredentials`), và không được đụng `schema.prisma` ở vòng sửa này - Task 5 thêm
          // `ThrottleKind` riêng `'google_denied'` (không dùng chung `login_fail_unknown_email` - kind
          // đó đếm theo email cho nhánh CREDENTIALS sai/email lạ, còn đây là log Google bị từ chối,
          // 2 việc khác nhau dù cùng khoá theo email), Task 6 bước 6.3 gọi
          // `reserveThrottle('google_denied', email, ...)` trước khi ghi log, thay vì tự chế 1 bộ đếm
          // trong tiến trình (không sống sót qua restart, không đúng với nhiều instance).
          const who = decision === 'unverified' ? { name: '(email chua xac minh)', email } : { name: user.name ?? email, email };
          try {
            await logActivity(who, 'login_google_denied', decision);
          } catch {
            /* ignore */
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
    async jwt({ token, user }) {
      if (user?.email) {
        // K14 (đóng L-11): 1 lần đọc tài khoản (findAccount), quyền dựng thẳng từ đó - không gọi
        // resolveAccess() thêm lần nữa (trước đây đọc DB 2 lần: findAccount() ở authorize/signIn
        // rồi resolveAccess() ở đây).
        const account = await findAccount(user.email);
        applyAccountToToken(token, account);
        if (account) token.name = account.name || token.name;
        return token;
      }
      // T-5: token đã có (không phải lần đăng nhập) - đọc lại quyền định kỳ mỗi
      // ACCESS_RECHECK_INTERVAL_MS thay vì chỉ tin token cũ tới khi hết hạn (8h).
      const email = token.email;
      if (typeof email === 'string' && email) {
        const last = typeof token.accessCheckedAt === 'number' ? token.accessCheckedAt : 0;
        if (Date.now() - last > ACCESS_RECHECK_INTERVAL_MS) {
          const account = await findAccount(email);
          applyAccountToToken(token, account);
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
