import { repo } from '@/server/repo';
import { todayIso } from '@/lib/clock';
import { periodAsOfMonth, previousPeriod, type Period } from '@/lib/period';
import { getProjectSummaries, type DashboardFilters } from '@/server/queries';

export interface Scorecard {
  value: number;
  delta: number | null;
}

/**
 * Công nợ quá hạn TẠI mốc cuối kỳ (số tồn: dòng tài chính gần nhất <= tháng mốc) của các dự án thuộc kỳ
 * và qua mọi filter (F-1: dùng cùng tập id với KPI, kể cả status). delta = so với cuối kỳ liền trước cùng
 * độ dài (làm tròn 0,1); null khi kỳ này/kỳ trước chưa có dòng tài chính nào (không bịa delta).
 */
export async function getOverdueScorecard(period: Period, filters: DashboardFilters): Promise<Scorecard> {
  const today = todayIso();
  const prevPeriod = previousPeriod(period);
  const [ids, prevIds, cur, prev] = await Promise.all([
    getProjectSummaries(period, filters).then((rows) => new Set(rows.map((s) => s.id))),
    getProjectSummaries(prevPeriod, filters).then((rows) => new Set(rows.map((s) => s.id))),
    repo.readFinancialAsOf(periodAsOfMonth(period, today)),
    repo.readFinancialAsOf(periodAsOfMonth(prevPeriod, today)),
  ]);
  const value = cur.filter((f) => ids.has(f.projectId)).reduce((sum, f) => sum + f.arOverdue, 0);
  if (cur.length === 0 || prev.length === 0) {
    return { value, delta: null };
  }
  const prevValue = prev.filter((f) => prevIds.has(f.projectId)).reduce((sum, f) => sum + f.arOverdue, 0);
  return { value, delta: Math.round((value - prevValue) * 10) / 10 + 0 };
}
