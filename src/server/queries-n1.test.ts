import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/server/cache', () => ({
  loadPortfolioKpis: vi.fn(async () => ({
    projectsInPeriod: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, notStartedValue: 0,
    revenueInPeriod: 0, tonnageInPeriod: 0, asOfDate: '2026-09-16', months: ['2026-09'],
    delta: {
      projectsInPeriod: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, notStartedValue: 0,
      revenueInPeriod: 0, tonnageInPeriod: 0,
    },
  })),
  loadWatchlist: vi.fn(async () => []),
}));
// Boilerplate render trang Chi tiết - giống projects-detail-page-render.test.ts.
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
vi.mock('@/components/ui/Badges', () => ({
  MarketLabel: () => null,
  PriorityBadge: () => null,
  StatusBadge: (p: { status: string }) => React.createElement('span', null, `status:${p.status}`),
  TypeLabel: () => null,
}));
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => null }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo';
import { getPortfolioKpis, getProjectSummaries, getSpiCpiTrend, getTonnageValueByGroup } from './queries';
import { getReportData } from './report';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;
const PERIOD = { from: '2026-09-01', to: '2026-09-30' };
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

/**
 * T1 (T1-code a): sau khi bỏ N+1 ở queries.ts, các hàm đọc-nhiều-dự-án chỉ được gọi repo theo
 * BATCH (1-2 lần cố định), không theo số dự án. Test này canh KHÔNG lùi về N+1.
 */
describe('queries N+1 (T1 Bước 5)', () => {
  it('getProjectSummaries: goi getLatestFact 0 lan, getDims 1 lan, getProject 0 lan (ca khi co filters.groupKey)', async () => {
    const getLatestFact = vi.spyOn(repo, 'getLatestFact');
    const getDims = vi.spyOn(repo, 'getDims');
    const getProject = vi.spyOn(repo, 'getProject');
    const readFactSnapshotsAsOf = vi.spyOn(repo, 'readFactSnapshotsAsOf');
    await getProjectSummaries(PERIOD, { groupBy: 'team', groupKey: 'KD1' });
    expect(getLatestFact).not.toHaveBeenCalled();
    expect(readFactSnapshotsAsOf).toHaveBeenCalledTimes(1);
    expect(getDims).toHaveBeenCalledTimes(1);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('getTonnageValueByGroup: goi getProject 0 lan', async () => {
    const getProject = vi.spyOn(repo, 'getProject');
    await getTonnageValueByGroup(PERIOD, 'team');
    expect(getProject).not.toHaveBeenCalled();
  });

  it('getSpiCpiTrend: goi getFactsForMonth/getFacts 0 lan va readFactSeries 1 lan (khong theo so du an, khong theo so thang)', async () => {
    const getFactsForMonth = vi.spyOn(repo, 'getFactsForMonth');
    const getFacts = vi.spyOn(repo, 'getFacts');
    const readFactSeries = vi.spyOn(repo, 'readFactSeries');
    await getSpiCpiTrend({ from: '2025-10-01', to: '2026-09-16' }, {});
    expect(getFactsForMonth).not.toHaveBeenCalled();
    expect(getFacts).not.toHaveBeenCalled();
    expect(readFactSeries).toHaveBeenCalledTimes(1);
  });

  it('getPortfolioKpis: doc theo BATCH, khong goi getProject/getFacts/getLatestFact theo tung du an', async () => {
    const getProject = vi.spyOn(repo, 'getProject');
    const getFacts = vi.spyOn(repo, 'getFacts');
    const getLatestFact = vi.spyOn(repo, 'getLatestFact');
    const readFactSnapshotsAsOf = vi.spyOn(repo, 'readFactSnapshotsAsOf');
    await getPortfolioKpis(PERIOD, {});
    expect(getProject).not.toHaveBeenCalled();
    expect(getFacts).not.toHaveBeenCalled();
    expect(getLatestFact).not.toHaveBeenCalled();
    // 2 lan co dinh: ky dang xem + ky lien truoc (so sanh delta), khong doi theo so du an
    expect(readFactSnapshotsAsOf).toHaveBeenCalledTimes(2);
  });

  it('getReportData: goi getLatestFact 0 lan', async () => {
    const getLatestFact = vi.spyOn(repo, 'getLatestFact');
    await getReportData('2026-09');
    expect(getLatestFact).not.toHaveBeenCalled();
  });

  it('render trang Chi tiet: goi repo.getAuditLog 0 lan (dung readLastAuditAt thay the)', async () => {
    const getAuditLog = vi.spyOn(repo, 'getAuditLog');
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(ADMIN);
    await renderToStaticMarkup(
      (await ProjectDetailPage({ params: Promise.resolve({ id: '1', locale: 'vi' }), searchParams: Promise.resolve({}) })) as React.ReactElement,
    );
    expect(getAuditLog).not.toHaveBeenCalled();
  });
});
