/**
 * P3F (tester) - tai khoan dang ky dang cho admin bat (khong co dong user_roles) dang nhap bang Google: bi tu choi nhu
 * email la, khong tu tao tai khoan, khong ghi nhan la da dang nhap. Kiem hanh vi that cua callback signIn.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock, createMock, upsertMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn(), createMock: vi.fn(), upsertMock: vi.fn() }));
vi.mock('@/server/db', () => ({
  prisma: {
    userRole: { findUnique: findUniqueMock, create: createMock, upsert: upsertMock },
    authThrottle: { count: vi.fn(async () => 0), create: vi.fn(async () => ({ id: 1 })) },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ authThrottle: { count: vi.fn(async () => 0), create: vi.fn(async () => ({ id: 1 })) }, $executeRaw: vi.fn(async () => 1) })),
  },
}));
vi.mock('@/lib/activity');

import { authOptions } from './auth';

const signIn = authOptions.callbacks!.signIn!;

beforeEach(() => {
  findUniqueMock.mockReset();
  createMock.mockClear();
  upsertMock.mockClear();
  vi.stubEnv('DATABASE_URL', 'postgres://x');
});

describe('Google + dang ky dang cho bat', () => {
  const params = (email: string) => ({ user: { email, name: 'Cho' }, account: { provider: 'google' }, profile: { email, email_verified: true } });

  it('email da dang ky nhung chua duoc bat (khong co user_roles) -> false, khong tu tao tai khoan', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await signIn(params('cho@daidung.vn') as never)).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('doi chung: cung email nhung da co tai khoan dang hoat dong -> true', async () => {
    findUniqueMock.mockResolvedValue({
      email: 'cho@daidung.vn', name: 'Cho', passwordHash: '', role: 'viewer', canViewFinance: false, isActive: true, createdAt: new Date(), lastLoginAt: null,
    });
    expect(await signIn(params('cho@daidung.vn') as never)).toBe(true);
  });
});
