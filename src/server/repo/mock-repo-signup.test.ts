import type { UserAccount } from './types';
import { createMemorySignupStore } from './mock-repo-signup';
import { runSignupStoreContract, TEST_PREFIX, type SignupHarness } from './signup-store-contract';

/** Kho bộ nhớ chạy cùng bộ ca với kho Prisma (xem `signup-store-contract.ts`). */
runSignupStoreContract('SignupStore bo nho', (): SignupHarness => {
  const accounts = new Map<string, UserAccount>();
  const accountDept = new Map<string, number | null>();
  const store = createMemorySignupStore({
    findAccount: (email) => accounts.get(email),
    createAccount: (account, departmentId) => {
      accounts.set(account.email, account);
      accountDept.set(account.email, departmentId);
    },
    countInDepartment: (departmentId) => [...accountDept.values()].filter((d) => d === departmentId).length,
  });
  return {
    store,
    async addAccount(email, departmentId = null) {
      accounts.set(email, {
        email, name: 'Co san', passwordHash: 'hash-co-san', role: 'viewer', canViewFinance: false, isActive: true,
        createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null,
      });
      accountDept.set(email, departmentId);
    },
    async findAccount(email) {
      const a = accounts.get(email);
      if (!a) return null;
      return {
        email: a.email, name: a.name, passwordHash: a.passwordHash, role: a.role, canViewFinance: a.canViewFinance,
        isActive: a.isActive, departmentId: accountDept.get(email) ?? null,
      };
    },
    async reset() {
      // Kho bo nho duoc dung moi lan (harness moi), nhung don ca phong ban co tien to de an toan.
      for (const d of await store.listDepartments()) {
        if (d.name.startsWith(TEST_PREFIX)) await store.deleteDepartment(d.id);
      }
    },
  };
});
