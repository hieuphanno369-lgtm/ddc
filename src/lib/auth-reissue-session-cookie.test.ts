/**
 * R2-1 (bao-mat.md vòng 2, CAO) - `reissueSessionCookie` cấp lại cookie phiên MỚI cho CHÍNH người
 * vừa tự đổi mật khẩu, đọc token từ cookie HIỆN TẠI của request (không tin dữ liệu client gửi lên),
 * làm mới `pwdAt` theo mốc `passwordChangedAt` mới nhất trong DB, mã hoá bằng đúng secret/maxAge của
 * `authOptions`. Test giải mã lại cookie mới để xác nhận nội dung thật, không chỉ spy lời gọi.
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

import { reissueSessionCookie } from './auth';

const SECRET = 'test-secret-0123456789abcdef0123456789';
const EMAIL = 'bod@daidung.com.vn';
const COOKIE_NAME = 'next-auth.session-token';

beforeEach(() => {
  cookieJar.store.clear();
  cookieJar.setCalls.length = 0;
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_SECRET', SECRET);
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000'); // http -> khong tien to __Secure-
  vi.stubEnv('VERCEL', '');
});
afterEach(() => vi.unstubAllEnvs());

async function seedCookie(token: Partial<JWT>) {
  const raw = await encodeSessionToken({ token: token as JWT, secret: SECRET, maxAge: 8 * 60 * 60 });
  cookieJar.store.set(COOKIE_NAME, raw);
}

const CHANGED_AT_ISO = '2026-09-28T00:10:00.000Z';

describe('reissueSessionCookie', () => {
  it('khong co cookie phien nao dang mo -> khong lam gi, khong nem loi', async () => {
    await expect(reissueSessionCookie(EMAIL, CHANGED_AT_ISO)).resolves.toBeUndefined();
    expect(cookieJar.setCalls).toHaveLength(0);
  });

  it('cookie hien tai thuoc EMAIL KHAC -> khong cap lai (khong lam moi nham phien cua nguoi khac)', async () => {
    await seedCookie({ email: 'khac@daidung.com.vn', role: 'viewer', pwdAt: 0 });

    await reissueSessionCookie(EMAIL, CHANGED_AT_ISO);

    expect(cookieJar.setCalls).toHaveLength(0);
  });

  it('dung email vua doi mat khau, DB khop changedAtIso truyen vao -> cap cookie MOI, pwdAt = passwordChangedAt tu DB, invalid = false', async () => {
    await seedCookie({ email: EMAIL, role: 'viewer', canViewFinance: false, pwdAt: 0, invalid: true });
    getAccountStateMock.mockResolvedValue({
      email: EMAIL,
      name: 'BOD',
      passwordHash: 'x',
      role: 'bod',
      canViewFinance: true,
      isActive: true,
      failedLoginCount: 0,
      lockedAt: null,
      passwordChangedAt: CHANGED_AT_ISO,
    });

    await reissueSessionCookie(EMAIL, CHANGED_AT_ISO);

    expect(cookieJar.setCalls).toHaveLength(1);
    const call = cookieJar.setCalls[0];
    expect(call.name).toBe(COOKIE_NAME);
    expect((call.options as { httpOnly?: boolean }).httpOnly).toBe(true);
    expect((call.options as { secure?: boolean }).secure).toBe(false); // NEXTAUTH_URL http trong test

    const decoded = await decodeSessionToken({ token: call.value, secret: SECRET });
    expect(decoded?.pwdAt).toBe(Date.parse(CHANGED_AT_ISO));
    expect(decoded?.invalid).toBe(false);
    expect(decoded?.role).toBe('bod');
    expect(decoded?.canViewFinance).toBe(true);
  });

  it('getAccountState tra ve null (tai khoan bi xoa giua chung) -> cookie moi co invalid = true', async () => {
    await seedCookie({ email: EMAIL, role: 'viewer', pwdAt: 0 });
    getAccountStateMock.mockResolvedValue(null);

    await reissueSessionCookie(EMAIL, CHANGED_AT_ISO);

    const call = cookieJar.setCalls[0];
    const decoded = await decodeSessionToken({ token: call.value, secret: SECRET });
    expect(decoded?.invalid).toBe(true);
  });

  it('R3-1 (bao-mat.md vong 3, Trung) - DB co passwordChangedAt MOI HON changedAtIso truyen vao (bi 1 request KHAC ghi de xen giua T2 va T3) -> invalid = true, KHONG hoi sinh nham bang moc cu', async () => {
    await seedCookie({ email: EMAIL, role: 'viewer', pwdAt: 0 });
    getAccountStateMock.mockResolvedValue({
      email: EMAIL,
      name: 'BOD',
      passwordHash: 'x',
      role: 'bod',
      canViewFinance: true,
      isActive: true,
      failedLoginCount: 0,
      lockedAt: null,
      passwordChangedAt: '2026-09-28T00:20:00.000Z', // MOI HON changedAtIso ma request nay vua ghi
    });

    await reissueSessionCookie(EMAIL, CHANGED_AT_ISO);

    const call = cookieJar.setCalls[0];
    const decoded = await decodeSessionToken({ token: call.value, secret: SECRET });
    expect(decoded?.invalid).toBe(true);
    expect(decoded?.pwdAt).toBe(Date.parse('2026-09-28T00:20:00.000Z')); // van doc moc THAT tu DB
  });

  it('DB co passwordChangedAt bang dung changedAtIso truyen vao (khong co race) -> khong tu dat invalid', async () => {
    await seedCookie({ email: EMAIL, role: 'viewer', pwdAt: 0 });
    getAccountStateMock.mockResolvedValue({
      email: EMAIL,
      name: 'BOD',
      passwordHash: 'x',
      role: 'bod',
      canViewFinance: true,
      isActive: true,
      failedLoginCount: 0,
      lockedAt: null,
      passwordChangedAt: CHANGED_AT_ISO,
    });

    await reissueSessionCookie(EMAIL, CHANGED_AT_ISO);

    const call = cookieJar.setCalls[0];
    const decoded = await decodeSessionToken({ token: call.value, secret: SECRET });
    expect(decoded?.invalid).toBe(false);
  });
});
