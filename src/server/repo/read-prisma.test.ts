import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, shiftFindMany, planFindMany } = vi.hoisted(() => ({
  queryRaw: vi.fn(async (_sql: unknown): Promise<unknown[]> => []),
  shiftFindMany: vi.fn(async (): Promise<unknown[]> => []),
  planFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
}));
vi.mock('@/server/db', () => ({
  prisma: {
    $queryRaw: queryRaw,
    shift: { findMany: shiftFindMany },
    projectEquipmentPlan: { findMany: planFindMany },
  },
}));
import { readRepoPrisma } from './read-prisma';
import { repo as prismaRepo } from './prisma-repo';

beforeEach(() => {
  queryRaw.mockClear();
  shiftFindMany.mockClear();
  planFindMany.mockClear();
});

describe('read-prisma', () => {
  it('readShifts goi shift.findMany 1 lan, sort sortOrder tang', async () => {
    await readRepoPrisma.readShifts();
    expect(shiftFindMany).toHaveBeenCalledTimes(1);
    expect(shiftFindMany).toHaveBeenCalledWith({ orderBy: { sortOrder: 'asc' } });
  });

  it('readManpowerByShiftMonth goi $queryRaw 1 lan voi projectId trong values', async () => {
    await readRepoPrisma.readManpowerByShiftMonth(7);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toContain(7);
  });

  it('readManpowerWeekly goi $queryRaw 1 lan voi projectId trong values', async () => {
    await readRepoPrisma.readManpowerWeekly(9);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toContain(9);
  });

  it('readManpowerRange nhan [{from:null,to:null}] -> null', async () => {
    queryRaw.mockResolvedValueOnce([{ from: null, to: null }]);
    const r = await readRepoPrisma.readManpowerRange(1);
    expect(r).toBeNull();
  });

  it('readManpowerRange co du lieu -> tra dung from/to', async () => {
    queryRaw.mockResolvedValueOnce([{ from: '2026-08-03', to: '2026-10-25' }]);
    const r = await readRepoPrisma.readManpowerRange(1);
    expect(r).toEqual({ from: '2026-08-03', to: '2026-10-25' });
  });

  it('readEquipmentPlans goi findMany dung orderBy, map Date -> YYYY-MM-DD', async () => {
    planFindMany.mockResolvedValueOnce([
      {
        id: 1, projectId: 1, equipmentId: 1, unitNo: 1, workItemId: null,
        plannedStart: new Date('2026-08-03T00:00:00Z'), plannedFinish: new Date('2026-08-30T00:00:00Z'),
        note: '', updatedAt: new Date('2026-09-02T00:00:00Z'), updatedBy: 'system',
      },
    ]);
    const rows = await readRepoPrisma.readEquipmentPlans(1);
    expect(planFindMany).toHaveBeenCalledTimes(1);
    expect(planFindMany).toHaveBeenCalledWith({
      where: { projectId: 1 },
      orderBy: [{ equipmentId: 'asc' }, { unitNo: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }],
    });
    expect(rows[0].plannedStart).toBe('2026-08-03');
    expect(rows[0].plannedFinish).toBe('2026-08-30');
    expect(rows[0].updatedAt).toBe('2026-09-02T00:00:00.000Z');
  });

  it('readEquipmentUsageDays goi $queryRaw 1 lan voi projectId, from, to trong values', async () => {
    await readRepoPrisma.readEquipmentUsageDays(3, '2026-08-01', '2026-08-31');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toContain(3);
    expect(sql.values).toContain('2026-08-01');
    expect(sql.values).toContain('2026-08-31');
  });

  it('ten ham cua readRepoPrisma khong trung ten ham nao cua prisma-repo', () => {
    const readKeys = Object.keys(readRepoPrisma);
    const prismaKeys = Object.keys(prismaRepo);
    const overlap = readKeys.filter((k) => prismaKeys.includes(k));
    expect(overlap).toEqual([]);
  });
});
