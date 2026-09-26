import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WeeklyChartData } from '@/server/manpower-queries';
import type { useTranslations } from 'next-intl';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { WeeklyManpowerStackChart, weeklyLabelValues, weeklyTooltip } from './WeeklyManpowerStackChart';

const DATA: WeeklyChartData = {
  contractors: [{ id: 1, name: 'NT A' }],
  range: { from: '2026-09-02', to: '2026-09-10' },
  weeks: [
    { weekStart: '2026-08-31', weekEnd: '2026-09-06', label: '31/08', days: 5, actualByContractor: { 1: 10 }, actualAvg: 10, plannedAvg: 12 },
    { weekStart: '2026-09-07', weekEnd: '2026-09-13', label: '07/09', days: 4, actualByContractor: { 1: 8 }, actualAvg: 8, plannedAvg: 9 },
  ],
};

describe('WeeklyManpowerStackChart', () => {
  it('render co role="region" va select co option "all"', () => {
    const out = renderToStaticMarkup(React.createElement(WeeklyManpowerStackChart, { data: DATA, initialMonth: '2026-09' }));
    expect(out).toContain('role="region"');
    expect(out).toContain('<select');
    expect(out).toContain('manpowerCharts.allMonths');
  });

  it('mang weeks rong -> trang thai rong', () => {
    const empty: WeeklyChartData = { ...DATA, weeks: [] };
    const out = renderToStaticMarkup(React.createElement(WeeklyManpowerStackChart, { data: empty, initialMonth: '2026-09' }));
    expect(out).toContain('manpowerCharts.noData');
  });

  it('weeklyLabelValues: co so -> co nhan, 0 -> null', () => {
    expect(weeklyLabelValues(DATA.weeks[0])).toEqual({ total: 10, planned: 12 });
    const zero = { ...DATA.weeks[0], actualAvg: 0, plannedAvg: 0 };
    expect(weeklyLabelValues(zero)).toEqual({ total: null, planned: null });
  });

  it('tooltip dung actualAvg (TB that) chu khong cong so da lam tron', () => {
    const t = (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k);
    const contractors = [{ id: 1, name: 'NT A' }, { id: 2, name: 'NT B' }];
    const week = { weekStart: '2026-09-14', weekEnd: '2026-09-20', label: '14/09', days: 7, actualByContractor: { 1: 7, 2: 7 }, actualAvg: 15, plannedAvg: 15 };
    const Tip = weeklyTooltip(contractors, t as unknown as ReturnType<typeof useTranslations>);
    const el = Tip({ active: true, payload: [{ payload: week }] });
    const out = renderToStaticMarkup(el as React.ReactElement);
    expect(out).toContain('manpowerCharts.total: 15');
    expect(out).not.toContain(': 14<');
    expect(out).toContain('NT A: 7');
  });
});
