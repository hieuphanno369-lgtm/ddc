/**
 * R3-2 (bao-mat.md vòng 3, Trung, chủ dự án chốt 2026-09-28) - `invalidateCurrentSessionCookie` đá
 * ngay phiên hiện tại (đặt `token.invalid = true` trong chính cookie của request đang chạy) khi
 * `changePasswordAction` vừa khoá tài khoản do đoán sai mật khẩu hiện tại đủ 5 lần - khác khoá do
 * đăng nhập sai (Q1 = phương án a, không cắt phiên đang mở), ở đây kẻ đoán mật khẩu ĐANG GIỮ chính
 * phiên đó nên không thể chỉ chặn đăng nhập mới. Mẫu `auth-reissue-session-cookie.test.ts` (giải mã
 * lại cookie mới để xác nhận nội dung thật, không chỉ spy lời gọi).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode as decodeSessionToken, encode as encodeSessionToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';

const { cookieJar } = vi.hoisted(() => ({
  cookieJar: {
    store: new Map<string, string>(),
    setCalls: [] as { name: string; value: string; options: unknown }[],
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({
    get: (name: string) => (cookieJar.store.has(name) ? { name, value: cookieJar.store.get(name) as string } : undefined),
    set: (name: string, value: string, options: unknown) => {
      cookieJar.setCalls.push({ name, value, options });
      cookieJar.store.set(name, value);
    },
  }),
}));
vi.mock('@/server/db', () => ({ prisma: { userRole: { findUnique: vi.fn() } } }));
vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

const { getAccountStateMock } = vi.hoisted(() => ({ getAccountStateMock: vi.fn() }));
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => ({ getAccountState: getAccountStateMock }) }));

import { invalidateCurrentSessionCookie } from './auth';

const SECRET = 'test-secret-0123456789abcdef0123456789';
const EMAIL = 'bod@daidung.com.vn';
const COOKIE_NAME = 'next-auth.session-token';

beforeEach(() => {
  cookieJar.store.clear();
  cookieJar.setCalls.length = 0;
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_SECRET', SECRET);
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  vi.stubEnv('VERCEL', '');
});
afterEach(() => vi.unstubAllEnvs());

async function seedCookie(token: Partial<JWT>) {
  const raw = await encodeSessionToken({ token: token as JWT, secret: SECRET, maxAge: 8 * 60 * 60 });
  cookieJar.store.set(COOKIE_NAME, raw);
}

describe('invalidateCurrentSessionCookie', () => {
  it('khong co cookie phien nao dang mo -> khong lam gi, khong nem loi', async () => {
    await expect(invalidateCurrentSessionCookie(EMAIL)).resolves.toBeUndefined();
    expect(cookieJar.setCalls).toHaveLength(0);
  });

  it('cookie hien tai thuoc EMAIL KHAC -> khong dung (khong vo hieu nham phien nguoi khac)', async () => {
    await seedCookie({ email: 'khac@daidung.com.vn', role: 'viewer', pwdAt: 0, invalid: false });

    await invalidateCurrentSessionCookie(EMAIL);

    expect(cookieJar.setCalls).toHaveLength(0);
  });

  it('dung email -> cap cookie MOI voi invalid = true, KHONG doi role/pwdAt', async () => {
    await seedCookie({ email: EMAIL, role: 'bod', canViewFinance: true, pwdAt: 12345, invalid: false });

    await invalidateCurrentSessionCookie(EMAIL);

    expect(cookieJar.setCalls).toHaveLength(1);
    const call = cookieJar.setCalls[0];
    expect(call.name).toBe(COOKIE_NAME);
    expect((call.options as { httpOnly?: boolean }).httpOnly).toBe(true);

    const decoded = await decodeSessionToken({ token: call.value, secret: SECRET });
    expect(decoded?.invalid).toBe(true);
    // Khong dung DB, khong doi bat ky truong nao khac - chi sua invalid.
    expect(decoded?.role).toBe('bod');
    expect(decoded?.pwdAt).toBe(12345);
    expect(getAccountStateMock).not.toHaveBeenCalled();
  });
});
