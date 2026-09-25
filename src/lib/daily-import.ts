import { isValidIsoDate, type IsoDate } from '@/lib/clock';
import { DAILY_VALUE_MAX, isInWindow, type EquipmentCellInput, type ManpowerCellInput } from '@/lib/daily-entry';
import type { Contractor, Equipment, Shift } from '@/server/repo/types';

/**
 * Import Excel nhân lực/thiết bị theo ngày (Task 5, P2A) - hàm THUẦN, nhận ô đã đọc (không đụng
 * exceljs, xem `src/server/daily-import.ts`).
 */
export const DAILY_IMPORT_MAX_ROWS = 5000;
export const DAILY_IMPORT_MAX_DAYS = 62;
export const SHEET_MANPOWER = 'NhanLuc';
export const SHEET_EQUIPMENT = 'ThietBi';

/** Q3=a: 1 dòng = ngày × nhà thầu, cột 'KH <ca>'/'TT <ca>' sinh từ shifts (thứ tự sortOrder). */
export function manpowerHeaders(shifts: Shift[]): string[] {
  const cols: string[] = ['Ngày', 'Nhà thầu'];
  for (const s of [...shifts].sort((a, b) => a.sortOrder - b.sortOrder)) {
    cols.push(`KH ${s.nameVi}`, `TT ${s.nameVi}`);
  }
  return cols;
}

export const EQUIPMENT_HEADERS = ['Ngày', 'Nhà thầu', 'Thiết bị', 'KH', 'TT'] as const;

export type CellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { text?: string; result?: unknown; richText?: { text: string }[] };

/** Chuỗi hiển thị của 1 ô (dùng cho tên nhà thầu/thiết bị + so khớp tiêu đề). */
export function cellText(v: CellValue): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if ('result' in v && v.result !== undefined) return cellText(v.result as CellValue);
    if (v.text) return v.text.trim();
  }
  return '';
}

function isoFrom(y: number, m: number, d: number): IsoDate | null {
  const s = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isValidIsoDate(s) ? s : null;
}

/** Excel serial date: ngày 0 = 1899-12-30 (đúng quy ước Excel/exceljs). */
function excelSerialToIso(n: number): IsoDate | null {
  if (!Number.isFinite(n)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000);
  if (Number.isNaN(d.getTime())) return null;
  return isoFrom(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function parseDateString(raw: string): IsoDate | null {
  const s = raw.trim();
  if (isValidIsoDate(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return isoFrom(Number(m[3]), Number(m[2]), Number(m[1]));
}

/**
 * Date (dùng getUTC*), số serial Excel, chuỗi 'd/m/yyyy' | 'dd/mm/yyyy' | 'yyyy-mm-dd'; object:
 * richText nối text, formula lấy result. Không hợp lệ → null.
 */
export function parseExcelDate(v: CellValue): IsoDate | null {
  if (v == null) return null;
  if (v instanceof Date) return isoFrom(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === 'number') return excelSerialToIso(v);
  if (typeof v === 'string') return parseDateString(v);
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return parseExcelDate(v.result as CellValue);
    const text = cellText(v);
    return text ? parseDateString(text) : null;
  }
  return null;
}

/** '' → 0; không phải số nguyên 0..DAILY_VALUE_MAX → null. */
function parseCount(v: CellValue): number | null {
  const text = cellText(v);
  if (text.trim() === '') return 0;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > DAILY_VALUE_MAX) return null;
  return n;
}

export type DailyImportReason =
  | 'bad_date'
  | 'out_of_window'
  | 'unknown_contractor'
  | 'unknown_equipment'
  | 'bad_number'
  | 'actual_future'
  | 'duplicate';

export interface DailyImportRow {
  sheet: 'manpower' | 'equipment';
  rowNo: number; // số dòng Excel, header = 1
  workDate: IsoDate | null;
  contractorName: string;
  equipmentName: string; // '' với sheet nhân lực
  status: 'ok' | 'invalid';
  reason: DailyImportReason | null;
  manpower: ManpowerCellInput[];
  equipment: EquipmentCellInput[];
}

export interface DailyImportContext {
  members: Contractor[];
  shifts: Shift[];
  equipments: Equipment[];
  window: { min: IsoDate | null; max: IsoDate };
  today: IsoDate;
}

export type SheetParse = { ok: true; rows: DailyImportRow[] } | { ok: false; error: 'bad_header' };

function headerMatches(actual: CellValue[], expected: string[]): boolean {
  if (actual.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (cellText(actual[i]).toLowerCase() !== expected[i].toLowerCase()) return false;
  }
  return true;
}

function isAllBlank(row: CellValue[]): boolean {
  return row.every((c) => cellText(c) === '');
}

export function parseManpowerSheet(header: CellValue[], rows: CellValue[][], ctx: DailyImportContext): SheetParse {
  const expected = manpowerHeaders(ctx.shifts);
  if (!headerMatches(header, expected)) return { ok: false, error: 'bad_header' };

  const shifts = [...ctx.shifts].sort((a, b) => a.sortOrder - b.sortOrder);
  const seen = new Set<string>();
  const out: DailyImportRow[] = [];

  rows.forEach((raw, i) => {
    if (isAllBlank(raw)) return;
    const rowNo = i + 2;
    const contractorName = cellText(raw[1]);
    const base: Pick<DailyImportRow, 'sheet' | 'rowNo' | 'contractorName' | 'equipmentName'> = {
      sheet: 'manpower', rowNo, contractorName, equipmentName: '',
    };

    const workDate = parseExcelDate(raw[0]);
    if (!workDate) {
      out.push({ ...base, workDate: null, status: 'invalid', reason: 'bad_date', manpower: [], equipment: [] });
      return;
    }
    if (!isInWindow(workDate, ctx.window)) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'out_of_window', manpower: [], equipment: [] });
      return;
    }
    const member = ctx.members.find((m) => m.name.trim().toLowerCase() === contractorName.toLowerCase());
    if (!member) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'unknown_contractor', manpower: [], equipment: [] });
      return;
    }

    const cells: ManpowerCellInput[] = [];
    let badNumber = false;
    shifts.forEach((s, si) => {
      const col = 2 + si * 2;
      const planned = parseCount(raw[col]);
      const actual = parseCount(raw[col + 1]);
      if (planned == null || actual == null) {
        badNumber = true;
        return;
      }
      cells.push({ contractorId: member.id, shiftCode: s.code, plannedHeadcount: planned, actualHeadcount: actual });
    });
    if (badNumber) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'bad_number', manpower: [], equipment: [] });
      return;
    }
    if (workDate > ctx.today && cells.some((c) => c.actualHeadcount > 0)) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'actual_future', manpower: [], equipment: [] });
      return;
    }

    const key = `${workDate}|${member.id}`;
    if (seen.has(key)) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'duplicate', manpower: [], equipment: [] });
      return;
    }
    seen.add(key);
    out.push({ ...base, workDate, status: 'ok', reason: null, manpower: cells, equipment: [] });
  });

  return { ok: true, rows: out };
}

