/**
 * P3F (tester) - kiem hanh vi xuyen suot, ghep nhieu khoi that voi nhau: dang ky -> tai khoan cho -> admin bat/tu choi ->
 * dang nhap. Kho bo nho that (`createMemorySignupStore`, `createMemoryAuthStore`), chi mock chan ngoai (headers, activity,
 * email, guard quyen). Bo sung cho cac test don le, khong lap lai.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/lib/session';
import { SIGNUP_EMAIL_LIMIT } from '@/lib/login-policy';
import { hashPassword } from '@/lib/password';
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

const queue = vi.fn();
vi.mock('./auth-mail', () => ({
  signupMailer: {
    getSmtp: async () => ({ host: 'smtp.test' }),
    compose: async () => ({ subject: 's', text: 't' }),
    queue: (...a: unknown[]) => queue(...a),
  },
}));

import { logActivity } from '@/lib/activity';
import { authOptions } from '@/lib/auth';
import { approveSignupAction, rejectSignupAction, saveDepartmentAction, setDepartmentActiveAction } from './actions-signup-admin';
import { __signupQueueIdleForTest, requestSignup } from './signup';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.vn', role: 'admin', canViewFinance: true };
const PW = 'Abcdef1!';
// Form khong con o mat khau (S1): PW chi dung de doan dang nhap.
const NOW = new Date('2026-09-29T03:00:00.000Z');

let accounts: UserAccount[];
let realHash = '';

beforeAll(async () => {
  realHash = await hashPassword('MatKhauAdmin1');
});

type Authorize = (c: Record<string, string> | undefined) => Promise<unknown>;
const authorize = (): Authorize =>
  (authOptions.providers.find((p) => p.id === 'credentials') as unknown as { options: { authorize: Authorize } }).options.authorize;

function input(over: Partial<Parameters<typeof requestSignup>[2]> = {}) {
  return { name: 'Nguyen Van A', departmentId: null, email: 'ten@daidung.vn', locale: 'vi' as const, ip: '203.0.113.1', ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = ADMIN;
  accounts = [];
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
  process.env.NEXTAUTH_URL = 'https://ddc.test';
});
afterEach(() => vi.restoreAllMocks());

describe('tai khoan cho bat', () => {
  it('khong dang nhap duoc khi cho bat; bat xong van khong vao duoc bang mat khau doan (chi qua link gui toi email)', async () => {
    expect(await requestSignup(signup, auth, input({ email: 'Cho@DaiDung.vn' }), NOW)).toEqual({ status: 'accepted' });
    await __signupQueueIdleForTest();
    expect((await signup.listPending()).map((r) => r.email)).toEqual(['cho@daidung.vn']);

    expect(await authorize()({ email: 'cho@daidung.vn', password: PW })).toBeNull();
    expect(accounts).toHaveLength(0);

    const id = (await signup.listPending())[0].id;
    expect(await approveSignupAction(id, 'viewer')).toEqual({ ok: true, mailed: true });
    expect(await authorize()({ email: 'cho@daidung.vn', password: PW })).toBeNull();
    expect(accounts[0].role).toBe('viewer');
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('bi tu choi roi thi khong dang nhap duoc, cung khong co tai khoan', async () => {
    await requestSignup(signup, auth, input(), NOW);
    await __signupQueueIdleForTest();
    const id = (await signup.listPending())[0].id;
    expect(await rejectSignupAction(id)).toEqual({ ok: true });
    expect(await authorize()({ email: 'ten@daidung.vn', password: PW })).toBeNull();
    expect(accounts).toHaveLength(0);
  });
});

describe('admin bat', () => {
  it('2 admin bat cung luc 1 dang ky -> dung 1 tai khoan, nguoi kia not_found', async () => {
    await requestSignup(signup, auth, input(), NOW);
    await __signupQueueIdleForTest();
    const id = (await signup.listPending())[0].id;
    const results = await Promise.all([approveSignupAction(id, 'bod'), approveSignupAction(id, 'viewer')]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === 'not_found')).toHaveLength(1);
    expect(accounts).toHaveLength(1);
  });

  it('bat khi email da co tai khoan tao tay: duplicate_account, mat khau cu KHONG bi ghi de, dang ky van con', async () => {
    await requestSignup(signup, auth, input(), NOW);
    await __signupQueueIdleForTest();
    accounts.push({
      email: 'ten@daidung.vn', name: 'Tay', passwordHash: realHash, role: 'data-entry', canViewFinance: true, isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: null,
    });
    const id = (await signup.listPending())[0].id;
    expect(await approveSignupAction(id, 'admin')).toEqual({ ok: false, error: 'duplicate_account' });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].passwordHash).toBe(realHash);
    expect(accounts[0].role).toBe('data-entry');
    expect(await signup.countPending()).toBe(1);
    expect(await authorize()({ email: 'ten@daidung.vn', password: PW })).toBeNull();
    expect(await authorize()({ email: 'ten@daidung.vn', password: 'MatKhauAdmin1' })).not.toBeNull();
    expect(queue).not.toHaveBeenCalled();
  });

  it('bat / tu choi dang ky da bi nguoi khac xu ly -> not_found, khong ghi log them', async () => {
    await requestSignup(signup, auth, input(), NOW);
    await __signupQueueIdleForTest();
    const id = (await signup.listPending())[0].id;
    await rejectSignupAction(id);
    vi.mocked(logActivity).mockClear();
    expect(await approveSignupAction(id, 'viewer')).toEqual({ ok: false, error: 'not_found' });
    expect(await rejectSignupAction(id)).toEqual({ ok: false, error: 'not_found' });
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe('email bien o server', () => {
  it('cung email khac hoa thuong / khoang trang -> 1 dang ky duy nhat, luu dang chuan hoa', async () => {
    await requestSignup(signup, auth, input({ email: 'TEN@daidung.vn' }), NOW);
    await requestSignup(signup, auth, input({ email: '  ten@DAIDUNG.VN ' }), NOW);
    await __signupQueueIdleForTest();
    const pending = await signup.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe('ten@daidung.vn');
  });

  it('gioi han theo email tinh khong phan biet hoa thuong', async () => {
    const variants = ['ten@daidung.vn', 'TEN@daidung.vn', 'Ten@Daidung.Vn'];
    expect(variants.length).toBe(SIGNUP_EMAIL_LIMIT);
    for (const [i, email] of variants.entries()) {
      expect((await requestSignup(signup, auth, input({ email, ip: `10.0.0.${i}` }), NOW)).status).toBe('accepted');
    }
    expect(await requestSignup(signup, auth, input({ email: ' TEN@DAIDUNG.VN', ip: '10.0.0.99' }), NOW)).toEqual({ status: 'rate_limited' });
  });

  it.each([
    ['nhieu @', 'ten@daidung.vn@daidung.vn'],
    ['hai @ lien tiep', 'ten@@daidung.vn'],
    ['tu Cyrillic gia dang chu a', 'ten@dаidung.vn'],
    ['@ toan chieu', 'ten＠daidung.vn'],
    ['xuong dong chen giua', 'ten\n@daidung.vn'],
    ['duoi keo dai', 'ten@daidung.vn.evil.com'],
    ['ten mien con', 'ten@mail.daidung.com.vn'],
    ['dai hon 254', `${'a'.repeat(60)}@${'b'.repeat(200)}.daidung.vn`],
  ])('email %s -> invalid email_domain, khong bam, khong dat cho', async (_l, email) => {
    expect(await requestSignup(signup, auth, input({ email }), NOW)).toEqual({ status: 'invalid', field: 'email_domain' });
    await __signupQueueIdleForTest();
    expect(await signup.countPending()).toBe(0);
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe('phong ban thay doi giua chung', () => {
  it('phong ban bi an sau khi nguoi dung mo form -> invalid department', async () => {
    const saved = await saveDepartmentAction({ name: 'Ke toan' });
    const id = (saved as { id: number }).id;
    expect((await requestSignup(signup, auth, input({ departmentId: id }), NOW)).status).toBe('accepted');
    await setDepartmentActiveAction(id, false);
    expect(await requestSignup(signup, auth, input({ email: 'b@daidung.vn', departmentId: id }), NOW)).toEqual({ status: 'invalid', field: 'department' });
  });

  it('danh muc trong luc mo form, admin them phong ban dau tien giua chung -> gui null bi bao department', async () => {
    expect((await requestSignup(signup, auth, input({ departmentId: null }), NOW)).status).toBe('accepted');
    await saveDepartmentAction({ name: 'Kho' });
    expect(await requestSignup(signup, auth, input({ email: 'b@daidung.vn', departmentId: null }), NOW)).toEqual({ status: 'invalid', field: 'department' });
  });
});
