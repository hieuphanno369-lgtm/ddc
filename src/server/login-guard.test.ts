import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAuthStore, type MemoryAccountSource } from './repo/mock-repo-auth';
import type { AuthAccountState, AuthStore, UserAccount } from './repo/types';
import { hashPassword } from '@/lib/password';
import * as passwordLib from '@/lib/password';
import { IP_FAIL_LIMIT } from '@/lib/login-policy';

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

describe('checkCredentials - L1: nhanh da khoa cung chay bcrypt gia (timing oracle)', () => {
  it('so lan goi verifyPassword giua nhanh "da khoa" va nhanh "email la" phai bang nhau (deu > 0)', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < 5; i++) {
      await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(i * 1000));
    }
    const locked = await store.getAccountState('a@daidung.com.vn');
    expect(locked?.lockedAt).not.toBeNull(); // xac nhan da khoa truoc khi do

    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockClear();
    await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'bat-ky', ip: '' }, at(6000));
    const lockedCalls = spy.mock.calls.length;

    spy.mockClear();
    await checkCredentials(store, { email: 'email-hoan-toan-la@daidung.com.vn', password: 'bat-ky', ip: '' }, at(7000));
    const unknownCalls = spy.mock.calls.length;

    expect(lockedCalls).toBeGreaterThan(0);
    expect(lockedCalls).toBe(unknownCalls);
  });
});

describe('checkCredentials - L3: xac nhan nguyen tu chong TOCTOU khi doan mat khau song song', () => {
  it('store bao da khoa (resetFailedLogin tra false) tai thoi diem xac nhan -> khong duoc coi la dang nhap thanh cong, du ban chup account doc truoc do chua khoa', async () => {
    // Mo phong co kiem soat dung "ban chup cu": store tra ve account CHUA khoa luc doc (buoc 1),
    // nhung "vua bi 1 yeu cau sai khac khoa xong" ngay truoc khi ham nay xac nhan nguyen tu (buoc
    // cuoi) - dung dung tinh huong bao-mat.md mo ta (khong dua vao suy doan thu tu Promise.all,
    // ep thang canh tranh de test on dinh, khong chap chon).
    const accountSnapshot: AuthAccountState = {
      email: 'a@daidung.com.vn',
      name: 'A',
      passwordHash: hashPassword(REAL_PW),
      role: 'viewer',
      canViewFinance: false,
      isActive: true,
      failedLoginCount: 0,
      lockedAt: null, // ban chup CU: chua khoa luc doc
      passwordChangedAt: null,
    };
    const resetFailedLogin = vi.fn().mockResolvedValue(false);
    const store: AuthStore = {
      async getAccountState() {
        return accountSnapshot;
      },
      countThrottle: vi.fn().mockResolvedValue(0),
      recordThrottle: vi.fn().mockResolvedValue(undefined),
      reserveThrottle: vi.fn().mockResolvedValue(1),
      releaseThrottle: vi.fn().mockResolvedValue(undefined),
      resetFailedLogin,
      registerFailedLogin: vi.fn(),
      unlockAccount: vi.fn(),
      setPassword: vi.fn(),
      replaceResetToken: vi.fn(),
      peekResetToken: vi.fn(),
      consumeResetToken: vi.fn(),
      pruneAuthData: vi.fn(),
    };

    const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: '' }, at(0));

    expect(resetFailedLogin).toHaveBeenCalledTimes(1); // luon xac nhan, khong bo qua vi ban chup cu
    expect(r).toEqual({ ok: false, reason: 'locked' }); // KHONG duoc tra ok:true
  });

  it('thuc te tren kho bo nho (Promise.all): N sai dong thoi khong lam mat lan tang bo dem nao (khong ket qua bi de len nhau)', async () => {
    // Best-effort voi concurrency THAT cua JS (khong ep thu tu) - kiem bat bien chung: khoa dung 1
    // lan, khong mat cap nhat nao (lost update) khi N yeu cau sai chay dong thoi.
    const store = createMemoryAuthStore(makeSource([account()]));
    const N = 10;
    const calls = Array.from({ length: N }, () =>
      checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(0)),
    );
    await Promise.all(calls);

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(N); // khong mat cap nhat nao du chay dong thoi
    expect(state?.lockedAt).not.toBeNull(); // da vuot LOGIN_LOCK_THRESHOLD (5) nen phai khoa
  });
});

