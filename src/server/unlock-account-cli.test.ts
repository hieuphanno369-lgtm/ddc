import { describe, expect, it, vi } from 'vitest';
import { createMemoryAuthStore } from './repo/mock-repo-auth';
import type { UserAccount } from './repo/types';
import { unlockAccountCli } from './unlock-account-cli';

function makeStore(accounts: UserAccount[]) {
  return createMemoryAuthStore({
    findAccount: (email) => accounts.find((a) => a.email === email.toLowerCase()),
    changePassword: (email, hash) => {
      const a = accounts.find((x) => x.email === email.toLowerCase());
      if (a) a.passwordHash = hash;
    },
  });
}

const ACCOUNT: UserAccount = {
  email: 'bi-khoa@daidung.com.vn', name: 'Bi Khoa', passwordHash: 'x', role: 'viewer',
  canViewFinance: false, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: null,
};

describe('unlockAccountCli', () => {
  it('email sai dinh dang -> code 2, khong goi log', async () => {
    const store = makeStore([ACCOUNT]);
    const log = vi.fn(async () => {});

    const r = await unlockAccountCli(store, 'khong-phai-email', log);

    expect(r.code).toBe(2);
    expect(log).not.toHaveBeenCalled();
  });

  it('khong co tai khoan -> code 1', async () => {
    const store = makeStore([ACCOUNT]);
    const log = vi.fn(async () => {});

    const r = await unlockAccountCli(store, 'khong-ton-tai@daidung.com.vn', log);

    expect(r.code).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('mo khoa thanh cong -> code 0, goi log(email)', async () => {
    const store = makeStore([ACCOUNT]);
    await store.registerFailedLogin('bi-khoa@daidung.com.vn', 1, new Date().toISOString());
    const log = vi.fn(async () => {});

    const r = await unlockAccountCli(store, '  Bi-Khoa@Daidung.com.vn  ', log);

    expect(r.code).toBe(0);
    expect(log).toHaveBeenCalledWith('bi-khoa@daidung.com.vn');
    const state = await store.getAccountState('bi-khoa@daidung.com.vn');
    expect(state?.lockedAt).toBeNull();
  });
});
