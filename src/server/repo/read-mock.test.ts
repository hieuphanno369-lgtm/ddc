import { describe, expect, it } from 'vitest';
import { buildRepoData } from '@/data/seed/history';
import { createReadMock } from './read-mock';

const data = buildRepoData();
const mock = createReadMock(() => data);

describe('read-mock', () => {
  it('readManpowerByShiftMonth: co dung cac shiftCode cua seed, tong actual khop tong actualHeadcount', async () => {
    const rows = await mock.readManpowerByShiftMonth(1);
    const seedRows = data.dailyManpowerShifts.filter((r) => r.projectId === 1);
    const seedShiftCodes = new Set(seedRows.map((r) => r.shiftCode));
    const rowShiftCodes = new Set(rows.map((r) => r.shiftCode));
    expect(rowShiftCodes).toEqual(seedShiftCodes);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    const seedActual = seedRows.reduce((s, r) => s + r.actualHeadcount, 0);
    expect(totalActual).toBe(seedActual);
  });

  it('readManpowerWeekly: moi weekStart la Thu 2', async () => {
    const rows = await mock.readManpowerWeekly(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const dow = new Date(`${r.weekStart}T00:00:00Z`).getUTCDay();
      expect(dow).toBe(1);
    }
  });

  it('readEquipmentPlans(1) dai 6, sort dung', async () => {
    const rows = await mock.readEquipmentPlans(1);
    expect(rows).toHaveLength(6);
    const sorted = [...rows].sort((a, b) =>
      a.equipmentId - b.equipmentId || a.unitNo - b.unitNo
      || a.plannedStart.localeCompare(b.plannedStart) || a.id - b.id);
    expect(rows).toEqual(sorted);
  });

  it('readEquipmentUsageDays: khong co dong qtyActual = 0', async () => {
    const range = await mock.readManpowerRange(1);
    expect(range).not.toBeNull();
    const rows = await mock.readEquipmentUsageDays(1, range!.from, range!.to);
    for (const r of rows) expect(r.qtyActual).toBeGreaterThan(0);
  });

  it('du an 17 (khong ton tai) -> rong/null', async () => {
    expect(await mock.readManpowerByShiftMonth(17)).toEqual([]);
    expect(await mock.readManpowerWeekly(17)).toEqual([]);
    expect(await mock.readManpowerRange(17)).toBeNull();
    expect(await mock.readEquipmentPlans(17)).toEqual([]);
    expect(await mock.readEquipmentUsageDays(17, '2020-01-01', '2035-12-31')).toEqual([]);
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

  it('readMonthlyEvm: khop cong tay tren buildRepoData().facts', async () => {
    const months = ['2026-08', '2026-09'];
    const ids = [1, 2];
    const rows = await mock.readMonthlyEvm(months, ids);
    for (const m of months) {
      const facts = data.facts.filter((f) => f.isLatest && ids.includes(f.projectId) && f.yearMonth === m);
      const row = rows.find((r) => r.yearMonth === m);
      if (facts.length === 0) {
        expect(row).toBeUndefined();
        continue;
      }
      expect(row).toBeDefined();
      expect(row!.pv).toBeCloseTo(facts.reduce((s, f) => s + f.pv, 0));
      expect(row!.ev).toBeCloseTo(facts.reduce((s, f) => s + f.ev, 0));
      expect(row!.ac).toBeCloseTo(facts.reduce((s, f) => s + f.ac, 0));
    }
  });

  it('readMonthlyEvm([], ids) hoac (months, []) -> mang rong', async () => {
    expect(await mock.readMonthlyEvm([], [1])).toEqual([]);
    expect(await mock.readMonthlyEvm(['2026-09'], [])).toEqual([]);
  });
});
