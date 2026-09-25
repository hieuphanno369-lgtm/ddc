import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectFindUnique, projectUpdate, projectAliasFindMany, projectAliasCreate, projectAliasUpdate,
  projectHistoryCreate, projectStageWeightFindMany, projectStageWeightDeleteMany, projectStageWeightCreateMany,
  projectEquipmentPlanFindMany, projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany,
  auditCreate, transactionMock,
} = vi.hoisted(() => {
  const projectFindUnique = vi.fn(async () => ({
    id: 7, currentAliasCode: 'OLD-CODE', createdAt: new Date('2026-01-01T00:00:00Z'),
  }));
  const projectUpdate = vi.fn(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({ id: args.where.id, ...args.data }));
  const projectAliasFindMany = vi.fn(async () => [] as unknown[]);
  const projectAliasCreate = vi.fn(async () => ({}));
  const projectAliasUpdate = vi.fn(async () => ({}));
  const projectHistoryCreate = vi.fn(async () => ({}));
  const projectStageWeightFindMany = vi.fn(async () => [] as unknown[]);
  const projectStageWeightDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectStageWeightCreateMany = vi.fn(async () => ({ count: 0 }));
  const projectEquipmentPlanFindMany = vi.fn(async () => [] as unknown[]);
  const projectEquipmentPlanDeleteMany = vi.fn(async () => ({ count: 0 }));
  const projectEquipmentPlanCreateMany = vi.fn(async () => ({ count: 0 }));
  const auditCreate = vi.fn(async () => ({}));
  const client = {
    project: { findUnique: projectFindUnique, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    auditLog: { create: auditCreate },
  };
  const transactionMock = vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client));
  return {
    projectFindUnique, projectUpdate, projectAliasFindMany, projectAliasCreate, projectAliasUpdate,
    projectHistoryCreate, projectStageWeightFindMany, projectStageWeightDeleteMany, projectStageWeightCreateMany,
    projectEquipmentPlanFindMany, projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany,
    auditCreate, transactionMock,
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findUnique: projectFindUnique, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    auditLog: { create: auditCreate },
    $transaction: transactionMock,
  },
}));

import { repo } from './prisma-repo';

beforeEach(() => {
  transactionMock.mockClear();
  auditCreate.mockClear();
  projectAliasCreate.mockClear();
  projectAliasUpdate.mockClear();
  projectAliasFindMany.mockClear();
  projectHistoryCreate.mockClear();
  projectStageWeightDeleteMany.mockClear();
  projectStageWeightCreateMany.mockClear();
  projectEquipmentPlanFindMany.mockClear();
  projectEquipmentPlanDeleteMany.mockClear();
  projectEquipmentPlanCreateMany.mockClear();
});

describe('prisma-repo.changeProjectCode', () => {
  it('chay trong $transaction, ghi audit dim_project_alias', async () => {
    const res = await repo.changeProjectCode(7, 'NEW-CODE', 'ly do doi ma', 'admin@x', '2026-09-16');
    expect(res).toBe('changed');
    expect(transactionMock).toHaveBeenCalledTimes(1);
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

  it('chay trong $transaction, xoa roi tao lai, ghi audit', async () => {
    await repo.replaceStageWeights(7, rows, 'admin@x');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(projectStageWeightDeleteMany).toHaveBeenCalledWith({ where: { projectId: 7 } });
    expect(projectStageWeightCreateMany).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_stage_weight', recordId: '7', field: 'replace', changedBy: 'admin@x' }),
    });
  });
});

describe('prisma-repo.replaceEquipmentPlans', () => {
  it('chay trong $transaction, xoa roi tao lai, ghi audit', async () => {
    await repo.replaceEquipmentPlans(7, [
      { equipmentId: 1, unitNo: 1, workItemId: null, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '' },
    ], 'admin@x');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(projectEquipmentPlanDeleteMany).toHaveBeenCalledWith({ where: { projectId: 7 } });
    expect(projectEquipmentPlanCreateMany).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_equipment_plan', recordId: '7', field: 'replace', changedBy: 'admin@x' }),
    });
  });
});