export function parseEquipmentSheet(header: CellValue[], rows: CellValue[][], ctx: DailyImportContext): SheetParse {
  if (!headerMatches(header, [...EQUIPMENT_HEADERS])) return { ok: false, error: 'bad_header' };

  const seen = new Set<string>();
  const out: DailyImportRow[] = [];

  rows.forEach((raw, i) => {
    if (isAllBlank(raw)) return;
    const rowNo = i + 2;
    const contractorName = cellText(raw[1]);
    const equipmentName = cellText(raw[2]);
    const base: Pick<DailyImportRow, 'sheet' | 'rowNo' | 'contractorName' | 'equipmentName'> = {
      sheet: 'equipment', rowNo, contractorName, equipmentName,
    };

    const workDate = parseExcelDate(raw[0]);
    if (!workDate) {
      out.push({ ...base, workDate: null, status: 'invalid', reason: 'bad_date', manpower: [], equipment: [] });
      return;
    }
    if (!isInWindow(workDate, ctx.window)) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'out_of_window', manpower: [], equipment: [] });
      return;
    }
    const member = ctx.members.find((m) => m.name.trim().toLowerCase() === contractorName.toLowerCase());
    if (!member) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'unknown_contractor', manpower: [], equipment: [] });
      return;
    }
    const equipmentItem = ctx.equipments.find((e) => e.name.trim().toLowerCase() === equipmentName.toLowerCase());
    if (!equipmentItem) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'unknown_equipment', manpower: [], equipment: [] });
      return;
    }

    const planned = parseCount(raw[3]);
    const actual = parseCount(raw[4]);
    if (planned == null || actual == null) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'bad_number', manpower: [], equipment: [] });
      return;
    }
    if (workDate > ctx.today && actual > 0) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'actual_future', manpower: [], equipment: [] });
      return;
    }

    const key = `${workDate}|${member.id}|${equipmentItem.id}`;
    if (seen.has(key)) {
      out.push({ ...base, workDate, status: 'invalid', reason: 'duplicate', manpower: [], equipment: [] });
      return;
    }
    seen.add(key);
    out.push({
      ...base, workDate, status: 'ok', reason: null, manpower: [],
      equipment: [{ contractorId: member.id, equipmentId: equipmentItem.id, qtyPlanned: planned, qtyActual: actual }],
    });
  });

  return { ok: true, rows: out };
}

/** Chỉ dòng ok, sắp ngày asc; gộp cả 2 sheet cùng ngày thành 1 phần tử. */
export function groupImportByDay(
  rows: DailyImportRow[],
): { workDate: IsoDate; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }[] {
  const map = new Map<IsoDate, { workDate: IsoDate; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }>();
  for (const r of rows) {
    if (r.status !== 'ok' || !r.workDate) continue;
    const entry = map.get(r.workDate) ?? { workDate: r.workDate, manpower: [], equipment: [] };
    entry.manpower.push(...r.manpower);
    entry.equipment.push(...r.equipment);
    map.set(r.workDate, entry);
  }
  return [...map.values()].sort((a, b) => (a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : 0));
}
