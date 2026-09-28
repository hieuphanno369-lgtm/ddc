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
  lockedAt: null,
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
  it('resetFailedLogin dua bo dem ve 0, khong dung lockedAt, tra true khi thanh cong', async () => {
    await store.registerFailedLogin('a@daidung.com.vn', 5, '2026-09-27T00:01:00.000Z');
    expect(await store.resetFailedLogin('a@daidung.com.vn')).toBe(true);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(0);
  });

  it('L3: tai khoan da bi khoa -> resetFailedLogin tra false, KHONG dua bo dem ve 0 (khong dua vao ban chup cu)', async () => {
    for (let i = 1; i <= 5; i++) await store.registerFailedLogin('a@daidung.com.vn', 5, `2026-09-27T00:0${i}:00.000Z`);
    const ok = await store.resetFailedLogin('a@daidung.com.vn');
    expect(ok).toBe(false);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.failedLoginCount).toBe(5);
    expect(state?.lockedAt).not.toBeNull();
  });

  it('khong co tai khoan -> resetFailedLogin tra false', async () => {
    expect(await store.resetFailedLogin('khong-co@daidung.com.vn')).toBe(false);
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

  it('L5: tai khoan bi TAT sau khi cap token (truoc khi tieu) -> consume ok:false, giong peek', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-tat', '2026-09-27T01:00:00.000Z', '1.2.3.4');
    accounts[0].isActive = false; // admin tat tai khoan sau khi token da cap

    expect(await store.peekResetToken('hash-tat', '2026-09-27T00:00:00.000Z')).toBe(false);
    expect(await store.consumeResetToken('hash-tat', 'hash-moi', '2026-09-27T00:00:00.000Z')).toEqual({ ok: false });
  });

  it('L5: tai khoan chuyen sang CHI GOOGLE (passwordHash rong) sau khi cap token -> consume ok:false', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-goog', '2026-09-27T01:00:00.000Z', '1.2.3.4');
    accounts[0].passwordHash = ''; // admin xoa mat khau, chuyen thanh tai khoan chi Google

    expect(await store.peekResetToken('hash-goog', '2026-09-27T00:00:00.000Z')).toBe(false);
    expect(await store.consumeResetToken('hash-goog', 'hash-moi', '2026-09-27T00:00:00.000Z')).toEqual({ ok: false });
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

describe('setPassword - S-2 (bao-mat.md vong 4) huy token dat lai con han cua email do', () => {
  it('bumpChangedAt = true: doi mat khau xong, token dat lai con han cua email do het dung duoc (peek -> false)', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-con-han', '2026-09-27T02:00:00.000Z', '1.2.3.4');
    expect(await store.peekResetToken('hash-con-han', '2026-09-27T00:00:00.000Z')).toBe(true);

    await store.setPassword('a@daidung.com.vn', 'hash-moi', true, '2026-09-27T00:30:00.000Z');

    expect(await store.peekResetToken('hash-con-han', '2026-09-27T00:00:00.000Z')).toBe(false);
  });

  it('bumpChangedAt = false: van huy token dat lai con han (mat khau da doi qua duong khac thi link cu khong con ly do dung duoc)', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-con-han-2', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    await store.setPassword('a@daidung.com.vn', 'hash-moi', false, '2026-09-27T00:30:00.000Z');

    expect(await store.peekResetToken('hash-con-han-2', '2026-09-27T00:00:00.000Z')).toBe(false);
  });

  it('token cua email KHAC khong bi dung theo', async () => {
    accounts.push({ ...BASE, email: 'khac@daidung.com.vn' });
    await store.replaceResetToken('a@daidung.com.vn', 'hash-a', '2026-09-27T02:00:00.000Z', '1.2.3.4');
    await store.replaceResetToken('khac@daidung.com.vn', 'hash-khac', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    await store.setPassword('a@daidung.com.vn', 'hash-moi', true, '2026-09-27T00:30:00.000Z');

    expect(await store.peekResetToken('hash-a', '2026-09-27T00:00:00.000Z')).toBe(false);
    expect(await store.peekResetToken('hash-khac', '2026-09-27T00:00:00.000Z')).toBe(true);
  });
});

describe('setPasswordIfHash - R3-1 (bao-mat.md vong 3, Trung) compare-and-swap', () => {
  it('oldHash khop passwordHash hien tai -> ghi thanh cong, tra true, bump passwordChangedAt', async () => {
    const ok = await store.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', '2026-09-28T00:30:00.000Z');

    expect(ok).toBe(true);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.passwordHash).toBe('hash-moi');
    expect(state?.passwordChangedAt).toBe('2026-09-28T00:30:00.000Z');
  });

  it('oldHash KHONG khop (bi ghi de xen giua) -> tra false, KHONG doi mat khau, KHONG bump passwordChangedAt', async () => {
    const ok = await store.setPasswordIfHash('a@daidung.com.vn', 'hash-sai', 'hash-moi', '2026-09-28T00:30:00.000Z');

    expect(ok).toBe(false);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.passwordHash).toBe('hash-cu');
    expect(state?.passwordChangedAt).toBeNull();
  });

  it('ghi thanh cong -> CUNG huy token dat lai con han cua email do (giong setPassword, S-2)', async () => {
    await store.replaceResetToken('a@daidung.com.vn', 'hash-token-con-han', '2026-09-27T02:00:00.000Z', '1.2.3.4');

    await store.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', '2026-09-28T00:30:00.000Z');

    expect(await store.peekResetToken('hash-token-con-han', '2026-09-27T00:00:00.000Z')).toBe(false);
  });

  it('khong co tai khoan -> tra false', async () => {
    const ok = await store.setPasswordIfHash('khong-co@daidung.com.vn', 'x', 'y', '2026-09-28T00:30:00.000Z');
    expect(ok).toBe(false);
  });

  it('R4-4 (bao-mat.md vong 4, Thap) - tai khoan da bi TAT (isActive=false) -> tra false, KHONG doi mat khau', async () => {
    accounts[0].isActive = false;
    const ok = await store.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', '2026-09-28T00:30:00.000Z');
    expect(ok).toBe(false);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.passwordHash).toBe('hash-cu');
  });

  it('R4-4 - tai khoan dang bi KHOA (lockedAt khac null) -> tra false, KHONG doi mat khau', async () => {
    for (let i = 1; i <= 5; i++) await store.registerFailedLogin('a@daidung.com.vn', 5, `2026-09-27T00:0${i}:00.000Z`);
    const ok = await store.setPasswordIfHash('a@daidung.com.vn', 'hash-cu', 'hash-moi', '2026-09-28T00:30:00.000Z');
    expect(ok).toBe(false);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.passwordHash).toBe('hash-cu');
  });
});

