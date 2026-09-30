import { unstable_cache } from 'next/cache';
import { cache as reactCache } from 'react';
import {
  getCapacityData,
  getPortfolioKpis,
  getPortfolioSCurve,
  getProjectCounts,
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
import { isCacheablePeriod, periodAsOfMonth, periodKey, type Period } from '@/lib/period';

/**
 * Tag cache hẹp cho overview (plan §7b.13): revalidateTag thay vì revalidatePath toàn cục.
 * Chỉ cache phần shared, KHÔNG phụ thuộc user. Phần admin-only (banner P0, chưa nộp số liệu)
 * tính ngoài cache ở page để tránh lộ dữ liệu giữa các role.
 * `revalidate: 1800` (30 phút) là safety-net: data tự refresh nếu có mutation nào quên invalidate.
 *
 * P4: mọi loader nhận `Period` (đã validate bởi parsePeriod/parseDashboardFilters, không nhận giá trị thô).
 * Khoá cache = periodKey + filters. Một kỳ trải nhiều tháng nên mọi loader gắn `trendTag` (mọi lần ghi
 * số tháng/nhập Excel đều revalidateTag(trendTag)) + `profileTag` + `overviewTag(tháng mốc)`.
 *
 * S-1 (danh-gia-bao-mat.md): from/to hợp lệ gần như vô hạn (mỗi cặp ngày là một khoá, ghi xuống đĩa `.next/cache`), nên chỉ
 * kỳ mặc định và kỳ tròn tháng gần đây (`isCacheablePeriod`) mới đi qua `unstable_cache`. Kỳ tuỳ ý chỉ dùng React `cache`
 * theo request (memo theo tham chiếu đối số, không ghi đĩa): vẫn không tính lại nhiều lần trong 1 lần render.
 */
export const overviewTag = (month: string) => `overview:${month}`;
export const trendTag = 'overview:trend';
export const listTag = (month: string) => `list:${month}`;
// Profile dim (tên/ngày cam kết BG) ảnh hưởng penalty/name ở MỌI tháng → tag riêng.
export const profileTag = 'ddc:profile';

const key = (...parts: unknown[]) => parts.map((p) => JSON.stringify(p)).join('|');
const TTL = 1800;

const tagsOf = (period: Period) => [trendTag, profileTag, overviewTag(periodAsOfMonth(period, todayIso()))];

/**
 * Loader theo kỳ: kỳ cacheable (và `canPersist`) thì `unstable_cache` với khoá `[name, key(...keyParts)]`,
 * còn lại chỉ React `cache` theo request. `run` phải là hàm gốc ổn định (memo theo tham chiếu đối số).
 */
function periodLoader<A extends unknown[], R>(
  name: string,
  run: (...args: A) => Promise<R>,
  periodOf: (...args: A) => Period,
  keyPartsOf: (...args: A) => unknown[],
  opts: { extraTags?: (...args: A) => string[]; canPersist?: (...args: A) => boolean } = {},
): (...args: A) => Promise<R> {
  const perRequest = reactCache(run);
  return (...args) => {
    const period = periodOf(...args);
    if (!isCacheablePeriod(period, todayIso()) || opts.canPersist?.(...args) === false) return perRequest(...args);
    return unstable_cache(async () => run(...args), [name, key(...keyPartsOf(...args))], {
      tags: [...(opts.extraTags?.(...args) ?? []), ...tagsOf(period)],
      revalidate: TTL,
    })();
  };
}

const byFilters = (period: Period, filters: DashboardFilters) => [periodKey(period), filters];

export const loadPortfolioKpis = periodLoader('kpis', getPortfolioKpis, (p) => p, byFilters);
export const loadProjectCounts = periodLoader('counts', getProjectCounts, (p) => p, byFilters);
export const loadStatusBreakdown = periodLoader('status', getStatusBreakdown, (p) => p, byFilters);
export const loadTonnageByGroup = periodLoader(
  'group',
  (period: Period, groupBy: GroupBy, filters: DashboardFilters) => getTonnageValueByGroup(period, groupBy, filters),
  (p) => p,
  (period, groupBy, filters) => [periodKey(period), groupBy, filters],
);
export const loadCapacity = periodLoader('cap', getCapacityData, (p) => p, byFilters);
export const loadSpiCpiTrend = periodLoader('trend', getSpiCpiTrend, (p) => p, byFilters);
export const loadSCurve = periodLoader('scurve', getPortfolioSCurve, (p) => p, byFilters);
export const loadWatchlist = periodLoader('watch', getWatchlist, (p) => p, byFilters);
export const loadTopPriority = periodLoader('top-p0', getTopPriority, (p) => p, byFilters);

// Ô tìm kiếm là chuỗi tự do: có chuỗi tìm thì cũng không ghi đĩa (mỗi chuỗi một khoá).
export const loadProjectList = periodLoader(
  'list',
  listProjects,
  (params: ProjectListParams) => params.period,
  (params) => [params],
  {
    extraTags: (params) => [listTag(periodAsOfMonth(params.period, todayIso()))],
    canPersist: (params) => !params.search,
  },
);
