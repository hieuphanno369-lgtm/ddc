/**
 * Đọc và validate bộ lọc Tổng quan từ URL (dùng cho page Tổng quan và route export).
 * Mọi giá trị đi vào khoá `unstable_cache` (src/server/cache.ts) phải qua đây: giá trị rác không được
 * phình thêm khoá cache (bài học N-2). File thuần, client component (FilterBar) cũng import được.
 */

import type { DashboardFilters, GroupBy } from '@/server/queries';
import type { Market, Priority, ProjectType, Status } from '@/server/repo/types';

export const STATUSES: Status[] = ['Chuan_bi', 'Dang_trien_khai', 'Hoan_thanh', 'Tam_dung'];
export const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
export const MARKETS: Market[] = ['TN', 'XK', 'NoiBo'];
export const TYPES: ProjectType[] = [
  'EPC',
  'San_van_dong',
  'San_bay',
  'Nha_xuong',
  'Cau_cang',
  'Cao_tang',
  'Dong_tau',
  'Cau_giao_thong',
  'Khac',
];
const GROUP_BYS: GroupBy[] = ['team', 'type', 'market'];
export const GROUP_KEY_MAX_LENGTH = 100;

const POSITIVE_INT = /^[1-9]\d*$/;

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

function oneOf<T extends string>(v: string, allowed: readonly T[]): T | 'all' {
  return (allowed as readonly string[]).includes(v) ? (v as T) : 'all';
}

function positiveInt(v: string): number | 'all' {
  return POSITIVE_INT.test(v) ? Number(v) : 'all';
}

function isRealGroup(groupBy: GroupBy, key: string, teamNames?: readonly string[]): boolean {
  if (!key) return false;
  if (groupBy === 'type') return (TYPES as string[]).includes(key);
  if (groupBy === 'market') return (MARKETS as string[]).includes(key);
  // Dự án chưa gán team được queries gọi là '-'.
  return teamNames ? key === '-' || teamNames.includes(key) : true;
}

/**
 * `groupKey` chỉ giữ khi `groupBy` hợp lệ VÀ giá trị thuộc tập nhóm thật (T-1): type/market theo enum,
 * team theo `teamNames` (tên team lấy từ dims). Không thì bỏ, để `?groupKey=<rác>` không sinh thêm khoá cache.
 * Không truyền `teamNames` thì team chỉ bị chặn bởi điều kiện `groupBy` (chỉ dùng ở test).
 */
export function parseDashboardFilters(
  sp: Record<string, string | string[] | undefined>,
  teamNames?: readonly string[],
): DashboardFilters {
  const groupBy = (GROUP_BYS as string[]).includes(str(sp.groupBy)) ? (str(sp.groupBy) as GroupBy) : undefined;
  const rawKey = str(sp.groupKey).slice(0, GROUP_KEY_MAX_LENGTH);
  const groupKey = groupBy && isRealGroup(groupBy, rawKey, teamNames) ? rawKey : undefined;
  return {
    status: oneOf(str(sp.status), STATUSES),
    teamKdId: positiveInt(str(sp.team)),
    customerId: positiveInt(str(sp.customer)),
    priority: oneOf(str(sp.priority), PRIORITIES),
    market: oneOf(str(sp.market), MARKETS),
    projectType: oneOf(str(sp.type), TYPES),
    groupBy,
    groupKey,
  };
}
