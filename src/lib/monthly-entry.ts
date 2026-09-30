import { addMonths, endOfMonth, type IsoDate, type YearMonth } from '@/lib/clock';
import type { BackfillRange } from '@/lib/daily-entry';
import type { Role } from '@/server/repo/types';

/**
 * P4 (F4, Q9=b): luật tháng khi nhập/sửa SỐ THEO THÁNG ở server.
 * admin: mọi tháng. data-entry: tháng hiện tại và tháng trước; tháng cũ hơn (hoặc tương lai) chỉ khi
 * tháng đó có ít nhất 1 ngày nằm trong 1 khoảng nhập bù đang bật của dự án.
 * (Tháng đã khoá sổ vẫn bị chặn riêng ở server, nhập bù không vượt khoá sổ - Q10.)
 */
export function isMonthAllowed(role: Role, month: YearMonth, today: IsoDate, backfill: BackfillRange[]): boolean {
  if (role === 'admin') return true;
  const current = today.slice(0, 7);
  if (month === current || month === addMonths(current, -1)) return true;
  return isBackfillMonth(month, backfill);
}

/** Tháng có ít nhất 1 ngày nằm trong 1 khoảng nhập bù. */
export function isBackfillMonth(month: YearMonth, backfill: BackfillRange[]): boolean {
  const first = `${month}-01`;
  const last = endOfMonth(month);
  return backfill.some((r) => r.from <= last && r.to >= first);
}

/** Danh sách tháng (cũ → mới) mà các khoảng nhập bù mở thêm, không trùng. */
export function backfillMonths(backfill: BackfillRange[]): YearMonth[] {
  const out = new Set<YearMonth>();
  for (const r of backfill) {
    for (let m = r.from.slice(0, 7); m <= r.to.slice(0, 7); m = addMonths(m, 1)) out.add(m);
  }
  return [...out].sort();
}
