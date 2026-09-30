/**
 * Mang số tháng trước sang (P4): số tồn tại tháng mốc = dòng có yearMonth LỚN NHẤT <= mốc.
 * HÀM THUẦN, không mang số từ tương lai về quá khứ, không giới hạn số tháng mang (Q8).
 */

import type { IsoDate, YearMonth } from './clock';

export type DataStateKind = 'current' | 'carried' | 'completed' | 'none';
/** month: tháng nguồn của số; 'completed' = tháng của actualFinishDate. */
export interface DataState { kind: DataStateKind; month: YearMonth | null }
export interface AsOf<T> { row: T; sourceYm: YearMonth; carried: boolean }

/** rowsAsc sắp tăng theo yearMonth. Trả dòng cuối có yearMonth <= ym; không có → null. */
export function pickAsOf<T extends { yearMonth: string }>(rowsAsc: readonly T[], ym: YearMonth): AsOf<T> | null {
  let lo = 0;
  let hi = rowsAsc.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rowsAsc[mid].yearMonth <= ym) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0) return null;
  const row = rowsAsc[found];
  return { row, sourceYm: row.yearMonth, carried: row.yearMonth !== ym };
}

/** Chuỗi theo từng tháng của `months`, mỗi phần tử = pickAsOf tại tháng đó. */
export function carrySeries<T extends { yearMonth: string }>(
  rowsAsc: readonly T[], months: readonly YearMonth[],
): (AsOf<T> | null)[] {
  return months.map((m) => pickAsOf(rowsAsc, m));
}

/** Nhãn cột "Số liệu": completed nếu đã hoàn thành tại mốc và có ngày kết thúc; none nếu không có số; còn lại carried/current. */
export function dataStateOf(
  asOf: AsOf<unknown> | null, statusAtAsOf: string, actualFinishDate: IsoDate | null,
): DataState {
  if (statusAtAsOf === 'Hoan_thanh' && actualFinishDate) {
    return { kind: 'completed', month: actualFinishDate.slice(0, 7) };
  }
  if (!asOf) return { kind: 'none', month: null };
  return { kind: asOf.carried ? 'carried' : 'current', month: asOf.sourceYm };
}
