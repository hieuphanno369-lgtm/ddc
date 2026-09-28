/**
 * P3E (D1) - callback next-auth thật cho đăng nhập Google + kiểm lại quyền qua jwt, dùng chung
 * mock @/server/db với auth-access-recheck.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock, authThrottleCountMock, authThrottleCreateMock, executeRawMock, resetThrottleRows } = vi.hoisted(() => {
  // Dem so dong da "ghi" that su (khong dung static mock) de mo phong dung `reserveThrottle` khi
  // goi lien tiep - can cho test R7 phan 3 (het cho o lan thu 6).
  let rows = 0;
  const authThrottleCountMock = vi.fn(async () => rows);
  const authThrottleCreateMock = vi.fn(async () => {
    rows += 1;
    return { id: rows };
  });
  return {
    findUniqueMock: vi.fn(),
    authThrottleCountMock,
    authThrottleCreateMock,
    executeRawMock: vi.fn(async () => 1),
    resetThrottleRows: () => {
      rows = 0;
    },
  };
});
vi.mock('@/server/db', () => ({
  prisma: {
    userRole: { findUnique: findUniqueMock },
    authThrottle: { count: authThrottleCountMock, create: authThrottleCreateMock },
    $executeRaw: executeRawMock,
    // Task 6 (R7 phần 3, G4) - `signIn` Google gọi `reserveThrottle('google_denied', ...)` trước khi
    // ghi log; cần mock `$transaction` để không ném lỗi (mock đơn giản, KHÔNG kiểm advisory lock ở
    // đây - phần đó đã có `prisma-repo-auth-real-db.test.ts` chạy trên Postgres thật).
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ authThrottle: { count: authThrottleCountMock, create: authThrottleCreateMock }, $executeRaw: executeRawMock })),
  },
}));
vi.mock('@/lib/activity');

import { authOptions, ACCESS_RECHECK_INTERVAL_MS } from './auth';
import { logActivity } from '@/lib/activity';

const signIn = authOptions.callbacks!.signIn!;
const jwt = authOptions.callbacks!.jwt!;

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  email: 'a@daidung.com.vn',
  name: 'A',
  passwordHash: '',
  role: 'viewer',
  canViewFinance: false,
  isActive: true,
  createdAt: new Date(),
  lastLoginAt: null,
  ...over,
});

beforeEach(() => {
  findUniqueMock.mockReset();
  authThrottleCountMock.mockClear();
  authThrottleCreateMock.mockClear();
  resetThrottleRows();
  vi.mocked(logActivity).mockClear();
  vi.stubEnv('DATABASE_URL', 'postgres://x');
});
afterEach(() => vi.unstubAllEnvs());

describe('authOptions.callbacks.signIn - Google', () => {
  const googleParams = (email: string, emailVerified = true) => ({
    user: { email, name: 'A' },
    account: { provider: 'google' },
    profile: { email, email_verified: emailVerified },
  });

  it('email co trong danh sach + verified -> true', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn' }));
    expect(await signIn(googleParams('a@daidung.com.vn') as never)).toBe(true);
  });

  it('email la (khong co trong DB) -> false', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await signIn(googleParams('la@daidung.com.vn') as never)).toBe(false);
  });

  it('email_verified: false -> false', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn' }));
    expect(await signIn(googleParams('a@daidung.com.vn', false) as never)).toBe(false);
  });

  it('tai khoan tat (isActive=false) -> false', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn', isActive: false }));
    expect(await signIn(googleParams('a@daidung.com.vn') as never)).toBe(false);
  });

  it('gmail ca nhan co trong danh sach -> true, ke ca dat ALLOWED_EMAIL_DOMAINS (bien khong con duoc doc)', async () => {
    vi.stubEnv('ALLOWED_EMAIL_DOMAINS', 'daidung.com.vn');
    findUniqueMock.mockResolvedValue(row({ email: 'ca-nhan@gmail.com' }));
    expect(await signIn(googleParams('ca-nhan@gmail.com') as never)).toBe(true);
  });

  it('Task 6 - tai khoan dang bi khoa (lockedAt that tu DB) -> false', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn', lockedAt: new Date('2026-09-28T00:00:00.000Z') }));
    expect(await signIn(googleParams('a@daidung.com.vn') as never)).toBe(false);
  });

  it('Task 6 - dang nhap Google thanh cong KHONG doi failedLoginCount (khong goi userRole.update)', async () => {
    // Mock `prisma.userRole` CHI co `findUnique` (khong co `update`) - neu callback signIn lo goi
    // `userRole.update` (tang/reset bo dem sai) se nem loi "is not a function" ngay, khien test do.
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn' }));
    const result = await signIn(googleParams('a@daidung.com.vn') as never);
    expect(result).toBe(true);
    expect(findUniqueMock).toHaveBeenCalled();
  });
});

/** L8 (bao-mat.md) - moi lan Google bi tu choi phai ghi lai kem ly do (decision), khong ghi token. */
describe('authOptions.callbacks.signIn - Google, L8 ghi nhat ky khi bi tu choi', () => {
  const googleParams = (email: string, emailVerified = true) => ({
    user: { email, name: 'A' },
    account: { provider: 'google' },
    profile: { email, email_verified: emailVerified },
  });

  it('email chua xac minh -> ghi login_google_denied voi detail unverified', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn' }));
    await signIn(googleParams('a@daidung.com.vn', false) as never);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@daidung.com.vn' }),
      'login_google_denied',
      'unverified',
    );
  });

  it('R7 (vong sua bao mat 2): email chua xac minh -> name GHI CO DINH, KHONG dung ten tuy y tu profile (chua xac minh nen khong dang tin)', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn' }));
    const params = googleParams('a@daidung.com.vn', false);
    (params.user as { name: string }).name = 'Ten Tuy Y Ke Tan Cong Khai';
    await signIn(params as never);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@daidung.com.vn', name: expect.not.stringContaining('Ten Tuy Y') }),
      'login_google_denied',
      'unverified',
    );
  });

  it('R7: not_found (email da xac minh that boi Google) van dung ten that tu profile', async () => {
    findUniqueMock.mockResolvedValue(null);
    const params = googleParams('la@daidung.com.vn');
    (params.user as { name: string }).name = 'Ten That Tu Google';
    await signIn(params as never);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'la@daidung.com.vn', name: 'Ten That Tu Google' }),
      'login_google_denied',
      'not_found',
    );
  });

  it('email khong co trong danh sach -> detail not_found', async () => {
    findUniqueMock.mockResolvedValue(null);
    await signIn(googleParams('la@daidung.com.vn') as never);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'la@daidung.com.vn' }),
      'login_google_denied',
      'not_found',
    );
  });

  it('tai khoan tat -> detail inactive', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn', isActive: false }));
    await signIn(googleParams('a@daidung.com.vn') as never);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@daidung.com.vn' }),
      'login_google_denied',
      'inactive',
    );
  });

  it('duoc chap nhan -> KHONG ghi login_google_denied', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn' }));
    await signIn(googleParams('a@daidung.com.vn') as never);
    expect(logActivity).not.toHaveBeenCalledWith(expect.anything(), 'login_google_denied', expect.anything());
  });

  it('khong ghi token/link nao trong log', async () => {
    findUniqueMock.mockResolvedValue(null);
    await signIn(googleParams('la@daidung.com.vn') as never);
    const calls = vi.mocked(logActivity).mock.calls;
    for (const call of calls) expect(JSON.stringify(call)).not.toMatch(/token|http/i);
  });

  it("R7 phan 3: 5 lan tu choi lien tiep cung email ghi du 5 dong login_google_denied, lan thu 6 tra false nhung KHONG goi logActivity them", async () => {
    findUniqueMock.mockResolvedValue(null); // not_found - luon bi tu choi
    for (let i = 0; i < 5; i++) {
      await signIn(googleParams('spam@daidung.com.vn') as never);
    }
    expect(vi.mocked(logActivity)).toHaveBeenCalledTimes(5);

    const result = await signIn(googleParams('spam@daidung.com.vn') as never);

    expect(result).toBe(false);
    expect(vi.mocked(logActivity)).toHaveBeenCalledTimes(5); // van 5, khong them dong thu 6
  });
});

describe('authOptions.callbacks.jwt - dang nhap qua user.email', () => {
  it('email khong co trong DB -> token.invalid = true (khong gan viewer)', async () => {
    findUniqueMock.mockResolvedValue(null);

    const token = await jwt({ token: {}, user: { email: 'khong-co@daidung.com.vn' } } as never);

    expect(token.invalid).toBe(true);
    expect(token.role).toBeUndefined();
  });

  it('doi vai tro trong DB roi goi jwt voi token cu qua 5 phut -> token.role moi', async () => {
    findUniqueMock.mockResolvedValue(row({ email: 'a@daidung.com.vn', role: 'admin' }));
    const staleToken = {
      email: 'a@daidung.com.vn',
      role: 'viewer',
      canViewFinance: false,
      accessCheckedAt: Date.now() - ACCESS_RECHECK_INTERVAL_MS - 1,
    };

    const token = await jwt({ token: staleToken } as never);

    expect(token.role).toBe('admin');
  });
});
