import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { STAGE_ORDER } from '@/lib/stages';
import type { CurrentUser } from '@/lib/session';
import type { StageCode } from '@/server/repo/types';

/**
 * Kiem thu doc lap Q8 (doi trong so KHONG tinh lai %TT thang da luu) va vai bien khac ma
 * `actions-project.test.ts` cua coder chua cham: G-4 (server khong tu ep hoa - chi UI lam),
 * bien 160 ky tu qua updateProjectAction, va reason dung 5 ky tu (bien duoi cua projectCodeSchema).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { createProjectAction, saveMonthlyData } from '@/server/actions';
import { changeProjectCodeAction, saveStageWeightsAction, updateProjectAction } from '@/server/actions-project';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

function chain(pcts: number[], applicable: boolean[] = STAGE_ORDER.map(() => true)): { stageCode: StageCode; pctComplete: number; applicable: boolean }[] {
  return STAGE_ORDER.map((stageCode, i) => ({ stageCode, pctComplete: pcts[i], applicable: applicable[i] }));
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  login(ADMIN);
});

describe('Q8 - doi trong so KHONG tinh lai %TT cua thang da luu', () => {
  it('sau khi doi trong so, %TT thang da luu truoc do GIU NGUYEN; thang moi luu sau dung trong so moi', async () => {
    // 1) Chot trong so ban dau W1: chi 'design' co trong so, cac giai doan khac = 0.
    const w1 = STAGE_ORDER.map((code) => ({ stageCode: code, weightPct: code === 'design' ? 100 : 0, applicable: code === 'design' }));
    expect((await saveStageWeightsAction(1, w1)).ok).toBe(true);

    // 2) Luu chain thang 2031-02 (thang chua tung dung, chac chan khong bi khoa):
    //    design=50%, shop=100% (shop khong ap dung nen khong anh huong voi W1).
    const okSave1 = await saveMonthlyData(1, '2031-02', { chain: chain([0.5, 1, 0, 0, 0, 0, 0], [true, true, false, false, false, false, false]) });
    expect(okSave1).toEqual({ ok: true });
    const pctActualThang1TruocDoi = repo.getFacts(1).find((f) => f.yearMonth === '2031-02')!.pctActual;
    expect(pctActualThang1TruocDoi).toBeCloseTo(0.5, 10); // 100% trong so vao design, design=50%

    // 3) Doi trong so sang W2: chi 'shop' co trong so.
    const w2 = STAGE_ORDER.map((code) => ({ stageCode: code, weightPct: code === 'shop' ? 100 : 0, applicable: code === 'shop' }));
    expect((await saveStageWeightsAction(1, w2)).ok).toBe(true);

    // 4) %TT thang 2031-02 (da luu truoc khi doi trong so) PHAI GIU NGUYEN 0.5, khong tu tinh lai thanh 1.
    const pctActualThang1SauDoi = repo.getFacts(1).find((f) => f.yearMonth === '2031-02')!.pctActual;
    expect(pctActualThang1SauDoi).toBe(pctActualThang1TruocDoi);

    // 5) Luu THANG MOI voi CUNG chain -> ap dung trong so MOI (W2, chi tinh shop) -> %TT = 1 (shop=100%).
    const okSave2 = await saveMonthlyData(1, '2031-03', { chain: chain([0.5, 1, 0, 0, 0, 0, 0], [true, true, false, false, false, false, false]) });
    expect(okSave2).toEqual({ ok: true });
    const pctActualThang2 = repo.getFacts(1).find((f) => f.yearMonth === '2031-03')!.pctActual;
    expect(pctActualThang2).toBeCloseTo(1, 10);
    expect(pctActualThang2).not.toBe(pctActualThang1SauDoi);
  });
});

describe('Q6/S-7 (vong sua 1) - server EP VIET HOA ten du an, khong con tin rieng client', () => {
  it('goi thang updateProjectAction voi ten chu thuong -> luu VIET HOA TOAN BO', async () => {
    const res = await updateProjectAction(1, { projectName: 'ten du an chu thuong qa' });
    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.projectName).toBe('TEN DU AN CHU THUONG QA');
  });

  it('ten dung DUNG 160 ky tu qua updateProjectAction -> ok; 161 ky tu -> Invalid input (da co o test coder, kiem lai bien duoi)', async () => {
    const res160 = await updateProjectAction(1, { projectName: 'B'.repeat(160) });
    expect(res160).toEqual({ ok: true });
    expect(repo.getProject(1)!.projectName).toHaveLength(160);
  });

  it('updateProjectAction voi customerId khong ton tai -> invalid_customer (khong FK 500)', async () => {
    const res = await updateProjectAction(1, { customerId: 999999 });
    expect(res).toEqual({ ok: false, error: 'invalid_customer' });
  });

  it('updateProjectAction voi teamKdId khong ton tai -> invalid_team', async () => {
    const res = await updateProjectAction(1, { teamKdId: 999999 });
    expect(res).toEqual({ ok: false, error: 'invalid_team' });
  });

  it('createProjectAction voi CDT da gop vao CDT khac -> invalid_customer', async () => {
    const fromId = repo.createDimValue('customer', 'CDT SE BI GOP QA');
    const toId = repo.createDimValue('customer', 'CDT GOC QA');
    repo.mergeDimValue('customer', fromId, toId);
    const res = await createProjectAction({
      projectName: 'DU AN CDT DA GOP', customerId: fromId, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 10, tonnage: 100,
      plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
    });
    expect(res).toEqual({ ok: false, error: 'invalid_customer' });
  });
});

describe('changeProjectCodeAction - bien duoi ly do dung 5 ky tu (projectCodeSchema min(5))', () => {
  it("ly do dung 5 ky tu ('12345') -> hop le, khong bi Invalid input", async () => {
    const res = await changeProjectCodeAction(1, 'CT-BIEN-DUOI-QA', '12345');
    expect(res).toEqual({ ok: true });
  });

  it('ly do 4 ky tu (thieu 1) -> Invalid input', async () => {
    const res = await changeProjectCodeAction(1, 'CT-BIEN-DUOI-QA2', '1234');
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });
});
