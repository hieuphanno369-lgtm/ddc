import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { LEGACY_STAGE_WEIGHTS } from '@/lib/stages';
import type { CurrentUser } from '@/lib/session';

/**
 * Vong sua reviewer (tao du an nguyen tu): TDD - test do TRUOC khi sua (xem thay-doi.md). Bug cua
 * vong sua truoc: `createProjectAction` kiem `isSameStageSet` qua `repo.getStages()` (fast-path)
 * TRUOC khi goi `repo.createProject`, roi MOI goi RIENG `repo.replaceStageWeights` SAU KHI du an da
 * tao xong VA COMMIT. Neu tap giai doan dang dung doi XEN GIUA 2 buoc do (admin ngung dung 1 giai
 * doan ngay sau fast-path, truoc khi ghi trong so that), du an van duoc tao nhung THIEU trong so -
 * nua voi, khong the huy. Bam lai vao mock (`d.stages` doc truc tiep, khong qua fast-path) de mo
 * phong dung khe ho do: fast-path van thay tap CU (khop), du lieu THAT da doi.
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
  projectName: 'DU AN NGUYEN TU RACE', customerId: 1, teamKdId: 1, marketCode: 'TN' as const,
  projectType: 'EPC' as const, priority: 'P1' as const, contractValue: 10,
  tonnage: 100, plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
};

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('createProjectAction + repo.createProject (vong sua reviewer): tao du an nguyen tu voi stageWeights', () => {
  it("fast-path (repo.getStages luc kiem truoc) van thay tap CU khop, nhung tap THAT da doi (admin ngung dung 1 giai doan xen giua) -> stages_changed, KHONG co du an nao duoc tao (khong con nua voi)", async () => {
    const before = repo.listProjects().length;
    // Sao chep SAU (khong chi sao chep MANG - `getStages()` tra ve object THAT, sao chep nong se van
    // bi `setStageActive` doi ngay isActive vi cung 1 tham chieu) de co snapshot THAT su cu.
    const staleStages = (await repo.getStages()).map((s) => ({ ...s }));
    vi.spyOn(repo, 'getStages').mockResolvedValueOnce(staleStages);
    // Mo phong admin ngung dung giai doan 'settlement' NGAY SAU fast-path, TRUOC khi ghi trong so that.
    expect(repo.setStageActive('settlement', false, 'admin@daidung.com.vn')).toBe('ok');

    const rows = LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w }));
    const res = await createProjectAction({ ...base, stageWeights: rows });

    expect(res).toEqual({ ok: false, error: 'stages_changed' });
    expect(repo.listProjects()).toHaveLength(before);
    expect(repo.listProjects().some((p) => p.projectName === base.projectName)).toBe(false);
  });
});
