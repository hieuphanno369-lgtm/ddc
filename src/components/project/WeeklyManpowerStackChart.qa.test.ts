import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WeeklyChartData } from '@/server/manpower-queries';
import type { useTranslations } from 'next-intl';

/**
 * QA doc lap cho T1 (nhan so chart tuan + tooltip actualAvg). Render that qua renderToStaticMarkup
 * (khong chi goi ham noi bo weeklyLabelValues) de xac nhan LabelList cua Recharts thuc su ve dung
 * con so trong markup SVG cuoi cung - day la diem coder tu ghi "luu y ky thuat" ve dataKey ham.
 */
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { WeeklyManpowerStackChart, weeklyTooltip } from './WeeklyManpowerStackChart';

const DATA: WeeklyChartData = {
  contractors: [{ id: 1, name: 'NT X' }, { id: 2, name: 'NT Y' }],
  range: { from: '2026-09-02', to: '2026-09-23' },
  weeks: [
    { weekStart: '2026-09-02', weekEnd: '2026-09-08', label: '02/09', days: 7, actualByContractor: { 1: 5, 2: 3 }, actualAvg: 42, plannedAvg: 37 },
    { weekStart: '2026-09-09', weekEnd: '2026-09-15', label: '09/09', days: 7, actualByContractor: { 1: 0, 2: 0 }, actualAvg: 0, plannedAvg: 0 },
    { weekStart: '2026-09-16', weekEnd: '2026-09-22', label: '16/09', days: 7, actualByContractor: { 1: 20, 2: 25 }, actualAvg: 45, plannedAvg: 0 },
  ],
};

function render() {
  return renderToStaticMarkup(React.createElement(WeeklyManpowerStackChart, { data: DATA, initialMonth: '2026-09' }));
}

describe('QA WeeklyManpowerStackChart - render markup SVG that (khong chi test ham thuan)', () => {
  const out = render();

  it('tuan co so lieu (42, 37) -> markup chua ca 2 con so (nhan cot + nhan duong KH)', () => {
    expect(out).toMatch(/>42</);
    expect(out).toMatch(/>37</);
  });

  it('tuan actualAvg=45, plannedAvg=0 -> co nhan 45 nhung KHONG co nhan "0" tren duong KH', () => {
    expect(out).toMatch(/>45</);
  });

  it('tuan rong (actualAvg=0, plannedAvg=0) -> khong ve nhan "0" tren nhan tong cot (fontWeight 700, fontSize 10)', () => {
    // Chi soi nhan LabelList cua Bar tong (style fontSize:10;fontWeight:700 - dac trung rieng,
    // khac voi tick truc Y "0" cung xuat hien trong SVG). weeklyLabelValues() phai tra null ->
    // Recharts nhan dataKey '' -> khong ve <text> noi dung '0' voi style nay.
    const totalLabelZero = /font-size:10px;font-weight:700[^>]*>0</.test(out);
    expect(totalLabelZero).toBe(false);
  });
});

describe('QA weeklyTooltip - actualAvg khac tong da lam tron, doc lap voi bo so cua coder', () => {
  it('3 nha thau, tong lam tron tung nguoi = 11 nhung actualAvg that = 13 -> tooltip phai hien 13', () => {
    const t = (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k);
    const contractors = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    const week = {
      weekStart: '2026-09-14', weekEnd: '2026-09-20', label: '14/09', days: 7,
      actualByContractor: { 1: 4, 2: 4, 3: 3 }, actualAvg: 13, plannedAvg: 13,
    };
    const Tip = weeklyTooltip(contractors, t as unknown as ReturnType<typeof useTranslations>);
    const el = Tip({ active: true, payload: [{ payload: week }] });
    const html = renderToStaticMarkup(el as React.ReactElement);
    expect(html).toContain('manpowerCharts.total: 13');
    expect(html).not.toContain('manpowerCharts.total: 11');
  });

  it('khong active hoac payload rong -> tra null, khong render gi', () => {
    const t = (k: string) => k;
    const Tip = weeklyTooltip([], t as unknown as ReturnType<typeof useTranslations>);
    expect(Tip({ active: false, payload: [] })).toBeNull();
    expect(Tip({ active: true, payload: [] })).toBeNull();
  });
});
