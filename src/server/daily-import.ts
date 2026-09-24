import ExcelJS from 'exceljs';
import { safeCell } from '@/lib/excel-safe';
import { EQUIPMENT_HEADERS, manpowerHeaders, SHEET_EQUIPMENT, SHEET_MANPOWER, type CellValue } from '@/lib/daily-import';
import type { Contractor, Equipment, Shift } from '@/server/repo/types';

function rowToCells(row: ExcelJS.Row, colCount: number): CellValue[] {
  const cells: CellValue[] = [];
  for (let c = 1; c <= colCount; c++) cells.push(row.getCell(c).value as CellValue);
  return cells;
}

function readSheet(wb: ExcelJS.Workbook, name: string): { header: CellValue[]; rows: CellValue[][] } {
  const ws = wb.getWorksheet(name);
  if (!ws || ws.rowCount === 0) return { header: [], rows: [] };
  const colCount = Math.max(ws.columnCount, ws.getRow(1).cellCount);
  const header = rowToCells(ws.getRow(1), colCount);
  const rows: CellValue[][] = [];
  for (let r = 2; r <= ws.rowCount; r++) rows.push(rowToCells(ws.getRow(r), colCount));
  return { header, rows };
}

/** Đọc buffer .xlsx; thiếu sheet nào thì sheet đó coi như rỗng. */
export async function readDailyWorkbook(
  buf: Buffer,
): Promise<
  | { ok: true; manpower: { header: CellValue[]; rows: CellValue[][] }; equipment: { header: CellValue[]; rows: CellValue[][] } }
  | { ok: false; error: 'bad_file' }
> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: 'bad_file' };
  }
  return { ok: true, manpower: readSheet(wb, SHEET_MANPOWER), equipment: readSheet(wb, SHEET_EQUIPMENT) };
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
