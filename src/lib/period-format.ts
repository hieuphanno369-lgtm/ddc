/**
 * Định dạng hiển thị của kỳ/tháng (P4). HÀM THUẦN, không đọc đồng hồ.
 * Tháng 'YYYY-MM' hiển thị 'MM/yyyy'; khoảng tháng 'MM/yyyy - MM/yyyy' (1 tháng thì chỉ 1 vế).
 */

import type { YearMonth } from './clock';

/** '2026-09' -> '09/2026'. */
export function formatMonthShort(ym: YearMonth): string {
  return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
}

/** Mảng tháng (cũ -> mới) -> 'MM/yyyy - MM/yyyy'; 1 tháng -> 'MM/yyyy'; rỗng -> ''. */
export function formatMonthRange(months: readonly YearMonth[]): string {
  if (months.length === 0) return '';
  const first = formatMonthShort(months[0]);
  const last = formatMonthShort(months[months.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}
