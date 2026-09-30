import type { AdminUserRow, UserAccount } from '@/server/repo/types';

/** P3E (Task 6) - S15: bỏ `passwordHash` trước khi truyền cho trình duyệt, chỉ giữ cờ `hasPassword`. */
export function toAdminUserRow(u: UserAccount): AdminUserRow {
  const { passwordHash, ...rest } = u;
  return { ...rest, hasPassword: passwordHash !== '' };
}
