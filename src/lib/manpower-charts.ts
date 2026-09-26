import { addDaysIso, addMonths, daysBetween, endOfMonth } from '@/lib/clock';
import { bucketOf } from '@/lib/daily-series';
import { formatDayMonth } from '@/lib/format';
import type { DateRange, WeekContractorRow } from '@/server/repo/read-types';

/**
 * Dựng dữ liệu chart nhân lực: chart tuần chồng (Bước 3). Hàm thuần - không đụng repo, không
 * đọc đồng hồ.
 */

export interface ShiftInfo { code: string; name: string; sortOrder: number; isActive: boolean }
export interface ContractorInfo { id: number; name: string }

/** 'YYYY-MM' -> 'MM/YYYY' - nhãn chọn tháng dùng chung cho chart nhân lực. */
export function monthLabel(ym: string): string {
  return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
}

// ---- Bước 3: chart cột chồng theo tuần × nhà thầu (Q3, Q4, Q5) ----

export interface ProjectDates { plannedStartDate: string | null; plannedFinishDate: string | null; actualStartDate: string | null; actualFinishDate: string | null }

/**
 * Q5: đầu = actualStartDate → plannedStartDate, cuối = actualFinishDate → plannedFinishDate
 * (cắt 'YYYY-MM-DD'); nới cho chứa dataRange; thiếu đầu hoặc cuối → lấy từ dataRange; không có
 * gì → null. Nếu đầu > cuối → đổi chỗ.
 */
export function projectTimeline(p: ProjectDates, dataRange: DateRange | null): DateRange | null {
  const projFrom = (p.actualStartDate ?? p.plannedStartDate)?.slice(0, 10) ?? null;
  const projTo = (p.actualFinishDate ?? p.plannedFinishDate)?.slice(0, 10) ?? null;
  let from = projFrom ?? dataRange?.from ?? projTo ?? dataRange?.to ?? null;
  let to = projTo ?? dataRange?.to ?? projFrom ?? dataRange?.from ?? null;
  if (from == null || to == null) return null;
  if (from > to) { const tmp = from; from = to; to = tmp; }
  if (dataRange) {
    if (dataRange.from < from) from = dataRange.from;
    if (dataRange.to > to) to = dataRange.to;
  }
  return { from, to };
}

export interface WeekBucket {
  weekStart: string; weekEnd: string;     // Thứ 2 / Chủ nhật
  label: string;                           // 'dd/mm' của Thứ 2 (formatDayMonth)
  days: number;                            // số ngày của tuần nằm trong range (1..7)
  actualByContractor: Record<number, number>; // TB/ngày = Math.round(sum / days)
  actualAvg: number; plannedAvg: number;  // tổng mọi nhà thầu, TB/ngày
}

/** Mọi tuần từ Thứ 2 của range.from tới Thứ 2 của range.to (kể cả tuần không có dòng → 0). */
export function buildWeeklyStack(rows: WeekContractorRow[], range: DateRange): WeekBucket[] {
  const byWeek = new Map<string, WeekContractorRow[]>();
  for (const r of rows) {
    const list = byWeek.get(r.weekStart) ?? [];
    list.push(r);
    byWeek.set(r.weekStart, list);
  }
  const weeks: WeekBucket[] = [];
  const lastWeekStart = bucketOf(range.to, 'week').from;
  let cursor = bucketOf(range.from, 'week').from;
  while (cursor <= lastWeekStart) {
    const weekEnd = addDaysIso(cursor, 6);
    const overlapFrom = cursor > range.from ? cursor : range.from;
    const overlapTo = weekEnd < range.to ? weekEnd : range.to;
    const days = daysBetween(overlapFrom, overlapTo) + 1;
    const weekRows = byWeek.get(cursor) ?? [];
    const actualByContractor: Record<number, number> = {};
    let sumActual = 0;
    let sumPlanned = 0;
    for (const r of weekRows) {
      actualByContractor[r.contractorId] = Math.round(r.actual / days);
      sumActual += r.actual;
      sumPlanned += r.planned;
    }
    weeks.push({
      weekStart: cursor,
      weekEnd,
      label: formatDayMonth(cursor),
      days,
      actualByContractor,
      actualAvg: Math.round(sumActual / days),
      plannedAvg: Math.round(sumPlanned / days),
    });
    cursor = addDaysIso(cursor, 7);
  }
  return weeks;
}

/** Chỉ số các tuần giao với tháng (weekStart <= cuối tháng && weekEnd >= ngày 1). */
export function weeksInMonth(weeks: WeekBucket[], yearMonth: string): number[] {
  const monthStart = `${yearMonth}-01`;
  const monthEnd = endOfMonth(yearMonth);
  const idx: number[] = [];
  weeks.forEach((w, i) => {
    if (w.weekStart <= monthEnd && w.weekEnd >= monthStart) idx.push(i);
  });
  return idx;
}

/** Các tháng mà timeline đi qua, tăng dần. */
export function timelineMonths(range: DateRange): string[] {
  const months: string[] = [];
  let ym = range.from.slice(0, 7);
  const end = range.to.slice(0, 7);
  while (ym <= end) {
    months.push(ym);
    ym = addMonths(ym, 1);
  }
  return months;
}
