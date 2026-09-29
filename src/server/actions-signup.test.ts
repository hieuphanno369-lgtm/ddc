/**
 * P3F-3 (Task 6) - server action cong khai `/dang-ky`: khong can dang nhap, loi ha tang tra `accepted` va
 * chi log ten loi. Dung kho bo nho that (`createMemorySignupStore`) qua mock `@/server/signup-store`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAuthStore } from '@/server/repo/mock-repo-auth';
import { createMemorySignupStore } from '@/server/repo/mock-repo-signup';
import type { UserAccount } from '@/server/repo/types';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));
vi.mock('@/lib/password', () => ({ hashPassword: vi.fn(async (p: string) => `hashed:${p}`) }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '1.2.3.4']]) as unknown as Headers,
}));

let signupStore: ReturnType<typeof createMemorySignupStore>;
let authStore: ReturnType<typeof createMemoryAuthStore>;
const getSignupStoreMock = vi.fn(() => signupStore);
vi.mock('@/server/signup-store', () => ({ getSignupStore: () => getSignupStoreMock() }));
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => authStore }));

import { submitSignupAction } from '@/server/actions-signup';
import { __signupQueueIdleForTest } from '@/server/signup';

const valid = { name: 'Nguyen Van A', departmentId: null, email: 'ten@daidung.vn', password: 'Abcdef1!', locale: 'vi' };

beforeEach(() => {
  vi.clearAllMocks();
  const accounts: UserAccount[] = [];
  signupStore = createMemorySignupStore({
    findAccount: (e) => accounts.find((a) => a.email === e),
    createAccount: (a) => void accounts.push(a),
    countInDepartment: () => 0,
  });
  authStore = createMemoryAuthStore({ findAccount: (e) => accounts.find((a) => a.email === e.toLowerCase()), changePassword: () => {} });
});

describe('submitSignupAction', () => {
  it('goi khong dang nhap van chay va tao dang ky cho', async () => {
    expect(await submitSignupAction(valid)).toEqual({ status: 'accepted' });
    await __signupQueueIdleForTest();
    expect(await signupStore.countPending()).toBe(1);
  });

  it('du lieu sai tra invalid dung truong', async () => {
    expect(await submitSignupAction({ ...valid, email: 'a@gmail.com' })).toEqual({ status: 'invalid', field: 'email_domain' });
  });

  it('ngon ngu la -> mac dinh vi', async () => {
    await submitSignupAction({ ...valid, locale: 'fr' });
    await __signupQueueIdleForTest();
    expect((await signupStore.listPending())[0].locale).toBe('vi');
  });

  it('loi ha tang (store nem) -> accepted, console.error chi nhan ten loi', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSignupStoreMock.mockImplementationOnce(() => {
      throw new TypeError('mat khau db: bi mat');
    });
    expect(await submitSignupAction(valid)).toEqual({ status: 'accepted' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual(['[submitSignupAction]', 'TypeError']);
    spy.mockRestore();
  });
});
