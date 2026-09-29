import type { RepoData } from '@/data/seed/history';
import { bucketOf } from '@/lib/daily-series';
import type {
  AuditLogPageResult, DateRange, FactAsOfRow, FactSeriesRow, FactSnapshot, FinancialAsOfRow, FinancialSnapshot,
  FlowRow, ManpowerActualMonthRow, ReadRepo, VolumeFlowRow, VolumeSnapshot, WeekContractorRow,
} from './read-types';
import type { FactProgressMonthly, ValueChainProgress } from './types';

const pickFactSnapshot = (f: FactProgressMonthly): FactSnapshot => ({
  projectId: f.projectId, yearMonth: f.yearMonth, pctActual: f.pctActual, bac: f.bac,
  pv: f.pv, ev: f.ev, ac: f.ac, spi: f.spi, cpi: f.cpi, bottleneckStage: f.bottleneckStage,
});

/** Mỗi dự án: dòng có yearMonth lớn nhất <= ym (không có thì bỏ qua dự án). */
function latestAtOrBefore<T extends { projectId: number; yearMonth: string }>(rows: T[], ym: string): T[] {
  const map = new Map<number, T>();
  for (const r of rows) {
    if (r.yearMonth > ym) continue;
    const cur = map.get(r.projectId);
    if (!cur || r.yearMonth > cur.yearMonth) map.set(r.projectId, r);
  }
  return [...map.values()];
}

/**
 * Read repo mock (in-memory) - cùng ngữ nghĩa với `read-prisma.ts` nhưng tính trên `RepoData`
 * để test/dev không cần Postgres.
 */
export function createReadMock(getData: () => RepoData): ReadRepo {
  return {
    async readShifts() {
      return [...getData().shifts].sort((a, b) => a.sortOrder - b.sortOrder);
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

    async readLastAuditAt(): Promise<string | null> {
      const rows = getData().auditLog;
      if (!rows.length) return null;
      return rows.reduce((max, a) => (a.changedAt > max ? a.changedAt : max), rows[0].changedAt);
    },

    async readActivitySince(since: Date) {
      const sinceIso = since.toISOString();
      return getData()
        .activityLog.filter((a) => a.createdAt >= sinceIso)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async readAuditLogPage(opts: { since: Date | null; page: number; pageSize: number }): Promise<AuditLogPageResult> {
      const sinceIso = opts.since ? opts.since.toISOString() : null;
      const filtered = getData().auditLog.filter((a) => !sinceIso || a.changedAt >= sinceIso);
      const sorted = [...filtered].sort((a, b) => b.changedAt.localeCompare(a.changedAt) || b.id - a.id);
      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
      const page = Math.min(Math.max(1, opts.page), totalPages);
      const start = (page - 1) * opts.pageSize;
      return { items: sorted.slice(start, start + opts.pageSize), total, page, totalPages, pageSize: opts.pageSize };
    },

    async readManpowerActualByMonth(projectId: number): Promise<ManpowerActualMonthRow[]> {
      const map = new Map<string, { actualSum: number; days: Set<string> }>();
      for (const r of getData().dailyManpowerShifts) {
        if (r.projectId !== projectId) continue;
        const yearMonth = r.workDate.slice(0, 7);
        const cur = map.get(yearMonth) ?? { actualSum: 0, days: new Set<string>() };
        cur.actualSum += r.actualHeadcount;
        cur.days.add(r.workDate);
        map.set(yearMonth, cur);
      }
      return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([yearMonth, v]) => ({ yearMonth, actualSum: v.actualSum, days: v.days.size }));
    },

    // ---- P4: số tồn theo mốc, số phát sinh theo kỳ ----
    async readFactSnapshotsAsOf(ym: string): Promise<FactAsOfRow[]> {
      const active = new Set(getData().projects.filter((p) => p.isActive).map((p) => p.id));
      return latestAtOrBefore(getData().facts.filter((f) => f.isLatest && active.has(f.projectId)), ym).map(pickFactSnapshot);
    },

    async readFinancialAsOf(ym: string): Promise<FinancialAsOfRow[]> {
      const active = new Set(getData().projects.filter((p) => p.isActive).map((p) => p.id));
      return latestAtOrBefore(getData().financial.filter((f) => f.isLatest && active.has(f.projectId)), ym)
        .map((f) => ({ projectId: f.projectId, yearMonth: f.yearMonth, arOverdue: f.arOverdue }));
    },

    async readRevenueInRange(fromYm: string, toYm: string): Promise<FlowRow[]> {
      const map = new Map<number, number>();
      for (const f of getData().financial) {
        if (!f.isLatest || f.yearMonth < fromYm || f.yearMonth > toYm) continue;
        map.set(f.projectId, (map.get(f.projectId) ?? 0) + f.revenuePeriod);
      }
      return [...map.entries()].map(([projectId, revenue]) => ({ projectId, revenue }));
    },

    async readVolumeInRange(fromYm: string, toYm: string): Promise<VolumeFlowRow[]> {
      const map = new Map<string, VolumeFlowRow>();
      for (const v of getData().volumes) {
        if (v.yearMonth < fromYm || v.yearMonth > toYm) continue;
        const key = `${v.projectId}|${v.factoryId}`;
        const cur = map.get(key) ?? { projectId: v.projectId, factoryId: v.factoryId, tonnage: 0 };
        cur.tonnage += v.tonnageProcessed;
        map.set(key, cur);
      }
      return [...map.values()];
    },

    async readFactSeries(fromYm: string, toYm: string, projectIds: number[]): Promise<FactSeriesRow[]> {
      if (projectIds.length === 0) return [];
      const idSet = new Set(projectIds);
      const latest = getData().facts.filter((f) => f.isLatest && idSet.has(f.projectId));
      const inRange = latest.filter((f) => f.yearMonth >= fromYm && f.yearMonth <= toYm);
      const prior = latestAtOrBefore(latest.filter((f) => f.yearMonth < fromYm), '9999-12');
      return [...inRange, ...prior]
        .map((f): FactSeriesRow => ({
          projectId: f.projectId, yearMonth: f.yearMonth, pctActual: f.pctActual, pv: f.pv, ev: f.ev, ac: f.ac,
        }))
        .sort((a, b) => a.projectId - b.projectId || a.yearMonth.localeCompare(b.yearMonth));
    },

    async readValueChainAsOf(projectId: number, ym: string): Promise<ValueChainProgress[]> {
      const rows = getData().valueChain.filter((v) => v.projectId === projectId && v.yearMonth <= ym);
      if (!rows.length) return [];
      const top = rows.reduce((m, v) => (v.yearMonth > m ? v.yearMonth : m), rows[0].yearMonth);
      return rows.filter((v) => v.yearMonth === top);
    },

    async readLastDailyDate(projectId: number, kind: 'manpower' | 'equipment', onOrBefore: string): Promise<string | null> {
      const rows = kind === 'manpower' ? getData().dailyManpowerShifts : getData().dailyEquipment;
      let best: string | null = null;
      for (const r of rows) {
        if (r.projectId === projectId && r.workDate <= onOrBefore && (best == null || r.workDate > best)) best = r.workDate;
      }
      return best;
    },
  };
}
