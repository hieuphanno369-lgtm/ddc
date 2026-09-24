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
});
