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
import { todayIso } from '@/lib/clock';
import { periodAsOfMonth, periodKey, type Period } from '@/lib/period';

/**
 * Tag cache hẹp cho overview (plan §7b.13): revalidateTag thay vì revalidatePath toàn cục.
 * Chỉ cache phần shared, KHÔNG phụ thuộc user. Phần admin-only (banner P0, chưa nộp số liệu)
 * tính ngoài cache ở page để tránh lộ dữ liệu giữa các role.
 * `revalidate: 1800` (30 phút) là safety-net: data tự refresh nếu có mutation nào quên invalidate.
 *
 * P4: mọi loader nhận `Period` (đã validate bởi parsePeriod/parseDashboardFilters, không nhận giá trị thô).
 * Khoá cache = periodKey + filters. Một kỳ trải nhiều tháng nên mọi loader gắn `trendTag` (mọi lần ghi
 * số tháng/nhập Excel đều revalidateTag(trendTag)) + `profileTag` + `overviewTag(tháng mốc)`.
 */
export const overviewTag = (month: string) => `overview:${month}`;
export const trendTag = 'overview:trend';
export const listTag = (month: string) => `list:${month}`;
// Profile dim (tên/ngày cam kết BG) ảnh hưởng penalty/name ở MỌI tháng → tag riêng.
export const profileTag = 'ddc:profile';

const key = (...parts: unknown[]) => parts.map((p) => JSON.stringify(p)).join('|');
const TTL = 1800;

const tagsOf = (period: Period) => [trendTag, profileTag, overviewTag(periodAsOfMonth(period, todayIso()))];

export const loadPortfolioKpis = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getPortfolioKpis(period, filters), ['kpis', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadStatusBreakdown = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getStatusBreakdown(period, filters), ['status', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadTonnageByGroup = (period: Period, groupBy: GroupBy, filters: DashboardFilters) =>
  unstable_cache(async () => getTonnageValueByGroup(period, groupBy, filters), ['group', key(periodKey(period), groupBy, filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadCapacity = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getCapacityData(period, filters), ['cap', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadSpiCpiTrend = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getSpiCpiTrend(period, filters), ['trend', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadSCurve = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getPortfolioSCurve(period, filters), ['scurve', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadWatchlist = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getWatchlist(period, filters), ['watch', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadTopPriority = (period: Period, filters: DashboardFilters) =>
  unstable_cache(async () => getTopPriority(period, filters), ['top-p0', key(periodKey(period), filters)], {
    tags: tagsOf(period),
    revalidate: TTL,
  })();

export const loadProjectList = (params: ProjectListParams) =>
  unstable_cache(async () => listProjects(params), ['list', key(params)], {
    tags: [listTag(periodAsOfMonth(params.period, todayIso())), ...tagsOf(params.period)],
    revalidate: TTL,
  })();
