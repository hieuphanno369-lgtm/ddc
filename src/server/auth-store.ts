import { repo } from './repo/mock-repo';
import { createMemoryAuthStore } from './repo/mock-repo-auth';
import { prismaAuthStore } from './repo/prisma-repo-auth';
import type { AuthStore } from './repo/types';

/**
 * P3E (Task 5) - có `DATABASE_URL` thì dùng kho Prisma thật; không có (chế độ mock, ví dụ CI không
 * DB) thì dựng 1 kho bộ nhớ trên `repo` của `mock-repo`, giữ 1 lần trong `globalThis` (giống khuôn
 * `getAuthStore` không được tạo lại mỗi lần gọi, mất hết bộ đếm/khoá đã ghi).
 */
type AuthStoreGlobal = { __ddcMemoryAuthStore?: AuthStore };
const g = globalThis as unknown as AuthStoreGlobal;

export function getAuthStore(): AuthStore {
  if (process.env.DATABASE_URL) return prismaAuthStore;
  if (!g.__ddcMemoryAuthStore) {
    g.__ddcMemoryAuthStore = createMemoryAuthStore({
      findAccount: (email) => repo.findAccount(email),
      changePassword: (email, passwordHash) => repo.changePassword(email, passwordHash),
    });
  }
  return g.__ddcMemoryAuthStore;
}