describe('checkCredentials - tai khoan chi Google hoac bi tat', () => {
  it('R1 (vong sua bao mat 2): chi Google (passwordHash rong) sai nhieu lan -> giong het nhanh email la (4 lan invalid, tu lan 5 locked), KHONG tang bo dem tai khoan, KHONG dat lockedAt', async () => {
    const store = createMemoryAuthStore(makeSource([account({ passwordHash: '' })]));
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    for (let i = 0; i < 4; i++) {
      const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'bat-ky', ip: '' }, at(i * 1000));
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    for (let i = 4; i < 10; i++) {
      const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'bat-ky', ip: '' }, at(i * 1000));
      expect(r).toEqual({ ok: false, reason: 'locked' });
    }
    expect(spy).toHaveBeenCalled(); // van chay bcrypt gia, khong lo timing tai khoan chi Google
    const state = await store.getAccountState('a@daidung.com.vn');
    // Khong anh huong dang nhap Google that: KHONG tang bo dem tai khoan, KHONG dat lockedAt.
    expect(state?.failedLoginCount).toBe(0);
    expect(state?.lockedAt).toBeNull();
  });

  it('R1: bang so reason qua 6 lan sai cua 3 loai email (la, chi Google, that sai mat khau) phai GIONG HET nhau', async () => {
    const cases = [
      { label: 'email la', store: createMemoryAuthStore(makeSource([])), email: 'r1-la@daidung.com.vn' },
      {
        label: 'chi Google',
        store: createMemoryAuthStore(makeSource([account({ email: 'r1-google@daidung.com.vn', passwordHash: '' })])),
        email: 'r1-google@daidung.com.vn',
      },
      {
        label: 'tai khoan that (sai mat khau)',
        store: createMemoryAuthStore(makeSource([account({ email: 'r1-that@daidung.com.vn' })])),
        email: 'r1-that@daidung.com.vn',
      },
    ];

    const table: (string | boolean)[][] = [];
    for (const { store, email } of cases) {
      const reasons: (string | boolean)[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await checkCredentials(store, { email, password: 'chac-chan-sai', ip: '' }, at(i * 1000));
        reasons.push(r.ok ? true : r.reason);
      }
      table.push(reasons);
    }

    expect(table[0]).toEqual(['invalid', 'invalid', 'invalid', 'invalid', 'locked', 'locked']);
    expect(table[1]).toEqual(table[0]);
    expect(table[2]).toEqual(table[0]);
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

  it("R3: ip = '' gom vao khoa 'unknown', VAN bi gioi han nhu 1 IP that (khong con fail-open)", async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < IP_FAIL_LIMIT; i++) {
      const r = await checkCredentials(store, { email: `khac-${i}@daidung.com.vn`, password: 'sai', ip: '' }, at(i * 100));
      expect(r.ok === false && r.reason).not.toBe('ip_limited');
    }
    const r = await checkCredentials(
      store,
      { email: 'mot-email-khac@daidung.com.vn', password: 'sai', ip: '' },
      at(IP_FAIL_LIMIT * 100),
    );
    expect(r).toEqual({ ok: false, reason: 'ip_limited' });
  });

  it('R2: Promise.all 30 request sai dong thoi tu 1 IP -> so lan goi bcrypt <= IP_FAIL_LIMIT, phan con lai ip_limited', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockClear();
    const IP = '7.7.7.7';
    const calls = Array.from({ length: 30 }, (_, i) =>
      checkCredentials(store, { email: `r2-${i}@daidung.com.vn`, password: 'sai', ip: IP }, at(0)),
    );
    const results = await Promise.all(calls);

    expect(spy.mock.calls.length).toBeLessThanOrEqual(IP_FAIL_LIMIT);
    const limited = results.filter((r) => !r.ok && r.reason === 'ip_limited').length;
    expect(limited).toBe(30 - IP_FAIL_LIMIT);
  });

  it('N4 (vong sua bao mat 3): dang nhap DUNG xen ke KHONG lam giam so lan sai da dem theo IP', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const IP = '3.3.3.3';
    let t = 0;

    for (let i = 0; i < 19; i++) {
      const r = await checkCredentials(store, { email: `n4-sai-${i}@daidung.com.vn`, password: 'sai', ip: IP }, at(t));
      expect(r).toEqual({ ok: false, reason: 'invalid' });
      t += 100;
    }

    // 5 lan dung xen giua - reserve IP roi nha lai ngay (khong tinh vao gioi han IP).
    for (let i = 0; i < 5; i++) {
      const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: IP }, at(t));
      expect(r.ok).toBe(true);
      t += 100;
    }

    const r20 = await checkCredentials(store, { email: 'n4-sai-19@daidung.com.vn', password: 'sai', ip: IP }, at(t));
    expect(r20).toEqual({ ok: false, reason: 'invalid' }); // lan sai thu 20 theo IP, van con cho
    t += 100;

    const r21 = await checkCredentials(store, { email: 'n4-sai-20@daidung.com.vn', password: 'sai', ip: IP }, at(t));
    expect(r21).toEqual({ ok: false, reason: 'ip_limited' }); // het cho ngay sau do

    expect(await store.countThrottle('login_fail_ip', IP, '2000-01-01T00:00:00.000Z')).toBe(20);
  });
});

describe('checkCredentials - G2 (vong sua bao mat 3): chuan hoa email truoc khi lam khoa throttle', () => {
  it('email hoa/thuong + khoang trang khac nhau van dung CHUNG 1 khoa throttle login_fail_unknown_email', async () => {
    const store = createMemoryAuthStore(makeSource([]));
    await checkCredentials(store, { email: '  La@Daidung.com.vn  ', password: 'x', ip: '' }, at(0));
    await checkCredentials(store, { email: 'la@daidung.com.vn', password: 'x', ip: '' }, at(1000));
    await checkCredentials(store, { email: 'LA@DAIDUNG.COM.VN', password: 'x', ip: '' }, at(2000));

    const count = await store.countThrottle('login_fail_unknown_email', 'la@daidung.com.vn', '2000-01-01T00:00:00.000Z');
    expect(count).toBe(3); // ca 3 bien the deu quy ve cung 1 khoa da chuan hoa
  });
});
