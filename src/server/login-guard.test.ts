import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAuthStore, type MemoryAccountSource } from './repo/mock-repo-auth';
import type { AuthAccountState, AuthStore, UserAccount } from './repo/types';
import { hashPassword } from '@/lib/password';
import * as passwordLib from '@/lib/password';
import { IP_FAIL_LIMIT, LOGIN_LOCK_THRESHOLD } from '@/lib/login-policy';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

import { logActivity } from '@/lib/activity';
import { checkCredentials } from './login-guard';

const REAL_PW = 'MatKhauDung1';
// S-1 (bao-mat.md vong 4) - `hashPassword` gio bat dong bo; tinh 1 lan truoc (beforeAll) roi dung
// lai gia tri, thay vi goi truc tiep (dong bo) trong `account()`.
let REAL_HASH = '';

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
    passwordHash: REAL_HASH,
    role: 'viewer',
    canViewFinance: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    lockedAt: null,
    ...over,
  };
}

const T0 = new Date('2026-09-27T00:00:00.000Z');
const at = (msFromT0: number) => new Date(T0.getTime() + msFromT0);

beforeAll(async () => {
  REAL_HASH = await hashPassword(REAL_PW);
});

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

describe('checkCredentials - S-3 (bao-mat.md vong 4): can bang so luot goi DB giua nhanh "da khoa" va "email la"', () => {
  it('nhanh tai khoan that dang khoa va nhanh email la goi recordThrottle/countThrottle so lan BANG NHAU', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < 5; i++) {
      await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(i * 1000));
    }
    const locked = await store.getAccountState('a@daidung.com.vn');
    expect(locked?.lockedAt).not.toBeNull(); // xac nhan da khoa truoc khi do

    const recordSpy = vi.spyOn(store, 'recordThrottle');
    const countSpy = vi.spyOn(store, 'countThrottle');

    await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'bat-ky', ip: '' }, at(6000));
    const lockedRecord = recordSpy.mock.calls.length;
    const lockedCount = countSpy.mock.calls.length;

    recordSpy.mockClear();
    countSpy.mockClear();

    await checkCredentials(store, { email: 'email-hoan-toan-la-2@daidung.com.vn', password: 'bat-ky', ip: '' }, at(7000));
    const unknownRecord = recordSpy.mock.calls.length;
    const unknownCount = countSpy.mock.calls.length;

    expect(lockedRecord).toBeGreaterThan(0);
    expect(lockedRecord).toBe(unknownRecord);
    expect(lockedCount).toBeGreaterThan(0);
    expect(lockedCount).toBe(unknownCount);
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
      passwordHash: REAL_HASH,
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
      setPasswordIfHash: vi.fn(),
      revokeSessions: vi.fn(),
      reserveAccountGuess: vi.fn().mockResolvedValue(1),
      replaceResetToken: vi.fn(),
      peekResetToken: vi.fn(),
      consumeResetToken: vi.fn(),
      pruneAuthData: vi.fn(),
    };

    const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: REAL_PW, ip: '' }, at(0));

    expect(resetFailedLogin).toHaveBeenCalledTimes(1); // luon xac nhan, khong bo qua vi ban chup cu
    expect(r).toEqual({ ok: false, reason: 'locked' }); // KHONG duoc tra ok:true
  });

  it('R4-2 (bao-mat.md vong 4, Thap) - Promise.all N sai dong thoi: khoa DUNG 1 lan tai count = LOGIN_LOCK_THRESHOLD, khong mat cap nhat nao trong PHAM VI da duoc chap nhan bcrypt', async () => {
    // Truoc R4-2: N=10 sai dong thoi deu doc duoc failedLoginCount CU (chua ai kip ghi) nen deu lot
    // qua kiem lockedAt va deu chay bcrypt that (failedLoginCount cuoi cung = N = 10). Tu R4-2, "dat
    // cho" nguyen tu theo tai khoan TRUOC bcrypt gioi han so luot CHAY DONG THOI khong vuot so luot
    // con lai truoc nguong (5) - cac luot vuot cho bi tu choi NGAY, KHONG chay bcrypt, KHONG tang bo
    // dem (xem test spy verifyPassword <= 5 lan o duoi). Bo dem cuoi cung phai DUNG BANG nguong khoa,
    // khong hon khong kem (khong mat cap nhat trong so cac luot DA duoc chap nhan).
    const store = createMemoryAuthStore(makeSource([account()]));
    const N = 10;
    const calls = Array.from({ length: N }, () =>
      checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(0)),
    );
    await Promise.all(calls);

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(LOGIN_LOCK_THRESHOLD);
    expect(state?.lockedAt).not.toBeNull();
  });

  it('R4-2 - Promise.all 10 luot sai dong thoi (verifyPassword co do tre that cua bcrypt) -> verifyPassword voi HASH THAT (khong tinh luot bcrypt gia cua R5-3) goi <= LOGIN_LOCK_THRESHOLD lan', async () => {
    // R5-3 (bao-mat.md vong 5) - tu vong 5, nhanh het cho (accountReserved === null) CUNG chay 1 luot
    // bcrypt GIA (qua respondAccountLocked, dummyHash) de can bang thoi gian voi nhanh da khoa that -
    // spy.mock.calls.length tho se LON HON LOGIN_LOCK_THRESHOLD (moi luot bi tu choi cung goi bcrypt
    // gia rieng) - can loc dung cac loi goi voi HASH THAT cua tai khoan (khong phai dummyHash) de kiem
    // dung bat bien cua R5-1 ("khong qua 5 luot bcrypt THAT").
    const store = createMemoryAuthStore(makeSource([account()]));
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockClear();
    const N = 10;
    const calls = Array.from({ length: N }, () =>
      checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(0)),
    );
    await Promise.all(calls);

    const realCalls = spy.mock.calls.filter(([, hash]) => hash === REAL_HASH);
    expect(realCalls.length).toBeLessThanOrEqual(LOGIN_LOCK_THRESHOLD);
  });
});

