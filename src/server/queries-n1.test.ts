import { describe, expect, it, vi } from 'vitest';

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

import { repo } from '@/server/repo';
import { getProjectSummaries, getSpiCpiTrend, getTonnageValueByGroup } from './queries';
import { getReportData } from './report';

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
});
