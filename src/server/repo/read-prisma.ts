import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import type { DateRange, EquipmentUsageDay, ReadRepo, ShiftMonthRow, WeekContractorRow } from './read-types';

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
} satisfies Pick<ReadRepo,
  | 'readShifts'
  | 'readManpowerByShiftMonth'
  | 'readManpowerWeekly'
  | 'readManpowerRange'
  | 'readEquipmentPlans'
  | 'readEquipmentUsageDays'
>;
