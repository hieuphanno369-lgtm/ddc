import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { Role, UserAccount } from '@/server/repo/types';
import { prisma } from '@/server/db';
import { repo } from '@/server/repo/mock-repo';
import { logActivity } from '@/lib/activity';
import { verifyPassword } from '@/lib/password';
import { requireAuthSecret } from '@/lib/env';

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Seed role mapping (mock) - email:role, phân tách bằng dấu phẩy. */
const roleSeed: Record<string, Role> = (process.env.ROLE_SEED ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .reduce<Record<string, Role>>((acc, pair) => {
    const [email, role] = pair.split(':').map((x) => x.trim());
    if (email && (role === 'admin' || role === 'bod' || role === 'data-entry' || role === 'viewer')) {
      acc[email.toLowerCase()] = role;
    }
    return acc;
  }, {});

/**
 * Quyền: đọc từ user_roles (DB) hoặc mock store, fallback ROLE_SEED env.
 * Q6 (2026-09-25, chủ dự án chốt): canViewFinance đọc theo TỪNG người từ cột DB `user_roles.canViewFinance`
 * (Quản trị bật/tắt được - xem `setUserCanViewFinanceAction`), KHÔNG còn suy từ role. Admin luôn xem được
 * bất kể cột DB. Có hiệu lực ngay lúc đăng nhập, và trong vòng `ACCESS_RECHECK_INTERVAL_MS` cho session
 * đang mở (T-5, danh-gia-bao-mat.md - callback `jwt` đọc lại định kỳ, không chỉ lúc đăng nhập).
 */
export async function resolveAccess(email: string): Promise<{ role: Role; canViewFinance: boolean }> {
  const seedRole = roleSeed[email.toLowerCase()] ?? 'viewer';
  // T-1 (danh-gia-bao-mat.md, phương án b tạm thời tới khi P3A gate form nhập liệu): data-entry
  // luôn canViewFinance=true, giống admin - tránh "cảm giác an toàn giả" khi Quản trị tắt được nút
  // nhưng /nhap-lieu vẫn lộ số tiền cho role này.
  const alwaysOn = (r: Role) => r === 'admin' || r === 'data-entry';
  const fallback: { role: Role; canViewFinance: boolean } = { role: seedRole, canViewFinance: alwaysOn(seedRole) };
  if (process.env.DATABASE_URL) {
    try {
      const row = await prisma.userRole.findUnique({ where: { email: email.toLowerCase() } });
      if (row) return { role: row.role as Role, canViewFinance: alwaysOn(row.role as Role) ? true : row.canViewFinance };
    } catch {
      /* ignore */
    }
    return fallback;
  }
  const u = repo.getUserRoles().find((x) => x.email === email.toLowerCase());
  if (!u) return fallback;
  return { role: u.role, canViewFinance: alwaysOn(u.role) ? true : u.canViewFinance };
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

export function isAllowedDomain(email: string): boolean {
  if (!allowedDomains.length) return true; // chưa cấu hình → cho phép (dev)
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return allowedDomains.includes(domain);
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
      // TODO: bật Google OAuth - set GOOGLE_CLIENT_ID/SECRET thật (đang rỗng = provider không dùng được).
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // session tối đa 8 giờ
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? '';
      const allowed = isAllowedDomain(email);
      if (allowed) {
        try {
          await logActivity({ name: user.name ?? email, email }, 'login');
        } catch {
          /* ignore */
        }
      }
      return allowed;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const access = await resolveAccess(user.email);
        token.role = access.role;
        token.canViewFinance = access.canViewFinance;
        token.accessCheckedAt = Date.now();
        return token;
      }
      // T-5: token đã có (không phải lần đăng nhập) - đọc lại quyền định kỳ mỗi
      // ACCESS_RECHECK_INTERVAL_MS thay vì chỉ tin token cũ tới khi hết hạn (8h).
      const email = token.email;
      if (typeof email === 'string' && email) {
        const last = typeof token.accessCheckedAt === 'number' ? token.accessCheckedAt : 0;
        if (Date.now() - last > ACCESS_RECHECK_INTERVAL_MS) {
          const account = await findAccount(email);
          if (!account || !account.isActive) {
            // Tài khoản bị khoá hoặc đã bị xoá khỏi DB - vô hiệu session ở callback session().
            token.invalid = true;
          } else {
            const access = await resolveAccess(email);
            token.role = access.role;
            token.canViewFinance = access.canViewFinance;
            token.invalid = false;
          }
          token.accessCheckedAt = Date.now();
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
