import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';
import { SEED_STAGE_CODES, StagesChangedError, LEGACY_STAGE_WEIGHTS } from '@/lib/stages';

/**
 * Tester vong 3 (doc lap): kiem lai truc tiep o tang repo (mock-repo.createProject), KHONG di qua
 * createProjectAction va KHONG dung vi.spyOn - nham xac nhan phong thu that su nam o repo, khong
 * chi o fast-path cua action. Xem thay-doi.md muc "Vong sua theo reviewer - tao du an nguyen tu".
 */
beforeEach(() => repo.reset());

const BASE_INPUT = {
  projectName: 'DU AN TESTER VONG 3', customerId: 1, teamKdId: 1, marketCode: 'NoiBo' as const,
  projectType: 'Khac' as const, priority: 'P2' as const, contractValue: 10, tonnage: 100,
  plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
};

describe('mock-repo.createProject + stageWeights (tester vong 3, goi truc tiep repo)', () => {
  it('duong chay thuan loi: stageWeights khop dung tap 8 giai doan dang dung -> tao du an, du lieu trong so doc lai dung nhu da gui, audit co tien to "default "', () => {
    const rows = LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w }));
    const beforeCount = repo.listProjects().length;

    const created = repo.createProject({ ...BASE_INPUT, stageWeights: rows }, 'admin@x');

    expect(repo.listProjects()).toHaveLength(beforeCount + 1);
    const saved = repo.getStageWeights(created.id);
    expect(saved).toHaveLength(8);
    expect(saved.map((r) => r.stageCode).sort()).toEqual([...SEED_STAGE_CODES].sort());
    expect(saved.find((r) => r.stageCode === 'fabrication')?.weightPct).toBe(40);
    const entry = repo.getAuditLog().filter((a) => a.tableName === 'project_stage_weight').pop();
    expect(entry?.oldValue.startsWith('default ')).toBe(true);
  });

  // Bien: gia lap dung KHOANG THOI GIAN khi 1 giai doan bi ngung dung XEN GIUA luc nguoi goi doc
  // tap giai doan (de dung sinh `rows`) va luc thuc su goi createProject - o day mo phong bang cach
  // ngung dung MOT giai doan TRUOC khi goi createProject voi bo rows CU (van con du 8 ma).
  it('bien: tap giai doan dang dung da doi (1 giai doan vua ngung dung) truoc khi ghi -> nem StagesChangedError, KHONG co du an nao duoc tao, KHONG co dong trong so mo coi nao duoc ghi', () => {
    const staleRows = LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w })); // du 8 ma, ke ca 'settlement'
    expect(repo.setStageActive('settlement', false, 'admin_khac@x')).toBe('ok');
    const beforeCount = repo.listProjects().length;
    const beforeAuditLen = repo.getAuditLog().length;

    expect(() => repo.createProject({ ...BASE_INPUT, stageWeights: staleRows }, 'admin@x')).toThrow(StagesChangedError);

    expect(repo.listProjects()).toHaveLength(beforeCount);
    expect(repo.listProjects().some((p) => p.projectName === BASE_INPUT.projectName)).toBe(false);
    // Khong ghi audit "project_stage_weight" nao moi (du an chua kip tao thi khong co gi de ghi trong so).
    expect(repo.getAuditLog().slice(beforeAuditLen).some((a) => a.tableName === 'project_stage_weight')).toBe(false);
  });

  // Bien: mang rong truyen thang xuong repo (khac voi action - action da chan truoc bang
  // 'weights_required'). O tang repo, mang rong duoc coi la "co gui" (truthy) nhung khong khop tap
  // dang dung (8 ma) nen phai bi tu choi bang StagesChangedError, KHONG duoc am tham tao du an
  // roi coi nhu "khong gui gi" (se lam du an khong co dong trong so rieng nao).
  it('bien: stageWeights la mang rong ([]) goi truc tiep repo -> StagesChangedError (khong lam du an nua voi), khac voi action da chan bang weights_required o lop tren', () => {
    const beforeCount = repo.listProjects().length;
    expect(() => repo.createProject({ ...BASE_INPUT, stageWeights: [] }, 'admin@x')).toThrow(StagesChangedError);
    expect(repo.listProjects()).toHaveLength(beforeCount);
  });

  // Truong hop PHAI THAT BAI: gui kem 1 ma giai doan khong ton tai trong dim_stage.
  it('phai that bai: stageWeights co 1 ma la khong thuoc dim_stage dang dung -> StagesChangedError, khong tao du an, khong ro ri dong trong so cua ma la', () => {
    const rowsWithGhost = [
      ...LEGACY_STAGE_WEIGHTS.map((w) => ({ ...w })),
      { stageCode: 'khong_ton_tai_zzz', weightPct: 0, applicable: true },
    ];
    const beforeCount = repo.listProjects().length;

    expect(() => repo.createProject({ ...BASE_INPUT, stageWeights: rowsWithGhost }, 'admin@x')).toThrow(StagesChangedError);

    expect(repo.listProjects()).toHaveLength(beforeCount);
    expect(repo.listProjects().every((p) => repo.getStageWeights(p.id).every((w) => w.stageCode !== 'khong_ton_tai_zzz'))).toBe(true);
  });

  it('khong gui stageWeights (undefined) -> tao du an binh thuong nhu truoc vong sua, khong ghi dong trong so nao rieng', () => {
    const created = repo.createProject({ ...BASE_INPUT }, 'admin@x');
    // Du an chua co dong rieng nen getStageWeights fallback nhu repo dinh nghia (khong assert cu the
    // o day vi khong phai pham vi vong sua nay - chi xac nhan KHONG co dong nao duoc tao THEM cho du
    // an nay boi createProject, tuc replaceStageWeightsIn khong duoc goi).
    const auditForThis = repo.getAuditLog().filter((a) => a.tableName === 'project_stage_weight' && a.recordId === String(created.id));
    expect(auditForThis).toHaveLength(0);
  });
});
