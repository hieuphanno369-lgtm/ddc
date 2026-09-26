import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  projectFindUnique, projectFindFirst, projectUpdate, projectAliasFindMany, projectAliasFindFirst,
  projectAliasCreate, projectAliasUpdate, projectHistoryCreate, projectStageWeightFindMany,
  projectStageWeightDeleteMany, projectStageWeightCreateMany, projectEquipmentPlanFindMany,
  projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany, projectAssignmentFindUnique,
  projectAssignmentFindFirst, projectAssignmentUpdate, projectAssignmentCreate, projectAssignmentDelete,
  auditCreate, executeRaw, transactionMock,
} = vi.hoisted(() => {
  const projectFindUnique = vi.fn(async () => ({
    id: 7, currentAliasCode: 'OLD-CODE', createdAt: new Date('2026-01-01T00:00:00Z'),
  }));
  const projectFindFirst = vi.fn(async () => null as unknown);
  const projectUpdate = vi.fn(async (args: { where: { id: number }; data: Record<string, unknown> }) => ({ id: args.where.id, ...args.data }));
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
  const client = {
    project: { findUnique: projectFindUnique, findFirst: projectFindFirst, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, findFirst: projectAliasFindFirst, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    projectAssignment: {
      findUnique: projectAssignmentFindUnique, findFirst: projectAssignmentFindFirst,
      update: projectAssignmentUpdate, create: projectAssignmentCreate, delete: projectAssignmentDelete,
    },
    auditLog: { create: auditCreate },
    $executeRaw: executeRaw,
  };
  const transactionMock = vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client));
  return {
    projectFindUnique, projectFindFirst, projectUpdate, projectAliasFindMany, projectAliasFindFirst,
    projectAliasCreate, projectAliasUpdate, projectHistoryCreate, projectStageWeightFindMany,
    projectStageWeightDeleteMany, projectStageWeightCreateMany, projectEquipmentPlanFindMany,
    projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany, projectAssignmentFindUnique,
    projectAssignmentFindFirst, projectAssignmentUpdate, projectAssignmentCreate, projectAssignmentDelete,
    auditCreate, executeRaw, transactionMock,
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findUnique: projectFindUnique, findFirst: projectFindFirst, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, findFirst: projectAliasFindFirst, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    projectAssignment: {
      findUnique: projectAssignmentFindUnique, findFirst: projectAssignmentFindFirst,
      update: projectAssignmentUpdate, create: projectAssignmentCreate, delete: projectAssignmentDelete,
    },
    auditLog: { create: auditCreate },
    $executeRaw: executeRaw,
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
  projectAliasFindFirst.mockClear();
  projectAliasFindFirst.mockResolvedValue(null);
  projectFindFirst.mockClear();
  projectFindFirst.mockResolvedValue(null);
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
    await expect(repo.setProjectMember(7, 'pm@daidung.com.vn', 'Backup', 'admin@x')).resolves.toBe('unchanged');
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
