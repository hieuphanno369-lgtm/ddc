import type { ShiftMonthRow } from '@/server/repo/read-types';

/**
 * Dựng dữ liệu 2 chart nhân lực (T12b): chart ca × nhà thầu (Bước 2), chart tuần chồng (Bước 3).
 * Hàm thuần - không đụng repo, không đọc đồng hồ.
 */

export interface ShiftInfo { code: string; name: string; sortOrder: number; isActive: boolean }
export interface ContractorInfo { id: number; name: string }
export interface ShiftBarDatum {
  contractorId: number; name: string;
  actual: Record<string, number>;   // shiftCode -> TT TB/ngày (làm tròn số nguyên)
  planned: Record<string, number>;  // shiftCode -> KH TB/ngày
  days: Record<string, number>;     // shiftCode -> số ngày có số liệu
}

/** 'YYYY-MM' -> 'MM/YYYY' - nhãn chọn tháng dùng chung cho chart ca + chart tuần. */
export function monthLabel(ym: string): string {
  return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
}

/** Các tháng có số liệu + pageMonth, giảm dần, không trùng. */
export function shiftChartMonths(rows: ShiftMonthRow[], pageMonth: string): string[] {
  const set = new Set(rows.map((r) => r.yearMonth));
  set.add(pageMonth);
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Ca hiển thị của tháng: ca isActive + ca có trong rows tháng đó (mã lạ không có trong shifts → name = code, sortOrder = 999). */
export function shiftsForMonth(rows: ShiftMonthRow[], yearMonth: string, shifts: ShiftInfo[]): ShiftInfo[] {
  const codesInMonth = new Set(rows.filter((r) => r.yearMonth === yearMonth).map((r) => r.shiftCode));
  const byCode = new Map(shifts.map((s) => [s.code, s]));
  const codes = new Set([...shifts.filter((s) => s.isActive).map((s) => s.code), ...codesInMonth]);
  return [...codes]
    .map((code) => byCode.get(code) ?? { code, name: code, sortOrder: 999, isActive: false })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export function buildShiftBars(rows: ShiftMonthRow[], yearMonth: string, contractors: ContractorInfo[]): ShiftBarDatum[] {
  const nameOf = new Map(contractors.map((c) => [c.id, c.name]));
  const byContractor = new Map<number, ShiftBarDatum>();
  for (const r of rows) {
    if (r.yearMonth !== yearMonth) continue;
    const cur = byContractor.get(r.contractorId) ?? {
      contractorId: r.contractorId,
      name: nameOf.get(r.contractorId) ?? `#${r.contractorId}`,
      actual: {}, planned: {}, days: {},
    };
    cur.actual[r.shiftCode] = Math.round(r.actual / r.days);
    cur.planned[r.shiftCode] = Math.round(r.planned / r.days);
    cur.days[r.shiftCode] = r.days;
    byContractor.set(r.contractorId, cur);
  }
  return [...byContractor.values()].sort((a, b) => {
    const totalA = Object.values(a.actual).reduce((s, x) => s + x, 0);
    const totalB = Object.values(b.actual).reduce((s, x) => s + x, 0);
    if (totalA !== totalB) return totalB - totalA;
    return a.name.localeCompare(b.name, 'vi');
  });
}
