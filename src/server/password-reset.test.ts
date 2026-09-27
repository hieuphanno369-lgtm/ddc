import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/password';
import { RESET_EMAIL_LIMIT, RESET_IP_LIMIT, RESET_TOKEN_TTL_MS } from '@/lib/login-policy';
import { createMemoryAuthStore, type MemoryAccountSource } from './repo/mock-repo-auth';
import type { UserAccount } from './repo/types';
import type { SmtpConfig } from './notify/email';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

import { logActivity } from '@/lib/activity';
import {
  __resetRequestQueueIdleForTest,
  isResetTokenUsable,
  requestPasswordReset,
  resetPasswordWithToken,
  type ResetMailer,
} from './password-reset';

const REAL_PW = 'MatKhauDung1';
const SMTP: SmtpConfig = { host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'a@daidung.com.vn' };
const BASE_URL = 'https://app.example.com/';

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
    email: 'a@daidung.com.vn', name: 'A', passwordHash: hashPassword(REAL_PW), role: 'viewer',
    canViewFinance: false, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null,
    ...over,
  };
}

function makeMailer(smtp: SmtpConfig | null = SMTP) {
  const composed: { locale: string; email: string; link: string }[] = [];
  const queued: { cfg: SmtpConfig; to: string; subject: string; text: string }[] = [];
  const mailer: ResetMailer = {
    async getSmtp() {
      return smtp;
    },
    async compose(locale, email, link) {
      composed.push({ locale, email, link });
      return { subject: 'Dat lai mat khau', text: `Mo link: ${link}` };
    },
    queue(cfg, to, subject, text) {
      queued.push({ cfg, to, subject, text });
    },
  };
  return { mailer, composed, queued };
}

function tokenFromLink(link: string): string {
  const m = link.match(/token=([^&]+)/);
  if (!m) throw new Error('khong tim thay token trong link: ' + link);
  return m[1];
}

