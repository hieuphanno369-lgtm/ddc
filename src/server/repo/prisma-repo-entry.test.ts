import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findMany, mpFindMany, mpUpdate, mpCreate, eqFindMany, eqUpdate, eqCreate, auditCreate, transactionMock,
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
}));

vi.mock('@/server/db', () => ({
  prisma: {
    factDailyManpower: { findMany, update: mpUpdate, create: mpCreate },
    factDailyEquipmentUsage: { findMany: eqFindMany, update: eqUpdate, create: eqCreate },
    auditLog: { create: auditCreate },
    shift: { findMany: vi.fn() },
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
