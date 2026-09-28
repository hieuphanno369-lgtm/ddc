/**
 * P3E (Task 5) - `prismaAuthStore` (mẫu `prisma-repo-notify.test.ts`/`prisma-repo-create-project-vong-sua-1-r2.test.ts`):
 * mock thẳng `@/server/db`, không đụng DB thật. Phần "test DB thật" (advisory lock, race) nằm ở
 * `prisma-repo-auth-real-db.test.ts` (chạy tay với `DATABASE_URL` trỏ `ddc_control_tower_c`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  userRoleFindUnique, userRoleUpdate, userRoleUpdateMany,
  passwordResetTokenDeleteMany, passwordResetTokenCreate, passwordResetTokenUpdateMany, passwordResetTokenFindUnique,
  authThrottleCreate, authThrottleCount, authThrottleDeleteMany,
  executeRaw, transaction,
} = vi.hoisted(() => {
  const userRoleFindUnique = vi.fn(async (): Promise<unknown> => null);
  const userRoleUpdate = vi.fn(async (_args: unknown): Promise<unknown> => ({}));
  const userRoleUpdateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 0 }));
  const passwordResetTokenDeleteMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 0 }));
  const passwordResetTokenCreate = vi.fn(async (): Promise<unknown> => ({}));
  const passwordResetTokenUpdateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 0 }));
  const passwordResetTokenFindUnique = vi.fn(async (): Promise<unknown> => null);
  const authThrottleCreate = vi.fn(async (args: { data: { id?: number } }) => ({ id: 1, ...args.data }));
  const authThrottleCount = vi.fn(async (): Promise<number> => 0);
  const authThrottleDeleteMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 0 }));
  const executeRaw = vi.fn(async () => 1);
  const calls: string[] = [];
  const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      userRole: { findUnique: userRoleFindUnique, update: userRoleUpdate, updateMany: userRoleUpdateMany },
      passwordResetToken: {
        deleteMany: passwordResetTokenDeleteMany,
        create: passwordResetTokenCreate,
        updateMany: passwordResetTokenUpdateMany,
        findUnique: passwordResetTokenFindUnique,
      },
      authThrottle: { create: authThrottleCreate, count: authThrottleCount, deleteMany: authThrottleDeleteMany },
      $executeRaw: executeRaw,
    }));
  void calls;
  return {
    userRoleFindUnique, userRoleUpdate, userRoleUpdateMany,
    passwordResetTokenDeleteMany, passwordResetTokenCreate, passwordResetTokenUpdateMany, passwordResetTokenFindUnique,
    authThrottleCreate, authThrottleCount, authThrottleDeleteMany,
    executeRaw, transaction,
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    userRole: { findUnique: userRoleFindUnique, update: userRoleUpdate, updateMany: userRoleUpdateMany },
    passwordResetToken: {
      deleteMany: passwordResetTokenDeleteMany,
      create: passwordResetTokenCreate,
      updateMany: passwordResetTokenUpdateMany,
      findUnique: passwordResetTokenFindUnique,
    },
    authThrottle: { create: authThrottleCreate, count: authThrottleCount, deleteMany: authThrottleDeleteMany },
    $executeRaw: executeRaw,
    $transaction: transaction,
  },
}));

import { prismaAuthStore } from './prisma-repo-auth';

beforeEach(() => {
  vi.clearAllMocks();
});

const NOW_ISO = '2026-09-28T00:00:00.000Z';

describe('getAccountState', () => {
  it('dung dung findUnique, khong co dong -> null', async () => {
    userRoleFindUnique.mockResolvedValueOnce(null);
    const r = await prismaAuthStore.getAccountState('a@daidung.com.vn');
    expect(r).toBeNull();
    expect(userRoleFindUnique).toHaveBeenCalledWith({ where: { email: 'a@daidung.com.vn' } });
  });

  it('truong moi thieu (DB cu) -> failedLoginCount 0, lockedAt/passwordChangedAt null', async () => {
    userRoleFindUnique.mockResolvedValueOnce({
      email: 'a@daidung.com.vn', name: 'A', passwordHash: 'h', role: 'viewer', canViewFinance: false,
      isActive: true, failedLoginCount: null, lockedAt: null, passwordChangedAt: null,
    });
    const r = await prismaAuthStore.getAccountState('a@daidung.com.vn');
    expect(r).toEqual({
      email: 'a@daidung.com.vn', name: 'A', passwordHash: 'h', role: 'viewer', canViewFinance: false,
      isActive: true, failedLoginCount: 0, lockedAt: null, passwordChangedAt: null,
    });
  });
});

describe('registerFailedLogin', () => {
  it('khong co tai khoan (P2025) -> null', async () => {
    userRoleUpdate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('khong co', { code: 'P2025', clientVersion: '6.19.3' }),
    );
    const r = await prismaAuthStore.registerFailedLogin('x@daidung.com.vn', 5, NOW_ISO);
    expect(r).toBeNull();
  });

  it('chua dat nguong -> khong goi updateMany khoa', async () => {
    userRoleUpdate.mockResolvedValueOnce({ failedLoginCount: 3 });
    const r = await prismaAuthStore.registerFailedLogin('a@daidung.com.vn', 5, NOW_ISO);
    expect(r).toEqual({ count: 3, locked: false, justLocked: false });
    expect(userRoleUpdate).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { failedLoginCount: { increment: 1 } },
    });
    expect(userRoleUpdateMany).not.toHaveBeenCalled();
  });

  it('dat nguong, thang cuoc (updateMany count=1) -> justLocked true', async () => {
    userRoleUpdate.mockResolvedValueOnce({ failedLoginCount: 5 });
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    const r = await prismaAuthStore.registerFailedLogin('a@daidung.com.vn', 5, NOW_ISO);
    expect(r).toEqual({ count: 5, locked: true, justLocked: true });
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn', lockedAt: null },
      data: { lockedAt: new Date(NOW_ISO) },
    });
  });

  it('dat nguong nhung da bi khoa boi request khac (updateMany count=0) -> justLocked false, van locked true', async () => {
    userRoleUpdate.mockResolvedValueOnce({ failedLoginCount: 7 });
    userRoleUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await prismaAuthStore.registerFailedLogin('a@daidung.com.vn', 5, NOW_ISO);
    expect(r).toEqual({ count: 7, locked: true, justLocked: false });
  });
});

describe('resetFailedLogin (L3 - nguyen tu)', () => {
  it('dat ve 0 thanh cong -> true, dieu kien where co lockedAt: null', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    const r = await prismaAuthStore.resetFailedLogin('a@daidung.com.vn');
    expect(r).toBe(true);
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn', lockedAt: null },
      data: { failedLoginCount: 0 },
    });
  });

  it('da bi khoa boi request khac (count 0) -> false', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await prismaAuthStore.resetFailedLogin('a@daidung.com.vn')).toBe(false);
  });
});

describe('unlockAccount', () => {
  it('co dong -> true, xoa het khoa + bo dem', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    expect(await prismaAuthStore.unlockAccount('a@daidung.com.vn')).toBe(true);
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { failedLoginCount: 0, lockedAt: null },
    });
  });

  it('khong co tai khoan -> false', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await prismaAuthStore.unlockAccount('x@daidung.com.vn')).toBe(false);
  });
});

describe('setPassword', () => {
  it('bumpChangedAt true -> data co passwordChangedAt', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    const r = await prismaAuthStore.setPassword('a@daidung.com.vn', 'hash-moi', true, NOW_ISO);
    expect(r).toBe(true);
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { passwordHash: 'hash-moi', passwordChangedAt: new Date(NOW_ISO) },
    });
  });

  it('bumpChangedAt false -> data khong co passwordChangedAt', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    await prismaAuthStore.setPassword('a@daidung.com.vn', 'hash-moi', false, NOW_ISO);
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { passwordHash: 'hash-moi' },
    });
  });

  it('S-2 (bao-mat.md vong 4) - du bumpChangedAt true hay false, LUON huy (usedAt=now) token dat lai con han cua email do', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    await prismaAuthStore.setPassword('a@daidung.com.vn', 'hash-moi', false, NOW_ISO);
    expect(passwordResetTokenUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn', usedAt: null },
      data: { usedAt: new Date(NOW_ISO) },
    });
  });
});

describe('setPasswordIfHash - R3-1 (bao-mat.md vong 3, Trung) compare-and-swap', () => {
  it('count 1 (oldHash con khop luc ghi) -> true, where loc email VA passwordHash = oldHash VA isActive/lockedAt (R4-4)', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    const r = await prismaAuthStore.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', NOW_ISO);
    expect(r).toBe(true);
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn', passwordHash: 'hash-cu', isActive: true, lockedAt: null },
      data: { passwordHash: 'hash-moi', passwordChangedAt: new Date(NOW_ISO) },
    });
  });

  it('count 0 (oldHash da bi ghi de xen giua) -> false, KHONG huy token dat lai', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await prismaAuthStore.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', NOW_ISO);
    expect(r).toBe(false);
    expect(passwordResetTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('count 1 -> CUNG huy (usedAt=now) token dat lai con han cua email do, giong setPassword', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    await prismaAuthStore.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', NOW_ISO);
    expect(passwordResetTokenUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn', usedAt: null },
      data: { usedAt: new Date(NOW_ISO) },
    });
  });
});

describe('revokeSessions - R4-1a (bao-mat.md vong 4, Trung, chot chu du an 2026-09-28)', () => {
  it('count > 0 -> true, chi bump passwordChangedAt, KHONG dung passwordHash', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 1 });
    const r = await prismaAuthStore.revokeSessions('a@daidung.com.vn', NOW_ISO);
    expect(r).toBe(true);
    expect(userRoleUpdateMany).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { passwordChangedAt: new Date(NOW_ISO) },
    });
  });

  it('count 0 (khong co tai khoan) -> false', async () => {
    userRoleUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await prismaAuthStore.revokeSessions('x@daidung.com.vn', NOW_ISO)).toBe(false);
  });
});

describe('recordThrottle / countThrottle', () => {
  it('recordThrottle goi create dung kind/key/createdAt', async () => {
    await prismaAuthStore.recordThrottle('login_fail_unknown_email', 'x@daidung.com.vn', NOW_ISO);
    expect(authThrottleCreate).toHaveBeenCalledWith({
      data: { kind: 'login_fail_unknown_email', key: 'x@daidung.com.vn', createdAt: new Date(NOW_ISO) },
    });
  });

  it('countThrottle dung dieu kien createdAt >= sinceIso (gte)', async () => {
    authThrottleCount.mockResolvedValueOnce(3);
    const r = await prismaAuthStore.countThrottle('login_fail_ip', '1.2.3.4', NOW_ISO);
    expect(r).toBe(3);
    expect(authThrottleCount).toHaveBeenCalledWith({
      where: { kind: 'login_fail_ip', key: '1.2.3.4', createdAt: { gte: new Date(NOW_ISO) } },
    });
  });
});

describe('reserveThrottle / releaseThrottle', () => {
  it('con cho -> khoa advisory roi dem roi tao dong moi, tra id', async () => {
    authThrottleCount.mockResolvedValueOnce(2);
    authThrottleCreate.mockResolvedValueOnce({ id: 42 });
    const id = await prismaAuthStore.reserveThrottle('login_fail_ip', '1.2.3.4', NOW_ISO, '2026-09-27T23:45:00.000Z', 20);
    expect(id).toBe(42);
    expect(executeRaw).toHaveBeenCalled();
    expect(authThrottleCount).toHaveBeenCalledWith({
      where: { kind: 'login_fail_ip', key: '1.2.3.4', createdAt: { gte: new Date('2026-09-27T23:45:00.000Z') } },
    });
    expect(authThrottleCreate).toHaveBeenCalledWith({
      data: { kind: 'login_fail_ip', key: '1.2.3.4', createdAt: new Date(NOW_ISO) },
    });
  });

  it('het cho (count >= limit) -> null, khong tao dong moi', async () => {
    authThrottleCount.mockResolvedValueOnce(20);
    const id = await prismaAuthStore.reserveThrottle('login_fail_ip', '1.2.3.4', NOW_ISO, '2026-09-27T23:45:00.000Z', 20);
    expect(id).toBeNull();
    expect(authThrottleCreate).not.toHaveBeenCalled();
  });

  it('releaseThrottle xoa theo id (khoa chinh), KHONG loc theo kind/key/createdAt', async () => {
    await prismaAuthStore.releaseThrottle(42);
    expect(authThrottleDeleteMany).toHaveBeenCalledWith({ where: { id: 42 } });
  });
});

describe('replaceResetToken (K3)', () => {
  it('goi deleteMany({ where: { email } }) TRUOC create', async () => {
    const order: string[] = [];
    passwordResetTokenDeleteMany.mockImplementationOnce(async () => {
      order.push('delete');
      return { count: 1 };
    });
    passwordResetTokenCreate.mockImplementationOnce(async () => {
      order.push('create');
      return {};
    });
    await prismaAuthStore.replaceResetToken('a@daidung.com.vn', 'hash-token', '2026-09-28T00:30:00.000Z', '1.2.3.4');
    expect(order).toEqual(['delete', 'create']);
    expect(passwordResetTokenDeleteMany).toHaveBeenCalledWith({ where: { email: 'a@daidung.com.vn' } });
    expect(passwordResetTokenCreate).toHaveBeenCalledWith({
      data: {
        email: 'a@daidung.com.vn', tokenHash: 'hash-token',
        expiresAt: new Date('2026-09-28T00:30:00.000Z'), requestIp: '1.2.3.4',
      },
    });
  });
});

describe('peekResetToken (S12 - chi doc)', () => {
  it('loc dung usedAt: null, expiresAt: { gt }; tai khoan hop le -> true', async () => {
    passwordResetTokenFindUnique.mockResolvedValueOnce({
      tokenHash: 'h', email: 'a@daidung.com.vn', usedAt: null, expiresAt: new Date('2026-09-28T00:30:00.000Z'),
      user: { isActive: true, passwordHash: 'x' },
    });
    const r = await (prismaAuthStore.peekResetToken as (t: string, n: string) => Promise<boolean>)('h', NOW_ISO);
    expect(r).toBe(true);
  });

  it('tai khoan chi Google (passwordHash rong) -> false', async () => {
    passwordResetTokenFindUnique.mockResolvedValueOnce({
      tokenHash: 'h', email: 'a@daidung.com.vn', usedAt: null, expiresAt: new Date('2026-09-28T00:30:00.000Z'),
      user: { isActive: true, passwordHash: '' },
    });
    expect(await prismaAuthStore.peekResetToken('h', NOW_ISO)).toBe(false);
  });

  it('khong tim thay dong khop (het han/da dung/khong ton tai) -> false', async () => {
    passwordResetTokenFindUnique.mockResolvedValueOnce(null);
    expect(await prismaAuthStore.peekResetToken('h', NOW_ISO)).toBe(false);
  });
});

describe('consumeResetToken (K4, L5 - nguyen tu)', () => {
  it('updateMany token tra count: 0 -> { ok: false }, KHONG goi update mat khau', async () => {
    passwordResetTokenUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await prismaAuthStore.consumeResetToken('h', 'hash-moi', NOW_ISO);
    expect(r).toEqual({ ok: false });
    expect(userRoleUpdate).not.toHaveBeenCalled();
  });

  it('thanh cong, tai khoan chua khoa -> dat mat khau + bo dem ve 0', async () => {
    passwordResetTokenUpdateMany.mockResolvedValueOnce({ count: 1 });
    passwordResetTokenFindUnique.mockResolvedValueOnce({
      email: 'a@daidung.com.vn', user: { email: 'a@daidung.com.vn', name: 'A', lockedAt: null },
    });
    const r = await prismaAuthStore.consumeResetToken('h', 'hash-moi', NOW_ISO);
    expect(r).toEqual({ ok: true, email: 'a@daidung.com.vn', name: 'A', locked: false });
    expect(userRoleUpdate).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { passwordHash: 'hash-moi', passwordChangedAt: new Date(NOW_ISO), failedLoginCount: 0 },
    });
  });

  it('thanh cong, tai khoan dang khoa -> giu nguyen khoa + bo dem (khong reset)', async () => {
    passwordResetTokenUpdateMany.mockResolvedValueOnce({ count: 1 });
    passwordResetTokenFindUnique.mockResolvedValueOnce({
      email: 'a@daidung.com.vn', user: { email: 'a@daidung.com.vn', name: 'A', lockedAt: new Date('2026-09-27T00:00:00.000Z') },
    });
    const r = await prismaAuthStore.consumeResetToken('h', 'hash-moi', NOW_ISO);
    expect(r).toEqual({ ok: true, email: 'a@daidung.com.vn', name: 'A', locked: true });
    expect(userRoleUpdate).toHaveBeenCalledWith({
      where: { email: 'a@daidung.com.vn' },
      data: { passwordHash: 'hash-moi', passwordChangedAt: new Date(NOW_ISO) },
    });
  });

  it('L5 - dieu kien where cua updateMany kiem tai khoan qua quan he user (isActive/passwordHash)', async () => {
    passwordResetTokenUpdateMany.mockResolvedValueOnce({ count: 0 });
    await prismaAuthStore.consumeResetToken('h', 'hash-moi', NOW_ISO);
    expect(passwordResetTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: 'h', usedAt: null, expiresAt: { gt: new Date(NOW_ISO) },
        user: { isActive: true, passwordHash: { not: '' } },
      },
      data: { usedAt: new Date(NOW_ISO) },
    });
  });
});

describe('pruneAuthData (K19)', () => {
  it('xoa auth_throttle VA token cu hon beforeIso, bat ke da dung/con han', async () => {
    await prismaAuthStore.pruneAuthData('2026-09-27T00:00:00.000Z');
    expect(authThrottleDeleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-09-27T00:00:00.000Z') } } });
    expect(passwordResetTokenDeleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-09-27T00:00:00.000Z') } } });
  });
});
