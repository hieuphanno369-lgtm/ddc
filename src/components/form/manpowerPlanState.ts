import { isValidYearMonth } from '@/lib/clock';
import {
  MANPOWER_PLAN_MAX_CELL, MANPOWER_PLAN_MAX_MONTHS, monthTotal, recomputeMonth, resetMonthToRatio, type PlanCell,
} from '@/lib/manpower-plan';
import type { ManpowerPlanInput, ManpowerPlanMonthRow, Shift, ShiftRatio } from '@/server/repo/types';

export type RowError = 'below_manual' | 'all_manual' | null;
/** cells cùng thứ tự shifts; cellInputs = chuỗi đang gõ của từng ô ca (nháp, cho phép rỗng khi đang xoá). */
export interface PlanRowState { yearMonth: string; cells: PlanCell[]; cellInputs: string[]; totalInput: string; error: RowError }
export interface PlanState { shiftCodes: string[]; pctInputs: string[]; rows: PlanRowState[] }

function isPlainInt(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

function inputsOf(cells: PlanCell[]): string[] {
  return cells.map((c) => String(c.planned));
}

export function initPlanState(shifts: Shift[], months: ManpowerPlanMonthRow[], ratios: ShiftRatio[]): PlanState {
  const activeShifts = [...shifts].filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const shiftCodes = activeShifts.map((s) => s.code);
  const pctByCode = new Map(ratios.map((r) => [r.shiftCode, r.pct]));
  const pctInputs = shiftCodes.map((code) => String(Math.round((pctByCode.get(code) ?? 0) * 1000) / 10));

  const monthsByYm = new Map<string, ManpowerPlanMonthRow[]>();
  for (const m of months) {
    if (!shiftCodes.includes(m.shiftCode)) continue; // bỏ dòng của ca không active
    const list = monthsByYm.get(m.yearMonth) ?? [];
    list.push(m);
    monthsByYm.set(m.yearMonth, list);
  }
  const rows: PlanRowState[] = [...monthsByYm.keys()].sort().map((yearMonth) => {
    const byCode = new Map(monthsByYm.get(yearMonth)!.map((r) => [r.shiftCode, r]));
    const cells: PlanCell[] = shiftCodes.map((code) => {
      const r = byCode.get(code);
      return r ? { planned: r.planned, isManual: r.isManual } : { planned: 0, isManual: false };
    });
    return { yearMonth, cells, cellInputs: inputsOf(cells), totalInput: String(monthTotal(cells)), error: null };
  });

  return { shiftCodes, pctInputs, rows };
}

/** % hợp lệ (mỗi ô số hữu hạn 0..100, tối đa 1 số lẻ, tổng 100 ±0.1) → pct 0..1; không hợp lệ → null. */
export function parsePcts(pctInputs: string[]): number[] | null {
  const nums: number[] = [];
  for (const raw of pctInputs) {
    const trimmed = raw.trim();
    if (!/^\d+(\.\d)?$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    nums.push(n);
  }
  const sum = nums.reduce((s, n) => s + n, 0);
  if (Math.abs(sum - 100) > 0.1) return null;
  return nums.map((n) => n / 100);
}

/** Gõ Tổng: chuỗi không phải số nguyên 0..MAX*số ca → chỉ đổi totalInput; hợp lệ → recomputeMonth;
 *  lỗi → error, cells giữ nguyên. parsePcts null → chỉ đổi totalInput. */
export function setTotal(s: PlanState, row: number, input: string): PlanState {
  const rows = s.rows.map((r, i) => {
    if (i !== row) return r;
    const trimmed = input.trim();
    const max = MANPOWER_PLAN_MAX_CELL * s.shiftCodes.length;
    if (!isPlainInt(trimmed) || Number(trimmed) > max) return { ...r, totalInput: input };
    const pcts = parsePcts(s.pctInputs);
    if (pcts == null) return { ...r, totalInput: input };
    const result = recomputeMonth(Number(trimmed), r.cells, pcts);
    if (!result.ok) return { ...r, totalInput: input, error: result.reason };
    return { yearMonth: r.yearMonth, cells: result.cells, cellInputs: inputsOf(result.cells), totalInput: input, error: null };
  });
  return { ...s, rows };
}

/** Gõ ô ca: luôn ghi chuỗi vào cellInputs (nháp). Nguyên 0..MANPOWER_PLAN_MAX_CELL → planned mới,
 *  isManual = true, totalInput = String(Σ), error = null; rỗng/không hợp lệ → cells giữ nguyên,
 *  toPlanInput trả null tới khi ô hợp lệ lại hoặc revertCell. */
export function setCell(s: PlanState, row: number, shift: number, input: string): PlanState {
  const trimmed = input.trim();
  const valid = isPlainInt(trimmed) && Number(trimmed) <= MANPOWER_PLAN_MAX_CELL;
  const rows = s.rows.map((r, i) => {
    if (i !== row) return r;
    const cellInputs = r.cellInputs.map((v, k) => (k === shift ? input : v));
    if (!valid) return { ...r, cellInputs };
    const n = Number(trimmed);
    const cells = r.cells.map((c, k) => (k === shift ? { planned: n, isManual: true } : c));
    return { yearMonth: r.yearMonth, cells, cellInputs, totalInput: String(monthTotal(cells)), error: null };
  });
  return { ...s, rows };
}

/** Rời ô ca: trả chuỗi nháp về số đang lưu của ô (bỏ phần gõ dở không hợp lệ). */
export function revertCell(s: PlanState, row: number, shift: number): PlanState {
  const rows = s.rows.map((r, i) => {
    if (i !== row) return r;
    return { ...r, cellInputs: r.cellInputs.map((v, k) => (k === shift ? String(r.cells[k].planned) : v)) };
  });
  return { ...s, rows };
}

/** Chuỗi nháp của ô ca có khớp số đang lưu không (sai → tô đỏ, chặn Lưu). */
export function isCellInputValid(r: PlanRowState, shift: number): boolean {
  const trimmed = r.cellInputs[shift].trim();
  return isPlainInt(trimmed) && Number(trimmed) === r.cells[shift].planned;
}

/** Gõ %: cập nhật pctInputs; parsePcts ok → mọi dòng recomputeMonth(Σ hiện tại, cells, pcts) (tổng tháng giữ nguyên). */
export function setPct(s: PlanState, shift: number, input: string): PlanState {
  const pctInputs = s.pctInputs.map((p, i) => (i === shift ? input : p));
  const pcts = parsePcts(pctInputs);
  if (pcts == null) return { ...s, pctInputs };
  const rows = s.rows.map((r) => {
    const total = monthTotal(r.cells);
    const result = recomputeMonth(total, r.cells, pcts);
    if (!result.ok) return { ...r, error: result.reason };
    return { yearMonth: r.yearMonth, cells: result.cells, cellInputs: inputsOf(result.cells), totalInput: r.totalInput, error: null };
  });
  return { ...s, pctInputs, rows };
}

/** "Tính lại theo tỷ lệ" 1 dòng: tổng = số trong totalInput nếu hợp lệ, không thì Σ; resetMonthToRatio;
 *  error = null. parsePcts null → trả s. */
export function resetRow(s: PlanState, row: number): PlanState {
  const pcts = parsePcts(s.pctInputs);
  if (pcts == null) return s;
  const rows = s.rows.map((r, i) => {
    if (i !== row) return r;
    const trimmed = r.totalInput.trim();
    const total = isPlainInt(trimmed) ? Number(trimmed) : monthTotal(r.cells);
    const cells = resetMonthToRatio(total, pcts);
    return { yearMonth: r.yearMonth, cells, cellInputs: inputsOf(cells), totalInput: String(total), error: null };
  });
  return { ...s, rows };
}

/** Thêm tháng (ô 0, không sửa tay), chèn đúng thứ tự tăng. */
export function addMonth(s: PlanState, yearMonth: string): PlanState | 'duplicate' | 'invalid' | 'too_many' {
  if (!isValidYearMonth(yearMonth)) return 'invalid';
  if (s.rows.some((r) => r.yearMonth === yearMonth)) return 'duplicate';
  if (s.rows.length >= MANPOWER_PLAN_MAX_MONTHS) return 'too_many';
  const cells: PlanCell[] = s.shiftCodes.map(() => ({ planned: 0, isManual: false }));
  const rows = [...s.rows, { yearMonth, cells, cellInputs: inputsOf(cells), totalInput: '0', error: null }].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  return { ...s, rows };
}

export function removeMonth(s: PlanState, row: number): PlanState {
  return { ...s, rows: s.rows.filter((_, i) => i !== row) };
}

/** null khi còn lỗi (dòng có error, totalInput khác Σ, ô ca đang gõ dở/không hợp lệ, parsePcts null). */
export function toPlanInput(s: PlanState): ManpowerPlanInput | null {
  const pcts = parsePcts(s.pctInputs);
  if (pcts == null) return null;
  for (const r of s.rows) {
    if (r.error) return null;
    const trimmed = r.totalInput.trim();
    if (!isPlainInt(trimmed) || Number(trimmed) !== monthTotal(r.cells)) return null;
    if (r.cells.some((_, k) => !isCellInputValid(r, k))) return null;
  }
  return {
    ratios: s.shiftCodes.map((code, i) => ({ shiftCode: code, pct: pcts[i] })),
    months: s.rows.map((r) => ({
      yearMonth: r.yearMonth,
      cells: r.cells.map((c, i) => ({ shiftCode: s.shiftCodes[i], planned: c.planned, isManual: c.isManual })),
    })),
  };
}
