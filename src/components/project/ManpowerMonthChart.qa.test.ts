import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildManpowerMonthModel } from '@/lib/manpower-month-chart';
import type { ManpowerPlanMonthRow, ShiftRatio } from '@/server/repo/types';
import type { ShiftInfo } from '@/lib/manpower-charts';
import type { ManpowerActualMonthRow } from '@/server/repo/read-types';

/**
 * Test doc lap (Tester) cho ManpowerMonthChart - Buoc 11.
 * Bo sung ManpowerMonthChart.test.ts (coder): tap trung do TOA DO PIXEL that cua SVG de bat
 * loi de nhau giua nhan duong TT TB/ngay va nhan cot KH ca, giong bug da chup anh that tren
 * du an 1 (thang 09/2026: cot Ca toi = 360, diem TT = 453).
 */

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { ManpowerMonthChart } from './ManpowerMonthChart';

const SHIFTS: ShiftInfo[] = [
  { code: 'morning', name: 'Ca sáng', sortOrder: 1, isActive: true },
  { code: 'evening', name: 'Ca tối', sortOrder: 2, isActive: true },
];
const RATIOS: ShiftRatio[] = [
  { shiftCode: 'morning', pct: 0.6 },
  { shiftCode: 'evening', pct: 0.4 },
];

function render(model: NonNullable<ReturnType<typeof buildManpowerMonthModel>>) {
  return renderToStaticMarkup(React.createElement(ManpowerMonthChart, { model }));
}

/** Doc y cua <text> chua dung noi dung so (tranh khop nham "4530" chua "453"). */
function textY(svg: string, exactContent: string): number {
  const re = new RegExp(`<text[^>]*\\sy="([\\d.]+)"[^>]*>${exactContent}<`);
  const m = svg.match(re);
  if (!m) throw new Error(`khong tim thay <text> voi noi dung "${exactContent}"`);
  return Number(m[1]);
}

describe('ManpowerMonthChart - duong chay thuan loi', () => {
  const plan: ManpowerPlanMonthRow[] = [
    { yearMonth: '2026-06', shiftCode: 'morning', planned: 270, isManual: false },
    { yearMonth: '2026-06', shiftCode: 'evening', planned: 180, isManual: false },
  ];
  const model = buildManpowerMonthModel({ plan, ratios: RATIOS, shifts: SHIFTS, actual: [] })!;
  const out = render(model);

  it('ve dung 1 thang, dung nhan ca va tong', () => {
    expect(out).toContain('06/2026');
    expect(out).toContain('>270<');
    expect(out).toContain('>180<');
    expect(out).toContain('>450<');
  });
});

describe('ManpowerMonthChart - BUG tim thay (PHAI THAT BAI): nhan diem TT TB/ngay de len nhan cot ca khi 2 gia tri gan nhau', () => {
  // Tai hien dung so lieu that tu du an 1 (seed), thang 09/2026: KH Ca sang 540, Ca toi 360,
  // TT TB/ngay 453 (actualSum 4530 / 10 ngay). Anh chup thuc te:
  // .bangiao/anh-test/p3c-a-b11-resshift-1440.png (thang 09/2026, chu "45360" bi de nhau).
  const plan: ManpowerPlanMonthRow[] = [
    { yearMonth: '2026-09', shiftCode: 'morning', planned: 540, isManual: false },
    { yearMonth: '2026-09', shiftCode: 'evening', planned: 360, isManual: false },
  ];
  const actual: ManpowerActualMonthRow[] = [{ yearMonth: '2026-09', actualSum: 4530, days: 10 }];
  const model = buildManpowerMonthModel({ plan, ratios: RATIOS, shifts: SHIFTS, actual })!;
  const out = render(model);

  it('actualAvg dung 453 (dung tien de bug)', () => {
    expect(model.months[0].actualAvg).toBe(453);
  });

  it('khoang cach doc giua nhan "453" (diem TT) va nhan "360" (cot Ca toi) phai >= 14px de khong de nhau - CODE HIEN TAI CHI CACH VAI PX', () => {
    const yActual = textY(out, '453');
    const yBar = textY(out, '360');
    const gap = Math.abs(yActual - yBar);
    // Ky vong DUNG (san pham phai dat): 2 nhan cach nhau it nhat 1 dong chu (~14px).
    // Thuc te: nhan TT ve o p.y+16 (duoi diem), nhan cot ve o barY-4 (tren dinh cot); khi 2 gia
    // tri gan nhau ve thang do (540/360/453 cung thang), khoang cach thuc te chi con vai px,
    // chu de chong len nhau y het anh chup that -> test nay THAT BAI, xac nhan bug co that.
    expect(gap).toBeGreaterThanOrEqual(14);
  });
});

describe('ManpowerMonthChart - truong hop bien: ma ca la khong lam vo giao dien', () => {
  it('ma ca "night" khong co trong dim_shift -> van ve duoc, hien ma ca lam nhan truc', () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-03', shiftCode: 'night', planned: 10, isManual: false },
      { yearMonth: '2026-03', shiftCode: 'morning', planned: 20, isManual: false },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual: [] })!;
    expect(() => render(model)).not.toThrow();
    const out = render(model);
    expect(out).toContain('>night<');
  });
});

describe('ManpowerMonthChart - truong hop bien: thang thieu giua dai -> duong TT dut doan', () => {
  it('thang giua khong co TT -> polyline duong TT tach thanh 2 doan rieng (dut net)', () => {
    const plan: ManpowerPlanMonthRow[] = [
      { yearMonth: '2026-01', shiftCode: 'morning', planned: 100, isManual: false },
      { yearMonth: '2026-02', shiftCode: 'morning', planned: 100, isManual: false },
      { yearMonth: '2026-03', shiftCode: 'morning', planned: 100, isManual: false },
    ];
    const actual: ManpowerActualMonthRow[] = [
      { yearMonth: '2026-01', actualSum: 100, days: 10 },
      { yearMonth: '2026-03', actualSum: 100, days: 10 },
    ];
    const model = buildManpowerMonthModel({ plan, ratios: [], shifts: SHIFTS, actual })!;
    expect(model.months.find((m) => m.yearMonth === '2026-02')!.actualAvg).toBeNull();
    const out = render(model);
    const dashedPolylines = [...out.matchAll(/<polyline[^>]*stroke-dasharray/g)];
    expect(dashedPolylines).toHaveLength(2);
  });
});
