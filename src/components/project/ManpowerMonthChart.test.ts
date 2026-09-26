import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildManpowerMonthModel } from '@/lib/manpower-month-chart';
import type { ManpowerPlanMonthRow, ShiftRatio } from '@/server/repo/types';
import type { ShiftInfo } from '@/lib/manpower-charts';
import type { ManpowerActualMonthRow } from '@/server/repo/read-types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { ManpowerMonthChart } from './ManpowerMonthChart';

const SHIFTS: ShiftInfo[] = [
  { code: 'morning', name: 'Ca ngày', sortOrder: 1, isActive: true },
  { code: 'afternoon', name: 'Ca tối', sortOrder: 2, isActive: true },
];
const RATIOS: ShiftRatio[] = [
  { shiftCode: 'morning', pct: 0.6 },
  { shiftCode: 'afternoon', pct: 0.4 },
];
const MONTH_TOTALS: [string, number][] = [
  ['2026-03', 450], ['2026-04', 700], ['2026-05', 800], ['2026-06', 900],
  ['2026-07', 800], ['2026-08', 650], ['2026-09', 400],
];
const SEED_PLAN: ManpowerPlanMonthRow[] = MONTH_TOTALS.flatMap(([yearMonth, total]) => [
  { yearMonth, shiftCode: 'morning', planned: Math.round(total * 0.6), isManual: false },
  { yearMonth, shiftCode: 'afternoon', planned: Math.round(total * 0.4), isManual: false },
]);
const SEED_ACTUAL: ManpowerActualMonthRow[] = [{ yearMonth: '2026-09', actualSum: 3100, days: 10 }];

function render(model: NonNullable<ReturnType<typeof buildManpowerMonthModel>>) {
  return renderToStaticMarkup(React.createElement(ManpowerMonthChart, { model }));
}

describe('ManpowerMonthChart - seed anh mau', () => {
  const model = buildManpowerMonthModel({ plan: SEED_PLAN, ratios: RATIOS, shifts: SHIFTS, actual: SEED_ACTUAL })!;
  const out = render(model);

  it('chua nhan thang, ten ca >= 7 lan/ten, so 270 (cot) va 450 (diem tong)', () => {
    expect(out).toContain('03/2026');
    expect(out).toContain('09/2026');
    expect((out.match(/Ca ngày/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect((out.match(/Ca tối/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(out).toContain('>270<');
    expect(out).toContain('>450<');
  });

  it('co TT thang 09 = 310; so <circle cua duong TT = so thang co TT', () => {
    expect(out).toContain('>310<');
    const circles = [...out.matchAll(/<circle/g)];
    // moi diem TT ve 1 <circle>; duong tong KH cung ve <circle> cho moi thang co KH (7 thang seed).
    const actualMonthsWithTt = SEED_ACTUAL.filter((a) => a.days > 0).length;
    expect(circles.length).toBe(model.months.filter((m) => m.hasPlan).length + actualMonthsWithTt);
  });

  it('legend chua ty le % va nhan duong tong KH / TT', () => {
    expect(out).toContain('· 60%');
    expect(out).toContain('manpowerMonthChart.planTotal');
    expect(out).toContain('manpowerMonthChart.actualAvg');
  });
});

describe('ManpowerMonthChart - thang co KH 0', () => {
  const plan: ManpowerPlanMonthRow[] = [
    { yearMonth: '2026-03', shiftCode: 'morning', planned: 100, isManual: false },
    { yearMonth: '2026-05', shiftCode: 'morning', planned: 200, isManual: false },
  ];
  const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual: [] })!;
  const out = render(model);

  it('thang 04 (KH 0) khong co nhan so tren cot', () => {
    expect(model.months.find((m) => m.yearMonth === '2026-04')!.plannedTotal).toBe(0);
    // Nhan cot dung style fill:var(--label2) - phan biet voi nhan truc Y (fill:var(--axis)) cung co the la "0".
    expect(out).not.toContain('fill:var(--label2)">0<');
  });
});

describe('ManpowerMonthChart - nhieu thang / 390px', () => {
  const plan: ManpowerPlanMonthRow[] = Array.from({ length: 24 }, (_, i) => {
    const month = String((i % 12) + 1).padStart(2, '0');
    const year = 2025 + Math.floor(i / 12);
    return { yearMonth: `${year}-${month}`, shiftCode: 'morning', planned: 10, isManual: false };
  });
  const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual: [] })!;
  const out = render(model);

  it('svg du rong cho 24 thang, markup cuon ngang', () => {
    const m = out.match(/<svg[^>]*width="([\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44 + 24 * 96 + 16);
    expect(out).toContain('overflow-x:auto');
  });
});
