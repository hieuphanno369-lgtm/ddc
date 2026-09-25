import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { safeCell } from '@/lib/excel-safe';
import { DAILY_IMPORT_MAX_ROWS, EQUIPMENT_HEADERS, manpowerHeaders, SHEET_EQUIPMENT, SHEET_MANPOWER, type CellValue } from '@/lib/daily-import';
import type { Contractor, Equipment, Shift } from '@/server/repo/types';

/** H-1a (danh-gia.md vòng 1): trần số cột đọc từ 1 sheet - chặn file gài ô ở cột XFD (16384) làm nổ RAM. */
export const SHEET_MAX_COLS = 64;

/** H-1b (danh-gia.md vòng 2): trần số entry trong file .xlsx (zip) - chặn file gài hàng nghìn entry rỗng/nhỏ làm chậm `JSZip.loadAsync`. */
export const XLSX_MAX_ENTRIES = 200;

/** Sheet đã đọc có giới hạn dòng/cột, dùng chung cho mọi nơi đọc Excel bằng exceljs (H-1a). */
export type BoundedSheet =
  | { ok: true; header: CellValue[]; rows: { rowNo: number; cells: CellValue[] }[] }
  | { ok: false; error: 'too_many_rows' | 'too_many_cols' };

/**
 * `internalStream` (jszip 3.10.2, `lib/zipObject.js`) không có trong `@types/jszip` (chỉ `async`/
 * `nodeStream` - cả 2 đều dồn hết dữ liệu trước khi trả). Khai kiểu tối thiểu để dùng đúng API
 * stream-có-thể-dừng-sớm mà không tắt kiểm kiểu toàn file.
 */
interface JSZipInternalStream {
  on(evt: 'data', fn: (chunk: Uint8Array) => void): JSZipInternalStream;
  on(evt: 'error', fn: (err: Error) => void): JSZipInternalStream;
  on(evt: 'end', fn: () => void): JSZipInternalStream;
  resume(): JSZipInternalStream;
  pause(): JSZipInternalStream;
}
type JSZipObjectWithInternalStream = JSZip.JSZipObject & { internalStream(type: 'uint8array'): JSZipInternalStream };

function rowToCells(row: ExcelJS.Row, colCount: number): CellValue[] {
  const cells: CellValue[] = [];
  for (let c = 1; c <= colCount; c++) cells.push(row.getCell(c).value as CellValue);
  return cells;
}

/**
 * H-1a: đọc 1 sheet với trần dòng/cột kiểm TRƯỚC khi lặp - không dùng `ws.rowCount`/`ws.columnCount`
 * để dựng vòng lặp (1 ô ở XFD1 + A1048576 đủ làm exceljs dựng hàng tỷ Cell). `eachRow` chỉ ghé
 * dòng có dữ liệu; `getCell` chỉ tới `colCount` đã chặn.
 */
export function readBoundedSheet(ws: ExcelJS.Worksheet | undefined, maxRows: number): BoundedSheet {
  if (!ws || ws.rowCount === 0) return { ok: true, header: [], rows: [] };
  if (ws.rowCount > maxRows + 1) return { ok: false, error: 'too_many_rows' };

  const colCount = ws.getRow(1).cellCount;
  if (colCount > SHEET_MAX_COLS) return { ok: false, error: 'too_many_cols' };

  const header = rowToCells(ws.getRow(1), colCount);
  const rows: { rowNo: number; cells: CellValue[] }[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({ rowNo: rowNumber, cells: rowToCells(row, colCount) });
  });
  return { ok: true, header, rows };
}

/**
 * H-1b (danh-gia.md vòng 2): chống zip bomb - trước khi `wb.xlsx.load` giải nén toàn bộ, đo tổng
 * dung lượng sau giải nén của MỌI entry (exceljs `entry.async('string'|'nodebuffer')` giải nén tất
 * cả, không phân biệt tên - xem `exceljs/lib/xlsx/xlsx.js`), cộng dồn qua mọi entry vào MỘT biến
 * `total`, và trần số entry (`XLSX_MAX_ENTRIES`) để chặn file gài rất nhiều entry nhỏ. Đo bằng
 * stream có thể dừng sớm; KHÔNG dùng `entry.async(...)` (dồn hết vào bộ nhớ trước khi trả) và
 * KHÔNG tin `_data.uncompressedSize` (siêu dữ liệu zip có thể bị làm giả).
 */
