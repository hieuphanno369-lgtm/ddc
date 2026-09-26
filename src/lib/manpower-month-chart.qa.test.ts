import { describe, expect, it } from 'vitest';
import { buildManpowerMonthModel, niceMax } from './manpower-month-chart';
import type { ManpowerPlanMonthRow, ShiftRatio } from '@/lib/p3c-contract';
import type { ShiftInfo } from '@/lib/manpower-charts';
import type { ManpowerActualMonthRow } from '@/server/repo/read-types';

/**
 * QA doc lap cho manpower-month-chart.ts (T5). Dung ma ca THAT cua dim_shift (morning/evening,
 * xem `D:\_project\DDC_Control_Tower-B` DB ddc_control_tower_b qua psql) thay vi fixture
 * 'afternoon' cua coder, va so lieu TT thang 2026-09 du an 1 doc lap tu psql:
 *   SELECT to_char("workDate",'YYYY-MM'), SUM("actualHeadcount"), COUNT(DISTINCT "workDate")
 *   FROM fact_daily_manpower WHERE "projectId"=1 GROUP BY 1;  ->  2026-09 | 3168 | 7
 * actualAvg ky vong = Math.round(3168/7) = 453.
 */
const REAL_SHIFTS: ShiftInfo[] = [
  { code: 'morning', name: 'Ca sáng', sortOrder: 1, isActive: true },
  { code: 'evening', name: 'Ca tối', sortOrder: 2, isActive: true },
];
const REAL_RATIOS: ShiftRatio[] = [
  { shiftCode: 'morning', pct: 0.6 },
  { shiftCode: 'evening', pct: 0.4 },
];

describe('QA - ca doc tu dim_shift that (morning/evening), khong ghi cung ten', () => {
  it('ten ca lay dung tu ShiftInfo.name, thu tu theo sortOrder (morning truoc evening)', () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-09', shiftCode: 'evening', planned: 40, isManual: false },
      { yearMonth: '2026-09', shiftCode: 'morning', planned: 60, isManual: false },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: REAL_RATIOS, shifts: REAL_SHIFTS, actual: [] })!;
    expect(model.shifts.map((s) => s.code)).toEqual(['morning', 'evening']);
    expect(model.shifts[0].name).toBe('Ca sáng');
    expect(model.shifts[1].name).toBe('Ca tối');
    expect(model.shifts[0].pct).toBe(0.6);
    expect(model.shifts[1].pct).toBe(0.4);
  });
});

describe('QA - actualAvg doi chieu voi so lieu that trong DB B (du an 1, thang 2026-09)', () => {
  it('actualSum 3168 / days 7 -> Math.round = 453 (doc lap voi psql)', () => {
    const plan: ManpowerPlanMonthRow[] = [{ yearMonth: '2026-09', shiftCode: 'morning', planned: 10, isManual: false }];
    const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-09', actualSum: 3168, days: 7 }];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual })!;
    const sep = model.months.find((m) => m.yearMonth === '2026-09')!;
    expect(sep.actualAvg).toBe(453);
    expect(sep.actualDays).toBe(7);
  });

  it('lam tron .5 huong len (Math.round): actualSum 5, days 2 -> 3 (khong phai 2)', () => {
    const plan: ManpowerPlanMonthRow[] = [{ yearMonth: '2026-01', shiftCode: 'morning', planned: 1, isManual: false }];
    const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-01', actualSum: 5, days: 2 }];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual })!;
    expect(model.months[0].actualAvg).toBe(3);
  });
});

describe('QA - truc thang lien tuc: TT sau KH (khac tinh huong "TT truoc KH" cua coder)', () => {
  it('KH chi co thang 01, TT chi co thang 04 -> dai thang tu 01 den 04, 02/03 hasPlan false, khong co TT', () => {
    const plan: ManpowerPlanMonthRow[] = [{ yearMonth: '2026-01', shiftCode: 'morning', planned: 50, isManual: false }];
    const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-04', actualSum: 200, days: 10 }];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual })!;
    expect(model.months.map((m) => m.yearMonth)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(model.months[1].hasPlan).toBe(false);
    expect(model.months[1].actualAvg).toBeNull();
    expect(model.months[3].actualAvg).toBe(20);
    expect(model.months[3].hasPlan).toBe(false);
  });
});

describe('QA - tong KH thang = sigma cac ca (khong luu rieng, theo hop dong)', () => {
  it('3 ca cung thang -> plannedTotal = tong 3 gia tri', () => {
    const shifts: ShiftInfo[] = [
      { code: 'morning', name: 'Ca sáng', sortOrder: 1, isActive: true },
      { code: 'evening', name: 'Ca tối', sortOrder: 2, isActive: true },
      { code: 'night', name: 'Ca đêm', sortOrder: 3, isActive: true },
    ];
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-05', shiftCode: 'morning', planned: 100, isManual: false },
      { yearMonth: '2026-05', shiftCode: 'evening', planned: 80, isManual: true },
      { yearMonth: '2026-05', shiftCode: 'night', planned: 20, isManual: false },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts, actual: [] })!;
    expect(model.months[0].plannedTotal).toBe(200);
  });
});

describe('QA - truong hop PHAI THAT BAI (du lieu hong bi vo hieu, khong lam sap he thong)', () => {
  it('planned am -> tinh la 0, khong lam plannedTotal am', () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-06', shiftCode: 'morning', planned: -50, isManual: false },
      { yearMonth: '2026-06', shiftCode: 'evening', planned: 30, isManual: false },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual: [] })!;
    expect(model.months[0].planned.morning).toBe(0);
    expect(model.months[0].plannedTotal).toBe(30); // KHONG duoc la -20
  });

  it('planned khong phai so nguyen (NaN tu du lieu hong) -> tinh la 0, khong throw', () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-06', shiftCode: 'morning', planned: Number.NaN, isManual: false },
      { yearMonth: '2026-06', shiftCode: 'evening', planned: 12.5, isManual: false },
    ];
    expect(() => buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual: [] })).not.toThrow();
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual: [] })!;
    expect(model.months[0].planned.morning).toBe(0);
    expect(model.months[0].planned.evening).toBe(0);
  });

  it('actual co days=0 (du lieu hong tu repo) -> actualAvg null, khong chia cho 0', () => {
    const plan: ManpowerPlanMonthRow[] = [{ yearMonth: '2026-07', shiftCode: 'morning', planned: 10, isManual: false }];
    const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-07', actualSum: 100, days: 0 }];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: REAL_SHIFTS, actual })!;
    expect(model.months[0].actualAvg).toBeNull();
    expect(Number.isFinite(model.months[0].actualAvg as number)).toBe(false); // null, khong phai Infinity
  });
});

describe('QA - niceMax doc lap voi test cua coder', () => {
  it('cac gia tri khac: 199 -> 200, 3200 -> 5000, 1 -> 1... ep ve 1', () => {
    expect(niceMax(199)).toBe(200);
    expect(niceMax(3200)).toBe(5000);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(-10)).toBe(10); // am -> mac dinh 10 (giong 0)
  });
});
