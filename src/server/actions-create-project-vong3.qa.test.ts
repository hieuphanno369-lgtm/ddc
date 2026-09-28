import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { LEGACY_STAGE_WEIGHTS, SEED_STAGE_CODES } from '@/lib/stages';
import type { CurrentUser } from '@/lib/session';

/**
 * Tester vong 3 (doc lap): bo sung bien cho vong sua reviewer "tao du an nguyen tu" o tang action -
 * dac biet la kich ban chinh reviewer/coder da neu o "Cho Tester nen soi ky" (thay-doi.md): tao lai
 * dung ma CT sau khi lan tao truoc bi 'stages_changed' phai THANH CONG, khong duoc gap 'code_taken'.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { createProjectAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

const base = {
  projectName: 'DU AN TESTER VONG3 RACE', customerId: 1, teamKdId: 1, marketCode: 'TN' as const,
  projectType: 'EPC' as const, priority: 'P1' as const, contractValue: 10,
  tonnage: 100, plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
};

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('createProjectAction: mang rong tuong minh cho stageWeights (tester vong 3)', () => {
  it("stageWeights: [] (mang rong tuong minh, khong phai undefined) -> weights_required, khong tao du an", async () => {
    const before = repo.listProjects().length;
    const res = await createProjectAction({ ...base, stageWeights: [] });
    expect(res).toEqual({ ok: false, error: 'weights_required' });
    expect(repo.listProjects()).toHaveLength(before);
  });
});

describe('createProjectAction: tao du an nguyen tu, kich ban lay lai dung ma CT sau khi that bai (tester vong 3)', () => {
  it("lan 1 gui ma CT tuong minh + trong so da lech tap giai doan (giai doan vua bi ngung dung) -> stages_changed, KHONG co du an nua voi, ma CT khong bi chiem; lan 2 gui LAI DUNG ma CT do + trong so dung -> thanh cong, KHONG gap code_taken", async () => {
    const codeCT = 'CT-TESTER-VONG3-RACE';
    const staleRows = LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w })); // van con du 8 ma, ke ca settlement
    // Mo phong admin khac ngung dung 1 giai doan DUNG LUC nguoi nay sap bam ghi (rows da cam tay tu
    // truoc, khong doc lai repo.getStages() nua) - dung goi truc tiep repo, khong dung vi.spyOn.
    expect(repo.setStageActive('settlement', false, 'admin_khac@x')).toBe('ok');

    const before = repo.listProjects().length;
    const res1 = await createProjectAction({ ...base, currentAliasCode: codeCT, stageWeights: staleRows });

    expect(res1).toEqual({ ok: false, error: 'stages_changed' });
    expect(repo.listProjects()).toHaveLength(before);
    expect(repo.listProjects().some((p) => p.currentAliasCode === codeCT)).toBe(false);
    expect(repo.isProjectCodeTaken(codeCT, null)).toBe(false);

    // Lan 2: dung ma CT do, nhung gui dung tap giai doan dang dung THAT (7 ma, khong con 'settlement').
    const correctRows = LEGACY_STAGE_WEIGHTS.filter((w) => w.stageCode !== 'settlement').map((w) => ({ ...w }));
    const res2 = await createProjectAction({ ...base, currentAliasCode: codeCT, stageWeights: correctRows });

    expect(res2.ok).toBe(true);
    expect(repo.listProjects()).toHaveLength(before + 1);
    const created = repo.listProjects().find((p) => p.currentAliasCode === codeCT);
    expect(created).toBeTruthy();
    const rows = repo.getStageWeights(created!.id);
    expect(rows.map((r) => r.stageCode).sort()).toEqual([...SEED_STAGE_CODES].filter((c) => c !== 'settlement').sort());
  });
});
