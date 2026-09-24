import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import {
  assertXlsxInflatedSize, buildDailyTemplate, readBoundedSheet, readDailyWorkbook, SHEET_MAX_COLS,
} from '@/server/daily-import';
import { SHEET_EQUIPMENT, SHEET_MANPOWER } from '@/lib/daily-import';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { previewDailyImportAction } from '@/server/actions-entry';

/**
 * Vòng 2 (tester, độc lập với coder) - xác minh lại H-1a/H-1b/H-1c bằng các file độc hại KHÁC với
 * test của coder (daily-import.test.ts, actions-import.test.ts, actions-entry.test.ts), theo yêu
 * cầu điều phối viên (.bangiao/danh-gia.md mục CÁC MỤC PHẢI SỬA 1-3).
 */

describe('readBoundedSheet - bien so dong/cot (doc lap voi coder)', () => {
  function sheetWithRows(n: number): ExcelJS.Worksheet {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.getRow(1).getCell(1).value = 'h';
    for (let r = 2; r <= n + 1; r++) ws.getRow(r).getCell(1).value = `v${r}`;
    return ws;
  }

  it('dung bien: maxRows dong du lieu (rowCount = maxRows+1) -> ok:true, khong bi too_many_rows', () => {
    const ws = sheetWithRows(3);
    const res = readBoundedSheet(ws, 3);
    expect(res.ok).toBe(true);
  });

  it('vuot 1 dong so voi bien -> too_many_rows', () => {
    const ws = sheetWithRows(4);
    const res = readBoundedSheet(ws, 3);
    expect(res).toEqual({ ok: false, error: 'too_many_rows' });
  });

  it(`dung bien cot: dung ${SHEET_MAX_COLS} cot -> ok:true`, () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    const row = ws.getRow(1);
    for (let c = 1; c <= SHEET_MAX_COLS; c++) row.getCell(c).value = `c${c}`;
    row.commit();
    const res = readBoundedSheet(ws, 100);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.header).toHaveLength(SHEET_MAX_COLS);
  });

  it(`vuot 1 cot so voi bien (${SHEET_MAX_COLS + 1} cot) -> too_many_cols`, () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    const row = ws.getRow(1);
    for (let c = 1; c <= SHEET_MAX_COLS + 1; c++) row.getCell(c).value = `c${c}`;
    row.commit();
    const res = readBoundedSheet(ws, 100);
    expect(res).toEqual({ ok: false, error: 'too_many_cols' });
  });

  it('sheet trong (rowCount 0) -> header/rows rong, khong loi', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    const res = readBoundedSheet(ws, 10);
    expect(res).toEqual({ ok: true, header: [], rows: [] });
  });

  it('ws undefined -> header/rows rong (sheet thieu, khong crash)', () => {
    const res = readBoundedSheet(undefined, 10);
    expect(res).toEqual({ ok: true, header: [], rows: [] });
  });

  it('dong thua nhung mot dong o xa lam rowCount lon (sheet ThietBi kieu tan cong khac) -> too_many_rows, khong treo', () => {
    // Khac voi test cua coder (XFD1/A1048576 tren sheet NhanLuc): o day chi 2 dong du lieu THAT o
    // gan dau nhung co 1 o duoc ghi rat xa (dong 6000) -> ws.rowCount nhay vot, phai bi chan truoc
    // khi eachRow duyet, khong duoc phep parse het.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.getRow(1).getCell(1).value = 'h';
    ws.getRow(2).getCell(1).value = 'v1';
    ws.getRow(3).getCell(1).value = 'v2';
    ws.getRow(6000).getCell(1).value = 'xa-that-xa';

    const start = Date.now();
    const res = readBoundedSheet(ws, 5000);
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'too_many_rows' });
    expect(elapsed).toBeLessThan(500);
  });
});

