import type { RepoData } from '@/data/seed/history';
import { bucketOf } from '@/lib/daily-series';
import type {
  DateRange, EquipmentUsageDay, FactSnapshot, FinancialSnapshot, MonthlyEvmRow, ReadRepo, ShiftMonthRow,
  VolumeSnapshot, WeekContractorRow,
} from './read-types';
import type { FactProgressMonthly } from './types';

const pickFactSnapshot = (f: FactProgressMonthly): FactSnapshot => ({
  projectId: f.projectId, yearMonth: f.yearMonth, pctActual: f.pctActual, bac: f.bac,
  pv: f.pv, ev: f.ev, ac: f.ac, spi: f.spi, cpi: f.cpi, bottleneckStage: f.bottleneckStage,
});

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

    async readFactSnapshots(yearMonth: string): Promise<FactSnapshot[]> {
      const latest = getData().facts.filter((f) => f.isLatest);
      if (yearMonth === 'all') {
        const map = new Map<number, FactProgressMonthly>();
        for (const f of latest) {
          const cur = map.get(f.projectId);
          if (!cur || f.yearMonth > cur.yearMonth) map.set(f.projectId, f);
        }
        return [...map.values()].map(pickFactSnapshot);
      }
      return latest.filter((f) => f.yearMonth === yearMonth).map(pickFactSnapshot);
    },

    async readFinancialSnapshots(yearMonth: string): Promise<FinancialSnapshot[]> {
      const latest = getData().financial.filter((f) => f.isLatest);
      const pick = (f: (typeof latest)[number]): FinancialSnapshot =>
        ({ projectId: f.projectId, yearMonth: f.yearMonth, revenuePeriod: f.revenuePeriod, arOverdue: f.arOverdue });
      if (yearMonth === 'all') {
        const map = new Map<number, (typeof latest)[number]>();
        for (const f of latest) {
          const cur = map.get(f.projectId);
          if (!cur || f.yearMonth > cur.yearMonth) map.set(f.projectId, f);
        }
        return [...map.values()].map(pick);
      }
      return latest.filter((f) => f.yearMonth === yearMonth).map(pick);
    },

    async readVolumeSnapshots(yearMonth: string): Promise<VolumeSnapshot[]> {
      const vols = getData().volumes;
      const pick = (v: (typeof vols)[number]): VolumeSnapshot =>
        ({ projectId: v.projectId, factoryId: v.factoryId, yearMonth: v.yearMonth, tonnageProcessed: v.tonnageProcessed });
      if (yearMonth === 'all') {
        const map = new Map<string, (typeof vols)[number]>();
        for (const v of vols) {
          const key = `${v.projectId}|${v.factoryId}`;
          const cur = map.get(key);
          if (!cur || v.yearMonth > cur.yearMonth) map.set(key, v);
        }
        return [...map.values()].map(pick);
      }
      return vols.filter((v) => v.yearMonth === yearMonth).map(pick);
    },

    async readMonthlyEvm(months: string[], projectIds: number[]): Promise<MonthlyEvmRow[]> {
      if (months.length === 0 || projectIds.length === 0) return [];
      const idSet = new Set(projectIds);
      const monthSet = new Set(months);
      const rows = getData().facts.filter((f) => f.isLatest && idSet.has(f.projectId) && monthSet.has(f.yearMonth));
      const byMonth = new Map<string, FactProgressMonthly[]>();
      for (const f of rows) {
        const list = byMonth.get(f.yearMonth) ?? [];
        list.push(f);
        byMonth.set(f.yearMonth, list);
      }
      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      return [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([yearMonth, fs]) => ({
          yearMonth,
          pv: fs.reduce((s, f) => s + f.pv, 0),
          ev: fs.reduce((s, f) => s + f.ev, 0),
          ac: fs.reduce((s, f) => s + f.ac, 0),
          spiAvg: avg(fs.map((f) => f.spi).filter((x): x is number => x != null)),
          cpiAvg: avg(fs.map((f) => f.cpi).filter((x): x is number => x != null)),
        }));
    },
  };
}
