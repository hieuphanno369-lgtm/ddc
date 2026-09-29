/**
 * P3F-3 (Task 7) - server action quan tri dang ky cho + phong ban. Kho bo nho that (`createMemorySignupStore`)
 * duoc boc spy de chung minh nguoi khong phai admin KHONG cham duoc store; mailer gia de dem so lan gui.
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/lib/session';
import { createMemorySignupStore } from '@/server/repo/mock-repo-signup';
import type { SignupStore } from '@/server/repo/signup-types';
import type { UserAccount } from '@/server/repo/types';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

let currentUser: CurrentUser | null;
vi.mock('./action-guards', () => ({
  requireRoleUser: vi.fn(async (allowed: string[]) => (currentUser && allowed.includes(currentUser.role) ? currentUser : null)),
}));

let store: SignupStore;
vi.mock('./signup-store', () => ({ getSignupStore: () => store }));

const smtp = { host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'noreply@daidung.vn' };
const getSmtp = vi.fn(async () => smtp as typeof smtp | null);
const compose = vi.fn(async (_l: string, email: string, link: string) => ({ subject: 'Dat mat khau', text: `${email} ${link}` }));
const queue = vi.fn();
vi.mock('./auth-mail', () => ({ signupMailer: { getSmtp: () => getSmtp(), compose: (...a: [string, string, string]) => compose(...a), queue: (...a: unknown[]) => queue(...a) } }));

const replaceResetToken = vi.fn(async () => {});
vi.mock('./auth-store', () => ({ getAuthStore: () => ({ replaceResetToken }) }));
vi.mock('@/lib/password', () => ({ hashPassword: vi.fn(async (p: string) => `hashed:${p}`) }));

import { logActivity } from '@/lib/activity';
import {
  approveSignupAction,
  deleteDepartmentAction,
  rejectSignupAction,
  saveDepartmentAction,
  setDepartmentActiveAction,
} from './actions-signup-admin';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.vn', role: 'admin', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'V', email: 'v@daidung.vn', role: 'viewer', canViewFinance: false };

let accounts: UserAccount[];
let spy: { [K in keyof SignupStore]: ReturnType<typeof vi.fn> };

function req(email: string, locale: 'vi' | 'en' = 'vi', departmentId: number | null = null) {
  return store.createRequest({ email, name: 'Nguyen A', departmentId, locale, requestIp: '1.1.1.1', createdAtIso: new Date().toISOString() });
}
const pendingId = async (email: string) => (await store.listPending()).find((r) => r.email === email)!.id;

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = ADMIN;
  accounts = [];
  const real = createMemorySignupStore({
    findAccount: (e) => accounts.find((a) => a.email === e),
    createAccount: (a) => void accounts.push(a),
    countInDepartment: () => 0,
  });
  spy = Object.fromEntries(Object.entries(real).map(([k, fn]) => [k, vi.fn(fn as never)])) as typeof spy;
  store = spy as unknown as SignupStore;
  process.env.NEXTAUTH_URL = 'https://app.example.com/';
  getSmtp.mockResolvedValue(smtp);
});

describe('phan quyen', () => {
  it.each([
    ['khong dang nhap', null],
    ['vai tro khac admin', VIEWER],
  ])('%s -> Forbidden cho ca 5 ham, store khong bi goi', async (_n, user) => {
    currentUser = user;
    expect(await approveSignupAction(1, 'viewer')).toEqual({ ok: false, error: 'Forbidden' });
    expect(await rejectSignupAction(1)).toEqual({ ok: false, error: 'Forbidden' });
    expect(await saveDepartmentAction({ name: 'X' })).toEqual({ ok: false, error: 'Forbidden' });
    expect(await setDepartmentActiveAction(1, false)).toEqual({ ok: false, error: 'Forbidden' });
    expect(await deleteDepartmentAction(1)).toEqual({ ok: false, error: 'Forbidden' });
    for (const fn of Object.values(spy)) expect(fn).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe('kiem dau vao', () => {
  it.each([0, -1, 1.5, Number.NaN, 2 ** 40])('id %s khong hop le -> Invalid input', async (id) => {
    expect(await approveSignupAction(id, 'viewer')).toEqual({ ok: false, error: 'Invalid input' });
    expect(await rejectSignupAction(id)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await setDepartmentActiveAction(id, true)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await deleteDepartmentAction(id)).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('vai tro ngoai 4 gia tri -> Invalid input, khong cham store', async () => {
    await req('a@daidung.vn');
    expect(await approveSignupAction(1, 'superuser' as never)).toEqual({ ok: false, error: 'Invalid input' });
    expect(spy.approveRequest).not.toHaveBeenCalled();
  });
});

describe('bat tai khoan', () => {
  it('approveRequest nhan hash cua chuoi ngau nhien (khong rong), canViewFinance = role khac viewer; log; link dat mat khau theo locale', async () => {
    await req('nguoi@daidung.vn', 'en');
    const id = await pendingId('nguoi@daidung.vn');
    expect(await approveSignupAction(id, 'bod')).toEqual({ ok: true, mailed: true });
    expect(spy.approveRequest).toHaveBeenCalledWith(id, { role: 'bod', canViewFinance: true, passwordHash: expect.stringMatching(/^hashed:[0-9a-f]{64}$/) });
    expect(logActivity).toHaveBeenCalledWith(ADMIN, 'signup_approve', 'nguoi@daidung.vn:bod');
    expect(queue).toHaveBeenCalledTimes(1);
    const [, to] = queue.mock.calls[0];
    expect(to).toBe('nguoi@daidung.vn');
    expect(compose).toHaveBeenCalledWith('en', 'nguoi@daidung.vn', expect.stringMatching(/^https:\/\/app\.example\.com\/en\/dat-lai-mat-khau\?token=[A-Za-z0-9_-]{43}$/));
    expect(accounts[0]).toMatchObject({ email: 'nguoi@daidung.vn', role: 'bod', canViewFinance: true });
  });

  it('token: luu dung 1 hash SHA-256 (khong luu token tho), han 72 gio, link chua token tho', async () => {
    await req('t@daidung.vn');
    const t0 = Date.now();
    await approveSignupAction(await pendingId('t@daidung.vn'), 'viewer');
    expect(replaceResetToken).toHaveBeenCalledTimes(1);
    const [email, tokenHash, expiresAtIso] = replaceResetToken.mock.calls[0] as unknown as [string, string, string];
    expect(email).toBe('t@daidung.vn');
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const ttl = Date.parse(expiresAtIso) - t0;
    expect(ttl).toBeGreaterThanOrEqual(72 * 3_600_000 - 1000);
    expect(ttl).toBeLessThanOrEqual(72 * 3_600_000 + 5000);
    const link = compose.mock.calls[0][2] as string;
    const token = link.split('token=')[1];
    expect(token).not.toBe(tokenHash);
    expect(createHash('sha256').update(token).digest('hex')).toBe(tokenHash);
  });

  it('vai tro viewer -> canViewFinance false', async () => {
    await req('v@daidung.vn');
    await approveSignupAction(await pendingId('v@daidung.vn'), 'viewer');
    expect(spy.approveRequest).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ role: 'viewer', canViewFinance: false }));
  });

  it('thieu SMTP -> KHONG bat, error smtp_missing, dang ky van con, khong cham approveRequest, khong log, khong gui', async () => {
    getSmtp.mockResolvedValue(null);
    await req('a@daidung.vn');
    expect(await approveSignupAction(await pendingId('a@daidung.vn'), 'viewer')).toEqual({ ok: false, error: 'smtp_missing' });
    expect(spy.approveRequest).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
    expect(accounts).toHaveLength(0);
    expect(await store.countPending()).toBe(1);
  });

  it('thieu NEXTAUTH_URL -> KHONG bat, error smtp_missing', async () => {
    delete process.env.NEXTAUTH_URL;
    await req('a@daidung.vn');
    expect(await approveSignupAction(await pendingId('a@daidung.vn'), 'viewer')).toEqual({ ok: false, error: 'smtp_missing' });
    expect(spy.approveRequest).not.toHaveBeenCalled();
    expect(accounts).toHaveLength(0);
  });

  it('loi khi soan/gui email khong hoan tac viec bat tai khoan, mailed false, chi log ten loi', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compose.mockRejectedValueOnce(new TypeError('chi tiet nhay cam'));
    await req('a@daidung.vn');
    expect(await approveSignupAction(await pendingId('a@daidung.vn'), 'viewer')).toEqual({ ok: true, mailed: false });
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain('nhay cam');
    expect(accounts).toHaveLength(1);
    errSpy.mockRestore();
  });

  it('loi luu token -> tai khoan van duoc bat, mailed false, khong gui', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    replaceResetToken.mockRejectedValueOnce(new Error('db down'));
    await req('a@daidung.vn');
    expect(await approveSignupAction(await pendingId('a@daidung.vn'), 'viewer')).toEqual({ ok: true, mailed: false });
    expect(queue).not.toHaveBeenCalled();
    expect(accounts).toHaveLength(1);
    errSpy.mockRestore();
  });

  it('not_found va duplicate_account tra dung, khong ghi log, khong tao token, khong gui mail', async () => {
    expect(await approveSignupAction(99, 'viewer')).toEqual({ ok: false, error: 'not_found' });
    await req('trung@daidung.vn');
    accounts.push({ email: 'trung@daidung.vn', name: 'x', passwordHash: 'x', role: 'viewer', canViewFinance: false, isActive: true, createdAt: '', lastLoginAt: null, lockedAt: null });
    expect(await approveSignupAction(await pendingId('trung@daidung.vn'), 'viewer')).toEqual({ ok: false, error: 'duplicate_account' });
    expect(logActivity).not.toHaveBeenCalled();
    expect(replaceResetToken).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
  });
});

describe('tu choi', () => {
  it('ghi log signup_reject voi email, KHONG gui mail', async () => {
    await req('tc@daidung.vn');
    expect(await rejectSignupAction(await pendingId('tc@daidung.vn'))).toEqual({ ok: true });
    expect(logActivity).toHaveBeenCalledWith(ADMIN, 'signup_reject', 'tc@daidung.vn');
    expect(queue).not.toHaveBeenCalled();
    expect(compose).not.toHaveBeenCalled();
    expect(await rejectSignupAction(1)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('phong ban', () => {
  it.each(['', '   ', 'a'.repeat(101)])('ten %j -> Invalid input', async (name) => {
    expect(await saveDepartmentAction({ name })).toEqual({ ok: false, error: 'Invalid input' });
    expect(spy.saveDepartment).not.toHaveBeenCalled();
  });

  it('luu moi + doi ten + trung ten + khong ton tai; log save_department', async () => {
    const a = await saveDepartmentAction({ name: '  Ke   toan ' });
    expect(a).toEqual({ ok: true, id: 1 });
    expect(logActivity).toHaveBeenCalledWith(ADMIN, 'save_department', 'Ke toan');
    expect(await saveDepartmentAction({ name: 'KE TOAN' })).toEqual({ ok: false, error: 'duplicate_name' });
    expect(await saveDepartmentAction({ id: 1, name: 'Ke toan 2' })).toEqual({ ok: true, id: 1 });
    expect(await saveDepartmentAction({ id: 77, name: 'Khac' })).toEqual({ ok: false, error: 'not_found' });
    expect(spy.saveDepartment).toHaveBeenCalledWith({ id: undefined, name: 'Ke toan' }, ADMIN.email);
  });

  it('an / hien lai: log hide_department / show_department; id la -> not_found', async () => {
    await saveDepartmentAction({ name: 'Kho' });
    expect(await setDepartmentActiveAction(1, false)).toEqual({ ok: true });
    expect(logActivity).toHaveBeenLastCalledWith(ADMIN, 'hide_department', '1');
    expect(await setDepartmentActiveAction(1, true)).toEqual({ ok: true });
    expect(logActivity).toHaveBeenLastCalledWith(ADMIN, 'show_department', '1');
    expect(await setDepartmentActiveAction(9, true)).toEqual({ ok: false, error: 'not_found' });
  });

  it('xoa: in_use tra count, khong log; xoa duoc -> log delete_department; khong ton tai -> not_found', async () => {
    await saveDepartmentAction({ name: 'Dang dung' });
    await saveDepartmentAction({ name: 'Trong' });
    await req('u@daidung.vn', 'vi', 1);
    vi.clearAllMocks();
    expect(await deleteDepartmentAction(1)).toEqual({ ok: false, error: 'in_use', count: 1 });
    expect(logActivity).not.toHaveBeenCalled();
    expect(await deleteDepartmentAction(2)).toEqual({ ok: true });
    expect(logActivity).toHaveBeenCalledWith(ADMIN, 'delete_department', '2');
    expect(await deleteDepartmentAction(2)).toEqual({ ok: false, error: 'not_found' });
  });
});
