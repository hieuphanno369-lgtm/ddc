import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as XLSX from 'xlsx';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Task 4 (P1A) - import Excel phải báo lỗi rõ từng dòng thay vì bỏ qua im lặng.
 * Mock session + cache + repo barrel (như src/server/actions-security.test.ts).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { commitImportAction, importExcelAction } from '@/server/actions';

const YM = '2026-09';
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
/** pm@daidung.com.vn là PIC dự án 1, 2, 3, 5, 7, 11 - KHÔNG phải PIC dự án 16. */
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

function excelForm(rows: Record<string, string>[], fileName = 'import.xlsx'): FormData {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fd = new FormData();
  fd.set('file', new File([bytes], fileName));
  return fd;
}

function csvForm(csv: string): FormData {
  const fd = new FormData();
  fd.set('file', new File([csv], 'import.csv', { type: 'text/csv' }));
  return fd;
}

type PreviewRow = { rowNo: number; status: string; reason: string | null; projectId: number | null };
type Result = { ok: boolean; invalid?: number; mapped?: number; preview?: PreviewRow[] };

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('importExcelAction - bao loi tung dong (khong con continue im lang)', () => {
  it('4 dong: hop le, thieu SAP, %chu, %trong -> dung status/reason/rowNo, invalid = 3', async () => {
    login(ADMIN);
    const res = (await importExcelAction(
      excelForm([
        { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Du an hop le', '% TT': '50' },
        { 'mã sap': '', 'tên dự án': 'Thieu SAP', '% TT': '20' },
        { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Pct chu', '% TT': 'abc' },
        { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Pct trong', '% TT': '' },
      ]),
    )) as Result;

    expect(res.ok).toBe(true);
    expect(res.invalid).toBe(3);
    expect(res.mapped).toBe(1);
    const rows = res.preview!;
    expect(rows.map((r) => r.rowNo)).toEqual([2, 3, 4, 5]);
    expect(rows[0]).toMatchObject({ status: 'mapped', reason: null });
    expect(rows[1]).toMatchObject({ status: 'invalid', reason: 'no_sap' });
    expect(rows[2]).toMatchObject({ status: 'invalid', reason: 'bad_pct' });
    expect(rows[3]).toMatchObject({ status: 'invalid', reason: 'no_pct' });
  });

  it('dong hoan toan trong (moi o rong) -> bo qua, khong tinh vao preview/invalid/mapped', async () => {
    login(ADMIN);
    const res = (await importExcelAction(
      excelForm([
        { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Du an hop le', '% TT': '50' },
        { 'mã sap': '', 'tên dự án': '', '% TT': '' },
      ]),
    )) as Result;

    expect(res.ok).toBe(true);
    expect(res.preview).toHaveLength(1);
    expect(res.invalid).toBe(0);
    expect(res.mapped).toBe(1);
  });

  it('data-entry: SAP cua du an khong duoc gan -> invalid/not_assigned, projectId null', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = (await importExcelAction(
      excelForm([{ 'mã sap': 'SAP-MBS-001', 'tên dự án': 'Du an nguoi khac', '% TT': '30' }]),
    )) as Result;

    expect(res.ok).toBe(true);
    expect(res.preview![0]).toMatchObject({ status: 'invalid', reason: 'not_assigned', projectId: null });
  });

  it("nợ F4 (Task 9): file .xls -> loi schema, khong con nhan .xls", async () => {
    login(ADMIN);
    const res = (await importExcelAction(
      excelForm([{ 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Du an hop le', '% TT': '50' }], 'import.xls'),
    )) as { ok: boolean; error?: string };

    expect(res).toEqual({ ok: false, error: 'Chỉ chấp nhận file .xlsx/.csv' });
  });

  it('nợ F4 (Task 9): file CSV 2 dong (header + 1 dong) -> preview dung rowNo', async () => {
    login(ADMIN);
    const csv = 'mã sap,tên dự án,% TT\nSAP-EV-BSN-001,Du an CSV,50\n';
    const res = (await importExcelAction(csvForm(csv))) as Result;

    expect(res.ok).toBe(true);
    expect(res.preview).toHaveLength(1);
    expect(res.preview![0]).toMatchObject({ rowNo: 2, status: 'mapped', reason: null });
  });
});

describe('importExcelAction - chan file doc hai (H-1c)', () => {
  it('sheet co XFD1 + A1048576 -> ok:false, khong treo, xong duoi 2s', async () => {
    login(ADMIN);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.getCell('XFD1').value = 'x';
    ws.getCell('A1048576').value = 'x';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const fd = new FormData();
    fd.set('file', new File([buf], 'evil.xlsx'));

    const start = Date.now();
    const res = (await importExcelAction(fd)) as { ok: boolean; error?: string };
    const elapsed = Date.now() - start;

    expect(res.ok).toBe(false);
    expect(elapsed).toBeLessThan(2000);
  });

  it('(H-1b vong 2) entry NGOAI regex loc ten cu (xl/styles.xml) -> ok:false, Invalid file, duoi 2s', async () => {
    login(ADMIN);
    const ExcelJS = (await import('exceljs')).default;
    const JSZip = (await import('jszip')).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1');
    const tpl = Buffer.from(await wb.xlsx.writeBuffer());
    const zip = await JSZip.loadAsync(tpl);
    zip.file('xl/styles.xml', 'A'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const fd = new FormData();
    fd.set('file', new File([buf], 'evil.xlsx'));

    const start = Date.now();
    const res = (await importExcelAction(fd)) as { ok: boolean; error?: string };
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'Invalid file' });
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('commitImportAction - failed[] cho dong khong thuoc assignment', () => {
  it('data-entry gui projectId khong duoc gan -> failed[0].reason === not_assigned', async () => {
    login(dataEntry('pm@daidung.com.vn'));

    const res = (await commitImportAction(YM, [{ projectId: 16, pctActual: 0.3 }])) as {
      ok: boolean;
      imported: number;
      failed: { projectId: number; reason: string }[];
    };

    expect(res.ok).toBe(true);
    expect(res.imported).toBe(0);
    expect(res.failed[0]).toEqual({ projectId: 16, reason: 'not_assigned' });
  });
});
