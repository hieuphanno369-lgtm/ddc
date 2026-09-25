import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WeeklyChartData } from '@/server/manpower-queries';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { WeeklyManpowerStackChart } from './WeeklyManpowerStackChart';

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
});
