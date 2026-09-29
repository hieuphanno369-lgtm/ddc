/**
 * Kỳ báo cáo (P4) - tầng thời gian thuần cho Tổng quan và Chi tiết.
 * HÀM THUẦN: không đọc đồng hồ, "hôm nay" luôn nhận qua tham số. Không import `@/server/*`.
 * Khái niệm: "tháng của kỳ" = mọi tháng có ít nhất 1 ngày nằm trong kỳ (tính trọn tháng);
 * "ngày mốc" = min(to, hôm nay); "tháng mốc" = 7 ký tự đầu của ngày mốc.
 */

import { addDaysIso, addMonths, daysBetween, endOfMonth, isValidIsoDate, isValidYearMonth } from './clock';
import type { IsoDate, YearMonth } from './clock';

export interface Period { from: IsoDate; to: IsoDate }

/** Giới hạn kỹ thuật (chặn khoá cache và truy vấn quá dài), không phải quy tắc nghiệp vụ. */
export const PERIOD_MAX_MONTHS = 120;
const YEAR_MIN = 2000;
const YEAR_MAX = 2999;

const inRange = (year: number) => year >= YEAR_MIN && year <= YEAR_MAX;
const isUsableDate = (s: string | undefined): s is IsoDate =>
  typeof s === 'string' && isValidIsoDate(s) && inRange(Number(s.slice(0, 4)));

/** Kéo `from` lên nếu kỳ dài hơn PERIOD_MAX_MONTHS tháng (to giữ nguyên). */
function clampLength(p: Period): Period {
  const firstAllowed = `${addMonths(p.to.slice(0, 7), -(PERIOD_MAX_MONTHS - 1))}-01`;
  return p.from < firstAllowed ? { from: firstAllowed, to: p.to } : p;
}

/** Đọc kỳ từ URL. Ưu tiên from/to hợp lệ; không có thì `month=YYYY-MM` hợp lệ = trọn tháng đó; còn lại (kể cả 'all', rác) = fallback. */
export function parsePeriod(sp: { from?: string; to?: string; month?: string }, fallback: Period): Period {
  if (isUsableDate(sp.from) && isUsableDate(sp.to)) {
    const p = sp.from <= sp.to ? { from: sp.from, to: sp.to } : { from: sp.to, to: sp.from };
    return clampLength(p);
  }
  const m = sp.month;
  if (typeof m === 'string' && isValidYearMonth(m) && inRange(Number(m.slice(0, 4)))) {
    return { from: `${m}-01`, to: endOfMonth(m) };
  }
  return fallback;
}

/**
 * Như `parsePeriod` nhưng cho biết tham số kỳ có được đưa vào mà không dùng được (T-6): có from/to/month không rỗng
 * mà kết quả rơi về `fallback` thì `invalid` = true (trang hiện dòng `period.invalid` thay vì im lặng).
 */
export function parsePeriodChecked(
  sp: { from?: string; to?: string; month?: string },
  fallback: Period,
): { period: Period; invalid: boolean } {
  const period = parsePeriod(sp, fallback);
  const given = [sp.from, sp.to, sp.month].some((v) => typeof v === 'string' && v !== '');
  return { period, invalid: given && period === fallback };
}

/** Kỳ mặc định Tổng quan (Q1): ngày 01 của tháng cách 11 tháng tới hôm nay. */
export function defaultOverviewPeriod(today: IsoDate): Period {
  return { from: `${addMonths(today.slice(0, 7), -11)}-01`, to: today };
}

/** Mọi tháng có ngày nằm trong kỳ, cũ → mới. */
export function periodMonths(p: Period): YearMonth[] {
  const last = p.to.slice(0, 7);
  const out: YearMonth[] = [];
  for (let m = p.from.slice(0, 7); m <= last; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function periodAsOfDate(p: Period, today: IsoDate): IsoDate {
  return p.to < today ? p.to : today;
}

export function periodAsOfMonth(p: Period, today: IsoDate): YearMonth {
  return periodAsOfDate(p, today).slice(0, 7);
}

/** Kỳ liền trước cùng số ngày: to' = from - 1 ngày, from' = to' - (số ngày kỳ - 1). */
export function previousPeriod(p: Period): Period {
  const days = daysBetween(p.from, p.to) + 1;
  const to = addDaysIso(p.from, -1);
  return { from: addDaysIso(to, -(days - 1)), to };
}

export function periodKey(p: Period): string {
  return `${p.from}_${p.to}`;
}

export function periodContains(p: Period, d: IsoDate): boolean {
  return d >= p.from && d <= p.to;
}

/** Giao nhau giữa [start, end] (null = vô cùng) và kỳ. */
export function intersectsPeriod(start: IsoDate | null, end: IsoDate | null, p: Period): boolean {
  return (start == null || start <= p.to) && (end == null || end >= p.from);
}

/** Tham số URL để giữ kỳ khi tạo link. */
export function periodSearch(p: Period): { from: IsoDate; to: IsoDate } {
  return { from: p.from, to: p.to };
}
