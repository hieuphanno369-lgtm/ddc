import { describe, expect, it } from 'vitest';
import { buildManpowerMonthModel, niceMax } from './manpower-month-chart';
import type { ManpowerPlanMonthRow, ShiftRatio } from '@/lib/p3c-contract';
import type { ShiftInfo } from '@/lib/manpower-charts';
import type { ManpowerActualMonthRow } from '@/server/repo/read-types';

const SHIFTS: ShiftInfo[] = [
  { code: 'morning', name: 'Ca ngày', sortOrder: 1, isActive: true },
  { code: 'afternoon', name: 'Ca tối', sortOrder: 2, isActive: true },
];
const RATIOS: ShiftRatio[] = [
  { shiftCode: 'morning', pct: 0.6 },
  { shiftCode: 'afternoon', pct: 0.4 },
];

/** Seed anh mau: 7 thang 03..09/2026, tong 450,700,800,900,800,650,400 chia dung 60/40. */
const MONTH_TOTALS: [string, number][] = [
  ['2026-03', 450], ['2026-04', 700], ['2026-05', 800], ['2026-06', 900],
  ['2026-07', 800], ['2026-08', 650], ['2026-09', 400],
];
const SEED_PLAN: ManpowerPlanMonthRow[] = MONTH_TOTALS.flatMap(([yearMonth, total]) => [
  { yearMonth, shiftCode: 'morning', planned: Math.round(total * 0.6), isManual: false },
  { yearMonth, shiftCode: 'afternoon', planned: Math.round(total * 0.4), isManual: false },
]);

describe('buildManpowerMonthModel - seed anh mau', () => {
  const model = buildManpowerMonthModel({ plan: SEED_PLAN, ratios: RATIOS, shifts: SHIFTS, actual: [] })!;

  it('7 thang, plannedTotal dung day, maxY 1000, ten/ty le ca dung', () => {
    expect(model.months).toHaveLength(7);
    expect(model.months.map((m) => m.plannedTotal)).toEqual(MONTH_TOTALS.map(([, t]) => t));
    expect(model.maxY).toBe(1000);
    expect(model.shifts[0].name).toBe('Ca ngày');
    expect(model.shifts[0].pct).toBe(0.6);
  });
});

describe('buildManpowerMonthModel - bien', () => {
  it('thang thieu giua dai -> van co, plannedTotal 0, hasPlan false', () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-03', shiftCode: 'morning', planned: 100, isManual: false },
      { yearMonth: '2026-05', shiftCode: 'morning', planned: 200, isManual: false },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual: [] })!;
    expect(model.months.map((m) => m.yearMonth)).toEqual(['2026-03', '2026-04', '2026-05']);
    const apr = model.months.find((m) => m.yearMonth === '2026-04')!;
    expect(apr.plannedTotal).toBe(0);
    expect(apr.hasPlan).toBe(false);
  });

  it('actualAvg = actualSum/days lam tron; thang khong co dong actual -> null', () => {
    const plan: ManpowerPlanMonthRow[] = [{ yearMonth: '2026-09', shiftCode: 'morning', planned: 10, isManual: false }];
    const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-09', actualSum: 3100, days: 10 }];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual })!;
    const sep = model.months.find((m) => m.yearMonth === '2026-09')!;
    expect(sep.actualAvg).toBe(310);
    expect(sep.actualDays).toBe(10);
  });

  it('thang chi co TT (truoc KH) -> nam dau dai, hasPlan false', () => {
    const plan: ManpowerPlanMonthRow[] = [{ yearMonth: '2026-03', shiftCode: 'morning', planned: 10, isManual: false }];
    const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-02', actualSum: 100, days: 5 }];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual })!;
    expect(model.months[0].yearMonth).toBe('2026-02');
    expect(model.months[0].hasPlan).toBe(false);
  });

  it("ma ca la 'night' khong co trong shifts -> name 'night', xep cuoi", () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-03', shiftCode: 'night', planned: 10, isManual: false },
      { yearMonth: '2026-03', shiftCode: 'morning', planned: 20, isManual: false },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual: [] })!;
    expect(model.shifts.at(-1)!.code).toBe('night');
    expect(model.shifts.at(-1)!.name).toBe('night');
  });

  it('rong hoan toan -> null', () => {
    expect(buildManpowerMonthModel({ plan: [], ratios: [], shifts: [], actual: [] })).toBeNull();
  });
});

describe('niceMax', () => {
  it('lam tron len bac dep', () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(900)).toBe(1000);
    expect(niceMax(450)).toBe(500);
    expect(niceMax(26)).toBe(50);
    expect(niceMax(7)).toBe(10);
  });
});
