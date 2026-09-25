import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * N-3 (Task 1): GroupBarCard/WatchlistCard/ProjectListCard phải che số tiền và ép sort khi
 * canViewFinance=false - render tĩnh 3 widget của Tổng quan, khẳng định props/HTML thật.
 */
const SUMMARY = {
  id: 1,
  masterCode: 'M001',
  currentAliasCode: 'A001',
  projectName: 'Du an X',
  customerId: 1,
  customerName: 'KH X',
  teamName: 'KD1',
  teamKdId: 1,
  projectType: 'EPC',
  marketCode: 'TN',
  priority: 'P0',
  status: 'Dang_trien_khai',
  onTrack: true,
  penalty: 'risk',
  contractValue: 123.4,
  tonnage: 900,
  pctPlan: 50,
  pctActual: 48,
  spi: 0.96,
  cpi: 0.94,
  eac: 150,
  vac: -26.6,
  bottleneckStage: null,
};

const {
  dynProps,
  projectTableProps,
  watchlistProps,
  loadTonnageByGroup,
  loadProjectList,
  loadWatchlist,
} = vi.hoisted(() => ({
  dynProps: [] as Record<string, unknown>[],
  projectTableProps: [] as Record<string, unknown>[],
  watchlistProps: [] as Record<string, unknown>[],
  loadTonnageByGroup: vi.fn(async () => [{ key: 'KD1', tonnage: 900, value: 55.5 }]),
  loadProjectList: vi.fn(async () => ({ items: [SUMMARY], total: 1, page: 1, totalPages: 1 })),
  loadWatchlist: vi.fn(async () => [SUMMARY]),
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock('@/server/cache', () => ({
  loadCapacity: vi.fn(async () => []),
  loadPortfolioKpis: vi.fn(async () => ({})),
  loadProjectList,
  loadSCurve: vi.fn(async () => []),
  loadSpiCpiTrend: vi.fn(async () => []),
  loadStatusBreakdown: vi.fn(async () => []),
  loadTonnageByGroup,
  loadWatchlist,
}));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    dynProps.push(props);
    return null;
  },
}));

vi.mock('@/components/dashboard/ProjectTable', () => ({
  ProjectTable: (props: Record<string, unknown>) => {
    projectTableProps.push(props);
    return null;
  },
}));

vi.mock('@/components/dashboard/Watchlist', () => ({
  Watchlist: (props: Record<string, unknown>) => {
    watchlistProps.push(props);
    return null;
  },
}));

(globalThis as unknown as { React: typeof React }).React = React;

import { GroupBarCard, ProjectListCard, WatchlistCard } from '@/components/dashboard/OverviewWidgets';

const FILTERS = { status: 'all', teamKdId: 'all', customerId: 'all', priority: 'all', market: 'all', projectType: 'all' } as const;

describe('N-3 Tổng quan - GroupBarCard/ProjectListCard/WatchlistCard che tien khi khong quyen', () => {
  it('viewer (canViewFinance=false): showValue=false, value=null, sort ep priority, khong lo contractValue', async () => {
    dynProps.length = 0;
    projectTableProps.length = 0;
    watchlistProps.length = 0;

    const groupEl = await GroupBarCard({ month: '2026-09', groupBy: 'team', filters: FILTERS as never, canViewFinance: false });
    renderToStaticMarkup(groupEl as React.ReactElement);
    expect(dynProps[0].showValue).toBe(false);
    expect((dynProps[0].data as Array<{ value: number | null }>).every((d) => d.value === null)).toBe(true);

    const listEl = await ProjectListCard({
      month: '2026-09',
      filters: FILTERS as never,
      search: '',
      sort: 'value',
      page: 1,
      canViewFinance: false,
    });
    renderToStaticMarkup(listEl as React.ReactElement);
    expect(projectTableProps[0].canViewFinance).toBe(false);
    const items = projectTableProps[0].items as Array<{ contractValue: unknown; eac: unknown; vac: unknown }>;
    expect(items[0].contractValue).toBeNull();
    expect(items[0].eac).toBeNull();
    expect(items[0].vac).toBeNull();
    expect(JSON.stringify(projectTableProps[0])).not.toMatch(/"contractValue":\d/);
    expect(loadProjectList).toHaveBeenCalledWith(expect.objectContaining({ sort: 'priority' }));

    const watchEl = await WatchlistCard({ month: '2026-09', filters: FILTERS as never, canViewFinance: false });
    renderToStaticMarkup(watchEl as React.ReactElement);
    const wItems = watchlistProps[0].items as Array<{ contractValue: unknown }>;
    expect(wItems[0].contractValue).toBeNull();
  });

  it('admin (canViewFinance=true): showValue=true, value giu nguyen, sort value giu nguyen', async () => {
    dynProps.length = 0;
    projectTableProps.length = 0;
    loadProjectList.mockClear();

    const groupEl = await GroupBarCard({ month: '2026-09', groupBy: 'team', filters: FILTERS as never, canViewFinance: true });
    renderToStaticMarkup(groupEl as React.ReactElement);
    expect(dynProps[0].showValue).toBe(true);
    expect((dynProps[0].data as Array<{ value: number | null }>)[0].value).toBe(55.5);

    const listEl = await ProjectListCard({
      month: '2026-09',
      filters: FILTERS as never,
      search: '',
      sort: 'value',
      page: 1,
      canViewFinance: true,
    });
    renderToStaticMarkup(listEl as React.ReactElement);
    const items = projectTableProps[0].items as Array<{ contractValue: unknown }>;
    expect(items[0].contractValue).toBe(123.4);
    expect(loadProjectList).toHaveBeenCalledWith(expect.objectContaining({ sort: 'value' }));
  });
});
