import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryAuthStore, type MemoryAccountSource } from './mock-repo-auth';
import type { UserAccount } from './types';

function makeSource(accounts: UserAccount[]): MemoryAccountSource {
  return {
    findAccount(email) {
      return accounts.find((a) => a.email === email.toLowerCase());
    },
    changePassword(email, passwordHash) {
      const a = accounts.find((x) => x.email === email.toLowerCase());
      if (a) a.passwordHash = passwordHash;
    },
  };
}

const BASE: UserAccount = {
  email: 'a@daidung.com.vn',
  name: 'A',
  passwordHash: 'hash-cu',
  role: 'viewer',
  canViewFinance: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

let accounts: UserAccount[];
let store: ReturnType<typeof createMemoryAuthStore>;

beforeEach(() => {
  accounts = [{ ...BASE }];
  store = createMemoryAuthStore(makeSource(accounts));
});

describe('registerFailedLogin', () => {
  it('khoa dung o lan sai thu 5, justLocked chi 1 lan', async () => {
    for (let i = 1; i <= 4; i++) {
      const r = await store.registerFailedLogin('a@daidung.com.vn', 5, `2026-09-27T00:0${i}:00.000Z`);
      expect(r).toEqual({ count: i, locked: false, justLocked: false });
    }
    const r5 = await store.registerFailedLogin('a@daidung.com.vn', 5, '2026-09-27T00:05:00.000Z');
    expect(r5).toEqual({ count: 5, locked: true, justLocked: true });

    const r6 = await store.registerFailedLogin('a@daidung.com.vn', 5, '2026-09-27T00:06:00.000Z');
    expect(r6).toEqual({ count: 6, locked: true, justLocked: false });
  });

  it('khong co tai khoan -> null', async () => {
    expect(await store.registerFailedLogin('khong-co@daidung.com.vn', 5, '2026-09-27T00:00:00.000Z')).toBeNull();
  });
});

describe('resetFailedLogin / unlockAccount', () => {
  it('resetFailedLogin dua bo dem ve 0, khong dung lockedAt', async () => {
    await store.registerFailedLogin('a@daidung.com.vn', 5, '2026-09-27T00:01:00.000Z');
    await store.resetFailedLogin('a@daidung.com.vn');
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(0);
  });

  it('unlockAccount xoa khoa + bo dem; false neu khong co tai khoan', async () => {
    for (let i = 1; i <= 5; i++) await store.registerFailedLogin('a@daidung.com.vn', 5, `2026-09-27T00:0${i}:00.000Z`);
    expect(await store.unlockAccount('a@daidung.com.vn')).toBe(true);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state).toEqual(expect.objectContaining({ failedLoginCount: 0, lockedAt: null }));
    expect(await store.unlockAccount('khong-co@daidung.com.vn')).toBe(false);
  });
});

describe('countThrottle theo cua so', () => {
  it('chi dem ban ghi tu sinceIso tro di', async () => {
    await store.recordThrottle('login_fail_ip', '1.2.3.4', '2026-09-27T00:00:00.000Z');
    await store.recordThrottle('login_fail_ip', '1.2.3.4', '2026-09-27T00:10:00.000Z');
    await store.recordThrottle('login_fail_ip', '1.2.3.4', '2026-09-27T00:20:00.000Z');

    expect(await store.countThrottle('login_fail_ip', '1.2.3.4', '2026-09-27T00:05:00.000Z')).toBe(2);
    expect(await store.countThrottle('login_fail_ip', '1.2.3.4', '2026-09-27T00:00:00.000Z')).toBe(3);
    expect(await store.countThrottle('login_fail_ip', '9.9.9.9', '2026-09-27T00:00:00.000Z')).toBe(0);
  });
});

describe('replaceResetToken / peekResetToken / consumeResetToken', () => {
  it('replaceResetToken xoa token cu cua email do', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-1', '2026-09-27T01:00:00.000Z', '1.2.3.4');
    await store.replaceResetToken('a@daidung.com.vn', 'hash-2', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    expect(await store.peekResetToken('hash-1', '2026-09-27T00:00:00.000Z')).toBe(false);
    expect(await store.peekResetToken('hash-2', '2026-09-27T00:00:00.000Z')).toBe(true);
  });

  it('consumeResetToken dung 2 lan -> lan 2 ok:false', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-x', '2026-09-27T01:00:00.000Z', '1.2.3.4');
    const r1 = await store.consumeResetToken('hash-x', 'hash-moi', '2026-09-27T00:00:00.000Z');
    expect(r1).toEqual({ ok: true, email: 'a@daidung.com.vn', name: 'A', locked: false });

    const r2 = await store.consumeResetToken('hash-x', 'hash-moi-2', '2026-09-27T00:00:00.000Z');
    expect(r2).toEqual({ ok: false });
  });

  it('token het han -> peek false, consume ok:false', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-y', '2026-09-27T01:00:00.000Z', '1.2.3.4');
    const afterExpiry = '2026-09-27T01:00:00.001Z';

    expect(await store.peekResetToken('hash-y', afterExpiry)).toBe(false);
    expect(await store.consumeResetToken('hash-y', 'hash-moi', afterExpiry)).toEqual({ ok: false });
  });

  it('tai khoan dang khoa: consume van ok, giu nguyen khoa + bo dem (K10)', async () => {
    for (let i = 1; i <= 5; i++) await store.registerFailedLogin('a@daidung.com.vn', 5, `2026-09-27T00:0${i}:00.000Z`);
    await store.replaceResetToken('a@daidung.com.vn', 'hash-z', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    const r = await store.consumeResetToken('hash-z', 'hash-moi', '2026-09-27T00:10:00.000Z');
    expect(r).toEqual({ ok: true, email: 'a@daidung.com.vn', name: 'A', locked: true });

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.lockedAt).not.toBeNull();
    expect(state?.failedLoginCount).toBe(5);
  });

  it('bo dem ve 0 sau consume neu tai khoan chua khoa', async () => {
    await store.registerFailedLogin('a@daidung.com.vn', 5, '2026-09-27T00:01:00.000Z');
    await store.replaceResetToken('a@daidung.com.vn', 'hash-w', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    await store.consumeResetToken('hash-w', 'hash-moi', '2026-09-27T00:10:00.000Z');

    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(0);
    expect(state?.lockedAt).toBeNull();
  });
});

describe('pruneAuthData', () => {
  it('xoa throttle cu hon moc, giu ban ghi moi hon', async () => {
    await store.recordThrottle('reset_req_email', 'a@daidung.com.vn', '2026-09-26T00:00:00.000Z');
    await store.recordThrottle('reset_req_email', 'a@daidung.com.vn', '2026-09-27T12:00:00.000Z');

    await store.pruneAuthData('2026-09-27T00:00:00.000Z');

    expect(await store.countThrottle('reset_req_email', 'a@daidung.com.vn', '2026-01-01T00:00:00.000Z')).toBe(1);
  });

  it('xoa reset token da qua moc (createdAt lay theo dong ho that luc goi replaceResetToken)', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-old', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    // Moc o rat xa tuong lai -> chac chan lon hon createdAt that (dong ho he thong luc chay test).
    await store.pruneAuthData('2999-01-01T00:00:00.000Z');

    expect(await store.peekResetToken('hash-old', '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});
