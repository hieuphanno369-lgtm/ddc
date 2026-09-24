import { repo } from '@/server/repo';
import { isValidYearMonth, prevMonth } from '@/lib/clock';
import { getScopedProjectIds, type DashboardFilters } from '@/server/queries';

export interface Scorecard {
  value: number;
  delta: number | null;
}

/**
 * Công nợ quá hạn tháng `month` trong phạm vi filter cấp dự án (getScopedProjectIds - KHÔNG lọc
 * status, giống card cũ). delta = cur - prev (làm tròn 0,1); null khi month='all'/sai format hoặc
 * tháng này/tháng trước chưa có dòng tài chính nào (không bịa delta).
 */
export async function getOverdueScorecard(month: string, filters: DashboardFilters): Promise<Scorecard> {
  const ids = await getScopedProjectIds(filters);
  const cur = await repo.getFinancialForMonth(month);
  const value = cur.filter((f) => ids.has(f.projectId)).reduce((sum, f) => sum + f.arOverdue, 0);

  if (month === 'all' || !isValidYearMonth(month)) {
    return { value, delta: null };
  }
  const prev = await repo.getFinancialForMonth(prevMonth(month));
  if (cur.length === 0 || prev.length === 0) {
    return { value, delta: null };
  }
  const prevValue = prev.filter((f) => ids.has(f.projectId)).reduce((sum, f) => sum + f.arOverdue, 0);
  return { value, delta: Math.round((value - prevValue) * 10) / 10 };
}
