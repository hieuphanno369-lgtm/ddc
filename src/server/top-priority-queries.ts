import { selectTopPriority } from '@/lib/top-priority';
import type { Period } from '@/lib/period';
import { getProjectSummaries, type DashboardFilters, type ProjectSummary } from './queries';

/** T2 "Top dự án trọng điểm": dự án P0 đang triển khai, lọc theo FilterBar giống thẻ cũ. */
export async function getTopPriority(period: Period, filters: DashboardFilters = {}): Promise<ProjectSummary[]> {
  return selectTopPriority(await getProjectSummaries(period, filters));
}
