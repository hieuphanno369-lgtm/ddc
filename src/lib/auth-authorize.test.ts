/**
 * P3E (Task 6, bước 6.1) - `authorize` (CredentialsProvider) nối vao `checkCredentials`/`AuthStore`
 * that (khong con doc thang `prisma.userRole` nhu truoc Task 6): mock `next/headers` (x-forwarded-for),
 * `@/server/auth-store` (kho bo nho), `@/lib/activity` (khong ghi that).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { hashPassword } from '@/lib/password';
import { createMemoryAuthStore, type MemoryAccountSource } from '@/server/repo/mock-repo-auth';
import type { UserAccount } from '@/server/repo/types';
import { logger } from '@/lib/logger';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

const REAL_PW = 'MatKhauThat1';
// S-1 - `hashPassword` gio bat dong bo; tinh 1 lan truoc moi test (beforeAll)
// thay vi goi truc tiep trong `account()` (ham nay van goi DONG BO tu nhieu noi).
let REAL_HASH = '';
let accounts: UserAccount[];
let store: ReturnType<typeof createMemoryAuthStore>;
let currentIp = '9.9.9.9';

beforeAll(async () => {
  REAL_HASH = await hashPassword(REAL_PW);
});

function account(over: Partial<UserAccount> = {}): UserAccount {
  return {
    email: 'a@daidung.com.vn', name: 'A', passwordHash: REAL_HASH, role: 'viewer',
    canViewFinance: false, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null,
    lockedAt: null,
    ...over,
  };
}

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', currentIp]]) as unknown as Headers,
}));

vi.mock('@/server/auth-store', () => ({ getAuthStore: () => store }));

vi.mock('@/server/db', () => ({ prisma: { userRole: { update: vi.fn(async () => ({})) } } }));

import { authOptions } from './auth';

type Authorize = (credentials: Record<string, string> | undefined) => Promise<unknown>;

function getAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials');
  if (!provider) throw new Error('khong tim thay CredentialsProvider');
  return (provider as unknown as { options: { authorize: Authorize } }).options.authorize;
}

beforeEach(() => {
  accounts = [account()];
  const source: MemoryAccountSource = {
    findAccount: (email) => accounts.find((a) => a.email === email.toLowerCase()),
    changePassword: (email, hash) => {
      const a = accounts.find((x) => x.email === email.toLowerCase());
      if (a) a.passwordHash = hash;
    },
  };
  store = createMemoryAuthStore(source);
  currentIp = `9.9.9.${Math.floor(Math.random() * 1000)}`;
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('authorize - noi vao checkCredentials (Task 6)', () => {
  it('4 lan sai -> null, lan 5 -> nem loi "locked"', async () => {
    const authorize = getAuthorize();
    for (let i = 0; i < 4; i++) {
      const r = await authorize({ email: 'a@daidung.com.vn', password: 'sai' });
      expect(r).toBeNull();
    }
    await expect(authorize({ email: 'a@daidung.com.vn', password: 'sai' })).rejects.toThrow('locked');
  });

  it('IP bi gioi han (da het 20 cho) -> nem "ip_limited" ngay ca voi mat khau dung', async () => {
    const now = new Date().toISOString();
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    for (let i = 0; i < 20; i++) {
      await store.reserveThrottle('login_fail_ip', currentIp, now, since, 20);
    }
    const authorize = getAuthorize();
    await expect(authorize({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrow('ip_limited');
  });

  it('email dai hon 254 ky tu -> null (khong cham store)', async () => {
    const authorize = getAuthorize();
    const longEmail = `${'a'.repeat(250)}@x.com`;
    const r = await authorize({ email: longEmail, password: 'bat-ky' });
    expect(r).toBeNull();
  });

  it('dung email/mat khau -> tra ve { id, email, name }', async () => {
    const authorize = getAuthorize();
    const r = await authorize({ email: 'a@daidung.com.vn', password: REAL_PW });
    expect(r).toEqual({ id: 'a@daidung.com.vn', email: 'a@daidung.com.vn', name: 'A' });
  });
});

describe('authorize - loi he thong (sua loi P2028)', () => {
  const p2028 = () =>
    new Prisma.PrismaClientKnownRequestError(
      'Transaction API error: Transaction already closed: postgresql://user:matkhau@db:5432/x',
      { code: 'P2028', clientVersion: '6.19.3' },
    );

  it('giu cho IP loi P2028 (dung mat khau) -> nem dung "system_busy", khong tra null', async () => {
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce(p2028());
    const authorize = getAuthorize();
    await expect(authorize({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrowError(/^system_busy$/);
  });

  it('nhanh tai khoan co that: reserveAccountGuess loi -> "system_busy"', async () => {
    vi.spyOn(store, 'reserveAccountGuess').mockRejectedValueOnce(p2028());
    await expect(getAuthorize()({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrowError(/^system_busy$/);
  });

  it('nhanh email la: recordThrottle loi -> CUNG "system_busy" (khong thanh oracle email nao co tai khoan)', async () => {
    vi.spyOn(store, 'recordThrottle').mockRejectedValueOnce(new Error('db down'));
    await expect(getAuthorize()({ email: 'khong-co@daidung.com.vn', password: 'bat-ky' })).rejects.toThrowError(/^system_busy$/);
  });

  it('log chi co ma loi, khong lo message (chuoi ket noi DB)', async () => {
    const spy = vi.spyOn(logger, 'error');
    vi.spyOn(store, 'getAccountState').mockRejectedValueOnce(p2028());
    await expect(getAuthorize()({ email: 'a@daidung.com.vn', password: REAL_PW })).rejects.toThrowError(/^system_busy$/);
    expect(spy).toHaveBeenCalledWith('auth.authorize_failed', expect.objectContaining({ errCode: 'P2028' }));
    expect(JSON.stringify(spy.mock.calls)).not.toContain('postgresql://');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('Transaction already closed');
  });

  it('sai mat khau van tra null (khong bi doi thanh system_busy)', async () => {
    expect(await getAuthorize()({ email: 'a@daidung.com.vn', password: 'sai' })).toBeNull();
  });
});

describe('authorize - loi he thong, bo sung cua Tester (sua loi P2028)', () => {
  const dbDown = () => new Error('connect ECONNREFUSED postgresql://user:matkhau@db:5432/x');

  /** Bat loi `authorize` ném ra để so từng thuộc tính (không chỉ message). */
  async function caught(email: string, password: string): Promise<Error> {
    try {
      await getAuthorize()({ email, password });
    } catch (e) {
      return e as Error;
    }
    throw new Error('authorize dang ra ket qua thay vi nem loi');
  }

  it('loi o buoc getAccountState (chay cho MOI email) -> email co that va email la ra Y HET nhau', async () => {
    vi.spyOn(store, 'getAccountState').mockRejectedValue(dbDown());
    const real = await caught('a@daidung.com.vn', REAL_PW);
    const unknown = await caught('khong-co@daidung.com.vn', REAL_PW);
    for (const err of [real, unknown]) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('system_busy');
      expect(err.name).toBe('Error');
      expect(Object.getOwnPropertyNames(err).sort()).toEqual(Object.getOwnPropertyNames(real).sort());
      expect((err as Error & { cause?: unknown }).cause).toBeUndefined();
      expect((err as Error & { code?: unknown }).code).toBeUndefined();
    }
    expect(JSON.stringify(real)).toBe(JSON.stringify(unknown));
  });

  it('loi o releaseThrottle trong finally (chỗ đoán tài khoản), dung mat khau -> system_busy, khong dang nhap duoc', async () => {
    const original = store.releaseThrottle.bind(store);
    let calls = 0;
    // Lần 1 là rút chỗ IP (đúng mật khẩu), lần 2 là rút chỗ đoán trong `finally`: cho lần 2 lỗi.
    vi.spyOn(store, 'releaseThrottle').mockImplementation(async (id) => {
      calls++;
      if (calls === 2) throw dbDown();
      return original(id);
    });
    const err = await caught('a@daidung.com.vn', REAL_PW);
    expect(err.message).toBe('system_busy');
    expect(calls).toBe(2);
  });

  it('loi o releaseThrottle rut cho IP (dung mat khau) -> system_busy, khong tra thong tin dang nhap', async () => {
    vi.spyOn(store, 'releaseThrottle').mockRejectedValue(dbDown());
    const err = await caught('a@daidung.com.vn', REAL_PW);
    expect(err.message).toBe('system_busy');
  });

  it('khong thu lai: reserveThrottle loi chi duoc goi dung 1 lan (Q2)', async () => {
    const spy = vi.spyOn(store, 'reserveThrottle').mockRejectedValue(dbDown());
    await caught('a@daidung.com.vn', REAL_PW);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('loi he thong co message CHUA chu "locked" (khong khop nguyen van) -> van la system_busy, khong thanh "locked"', async () => {
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce(new Error('deadlock detected: row locked by another transaction'));
    expect((await caught('a@daidung.com.vn', REAL_PW)).message).toBe('system_busy');
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce(new Error('ip_limited_by_proxy'));
    expect((await caught('a@daidung.com.vn', REAL_PW)).message).toBe('system_busy');
  });

  it('gia tri nem ra khong phai Error (chuoi, undefined) -> system_busy, log errName la kieu du lieu', async () => {
    const spy = vi.spyOn(logger, 'error');
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce('chuoi-ket-noi-postgresql://x:y@h/d');
    expect((await caught('a@daidung.com.vn', REAL_PW)).message).toBe('system_busy');
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce(undefined);
    expect((await caught('a@daidung.com.vn', REAL_PW)).message).toBe('system_busy');
    expect(spy).toHaveBeenCalledWith('auth.authorize_failed', expect.objectContaining({ errName: 'string' }));
    expect(JSON.stringify(spy.mock.calls)).not.toContain('postgresql://');
  });

  it('IP bi gioi han van la "ip_limited" (khong bi system_busy nuot) ngay ca khi lan truoc vua gap loi he thong', async () => {
    vi.spyOn(store, 'reserveThrottle').mockRejectedValueOnce(dbDown());
    expect((await caught('a@daidung.com.vn', REAL_PW)).message).toBe('system_busy');
    vi.spyOn(store, 'reserveThrottle').mockResolvedValueOnce(null);
    expect((await caught('a@daidung.com.vn', REAL_PW)).message).toBe('ip_limited');
  });

  it('tai khoan vua bi khoa (lan sai thu 5) van la "locked" du co lan loi he thong truoc do', async () => {
    vi.spyOn(store, 'reserveAccountGuess').mockRejectedValueOnce(dbDown());
    expect((await caught('a@daidung.com.vn', 'sai')).message).toBe('system_busy');
    const authorize = getAuthorize();
    for (let i = 0; i < 4; i++) expect(await authorize({ email: 'a@daidung.com.vn', password: 'sai' })).toBeNull();
    expect((await caught('a@daidung.com.vn', 'sai')).message).toBe('locked');
  });
});
