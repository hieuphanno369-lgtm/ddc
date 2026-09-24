import { describe, expect, it } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { buildManpowerGrid, gridToPayload, manpowerTotals, type EquipmentGridRow } from './resourceEntryState';

const LAST_DAY = '2026-09-16';

describe('buildManpowerGrid + manpowerTotals', () => {
  it('grid du 6 x 2 o cho du an 1, totals ngay cuoi 520/486', () => {
    const members = repo.getContractors(1);
    const shifts = repo.getShifts();
    const rows = repo.getDailyManpowerByShift(1, LAST_DAY, LAST_DAY);

    const grid = buildManpowerGrid(members, shifts, rows);
    expect(grid).toHaveLength(6);
    for (const row of grid) expect(Object.keys(row.cells)).toHaveLength(2);

    const totals = manpowerTotals(grid, shifts);
    expect(totals.day.planned).toBe(520);
    expect(totals.day.actual).toBe(486);
  });
});

describe('gridToPayload', () => {
  const members = repo.getContractors(1);
  const shifts = repo.getShifts();

  it("'1.5' -> bad_number dung key", () => {
    const grid = buildManpowerGrid(members, shifts, []);
    grid[0].cells[shifts[0].code].planned = '1.5';
    const res = gridToPayload(grid, []);
    expect(res).toEqual({ ok: false, error: 'bad_number', key: `${grid[0].contractorId}.${shifts[0].code}.planned` });
  });

  it("'-1' -> bad_number", () => {
    const grid = buildManpowerGrid(members, shifts, []);
    grid[0].cells[shifts[0].code].actual = '-1';
    const res = gridToPayload(grid, []);
    expect(res).toEqual({ ok: false, error: 'bad_number', key: `${grid[0].contractorId}.${shifts[0].code}.actual` });
  });

  it("'abc' -> bad_number", () => {
    const grid = buildManpowerGrid(members, shifts, []);
    grid[0].cells[shifts[0].code].planned = 'abc';
    const res = gridToPayload(grid, []);
    expect(res).toEqual({ ok: false, error: 'bad_number', key: `${grid[0].contractorId}.${shifts[0].code}.planned` });
  });

  it("'' -> 0", () => {
    const grid = buildManpowerGrid(members, shifts, []);
    grid[0].cells[shifts[0].code].planned = '';
    const res = gridToPayload(grid, []);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const cell = res.manpower.find((m) => m.contractorId === grid[0].contractorId && m.shiftCode === shifts[0].code)!;
      expect(cell.plannedHeadcount).toBe(0);
    }
  });

  it('trung thiet bi (cung contractor + equipment) -> duplicate_equipment', () => {
    const eg: EquipmentGridRow[] = [
      { key: '1-1', contractorId: 1, equipmentId: 1, planned: '5', actual: '4', isNew: false },
      { key: '1-1-new', contractorId: 1, equipmentId: 1, planned: '2', actual: '1', isNew: true },
    ];
    const res = gridToPayload([], eg);
    expect(res).toEqual({ ok: false, error: 'duplicate_equipment', key: '1-1-new' });
  });
});