export async function assertXlsxInflatedSize(buf: Buffer, limitBytes = 20 * 1024 * 1024): Promise<boolean> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return false;
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (entries.length > XLSX_MAX_ENTRIES) return false;

  let total = 0;
  for (const entry of entries) {
    const ok = await new Promise<boolean>((resolve) => {
      let settled = false;
      const stream = (entry as JSZipObjectWithInternalStream).internalStream('uint8array');
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      stream
        .on('data', (chunk: Uint8Array) => {
          if (settled) return;
          total += chunk.length;
          if (total > limitBytes) {
            stream.pause();
            finish(false);
          }
        })
        .on('error', () => finish(false))
        .on('end', () => finish(true))
        .resume();
    });
    if (!ok) return false;
  }

  return true;
}

function readSheet(
  wb: ExcelJS.Workbook,
  name: string,
): { header: CellValue[]; rows: CellValue[][] } | { error: 'too_many_rows' | 'too_many_cols' } {
  const bounded = readBoundedSheet(wb.getWorksheet(name), DAILY_IMPORT_MAX_ROWS);
  if (!bounded.ok) return { error: bounded.error };
  // Dựng lại mảng CellValue[][] đúng vị trí (rowNo - 2) để rowNo suy từ index (dùng ở lib/daily-import.ts)
  // vẫn đúng dù `eachRow` bỏ qua dòng trắng - mảng bị chặn bởi maxRows nên an toàn bộ nhớ.
  const rows: CellValue[][] = [];
  for (const r of bounded.rows) rows[r.rowNo - 2] = r.cells;
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return { header: bounded.header, rows };
}

/** Đọc buffer .xlsx; thiếu sheet nào thì sheet đó coi như rỗng. */
export async function readDailyWorkbook(
  buf: Buffer,
): Promise<
  | { ok: true; manpower: { header: CellValue[]; rows: CellValue[][] }; equipment: { header: CellValue[]; rows: CellValue[][] } }
  | { ok: false; error: 'bad_file' | 'too_many_rows' }
> {
  if (!(await assertXlsxInflatedSize(buf))) return { ok: false, error: 'bad_file' };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: 'bad_file' };
  }

  const manpower = readSheet(wb, SHEET_MANPOWER);
  if ('error' in manpower) return { ok: false, error: manpower.error === 'too_many_rows' ? 'too_many_rows' : 'bad_file' };
  const equipment = readSheet(wb, SHEET_EQUIPMENT);
  if ('error' in equipment) return { ok: false, error: equipment.error === 'too_many_rows' ? 'too_many_rows' : 'bad_file' };

  return { ok: true, manpower, equipment };
}

const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } } as const;
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1F3D' } } as const;

const HUONG_DAN_LINES = [
  '1 file = 1 dự án (chọn đúng dự án đang xem trên màn hình trước khi tải file này).',
  '1 dòng = 1 ngày × 1 nhà thầu.',
  'Tên nhà thầu / ca / thiết bị chép nguyên văn từ sheet DanhMuc.',
  'Ô trống = 0.',
  'Tổng ngày do app tự cộng - không cần nhập.',
  'Sửa số của ngày cũ (trước hôm nay) cần nhập lý do ngay trên màn hình sau khi import.',
];

/** Sinh file mẫu: sheet NhanLuc (header), ThietBi (header), DanhMuc, HuongDan. */
export async function buildDailyTemplate(input: {
  members: Contractor[];
  shifts: Shift[];
  equipments: Equipment[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const mpWs = wb.addWorksheet(SHEET_MANPOWER);
  mpWs.addRow(manpowerHeaders(input.shifts));

  const eqWs = wb.addWorksheet(SHEET_EQUIPMENT);
  eqWs.addRow([...EQUIPMENT_HEADERS]);

  for (const sheet of [mpWs, eqWs]) {
    sheet.getRow(1).font = { ...HEADER_FONT };
    sheet.getRow(1).fill = { ...HEADER_FILL };
    sheet.getColumn(1).width = 14;
    sheet.getColumn(1).numFmt = 'dd/mm/yyyy';
    sheet.getColumn(2).width = 26;
  }

  const dmWs = wb.addWorksheet('DanhMuc');
  dmWs.addRow(['Nhà thầu', 'Ca', 'Thiết bị']);
  dmWs.getRow(1).font = { ...HEADER_FONT };
  dmWs.getRow(1).fill = { ...HEADER_FILL };
  const maxLen = Math.max(input.members.length, input.shifts.length, input.equipments.length);
  for (let i = 0; i < maxLen; i++) {
    dmWs.addRow([
      input.members[i] ? safeCell(input.members[i].name) : '',
      input.shifts[i] ? safeCell(input.shifts[i].nameVi) : '',
      input.equipments[i] ? safeCell(input.equipments[i].name) : '',
    ]);
  }
  dmWs.columns.forEach((c) => { c.width = 26; });

  const hdWs = wb.addWorksheet('HuongDan');
  HUONG_DAN_LINES.forEach((l) => hdWs.addRow([l]));
  hdWs.getColumn(1).width = 90;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
