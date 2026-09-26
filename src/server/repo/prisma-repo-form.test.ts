import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  projectFindUnique, projectFindFirst, projectUpdate, projectAliasFindMany, projectAliasFindFirst,
  projectAliasCreate, projectAliasUpdate, projectHistoryCreate, projectStageWeightFindMany,
  projectStageWeightDeleteMany, projectStageWeightCreateMany, projectEquipmentPlanFindMany,
  projectEquipmentPlanDeleteMany, projectEquipmentPlanCreateMany, projectAssignmentFindUnique,
  projectAssignmentFindFirst, projectAssignmentUpdate, projectAssignmentCreate, projectAssignmentDelete,
  auditCreate, executeRaw, transactionMock,
  projectEquipmentQuotaFindMany, projectEquipmentQuotaDeleteMany, projectEquipmentQuotaCreateMany,
  projectManpowerPlanMonthFindMany, projectManpowerPlanMonthDeleteMany, projectManpowerPlanMonthCreateMany,
  projectShiftRatioFindMany, projectShiftRatioDeleteMany, projectShiftRatioCreateMany, shiftFindMany,
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
  const client = {
    project: { findUnique: projectFindUnique, findFirst: projectFindFirst, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, findFirst: projectAliasFindFirst, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    projectEquipmentQuota: { findMany: projectEquipmentQuotaFindMany, deleteMany: projectEquipmentQuotaDeleteMany, createMany: projectEquipmentQuotaCreateMany },
    projectManpowerPlanMonth: { findMany: projectManpowerPlanMonthFindMany, deleteMany: projectManpowerPlanMonthDeleteMany, createMany: projectManpowerPlanMonthCreateMany },
    projectShiftRatio: { findMany: projectShiftRatioFindMany, deleteMany: projectShiftRatioDeleteMany, createMany: projectShiftRatioCreateMany },
    shift: { findMany: shiftFindMany },
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
    projectEquipmentQuotaFindMany, projectEquipmentQuotaDeleteMany, projectEquipmentQuotaCreateMany,
    projectManpowerPlanMonthFindMany, projectManpowerPlanMonthDeleteMany, projectManpowerPlanMonthCreateMany,
    projectShiftRatioFindMany, projectShiftRatioDeleteMany, projectShiftRatioCreateMany, shiftFindMany,
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findUnique: projectFindUnique, findFirst: projectFindFirst, update: projectUpdate },
    projectAlias: { findMany: projectAliasFindMany, findFirst: projectAliasFindFirst, create: projectAliasCreate, update: projectAliasUpdate },
    projectHistory: { create: projectHistoryCreate },
    projectStageWeight: { findMany: projectStageWeightFindMany, deleteMany: projectStageWeightDeleteMany, createMany: projectStageWeightCreateMany },
    projectEquipmentPlan: { findMany: projectEquipmentPlanFindMany, deleteMany: projectEquipmentPlanDeleteMany, createMany: projectEquipmentPlanCreateMany },
    projectEquipmentQuota: { findMany: projectEquipmentQuotaFindMany, deleteMany: projectEquipmentQuotaDeleteMany, createMany: projectEquipmentQuotaCreateMany },
    projectManpowerPlanMonth: { findMany: projectManpowerPlanMonthFindMany, deleteMany: projectManpowerPlanMonthDeleteMany, createMany: projectManpowerPlanMonthCreateMany },
    projectShiftRatio: { findMany: projectShiftRatioFindMany, deleteMany: projectShiftRatioDeleteMany, createMany: projectShiftRatioCreateMany },
    shift: { findMany: shiftFindMany },
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
