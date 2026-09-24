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
    totalProjects: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, backlog: 0,
    delta: { totalProjects: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, backlog: 0 },
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
import { getProjectSummaries, getSpiCpiTrend, getTonnageValueByGroup } from './queries';
import { getReportData } from './report';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;
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
    await getProjectSummaries('2026-09', { groupBy: 'team', groupKey: 'KD1' });
    expect(getLatestFact).not.toHaveBeenCalled();
    expect(getDims).toHaveBeenCalledTimes(1);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('getTonnageValueByGroup: goi getProject 0 lan', async () => {
    const getProject = vi.spyOn(repo, 'getProject');
    await getTonnageValueByGroup('2026-09', 'team');
    expect(getProject).not.toHaveBeenCalled();
  });

  it('getSpiCpiTrend({}): goi getFactsForMonth 0 lan va readMonthlyEvm 1 lan', async () => {
    const getFactsForMonth = vi.spyOn(repo, 'getFactsForMonth');
    const readMonthlyEvm = vi.spyOn(repo, 'readMonthlyEvm');
    await getSpiCpiTrend({});
    expect(getFactsForMonth).not.toHaveBeenCalled();
    expect(readMonthlyEvm).toHaveBeenCalledTimes(1);
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
      (await ProjectDetailPage({ params: { id: '1', locale: 'vi' }, searchParams: {} })) as React.ReactElement,
    );
    expect(getAuditLog).not.toHaveBeenCalled();
  });
});
