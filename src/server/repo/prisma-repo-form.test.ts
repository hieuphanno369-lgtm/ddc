import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  projectFindUnique, projectFindFirst, projectCreate, projectUpdate, projectAliasFindMany, projectAliasFindFirst,
  projectAliasCreate, projectAliasUpdate, projectHistoryCreate, projectStageWeightFindMany,
  projectStageWeightDeleteMany, projectStageWeightCreateMany, projectEquipmentPlanFindMany,
  projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany, projectAssignmentFindUnique,
  projectAssignmentFindFirst, projectAssignmentUpdate, projectAssignmentCreate, projectAssignmentDelete,
  auditCreate, executeRaw, transactionMock,
  projectEquipmentQuotaFindMany, projectEquipmentQuotaDeleteMany, projectEquipmentQuotaCreateMany,
  projectManpowerPlanMonthFindMany, projectManpowerPlanMonthDeleteMany, projectManpowerPlanMonthCreateMany,
  projectShiftRatioFindMany, projectShiftRatioDeleteMany, projectShiftRatioCreateMany, shiftFindMany,
  stageFindMany,
} = vi.hoisted(() => {
  // Vong sua reviewer (tao du an nguyen tu): du lieu mac dinh du de `mapProject` (prisma-repo.ts)
  // chay duoc sau khi createProject tra ve (createdAt/updatedAt phai la Date that de goi .toISOString()).
  const PROJECT_ROW_DEFAULTS = {
    createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
    isActive: true, contractDate: null, plannedStartDate: null, plannedFinishDate: null,
    committedHandoverDate: null, actualStartDate: null, actualFinishDate: null, penaltyValue: null,
    penalized: false, factoryId: null, contractValueOriginal: null,
  };
  let nextProjectId = 501;
  const projectFindUnique = vi.fn(async () => ({
    id: 7, currentAliasCode: 'OLD-CODE', createdAt: new Date('2026-01-01T00:00:00Z'),
  }));
  const projectFindFirst = vi.fn(async () => null as unknown);
  const projectCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: nextProjectId++, ...PROJECT_ROW_DEFAULTS, ...args.data,
  }));
  const projectUpdate = vi.fn(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({
    id: args.where.id, ...PROJECT_ROW_DEFAULTS, ...args.data,
  }));
  const projectAliasFindMany = vi.fn(async () => [] as unknown[]);
  const projectAliasFindFirst = vi.fn(async () => null as unknown);
  const projectAliasCreate = vi.fn(async () => ({}));
  const projectAliasUpdate = vi.fn(async () => ({}));
  const projectHistoryCreate = vi.fn(async () => ({}));
  const projectStageWeightFindMany = vi.fn(async () => [] as unknown[]);
  const projectStageWeightDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectStageWeightCreateMany = vi.fn(async () => ({ count: 0 }));
  const projectEquipmentPlanFindMany = vi.fn(async () => [] as unknown[]);
  const projectEquipmentPlanDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectEquipmentPlanCreateMany = vi.fn(async () => ({ count: 0 }));
  const projectAssignmentFindUnique = vi.fn(async () => null as unknown);
  const projectAssignmentFindFirst = vi.fn(async () => null as unknown);
  const projectAssignmentUpdate = vi.fn(async () => ({}));
  const projectAssignmentCreate = vi.fn(async () => ({}));
  const projectAssignmentDelete = vi.fn(async () => ({}));
  const auditCreate = vi.fn(async () => ({}));
  const executeRaw = vi.fn(async () => 1);
  const projectEquipmentQuotaFindMany = vi.fn(async () => [] as unknown[]);
  const projectEquipmentQuotaDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectEquipmentQuotaCreateMany = vi.fn(async () => ({ count: 0 }));
  const projectManpowerPlanMonthFindMany = vi.fn(async () => [] as unknown[]);
  const projectManpowerPlanMonthDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectManpowerPlanMonthCreateMany = vi.fn(async () => ({ count: 0 }));
  const projectShiftRatioFindMany = vi.fn(async () => [] as unknown[]);
  const projectShiftRatioDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectShiftRatioCreateMany = vi.fn(async () => ({ count: 0 }));
  const shiftFindMany = vi.fn(async () => [] as unknown[]);
  const stageFindMany = vi.fn(async () => [] as unknown[]);
  const client = {
    project: { create: projectCreate, findUnique: projectFindUnique, findFirst: projectFindFirst, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, findFirst: projectAliasFindFirst, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    projectEquipmentQuota: { findMany: projectEquipmentQuotaFindMany, deleteMany: projectEquipmentQuotaDeleteMany, createMany: projectEquipmentQuotaCreateMany },
    projectManpowerPlanMonth: { findMany: projectManpowerPlanMonthFindMany, deleteMany: projectManpowerPlanMonthDeleteMany, createMany: projectManpowerPlanMonthCreateMany },
    projectShiftRatio: { findMany: projectShiftRatioFindMany, deleteMany: projectShiftRatioDeleteMany, createMany: projectShiftRatioCreateMany },
    shift: { findMany: shiftFindMany },
    stage: { findMany: stageFindMany },
    projectAssignment: {
      findUnique: projectAssignmentFindUnique, findFirst: projectAssignmentFindFirst,
      update: projectAssignmentUpdate, create: projectAssignmentCreate, delete: projectAssignmentDelete,
    },
    auditLog: { create: auditCreate },
    $executeRaw: executeRaw,
  };
  const transactionMock = vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client));
  return {
    projectFindUnique, projectFindFirst, projectCreate, projectUpdate, projectAliasFindMany, projectAliasFindFirst,
    projectAliasCreate, projectAliasUpdate, projectHistoryCreate, projectStageWeightFindMany,
    projectStageWeightDeleteMany, projectStageWeightCreateMany, projectEquipmentPlanFindMany,
    projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany, projectAssignmentFindUnique,
    projectAssignmentFindFirst, projectAssignmentUpdate, projectAssignmentCreate, projectAssignmentDelete,
    auditCreate, executeRaw, transactionMock,
    projectEquipmentQuotaFindMany, projectEquipmentQuotaDeleteMany, projectEquipmentQuotaCreateMany,
    projectManpowerPlanMonthFindMany, projectManpowerPlanMonthDeleteMany, projectManpowerPlanMonthCreateMany,
    projectShiftRatioFindMany, projectShiftRatioDeleteMany, projectShiftRatioCreateMany, shiftFindMany,
    stageFindMany,
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    project: { create: projectCreate, findUnique: projectFindUnique, findFirst: projectFindFirst, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, findFirst: projectAliasFindFirst, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    projectEquipmentQuota: { findMany: projectEquipmentQuotaFindMany, deleteMany: projectEquipmentQuotaDeleteMany, createMany: projectEquipmentQuotaCreateMany },
    projectManpowerPlanMonth: { findMany: projectManpowerPlanMonthFindMany, deleteMany: projectManpowerPlanMonthDeleteMany, createMany: projectManpowerPlanMonthCreateMany },
    projectShiftRatio: { findMany: projectShiftRatioFindMany, deleteMany: projectShiftRatioDeleteMany, createMany: projectShiftRatioCreateMany },
    shift: { findMany: shiftFindMany },
    stage: { findMany: stageFindMany },
    projectAssignment: {
      findUnique: projectAssignmentFindUnique, findFirst: projectAssignmentFindFirst,
      update: projectAssignmentUpdate, create: projectAssignmentCreate, delete: projectAssignmentDelete,
    },
    auditLog: { create: auditCreate },
    $executeRaw: executeRaw,
    $transaction: transactionMock,
  },
}));

