/**
 * P3F-3 (Task 5) - `prismaSignupStore` chạy CÙNG bộ ca với kho bộ nhớ (`signup-store-contract.ts`) trên Postgres THẬT
 * (chỉ DB thật mới chứng minh được giao dịch `approveRequest` và ràng buộc unique/khoá ngoại).
 * Bỏ qua khi `npm test` bình thường (không có `DATABASE_URL`); chạy tay bằng:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/repo/prisma-repo-signup-real-db.test.ts
 * Dữ liệu test có tiền tố `test-p3f-` (email, tên phòng ban) và tự dọn.
 */
import { afterAll, describe } from 'vitest';
import type { Role } from './types';
import { runSignupStoreContract, TEST_PREFIX, type SignupHarness } from './signup-store-contract';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('prismaSignupStore tren Postgres that (DB _c)', () => {
  let prisma: typeof import('@/server/db').prisma;

  async function clean() {
    await prisma.signupRequest.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
    await prisma.userRole.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
    await prisma.department.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  }

  afterAll(async () => {
    if (!hasDb) return;
    await clean();
    await prisma.$disconnect();
  });

  runSignupStoreContract('SignupStore Prisma', async (): Promise<SignupHarness> => {
    ({ prisma } = await import('@/server/db'));
    const { prismaSignupStore } = await import('./prisma-repo-signup');
    return {
      store: prismaSignupStore,
      async addAccount(email, departmentId = null) {
        await prisma.userRole.create({
          data: { email, name: 'Co san', passwordHash: 'hash-co-san', role: 'viewer', canViewFinance: false, isActive: true, departmentId },
        });
      },
      async findAccount(email) {
        const u = await prisma.userRole.findUnique({ where: { email } });
        if (!u) return null;
        return {
          email: u.email, name: u.name, passwordHash: u.passwordHash, role: u.role as Role,
          canViewFinance: u.canViewFinance, isActive: u.isActive, departmentId: u.departmentId,
        };
      },
      reset: clean,
    };
  });
});
