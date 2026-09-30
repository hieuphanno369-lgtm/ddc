import { repo } from './repo/mock-repo';
import { createMemorySignupStore } from './repo/mock-repo-signup';
import { prismaSignupStore } from './repo/prisma-repo-signup';
import type { SignupStore } from './repo/signup-types';

/**
 * P3F-3 (Task 5) - có `DATABASE_URL` thì dùng kho Prisma thật; không có (chế độ mock, ví dụ CI không DB) thì dựng
 * 1 kho bộ nhớ trên `repo` của `mock-repo`, giữ 1 lần trong `globalThis` (khuôn `getAuthStore`).
 * Phòng ban của tài khoản trong chế độ mock chỉ cần đếm để chặn xoá phòng ban đang dùng nên giữ ở 1 Map riêng.
 */
type SignupStoreGlobal = { __ddcMemorySignupStore?: SignupStore };
const g = globalThis as unknown as SignupStoreGlobal;

export function getSignupStore(): SignupStore {
  if (process.env.DATABASE_URL) return prismaSignupStore;
  if (!g.__ddcMemorySignupStore) {
    const accountDepartments = new Map<string, number | null>();
    g.__ddcMemorySignupStore = createMemorySignupStore({
      findAccount: (email) => repo.findAccount(email),
      createAccount: (account, departmentId) => {
        repo.createAccount(account);
        accountDepartments.set(account.email, departmentId);
      },
      countInDepartment: (departmentId) => [...accountDepartments.values()].filter((d) => d === departmentId).length,
    });
  }
  return g.__ddcMemorySignupStore;
}
