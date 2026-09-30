import { describe, expect, it } from 'vitest';
import { buildRepoData } from '@/data/seed/history';
import { createReadMock } from './read-mock';
import { runReadPeriodContract, type PeriodFixture, type PeriodHarness } from './read-period-contract';

const data = buildRepoData();
const mock = createReadMock(() => data);

// Seed mac dinh de auditLog/activityLog rong (chi sinh khi co mutation) - bom du lieu tay cho
// cac test Buoc 6 (readLastAuditAt/readActivitySince/readAuditLogPage).
data.auditLog.push(
  { id: 1, tableName: 'dim_project', recordId: '1', field: 'x', oldValue: '', newValue: '', changedBy: 'u', changedAt: '2026-09-10T00:00:00.000Z', note: '' },
  { id: 2, tableName: 'dim_project', recordId: '1', field: 'x', oldValue: '', newValue: '', changedBy: 'u', changedAt: '2026-09-20T00:00:00.000Z', note: 'ly do' },
);
data.activityLog.push(
  { id: 1, userEmail: 'a@x', userName: 'A', action: 'view', detail: '', ip: '', userAgent: '', createdAt: '2026-09-15T00:00:00.000Z' },
  { id: 2, userEmail: 'b@x', userName: 'B', action: 'view', detail: '', ip: '', userAgent: '', createdAt: '2026-09-22T00:00:00.000Z' },
);

describe('read-mock', () => {
  it('readManpowerWeekly: moi weekStart la Thu 2', async () => {
    const rows = await mock.readManpowerWeekly(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const dow = new Date(`${r.weekStart}T00:00:00Z`).getUTCDay();
      expect(dow).toBe(1);
    }
  });

  it('du an 17 (khong ton tai) -> rong/null', async () => {
    expect(await mock.readManpowerWeekly(17)).toEqual([]);
    expect(await mock.readManpowerRange(17)).toBeNull();
    expect(await mock.readManpowerActualByMonth(17)).toEqual([]);
  });

  it('readManpowerActualByMonth: tong actualSum khop seed, days = so workDate khac nhau moi thang, sort tang', async () => {
    const rows = await mock.readManpowerActualByMonth(1);
    const seedRows = data.dailyManpowerShifts.filter((r) => r.projectId === 1);
    const totalActual = rows.reduce((s, r) => s + r.actualSum, 0);
    const seedActual = seedRows.reduce((s, r) => s + r.actualHeadcount, 0);
    expect(totalActual).toBe(seedActual);
    for (const r of rows) {
      const daysInMonth = new Set(seedRows.filter((s) => s.workDate.slice(0, 7) === r.yearMonth).map((s) => s.workDate));
      expect(r.days).toBe(daysInMonth.size);
    }
    const sorted = [...rows].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    expect(rows).toEqual(sorted);
  });

  it('readShifts: sap xep theo sortOrder tang', async () => {
    const rows = await mock.readShifts();
    for (let i = 1; i < rows.length; i++) expect(rows[i].sortOrder).toBeGreaterThanOrEqual(rows[i - 1].sortOrder);
  });

  it('readFactSnapshots("all"): moi du an dung 1 dong = thang lon nhat', async () => {
    const rows = await mock.readFactSnapshots('all');
    const latestByProject = new Map<number, string>();
    for (const f of data.facts.filter((f) => f.isLatest)) {
      const cur = latestByProject.get(f.projectId);
      if (!cur || f.yearMonth > cur) latestByProject.set(f.projectId, f.yearMonth);
    }
    expect(rows).toHaveLength(latestByProject.size);
    for (const r of rows) expect(r.yearMonth).toBe(latestByProject.get(r.projectId));
  });

  it('readLastAuditAt: ISO cua dong moi nhat', async () => {
    expect(await mock.readLastAuditAt()).toBe('2026-09-20T00:00:00.000Z');
  });

  it('readActivitySince: chi lay dong >= since, moi nhat truoc', async () => {
    const rows = await mock.readActivitySince(new Date('2026-09-18T00:00:00.000Z'));
    expect(rows.map((r) => r.id)).toEqual([2]);
  });

  it('readAuditLogPage: phan trang + sap xep moi nhat truoc', async () => {
    const page = await mock.readAuditLogPage({ since: null, page: 1, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe(2);
    expect(page.items[0].note).toBe('ly do'); // P2A them audit_log.note - khong duoc roi mat qua read repo
  });

  it('readAuditLogPage: since loc dung, khong con dong cu', async () => {
    const page = await mock.readAuditLogPage({ since: new Date('2026-09-15T00:00:00.000Z'), page: 1, pageSize: 20 });
    expect(page.total).toBe(1);
    expect(page.items.map((r) => r.id)).toEqual([2]);
  });
});

// ---- P4: hàm đọc theo mốc/kỳ (cùng bộ ca với read-period-real-db.test.ts) ----
runReadPeriodContract('read-mock: hàm đọc theo mốc/kỳ (P4)', async (): Promise<PeriodHarness> => {
  const d = buildRepoData();
  const repo = createReadMock(() => d);
  const proj = d.projects.slice(0, 3).map((p, i) => ({ ...p, isActive: i !== 2 }));
  const factoryId = d.factories[0].id;
  const ids = proj.map((p) => p.id) as [number, number, number];
  return {
    repo,
    async seed(fx: PeriodFixture) {
      d.projects = proj;
      d.facts = fx.facts.map((f) => ({
        projectId: ids[f.p], yearMonth: f.ym, pctPlan: 0, pctActual: f.pct, actualStartDate: null, actualFinishDate: null,
        bac: 0, pv: f.pv, ev: f.ev, ac: f.ac, spi: null, cpi: null, bottleneckStage: null,
        equipmentPlanned: 0, equipmentActual: 0, isLatest: f.isLatest, manpowerPlanned: 0, manpowerActual: 0,
        snapshotLockedAt: null, lockedBy: null, version: f.version, changedBy: '', changedAt: '', changeNote: '',
      }));
      d.financial = fx.financial.map((f) => ({
        projectId: ids[f.p], yearMonth: f.ym, revenuePeriod: f.revenue, revenueCumulative: 0, costActualPeriod: 0,
        costActualCumulative: 0, grossProfit: 0, grossMarginPct: 0, backlog: 0, arCollected: 0, arOutstanding: 0,
        arOverdue: f.arOverdue, version: 1, isLatest: f.isLatest, changedBy: '', changedAt: '', changeNote: '',
      }));
      d.volumes = fx.volumes.map((v) => ({ projectId: ids[v.p], factoryId, yearMonth: v.ym, tonnageProcessed: v.tonnage }));
      d.dailyManpowerShifts = fx.manpowerDays.map((m) => ({
        projectId: ids[m.p], contractorId: 1, workDate: m.day, shiftCode: 'morning', plannedHeadcount: 1, actualHeadcount: 1,
      }));
      d.dailyEquipment = fx.equipmentDays.map((e) => ({
        projectId: ids[e.p], contractorId: 1, equipmentId: 1, workDate: e.day, qtyPlanned: 1, qtyActual: 1,
      }));
      d.valueChain = fx.valueChain.map((v) => ({
        projectId: ids[v.p], stageCode: v.stage, yearMonth: v.ym, pctComplete: v.pct, applicable: true,
      }));
      return ids;
    },
  };
});
