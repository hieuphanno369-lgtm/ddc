import { isValidYearMonth } from '@/lib/clock';
import type { ManpowerPlanInput, ShiftRatio } from '@/server/repo/types';

/** Mặc định chia ca theo dim_shift.sortOrder khi dự án chưa có dòng project_shift_ratio (hợp đồng P3C). */
export const DEFAULT_SHIFT_RATIO: readonly number[] = [0.6, 0.4];
export const MANPOWER_PLAN_MAX_MONTHS = 60;
export const MANPOWER_PLAN_MAX_CELL = 99_999;
export const RATIO_SUM_TOLERANCE = 0.001;

export interface PlanCell { planned: number; isManual: boolean }

/** n = 0 → []; n = 1 → [1]; n >= 2 → DEFAULT_SHIFT_RATIO rồi 0 cho ca thứ 3 trở đi. */
export function defaultShiftRatios(shiftCodes: string[]): ShiftRatio[] {
  const n = shiftCodes.length;
  if (n === 0) return [];
  if (n === 1) return [{ shiftCode: shiftCodes[0], pct: 1 }];
  return shiftCodes.map((shiftCode, i) => ({
    shiftCode,
    pct: i < DEFAULT_SHIFT_RATIO.length ? DEFAULT_SHIFT_RATIO[i] : 0,
  }));
}

/** stored rỗng → defaultShiftRatios(shiftCodes); ngược lại mỗi ca trong shiftCodes lấy pct đã lưu, thiếu → 0.
 *  Bỏ dòng lưu của ca không có trong shiftCodes. Giữ thứ tự shiftCodes. */
export function resolveShiftRatios(shiftCodes: string[], stored: { shiftCode: string; pct: number }[]): ShiftRatio[] {
  if (stored.length === 0) return defaultShiftRatios(shiftCodes);
  const pctByCode = new Map(stored.map((s) => [s.shiftCode, s.pct]));
  return shiftCodes.map((shiftCode) => ({ shiftCode, pct: pctByCode.get(shiftCode) ?? 0 }));
}

/** |Σ - 1| <= RATIO_SUM_TOLERANCE. */
export function isRatioSumValid(pcts: number[]): boolean {
  const sum = pcts.reduce((s, p) => s + p, 0);
  return Math.abs(sum - 1) <= RATIO_SUM_TOLERANCE;
}

/** Chia total (nguyên >= 0) theo pcts: ca i < cuối = min(còn lại, Math.round(total * pct_i)),
 *  ca cuối = phần còn lại. Tổng luôn = total, không ô âm. */
export function splitTotal(total: number, pcts: number[]): number[] {
  const n = pcts.length;
  if (n === 0) return [];
  const result: number[] = [];
  let remaining = total;
  for (let i = 0; i < n - 1; i++) {
    const v = Math.max(0, Math.min(remaining, Math.round(total * pcts[i])));
    result.push(v);
    remaining -= v;
  }
  result.push(remaining);
  return result;
}

export function monthTotal(cells: PlanCell[]): number {
  return cells.reduce((s, c) => s + c.planned, 0);
}

/** Giữ ô isManual, chia (total - Σ manual) cho ô còn lại theo pct của chúng (chuẩn hoá tổng pct các ô
 *  đó = 1; tổng pct các ô đó = 0 → dồn hết vào ô không-manual cuối). */
