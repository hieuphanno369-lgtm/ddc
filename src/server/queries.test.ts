import { describe, expect, it, vi } from 'vitest';

// getPortfolioKpis/getProjectSummaries đọc qua barrel '@/server/repo', mặc định trỏ prisma-repo
// (Postgres thật). Mock về mock-repo cho test nhanh, xác định, giống mọi test khác trong repo.
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { currentMonth } from '@/lib/clock';
import { previousPeriod, type Period } from '@/lib/period';
import { getPortfolioKpis, getProjectSummaries, getProjectSummary, type ProjectSummary } from '@/server/queries';

/**
 * P4: KPI tính theo KỲ (Period), delta = so với kỳ liền trước cùng độ dài (Q2 = a).
 * Test này dùng thẳng mock-repo qua barrel @/server/repo (đã seed 17 dự án, DDC_FAKE_TODAY = 2026-09-16)
 * và dựng "oracle" độc lập từ ProjectSummary công khai, không suy diễn từ cách getPortfolioKpis cài đặt.
 * Ca số liệu bằng tay (fixture riêng) nằm ở queries-period.test.ts.
 */

const period = (from: string, to: string): Period => ({ from, to });

// Công thức đếm của kpisForPeriod() (nội bộ, không export) tính lại từ ProjectSummary công khai.
function aggregate(summaries: ProjectSummary[]) {
  return {
    projectsInPeriod: summaries.length,
    inProgress: summaries.filter((s) => s.status === 'Dang_trien_khai').length,
    behindSchedule: summaries.filter((s) => s.status === 'Dang_trien_khai' && !s.onTrack).length,
    penaltyRisk: summaries.filter((s) => s.penalty === 'risk').length,
    penalized: summaries.filter((s) => s.penalty === 'penalized').length,
  };
}

const COUNT_KEYS = ['projectsInPeriod', 'inProgress', 'behindSchedule', 'penaltyRisk', 'penalized'] as const;

describe('getPortfolioKpis - đường chạy thuận lợi', () => {
  it('số đếm = oracle từ getProjectSummaries(kỳ); delta = KPI(kỳ) - KPI(kỳ liền trước cùng độ dài)', async () => {
    const cur = period('2026-08-01', '2026-09-16');
    const prev = previousPeriod(cur);
    const [kpis, curSummaries, prevSummaries] = await Promise.all([
      getPortfolioKpis(cur),
      getProjectSummaries(cur),
      getProjectSummaries(prev),
    ]);
    const curAgg = aggregate(curSummaries);
    const prevAgg = aggregate(prevSummaries);

    expect(COUNT_KEYS.map((k) => kpis[k])).toEqual(COUNT_KEYS.map((k) => curAgg[k]));
    expect(COUNT_KEYS.map((k) => kpis.delta[k])).toEqual(COUNT_KEYS.map((k) => curAgg[k] - prevAgg[k]));
    expect(kpis.asOfDate).toBe('2026-09-16');
    expect(kpis.months).toEqual(['2026-08', '2026-09']);
  });

  it('kỳ có mốc ở quá khứ: mốc = cuối kỳ (không phải hôm nay)', async () => {
    const kpis = await getPortfolioKpis(period('2026-06-01', '2026-06-30'));
    expect(kpis.asOfDate).toBe('2026-06-30');
  });
});

describe('getPortfolioKpis - không bịa delta khi thiếu số để so sánh', () => {
  it('kỳ trước nằm trước cửa sổ dữ liệu (không dòng fact nào <= mốc) -> mọi delta = null', async () => {
    const kpis = await getPortfolioKpis(period('2025-10-01', '2025-10-31')); // kỳ trước = 2025-09 (seed bắt đầu 2025-10)
    for (const v of Object.values(kpis.delta)) expect(v).toBeNull();
  });

  it('kỳ nằm hẳn trước cửa sổ dữ liệu: mọi dự án %TT = 0 (không throw/NaN) và delta = null', async () => {
    const early = period('2025-01-01', '2025-01-31');
    const summaries = await getProjectSummaries(early);
    for (const s of summaries) {
      expect(s.pctActual).toBe(0);
      expect(s.dataState.kind === 'none' || s.dataState.kind === 'completed').toBe(true);
    }
    const kpis = await getPortfolioKpis(early);
    for (const v of Object.values(kpis.delta)) expect(v).toBeNull();
  });

  it('kỳ tương lai: mốc bị kẹp ở hôm nay (không lấy số tháng sau mốc), delta là số hữu hạn', async () => {
    const kpis = await getPortfolioKpis(period('2026-10-01', '2026-10-31'));
    expect(kpis.asOfDate).toBe('2026-09-16');
    for (const v of Object.values(kpis.delta)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('getProjectSummary - trường hợp phải thất bại (không tìm thấy dự án)', () => {
  it('id không tồn tại trong seed -> trả undefined, KHÔNG throw', async () => {
    const NONEXISTENT_ID = 999_999;
    await expect(getProjectSummary(NONEXISTENT_ID, '2026-09')).resolves.toBeUndefined();
  });

  it('tháng rác/all không throw: rơi về tháng hiện tại', async () => {
    await expect(getProjectSummary(1, 'abc')).resolves.toBeDefined();
    await expect(getProjectSummary(1, 'all')).resolves.toBeDefined();
    const s = await getProjectSummary(1, currentMonth());
    expect(s?.id).toBe(1);
  });
});
