import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ShiftChartData } from '@/server/manpower-queries';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { ShiftManpowerChart } from './ShiftManpowerChart';

describe('ShiftManpowerChart', () => {
  it('thang khong du lieu -> co manpowerCharts.noDataMonth, select van hien', () => {
    const data: ShiftChartData = { shifts: [], contractors: [], rows: [] };
    const out = renderToStaticMarkup(React.createElement(ShiftManpowerChart, { data, initialMonth: '2026-09' }));
    expect(out).toContain('manpowerCharts.noDataMonth|09/2026');
    expect(out).toContain('<select');
    expect(out).toContain('>09/2026<');
  });
});