export function recomputeMonth(
  total: number,
  cells: PlanCell[],
  pcts: number[],
): { ok: true; cells: PlanCell[] } | { ok: false; reason: 'below_manual' | 'all_manual' } {
  const manualSum = cells.reduce((s, c) => s + (c.isManual ? c.planned : 0), 0);
  if (total < manualSum) return { ok: false, reason: 'below_manual' };

  const nonManualIdx = cells.map((_, i) => i).filter((i) => !cells[i].isManual);
  const remaining = total - manualSum;

  if (nonManualIdx.length === 0) {
    if (remaining === 0) return { ok: true, cells: cells.map((c) => ({ ...c })) };
    return { ok: false, reason: 'all_manual' };
  }

  const subPcts = nonManualIdx.map((i) => pcts[i] ?? 0);
  const sumSub = subPcts.reduce((s, p) => s + p, 0);
  const normalized = sumSub === 0 ? subPcts.map((_, i) => (i === subPcts.length - 1 ? 1 : 0)) : subPcts.map((p) => p / sumSub);
  const splitted = splitTotal(remaining, normalized);

  const result = cells.map((c) => ({ ...c }));
  nonManualIdx.forEach((idx, k) => { result[idx].planned = splitted[k]; });
  return { ok: true, cells: result };
}

/** Bỏ mọi cờ sửa tay, chia lại theo tỷ lệ. */
export function resetMonthToRatio(total: number, pcts: number[]): PlanCell[] {
  return splitTotal(total, pcts).map((planned) => ({ planned, isManual: false }));
}

export interface ManpowerPlanErrors {
  ratio?: 'shifts' | 'range' | 'sum';
  tooManyMonths?: true;
  months: Record<number, ('yearMonth' | 'duplicate' | 'cells')[]>;
}

function sameSet(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  return setA.size === a.length && a.length === b.length && b.every((x) => setA.has(x));
}

/** Kiểm server + client. activeShiftCodes = ca isActive theo sortOrder. */
export function validateManpowerPlan(input: ManpowerPlanInput, activeShiftCodes: string[]): { ok: boolean; errors: ManpowerPlanErrors } {
  const errors: ManpowerPlanErrors = { months: {} };

  const ratioCodes = input.ratios.map((r) => r.shiftCode);
  if (!sameSet(ratioCodes, activeShiftCodes)) {
    errors.ratio = 'shifts';
  } else if (input.ratios.some((r) => !Number.isFinite(r.pct) || r.pct < 0 || r.pct > 1)) {
    errors.ratio = 'range';
  } else if (!isRatioSumValid(input.ratios.map((r) => r.pct))) {
    errors.ratio = 'sum';
  }

  if (input.months.length > MANPOWER_PLAN_MAX_MONTHS) errors.tooManyMonths = true;

  const seenMonths = new Set<string>();
  input.months.forEach((m, i) => {
    const issues: ('yearMonth' | 'duplicate' | 'cells')[] = [];
    if (!isValidYearMonth(m.yearMonth)) issues.push('yearMonth');
    else if (seenMonths.has(m.yearMonth)) issues.push('duplicate');
    seenMonths.add(m.yearMonth);

    const cellCodes = m.cells.map((c) => c.shiftCode);
    const shapeBad = !sameSet(cellCodes, activeShiftCodes);
    const valueBad = m.cells.some((c) => !Number.isInteger(c.planned) || c.planned < 0 || c.planned > MANPOWER_PLAN_MAX_CELL);
    if (shapeBad || valueBad) issues.push('cells');

    if (issues.length) errors.months[i] = issues;
  });

  const ok = !errors.ratio && !errors.tooManyMonths && Object.keys(errors.months).length === 0;
  return { ok, errors };
}

/** Audit 1 tháng: "morning:270,evening:180(m)" - (m) = sửa tay; theo thứ tự cells truyền vào. */
export function manpowerMonthAuditText(cells: { shiftCode: string; planned: number; isManual: boolean }[]): string {
  return cells.map((c) => `${c.shiftCode}:${c.planned}${c.isManual ? '(m)' : ''}`).join(',');
}

/** Audit tỷ lệ: "morning:0.6,evening:0.4" (pct làm tròn 4 số lẻ, Number(pct.toFixed(4))). */
export function ratioAuditText(ratios: ShiftRatio[]): string {
  return ratios.map((r) => `${r.shiftCode}:${Number(r.pct.toFixed(4))}`).join(',');
}
