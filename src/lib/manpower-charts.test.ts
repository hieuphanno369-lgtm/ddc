import { describe, expect, it } from 'vitest';
import { buildShiftBars, shiftChartMonths, shiftsForMonth, type ShiftInfo } from './manpower-charts';
import type { ShiftMonthRow } from '@/server/repo/read-types';

const SHIFTS: ShiftInfo[] = [
  { code: 'morning', name: 'Ca sáng', sortOrder: 1, isActive: true },
  { code: 'afternoon', name: 'Ca chiều', sortOrder: 2, isActive: true },
  { code: 'night', name: 'Ca tối', sortOrder: 3, isActive: false },
];

describe('shiftChartMonths', () => {
  it('giam dan, co pageMonth du khong co du lieu, khong trung', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-07', contractorId: 1, shiftCode: 'morning', planned: 1, actual: 1, days: 1 },
      { yearMonth: '2026-08', contractorId: 1, shiftCode: 'morning', planned: 1, actual: 1, days: 1 },
      { yearMonth: '2026-08', contractorId: 2, shiftCode: 'morning', planned: 1, actual: 1, days: 1 },
    ];
    expect(shiftChartMonths(rows, '2026-09')).toEqual(['2026-09', '2026-08', '2026-07']);
  });
});

describe('shiftsForMonth', () => {
  it('ca la khong co trong dim_shift -> name = code, sortOrder = 999', () => {
    const rows: ShiftMonthRow[] = [{ yearMonth: '2026-09', contractorId: 1, shiftCode: 'x', planned: 1, actual: 1, days: 1 }];
    const out = shiftsForMonth(rows, '2026-09', []);
    expect(out).toEqual([{ code: 'x', name: 'x', sortOrder: 999, isActive: false }]);
  });

  it('ca inactive co du lieu thang do van co; ca inactive khong du lieu bi bo', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'morning', planned: 1, actual: 1, days: 1 },
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'night', planned: 1, actual: 1, days: 1 },
    ];
    const out = shiftsForMonth(rows, '2026-09', SHIFTS);
    expect(out.map((s) => s.code)).toEqual(['morning', 'afternoon', 'night']);
  });

  it('khong co du lieu ca night -> khong hien (inactive)', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'morning', planned: 1, actual: 1, days: 1 },
    ];
    const out = shiftsForMonth(rows, '2026-09', SHIFTS);
    expect(out.map((s) => s.code)).toEqual(['morning', 'afternoon']);
  });

  it('sort theo sortOrder', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'afternoon', planned: 1, actual: 1, days: 1 },
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'morning', planned: 1, actual: 1, days: 1 },
    ];
    const out = shiftsForMonth(rows, '2026-09', SHIFTS);
    expect(out.map((s) => s.sortOrder)).toEqual([1, 2]);
  });
});

describe('buildShiftBars', () => {
  it('TB lam tron: sum 25 / days 2 -> 13', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'morning', planned: 20, actual: 25, days: 2 },
    ];
    const out = buildShiftBars(rows, '2026-09', [{ id: 1, name: 'NT A' }]);
    expect(out[0].actual.morning).toBe(13);
    expect(out[0].days.morning).toBe(2);
  });

  it('nha thau thieu ten -> #id', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-09', contractorId: 9, shiftCode: 'morning', planned: 10, actual: 10, days: 1 },
    ];
    const out = buildShiftBars(rows, '2026-09', []);
    expect(out[0].name).toBe('#9');
  });

  it('sort giam dan tong actual', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'morning', planned: 10, actual: 10, days: 1 },
      { yearMonth: '2026-09', contractorId: 2, shiftCode: 'morning', planned: 30, actual: 30, days: 1 },
    ];
    const out = buildShiftBars(rows, '2026-09', [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    expect(out.map((d) => d.contractorId)).toEqual([2, 1]);
  });

  it('chi lay dong dung yearMonth', () => {
    const rows: ShiftMonthRow[] = [
      { yearMonth: '2026-08', contractorId: 1, shiftCode: 'morning', planned: 10, actual: 10, days: 1 },
      { yearMonth: '2026-09', contractorId: 1, shiftCode: 'morning', planned: 20, actual: 20, days: 1 },
    ];
    const out = buildShiftBars(rows, '2026-09', [{ id: 1, name: 'A' }]);
    expect(out).toHaveLength(1);
    expect(out[0].actual.morning).toBe(20);
  });
});
