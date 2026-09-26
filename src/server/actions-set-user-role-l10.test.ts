/**
 * L-10 (merge P3A <-> P3B): setUserRoleAction phai truyen email admin dang thao tac lam `changedBy`
 * cho repo.setUserRole - truoc day bo trong nen audit `canViewFinance` ghi 'system'.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import { setUserRoleAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('setUserRoleAction - L-10: audit canViewFinance ghi dung nguoi doi', () => {
  it('doi 1 tai khoan viewer sang data-entry -> dong audit canViewFinance false->true co changedBy = email admin', async () => {
    const target = repo.getUserRoles().find((u) => u.role === 'viewer');
    expect(target).toBeDefined();
    const res = await setUserRoleAction(target!.email, 'data-entry');
    expect(res).toEqual({ ok: true });
    const row = repo.getAuditLog().find((a) => a.tableName === 'user_roles' && a.recordId === target!.email && a.field === 'canViewFinance');
    expect(row).toMatchObject({ oldValue: 'false', newValue: 'true', changedBy: ADMIN.email });
  });
});
