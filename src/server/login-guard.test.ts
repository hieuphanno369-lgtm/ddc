import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAuthStore, type MemoryAccountSource } from './repo/mock-repo-auth';
import type { UserAccount } from './repo/types';
import { hashPassword } from '@/lib/password';
import * as passwordLib from '@/lib/password';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

import { logActivity } from '@/lib/activity';
import { checkCredentials } from './login-guard';

const REAL_PW = 'MatKhauDung1';

function makeSource(accounts: UserAccount[]): MemoryAccountSource {
  return {
    findAccount: (email) => accounts.find((a) => a.email === email.toLowerCase()),
    changePassword: (email, hash) => {
      const a = accounts.find((x) => x.email === email.toLowerCase());
      if (a) a.passwordHash = hash;
    },
  };
}

function account(over: Partial<UserAccount> = {}): UserAccount {
  return {
    email: 'a@daidung.com.vn',
    name: 'A',
    passwordHash: hashPassword(REAL_PW),
    role: 'viewer',
    canViewFinance: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    ...over,
  };
}

const T0 = new Date('2026-09-27T00:00:00.000Z');
const at = (msFromT0: number) => new Date(T0.getTime() + msFromT0);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkCredentials - khoa tai khoan sau 5 lan sai', () => {
  it('4 lan sai -> invalid, lan 5 -> locked, logActivity goi dung 1 lan voi login_locked', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < 4; i++) {
      const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(i * 1000));
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(logActivity).not.toHaveBeenCalled();

    const r5 = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(4000));
    expect(r5).toEqual({ ok: false, reason: 'locked' });
    expect(logActivity).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@daidung.com.vn' }), 'login_locked', '5');

    // Da khoa + mat khau dung -> van locked, khong noi mat khau dung/sai.
    const r6 = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: '' }, at(5000));
    expect(r6).toEqual({ ok: false, reason: 'locked' });
    expect(logActivity).toHaveBeenCalledTimes(1);
  });

  it('dung sau 3 lan sai -> ok, failedLoginCount ve 0', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < 3; i++) {
      await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(i * 1000));
    }
    const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: '' }, at(3000));
    expect(r.ok).toBe(true);

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(0);
  });

  it('tao guard moi tren CUNG kho (gia lap khoi dong lai) -> bo dem con nguyen', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(0));
    await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(1000));

    // "guard moi" = goi checkCredentials lan nua tren CUNG doi tuong store (khong tao AuthStore moi).
    const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(2000));
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(3);
  });
});

describe('checkCredentials - email la (K6)', () => {
  it('spy verifyPassword duoc goi; 5 lan -> locked; sau 24h + 1ms -> invalid', async () => {
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    const store = createMemoryAuthStore(makeSource([]));
    for (let i = 0; i < 4; i++) {
      const r = await checkCredentials(store, { email: 'la@daidung.com.vn', password: 'x', ip: '' }, at(i * 1000));
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(spy).toHaveBeenCalled();

    const r5 = await checkCredentials(store, { email: 'la@daidung.com.vn', password: 'x', ip: '' }, at(4000));
    expect(r5).toEqual({ ok: false, reason: 'locked' });

    // Moc kiem tra phai cach lan sai GAN NHAT (4000ms) hon 24h de toan bo 5 lan sai truoc
    // (0..4000ms) roi khoi cua so truot 24h - dung "sau 24 gio" tinh tu lan sai cuoi, khong phai T0.
    const after24h = at(4000 + 24 * 3_600_000 + 1);
    const r6 = await checkCredentials(store, { email: 'la@daidung.com.vn', password: 'x', ip: '' }, after24h);
    expect(r6).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('checkCredentials - tai khoan chi Google hoac bi tat', () => {
  it('chi Google (passwordHash rong) nhap mat khau -> invalid, bo dem tang', async () => {
    const store = createMemoryAuthStore(makeSource([account({ passwordHash: '' })]));
    const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'bat-ky', ip: '' }, at(0));
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(1);
  });

  it('isActive=false nhap dung mat khau -> invalid, bo dem tang', async () => {
    const store = createMemoryAuthStore(makeSource([account({ isActive: false })]));
    const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: '' }, at(0));
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(1);
  });
});

describe('checkCredentials - gioi han theo IP', () => {
  it('20 lan sai tu 1 IP (nhieu email khac nhau) -> lan 21 ip_limited ke ca mat khau dung; sau 15 phut + 1ms -> binh thuong', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const IP = '1.2.3.4';
    for (let i = 0; i < 20; i++) {
      await checkCredentials(store, { email: `khac-${i}@daidung.com.vn`, password: 'sai', ip: IP }, at(i * 100));
    }

    const r21 = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: IP }, at(2100));
    expect(r21).toEqual({ ok: false, reason: 'ip_limited' });

    const after15m = at(15 * 60_000 + 1);
    const r22 = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: IP }, after15m);
    expect(r22.ok).toBe(true);
  });

  it("ip = '' -> khong bao gio ip_limited", async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < 30; i++) {
      const r = await checkCredentials(store, { email: `khac-${i}@daidung.com.vn`, password: 'sai', ip: '' }, at(i * 100));
      expect(r.ok === false && r.reason).not.toBe('ip_limited');
    }
  });
});
