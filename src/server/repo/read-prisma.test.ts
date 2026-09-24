import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryRaw, shiftFindMany, planFindMany, factFindMany, financialFindMany, volumeFindMany,
  auditAggregate, activityFindMany, auditLogCount, auditLogFindMany,
} = vi.hoisted(() => ({
  queryRaw: vi.fn(async (_sql: unknown): Promise<unknown[]> => []),
  shiftFindMany: vi.fn(async (): Promise<unknown[]> => []),
  planFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
  factFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
  financialFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
  volumeFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
  auditAggregate: vi.fn(async (_args: unknown): Promise<{ _max: { changedAt: Date | null } }> => ({ _max: { changedAt: null } })),
  activityFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
  auditLogCount: vi.fn(async (_args: unknown): Promise<number> => 0),
  auditLogFindMany: vi.fn(async (_args: unknown): Promise<unknown[]> => []),
}));
vi.mock('@/server/db', () => ({
  prisma: {
    $queryRaw: queryRaw,
    shift: { findMany: shiftFindMany },
    projectEquipmentPlan: { findMany: planFindMany },
    factProgressMonthly: { findMany: factFindMany },
    factFinancial: { findMany: financialFindMany },
    factVolume: { findMany: volumeFindMany },
    auditLog: { aggregate: auditAggregate, count: auditLogCount, findMany: auditLogFindMany },
    activityLog: { findMany: activityFindMany },
  },
}));
import { readRepoPrisma } from './read-prisma';
import { repo as prismaRepo } from './prisma-repo';

