/**
 * T-5 (danh-gia-bao-mat.md): callback jwt đọc lại quyền định kỳ (không chỉ lúc đăng nhập) - tắt
 * quyền/khoá tài khoản có hiệu lực trong vài phút thay vì phải chờ tới khi session hết hạn (8h).
 * Giả lập thời gian bằng cách truyền thẳng `token.accessCheckedAt` (mốc ms) thay vì fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));
vi.mock('@/server/db', () => ({ prisma: { userRole: { findUnique: findUniqueMock } } }));
vi.mock('@/lib/activity');

import { authOptions, ACCESS_RECHECK_INTERVAL_MS } from './auth';

const jwt = authOptions.callbacks!.jwt!;
const session = authOptions.callbacks!.session!;

beforeEach(() => {
  findUniqueMock.mockReset();
  vi.stubEnv('DATABASE_URL', 'postgres://x');
  vi.stubEnv('ROLE_SEED', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('authOptions.callbacks.jwt - T-5 doc lai quyen dinh ky', () => {
  it('dang nhap (co user) -> resolveAccess + ghi accessCheckedAt = now', async () => {
    findUniqueMock.mockResolvedValue({ role: 'bod', canViewFinance: true });
    const before = Date.now();

    const token = await jwt({ token: {}, user: { email: 'bod@daidung.com.vn' } } as never);

    expect(token.role).toBe('bod');
    expect(token.canViewFinance).toBe(true);
    expect(token.accessCheckedAt).toBeGreaterThanOrEqual(before);
  });

  it('token con moi (chua qua ACCESS_RECHECK_INTERVAL_MS) -> KHONG doc lai DB', async () => {
    const recentToken = { email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true, accessCheckedAt: Date.now() };

    const token = await jwt({ token: recentToken } as never);

    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(token).toEqual(recentToken);
  });

  it('token da cu (qua ACCESS_RECHECK_INTERVAL_MS), tai khoan van active -> doc lai role/canViewFinance', async () => {
    // findAccount() doc them createdAt/lastLoginAt (goi .toISOString()) - phai co du field nhu row Prisma that.
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: false, isActive: true,
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    const staleAt = Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1;
    const staleToken = { email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true, accessCheckedAt: staleAt };

    // jwt() mutate thang object token truyen vao (giong hanh vi that cua next-auth) - chup lai
    // nguong TRUOC khi goi, khong doc lai staleToken.accessCheckedAt sau do (da bi ghi de).
    const token = await jwt({ token: staleToken } as never);

    expect(token.canViewFinance).toBe(false);
    expect(token.invalid).toBe(false);
    expect(token.accessCheckedAt).toBeGreaterThanOrEqual(staleAt + ACCESS_RECHECK_INTERVAL_MS);
  });

  it('token da cu, tai khoan bi khoa (isActive=false) -> token.invalid = true', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: false,
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    const staleToken = {
      email: 'bod@daidung.com.vn',
      role: 'bod',
      canViewFinance: true,
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.invalid).toBe(true);
  });

  it('token da cu, tai khoan khong con trong DB -> token.invalid = true', async () => {
    findUniqueMock.mockResolvedValue(null);
    const staleToken = {
      email: 'xoa-roi@daidung.com.vn',
      role: 'bod',
      canViewFinance: true,
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.invalid).toBe(true);
  });
});

describe('authOptions.callbacks.session - T-5 vo hieu session khi token.invalid', () => {
  it('token.invalid = true -> session.user.email = null (getCurrentUser doc thanh chua dang nhap)', async () => {
    const result = await session({
      session: { user: { email: 'bod@daidung.com.vn' }, expires: '' },
      token: { invalid: true, role: 'bod', canViewFinance: true },
    } as never);

    expect(result.user?.email).toBeNull();
  });

  it('token.invalid = false -> session binh thuong, van gan role/canViewFinance', async () => {
    const result = await session({
      session: { user: { email: 'bod@daidung.com.vn' }, expires: '' },
      token: { invalid: false, role: 'bod', canViewFinance: true },
    } as never);

    expect(result.user?.email).toBe('bod@daidung.com.vn');
    expect((result.user as { role?: string }).role).toBe('bod');
    expect((result.user as { canViewFinance?: boolean }).canViewFinance).toBe(true);
  });
});
