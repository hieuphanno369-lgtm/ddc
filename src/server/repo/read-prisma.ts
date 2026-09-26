import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import type {
  AuditLogPageResult, DateRange, EquipmentUsageDay, FactSnapshot, FinancialSnapshot, MonthlyEvmRow, ReadRepo,
  ShiftMonthRow, VolumeSnapshot, WeekContractorRow,
} from './read-types';

/**
 * Read repo Prisma (Postgres) - truy vấn tổng hợp cho T12b/T14/T1, tách khỏi `prisma-repo.ts`
 * (file nóng A đang dùng). Tên hàm luôn bắt đầu bằng `read` để không trùng hàm nào của prisma-repo.
 */

/** Date → 'YYYY-MM-DD' (cột @db.Date). */
const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

export const readRepoPrisma = {
  async readShifts() {
    return prisma.shift.findMany({ orderBy: { sortOrder: 'asc' } });
  },

  async readManpowerByShiftMonth(projectId: number): Promise<ShiftMonthRow[]> {
    return prisma.$queryRaw<ShiftMonthRow[]>(Prisma.sql`
      SELECT to_char(m."workDate",'YYYY-MM') AS "yearMonth", m."contractorId", m."shiftCode",
             SUM(m."plannedHeadcount")::int AS planned, SUM(m."actualHeadcount")::int AS actual, COUNT(*)::int AS days
      FROM "fact_daily_manpower" m WHERE m."projectId" = ${projectId}
      GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
    `);
  },

  async readManpowerWeekly(projectId: number): Promise<WeekContractorRow[]> {
    // date_trunc('week') = Thu 2 ISO; khong join dim_date de khong rot ngay ngoai 2020-2035.
    return prisma.$queryRaw<WeekContractorRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('week', m."workDate"),'YYYY-MM-DD') AS "weekStart", m."contractorId",
             SUM(m."plannedHeadcount")::int AS planned, SUM(m."actualHeadcount")::int AS actual
      FROM "fact_daily_manpower" m WHERE m."projectId" = ${projectId}
      GROUP BY 1, 2 ORDER BY 1, 2
    `);
  },

  async readManpowerRange(projectId: number): Promise<DateRange | null> {
    const rows = await prisma.$queryRaw<{ from: string | null; to: string | null }[]>(Prisma.sql`
      SELECT to_char(MIN("workDate"),'YYYY-MM-DD') AS "from", to_char(MAX("workDate"),'YYYY-MM-DD') AS "to"
      FROM "fact_daily_manpower" WHERE "projectId" = ${projectId}
    `);
    const row = rows[0];
    if (!row || row.from == null || row.to == null) return null;
    return { from: row.from, to: row.to };
  },

  async readEquipmentPlans(projectId: number) {
    const rows = await prisma.projectEquipmentPlan.findMany({
      where: { projectId },
      orderBy: [{ equipmentId: 'asc' }, { unitNo: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      equipmentId: r.equipmentId,
      unitNo: r.unitNo,
      qty: r.qty,
      workItemId: r.workItemId,
      plannedStart: day(r.plannedStart)!,
      plannedFinish: day(r.plannedFinish)!,
      note: r.note,
      updatedAt: r.updatedAt.toISOString(),
      updatedBy: r.updatedBy,
    }));
  },

  async readEquipmentUsageDays(projectId: number, from: string, to: string): Promise<EquipmentUsageDay[]> {
    return prisma.$queryRaw<EquipmentUsageDay[]>(Prisma.sql`
      SELECT "equipmentId", to_char("workDate",'YYYY-MM-DD') AS "workDate", SUM("qtyActual")::int AS "qtyActual"
      FROM "fact_daily_equipment_usage"
      WHERE "projectId" = ${projectId} AND "workDate" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2 HAVING SUM("qtyActual") > 0 ORDER BY 1, 2
    `);
  },

  async readFactSnapshots(yearMonth: string): Promise<FactSnapshot[]> {
    if (yearMonth === 'all') {
      return prisma.$queryRaw<FactSnapshot[]>(Prisma.sql`
        SELECT DISTINCT ON ("projectId") "projectId","yearMonth","pctActual","bac","pv","ev","ac","spi","cpi","bottleneckStage"
        FROM "fact_progress_monthly" WHERE "isLatest" = true ORDER BY "projectId", "yearMonth" DESC
      `);
    }
    const rows = await prisma.factProgressMonthly.findMany({
      where: { yearMonth, isLatest: true },
      select: {
        projectId: true, yearMonth: true, pctActual: true, bac: true,
        pv: true, ev: true, ac: true, spi: true, cpi: true, bottleneckStage: true,
      },
    });
    return rows.map((r) => ({ ...r, bottleneckStage: r.bottleneckStage as FactSnapshot['bottleneckStage'] }));
  },

  async readFinancialSnapshots(yearMonth: string): Promise<FinancialSnapshot[]> {
    if (yearMonth === 'all') {
      return prisma.$queryRaw<FinancialSnapshot[]>(Prisma.sql`
        SELECT DISTINCT ON ("projectId") "projectId","yearMonth","revenuePeriod","arOverdue"
        FROM "fact_financial" WHERE "isLatest" = true ORDER BY "projectId", "yearMonth" DESC
      `);
    }
    return prisma.factFinancial.findMany({
      where: { yearMonth, isLatest: true },
      select: { projectId: true, yearMonth: true, revenuePeriod: true, arOverdue: true },
    });
  },

  async readVolumeSnapshots(yearMonth: string): Promise<VolumeSnapshot[]> {
    if (yearMonth === 'all') {
      return prisma.$queryRaw<VolumeSnapshot[]>(Prisma.sql`
        SELECT DISTINCT ON ("projectId","factoryId") "projectId","factoryId","yearMonth","tonnageProcessed"
        FROM "fact_volume" ORDER BY "projectId","factoryId","yearMonth" DESC
      `);
    }
    return prisma.factVolume.findMany({
      where: { yearMonth },
      select: { projectId: true, factoryId: true, yearMonth: true, tonnageProcessed: true },
    });
  },

  async readMonthlyEvm(months: string[], projectIds: number[]): Promise<MonthlyEvmRow[]> {
    if (months.length === 0 || projectIds.length === 0) return [];
    return prisma.$queryRaw<MonthlyEvmRow[]>(Prisma.sql`
      SELECT "yearMonth", SUM("pv")::float8 AS pv, SUM("ev")::float8 AS ev, SUM("ac")::float8 AS ac,
             AVG("spi")::float8 AS "spiAvg", AVG("cpi")::float8 AS "cpiAvg"
      FROM "fact_progress_monthly"
      WHERE "isLatest" = true AND "yearMonth" = ANY(${months}::text[]) AND "projectId" = ANY(${projectIds}::int[])
      GROUP BY "yearMonth" ORDER BY "yearMonth"
    `);
  },

  async readLastAuditAt(): Promise<string | null> {
    const r = await prisma.auditLog.aggregate({ _max: { changedAt: true } });
    return r._max.changedAt ? r._max.changedAt.toISOString() : null;
  },

  async readActivitySince(since: Date) {
    const rows = await prisma.activityLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((a) => ({
      id: a.id,
      userEmail: a.userEmail,
      userName: a.userName,
      action: a.action,
      detail: a.detail,
      ip: a.ip,
      userAgent: a.userAgent,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  async readAuditLogPage(opts: { since: Date | null; page: number; pageSize: number }): Promise<AuditLogPageResult> {
    const where = opts.since ? { changedAt: { gte: opts.since } } : {};
    const total = await prisma.auditLog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
    const page = Math.min(Math.max(1, opts.page), totalPages);
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * opts.pageSize,
      take: opts.pageSize,
    });
    return {
      items: rows.map((a) => ({
        id: a.id,
        tableName: a.tableName,
        recordId: a.recordId,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
        changedBy: a.changedBy,
        changedAt: a.changedAt.toISOString(),
        note: a.note,
      })),
      total,
      page,
      totalPages,
      pageSize: opts.pageSize,
    };
  },
} satisfies ReadRepo;
