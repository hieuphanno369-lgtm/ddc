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

/** Phần dims mà bộ lọc cần để đối chiếu id/tên thật (tách khỏi kiểu server để file này dùng được ở client). */
export interface FilterDims {
  teams: readonly { id: number; name: string }[];
  customers: readonly { id: number }[];
}

/** Id (team, khách hàng) phải có thật trong dims; không truyền dims thì chỉ kiểm dạng số (chỉ dùng ở test). */
function knownId(v: string, ids?: readonly number[]): number | 'all' {
  const n = positiveInt(v);
  return n === 'all' || !ids || ids.includes(n) ? n : 'all';
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
 * team theo tên team trong dims. Không thì bỏ, để `?groupKey=<rác>` không sinh thêm khoá cache.
 * `team`/`customer` cũng phải là id có thật trong dims (S-1), id lạ về 'all'.
 * Không truyền `dims` thì chỉ kiểm dạng (chỉ dùng ở test).
 */
export function parseDashboardFilters(
  sp: Record<string, string | string[] | undefined>,
  dims?: FilterDims,
): DashboardFilters {
  const teamNames = dims?.teams.map((t) => t.name);
  const groupBy = (GROUP_BYS as string[]).includes(str(sp.groupBy)) ? (str(sp.groupBy) as GroupBy) : undefined;
  const rawKey = str(sp.groupKey).slice(0, GROUP_KEY_MAX_LENGTH);
  const groupKey = groupBy && isRealGroup(groupBy, rawKey, teamNames) ? rawKey : undefined;
  return {
    status: oneOf(str(sp.status), STATUSES),
    teamKdId: knownId(str(sp.team), dims?.teams.map((t) => t.id)),
    customerId: knownId(str(sp.customer), dims?.customers.map((c) => c.id)),
    priority: oneOf(str(sp.priority), PRIORITIES),
    market: oneOf(str(sp.market), MARKETS),
    projectType: oneOf(str(sp.type), TYPES),
    groupBy,
    groupKey,
  };
}
