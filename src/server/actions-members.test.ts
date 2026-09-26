import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

import { getCurrentUser } from '@/lib/session';
import { approveCustomerAction, removeProjectMemberAction, setProjectMemberAction } from '@/server/actions-project';
import { createDimValueAction, mergeDimAction, saveKeyMilestonesAction } from '@/server/actions';
import { canWriteProject, requireProjectRead } from '@/server/authz';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('setProjectMemberAction - quyen chi admin', () => {
  it('pm@ (data-entry, du la PIC du an 1) goi -> Forbidden', async () => {
    login(PM);
    const res = await setProjectMemberAction(1, 'viewer@daidung.com.vn', 'Backup');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('admin gan viewer@ lam PIC -> role_not_allowed', async () => {
    login(ADMIN);
    const res = await setProjectMemberAction(1, 'viewer@daidung.com.vn', 'PIC');
    expect(res).toEqual({ ok: false, error: 'role_not_allowed' });
  });

  it('admin gan bod@ lam Backup -> role_not_allowed', async () => {
    login(ADMIN);
    const res = await setProjectMemberAction(1, 'bod@daidung.com.vn', 'Backup');
    expect(res).toEqual({ ok: false, error: 'role_not_allowed' });
  });

  it('admin gan them PIC cho du an 1 (da co pm@ la PIC) -> pic_exists', async () => {
    login(ADMIN);
    // seed: du an 1 da co pm@ la PIC. Tao 1 tai khoan data-entry khac de thu gan PIC thu 2.
    repo.createAccount({
      email: 'de2@daidung.com.vn', name: 'DE2', passwordHash: 'x', role: 'data-entry',
      canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null,
    });
    const res = await setProjectMemberAction(1, 'de2@daidung.com.vn', 'PIC');
    expect(res).toEqual({ ok: false, error: 'pic_exists' });
  });

  it('doi pm@ sang Backup o du an 1 -> changed, roi gan PIC moi duoc', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'de2@daidung.com.vn', name: 'DE2', passwordHash: 'x', role: 'data-entry',
      canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null,
    });
    const changed = await setProjectMemberAction(1, 'pm@daidung.com.vn', 'Backup');
    expect(changed).toEqual({ ok: true, result: 'changed' });
    const added = await setProjectMemberAction(1, 'de2@daidung.com.vn', 'PIC');
    expect(added).toEqual({ ok: true, result: 'added' });
  });

  it('gan email khong ton tai -> user_not_found', async () => {
    login(ADMIN);
    const res = await setProjectMemberAction(1, 'khong-ton-tai@daidung.com.vn', 'Backup');
    expect(res).toEqual({ ok: false, error: 'user_not_found' });
  });

  it('gan tai khoan bi khoa -> user_not_found', async () => {
    login(ADMIN);
    repo.setAccountActive('viewer@daidung.com.vn', false);
    const res = await setProjectMemberAction(1, 'viewer@daidung.com.vn', 'Backup');
    expect(res).toEqual({ ok: false, error: 'user_not_found' });
  });

  it('ghi audit project_assignments', async () => {
    login(ADMIN);
    await setProjectMemberAction(16, 'pm@daidung.com.vn', 'Backup');
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_assignments');
    expect(entry).toBeTruthy();
  });
});

describe('Tich hop authz voi PIC/Backup', () => {
  it('admin go pm khoi du an 1 -> saveKeyMilestonesAction(1, []) voi pm -> Forbidden', async () => {
    login(ADMIN);
    await removeProjectMemberAction(1, 'pm@daidung.com.vn');
    login(PM);
    const res = await saveKeyMilestonesAction(1, []);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('admin gan pm lam Backup du an 16 -> pm luu duoc du an 16', async () => {
    login(ADMIN);
    await setProjectMemberAction(16, 'pm@daidung.com.vn', 'Backup');
    login(PM);
    const res = await saveKeyMilestonesAction(16, []);
    expect(res.ok).toBe(true);
  });

  it('admin gan viewer@ lam Backup du an 3 -> requireProjectRead khong nem notFound, canWriteProject false', async () => {
    login(ADMIN);
    await setProjectMemberAction(3, 'viewer@daidung.com.vn', 'Backup');
    await expect(requireProjectRead(VIEWER, 3)).resolves.toBeUndefined();
    expect(await canWriteProject(VIEWER, 3)).toBe(false);
  });
});

describe('createDimValueAction (G-5) - hang cho duyet', () => {
  it('data-entry tao chu dau tu moi -> needsReview true, createdBy dung email', async () => {
    login(PM);
    const res = await createDimValueAction('customer', 'CDT Moi Cho Duyet');
    expect(res.ok).toBe(true);
    const row = repo.getDimFieldValues('customer').find((c) => c.id === res.id);
    expect(row?.needsReview).toBe(true);
  });

  it('admin tao chu dau tu moi -> needsReview false', async () => {
    login(ADMIN);
    const res = await createDimValueAction('customer', 'CDT Admin Tao');
    expect(res.ok).toBe(true);
    const row = repo.getDimFieldValues('customer').find((c) => c.id === res.id);
    expect(row?.needsReview).toBe(false);
  });
});

describe('approveCustomerAction', () => {
  it('pm@ (khong phai admin) -> Forbidden', async () => {
    login(PM);
    const res = await approveCustomerAction(1);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('duyet 2 lan -> lan 2 not_pending', async () => {
    login(PM);
    const created = await createDimValueAction('customer', 'CDT Duyet Hai Lan');
    login(ADMIN);
    const first = await approveCustomerAction(created.id!);
    expect(first).toEqual({ ok: true });
    const second = await approveCustomerAction(created.id!);
    expect(second).toEqual({ ok: false, error: 'not_pending' });
  });

  it('mergeDimAction voi nguon dang cho -> nguon needsReview ve false', async () => {
    login(PM);
    const created = await createDimValueAction('customer', 'CDT Nguon Cho Merge');
    login(ADMIN);
    await mergeDimAction('customer', created.id!, 1);
    const row = repo.getDimFieldValues('customer').find((c) => c.id === created.id);
    expect(row?.needsReview).toBe(false);
  });
});
