import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SIGNUP_EMAIL_LIMIT, SIGNUP_IP_LIMIT, SIGNUP_WINDOW_MS } from '@/lib/login-policy';
import { createMemoryAuthStore } from './repo/mock-repo-auth';
import { createMemorySignupStore } from './repo/mock-repo-signup';
import type { SignupStore } from './repo/signup-types';
import type { AuthStore, UserAccount } from './repo/types';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

import { logActivity } from '@/lib/activity';
import { __signupQueueIdleForTest, requestSignup } from './signup';

const NOW = new Date('2026-09-29T03:00:00.000Z');

let accounts: UserAccount[];
let signup: SignupStore;
let auth: AuthStore;

function makeStores() {
  accounts = [];
  const dept = new Map<string, number | null>();
  signup = createMemorySignupStore({
    findAccount: (email) => accounts.find((a) => a.email === email),
    createAccount: (a, d) => {
      accounts.push(a);
      dept.set(a.email, d);
    },
    countInDepartment: (id) => [...dept.values()].filter((x) => x === id).length,
  });
  auth = createMemoryAuthStore({
    findAccount: (email) => accounts.find((a) => a.email === email.toLowerCase()),
    changePassword: () => {},
  });
}

function input(over: Partial<Parameters<typeof requestSignup>[2]> = {}) {
  return {
    name: 'Nguyen Van A',
    departmentId: null,
    email: 'ten@daidung.vn',
    locale: 'vi' as const,
    ip: '203.0.113.1',
    ...over,
  };
}

const calls = (fn: unknown) => (fn as { mock: { calls: unknown[][] } }).mock.calls;

beforeEach(() => {
  makeStores();
  vi.clearAllMocks();
});