beforeEach(() => {
  queryRaw.mockClear();
  shiftFindMany.mockClear();
  planFindMany.mockClear();
  factFindMany.mockClear();
  financialFindMany.mockClear();
  volumeFindMany.mockClear();
  auditAggregate.mockClear();
  activityFindMany.mockClear();
  auditLogCount.mockClear();
  auditLogFindMany.mockClear();
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

  it('readFactSnapshots("all") goi $queryRaw, khong goi findMany', async () => {
    await readRepoPrisma.readFactSnapshots('all');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(factFindMany).not.toHaveBeenCalled();
  });

  it('readFactSnapshots(thang) goi findMany voi where dung, khong goi $queryRaw', async () => {
    await readRepoPrisma.readFactSnapshots('2026-09');
    expect(factFindMany).toHaveBeenCalledTimes(1);
    expect(factFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { yearMonth: '2026-09', isLatest: true } }));
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('readFinancialSnapshots("all") goi $queryRaw, khong goi findMany', async () => {
    await readRepoPrisma.readFinancialSnapshots('all');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(financialFindMany).not.toHaveBeenCalled();
  });

  it('readFinancialSnapshots(thang) goi findMany voi where dung', async () => {
    await readRepoPrisma.readFinancialSnapshots('2026-09');
    expect(financialFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { yearMonth: '2026-09', isLatest: true } }));
  });

  it('readVolumeSnapshots("all") goi $queryRaw, khong goi findMany', async () => {
    await readRepoPrisma.readVolumeSnapshots('all');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(volumeFindMany).not.toHaveBeenCalled();
  });

  it('readVolumeSnapshots(thang) goi findMany voi where dung (khong co isLatest)', async () => {
    await readRepoPrisma.readVolumeSnapshots('2026-09');
    expect(volumeFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { yearMonth: '2026-09' } }));
  });

  it('readMonthlyEvm([], ...) khong goi DB', async () => {
    const r1 = await readRepoPrisma.readMonthlyEvm([], [1]);
    const r2 = await readRepoPrisma.readMonthlyEvm(['2026-09'], []);
    expect(r1).toEqual([]);
    expect(r2).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('readMonthlyEvm(thang, id) goi $queryRaw 1 lan', async () => {
    await readRepoPrisma.readMonthlyEvm(['2026-09'], [1, 2]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('ten ham cua readRepoPrisma khong trung ten ham nao cua prisma-repo', () => {
    const readKeys = Object.keys(readRepoPrisma);
    const prismaKeys = Object.keys(prismaRepo);
    const overlap = readKeys.filter((k) => prismaKeys.includes(k));
    expect(overlap).toEqual([]);
  });

  it('readLastAuditAt: bang co dong -> ISO cua MAX(changedAt)', async () => {
    auditAggregate.mockResolvedValueOnce({ _max: { changedAt: new Date('2026-09-20T10:00:00Z') } });
    const r = await readRepoPrisma.readLastAuditAt();
    expect(auditAggregate).toHaveBeenCalledWith({ _max: { changedAt: true } });
    expect(r).toBe('2026-09-20T10:00:00.000Z');
  });

  it('readLastAuditAt: bang rong -> null', async () => {
    auditAggregate.mockResolvedValueOnce({ _max: { changedAt: null } });
    expect(await readRepoPrisma.readLastAuditAt()).toBeNull();
  });

  it('readActivitySince: goi findMany voi where.createdAt.gte va orderBy createdAt desc', async () => {
    const since = new Date('2026-09-10T00:00:00Z');
    await readRepoPrisma.readActivitySince(since);
    expect(activityFindMany).toHaveBeenCalledWith({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('readAuditLogPage', () => {
    it('count=45, page=2, since=2026-09-10: goi findMany dung where.changedAt.gte, orderBy, skip 20 take 20', async () => {
      const since = new Date('2026-09-10T00:00:00Z');
      auditLogCount.mockResolvedValueOnce(45);
      auditLogFindMany.mockResolvedValueOnce([]);

      const r = await readRepoPrisma.readAuditLogPage({ since, page: 2, pageSize: 20 });

      expect(auditLogCount).toHaveBeenCalledWith({ where: { changedAt: { gte: since } } });
      expect(auditLogFindMany).toHaveBeenCalledWith({
        where: { changedAt: { gte: since } },
        orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 20,
      });
      expect(r.total).toBe(45);
      expect(r.page).toBe(2);
      expect(r.totalPages).toBe(3);
      expect(r.pageSize).toBe(20);
    });

    it('count=45, page=99 (vuot qua) -> kep ve page 3, skip 40', async () => {
      auditLogCount.mockResolvedValueOnce(45);
      auditLogFindMany.mockResolvedValueOnce([]);
      const r = await readRepoPrisma.readAuditLogPage({ since: null, page: 99, pageSize: 20 });
      expect(r.page).toBe(3);
      expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40 }));
    });

    it('count=0 -> page 1, totalPages 1', async () => {
      auditLogCount.mockResolvedValueOnce(0);
      auditLogFindMany.mockResolvedValueOnce([]);
      const r = await readRepoPrisma.readAuditLogPage({ since: null, page: 1, pageSize: 20 });
      expect(r.page).toBe(1);
      expect(r.totalPages).toBe(1);
    });

    it('since = null -> where rong (khong loc theo changedAt)', async () => {
      auditLogCount.mockResolvedValueOnce(0);
      auditLogFindMany.mockResolvedValueOnce([]);
      await readRepoPrisma.readAuditLogPage({ since: null, page: 1, pageSize: 20 });
      expect(auditLogCount).toHaveBeenCalledWith({ where: {} });
      expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('page=0 truyen truc tiep -> tu kep ve page 1, skip 0', async () => {
      auditLogCount.mockResolvedValueOnce(45);
      auditLogFindMany.mockResolvedValueOnce([]);
      const r = await readRepoPrisma.readAuditLogPage({ since: null, page: 0, pageSize: 20 });
      expect(r.page).toBe(1);
      expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
    });

    it('page=-5 -> van kep ve page 1, khong ra skip am', async () => {
      auditLogCount.mockResolvedValueOnce(45);
      auditLogFindMany.mockResolvedValueOnce([]);
      const r = await readRepoPrisma.readAuditLogPage({ since: null, page: -5, pageSize: 20 });
      expect(r.page).toBe(1);
      expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
    });
  });
});
