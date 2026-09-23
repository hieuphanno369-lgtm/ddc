import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ResourceRow } from '@/lib/resources';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
  useLocale: () => 'vi',
}));

import { ResourceBreakdownChart } from './ResourceBreakdownChart';

const ROWS: ResourceRow[] = [
  { id: 1, name: 'NT A', note: 'Lắp dựng', planned: 100, actual: 96 },
  { id: 2, name: 'NT B', note: '', planned: 0, actual: 3 },
];

describe('ResourceBreakdownChart', () => {
  it('render dung ten/ty le/dong tong', () => {
    const out = renderToStaticMarkup(React.createElement(ResourceBreakdownChart, { rows: ROWS, kind: 'manpower' }));
    expect(out).toContain('NT A');
    expect(out).toContain('96%');
    expect(out).toContain('detail.res.totalMan|2');
    expect(out).toContain('>-<');
  });

  it('mang rong -> hien trang thai trong', () => {
    const out = renderToStaticMarkup(React.createElement(ResourceBreakdownChart, { rows: [], kind: 'manpower' }));
    expect(out).toContain('detail.noDailyData');
  });
});
