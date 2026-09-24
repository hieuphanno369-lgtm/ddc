import type { IsoDate, YearMonth } from '@/lib/clock';

/**
 * Ma luat + khoa chong trung (dedupeKey) cho engine canh bao (T11, Task 8).
 * Thuan - khong doc dong ho, khong goi repo.
 */
export type AlertRuleCode =
  | 'spi_low'
  | 'cpi_low'
  | 'penalty_risk'
  | 'penalty_overdue'
  | 'ar_overdue'
  | 'manpower_low'
  | 'equipment_low';

/** Tuan ISO cua 1 ngay, dang '2026-W38' (Thu 2 dau tuan, tuan chua Thu 5 dau nam la W01). */
export function isoWeekOf(d: IsoDate): string {
  const date = new Date(`${d}T00:00:00Z`);
  // Dua ve Thu 5 cua tuan chua ngay nay (ISO: Thu 2 = 1 ... Chu nhat = 7).
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(date.getUTCDate() + (4 - dayNum));
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

export function monthKey(code: AlertRuleCode, ym: YearMonth): string {
  return `${code}:${ym}`;
}

/** '2026-10-01' (10 ky tu dau) | 'penalty_risk:none' khi khong co ngay ban giao. */
export function handoverKey(code: AlertRuleCode, handover: string | null): string {
  if (!handover) return `${code}:none`;
  return `${code}:${handover.slice(0, 10)}`;
}

export function weekKey(code: AlertRuleCode, d: IsoDate): string {
  return `${code}:${isoWeekOf(d)}`;
}
