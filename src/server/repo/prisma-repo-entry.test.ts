import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findMany, mpFindMany, mpUpdate, mpCreate, eqFindMany, eqUpdate, eqCreate, auditCreate, transactionMock,
  stageFindMany, stageFindUnique, stageCount, stageUpdate, pswCount,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  mpFindMany: vi.fn(async (): Promise<unknown[]> => []),
  mpUpdate: vi.fn(async (_args: unknown) => ({})),
  mpCreate: vi.fn(async (_args: unknown) => ({})),
  eqFindMany: vi.fn(async (): Promise<unknown[]> => []),
  eqUpdate: vi.fn(async (_args: unknown) => ({})),
  eqCreate: vi.fn(async (_args: unknown) => ({})),
  auditCreate: vi.fn(async (_args: { data: { note: string } }) => ({})),
  transactionMock: vi.fn(),
  stageFindMany: vi.fn(async (): Promise<unknown[]> => []),
  stageFindUnique: vi.fn(async (_args: unknown): Promise<unknown> => null),
  stageCount: vi.fn(async (_args: unknown) => 0),
  stageUpdate: vi.fn(async (_args: unknown) => ({})),
  pswCount: vi.fn(async (_args: unknown) => 0),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    factDailyManpower: { findMany, update: mpUpdate, create: mpCreate },
    factDailyEquipmentUsage: { findMany: eqFindMany, update: eqUpdate, create: eqCreate },
    auditLog: { create: auditCreate },
    shift: { findMany: vi.fn() },
    stage: { findMany: stageFindMany, findUnique: stageFindUnique, count: stageCount, update: stageUpdate },
    projectStageWeight: { count: pswCount },
    $transaction: transactionMock,
  },
}));

import { entryPrismaRepo } from './prisma-repo-entry';

beforeEach(() => {
  findMany.mockReset();
  mpFindMany.mockClear();
  mpUpdate.mockClear();
  mpCreate.mockClear();
  eqFindMany.mockClear();
  eqUpdate.mockClear();
  eqCreate.mockClear();
  auditCreate.mockClear();
  transactionMock.mockReset();
});

describe('prisma-repo-entry.getDailyManpowerByShift', () => {
  it('goi findMany voi workDate gte/lte 00:00Z va map workDate ve YYYY-MM-DD', async () => {
    findMany.mockResolvedValueOnce([
      {
        projectId: 1, contractorId: 1, workDate: new Date('2026-09-16T00:00:00.000Z'),
        shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4,
      },
    ]);

    const rows = await entryPrismaRepo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16');

    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 1, workDate: { gte: new Date('2026-09-16T00:00:00.000Z'), lte: new Date('2026-09-16T00:00:00.000Z') } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }, { shift: { sortOrder: 'asc' } }],
    });
    expect(rows).toEqual([
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);
  });
});

describe('prisma-repo-entry.saveDailyResources', () => {
  it('$transaction goi callback voi tx mock; o doi -> update + auditLog.create 1 lan co note', async () => {
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        factDailyManpower: { findMany: mpFindMany, update: mpUpdate, create: mpCreate },
        factDailyEquipmentUsage: { findMany: eqFindMany, update: eqUpdate, create: eqCreate },
        auditLog: { create: auditCreate },
      }),
    );
    mpFindMany.mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: new Date('2026-09-16T00:00:00.000Z'), shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);

    const result = await entryPrismaRepo.saveDailyResources(
      1, '2026-09-16',
      { manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 9, actualHeadcount: 9 }], equipment: [] },
      'u@x', 'ly do',
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(mpUpdate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.note).toBe('ly do');
    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0 });
  });
});

/** P7-C2 Task 8: tạo giai đoạn = 1 transaction (dim_stage + trọng số 0% + audit). */
describe('prisma-repo-entry.saveStage / setStageActive', () => {
  const input = { nameVi: 'Bảo hành', nameEn: 'Warranty', side: 'left' as const, sortOrder: 5, calcMode: 'manual' as const };

  it('tao moi: trong 1 transaction tao dim_stage custom_<n>, createMany 0% cho du an da co trong so, audit create', async () => {
    stageFindMany.mockResolvedValueOnce([{ code: 'design', nameVi: 'Thiết kế' }, { code: 'custom_2', nameVi: 'Cũ' }]);
    const txStageCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...args.data }));
    const txCreateMany = vi.fn(async (_args: unknown) => ({ count: 2 }));
    const txAudit = vi.fn(async (_args: unknown) => ({}));
    transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb({
      stage: { create: txStageCreate },
      projectStageWeight: { findMany: vi.fn(async () => [{ projectId: 1 }, { projectId: 3 }]), createMany: txCreateMany },
      auditLog: { create: txAudit },
    }));

    const res = await entryPrismaRepo.saveStage(input, 'u@x');

    expect(res).toMatchObject({ code: 'custom_3', nameVi: 'Bảo hành', side: 'left', isActive: true });
    expect(txStageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ code: 'custom_3', isActive: true }) });
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [
        { projectId: 1, stageCode: 'custom_3', weightPct: 0, applicable: true },
        { projectId: 3, stageCode: 'custom_3', weightPct: 0, applicable: true },
      ],
      skipDuplicates: true,
    });
    expect(txAudit).toHaveBeenCalledWith({ data: expect.objectContaining({ tableName: 'dim_stage', recordId: 'custom_3', field: 'create' }) });
  });

  it('trung ten khong phan biet hoa thuong -> duplicate_name, khong mo transaction', async () => {
    stageFindMany.mockResolvedValueOnce([{ code: 'design', nameVi: 'Thiết kế' }]);
    expect(await entryPrismaRepo.saveStage({ ...input, nameVi: ' THIẾT KẾ ' }, 'u@x')).toBe('duplicate_name');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('du 30 giai doan -> too_many', async () => {
    stageFindMany.mockResolvedValueOnce(Array.from({ length: 30 }, (_, i) => ({ code: `custom_${i + 1}`, nameVi: `G${i}` })));
    expect(await entryPrismaRepo.saveStage(input, 'u@x')).toBe('too_many');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('sua code khong co -> not_found', async () => {
    stageFindMany.mockResolvedValueOnce([{ code: 'design', nameVi: 'Thiết kế' }]);
    stageFindUnique.mockResolvedValueOnce(null);
    expect(await entryPrismaRepo.saveStage({ ...input, code: 'custom_9' }, 'u@x')).toBe('not_found');
  });

  it('ngung dung: dem trong so applicable > 0 -> in_use kem so du an, khong update', async () => {
    stageFindUnique.mockResolvedValueOnce({ code: 'fabrication', isActive: true });
    pswCount.mockResolvedValueOnce(12);
    stageUpdate.mockClear();
    expect(await entryPrismaRepo.setStageActive('fabrication', false, 'u@x')).toEqual({ status: 'in_use', count: 12 });
    expect(pswCount).toHaveBeenCalledWith({ where: { stageCode: 'fabrication', applicable: true, weightPct: { gt: 0 } } });
    expect(stageUpdate).not.toHaveBeenCalled();
  });
});
