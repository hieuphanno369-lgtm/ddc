/**
 * P3E (D1) - callback next-auth thật cho đăng nhập Google + kiểm lại quyền qua jwt, dùng chung
 * mock @/server/db với auth-access-recheck.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));
vi.mock('@/server/db', () => ({ prisma: { userRole: { findUnique: findUniqueMock } } }));
vi.mock('@/lib/activity');

import { authOptions, ACCESS_RECHECK_INTERVAL_MS } from './auth';

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
