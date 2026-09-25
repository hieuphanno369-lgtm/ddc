import { describe, expect, it } from 'vitest';
import {
  buildShiftBars, buildWeeklyStack, projectTimeline, shiftChartMonths, shiftsForMonth, timelineMonths, weeksInMonth,
  type ProjectDates, type ShiftInfo,
} from './manpower-charts';
import type { ShiftMonthRow, WeekContractorRow } from '@/server/repo/read-types';

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

const NO_DATES: ProjectDates = { plannedStartDate: null, plannedFinishDate: null, actualStartDate: null, actualFinishDate: null };

describe('projectTimeline (Q5)', () => {
  it('co actual -> dung actualStart/actualFinish (bo qua planned)', () => {
    const p: ProjectDates = {
      actualStartDate: '2026-09-02', actualFinishDate: '2026-09-22',
      plannedStartDate: '2026-01-01', plannedFinishDate: '2026-12-31',
    };
    expect(projectTimeline(p, null)).toEqual({ from: '2026-09-02', to: '2026-09-22' });
  });

  it('chi planned (khong co actual) -> dung planned', () => {
    const p: ProjectDates = { ...NO_DATES, plannedStartDate: '2026-09-02', plannedFinishDate: '2026-09-22' };
    expect(projectTimeline(p, null)).toEqual({ from: '2026-09-02', to: '2026-09-22' });
  });

  it('noi cho chua dataRange khi du lieu nam ngoai ngay du an', () => {
    const p: ProjectDates = { ...NO_DATES, actualStartDate: '2026-09-02', actualFinishDate: '2026-09-22' };
    const out = projectTimeline(p, { from: '2026-08-25', to: '2026-09-25' });
    expect(out).toEqual({ from: '2026-08-25', to: '2026-09-25' });
  });

  it('khong co gi (khong ngay du an, khong dataRange) -> null', () => {
    expect(projectTimeline(NO_DATES, null)).toBeNull();
  });

  it('dau > cuoi (du lieu nhap sai) -> doi cho', () => {
    const p: ProjectDates = { ...NO_DATES, actualStartDate: '2026-09-22', actualFinishDate: '2026-09-02' };
    expect(projectTimeline(p, null)).toEqual({ from: '2026-09-02', to: '2026-09-22' });
  });

  it('thieu 1 dau/cuoi -> lay tu dataRange, van noi neu dataRange rong hon', () => {
    const p: ProjectDates = { ...NO_DATES, actualFinishDate: '2026-09-10' };
    const out = projectTimeline(p, { from: '2026-09-01', to: '2026-09-15' });
    expect(out).toEqual({ from: '2026-09-01', to: '2026-09-15' });
  });

  it('thieu ca 2 ngay -> dung ngay dau/cuoi co so lieu (dataRange)', () => {
    expect(projectTimeline(NO_DATES, { from: '2026-09-01', to: '2026-09-15' })).toEqual({ from: '2026-09-01', to: '2026-09-15' });
  });
});

describe('buildWeeklyStack', () => {
  // range 2026-09-02 (Thu 4) .. 2026-09-22 (Thu 3): 4 tuan, tuan giua (09-14..09-20) khong co dong.
  const RANGE = { from: '2026-09-02', to: '2026-09-22' };
  const ROWS: WeekContractorRow[] = [
    { weekStart: '2026-08-31', contractorId: 1, planned: 50, actual: 45 }, // tuan dau, 5 ngay thuc (02-06/09)
    { weekStart: '2026-09-07', contractorId: 1, planned: 70, actual: 63 }, // tuan giua, du 7 ngay
    { weekStart: '2026-09-21', contractorId: 1, planned: 20, actual: 18 }, // tuan cuoi, 2 ngay thuc (21-22/09)
  ];

  it('sinh dung 4 tuan, weekStart la Thu 2', () => {
    const weeks = buildWeeklyStack(ROWS, RANGE);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
    for (const w of weeks) expect(new Date(`${w.weekStart}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it('tuan dau (du an bat dau Thu 4) -> days = 5', () => {
    const weeks = buildWeeklyStack(ROWS, RANGE);
    expect(weeks[0].days).toBe(5);
    expect(weeks[0].actualByContractor[1]).toBe(Math.round(45 / 5));
    expect(weeks[0].actualAvg).toBe(Math.round(45 / 5));
  });

  it('tuan cuoi (du an ket thuc Thu 3) -> days = 2', () => {
    const weeks = buildWeeklyStack(ROWS, RANGE);
    expect(weeks[3].days).toBe(2);
    expect(weeks[3].actualByContractor[1]).toBe(Math.round(18 / 2));
  });

  it('tuan giua khong co dong -> cot 0, days = 7', () => {
    const weeks = buildWeeklyStack(ROWS, RANGE);
    expect(weeks[2].days).toBe(7);
    expect(weeks[2].actualByContractor).toEqual({});
    expect(weeks[2].actualAvg).toBe(0);
  });

  it('du an ngan hon 1 tuan (dau va cuoi cung 1 tuan) -> 1 tuan, days = so ngay that', () => {
    const weeks = buildWeeklyStack(
      [{ weekStart: '2026-09-07', contractorId: 1, planned: 30, actual: 27 }],
      { from: '2026-09-08', to: '2026-09-10' },
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0].days).toBe(3);
    expect(weeks[0].actualByContractor[1]).toBe(Math.round(27 / 3));
  });
});

describe('weeksInMonth', () => {
  it('tuan vat qua 2 thang (28/09-04/10/2026) thuoc ca 2026-09 va 2026-10', () => {
    const weeks = buildWeeklyStack(
      [{ weekStart: '2026-09-28', contractorId: 1, planned: 10, actual: 10 }],
      { from: '2026-09-25', to: '2026-10-06' },
    );
    const sepIdx = weeksInMonth(weeks, '2026-09');
    const octIdx = weeksInMonth(weeks, '2026-10');
    const vatWeekIdx = weeks.findIndex((w) => w.weekStart === '2026-09-28');
    expect(sepIdx).toContain(vatWeekIdx);
    expect(octIdx).toContain(vatWeekIdx);
  });
});

describe('timelineMonths', () => {
  it('cac thang timeline di qua, tang dan', () => {
    expect(timelineMonths({ from: '2026-08-15', to: '2026-10-05' })).toEqual(['2026-08', '2026-09', '2026-10']);
  });
});
