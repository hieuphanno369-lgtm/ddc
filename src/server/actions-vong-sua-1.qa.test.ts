import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Tester (vong sua 1, kiem thu doc lap): bo sung cac bien ma `actions-project.qa.test.ts` /
 * `actions.test.ts` CHUA cham toi:
 *  - Muc 4 (S-7): team (khong chi customer) da GOP vao team khac -> invalid_team, o CA
 *    createProjectAction LAN updateProjectAction (truoc do chi co ca customer o createProjectAction,
 *    va ca "khong ton tai" o updateProjectAction - chua co ca "da gop" o updateProjectAction).
 *  - Muc 5 (S-4): saveMonthlyData voi CAC TRUONG NGAY KHAC ngoai plannedFinishDate (coder/tester
 *    vong 1 moi kiem 1 truong) - actualStartDate, committedHandoverDate, contractDate sai dinh dang;
 *    va xac nhan gia tri null (xoa ngay) VAN hop le (nullableDate.nullable()).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { createProjectAction, saveMonthlyData } from '@/server/actions';
import { updateProjectAction } from '@/server/actions-project';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const YM = '2026-09';

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  login(ADMIN);
});

describe('S-7 (vong sua 1) - team da GOP van bi chan (bo sung ben canh customer da co)', () => {
  it('updateProjectAction voi teamKdId da bi gop vao team khac -> invalid_team (chua co ca nay truoc do, chi co "khong ton tai")', async () => {
    const fromId = repo.createDimValue('team', 'TEAM SE BI GOP QA VONG SUA 1');
    const toId = repo.createDimValue('team', 'TEAM GOC QA VONG SUA 1');
    repo.mergeDimValue('team', fromId, toId);
    const res = await updateProjectAction(1, { teamKdId: fromId });
    expect(res).toEqual({ ok: false, error: 'invalid_team' });
  });

  it('updateProjectAction voi customerId da bi gop -> invalid_customer (bo sung ben canh createProjectAction da co)', async () => {
    const fromId = repo.createDimValue('customer', 'CDT SE BI GOP QA VS1 UPDATE');
    const toId = repo.createDimValue('customer', 'CDT GOC QA VS1 UPDATE');
    repo.mergeDimValue('customer', fromId, toId);
    const res = await updateProjectAction(1, { customerId: fromId });
    expect(res).toEqual({ ok: false, error: 'invalid_customer' });
  });

  it('createProjectAction voi teamKdId da bi gop vao team khac -> invalid_team (bo sung ben canh ca customer da co)', async () => {
    const fromId = repo.createDimValue('team', 'TEAM SE BI GOP QA VS1 CREATE');
    const toId = repo.createDimValue('team', 'TEAM GOC QA VS1 CREATE');
    repo.mergeDimValue('team', fromId, toId);
    const res = await createProjectAction({
      projectName: 'DU AN TEAM DA GOP', customerId: 1, teamKdId: fromId, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 10, tonnage: 100,
      plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
    });
    expect(res).toEqual({ ok: false, error: 'invalid_team' });
  });

  it('updateProjectAction voi customerId THUC SU dang hoat dong -> khong bi tu choi oan (doi chung)', async () => {
    const res = await updateProjectAction(1, { customerId: 1 });
    expect(res).toEqual({ ok: true });
  });
});

describe('S-4 (vong sua 1) - saveMonthlyData: cac truong ngay KHAC (ngoai plannedFinishDate) cung phai kiem ISO', () => {
  it('actualStartDate sai dinh dang -> Invalid input, du an khong doi', async () => {
    const before = repo.getProject(1)!;
    const res = await saveMonthlyData(1, YM, { actualStartDate: 'khong-phai-ngay' });
    expect(res.ok).toBe(false);
    expect(repo.getProject(1)).toEqual(before);
  });

  it('committedHandoverDate sai dinh dang -> Invalid input, du an khong doi', async () => {
    const before = repo.getProject(1)!;
    const res = await saveMonthlyData(1, YM, { committedHandoverDate: '31/12/2026' });
    expect(res.ok).toBe(false);
    expect(repo.getProject(1)).toEqual(before);
  });

  it('contractDate sai dinh dang (thang 13) -> Invalid input, du an khong doi', async () => {
    const before = repo.getProject(1)!;
    const res = await saveMonthlyData(1, YM, { contractDate: '2026-13-01' });
    expect(res.ok).toBe(false);
    expect(repo.getProject(1)).toEqual(before);
  });

  it('actualFinishDate = null (xoa ngay) -> VAN hop le, luu duoc (nullableDate cho phep null)', async () => {
    const res = await saveMonthlyData(1, YM, { actualFinishDate: null });
    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.actualFinishDate).toBeNull();
  });

  it('actualStartDate dung dinh dang ISO hop le -> luu duoc, gia tri khop', async () => {
    const res = await saveMonthlyData(1, YM, { actualStartDate: '2026-01-05' });
    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.actualStartDate).toBe('2026-01-05');
  });
});
