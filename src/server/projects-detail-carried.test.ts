import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

/**
 * P4 (chốt chủ dự án): trang Chi tiết cũng vẽ NÉT ĐỨT cho tháng mang số sang trên S-curve và SPI/CPI, giống Tổng quan (D-10).
 * Trang truyền `carriedProjects` (1 = tháng đó dùng số tháng trước, 0 = số thật) cho `carriedRuns` của chart.
 */

const chartProps: { scurve: { data: { month: string; carriedProjects?: number }[]; single?: boolean }[]; spi: { data: { month: string; carriedProjects?: number }[]; single?: boolean }[] } = { scurve: [], spi: [] };

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
vi.mock('@/components/ui/Badges', () => ({
  MarketLabel: () => null,
  PriorityBadge: () => null,
  StatusBadge: () => null,
  TypeLabel: () => null,
}));
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => null }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));
vi.mock('@/components/project/DetailTimeBar', () => ({ DetailTimeBar: () => null }));
vi.mock('@/components/project/ResourceDayNav', () => ({ ResourceDayNav: () => null }));
vi.mock('@/components/project/ProjectDetailChartsLazy', () => {
  const none = () => null;
  return {
    CountdownPanel: none,
    EquipmentPlanGantt: none,
    KeyMilestoneChart: none,
    ManpowerMonthChart: none,
    ResourceBreakdownChart: none,
    StageExplorer: none,
    WeeklyManpowerStackChart: none,
    WeeklyTrackingCard: none,
    SCurve: (p: (typeof chartProps.scurve)[number]) => {
      chartProps.scurve.push(p);
      return null;
    },
    SpiCpiLine: (p: (typeof chartProps.spi)[number]) => {
      chartProps.spi.push(p);
      return null;
    },
  };
});

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

async function render(searchParams: Record<string, string> = {}) {
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
  return renderToStaticMarkup(
    (await ProjectDetailPage({ params: Promise.resolve({ id: '1', locale: 'vi' }), searchParams: Promise.resolve(searchParams) })) as React.ReactElement,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  chartProps.scurve.length = 0;
  chartProps.spi.length = 0;
});

describe('Chi tiết: tháng mang số sang vẽ nét đứt (D-10)', () => {
  it('thiếu số tháng 2026-03: tháng đó có carriedProjects = 1, các tháng có số thật = 0, chart báo `single`', async () => {
    const all = await repo.getFacts(1);
    vi.spyOn(repo, 'getFacts').mockResolvedValue(all.filter((f) => f.yearMonth !== '2026-03'));

    await render({ from: '2026-01-01', to: '2026-05-31', month: '2026-05' });

    const s = chartProps.scurve.at(-1)!;
    const byMonth = Object.fromEntries(s.data.map((d) => [d.month, d.carriedProjects]));
    expect(byMonth['2026-03']).toBe(1);
    expect(byMonth['2026-02']).toBe(0);
    expect(byMonth['2026-04']).toBe(0);
    expect(s.single).toBe(true);
    const spi = chartProps.spi.at(-1)!;
    expect(spi.data.find((d) => d.month === '2026-03')?.carriedProjects).toBe(1);
    expect(spi.single).toBe(true);
  });

  it('đủ số mọi tháng: không tháng nào mang số (toàn nét liền)', async () => {
    await render({ from: '2026-01-01', to: '2026-05-31', month: '2026-05' });
    const s = chartProps.scurve.at(-1)!;
    expect(s.data.length).toBeGreaterThan(0);
    expect(s.data.every((d) => d.carriedProjects === 0)).toBe(true);
  });
});
