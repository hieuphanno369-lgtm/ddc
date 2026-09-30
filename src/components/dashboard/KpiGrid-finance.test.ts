import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * P4 tester - KpiGrid (2 nhóm KPI) với người KHÔNG được xem tiền: không được có thẻ "HĐ chưa khởi công" và
 * "Doanh thu trong kỳ", và số tiền không được rò vào HTML (kể cả số dạng định dạng lẫn số thô).
 * Render THẬT KpiGrid với dữ liệu KPI có tiền lớn dễ nhận diện (3.722,7 tỷ -> 3722.7, HĐ chưa khởi công 5.555).
 */
const KPIS = {
  projectsInPeriod: 17, inProgress: 15, behindSchedule: 11, penaltyRisk: 6, penalized: 3,
  notStartedValue: 5555.5, revenueInPeriod: 3722.7, tonnageInPeriod: 99004,
  delta: { projectsInPeriod: null, inProgress: 1, behindSchedule: -2, penaltyRisk: 0, penalized: null, notStartedValue: 10, revenueInPeriod: 5, tonnageInPeriod: null },
  asOfDate: '2026-09-16', months: ['2025-10', '2026-09'],
};

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/server/cache', () => ({
  loadCapacity: vi.fn(), loadPortfolioKpis: vi.fn(async () => KPIS), loadProjectList: vi.fn(), loadSCurve: vi.fn(),
  loadSpiCpiTrend: vi.fn(), loadStatusBreakdown: vi.fn(), loadTonnageByGroup: vi.fn(), loadTopPriority: vi.fn(),
  loadWatchlist: vi.fn(), loadProjectCounts: vi.fn(),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

(globalThis as unknown as { React: typeof React }).React = React;

import { KpiGrid } from './OverviewWidgets';

const PERIOD = { from: '2025-10-01', to: '2026-09-16' };
const FILTERS = { status: 'all', teamKdId: 'all', customerId: 'all', priority: 'all', market: 'all', projectType: 'all' } as const;
const html = async (canViewFinance: boolean) =>
  renderToStaticMarkup((await KpiGrid({ period: PERIOD, filters: FILTERS, canViewFinance })) as React.ReactElement);

describe('KpiGrid: che tiền theo canViewFinance', () => {
  it('admin: có thẻ HĐ chưa khởi công và Doanh thu trong kỳ (đường chạy thuận lợi)', async () => {
    const out = await html(true);
    expect(out).toContain('kpi.backlog');
    expect(out).toContain('kpiGroup.revenue');
    expect(out).toContain('kpiGroup.tonnage');
  });

  it('viewer: không có thẻ HĐ chưa khởi công, không có Doanh thu trong kỳ', async () => {
    const out = await html(false);
    expect(out).not.toContain('kpi.backlog');
    expect(out).not.toContain('kpiGroup.revenue');
  });

  it('viewer: số tiền không rò vào HTML (5.555, 3.722, 5555, 3722) nhưng sản lượng (tấn, không phải tiền) vẫn hiện', async () => {
    const out = await html(false);
    expect(out).not.toMatch(/5\.?555|3\.?722/);
    expect(out).toContain('kpiGroup.tonnage');
    expect(out).toMatch(/99\.004|99,004|99004/);
  });

  it('viewer: 5 thẻ nhóm 1 dùng lớp k5 (lưới 5 cột), admin không', async () => {
    expect(await html(false)).toContain('kpis k5');
    expect(await html(true)).not.toContain('kpis k5');
  });

  it('cả hai vai: 5 thẻ số liệu không phải tiền luôn có (Dự án trong kỳ, Đang triển khai, Chậm, Nguy cơ phạt, Đã phạt)', async () => {
    for (const v of [true, false]) {
      const out = await html(v);
      for (const k of ['kpi.totalProjects', 'kpi.inProgress', 'kpi.behindSchedule', 'kpi.penaltyRisk', 'kpi.penalized']) expect(out).toContain(k);
    }
  });
});
