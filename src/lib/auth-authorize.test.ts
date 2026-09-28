/**
 * P3E (Task 6, bước 6.1) - `authorize` (CredentialsProvider) nối vao `checkCredentials`/`AuthStore`
 * that (khong con doc thang `prisma.userRole` nhu truoc Task 6): mock `next/headers` (x-forwarded-for),
 * `@/server/auth-store` (kho bo nho), `@/lib/activity` (khong ghi that).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/password';
import { createMemoryAuthStore, type MemoryAccountSource } from '@/server/repo/mock-repo-auth';
import type { UserAccount } from '@/server/repo/types';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

const REAL_PW = 'MatKhauThat1';
let accounts: UserAccount[];
let store: ReturnType<typeof createMemoryAuthStore>;
let currentIp = '9.9.9.9';

function account(over: Partial<UserAccount> = {}): UserAccount {
  return {
    email: 'a@daidung.com.vn', name: 'A', passwordHash: hashPassword(REAL_PW), role: 'viewer',
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
afterEach(() => vi.clearAllMocks());

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
