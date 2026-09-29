import type { UserAccount } from './types';
import {
  normalizeDepartmentName,
  type DepartmentRow,
  type NewSignupRequest,
  type SignupRequestRow,
  type SignupStore,
} from './signup-types';

/**
 * P3F-3 (Task 5) - kho `SignupStore` cho chế độ mock (không có `DATABASE_URL`). Phòng ban và đăng ký chờ nằm
 * trong bộ nhớ; tài khoản thật do `source` giữ (khuôn `MemoryAccountSource` của P3E). Thân mọi hàm không có
 * `await` nội bộ nên tự nguyên tử trong 1 tiến trình (đủ cho `approveRequest` đồng thời).
 */
export interface MemorySignupSource {
  findAccount(email: string): UserAccount | undefined;
  createAccount(account: UserAccount, departmentId: number | null): void;
  /** Số tài khoản đang thuộc phòng ban `departmentId`. */
  countInDepartment(departmentId: number): number;
}

interface DepartmentEntry {
  id: number;
  name: string;
  isActive: boolean;
}

interface RequestEntry extends NewSignupRequest {
  id: number;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function createMemorySignupStore(source: MemorySignupSource): SignupStore {
  let departments: DepartmentEntry[] = [];
  let requests: RequestEntry[] = [];
  let nextDepartmentId = 1;
  let nextRequestId = 1;

  const pendingIn = (departmentId: number) => requests.filter((r) => r.departmentId === departmentId).length;

  return {
    async listDepartments() {
      const rows: DepartmentRow[] = departments.map((d) => ({
        id: d.id,
        name: d.name,
        isActive: d.isActive,
        userCount: source.countInDepartment(d.id),
        pendingCount: pendingIn(d.id),
      }));
      return rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },

    async listActiveDepartments() {
      return departments
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: d.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },

    async isActiveDepartment(id) {
      return departments.some((d) => d.id === id && d.isActive);
    },

    async saveDepartment(input) {
      const name = normalizeDepartmentName(input.name);
      if (departments.some((d) => d.id !== input.id && sameName(d.name, name))) return 'duplicate_name';
      if (input.id === undefined) {
        const created: DepartmentEntry = { id: nextDepartmentId++, name, isActive: true };
        departments = [...departments, created];
        return { id: created.id, name };
      }
      const existing = departments.find((d) => d.id === input.id);
      if (!existing) return 'not_found';
      departments = departments.map((d) => (d.id === input.id ? { ...d, name } : d));
      return { id: existing.id, name };
    },

    async setDepartmentActive(id, isActive) {
      if (!departments.some((d) => d.id === id)) return false;
      departments = departments.map((d) => (d.id === id ? { ...d, isActive } : d));
      return true;
    },

    async deleteDepartment(id) {
      if (!departments.some((d) => d.id === id)) return 'not_found';
      const inUse = source.countInDepartment(id) + pendingIn(id);
      if (inUse > 0) return { inUse };
      departments = departments.filter((d) => d.id !== id);
      return 'ok';
    },

    async emailTaken(email) {
      return source.findAccount(email) !== undefined || requests.some((r) => r.email === email);
    },

    async createRequest(row) {
      if (requests.some((r) => r.email === row.email)) return 'duplicate';
      requests = [...requests, { ...row, id: nextRequestId++ }];
      return 'created';
    },

    async listPending() {
      const rows: SignupRequestRow[] = [...requests]
        .sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso) || a.id - b.id)
        .map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          departmentId: r.departmentId,
          departmentName: departments.find((d) => d.id === r.departmentId)?.name ?? null,
          locale: r.locale,
          createdAt: r.createdAtIso,
        }));
      return rows;
    },

    async countPending() {
      return requests.length;
    },

    async approveRequest(id, input) {
      const req = requests.find((r) => r.id === id);
      if (!req) return 'not_found';
      if (source.findAccount(req.email)) return 'duplicate_account';
      source.createAccount(
        {
          email: req.email,
          name: req.name,
          passwordHash: req.passwordHash,
          role: input.role,
          canViewFinance: input.canViewFinance,
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: null,
          lockedAt: null,
        },
        req.departmentId,
      );
      requests = requests.filter((r) => r.id !== id);
      return { email: req.email, name: req.name, locale: req.locale };
    },

    async rejectRequest(id) {
      const req = requests.find((r) => r.id === id);
      if (!req) return 'not_found';
      requests = requests.filter((r) => r.id !== id);
      return { email: req.email };
    },
  };
}
