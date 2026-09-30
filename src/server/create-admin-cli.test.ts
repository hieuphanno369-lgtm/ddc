import { describe, expect, it, vi } from 'vitest';
import {
  createAdminCli, DEFAULT_ADMIN_NAME, generateTempPassword, TEMP_PASSWORD_BYTES, type CreateAdminStore,
} from './create-admin-cli';
import type { UserAccount } from './repo/types';

/**
 * P5-B Task 7b - lenh tao admin dau tien tren DB moi. Kho gia trong bo nho (Map), KHONG mock Prisma
 * (khuon theo `unlock-account-cli.test.ts` nhung don gian hon: chi findAccount/createAccount).
 */
function makeStore(initial: UserAccount[] = []): { store: CreateAdminStore; accounts: Map<string, UserAccount> } {
  const accounts = new Map<string, UserAccount>();
  for (const a of initial) accounts.set(a.email, a);
  const store: CreateAdminStore = {
    async findAccount(email) {
      return accounts.get(email);
    },
    async createAccount(account) {
      if (accounts.has(account.email)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
      accounts.set(account.email, account);
    },
  };
  return { store, accounts };
}

function fakeDeps(overrides: Partial<Parameters<typeof createAdminCli>[3]> = {}): Parameters<typeof createAdminCli>[3] {
  return {
    hash: async (p: string) => `h:${p}`,
    genPassword: () => 'TempPass1234567890AB',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    log: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('generateTempPassword', () => {
  it('mac dinh: dai 24, chi ky tu base64url, passwordStrength = 3', () => {
    const p = generateTempPassword();
    expect(p).toHaveLength(24);
    expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('goi 50 lan khong trung nhau', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateTempPassword());
    expect(seen.size).toBe(50);
  });

  it('random luon tra ve toan chu A (yeu) -> throw temp_password_weak', () => {
    const weakRandom = (n: number) => Buffer.alloc(n, 0);
    expect(() => generateTempPassword(weakRandom)).toThrow('temp_password_weak');
  });
});

describe('createAdminCli', () => {
  it("email co hoa/khoang trang -> code 0, luu chuan hoa, mat khau khong lo trong message", async () => {
    const { store, accounts } = makeStore();
    const log = vi.fn(async () => undefined);
    const deps = fakeDeps({ log });

    const r = await createAdminCli(store, '  Admin@DaiDung.VN ', undefined, deps);

    expect(r.code).toBe(0);
    expect(r.message).not.toContain(r.tempPassword ?? '__khong_co__');
    expect(r.tempPassword).toBe('TempPass1234567890AB');
    const saved = accounts.get('admin@daidung.vn');
    expect(saved).toBeDefined();
    expect(saved?.name).toBe(DEFAULT_ADMIN_NAME);
    expect(saved?.role).toBe('admin');
    expect(saved?.canViewFinance).toBe(true);
    expect(saved?.isActive).toBe(true);
    expect(saved?.lockedAt).toBeNull();
    expect(saved?.lastLoginAt).toBeNull();
    expect(saved?.passwordHash).toBe('h:TempPass1234567890AB');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('admin@daidung.vn');
  });

  it('co ten -> luu dung ten', async () => {
    const { store, accounts } = makeStore();
    const r = await createAdminCli(store, 'nv-a@daidung.vn', 'Nguyen Van A', fakeDeps());
    expect(r.code).toBe(0);
    expect(accounts.get('nv-a@daidung.vn')?.name).toBe('Nguyen Van A');
  });

  it.each(['khong-phai-email', ''])('email khong hop le "%s" -> code 2, khong goi store/log', async (rawEmail) => {
    const { store, accounts } = makeStore();
    const log = vi.fn(async () => undefined);
    const r = await createAdminCli(store, rawEmail, undefined, fakeDeps({ log }));
    expect(r.code).toBe(2);
    expect(accounts.size).toBe(0);
    expect(log).not.toHaveBeenCalled();
  });

  it('email da ton tai -> code 1, tai khoan cu giu nguyen, khong goi log', async () => {
    const existing: UserAccount = {
      email: 'admin@daidung.vn', name: 'Admin Cu', passwordHash: 'hash-cu', role: 'admin',
      canViewFinance: true, isActive: true, createdAt: '2025-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: null,
    };
    const { store } = makeStore([existing]);
    const log = vi.fn(async () => undefined);
    const r = await createAdminCli(store, 'admin@daidung.vn', undefined, fakeDeps({ log }));
    expect(r.code).toBe(1);
    expect(existing.passwordHash).toBe('hash-cu');
    expect(log).not.toHaveBeenCalled();
  });

  it("createAccount nem loi P2002 -> code 1", async () => {
    const store: CreateAdminStore = {
      async findAccount() {
        return undefined;
      },
      async createAccount() {
        throw Object.assign(new Error('trung'), { code: 'P2002' });
      },
    };
    const r = await createAdminCli(store, 'ai-do@daidung.vn', undefined, fakeDeps());
    expect(r.code).toBe(1);
  });

  it('createAccount nem loi khac -> promise reject', async () => {
    const store: CreateAdminStore = {
      async findAccount() {
        return undefined;
      },
      async createAccount() {
        throw new Error('db down');
      },
    };
    await expect(createAdminCli(store, 'ai-do@daidung.vn', undefined, fakeDeps())).rejects.toThrow('db down');
  });
});

it('hang so TEMP_PASSWORD_BYTES = 18 (base64url -> 24 ky tu)', () => {
  expect(TEMP_PASSWORD_BYTES).toBe(18);
});
