import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Vòng 3 (tester, độc lập với coder): xác minh lại H-1b bằng payload KHÁC hẳn test của coder
 * (`daily-import.test.ts`, `actions-import.test.ts`) — coder dùng `xl/styles.xml` và
 * `/xl/worksheets/sheet1.xml`. Ở đây dùng `docProps/core.xml`, `xl/media/image1.png`,
 * `[Content_Types].xml`, tên lạ `abc/def.bin`, tên `/` đầu khác, biên đúng 200/201 entry,
 * và một file .xlsx thật hợp lệ có vài entry phụ (styles/theme/docProps) vẫn phải qua.
 * Kiểm cả 2 đường: `readDailyWorkbook` (đọc trực tiếp) và `importExcelAction` (server action).
 */

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { importExcelAction } from '@/server/actions';
import { assertXlsxInflatedSize, buildDailyTemplate, readDailyWorkbook, XLSX_MAX_ENTRIES } from '@/server/daily-import';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

function fdFor(buf: Buffer, name = 'evil.xlsx'): FormData {
  const fd = new FormData();
  fd.set('file', new File([buf], name));
  return fd;
}

async function minimalWorkbookBuf(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Sheet1');
  return Buffer.from(await wb.xlsx.writeBuffer());
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('H-1b (xac minh doc lap vong 3) - payload khac test cua coder', () => {
  it('docProps/core.xml phinh to -> assertXlsxInflatedSize false, readDailyWorkbook bad_file, < 2s', async () => {
    const tpl = await minimalWorkbookBuf();
    const zip = await JSZip.loadAsync(tpl);
    zip.file('docProps/core.xml', 'C'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    expect(buf.length).toBeLessThan(1024 * 1024);

    expect(await assertXlsxInflatedSize(buf)).toBe(false);

    const start = Date.now();
    const res = await readDailyWorkbook(buf);
    const elapsed = Date.now() - start;
    expect(res).toEqual({ ok: false, error: 'bad_file' });
    expect(elapsed).toBeLessThan(2000);
  });

  it('xl/media/image1.png phinh to -> assertXlsxInflatedSize false, importExcelAction Invalid file, < 2s', async () => {
    login(ADMIN);
    const tpl = await minimalWorkbookBuf();
    const zip = await JSZip.loadAsync(tpl);
    zip.file('xl/media/image1.png', 'P'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const start = Date.now();
    const res = (await importExcelAction(fdFor(buf))) as { ok: boolean; error?: string };
    const elapsed = Date.now() - start;

    expect(res).toEqual({ ok: false, error: 'Invalid file' });
    expect(elapsed).toBeLessThan(2000);
  });

  it('[Content_Types].xml phinh to -> assertXlsxInflatedSize false (< 2s)', async () => {
    const tpl = await minimalWorkbookBuf();
    const zip = await JSZip.loadAsync(tpl);
    zip.file('[Content_Types].xml', 'T'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const start = Date.now();
    const ok = await assertXlsxInflatedSize(buf);
    const elapsed = Date.now() - start;
    expect(ok).toBe(false);
    expect(elapsed).toBeLessThan(2000);
  });

  it('entry ten la abc/def.bin (khong giong ten file xlsx that) phinh to -> false', async () => {
    const zip = new JSZip();
    zip.file('abc/def.bin', 'B'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    expect(await assertXlsxInflatedSize(buf)).toBe(false);
  });

  it('ten co "/" dau (khac entry coder da thu, dung docProps) van bi do -> false', async () => {
    const zip = new JSZip();
    zip.file('/docProps/app.xml', 'D'.repeat(30 * 1024 * 1024), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    expect(await assertXlsxInflatedSize(buf)).toBe(false);
  });

  it('nhieu entry nho cong don vuot tran (10 entry x 8KB, tran 64KB) -> false; doi chung 7 entry x 8KB (=56KB) -> true', async () => {
    const zipOver = new JSZip();
    for (let i = 0; i < 10; i++) zipOver.file(`extra/part${i}.dat`, 'E'.repeat(8 * 1024), { compression: 'DEFLATE' });
    const bufOver = await zipOver.generateAsync({ type: 'nodebuffer' });
    expect(await assertXlsxInflatedSize(bufOver, 64 * 1024)).toBe(false);

    const zipUnder = new JSZip();
    for (let i = 0; i < 7; i++) zipUnder.file(`extra/part${i}.dat`, 'E'.repeat(8 * 1024), { compression: 'DEFLATE' });
    const bufUnder = await zipUnder.generateAsync({ type: 'nodebuffer' });
    expect(await assertXlsxInflatedSize(bufUnder, 64 * 1024)).toBe(true);
  });

  it(`dung ${XLSX_MAX_ENTRIES} entry (bien duoi) -> true`, async () => {
    const zip = new JSZip();
    for (let i = 0; i < XLSX_MAX_ENTRIES; i++) zip.file(`ok/e${i}.txt`, 'x');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    expect(await assertXlsxInflatedSize(buf)).toBe(true);
  });

  it(`dung ${XLSX_MAX_ENTRIES + 1} entry (bien tren, vuot 1) -> false`, async () => {
    const zip = new JSZip();
    for (let i = 0; i < XLSX_MAX_ENTRIES + 1; i++) zip.file(`ok/e${i}.txt`, 'x');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    expect(await assertXlsxInflatedSize(buf)).toBe(false);
  });

  it('file .xlsx that hop le (buildDailyTemplate co styles/theme/docProps qua ExcelJS that) van qua ca 2 duong', async () => {
    login(ADMIN);
    const buf = await buildDailyTemplate({
      members: repo.getContractors(1),
      shifts: repo.getShifts(),
      equipments: repo.getEquipments(),
    });
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    // File ExcelJS xuất thật có các entry phụ ngoài worksheets/sharedStrings - đúng những gì H-1b vòng 2
    // phải đo cho đủ (styles, theme, docProps, Content_Types, rels...).
    expect(names.some((n) => n.includes('styles'))).toBe(true);
    expect(names.some((n) => n.includes('theme') || n.includes('docProps'))).toBe(true);

    expect(await assertXlsxInflatedSize(buf)).toBe(true);

    const direct = await readDailyWorkbook(buf);
    expect(direct.ok).toBe(true);

    const res = (await importExcelAction(fdFor(buf, 'hople.xlsx'))) as { ok: boolean };
    expect(res.ok).toBe(true);
  });
});
