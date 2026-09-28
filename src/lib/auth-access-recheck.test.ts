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
});
afterEach(() => vi.unstubAllEnvs());

describe('authOptions.callbacks.jwt - T-5 doc lai quyen dinh ky', () => {
  it('dang nhap (co user) -> doc tai khoan 1 lan (findAccount) + ghi accessCheckedAt = now', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true,
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
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

  it("Q1 (chu du an chot phuong an a) - token da cu, tai khoan dang bi KHOA (lockedAt khac null) nhung isActive VAN true -> KHONG vo hieu (chi chan dang nhap MOI, khong cat phien dang mo)", async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, lockedAt: new Date('2026-09-28T00:00:00.000Z'),
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    const staleToken = {
      email: 'bod@daidung.com.vn',
      role: 'bod',
      canViewFinance: true,
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.invalid).toBe(false);
    expect(token.role).toBe('bod');
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

/**
 * P3E (Task 7, S8) - `token.pwdAt` (Date.parse(passwordChangedAt) lúc đăng nhập) dùng để vô hiệu
 * phiên cũ khi mật khẩu bị đổi (đặt lại qua email/admin) SAU khi phiên đó đã đăng nhập - trễ tối
 * đa `ACCESS_RECHECK_INTERVAL_MS` (5 phút, đã có sẵn từ T-5).
 */
describe('authOptions.callbacks.jwt - S8 vo hieu phien cu sau doi mat khau (pwdAt)', () => {
  it('dang nhap -> token.pwdAt = Date.parse(passwordChangedAt)', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, passwordChangedAt: new Date('2026-09-01T00:00:00.000Z'),
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });

    const token = await jwt({ token: {}, user: { email: 'bod@daidung.com.vn' } } as never);

    expect(token.pwdAt).toBe(Date.parse('2026-09-01T00:00:00.000Z'));
  });

  it('dang nhap, chua tung doi mat khau (passwordChangedAt null) -> token.pwdAt = 0', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, passwordChangedAt: null,
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });

    const token = await jwt({ token: {}, user: { email: 'bod@daidung.com.vn' } } as never);

    expect(token.pwdAt).toBe(0);
  });

  it('token.pwdAt CU HON passwordChangedAt trong DB -> token.invalid = true (mat khau da bi doi sau khi phien nay dang nhap)', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, passwordChangedAt: new Date('2026-09-28T00:00:00.000Z'),
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    const staleToken = {
      email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true,
      pwdAt: Date.parse('2026-09-01T00:00:00.000Z'),
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.invalid).toBe(true);
  });

  it('token.pwdAt BANG passwordChangedAt trong DB -> van hop le', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, passwordChangedAt: new Date('2026-09-01T00:00:00.000Z'),
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    const staleToken = {
      email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true,
      pwdAt: Date.parse('2026-09-01T00:00:00.000Z'),
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.invalid).toBe(false);
  });

  it('token khong co pwdAt, passwordChangedAt null -> van hop le', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, passwordChangedAt: null,
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    const staleToken = {
      email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true,
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.invalid).toBe(false);
  });
});

/**
 * S-2 (bao-mat.md vòng 4, chủ dự án chốt 2026-09-28) - `trigger: 'update'`: `ChangePasswordModal`
 * gọi `update()` (next-auth) ngay sau khi tự đổi mật khẩu thành công, để CHÍNH phiên đó làm mới
 * `token.pwdAt` NGAY (không chờ `ACCESS_RECHECK_INTERVAL_MS`) - tránh bị nhánh kiểm lại định kỳ vô
 * hiệu nhầm chính phiên vừa tự đổi mật khẩu.
 */
describe("authOptions.callbacks.jwt - S-2 trigger 'update' lam moi token cua CHINH phien vua tu doi mat khau", () => {
  it("trigger update -> doc lai tai khoan NGAY du accessCheckedAt con moi (khong cho ACCESS_RECHECK_INTERVAL_MS), token.pwdAt = passwordChangedAt moi nhat", async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: true, passwordChangedAt: new Date('2026-09-28T00:10:00.000Z'),
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });
    // accessCheckedAt = Date.now() (vua kiem xong) - nhanh kiem lai dinh ky BINH THUONG se BO QUA
    // (chua qua ACCESS_RECHECK_INTERVAL_MS); trigger 'update' phai bo qua dieu kien nay.
    const freshToken = {
      email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true,
      pwdAt: 0, // gia tri CU truoc khi tu doi mat khau
      accessCheckedAt: Date.now(),
    };

    const token = await jwt({ token: freshToken, trigger: 'update' } as never);

    expect(findUniqueMock).toHaveBeenCalled();
    expect(token.pwdAt).toBe(Date.parse('2026-09-28T00:10:00.000Z'));
    expect(token.invalid).toBe(false);
  });

  it('trigger update nhung tai khoan da bi tat truoc khi kip lam moi -> token.invalid = true (khong am tham bo qua)', async () => {
    findUniqueMock.mockResolvedValue({
      role: 'bod', canViewFinance: true, isActive: false, passwordChangedAt: new Date('2026-09-28T00:10:00.000Z'),
      email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: 'x', createdAt: new Date(), lastLoginAt: null,
    });

    const token = await jwt({ token: { email: 'bod@daidung.com.vn', role: 'bod' }, trigger: 'update' } as never);

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
