import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Test doc lap (khong sua src/server/overview-finance-gate.test.ts cua coder) cho
 * TopPriorityCard + maskProjectSummaries (N-3) - P3C-B Buoc 10.
 * Bao: duong chay thuan loi (admin giu nguyen), bien (vac am, eac null san co),
 * va ca "phai that bai neu ro ri" (viewer khong duoc thay so tien).
 */

const SUMMARY_A = {
  id: 101,
  masterCode: 'M101',
  currentAliasCode: 'A101',
  projectName: 'Du an QA A',
  customerId: 1,
  customerName: 'KH A',
  teamName: 'KD1',
  teamKdId: 1,
  projectType: 'EPC',
  marketCode: 'TN',
  priority: 'P0',
  status: 'Dang_trien_khai',
  onTrack: false,
  penalty: 'penalized',
  contractValue: 999.9,
  tonnage: 500,
  pctPlan: 0.7,
  pctActual: 0.3,
  spi: 0.8,
  cpi: 0.75,
  eac: 1200.5,
  vac: -55.5,
  bottleneckStage: null,
};

const { topPriorityProps, loadTopPriority } = vi.hoisted(() => ({
  topPriorityProps: [] as Record<string, unknown>[],
  loadTopPriority: vi.fn(async () => [SUMMARY_A]),
}));

vi.mock('@/server/cache', () => ({
  loadCapacity: vi.fn(async () => []),
  loadPortfolioKpis: vi.fn(async () => ({})),
  loadProjectList: vi.fn(async () => ({ items: [], total: 0, page: 1, totalPages: 1 })),
  loadSCurve: vi.fn(async () => []),
  loadSpiCpiTrend: vi.fn(async () => []),
  loadStatusBreakdown: vi.fn(async () => []),
  loadTonnageByGroup: vi.fn(async () => []),
  loadTopPriority,
  loadWatchlist: vi.fn(async () => []),
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/dashboard/ProjectTable', () => ({ ProjectTable: () => null }));
vi.mock('@/components/dashboard/TopPriorityList', () => ({
  TopPriorityList: (props: Record<string, unknown>) => {
    topPriorityProps.push(props);
    return null;
  },
}));

(globalThis as unknown as { React: typeof React }).React = React;

import { TopPriorityCard } from '@/components/dashboard/OverviewWidgets';

const PERIOD_09 = { from: '2026-09-01', to: '2026-09-30' };
const PERIOD_11 = { from: '2026-11-01', to: '2026-11-30' };
const FILTERS = { status: 'all', teamKdId: 'all', customerId: 'all', priority: 'all', market: 'all', projectType: 'all' } as const;

describe('TopPriorityCard + maskProjectSummaries - QA doc lap N-3 Buoc 10', () => {
  it('S-2: admin (canViewFinance=true) cung chi nhan 6 truong can hien thi, khong co truong tien', async () => {
    topPriorityProps.length = 0;
    const el = await TopPriorityCard({ period: PERIOD_09, filters: FILTERS as never, canViewFinance: true });
    renderToStaticMarkup(el as React.ReactElement);
    const items = topPriorityProps[0].items as Array<Record<string, unknown>>;
    expect(Object.keys(items[0]).sort()).toEqual(['id', 'onTrack', 'pctActual', 'pctPlan', 'projectName', 'status']);
    expect(JSON.stringify(topPriorityProps[0])).not.toMatch(/999\.9|1200\.5|-55\.5/);
  });

  it('bien: goi dung loadTopPriority voi thang + filters truyen vao', async () => {
    topPriorityProps.length = 0;
    loadTopPriority.mockClear();
    await TopPriorityCard({ period: PERIOD_11, filters: FILTERS as never, canViewFinance: true });
    expect(loadTopPriority).toHaveBeenCalledWith(PERIOD_11, FILTERS);
  });

  it('PHAI THAT BAI NEU RO RI: viewer (canViewFinance=false) KHONG duoc thay contractValue/eac/vac, ke ca vac am', async () => {
    topPriorityProps.length = 0;
    const el = await TopPriorityCard({ period: PERIOD_09, filters: FILTERS as never, canViewFinance: false });
    renderToStaticMarkup(el as React.ReactElement);
    const items = topPriorityProps[0].items as Array<Record<string, unknown>>;
    expect(items[0]).not.toHaveProperty('contractValue');
    expect(items[0]).not.toHaveProperty('eac');
    expect(items[0]).not.toHaveProperty('vac');
    // Ro ri gian tiep qua JSON serialize cung phai bi chan.
    expect(JSON.stringify(topPriorityProps[0])).not.toMatch(/999\.9|1200\.5|-55\.5/);
  });
});