describe('revokeSessions - R4-1a (bao-mat.md vong 4, Trung, chot chu du an 2026-09-28)', () => {
  it('bump passwordChangedAt, KHONG doi passwordHash, tra true', async () => {
    const ok = await store.revokeSessions('a@daidung.com.vn', '2026-09-28T01:00:00.000Z');
    expect(ok).toBe(true);
    const state = await store.getAccountState('a@daidung.com.vn');
    expect(state?.passwordChangedAt).toBe('2026-09-28T01:00:00.000Z');
    expect(state?.passwordHash).toBe('hash-cu');
  });

  it('khong co tai khoan -> tra false', async () => {
    const ok = await store.revokeSessions('khong-co@daidung.com.vn', '2026-09-28T01:00:00.000Z');
    expect(ok).toBe(false);
  });
});

describe('reserveThrottle / releaseThrottle (R2 vong 2, N2 vong 3 - tra/nhan id thay vi boolean)', () => {
  it('con cho thi ghi + tra id (number); het cho thi KHONG ghi them + tra null', async () => {
    for (let i = 0; i < 3; i++) {
      const id = await store.reserveThrottle('reset_req_email', 'a@daidung.com.vn', `t${i}`, '2000-01-01T00:00:00.000Z', 3);
      expect(typeof id).toBe('number');
    }
    const over = await store.reserveThrottle('reset_req_email', 'a@daidung.com.vn', 't3', '2000-01-01T00:00:00.000Z', 3);
    expect(over).toBeNull();
    expect(await store.countThrottle('reset_req_email', 'a@daidung.com.vn', '2000-01-01T00:00:00.000Z')).toBe(3);
  });

  it('releaseThrottle(id) rut dung 1 dong vua ghi boi reserveThrottle', async () => {
    const id = await store.reserveThrottle('login_fail_ip', '1.2.3.4', 'now-1', '2000-01-01T00:00:00.000Z', 20);
    expect(id).not.toBeNull();
    await store.releaseThrottle(id as number);
    expect(await store.countThrottle('login_fail_ip', '1.2.3.4', '2000-01-01T00:00:00.000Z')).toBe(0);
  });

  it('releaseThrottle khong khop id nao thi khong lam gi (khong nem loi)', async () => {
    await expect(store.releaseThrottle(999_999)).resolves.toBeUndefined();
  });

  it('N2: 2 dong trung createdAt (cung kind/key) - releaseThrottle(id) chi xoa DUNG 1 dong, dong con lai van con', async () => {
    const id1 = await store.reserveThrottle('login_fail_ip', '9.9.9.9', 'trung-nhau', '2000-01-01T00:00:00.000Z', 20);
    const id2 = await store.reserveThrottle('login_fail_ip', '9.9.9.9', 'trung-nhau', '2000-01-01T00:00:00.000Z', 20);
    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(id1).not.toBe(id2); // id khac nhau du createdAt trung nhau het

    await store.releaseThrottle(id1 as number);

    // Chi mat dung 1 dong (id1), dong id2 (createdAt trung id1) phai con nguyen.
    expect(await store.countThrottle('login_fail_ip', '9.9.9.9', '2000-01-01T00:00:00.000Z')).toBe(1);
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