import { StagesChangedError } from '@/lib/stages';
import { repo } from './prisma-repo';

beforeEach(() => {
  transactionMock.mockClear();
  auditCreate.mockClear();
  projectAliasCreate.mockClear();
  projectAliasUpdate.mockClear();
  projectAliasFindMany.mockClear();
  projectAliasFindFirst.mockClear();
  projectAliasFindFirst.mockResolvedValue(null);
  projectFindFirst.mockClear();
  projectFindFirst.mockResolvedValue(null);
  projectCreate.mockClear();
  projectHistoryCreate.mockClear();
  projectStageWeightDeleteMany.mockClear();
  projectStageWeightCreateMany.mockClear();
  projectEquipmentPlanFindMany.mockClear();
  projectEquipmentPlanDeleteMany.mockClear();
  projectEquipmentPlanCreateMany.mockClear();
  projectAssignmentFindUnique.mockClear();
  projectAssignmentFindUnique.mockResolvedValue(null);
  projectAssignmentFindFirst.mockClear();
  projectAssignmentFindFirst.mockResolvedValue(null);
  projectAssignmentUpdate.mockClear();
  projectAssignmentCreate.mockClear();
  projectAssignmentDelete.mockClear();
  executeRaw.mockClear();
  projectEquipmentQuotaFindMany.mockClear();
  projectEquipmentQuotaFindMany.mockResolvedValue([]);
  projectEquipmentQuotaDeleteMany.mockClear();
  projectEquipmentQuotaCreateMany.mockClear();
  projectManpowerPlanMonthFindMany.mockClear();
  projectManpowerPlanMonthFindMany.mockResolvedValue([]);
  projectManpowerPlanMonthDeleteMany.mockClear();
  projectManpowerPlanMonthCreateMany.mockClear();
  projectShiftRatioFindMany.mockClear();
  projectShiftRatioFindMany.mockResolvedValue([]);
  projectShiftRatioDeleteMany.mockClear();
  projectShiftRatioCreateMany.mockClear();
  shiftFindMany.mockClear();
  shiftFindMany.mockResolvedValue([]);
  stageFindMany.mockClear();
  stageFindMany.mockResolvedValue([]);
});

