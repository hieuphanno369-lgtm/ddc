import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';

/**
 * P4 NIT (sau N-3): dòng "Cách đọc" của thẻ công suất chỉ được ghi khoảng tháng TỚI THÁNG MỐC (tháng sau hôm nay
 * không có sản lượng và không được tính công suất), không ghi cả khoảng tháng của kỳ.
 * Đồng hồ ghim DDC_FAKE_TODAY = 2026-09-16 (vitest.config.ts).
 */
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key)),
}));
vi.mock('@/server/cache', () => ({
  loadCapacity: vi.fn(async () => []),
  loadPortfolioKpis: vi.fn(),
  loadProjectCounts: vi.fn(),
  loadProjectList: vi.fn(),
  loadSCurve: vi.fn(),
  loadSpiCpiTrend: vi.fn(),
  loadStatusBreakdown: vi.fn(),
  loadTonnageByGroup: vi.fn(),
  loadTopPriority: vi.fn(),
}));
vi.mock('@/server/overdue-scorecard', () => ({ getOverdueScorecard: vi.fn() }));

(globalThis as unknown as { React: typeof React }).React = React;

import { CapacityCard } from './OverviewWidgets';

/** Gom mọi prop `text` (chuỗi) trong cây element, không render. */
function texts(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) texts(n, out);
  } else if (React.isValidElement(node)) {
    const props = node.props as { text?: unknown; children?: unknown };
    if (typeof props.text === 'string') out.push(props.text);
    texts(props.children, out);
  }
  return out;
}

describe('CapacityCard: dòng "Cách đọc" theo tháng mốc (N-3)', () => {
  it('kỳ kéo sang tháng tương lai (07/2026 - 12/2026): chỉ ghi tới tháng mốc 09/2026', async () => {
    const tree = await CapacityCard({ period: { from: '2026-07-01', to: '2026-12-31' }, filters: {} });
    const howTo = texts(tree).find((x) => x.includes('chartHowTo.capacity'));
    expect(howTo).toBeDefined();
    expect(howTo).toContain('"m1":"07/2026"');
    expect(howTo).toContain('"m2":"09/2026"');
    expect(howTo).not.toContain('12/2026');
  });

  it('kỳ kết thúc trước hôm nay: ghi đủ tới cuối kỳ', async () => {
    const tree = await CapacityCard({ period: { from: '2026-03-01', to: '2026-05-31' }, filters: {} });
    const howTo = texts(tree).find((x) => x.includes('chartHowTo.capacity'))!;
    expect(howTo).toContain('"m1":"03/2026"');
    expect(howTo).toContain('"m2":"05/2026"');
  });

  it('kỳ bắt đầu sau hôm nay (chưa có tháng nào tới mốc): không ghi khoảng tháng và không lỗi', async () => {
    const tree = await CapacityCard({ period: { from: '2026-11-01', to: '2026-12-31' }, filters: {} });
    const howTo = texts(tree).find((x) => x.includes('chartHowTo.capacity'))!;
    expect(howTo).toBe('chartHowTo.capacity');
  });
});
