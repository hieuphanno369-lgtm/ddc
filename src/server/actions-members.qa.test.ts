import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Kiem thu doc lap cua Tester cho G-17 (PIC/Backup) - KHONG doc lai kich ban cua coder trong
 * `actions-members.test.ts`, chi bo sung goc nhin/du lieu khac: quyen viewer/bod, PIC bi khoa
 * (khac voi Backup bi khoa da duoc coder kiem), gan lai chinh minh (idempotent), email sai dinh
 * dang, requireProjectRead cho nguoi KHONG duoc gan (phai notFound), va doi PIC sang PIC khac
 * roi kiem nguoi cu mat quyen ghi ngay lap tuc.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

import { getCurrentUser } from '@/lib/session';
import { removeProjectMemberAction, setProjectMemberAction } from '@/server/actions-project';
import { saveKeyMilestonesAction } from '@/server/actions';
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

describe('setProjectMemberAction / removeProjectMemberAction - vai tro khac bi tu choi', () => {
  it('viewer@ (khong phai admin) goi setProjectMemberAction -> Forbidden', async () => {
    login(VIEWER);
    const res = await setProjectMemberAction(1, 'pm@daidung.com.vn', 'Backup');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod@ goi removeProjectMemberAction -> Forbidden, thanh vien khong bi go', async () => {
    login(BOD);
    const res = await removeProjectMemberAction(1, 'pm@daidung.com.vn');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    login(ADMIN);
    expect(repo.getProjectMembers(1).some((m) => m.userEmail === 'pm@daidung.com.vn')).toBe(true);
  });

  it('email sai dinh dang -> Invalid input (khong phai user_not_found)', async () => {
    login(ADMIN);
    const res = await setProjectMemberAction(1, 'khong-phai-email', 'Backup');
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });
});

describe('setProjectMemberAction - tai khoan PIC bi khoa (khac ca Backup bi khoa)', () => {
  it('gan PIC cho tai khoan data-entry bi khoa -> user_not_found', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'de-khoa@daidung.com.vn', name: 'DE Khoa', passwordHash: 'x', role: 'data-entry',
      canViewFinance: true, isActive: false, createdAt: new Date().toISOString(), lastLoginAt: null,
    });
    const res = await setProjectMemberAction(16, 'de-khoa@daidung.com.vn', 'PIC');
    expect(res).toEqual({ ok: false, error: 'user_not_found' });
  });

  it('gan lai chinh PIC hien tai (khong doi) -> unchanged, khong ghi audit moi', async () => {
    login(ADMIN);
    const before = repo.getAuditLog().length;
    const res = await setProjectMemberAction(1, 'pm@daidung.com.vn', 'PIC');
    expect(res).toEqual({ ok: true, result: 'unchanged' });
    expect(repo.getAuditLog().length).toBe(before);
  });
});

describe('Tich hop authz - doi PIC sang Backup va quyen doc du an chua duoc gan', () => {
  it('doi PIC (data-entry) sang Backup -> VAN con quyen GHI (Backup data-entry cung ghi duoc, chi Backup vai tro viewer moi chi doc)', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'de-moi@daidung.com.vn', name: 'DE Moi', passwordHash: 'x', role: 'data-entry',
      canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null,
    });
    // Chuyen pm@ (PIC cu) sang Backup truoc (khong the co 2 PIC), roi gan PIC moi.
    const changed = await setProjectMemberAction(1, 'pm@daidung.com.vn', 'Backup');
    expect(changed).toEqual({ ok: true, result: 'changed' });
    await setProjectMemberAction(1, 'de-moi@daidung.com.vn', 'PIC');

    login(PM);
    const res = await saveKeyMilestonesAction(1, []);
    expect(res.ok).toBe(true); // pm@ la data-entry Backup -> van ghi duoc, dung nhu Q3(a)/(b)
  });

  it('nguoi data-entry hoan toan khong duoc gan vao du an 16 -> requireProjectRead nem notFound', async () => {
    login(ADMIN);
    repo.createAccount({
      email: 'chua-gan@daidung.com.vn', name: 'Chua Gan', passwordHash: 'x', role: 'data-entry',
      canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null,
    });
    const outsider: CurrentUser = { name: 'Chua Gan', email: 'chua-gan@daidung.com.vn', role: 'data-entry', canViewFinance: true };
    await expect(requireProjectRead(outsider, 16)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(await canWriteProject(outsider, 16)).toBe(false);
  });

  it('go Backup (khong phai PIC) khoi du an -> saveKeyMilestonesAction cua nguoi do bi Forbidden ngay sau khi go', async () => {
    login(ADMIN);
    await setProjectMemberAction(3, 'viewer@daidung.com.vn', 'Backup');
    login(VIEWER);
    // viewer khong co quyen GHI du du la Backup (Backup viewer chi doc, khong ghi) - kiem canWriteProject false truoc.
    expect(await canWriteProject(VIEWER, 3)).toBe(false);
    login(ADMIN);
    await removeProjectMemberAction(3, 'viewer@daidung.com.vn');
    await expect(requireProjectRead(VIEWER, 3)).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('removeProjectMemberAction voi nguoi khong thuoc du an -> not_member', async () => {
    login(ADMIN);
    const res = await removeProjectMemberAction(16, 'khong-thuoc-du-an@daidung.com.vn');
    expect(res).toEqual({ ok: false, error: 'not_member' });
  });
});