describe('prisma-repo.changeProjectCode', () => {
  it('chay trong $transaction, ghi audit dim_project_alias', async () => {
    const res = await repo.changeProjectCode(7, 'NEW-CODE', 'ly do doi ma', 'admin@x', '2026-09-16');
    expect(res).toBe('changed');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(projectHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 7, by: 'admin@x', note: 'currentAliasCode: OLD-CODE → NEW-CODE' }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'dim_project_alias', recordId: '7', changedBy: 'admin@x' }),
    });
  });

  it('ma khong doi -> unchanged, khong mo transaction ghi gi them', async () => {
    const res = await repo.changeProjectCode(7, 'OLD-CODE', 'ly do', 'admin@x', '2026-09-16');
    expect(res).toBe('unchanged');
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('S-2: tx kiem trung (project.findFirst) -> "taken", khong goi projectAlias.create', async () => {
    projectFindFirst.mockResolvedValueOnce({ id: 99 });
    const res = await repo.changeProjectCode(7, 'DA-TON-TAI', 'ly do', 'admin@x', '2026-09-16');
    expect(res).toBe('taken');
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(projectAliasCreate).not.toHaveBeenCalled();
    expect(projectHistoryCreate).not.toHaveBeenCalled();
  });

  it('S-2: P2002 gia lap khi update -> "taken"', async () => {
    projectUpdate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', { code: 'P2002', clientVersion: '6.19.3', meta: { target: ['lower(currentAliasCode)'] } }));
    const res = await repo.changeProjectCode(7, 'NEW-CODE-2', 'ly do', 'admin@x', '2026-09-16');
    expect(res).toBe('taken');
  });
});

