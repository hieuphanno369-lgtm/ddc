import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Vòng 2 (tester, độc lập với coder) - xác minh lại H-1 ở tầng `importExcelAction` (import
 * "tháng cũ" trên màn admin) bằng file độc hại KHÁC với `actions-import.test.ts` của coder.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { importExcelAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('importExcelAction - file doc hai khac voi bo test cua coder (H-1, doc lap)', () => {
  it('zip bom qua xl/sharedStrings.xml (30MB giai nen, file nen vai KB) -> ok:false, nhanh, khong nem loi 500', async () => {
    login(ADMIN);
    const zip = new JSZip();
    zip.file('xl/sharedStrings.xml', 'B'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const fd = new FormData();
    fd.set('file', new File([buf], 'bom.xlsx'));

    const start = Date.now();
    const res = (await importExcelAction(fd)) as { ok: boolean; error?: string };
    const elapsed = Date.now() - start;

    expect(res.ok).toBe(false);
    expect(elapsed).toBeLessThan(2000);
  });

  it('sheet thua nhung co o o dong 6000 (khac XFD1/A1048576 cua coder) -> loi qua 5000 dong, khong treo', async () => {
    login(ADMIN);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.getRow(1).getCell(1).value = 'mã sap';
    ws.getRow(2).getCell(1).value = 'SAP-EV-BSN-001';
    ws.getRow(6000).getCell(1).value = 'row-xa';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const fd = new FormData();
    fd.set('file', new File([buf], 'sparse.xlsx'));

    const start = Date.now();
    const res = (await importExcelAction(fd)) as { ok: boolean; error?: string };
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'File quá 5000 dòng hoặc quá 64 cột' });
    expect(elapsed).toBeLessThan(2000);
  });

  it('file .xlsx gia (doi duoi tu buffer nhi phan ngau nhien, khong phai zip) -> Invalid file, khong nem loi', async () => {
    login(ADMIN);
    const garbage = Buffer.alloc(4096);
    for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 53 + 7) % 256;
    const fd = new FormData();
    fd.set('file', new File([garbage], 'fake.xlsx'));

    const res = (await importExcelAction(fd)) as { ok: boolean; error?: string };
    expect(res).toEqual({ ok: false, error: 'Invalid file' });
  });

  it('file .xlsx hop le, that su xuat tu XLSX.write (khong phai file doc hai) -> van import dung, khong bi H-1 chan nham', async () => {
    login(ADMIN);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Du an that', '% TT': '75' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fd = new FormData();
    fd.set('file', new File([bytes], 'that.xlsx'));

    const res = (await importExcelAction(fd)) as { ok: boolean; mapped?: number; invalid?: number };
    expect(res.ok).toBe(true);
    expect(res.mapped).toBe(1);
    expect(res.invalid).toBe(0);
  });
});