describe('readDailyWorkbook - file doc hai KHAC voi bo test cua coder (H-1, doc lap)', () => {
  it('sheet ThietBi (equipment) thua nhung co o o dong 5500 -> ok:false, nhanh, khong lien quan sheet NhanLuc', async () => {
    const wb = new ExcelJS.Workbook();
    const mp = wb.addWorksheet(SHEET_MANPOWER);
    mp.getRow(1).getCell(1).value = 'Ngày'; // header sai cung khong sao - kiem tra o buoc doc bound truoc
    const eq = wb.addWorksheet(SHEET_EQUIPMENT);
    eq.getRow(1).getCell(1).value = 'Ngày';
    eq.getRow(2).getCell(1).value = 'row2';
    eq.getRow(5500).getCell(1).value = 'row-xa';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const start = Date.now();
    const res = await readDailyWorkbook(buf);
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'too_many_rows' });
    expect(elapsed).toBeLessThan(2000);
  });

  it('zip bom qua xl/sharedStrings.xml nen rat manh (30MB giai nen, file nen chi vai KB) -> bi chan TRUOC wb.xlsx.load, nhanh', async () => {
    // Dung JSZip dung tay (khong qua exceljs) de dung entry ten dung "xl/sharedStrings.xml" voi noi
    // dung nen cuc manh (1 ky tu lap lai) - dung dang tan cong zip-bomb kinh dien, khac han test cua
    // coder (1 o dai 200_000 ky tu trong 1 sheet exceljs dung).
    const zip = new JSZip();
    zip.file('xl/sharedStrings.xml', 'A'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    // File nen phai rat nho so voi 30MB giai nen - dac trung zip bomb.
    expect(buf.length).toBeLessThan(1024 * 1024);

    expect(await assertXlsxInflatedSize(buf)).toBe(false);

    const start = Date.now();
    const res = await readDailyWorkbook(buf);
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'bad_file' });
    expect(elapsed).toBeLessThan(2000);
  });

  it('file .xlsx gia (doi duoi tu file khong phai zip) -> bad_file, khong nem loi, khong treo', async () => {
    // Buffer nhi phan ngau nhien, KHONG phai cau truc zip (PK header) - mo phong nguoi dung doi
    // duoi .txt/.exe thanh .xlsx.
    const garbage = Buffer.alloc(5000);
    for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) % 256;

    const start = Date.now();
    const res = await readDailyWorkbook(garbage);
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'bad_file' });
    expect(elapsed).toBeLessThan(2000);
  });

  it('file mau buildDailyTemplate (that su hop le) -> van doc dung, khong bi cac chan H-1 lam hong', async () => {
    const members = repo.getContractors(2);
    const shifts = repo.getShifts();
    const equipments = repo.getEquipments();
    const buf = await buildDailyTemplate({ members, shifts, equipments });

    const res = await readDailyWorkbook(buf);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.manpower.rows).toEqual([]);
    expect(res.equipment.rows).toEqual([]);
  });
});

/**
 * rowNo khong bi lech khi eachRow({includeEmpty:false}) bo qua dong trang o giua (khong phai do
 * ws.addRow tuan tu nhu helper cua coder - o day ghi truc tiep tung dong, chua bao gio "cham" vao
 * dong trang o giua).
 */
describe('rowNo dung so dong Excel that ke ca khi co dong trang bi eachRow bo qua', () => {
  const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

  beforeEach(() => {
    repo.reset();
    vi.clearAllMocks();
  });

  it('dong 2 hop le, dong 3 hoan toan trang (khong tung ghi), dong 4 nha thau la -> rowNo bao dung 2 va 4 (khong co dong 3)', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const members = repo.getContractors(1);
    const shifts = repo.getShifts();
    const equipments = repo.getEquipments();
    const tpl = await buildDailyTemplate({ members, shifts, equipments });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tpl as unknown as ArrayBuffer);
    const ws = wb.getWorksheet(SHEET_MANPOWER)!;

    // Dong 2: hop le, ghi truc tiep (khong qua addRow).
    ws.getRow(2).getCell(1).value = new Date(Date.UTC(2026, 8, 16));
    ws.getRow(2).getCell(2).value = members[0].name;
    ws.getRow(2).getCell(3).value = 1;
    ws.getRow(2).getCell(4).value = 1;
    // Dong 3: KHONG DUNG DEN - de trang hoan toan, exceljs se khong tao Row object cho dong nay.
    // Dong 4: nha thau la -> invalid, rowNo phai la 4 chu khong bi tru xuong 3 vi dong 3 bi bo qua.
    ws.getRow(4).getCell(1).value = new Date(Date.UTC(2026, 8, 17));
    ws.getRow(4).getCell(2).value = 'Nha thau khong ton tai XYZ';
    ws.getRow(4).getCell(3).value = 1;
    ws.getRow(4).getCell(4).value = 1;

    const buf = await wb.xlsx.writeBuffer();
    const fd = new FormData();
    fd.set('projectId', '1');
    fd.set('file', new File([buf], 'import.xlsx'));

    const res = await previewDailyImportAction(fd);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows.map((r) => r.rowNo)).toEqual([2, 4]);
    expect(res.rows.find((r) => r.rowNo === 2)?.status).toBe('ok');
    expect(res.rows.find((r) => r.rowNo === 4)).toMatchObject({ status: 'invalid', reason: 'unknown_contractor' });
  });
});

/** Trường hợp phải thất bại (bắt buộc theo quy trình TDD của dây chuyền): input hỏng phải bị từ chối, không được coi là hợp lệ. */
describe('phai that bai: buffer rac khong duoc coi la file hop le', () => {
  it('assertXlsxInflatedSize voi buffer khong phai zip -> false (khong duoc mac dinh true)', async () => {
    const res = await assertXlsxInflatedSize(Buffer.from('day khong phai la file excel'));
    expect(res).toBe(false);
  });
});