describe('prisma-repo.replaceStageWeights', () => {
  const rows = [
    { stageCode: 'design' as const, weightPct: 100, applicable: true },
    { stageCode: 'shop' as const, weightPct: 0, applicable: false },
    { stageCode: 'procurement' as const, weightPct: 0, applicable: false },
    { stageCode: 'fabrication' as const, weightPct: 0, applicable: false },
    { stageCode: 'transport' as const, weightPct: 0, applicable: false },
    { stageCode: 'erection' as const, weightPct: 0, applicable: false },
    { stageCode: 'handover' as const, weightPct: 0, applicable: false },
  ];

  beforeEach(() => {
    // Mac dinh: tap giai doan dang dung (dim_stage) dung bang cac ma trong `rows` - khong lech.
    stageFindMany.mockResolvedValue(rows.map((r) => ({ code: r.stageCode })));
  });

  // T-4 (vong sua bao mat): deleteMany CHI duoc xoa dong cua ma co trong `rows` gui len (them dieu
  // kien `stageCode: { in: ... }`) - KHONG con xoa het theo `projectId` nhu truoc (se xoa ca dong
  // cua giai doan da ngung dung, khong nam trong `rows` vi form khong hien thi no).
  it('chay trong $transaction, khoa dim_stage, CHI xoa dong cua ma dang gui (T-4), tao lai, ghi audit', async () => {
    const res = await repo.replaceStageWeights(7, rows, 'admin@x');
    expect(res).toBe('ok');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(projectStageWeightDeleteMany).toHaveBeenCalledWith({
      where: { projectId: 7, stageCode: { in: rows.map((r) => r.stageCode) } },
    });
    expect(projectStageWeightCreateMany).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_stage_weight', recordId: '7', field: 'replace', changedBy: 'admin@x' }),
    });
  });

  // Vong sua reviewer, muc 2a (T-3 phia nguoi nhap): admin ngung dung 1 giai doan (vd 'handover')
  // NGAY LUC dang luu trong so -> tap dang dung (dim_stage, doc lai TRONG transaction) khac voi ma
  // gui len -> tra 'stages_changed', KHONG xoa/ghi gi (chong sot dong trong so cua giai doan vua
  // ngung dung, khac voi kiem o actions-project.ts vi kiem do chay TRUOC transaction nay).
  it("tap giai doan dang dung doc lai TRONG transaction khac voi rows -> 'stages_changed', khong xoa/tao/ghi audit", async () => {
    stageFindMany.mockResolvedValueOnce(rows.filter((r) => r.stageCode !== 'handover').map((r) => ({ code: r.stageCode })));
    const res = await repo.replaceStageWeights(7, rows, 'admin@x');
    expect(res).toBe('stages_changed');
    expect(projectStageWeightDeleteMany).not.toHaveBeenCalled();
    expect(projectStageWeightCreateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

/**
 * Vong sua reviewer (tao du an nguyen tu): TDD - test do TRUOC khi sua (xem prisma-repo.ts). Bug cua
 * vong sua truoc: `repo.createProject` commit xong ROI `actions.ts` moi goi RIENG `repo.replaceStageWeights`
 * - neu ham do tra 'stages_changed' (admin ngung/dung lai giai doan xen giua) thi du an DA duoc tao
 * nhung thieu trong so, nua voi. Gio `stageWeights` duoc ghi TRONG CUNG 1 `$transaction` voi viec tao
 * du an (goi `replaceStageWeightsInTx` dung chung voi `replaceStageWeights` o tren).
 */
describe('prisma-repo.createProject + stageWeights (vong sua reviewer: tao du an nguyen tu)', () => {
  const rows = [
    { stageCode: 'design' as const, weightPct: 100, applicable: true },
    { stageCode: 'shop' as const, weightPct: 0, applicable: false },
    { stageCode: 'procurement' as const, weightPct: 0, applicable: false },
    { stageCode: 'fabrication' as const, weightPct: 0, applicable: false },
    { stageCode: 'transport' as const, weightPct: 0, applicable: false },
    { stageCode: 'erection' as const, weightPct: 0, applicable: false },
    { stageCode: 'handover' as const, weightPct: 0, applicable: false },
  ];
  const BASE_INPUT = {
    projectName: 'DU AN NGUYEN TU', customerId: 1, teamKdId: 1, marketCode: 'TN' as const,
    projectType: 'EPC' as const, priority: 'P1' as const, contractValue: 10, tonnage: 100,
  };

  beforeEach(() => {
    // Mac dinh: tap giai doan dang dung (dim_stage) dung bang cac ma trong `rows` - khong lech.
    stageFindMany.mockResolvedValue(rows.map((r) => ({ code: r.stageCode })));
  });

  it('stageWeights khop tap dang dung -> tao du an xong, khoa+ghi trong so TRONG CUNG 1 $transaction (khong tach lam 2 lan goi repo)', async () => {
    const res = await repo.createProject({ ...BASE_INPUT, stageWeights: rows }, 'admin@x');

    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Thu tu khoa: khoa ma du an TRUOC (mock.calls[0]), khoa dim_stage SAU (mock.calls[1]) - xem ghi
    // chu thu tu khoa o `replaceStageWeightsInTx` (prisma-repo-form.ts).
    expect(executeRaw).toHaveBeenCalledTimes(2);
    const secondLockCall = executeRaw.mock.calls[1] as unknown as [string[]];
    expect(secondLockCall[0][0]).toContain('dim_stage');
    expect(projectStageWeightDeleteMany).toHaveBeenCalledWith({
      where: { projectId: res.id, stageCode: { in: rows.map((r) => r.stageCode) } },
    });
    expect(projectStageWeightCreateMany).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_stage_weight', recordId: String(res.id), field: 'replace', changedBy: 'admin@x' }),
    });
  });

  it("tap giai doan dang dung doc lai TRONG transaction KHAC voi stageWeights gui len -> nem StagesChangedError, KHONG ghi dong trong so nao (du an that se duoc Postgres tu rollback het, khong con dong nao)", async () => {
    stageFindMany.mockResolvedValueOnce(rows.filter((r) => r.stageCode !== 'handover').map((r) => ({ code: r.stageCode })));

    await expect(repo.createProject({ ...BASE_INPUT, stageWeights: rows }, 'admin@x')).rejects.toBeInstanceOf(StagesChangedError);

    expect(projectStageWeightDeleteMany).not.toHaveBeenCalled();
    expect(projectStageWeightCreateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tableName: 'project_stage_weight' }),
    }));
  });

  it('khong gui stageWeights -> tao du an nhu cu, khong khoa/doc dim_stage, khong ghi trong so', async () => {
    const res = await repo.createProject({ ...BASE_INPUT }, 'admin@x');
    expect(res.id).toBeGreaterThan(0);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(projectStageWeightCreateMany).not.toHaveBeenCalled();
  });
});

