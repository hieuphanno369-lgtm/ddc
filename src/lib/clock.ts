/**
 * Đồng hồ ứng dụng - nguồn DUY NHẤT cho "hôm nay" và "tháng hiện tại".
 * Trước đây mọi thứ neo vào hằng số seed (history.ts:26-27) nên app đóng băng ở 09/2026.
 * DDC_FAKE_TODAY ('YYYY-MM-DD') ghi đè để test/demo giữ được bộ số seed.
 * KHÔNG import file này từ src/data/seed/* - seed phải deterministic, giữ hằng số riêng.
 */

export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type YearMonth = string; // 'YYYY-MM'
export type IsoDate = string;   // 'YYYY-MM-DD'

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidYearMonth(s: string): boolean {
  return YM_RE.test(s);
}

export function isValidIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Ngày hôm nay theo múi giờ VN (en-CA cho ra đúng 'YYYY-MM-DD'). */
export function todayIso(): IsoDate {
  const override = process.env.DDC_FAKE_TODAY?.trim();
  if (override && isValidIsoDate(override)) return override;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** 00:00:00Z của ngày hôm nay - mọi phép trừ ngày (penaltyState...) dùng mốc này. */
export function today(): Date {
  return new Date(`${todayIso()}T00:00:00Z`);
}

export function monthOf(d: Date): YearMonth {
  return d.toISOString().slice(0, 7);
}

export function currentMonth(): YearMonth {
  return todayIso().slice(0, 7);
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

export function prevMonth(ym: YearMonth): YearMonth {
  return addMonths(ym, -1);
}

/**
 * Ngày cuối của tháng. HÀM THUẦN - không đọc DDC_FAKE_TODAY, không đọc đồng hồ máy,
 * nên seed được phép import (mốc tính "% Kế hoạch theo thời gian" của một tháng).
 * Mẹo: ngày 0 của tháng kế tiếp = ngày cuối tháng này.
 */
export function endOfMonth(ym: YearMonth): IsoDate {
  const next = addMonths(ym, 1);
  const d = new Date(`${next}-01T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** Cửa sổ trend: `count` tháng liên tiếp, cũ → mới, kết thúc ở tháng hiện tại. */
export function historyMonths(count = 12): YearMonth[] {
  if (count <= 0) return [];
  const end = currentMonth();
  return Array.from({ length: count }, (_, i) => addMonths(end, i - (count - 1)));
}

export function addDaysIso(d: IsoDate, delta: number): IsoDate {
  const t = new Date(`${d}T00:00:00Z`).getTime() + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
