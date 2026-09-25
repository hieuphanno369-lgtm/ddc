import { unstable_cache } from 'next/cache';
import {
  getCapacityData,
  getPortfolioKpis,
  getPortfolioSCurve,
  getSpiCpiTrend,
  getStatusBreakdown,
  getTonnageValueByGroup,
  getWatchlist,
  listProjects,
  type DashboardFilters,
  type GroupBy,
  type ProjectListParams,
} from './queries';
import { getTopPriority } from './top-priority-queries';

/**
 * Tag cache hẹp cho overview (plan §7b.13): revalidateTag thay vì revalidatePath toàn cục.
 * Chỉ cache phần shared, KHÔNG phụ thuộc user. Phần admin-only (banner P0, chưa nộp số liệu)
 * tính ngoài cache ở page để tránh lộ dữ liệu giữa các role.
 * `revalidate: 1800` (30 phút) là safety-net: data tự refresh nếu có mutation nào quên invalidate.
 */
export const overviewTag = (month: string) => `overview:${month}`;
export const trendTag = 'overview:trend';
export const listTag = (month: string) => `list:${month}`;
// Profile dim (tên/ngày cam kết BG) ảnh hưởng penalty/name ở MỌI tháng → tag riêng.
export const profileTag = 'ddc:profile';

const key = (...parts: unknown[]) => parts.map((p) => JSON.stringify(p)).join('|');
const TTL = 1800;

export const loadPortfolioKpis = (month: string, filters: DashboardFilters) =>
  unstable_cache(async () => getPortfolioKpis(month, filters), ['kpis', key(month, filters)], {
    tags: [overviewTag(month), profileTag],
    revalidate: TTL,
  })();

export const loadStatusBreakdown = (month: string, filters: DashboardFilters) =>
  unstable_cache(async () => getStatusBreakdown(month, filters), ['status', key(month, filters)], {
    tags: [overviewTag(month)],
    revalidate: TTL,
  })();

export const loadTonnageByGroup = (month: string, groupBy: GroupBy, filters: DashboardFilters) =>
  unstable_cache(async () => getTonnageValueByGroup(month, groupBy, filters), ['group', key(month, groupBy, filters)], {
    tags: [overviewTag(month), profileTag],
    revalidate: TTL,
  })();

export const loadCapacity = (month: string, filters: DashboardFilters) =>
  unstable_cache(async () => getCapacityData(month, filters), ['cap', key(month, filters)], {
    tags: [overviewTag(month)],
    revalidate: TTL,
  })();

export const loadSpiCpiTrend = (filters: DashboardFilters) =>
  unstable_cache(async () => getSpiCpiTrend(filters), ['trend', key(filters)], {
    tags: [trendTag],
    revalidate: TTL,
  })();

export const loadSCurve = (filters: DashboardFilters) =>
  unstable_cache(async () => getPortfolioSCurve(filters), ['scurve', key(filters)], {
    tags: [trendTag],
    revalidate: TTL,
  })();

export const loadWatchlist = (month: string, filters: DashboardFilters) =>
  unstable_cache(async () => getWatchlist(month, filters), ['watch', key(month, filters)], {
    tags: [overviewTag(month), profileTag],
    revalidate: TTL,
  })();

export const loadTopPriority = (month: string, filters: DashboardFilters) =>
  unstable_cache(async () => getTopPriority(month, filters), ['top-p0', key(month, filters)], {
    tags: [overviewTag(month), profileTag],
    revalidate: TTL,
  })();

export const loadProjectList = (params: ProjectListParams) =>
  unstable_cache(async () => listProjects(params), ['list', key(params)], {
    tags: [listTag(params.month ?? ''), profileTag],
    revalidate: TTL,
  })();