describe('prisma-repo.replaceEquipmentPlans (P3C-A)', () => {
  it('chay trong $transaction, xoa roi tao lai ca 2 bang, tao quota + dot voi unitNo null, ghi audit', async () => {
    await repo.replaceEquipmentPlans(7, [
      { equipmentId: 1, totalQty: 5, segments: [{ from: '2026-09-01', to: '2026-09-10', qty: 2 }] },
    ], 'admin@x');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(projectEquipmentPlanDeleteMany).toHaveBeenCalledWith({ where: { projectId: 7 } });
    expect(projectEquipmentQuotaFindMany).toHaveBeenCalledWith({ where: { projectId: 7 } });
    expect(projectEquipmentPlanCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        projectId: 7, equipmentId: 1, unitNo: null, qty: 2, workItemId: null, note: '', updatedBy: 'admin@x',
      })],
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_equipment_plan', recordId: '7', field: 'replace', changedBy: 'admin@x' }),
    });
  });
});

describe('prisma-repo.replaceManpowerPlan (P3C-A)', () => {
  it('doi 1 thang -> xoa/tao lai dung thang do, ghi audit tung thang thay doi', async () => {
    shiftFindMany.mockResolvedValueOnce([{ code: 'morning', sortOrder: 1 }, { code: 'evening', sortOrder: 2 }]);
    projectManpowerPlanMonthFindMany.mockResolvedValueOnce([
      { yearMonth: '2026-09', shiftCode: 'morning', planned: 540, isManual: false },
      { yearMonth: '2026-09', shiftCode: 'evening', planned: 360, isManual: false },
    ]);
    projectShiftRatioFindMany.mockResolvedValueOnce([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }]);

    const res = await repo.replaceManpowerPlan(7, {
      ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
      months: [{ yearMonth: '2026-09', cells: [
        { shiftCode: 'morning', planned: 600, isManual: true }, { shiftCode: 'evening', planned: 300, isManual: false },
      ] }],
    }, 'admin@x');

    expect(res).toEqual({ changedMonths: 1, ratioChanged: false });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(projectManpowerPlanMonthDeleteMany).toHaveBeenCalledWith({ where: { projectId: 7, yearMonth: { in: ['2026-09'] } } });
    expect(projectManpowerPlanMonthCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ projectId: 7, yearMonth: '2026-09', shiftCode: 'morning', planned: 600, isManual: true, updatedBy: 'admin@x' }),
        expect.objectContaining({ projectId: 7, yearMonth: '2026-09', shiftCode: 'evening', planned: 300, isManual: false, updatedBy: 'admin@x' }),
      ],
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableName: 'project_manpower_plan_month', recordId: '7/2026-09', field: 'planned',
        oldValue: 'morning:540,evening:360', newValue: 'morning:600(m),evening:300', changedBy: 'admin@x',
      }),
    });
    expect(projectShiftRatioDeleteMany).not.toHaveBeenCalled();
  });

  it('khong doi gi -> khong goi deleteMany/createMany, khong ghi audit', async () => {
    shiftFindMany.mockResolvedValueOnce([{ code: 'morning', sortOrder: 1 }, { code: 'evening', sortOrder: 2 }]);
    projectManpowerPlanMonthFindMany.mockResolvedValueOnce([
      { yearMonth: '2026-09', shiftCode: 'morning', planned: 540, isManual: false },
      { yearMonth: '2026-09', shiftCode: 'evening', planned: 360, isManual: false },
    ]);
    projectShiftRatioFindMany.mockResolvedValueOnce([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }]);

    const res = await repo.replaceManpowerPlan(7, {
      ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
      months: [{ yearMonth: '2026-09', cells: [
        { shiftCode: 'morning', planned: 540, isManual: false }, { shiftCode: 'evening', planned: 360, isManual: false },
      ] }],
    }, 'admin@x');

    expect(res).toEqual({ changedMonths: 0, ratioChanged: false });
    expect(projectManpowerPlanMonthDeleteMany).not.toHaveBeenCalled();
    expect(projectManpowerPlanMonthCreateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('prisma-repo.setProjectMember', () => {
  it('them moi -> "added", chay trong $transaction, ghi audit', async () => {
    const res = await repo.setProjectMember(7, 'pm@daidung.com.vn', 'Backup', 'admin@x');
    expect(res).toBe('added');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_assignments', recordId: '7/pm@daidung.com.vn', changedBy: 'admin@x' }),
    });
  });

  it('S-6: tx kiem lai da co PIC khac (projectAssignment.findFirst) -> "pic_exists"', async () => {
    projectAssignmentFindFirst.mockResolvedValueOnce({ userEmail: 'khac@daidung.com.vn', roleInProject: 'PIC' });
    const res = await repo.setProjectMember(7, 'pm@daidung.com.vn', 'PIC', 'admin@x');
    expect(res).toBe('pic_exists');
    expect(projectAssignmentCreate).not.toHaveBeenCalled();
  });

  it('S-6: P2002 gia lap (partial unique index) -> "pic_exists"', async () => {
    projectAssignmentCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', { code: 'P2002', clientVersion: '6.19.3', meta: { target: ['projectId'] } }));
    const res = await repo.setProjectMember(7, 'pm@daidung.com.vn', 'PIC', 'admin@x');
    expect(res).toBe('pic_exists');
  });

  it('N-1 + I-1: P2002 tren khoa chinh (projectId, userEmail) - 2 admin cung them 1 Backup -> "unchanged", KHONG bao nham "pic_exists"', async () => {
    projectAssignmentCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', { code: 'P2002', clientVersion: '6.19.3', meta: { target: ['projectId', 'userEmail'] } }));
    projectAssignmentFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ projectId: 7, userEmail: 'pm@daidung.com.vn', roleInProject: 'Backup' });
    await expect(repo.setProjectMember(7, 'pm@daidung.com.vn', 'Backup', 'admin@x')).resolves.toBe('unchanged');
  });

  it('I-1: P2002 khoa chinh nhung ben kia luu KHAC vai (PIC) -> nem nguyen loi, khong bao "unchanged" sai', async () => {
    projectAssignmentCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('trung', { code: 'P2002', clientVersion: '6.19.3', meta: { target: ['projectId', 'userEmail'] } }));
    projectAssignmentFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ projectId: 7, userEmail: 'pm@daidung.com.vn', roleInProject: 'PIC' });
    await expect(repo.setProjectMember(7, 'pm@daidung.com.vn', 'Backup', 'admin@x')).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});

