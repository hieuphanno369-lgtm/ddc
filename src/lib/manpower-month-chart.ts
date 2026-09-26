import { addMonths } from '@/lib/clock';
import { monthLabel, type ShiftInfo } from '@/lib/manpower-charts';
import type { ManpowerPlanMonthRow, ShiftRatio } from '@/server/repo/types';
import type { ManpowerActualMonthRow } from '@/server/repo/read-types';

/**
 * T5 - model chart KH nhân lực theo tháng (cột theo ca + đường tổng KH + đường TT TB/ngày). Hàm
 * thuần - không đụng repo, không đọc đồng hồ.
 */

export interface MonthShift { code: string; name: string; pct: number | null }
export interface MonthDatum {
  yearMonth: string; label: string;
  planned: Record<string, number>;
  plannedTotal: number;
  hasPlan: boolean;
  actualAvg: number | null;
  actualDays: number;
}
export interface ManpowerMonthModel { shifts: MonthShift[]; months: MonthDatum[]; maxY: number }

/** Làm tròn lên bậc "đẹp" 1/2/2.5/5 × 10^k cho trục Y (0 -> 10). */
export function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const frac = v / base;
  let niceFrac: number;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

export function buildManpowerMonthModel(input: {
  plan: ManpowerPlanMonthRow[]; ratios: ShiftRatio[]; shifts: ShiftInfo[]; actual: ManpowerActualMonthRow[];
}): ManpowerMonthModel | null {
  const { plan, ratios, shifts, actual } = input;

  // Ca hiển thị: hợp mã ca trong plan + ratios; rỗng -> ca isActive.
  let codes = new Set([...plan.map((p) => p.shiftCode), ...ratios.map((r) => r.shiftCode)]);
  if (codes.size === 0) codes = new Set(shifts.filter((s) => s.isActive).map((s) => s.code));

  const shiftByCode = new Map(shifts.map((s) => [s.code, s]));
  const pctByCode = new Map(ratios.map((r) => [r.shiftCode, r.pct]));
  const shiftInfos: MonthShift[] = [...codes]
    .map((code) => {
      const info = shiftByCode.get(code);
      return { code, name: info?.name ?? code, sortOrder: info?.sortOrder ?? 999, pct: pctByCode.get(code) ?? null };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map(({ code, name, pct }) => ({ code, name, pct }));

  // Tháng = dải liên tục từ min tới max của (yearMonth trong plan) ∪ (yearMonth trong actual có days > 0).
  const planMonths = new Set(plan.map((p) => p.yearMonth));
  const actualMonths = new Set(actual.filter((a) => a.days > 0).map((a) => a.yearMonth));
  const allMonths = [...planMonths, ...actualMonths];
  if (allMonths.length === 0) return null;
  const minMonth = allMonths.reduce((m, ym) => (ym < m ? ym : m));
  const maxMonth = allMonths.reduce((m, ym) => (ym > m ? ym : m));

  const monthsList: string[] = [];
  for (let ym = minMonth; ym <= maxMonth; ym = addMonths(ym, 1)) monthsList.push(ym);

  const plannedByKey = new Map<string, number>();
  for (const p of plan) {
    const v = Number.isInteger(p.planned) && p.planned >= 0 ? p.planned : 0;
    plannedByKey.set(`${p.yearMonth}|${p.shiftCode}`, v);
  }
  const actualByMonth = new Map(actual.map((a) => [a.yearMonth, a]));

  const months: MonthDatum[] = monthsList.map((ym) => {
    const planned: Record<string, number> = {};
    let plannedTotal = 0;
    for (const s of shiftInfos) {
      const v = plannedByKey.get(`${ym}|${s.code}`) ?? 0;
      planned[s.code] = v;
      plannedTotal += v;
    }
    const actualRow = actualByMonth.get(ym);
    const actualAvg = actualRow && actualRow.days > 0 ? Math.round(actualRow.actualSum / actualRow.days) : null;
    return {
      yearMonth: ym,
      label: monthLabel(ym),
      planned,
      plannedTotal,
      hasPlan: planMonths.has(ym),
      actualAvg,
      actualDays: actualRow?.days ?? 0,
    };
  });

  const values = months.flatMap((m) => [...Object.values(m.planned), m.plannedTotal, m.actualAvg ?? 0]);
  const maxY = niceMax(Math.max(0, ...values));

  return { shifts: shiftInfos, months, maxY };
}