const T0 = new Date('2026-09-27T00:00:00.000Z');
const at = (msFromT0: number) => new Date(T0.getTime() + msFromT0);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestPasswordReset - khong lo email ton tai (S3)', () => {
  it('ket qua tra ve giong nhau cho: co tai khoan, email la, chi Google, bi tat, bi gioi han', async () => {
    const store = createMemoryAuthStore(makeSource([
      account({ email: 'binh-thuong@daidung.com.vn' }),
      account({ email: 'google@daidung.com.vn', passwordHash: '' }),
      account({ email: 'tat@daidung.com.vn', isActive: false }),
    ]));
    const { mailer } = makeMailer();
    const input = (email: string) => ({ email, ip: '', locale: 'vi' as const, baseUrl: BASE_URL });

    expect(await requestPasswordReset(store, mailer, input('binh-thuong@daidung.com.vn'), at(0))).toEqual({ status: 'accepted' });
    expect(await requestPasswordReset(store, mailer, input('la@daidung.com.vn'), at(1000))).toEqual({ status: 'accepted' });
    expect(await requestPasswordReset(store, mailer, input('google@daidung.com.vn'), at(2000))).toEqual({ status: 'accepted' });
    expect(await requestPasswordReset(store, mailer, input('tat@daidung.com.vn'), at(3000))).toEqual({ status: 'accepted' });

    // Bi gioi han: goi lai voi cung email binh thuong toi khi vuot RESET_EMAIL_LIMIT.
    let last: Awaited<ReturnType<typeof requestPasswordReset>> | undefined;
    for (let i = 0; i < RESET_EMAIL_LIMIT + 1; i++) {
      last = await requestPasswordReset(store, mailer, input('binh-thuong@daidung.com.vn'), at(4000 + i * 100));
    }
    expect(last).toEqual({ status: 'accepted' });
  });

  it('thieu SMTP hoac thieu baseUrl -> smtp_missing voi moi email, khong ghi throttle', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer: noSmtpMailer } = makeMailer(null);

    expect(await requestPasswordReset(store, noSmtpMailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0)))
      .toEqual({ status: 'smtp_missing' });
    expect(await requestPasswordReset(store, noSmtpMailer, { email: 'khong-ton-tai@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(1000)))
      .toEqual({ status: 'smtp_missing' });

    const { mailer: okMailer } = makeMailer(SMTP);
    expect(await requestPasswordReset(store, okMailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: undefined }, at(2000)))
      .toEqual({ status: 'smtp_missing' });

    expect(await store.countThrottle('reset_req_email', 'a@daidung.com.vn', '2020-01-01T00:00:00.000Z')).toBe(0);
  });

  it('link bat dau bang baseUrl truyen vao, co /vi/dat-lai-mat-khau?token=', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, composed } = makeMailer();

    await requestPasswordReset(store, mailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    await __resetRequestQueueIdleForTest();

    expect(composed).toHaveLength(1);
    expect(composed[0].link).toBe(`https://app.example.com/vi/dat-lai-mat-khau?token=${tokenFromLink(composed[0].link)}`);
  });

  it('expiresAt = now + 30 phut dung tung ms', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const replaceSpy = vi.spyOn(store, 'replaceResetToken');
    const { mailer } = makeMailer();

    await requestPasswordReset(store, mailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    await __resetRequestQueueIdleForTest();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const expiresAtArg = replaceSpy.mock.calls[0][2];
    expect(expiresAtArg).toBe(new Date(at(0).getTime() + RESET_TOKEN_TTL_MS).toISOString());
  });

  it('kho chi chua hash - khong loi goi replaceResetToken/consumeResetToken/peekResetToken nao mang token tho', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const replaceSpy = vi.spyOn(store, 'replaceResetToken');
    const consumeSpy = vi.spyOn(store, 'consumeResetToken');
    const peekSpy = vi.spyOn(store, 'peekResetToken');
    const { mailer, composed } = makeMailer();

    await requestPasswordReset(store, mailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    await __resetRequestQueueIdleForTest();
    const token = tokenFromLink(composed[0].link);
    await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(1000));
    await isResetTokenUsable(store, token, at(0));

    const allArgs = [...replaceSpy.mock.calls, ...consumeSpy.mock.calls, ...peekSpy.mock.calls].flat();
    expect(allArgs).not.toContain(token);
  });

  it('lan xin thu 4 trong 1 gio cung email -> khong gui; email la cung bi dem', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, queued } = makeMailer();
    const input = { email: 'a@daidung.com.vn', ip: '', locale: 'vi' as const, baseUrl: BASE_URL };

    for (let i = 0; i < RESET_EMAIL_LIMIT; i++) {
      await requestPasswordReset(store, mailer, input, at(i * 1000));
    }
    await __resetRequestQueueIdleForTest();
    expect(queued).toHaveLength(RESET_EMAIL_LIMIT);

    await requestPasswordReset(store, mailer, input, at(RESET_EMAIL_LIMIT * 1000));
    await __resetRequestQueueIdleForTest();
    expect(queued).toHaveLength(RESET_EMAIL_LIMIT); // lan thu 4 khong gui them

    // Email la cung bi dem: 4 lan xin cho 1 email khong ton tai deu khong gui (khong co token de gui),
    // nhung throttle van tang - kiem qua countThrottle truc tiep.
    const store2 = createMemoryAuthStore(makeSource([]));
    const { mailer: mailer2 } = makeMailer();
    for (let i = 0; i < RESET_EMAIL_LIMIT + 1; i++) {
      await requestPasswordReset(store2, mailer2, { email: 'la@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(i * 1000));
    }
    const count = await store2.countThrottle('reset_req_email', 'la@daidung.com.vn', '2020-01-01T00:00:00.000Z');
    expect(count).toBe(RESET_EMAIL_LIMIT); // lan vuot gioi han khong recordThrottle them
  });

  it('lan thu 11 cung 1 IP (email khac nhau) -> khong gui', async () => {
    const store = createMemoryAuthStore(makeSource(
      Array.from({ length: RESET_IP_LIMIT + 1 }, (_, i) => account({ email: `e${i}@daidung.com.vn` })),
    ));
    const { mailer, queued } = makeMailer();
    const IP = '9.9.9.9';

    for (let i = 0; i < RESET_IP_LIMIT; i++) {
      await requestPasswordReset(store, mailer, { email: `e${i}@daidung.com.vn`, ip: IP, locale: 'vi', baseUrl: BASE_URL }, at(i * 100));
    }
    await __resetRequestQueueIdleForTest();
    expect(queued).toHaveLength(RESET_IP_LIMIT);

    await requestPasswordReset(store, mailer, { email: `e${RESET_IP_LIMIT}@daidung.com.vn`, ip: IP, locale: 'vi', baseUrl: BASE_URL }, at(RESET_IP_LIMIT * 100));
    await __resetRequestQueueIdleForTest();
    expect(queued).toHaveLength(RESET_IP_LIMIT);
  });

  it('R2: Promise.all 30 yeu cau xin dat lai dong thoi tu 1 IP -> so thu gui KHONG VUOT RESET_IP_LIMIT', async () => {
    const store = createMemoryAuthStore(makeSource(
      Array.from({ length: 30 }, (_, i) => account({ email: `r2-reset-${i}@daidung.com.vn` })),
    ));
    const { mailer, queued } = makeMailer();
    const IP = '6.6.6.6';

    const calls = Array.from({ length: 30 }, (_, i) =>
      requestPasswordReset(store, mailer, { email: `r2-reset-${i}@daidung.com.vn`, ip: IP, locale: 'vi', baseUrl: BASE_URL }, at(0)),
    );
    await Promise.all(calls);
    await __resetRequestQueueIdleForTest();

    expect(queued.length).toBeLessThanOrEqual(RESET_IP_LIMIT);
  });

  it("R3: ip = '' gom vao khoa 'unknown', VAN bi gioi han nhu 1 IP that", async () => {
    const store = createMemoryAuthStore(makeSource(
      Array.from({ length: RESET_IP_LIMIT + 1 }, (_, i) => account({ email: `r3-${i}@daidung.com.vn` })),
    ));
    const { mailer, queued } = makeMailer();

    for (let i = 0; i < RESET_IP_LIMIT; i++) {
      await requestPasswordReset(store, mailer, { email: `r3-${i}@daidung.com.vn`, ip: '', locale: 'vi', baseUrl: BASE_URL }, at(i * 100));
    }
    await __resetRequestQueueIdleForTest();
    expect(queued).toHaveLength(RESET_IP_LIMIT);

    await requestPasswordReset(
      store,
      mailer,
      { email: `r3-${RESET_IP_LIMIT}@daidung.com.vn`, ip: '', locale: 'vi', baseUrl: BASE_URL },
      at(RESET_IP_LIMIT * 100),
    );
    await __resetRequestQueueIdleForTest();
    expect(queued).toHaveLength(RESET_IP_LIMIT); // van bi khoa 'unknown' chan, khong con fail-open
  });

  it('R6: viec dau NEM LOI khong chan viec SAU chay, log khong chua token/email', async () => {
    const store = createMemoryAuthStore(makeSource([
      account({ email: 'r6-loi@daidung.com.vn' }),
      account({ email: 'r6-sau@daidung.com.vn' }),
    ]));
    const { mailer, queued } = makeMailer();
    const realGetAccountState = store.getAccountState.bind(store);
    const spy = vi.spyOn(store, 'getAccountState').mockImplementation(async (email: string) => {
      if (email === 'r6-loi@daidung.com.vn') throw new Error('loi gia lap');
      return realGetAccountState(email);
    });

    await requestPasswordReset(store, mailer, { email: 'r6-loi@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    await requestPasswordReset(store, mailer, { email: 'r6-sau@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(1000));
    await __resetRequestQueueIdleForTest();

    expect(queued.some((q) => q.to === 'r6-sau@daidung.com.vn')).toBe(true);
    const mock = logActivity as unknown as { mock: { calls: unknown[][] } };
    for (const call of mock.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/token=/);
    }
    spy.mockRestore();
  });

  it('R6: viec dau bi TREO (khong bao gio resolve/reject) khong chan viec SAU chay (co timeout)', async () => {
    vi.useFakeTimers();
    try {
      const store = createMemoryAuthStore(makeSource([
        account({ email: 'r6-treo@daidung.com.vn' }),
        account({ email: 'r6-sau2@daidung.com.vn' }),
      ]));
      const { mailer, queued } = makeMailer();
      const realGetAccountState = store.getAccountState.bind(store);
      const spy = vi.spyOn(store, 'getAccountState').mockImplementation(async (email: string) => {
        if (email === 'r6-treo@daidung.com.vn') return new Promise(() => {}); // treo mai mai
        return realGetAccountState(email);
      });

      await requestPasswordReset(store, mailer, { email: 'r6-treo@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
      await requestPasswordReset(store, mailer, { email: 'r6-sau2@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(1000));

      await vi.advanceTimersByTimeAsync(30_000);
      await __resetRequestQueueIdleForTest();

      expect(queued.some((q) => q.to === 'r6-sau2@daidung.com.vn')).toBe(true);
      spy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('khong loi goi logActivity nao co tham so chua token', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, composed } = makeMailer();

    await requestPasswordReset(store, mailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    await __resetRequestQueueIdleForTest();
    const token = tokenFromLink(composed[0].link);
    await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(1000));

    const mock = logActivity as unknown as { mock: { calls: unknown[][] } };
    for (const call of mock.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(token);
    }
  });

  it('L4: vuot gioi han (rate_limited) KHONG ghi activity_log nao them', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer } = makeMailer();
    const input = { email: 'a@daidung.com.vn', ip: '', locale: 'vi' as const, baseUrl: BASE_URL };

    for (let i = 0; i < RESET_EMAIL_LIMIT; i++) await requestPasswordReset(store, mailer, input, at(i * 1000));
    await __resetRequestQueueIdleForTest();
    vi.mocked(logActivity).mockClear();

    for (let i = 0; i < 5; i++) {
      await requestPasswordReset(store, mailer, input, at((RESET_EMAIL_LIMIT + i) * 1000));
    }
    await __resetRequestQueueIdleForTest();

    expect(logActivity).not.toHaveBeenCalled();
  });

  it('L4: nhanh no_account khong luu chuoi email tho do nguoi goi tu nhap', async () => {
    const store = createMemoryAuthStore(makeSource([]));
    const { mailer } = makeMailer();
    const attackerEmail = 'toi-doan-duoc-email-nay@vi-du.com';

    await requestPasswordReset(store, mailer, { email: attackerEmail, ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    await __resetRequestQueueIdleForTest();

    expect(logActivity).toHaveBeenCalledTimes(1);
    const mock = logActivity as unknown as { mock: { calls: unknown[][] } };
    for (const call of mock.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(attackerEmail);
    }
  });

  it('L6: requestPasswordReset() tra ve KHONG CAN CHO xong viec doc tai khoan/soan+gui mail (viec do chay nen)', async () => {
    // Ep 1 "thao tac cham" bang deferred promise (khong dua vao suy doan thu tu microtask cua JS,
    // vi Promise.then() tren 1 promise DA resolve co the chay truoc ca continuation cua await ben
    // ngoai - ep gate that su cham moi chung minh duoc requestPasswordReset() KHONG cho no).
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, composed } = makeMailer();
    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const realGetAccountState = store.getAccountState.bind(store);
    vi.spyOn(store, 'getAccountState').mockImplementation(async (email: string) => {
      await gate; // gia lap truy van cham (vi du DB that) - chua mo cho toi khi test goi openGate()
      return realGetAccountState(email);
    });

    const res = await requestPasswordReset(store, mailer, { email: 'a@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));

    // requestPasswordReset() DA tra ve accepted du "truy van tai khoan" van con dang cho `gate` -
    // chung minh phan hoi khong bi phan viec nen (L6) lam cham.
    expect(res).toEqual({ status: 'accepted' });
    expect(composed).toHaveLength(0);

    openGate();
    await __resetRequestQueueIdleForTest();
    expect(composed).toHaveLength(1);
  });
});

describe('resetPasswordWithToken', () => {
  async function requestAndGetToken(store: ReturnType<typeof createMemoryAuthStore>, email: string, now: Date) {
    const { mailer, composed } = makeMailer();
    await requestPasswordReset(store, mailer, { email, ip: '', locale: 'vi', baseUrl: BASE_URL }, now);
    await __resetRequestQueueIdleForTest();
    return tokenFromLink(composed[0].link);
  }

  it('xin 2 lan -> token lan 1 invalid_token, token lan 2 dung duoc', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const token1 = await requestAndGetToken(store, 'a@daidung.com.vn', at(0));
    const token2 = await requestAndGetToken(store, 'a@daidung.com.vn', at(1000));

    expect(await resetPasswordWithToken(store, { token: token1, newPassword: 'MatKhauMoi1' }, at(2000)))
      .toEqual({ ok: false, error: 'invalid_token' });
    expect(await resetPasswordWithToken(store, { token: token2, newPassword: 'MatKhauMoi1' }, at(3000)))
      .toEqual({ ok: true, locked: false });
  });

  it('dung 2 lan -> lan 2 invalid_token', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const token = await requestAndGetToken(store, 'a@daidung.com.vn', at(0));

    expect(await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(1000))).toEqual({ ok: true, locked: false });
    expect(await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi2' }, at(2000))).toEqual({ ok: false, error: 'invalid_token' });
  });

  it('now + 30 phut + 1ms -> invalid_token', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const token = await requestAndGetToken(store, 'a@daidung.com.vn', at(0));

    const r = await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(RESET_TOKEN_TTL_MS + 1));
    expect(r).toEqual({ ok: false, error: 'invalid_token' });
  });

  it('mat khau 7 ky tu -> too_short, token van dung duoc sau do', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const token = await requestAndGetToken(store, 'a@daidung.com.vn', at(0));

    expect(await resetPasswordWithToken(store, { token, newPassword: '1234567' }, at(1000))).toEqual({ ok: false, error: 'too_short' });
    expect(await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(2000))).toEqual({ ok: true, locked: false });
  });

  it('tai khoan dang khoa: dat lai ok, locked:true, van khoa, bo dem giu nguyen', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 0; i < 5; i++) await store.registerFailedLogin('a@daidung.com.vn', 5, at(i * 10).toISOString());
    const token = await requestAndGetToken(store, 'a@daidung.com.vn', at(1000));

    const r = await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(2000));
    expect(r).toEqual({ ok: true, locked: true });

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.lockedAt).not.toBeNull();
    expect(state?.failedLoginCount).toBe(5);
  });

  it('chua khoa: bo dem ve 0, passwordChangedAt duoc dat', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    await store.registerFailedLogin('a@daidung.com.vn', 5, at(0).toISOString());
    const token = await requestAndGetToken(store, 'a@daidung.com.vn', at(1000));

    await resetPasswordWithToken(store, { token, newPassword: 'MatKhauMoi1' }, at(2000));

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(0);
    expect(state?.passwordChangedAt).toBe(at(2000).toISOString());
  });
});

describe('isResetTokenUsable', () => {
  it('token dung dinh dang + con han -> true; sai dinh dang -> false', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const token = await requestAndGetTokenHelper(store, 'a@daidung.com.vn', at(0));

    expect(await isResetTokenUsable(store, token, at(1000))).toBe(true);
    expect(await isResetTokenUsable(store, 'khong-dung-dinh-dang', at(1000))).toBe(false);
  });
});

async function requestAndGetTokenHelper(store: ReturnType<typeof createMemoryAuthStore>, email: string, now: Date) {
  const { mailer, composed } = makeMailer();
  await requestPasswordReset(store, mailer, { email, ip: '', locale: 'vi', baseUrl: BASE_URL }, now);
  await __resetRequestQueueIdleForTest();
  return tokenFromLink(composed[0].link);
}
