import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { createMemoryAuthStore } from '@/server/repo/mock-repo-auth';
import type { CurrentUser } from '@/lib/session';

/**
 * P3E (Task 6) - `unlockAccountAction` (admin mở khoá tài khoản bị khoá sau 5 lần sai, kèm tuỳ
 * chọn đặt mật khẩu tạm). Mẫu `actions-account-google.test.ts` (session giả + mock repo).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

let store: ReturnType<typeof createMemoryAuthStore>;
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => store }));

import { getCurrentUser } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { unlockAccountAction } from '@/server/actions-account-lock';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'V', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'B', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const DATA_ENTRY: CurrentUser = { name: 'D', email: 'de@daidung.com.vn', role: 'data-entry', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  store = createMemoryAuthStore({
    findAccount: (email) => repo.findAccount(email),
    changePassword: (email, hash) => repo.changePassword(email, hash),
  });
});

describe('unlockAccountAction - chan quyen', () => {
  it.each([VIEWER, BOD, DATA_ENTRY])('$role goi -> Forbidden', async (user) => {
    login(user);
    const res = await unlockAccountAction('bi-khoa@daidung.com.vn');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('unlockAccountAction - dieu kien dau vao', () => {
  it('email sai dinh dang -> Invalid input', async () => {
    login(ADMIN);
    const res = await unlockAccountAction('khong-phai-email');
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('khong co tai khoan -> Not found', async () => {
    login(ADMIN);
    const res = await unlockAccountAction('khong-ton-tai@daidung.com.vn');
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });

  it('email hoa/khoang trang duoc chuan hoa bang normalizeEmail truoc khi tra cuu (khong Not found nham)', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'hoa@daidung.com.vn', name: 'Hoa', passwordHash: 'x', role: 'viewer',
      canViewFinance: false, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null,
    });
    await store.registerFailedLogin('hoa@daidung.com.vn', 1, new Date().toISOString());

    const res = await unlockAccountAction('  Hoa@Daidung.com.vn  ');

    expect(res).toEqual({ ok: true });
  });

  it('tempPassword 1-7 ky tu -> too_short, khong mo khoa', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'ngan@daidung.com.vn', name: 'Ngan', passwordHash: 'x', role: 'viewer',
      canViewFinance: false, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null,
    });
    await store.registerFailedLogin('ngan@daidung.com.vn', 1, new Date().toISOString());

    const res = await unlockAccountAction('ngan@daidung.com.vn', '1234567');

    expect(res).toEqual({ ok: false, error: 'too_short' });
    const state = await store.getAccountState('ngan@daidung.com.vn');
    expect(state?.lockedAt).not.toBeNull();
  });
});

describe('unlockAccountAction - mo khoa thanh cong', () => {
  it('mo khoa khong dat mat khau moi -> lockedAt null, bo dem 0, ghi activity account_unlock', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'bi-khoa@daidung.com.vn', name: 'Bi Khoa', passwordHash: 'hash-cu', role: 'viewer',
      canViewFinance: false, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null,
    });
    await store.registerFailedLogin('bi-khoa@daidung.com.vn', 1, new Date().toISOString());

    const res = await unlockAccountAction('bi-khoa@daidung.com.vn');

    expect(res).toEqual({ ok: true });
    const state = await store.getAccountState('bi-khoa@daidung.com.vn');
    expect(state?.lockedAt).toBeNull();
    expect(state?.failedLoginCount).toBe(0);
    expect(state?.passwordHash).toBe('hash-cu'); // khong dat lai mat khau khi khong truyen tempPassword
    expect(logActivity).toHaveBeenCalledWith(ADMIN, 'account_unlock', 'bi-khoa@daidung.com.vn');
  });

  it('mo khoa + dat mat khau tam hop le -> mo khoa VA doi mat khau', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'bi-khoa2@daidung.com.vn', name: 'Bi Khoa 2', passwordHash: 'hash-cu', role: 'viewer',
      canViewFinance: false, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null,
    });
    await store.registerFailedLogin('bi-khoa2@daidung.com.vn', 1, new Date().toISOString());

    const res = await unlockAccountAction('bi-khoa2@daidung.com.vn', 'MatKhauTam1');

    expect(res).toEqual({ ok: true });
    const state = await store.getAccountState('bi-khoa2@daidung.com.vn');
    expect(state?.lockedAt).toBeNull();
    expect(state?.passwordHash).not.toBe('hash-cu');
    expect(state?.passwordChangedAt).not.toBeNull(); // Q2=b: admin dat mat khau tam -> vo hieu phien cu
  });
});
