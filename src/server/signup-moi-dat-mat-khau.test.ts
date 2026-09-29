/**
 * S1 (bao-mat P3F, phuong an b) - dang ky KHONG nhan mat khau. Admin bat thi tai khoan tao ra chua co mat khau nao dung duoc,
 * chi chu hop thu dat duoc qua link (72 gio, dung 1 lan, chi luu hash) gui toi dung email dang ky.
 * Kho bo nho that, chi mock chan ngoai (headers, activity, email, guard quyen).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/lib/session';
import { SIGNUP_INVITE_TTL_MS } from '@/lib/login-policy';
import { createMemoryAuthStore } from './repo/mock-repo-auth';
import { createMemorySignupStore } from './repo/mock-repo-signup';
import type { SignupStore } from './repo/signup-types';
import type { AuthStore, UserAccount } from './repo/types';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));
vi.mock('@/server/db', () => ({ prisma: { userRole: { update: vi.fn(async () => ({})) } } }));
vi.mock('next/headers', () => ({ headers: async () => new Map([['x-forwarded-for', '198.51.100.7']]) as unknown as Headers }));

let currentUser: CurrentUser | null;
vi.mock('./action-guards', () => ({
  requireRoleUser: vi.fn(async (allowed: string[]) => (currentUser && allowed.includes(currentUser.role) ? currentUser : null)),
}));

let signup: SignupStore;
let auth: AuthStore;
vi.mock('./signup-store', () => ({ getSignupStore: () => signup }));
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => auth }));

let smtp: { host: string } | null;
const sent: { to: string; text: string }[] = [];
vi.mock('./auth-mail', () => ({
  signupMailer: {
    getSmtp: async () => smtp,
    compose: async (_l: string, email: string, link: string) => ({ subject: 's', text: `${email} ${link}` }),
    queue: (_cfg: unknown, to: string, _s: string, text: string) => void sent.push({ to, text }),
  },
}));

import { authOptions } from '@/lib/auth';
import { approveSignupAction } from './actions-signup-admin';
import { requestPasswordReset, resetPasswordWithToken } from './password-reset';
import { __signupQueueIdleForTest, requestSignup } from './signup';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.vn', role: 'admin', canViewFinance: true };
const NOW = new Date('2026-09-29T03:00:00.000Z');
const X = 'truongphong@daidung.vn';

let accounts: UserAccount[];

type Authorize = (c: Record<string, string> | undefined) => Promise<unknown>;
const authorize = (): Authorize =>
  (authOptions.providers.find((p) => p.id === 'credentials') as unknown as { options: { authorize: Authorize } }).options.authorize;

const tokenOf = (text: string) => /token=([A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? '';

async function register(): Promise<number> {
  await requestSignup(signup, auth, { name: 'Truong Phong', departmentId: null, email: X, locale: 'vi', ip: '203.0.113.1' }, NOW);
  await __signupQueueIdleForTest();
  return (await signup.listPending())[0].id;
}

async function registerAndApprove(): Promise<void> {
  expect(await approveSignupAction(await register(), 'bod')).toEqual({ ok: true, mailed: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = ADMIN;
  accounts = [];
  sent.length = 0;
  smtp = { host: 'smtp.test' };
  process.env.NEXTAUTH_URL = 'https://ddc.test';
  signup = createMemorySignupStore({
    findAccount: (e) => accounts.find((a) => a.email === e),
    createAccount: (a) => void accounts.push(a),
    countInDepartment: () => 0,
  });
  auth = createMemoryAuthStore({
    findAccount: (e) => accounts.find((a) => a.email === e.toLowerCase()),
    changePassword: (e, h) => {
      const a = accounts.find((x) => x.email === e.toLowerCase());
      if (a) a.passwordHash = h;
    },
  });
});

describe('S1 - bat dang ky khong con mat khau do nguoi gui form chon', () => {
  it('bat xong: khong mat khau nao dang nhap duoc, link chi gui toi email dang ky, dat qua link xong moi vao duoc', async () => {
    await registerAndApprove();
    for (const guess of ['Abcdef1!', '', 'password', 'truongphong@daidung.vn', 'Truong Phong']) {
      expect(await authorize()({ email: X, password: guess }), `mat khau doan ${JSON.stringify(guess)}`).toBeNull();
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(X);
    expect(sent[0].text).toContain('https://ddc.test/vi/dat-lai-mat-khau?token=');

    const token = tokenOf(sent[0].text);
    expect(await resetPasswordWithToken(auth, { token, newPassword: 'MatKhauMoi1', ip: '203.0.113.9' }, new Date())).toEqual({ ok: true, locked: false });
    expect(((await authorize()({ email: X, password: 'MatKhauMoi1' })) as { email: string } | null)?.email).toBe(X);
  });

  it('link dung 1 lan: lan 2 hong, mat khau khong bi ghi de', async () => {
    await registerAndApprove();
    const token = tokenOf(sent[0].text);
    await resetPasswordWithToken(auth, { token, newPassword: 'MatKhauMoi1', ip: '203.0.113.9' }, new Date());
    expect(await resetPasswordWithToken(auth, { token, newPassword: 'KeTanCong99', ip: '203.0.113.9' }, new Date())).toEqual({
      ok: false,
      error: 'invalid_token',
    });
    expect(await authorize()({ email: X, password: 'KeTanCong99' })).toBeNull();
    expect(await authorize()({ email: X, password: 'MatKhauMoi1' })).not.toBeNull();
  });

  it('han dung 72 gio: con dung duoc truoc 72 gio, hong sau 72 gio', async () => {
    expect(SIGNUP_INVITE_TTL_MS).toBe(72 * 3_600_000);
    await registerAndApprove();
    const token = tokenOf(sent[0].text);
    const approvedAt = Date.now();
    const late = new Date(approvedAt + SIGNUP_INVITE_TTL_MS + 60_000);
    expect(await resetPasswordWithToken(auth, { token, newPassword: 'MatKhauMoi1', ip: '203.0.113.9' }, late)).toEqual({
      ok: false,
      error: 'invalid_token',
    });
    const early = new Date(approvedAt + SIGNUP_INVITE_TTL_MS - 60_000);
    expect((await resetPasswordWithToken(auth, { token, newPassword: 'MatKhauMoi1', ip: '203.0.113.9' }, early)).ok).toBe(true);
  });

  it('thieu SMTP: KHONG bat duoc, bao loi cho admin, dang ky van con, khong co tai khoan', async () => {
    const id = await register();
    smtp = null;
    expect(await approveSignupAction(id, 'viewer')).toEqual({ ok: false, error: 'smtp_missing' });
    expect(accounts).toHaveLength(0);
    expect(await signup.countPending()).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('thieu NEXTAUTH_URL cung KHONG bat duoc', async () => {
    const id = await register();
    delete process.env.NEXTAUTH_URL;
    expect(await approveSignupAction(id, 'viewer')).toEqual({ ok: false, error: 'smtp_missing' });
    expect(accounts).toHaveLength(0);
  });

  it('link het han: Quen mat khau lay duoc link moi cho tai khoan chua tung dat mat khau', async () => {
    await registerAndApprove();
    const resetSent: string[] = [];
    const mailer = {
      getSmtp: async () => ({ host: 'smtp.test' }) as never,
      compose: async (_l: string, _e: string, link: string) => ({ subject: 's', text: link }),
      queue: (_c: unknown, _to: string, _s: string, text: string) => void resetSent.push(text),
    };
    const later = new Date(Date.now() + SIGNUP_INVITE_TTL_MS + 3_600_000);
    expect(await requestPasswordReset(auth, mailer, { email: X, ip: '203.0.113.5', locale: 'vi', baseUrl: 'https://ddc.test' }, later)).toEqual({
      status: 'accepted',
    });
    await vi.waitFor(() => expect(resetSent).toHaveLength(1));
    const token = tokenOf(resetSent[0]);
    expect((await resetPasswordWithToken(auth, { token, newPassword: 'MatKhauMoi1', ip: '203.0.113.9' }, later)).ok).toBe(true);
    expect(await authorize()({ email: X, password: 'MatKhauMoi1' })).not.toBeNull();
  });
});