describe('requestSignup - kiem du lieu nhap', () => {
  it.each([
    ['', 'name'],
    ['   ', 'name'],
    ['a'.repeat(101), 'name'],
  ])('ten %j -> invalid name', async (name, field) => {
    expect(await requestSignup(signup, auth, input({ name }), NOW)).toEqual({ status: 'invalid', field });
  });

  it.each([
    ['xuong dong', 'A\n\nVui long xac nhan tai http://gia-mao'],
    ['tab', 'A\tB'],
    ['ky tu dieu khien NUL', 'A\u0000B'],
    ['zero-width space', 'A​B'],
    ['RTL override', 'A‮B'],
    ['BOM', 'A﻿B'],
  ])('ten chua %s (nhom Unicode C) -> invalid name, khong dat cho, khong ghi log (S2)', async (_l, name) => {
    expect(await requestSignup(signup, auth, input({ name }), NOW)).toEqual({ status: 'invalid', field: 'name' });
    expect(await auth.countThrottle('signup_ip', '203.0.113.1', '2026-01-01T00:00:00.000Z')).toBe(0);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it('ten tieng Viet co dau va dau cach van hop le (khong chan nham)', async () => {
    expect((await requestSignup(signup, auth, input({ name: 'Nguyễn Thị Hương Giang' }), NOW)).status).toBe('accepted');
  });

  it('ten khong phai chuoi -> invalid name', async () => {
    expect(await requestSignup(signup, auth, input({ name: 42 }), NOW)).toEqual({ status: 'invalid', field: 'name' });
  });

  it('email sai duoi -> invalid email_domain', async () => {
    expect(await requestSignup(signup, auth, input({ email: 'ten@gmail.com' }), NOW)).toEqual({ status: 'invalid', field: 'email_domain' });
  });

  it('nhan ca hai duoi cong ty (Q2 = c)', async () => {
    expect((await requestSignup(signup, auth, input({ email: 'a@daidung.com.vn' }), NOW)).status).toBe('accepted');
    expect((await requestSignup(signup, auth, input({ email: 'b@daidung.vn', ip: '203.0.113.2' }), NOW)).status).toBe('accepted');
  });

  it('danh muc co phong ban dang dung: null, khong nguyen, khong ton tai, da an -> invalid department', async () => {
    const a = (await signup.saveDepartment({ name: 'Ke toan' }, 'admin')) as { id: number };
    const b = (await signup.saveDepartment({ name: 'Kho' }, 'admin')) as { id: number };
    await signup.setDepartmentActive(b.id, false, 'admin');
    for (const departmentId of [null, 1.5, '1', 999, b.id, undefined]) {
      expect(await requestSignup(signup, auth, input({ departmentId }), NOW), `departmentId=${String(departmentId)}`).toEqual({
        status: 'invalid',
        field: 'department',
      });
    }
    expect((await requestSignup(signup, auth, input({ departmentId: a.id }), NOW)).status).toBe('accepted');
  });

  it('danh muc trong: departmentId khac null -> invalid department; null hop le', async () => {
    expect(await requestSignup(signup, auth, input({ departmentId: 1 }), NOW)).toEqual({ status: 'invalid', field: 'department' });
    expect((await requestSignup(signup, auth, input({ departmentId: null }), NOW)).status).toBe('accepted');
  });

  it('thu tu kiem: name -> department -> email_domain (tra loi dau tien)', async () => {
    await signup.saveDepartment({ name: 'Ke toan' }, 'admin');
    const bad = { name: '', departmentId: null, email: 'x@gmail.com' };
    expect(await requestSignup(signup, auth, input(bad), NOW)).toEqual({ status: 'invalid', field: 'name' });
    expect(await requestSignup(signup, auth, input({ ...bad, name: 'A' }), NOW)).toEqual({ status: 'invalid', field: 'department' });
    expect(await requestSignup(signup, auth, input({ ...bad, name: 'A', departmentId: 1 }), NOW)).toEqual({ status: 'invalid', field: 'email_domain' });
  });

  it('du lieu sai: khong dat cho throttle, khong ghi log', async () => {
    await requestSignup(signup, auth, input({ email: 'x@gmail.com' }), NOW);
    expect(await auth.countThrottle('signup_ip', '203.0.113.1', '2026-01-01T00:00:00.000Z')).toBe(0);
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe('requestSignup - hop le', () => {
  it('email moi -> accepted; sau hang doi co dung 1 dang ky cho, co locale + ip, KHONG luu mat khau nao; log created', async () => {
    const createRequest = vi.fn(signup.createRequest);
    const spied: SignupStore = { ...signup, createRequest };
    const res = await requestSignup(spied, auth, input({ locale: 'en', email: '  Ten@DaiDung.vn ', ip: '198.51.100.7' }), NOW);
    expect(res).toEqual({ status: 'accepted' });
    await __signupQueueIdleForTest();
    expect(createRequest).toHaveBeenCalledTimes(1);
    const row = createRequest.mock.calls[0][0];
    expect(Object.keys(row).sort()).toEqual(['createdAtIso', 'departmentId', 'email', 'locale', 'name', 'requestIp']);
    expect(row).toMatchObject({ locale: 'en', requestIp: '198.51.100.7', createdAtIso: NOW.toISOString() });
    const pending = await signup.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ email: 'ten@daidung.vn', name: 'Nguyen Van A', locale: 'en', departmentId: null });
    expect(calls(logActivity)).toHaveLength(1);
    expect(calls(logActivity)[0]).toEqual([{ name: 'Nguyen Van A', email: 'ten@daidung.vn' }, 'signup_request', 'created']);
  });

  it('luu ten da trim', async () => {
    await requestSignup(signup, auth, input({ name: '  Le Thi B  ' }), NOW);
    await __signupQueueIdleForTest();
    expect((await signup.listPending())[0].name).toBe('Le Thi B');
  });

  it('email da co tai khoan -> VAN accepted, khong tao dong moi, log duplicate co dinh', async () => {
    accounts.push({
      email: 'ten@daidung.vn', name: 'Co san', passwordHash: 'x', role: 'viewer', canViewFinance: false, isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: null,
    });
    expect(await requestSignup(signup, auth, input(), NOW)).toEqual({ status: 'accepted' });
    await __signupQueueIdleForTest();
    expect(await signup.countPending()).toBe(0);
    expect(calls(logActivity)).toEqual([[{ name: 'dang-ky-trung', email: 'dang-ky-trung' }, 'signup_request', 'duplicate']]);
  });

  it('email da co dang ky cho -> VAN accepted, khong tao dong thu 2', async () => {
    await requestSignup(signup, auth, input(), NOW);
    await __signupQueueIdleForTest();
    vi.clearAllMocks();
    expect(await requestSignup(signup, auth, input({ ip: '203.0.113.2' }), NOW)).toEqual({ status: 'accepted' });
    await __signupQueueIdleForTest();
    expect(await signup.countPending()).toBe(1);
    expect(calls(logActivity)).toEqual([[{ name: 'dang-ky-trung', email: 'dang-ky-trung' }, 'signup_request', 'duplicate']]);
  });

  it('2 yeu cau dong thoi cung email moi -> dung 1 dang ky, ca hai accepted', async () => {
    const [a, b] = await Promise.all([
      requestSignup(signup, auth, input({ ip: '203.0.113.1' }), NOW),
      requestSignup(signup, auth, input({ ip: '203.0.113.2' }), NOW),
    ]);
    expect([a.status, b.status]).toEqual(['accepted', 'accepted']);
    await __signupQueueIdleForTest();
    expect(await signup.countPending()).toBe(1);
  });

  it('bi tu choi roi gui lai cung email -> tao dang ky cho moi (Q5 = a)', async () => {
    await requestSignup(signup, auth, input(), NOW);
    await __signupQueueIdleForTest();
    const id = (await signup.listPending())[0].id;
    await signup.rejectRequest(id);
    await requestSignup(signup, auth, input({ ip: '203.0.113.2' }), NOW);
    await __signupQueueIdleForTest();
    expect(await signup.countPending()).toBe(1);
  });

  it('loi ha tang o viec nen khong lam hong hang doi, chi log ten loi', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: SignupStore = { ...signup, emailTaken: async () => { throw new TypeError('chi tiet ha tang nhay cam'); } };
    expect(await requestSignup(broken, auth, input(), NOW)).toEqual({ status: 'accepted' });
    await __signupQueueIdleForTest();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('nhay cam');
    expect(JSON.stringify(spy.mock.calls)).toContain('TypeError');
    spy.mockRestore();
    // hang doi van chay tiep sau loi
    expect((await requestSignup(signup, auth, input({ email: 'b@daidung.vn', ip: '203.0.113.2' }), NOW)).status).toBe('accepted');
    await __signupQueueIdleForTest();
    expect(await signup.countPending()).toBe(1);
  });
});

describe('requestSignup - gioi han tan suat', () => {
  it(`lan thu ${SIGNUP_IP_LIMIT + 1} trong 1 gio cung IP -> rate_limited, khong log`, async () => {
    for (let i = 0; i < SIGNUP_IP_LIMIT; i++) {
      expect((await requestSignup(signup, auth, input({ email: `u${i}@daidung.vn` }), NOW)).status).toBe('accepted');
    }
    await __signupQueueIdleForTest();
    vi.clearAllMocks();
    expect(await requestSignup(signup, auth, input({ email: 'them@daidung.vn' }), NOW)).toEqual({ status: 'rate_limited' });
    expect(logActivity).not.toHaveBeenCalled();
  });

  it('sau 1 gio + 1ms cung IP dang ky lai duoc', async () => {
    for (let i = 0; i < SIGNUP_IP_LIMIT; i++) await requestSignup(signup, auth, input({ email: `u${i}@daidung.vn` }), NOW);
    const later = new Date(NOW.getTime() + SIGNUP_WINDOW_MS + 1);
    expect((await requestSignup(signup, auth, input({ email: 'sau@daidung.vn' }), later)).status).toBe('accepted');
  });

  it(`lan thu ${SIGNUP_EMAIL_LIMIT + 1} cung email (IP khac nhau) -> rate_limited va nha lai cho IP`, async () => {
    for (let i = 0; i < SIGNUP_EMAIL_LIMIT; i++) {
      expect((await requestSignup(signup, auth, input({ ip: `203.0.113.${10 + i}` }), NOW)).status).toBe('accepted');
    }
    await __signupQueueIdleForTest();
    vi.clearAllMocks();
    expect(await requestSignup(signup, auth, input({ ip: '203.0.113.99' }), NOW)).toEqual({ status: 'rate_limited' });
    expect(logActivity).not.toHaveBeenCalled();
    const since = new Date(NOW.getTime() - SIGNUP_WINDOW_MS).toISOString();
    expect(await auth.countThrottle('signup_ip', '203.0.113.99', since)).toBe(0);
  });

  it("IP rong gom vao khoa 'unknown' va van bi gioi han", async () => {
    for (let i = 0; i < SIGNUP_IP_LIMIT; i++) await requestSignup(signup, auth, input({ ip: '', email: `u${i}@daidung.vn` }), NOW);
    expect(await requestSignup(signup, auth, input({ ip: '  ', email: 'them@daidung.vn' }), NOW)).toEqual({ status: 'rate_limited' });
  });
});