describe('prisma-repo.removeProjectMember', () => {
  it('chay trong $transaction, ghi audit', async () => {
    projectAssignmentFindUnique.mockResolvedValueOnce({ roleInProject: 'Backup' });
    const res = await repo.removeProjectMember(7, 'pm@daidung.com.vn', 'admin@x');
    expect(res).toBe('removed');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_assignments', recordId: '7/pm@daidung.com.vn', changedBy: 'admin@x' }),
    });
  });
});

describe('P3C-A: 4 ham doc hop dong (prisma-repo-form)', () => {
  it('readEquipmentPlanSegments: goi findMany dung where/orderBy/include, map Date -> YYYY-MM-DD', async () => {
    projectEquipmentPlanFindMany.mockResolvedValueOnce([
      {
        id: 1, equipmentId: 1, qty: 3,
        plannedStart: new Date('2026-08-31T00:00:00Z'), plannedFinish: new Date('2026-10-25T00:00:00Z'),
        equipment: { name: 'Cẩu bánh xích' },
      },
    ]);
    const rows = await repo.readEquipmentPlanSegments(7);
    expect(projectEquipmentPlanFindMany).toHaveBeenCalledWith({
      where: { projectId: 7 },
      include: { equipment: { select: { name: true } } },
      orderBy: [{ equipmentId: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }],
    });
    expect(rows).toEqual([{ id: 1, equipmentId: 1, equipmentName: 'Cẩu bánh xích', from: '2026-08-31', to: '2026-10-25', qty: 3 }]);
  });

  it('readEquipmentQuotas: goi findMany dung where/orderBy/include', async () => {
    projectEquipmentQuotaFindMany.mockResolvedValueOnce([{ equipmentId: 2, totalQty: 2, equipment: { name: 'Cẩu bánh lốp' } }]);
    const rows = await repo.readEquipmentQuotas(7);
    expect(projectEquipmentQuotaFindMany).toHaveBeenCalledWith({
      where: { projectId: 7 }, include: { equipment: { select: { name: true } } }, orderBy: { equipmentId: 'asc' },
    });
    expect(rows).toEqual([{ equipmentId: 2, equipmentName: 'Cẩu bánh lốp', totalQty: 2 }]);
  });

  it('readManpowerPlanMonths: goi findMany dung where/include, sort theo yearMonth + sortOrder ca', async () => {
    projectManpowerPlanMonthFindMany.mockResolvedValueOnce([
      { yearMonth: '2026-09', shiftCode: 'evening', planned: 180, isManual: false, shift: { sortOrder: 2 } },
      { yearMonth: '2026-09', shiftCode: 'morning', planned: 270, isManual: false, shift: { sortOrder: 1 } },
    ]);
    const rows = await repo.readManpowerPlanMonths(7);
    expect(projectManpowerPlanMonthFindMany).toHaveBeenCalledWith({
      where: { projectId: 7 }, include: { shift: { select: { sortOrder: true } } },
    });
    expect(rows).toEqual([
      { yearMonth: '2026-09', shiftCode: 'morning', planned: 270, isManual: false },
      { yearMonth: '2026-09', shiftCode: 'evening', planned: 180, isManual: false },
    ]);
  });

  it('readShiftRatios: khong co dong -> mac dinh theo ca active (sortOrder)', async () => {
    shiftFindMany.mockResolvedValueOnce([{ code: 'morning' }, { code: 'evening' }]);
    const rows = await repo.readShiftRatios(7);
    expect(shiftFindMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    expect(projectShiftRatioFindMany).toHaveBeenCalledWith({ where: { projectId: 7 } });
    expect(rows).toEqual([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }]);
  });
});
