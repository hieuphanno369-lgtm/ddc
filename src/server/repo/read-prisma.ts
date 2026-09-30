import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import type {
  AuditLogPageResult, DateRange, FactAsOfRow, FactSeriesRow, FactSnapshot, FinancialAsOfRow, FinancialSnapshot,
  FlowRow, ManpowerActualMonthRow, ReadRepo, VolumeFlowRow, VolumeSnapshot, WeekContractorRow,
} from './read-types';
import type { ValueChainProgress } from './types';

/**
 * Read repo Prisma (Postgres) - truy vấn tổng hợp cho T12b/T14/T1, tách khỏi `prisma-repo.ts`
 * (file nóng A đang dùng). Tên hàm luôn bắt đầu bằng `read` để không trùng hàm nào của prisma-repo.
 */

export const readRepoPrisma = {
  async readShifts() {
    return prisma.shift.findMany({ orderBy: { sortOrder: 'asc' } });
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

  async readManpowerActualByMonth(projectId: number): Promise<ManpowerActualMonthRow[]> {
    return prisma.$queryRaw<ManpowerActualMonthRow[]>(Prisma.sql`
      SELECT to_char(m."workDate",'YYYY-MM') AS "yearMonth", SUM(m."actualHeadcount")::int AS "actualSum",
             COUNT(DISTINCT m."workDate")::int AS days
      FROM "fact_daily_manpower" m WHERE m."projectId" = ${projectId}
      GROUP BY 1 ORDER BY 1
    `);
  },

  // ---- P4: số tồn theo mốc, số phát sinh theo kỳ ----
  async readFactSnapshotsAsOf(ym: string): Promise<FactAsOfRow[]> {
    // LATERAL + LIMIT 1 dùng index [projectId, yearMonth, isLatest], không DISTINCT ON quét cả bảng.
    return prisma.$queryRaw<FactAsOfRow[]>(Prisma.sql`
      SELECT f."projectId", f."yearMonth", f."pctActual", f."bac", f."pv", f."ev", f."ac", f."spi", f."cpi", f."bottleneckStage"
      FROM "dim_project" p
      CROSS JOIN LATERAL (
        SELECT * FROM "fact_progress_monthly" x
        WHERE x."projectId" = p."id" AND x."isLatest" = true AND x."yearMonth" <= ${ym}
        ORDER BY x."yearMonth" DESC LIMIT 1
      ) f
      WHERE p."isActive" = true
    `);
  },

  async readFinancialAsOf(ym: string): Promise<FinancialAsOfRow[]> {
    return prisma.$queryRaw<FinancialAsOfRow[]>(Prisma.sql`
      SELECT f."projectId", f."yearMonth", f."arOverdue"
      FROM "dim_project" p
      CROSS JOIN LATERAL (
        SELECT * FROM "fact_financial" x
        WHERE x."projectId" = p."id" AND x."isLatest" = true AND x."yearMonth" <= ${ym}
        ORDER BY x."yearMonth" DESC LIMIT 1
      ) f
      WHERE p."isActive" = true
    `);
  },

  async readRevenueInRange(fromYm: string, toYm: string): Promise<FlowRow[]> {
    return prisma.$queryRaw<FlowRow[]>(Prisma.sql`
      SELECT "projectId", SUM("revenuePeriod")::float8 AS revenue
      FROM "fact_financial"
      WHERE "isLatest" = true AND "yearMonth" >= ${fromYm} AND "yearMonth" <= ${toYm}
      GROUP BY "projectId"
    `);
  },

  async readVolumeInRange(fromYm: string, toYm: string): Promise<VolumeFlowRow[]> {
    return prisma.$queryRaw<VolumeFlowRow[]>(Prisma.sql`
      SELECT "projectId", "factoryId", SUM("tonnageProcessed")::float8 AS tonnage
      FROM "fact_volume"
      WHERE "yearMonth" >= ${fromYm} AND "yearMonth" <= ${toYm}
      GROUP BY "projectId", "factoryId"
    `);
  },

  async readFactSeries(fromYm: string, toYm: string, projectIds: number[]): Promise<FactSeriesRow[]> {
    if (projectIds.length === 0) return [];
    return prisma.$queryRaw<FactSeriesRow[]>(Prisma.sql`
      SELECT * FROM (
        SELECT "projectId", "yearMonth", "pctActual", "pv", "ev", "ac"
        FROM "fact_progress_monthly"
        WHERE "isLatest" = true AND "projectId" = ANY(${projectIds}::int[])
          AND "yearMonth" >= ${fromYm} AND "yearMonth" <= ${toYm}
        UNION ALL
        SELECT f."projectId", f."yearMonth", f."pctActual", f."pv", f."ev", f."ac"
        FROM unnest(${projectIds}::int[]) AS pid
        CROSS JOIN LATERAL (
          SELECT * FROM "fact_progress_monthly" x
          WHERE x."projectId" = pid AND x."isLatest" = true AND x."yearMonth" < ${fromYm}
          ORDER BY x."yearMonth" DESC LIMIT 1
        ) f
      ) s ORDER BY "projectId", "yearMonth"
    `);
  },

  async readValueChainAsOf(projectId: number, ym: string): Promise<ValueChainProgress[]> {
    const latest = await prisma.valueChainProgress.findFirst({
      where: { projectId, yearMonth: { lte: ym } },
      orderBy: { yearMonth: 'desc' },
      select: { yearMonth: true },
    });
    if (!latest) return [];
    const rows = await prisma.valueChainProgress.findMany({ where: { projectId, yearMonth: latest.yearMonth } });
    return rows.map((v) => ({
      projectId: v.projectId,
      stageCode: v.stageCode as ValueChainProgress['stageCode'],
      yearMonth: v.yearMonth,
      pctComplete: v.pctComplete,
      applicable: v.applicable,
    }));
  },

  async readLastDailyDate(projectId: number, kind: 'manpower' | 'equipment', onOrBefore: string): Promise<string | null> {
    const rows = kind === 'manpower'
      ? await prisma.$queryRaw<{ d: string | null }[]>(Prisma.sql`
          SELECT to_char(MAX("workDate"),'YYYY-MM-DD') AS d FROM "fact_daily_manpower"
          WHERE "projectId" = ${projectId} AND "workDate" <= ${onOrBefore}::date`)
      : await prisma.$queryRaw<{ d: string | null }[]>(Prisma.sql`
          SELECT to_char(MAX("workDate"),'YYYY-MM-DD') AS d FROM "fact_daily_equipment_usage"
          WHERE "projectId" = ${projectId} AND "workDate" <= ${onOrBefore}::date`);
    return rows[0]?.d ?? null;
  },
} satisfies ReadRepo;
