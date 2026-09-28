import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { LEGACY_STAGE_WEIGHTS, SEED_STAGE_CODES } from '@/lib/stages';
import type { CurrentUser } from '@/lib/session';

/**
 * Tester doc lap P7-C2: bo sung bien ma ke hoach da neu ten o Task 3
 * ("createProjectAction: stageWeights co gui -> kiem cung tap voi giai doan dang dung TRUOC khi
 * tao du an, lech -> 'stages_changed'") nhung chua co test nao trong actions.test.ts /
 * actions-key-milestones.test.ts / actions-project.qa.test.ts kiem truc tiep duong nay.
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
  projectName: 'DU AN TEST P7C2 TESTER', customerId: 1, teamKdId: 1, marketCode: 'TN' as const,
  projectType: 'EPC' as const, priority: 'P1' as const, contractValue: 10,
  tonnage: 100, plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
};

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('createProjectAction + stageWeights (P7-C2 Task 3, kiem thu doc lap)', () => {
  it('duong chay thuan loi: gui du 8 dong LEGACY (dung tap dang dung) -> ok, du an moi co dung 8 dong trong so', async () => {
    const before = repo.listProjects().length;
    const res = await createProjectAction({ ...base, stageWeights: LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w })) });

    expect(res.ok).toBe(true);
    expect(repo.listProjects()).toHaveLength(before + 1);
    const rows = repo.getStageWeights(res.id!);
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.stageCode).sort()).toEqual([...SEED_STAGE_CODES].sort());
  });

  it("bien tu ke hoach: chi gui 7 dong (thieu settlement) -> { ok:false, error:'stages_changed' }, KHONG tao du an moi", async () => {
    const before = repo.listProjects().length;
    const rows7 = LEGACY_STAGE_WEIGHTS.filter((w) => w.stageCode !== 'settlement').map((w) => ({ ...w }));

    const res = await createProjectAction({ ...base, stageWeights: rows7 });

    expect(res).toEqual({ ok: false, error: 'stages_changed' });
    expect(repo.listProjects()).toHaveLength(before);
    expect(repo.listProjects().some((p) => p.projectName === base.projectName)).toBe(false);
  });

  it('bien tu ke hoach: gui thua 1 ma la (khong thuoc dim_stage dang dung) -> stages_changed, khong tao du an', async () => {
    const before = repo.listProjects().length;
    const rowsExtra = [...LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w })), { stageCode: 'khong_ton_tai', weightPct: 0, applicable: true }];

    const res = await createProjectAction({ ...base, stageWeights: rowsExtra });

    expect(res).toEqual({ ok: false, error: 'stages_changed' });
    expect(repo.listProjects()).toHaveLength(before);
  });

  it('truong hop phai that bai: tong trong so khac 100 (dung du 8 ma) -> weights_invalid, khong tao du an', async () => {
    const before = repo.listProjects().length;
    const rowsBadSum = LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w, weightPct: w.stageCode === 'design' ? w.weightPct + 5 : w.weightPct }));

    const res = await createProjectAction({ ...base, stageWeights: rowsBadSum });

    expect(res).toEqual({ ok: false, error: 'weights_invalid' });
    expect(repo.listProjects()).toHaveLength(before);
  });

  // Vong sua reviewer (muc 3): stageWeights BAT BUOC khi tao du an - thieu (hoac mang rong) khong
  // con duoc am tham roi ve bo mac dinh nua (truoc day K7 cho phep, nhung bo mac dinh co Thanh quyet
  // toan 2% khien luat Q1a khong dem duoc du an nay, van ngung dung duoc giai doan do).
  it("khong gui stageWeights -> { ok:false, error:'weights_required' }, KHONG tao du an moi", async () => {
    const before = repo.listProjects().length;
    const res = await createProjectAction(base);
    expect(res).toEqual({ ok: false, error: 'weights_required' });
    expect(repo.listProjects()).toHaveLength(before);
  });
});
