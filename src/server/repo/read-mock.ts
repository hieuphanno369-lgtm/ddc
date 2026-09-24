import type { RepoData } from '@/data/seed/history';
import { bucketOf } from '@/lib/daily-series';
import type { DateRange, EquipmentUsageDay, ReadRepo, ShiftMonthRow, WeekContractorRow } from './read-types';

/**
 * Read repo mock (in-memory) - cùng ngữ nghĩa với `read-prisma.ts` nhưng tính trên `RepoData`
 * để test/dev không cần Postgres.
 */
export function createReadMock(getData: () => RepoData): ReadRepo {
  return {
    async readShifts() {
      return [...getData().shifts].sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async readManpowerByShiftMonth(projectId: number): Promise<ShiftMonthRow[]> {
      const map = new Map<string, ShiftMonthRow>();
      for (const r of getData().dailyManpowerShifts) {
        if (r.projectId !== projectId) continue;
        const yearMonth = r.workDate.slice(0, 7);
        const key = `${yearMonth}|${r.contractorId}|${r.shiftCode}`;
        const cur = map.get(key) ?? { yearMonth, contractorId: r.contractorId, shiftCode: r.shiftCode, planned: 0, actual: 0, days: 0 };
        cur.planned += r.plannedHeadcount;
        cur.actual += r.actualHeadcount;
        cur.days += 1;
        map.set(key, cur);
      }
      return [...map.values()].sort((a, b) =>
        a.yearMonth.localeCompare(b.yearMonth) || a.contractorId - b.contractorId || a.shiftCode.localeCompare(b.shiftCode));
    },

    async readManpowerWeekly(projectId: number): Promise<WeekContractorRow[]> {
      const map = new Map<string, WeekContractorRow>();
      for (const r of getData().dailyManpowerShifts) {
        if (r.projectId !== projectId) continue;
        const weekStart = bucketOf(r.workDate, 'week').from;
        const key = `${weekStart}|${r.contractorId}`;
        const cur = map.get(key) ?? { weekStart, contractorId: r.contractorId, planned: 0, actual: 0 };
        cur.planned += r.plannedHeadcount;
        cur.actual += r.actualHeadcount;
        map.set(key, cur);
      }
      return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.contractorId - b.contractorId);
    },

    async readManpowerRange(projectId: number): Promise<DateRange | null> {
      const dates = getData().dailyManpowerShifts.filter((r) => r.projectId === projectId).map((r) => r.workDate);
      if (!dates.length) return null;
      return { from: dates.reduce((a, b) => (a < b ? a : b)), to: dates.reduce((a, b) => (a > b ? a : b)) };
    },

    async readEquipmentPlans(projectId: number) {
      return getData()
        .equipmentPlans.filter((p) => p.projectId === projectId)
        .map((p) => ({ ...p }))
        .sort((a, b) =>
          a.equipmentId - b.equipmentId
          || a.unitNo - b.unitNo
          || a.plannedStart.localeCompare(b.plannedStart)
          || a.id - b.id);
    },

    async readEquipmentUsageDays(projectId: number, from: string, to: string): Promise<EquipmentUsageDay[]> {
      const map = new Map<string, EquipmentUsageDay>();
      for (const r of getData().dailyEquipment) {
        if (r.projectId !== projectId || r.workDate < from || r.workDate > to) continue;
        const key = `${r.equipmentId}|${r.workDate}`;
        const cur = map.get(key) ?? { equipmentId: r.equipmentId, workDate: r.workDate, qtyActual: 0 };
        cur.qtyActual += r.qtyActual;
        map.set(key, cur);
      }
      return [...map.values()]
        .filter((r) => r.qtyActual > 0)
        .sort((a, b) => a.equipmentId - b.equipmentId || a.workDate.localeCompare(b.workDate));
    },
  };
}