describe('checkCredentials - R5-1 (bao-mat.md vong 5, Thap): chi rut cho SAU registerFailedLogin/resetFailedLogin, khong rut som nhu vong 4', () => {
  it('ca A: registerFailedLogin cua request dau tien con dang TREO (chua tra ve) -> request thu 6 (chay sau) KHONG duoc goi verifyPassword voi HASH THAT (con tinh 1 cho dang giu cua request dau)', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    let registerCallCount = 0;
    let releaseFirstRegister: (() => void) | undefined;
    const realRegister = store.registerFailedLogin.bind(store);
    vi.spyOn(store, 'registerFailedLogin').mockImplementation(async (email, threshold, nowIso) => {
      registerCallCount++;
      if (registerCallCount === 1) {
        // R1: treo o day - mo phong registerFailedLogin cham (vd DB tam cham) - CHUA tra ve, nen
        // reserveAccountGuess cua R1 (giu trong try/finally) CHUA duoc rut.
        await new Promise<void>((resolve) => {
          releaseFirstRegister = resolve;
        });
      }
      return realRegister(email, threshold, nowIso);
    });

    // R1: bat dau, se treo o buoc registerFailedLogin (chua tra ve checkCredentials).
    const p1 = checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(0));
    await vi.waitFor(() => {
      if (registerCallCount < 1) throw new Error('R1 chua toi registerFailedLogin');
    });

    // R2..R5 (4 luot nua) chay TRON tung cai mot - dua failedLoginCount len 4 (R1 van dang treo,
    // CHUA tinh vao failedLoginCount, nhung van con GIU 1 cho o reserveAccountGuess).
    for (let i = 0; i < 4; i++) {
      const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(i * 1000 + 1));
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    expect((await store.getAccountState('a@daidung.com.vn'))?.failedLoginCount).toBe(4);

    // R6: cho cua R1 (dang treo, CHUA rut) + failedLoginCount=4 = 5 >= threshold(5) -> KHONG duoc
    // reserveAccountGuess, di qua nhanh "het cho" (bcrypt GIA qua R5-3), KHONG goi bcrypt THAT.
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockClear();
    const r6 = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(6000));
    expect(r6).toEqual({ ok: false, reason: 'locked' });
    const realCalls = spy.mock.calls.filter(([, hash]) => hash === REAL_HASH);
    expect(realCalls).toHaveLength(0);

    // Don dep: tha R1 chay not (khong con anh huong ket qua da kiem o tren).
    releaseFirstRegister?.();
    await p1;
  });

  it('ca B: 1 "ke giu cho" dang treo GIUA LUC kiem mat khau (chua goi xong verifyPassword) -> chi CON 4 luot khac (khong phai 5) duoc chay bcrypt THAT, tong khong vuot 5', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const realVerify = passwordLib.verifyPassword;
    let verifyCallCount = 0;
    let releaseHeld: (() => void) | undefined;
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockImplementationOnce(async (raw: string, hash: string) => {
      verifyCallCount++;
      // Ke giu cho: da giu duoc 1 cho (reserveAccountGuess xong), nhung dang TREO giua luc kiem mat
      // khau - chua goi xong verifyPassword nen chua toi registerFailedLogin, cho VAN con giu.
      await new Promise<void>((resolve) => {
        releaseHeld = resolve;
      });
      return realVerify(raw, hash);
    });

    const pHeld = checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(0));
    await vi.waitFor(() => {
      if (verifyCallCount < 1) throw new Error('ke giu cho chua toi buoc verify');
    });

    // 4 luot tiep theo chay TRON (khong phai 5, vi ke giu cho da chiem 1 trong 5 cho).
    for (let i = 0; i < 4; i++) {
      const r = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(i * 1000 + 1));
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    expect((await store.getAccountState('a@daidung.com.vn'))?.failedLoginCount).toBe(4);

    // Luot tiep theo (thu 5 trong so cac luot BINH THUONG, nhung la luot thu 6 neu tinh ca ke giu
    // cho) phai bi tu choi TRUOC bcrypt that: 1 (ke giu cho) + 4 (da ghi) = 5 >= threshold.
    const r5 = await checkCredentials(store, { email: 'a@daidung.com.vn', password: 'sai', ip: '' }, at(5000));
    expect(r5).toEqual({ ok: false, reason: 'locked' });

    // Tong so luot bcrypt THAT (hash that): 1 (ke giu cho, dang treo) + 4 (da chay tron) = 5, KHONG
    // vuot LOGIN_LOCK_THRESHOLD - dung bat bien cua R5-1.
    const realCallsSoFar = spy.mock.calls.filter(([, hash]) => hash === REAL_HASH);
    expect(realCallsSoFar).toHaveLength(5);

    // Don dep: tha ke giu cho, cho no chay not (khoa tai khoan o lan sai thu 5 - lan cua chinh no).
    releaseHeld?.();
    const heldResult = await pHeld;
    expect(heldResult).toEqual({ ok: false, reason: 'locked' });
    expect((await store.getAccountState('a@daidung.com.vn'))?.failedLoginCount).toBe(5);
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
