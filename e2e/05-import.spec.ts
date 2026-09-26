import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

const OUT_DIR = join(process.cwd(), 'test-results');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

test.describe('05 - Import Excel nhan luc/thiet bi ngay (pm, du an 1)', () => {
  test.use({ storageState: 'e2e/.auth/pm.json' });

  test('tai file mau, dien 1 dong hop le, xem truoc va ghi', async ({ page }) => {
    await page.goto('/vi/nhap-lieu?project=1');
    await page.getByRole('button', { name: vi('dailyEntry.step') }).click();
    await expect(page.getByText(vi('dailyImport.title'))).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: vi('dailyImport.template') }).click(),
    ]);
    const templatePath = join(OUT_DIR, 'e2e-daily-template.xlsx');
    await download.saveAs(templatePath);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const dm = wb.getWorksheet('DanhMuc')!;
    const contractorName = String(dm.getRow(2).getCell(1).value ?? '').trim();
    expect(contractorName).not.toBe('');

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const mp = wb.getWorksheet('NhanLuc')!;
    // Header: Ngay | Nha thau | KH <ca1> | TT <ca1> | KH <ca2> | TT <ca2> ... - so cot bien theo so ca.
    const colCount = mp.getRow(1).cellCount;
    const row: Array<string | number> = [today, contractorName];
    for (let i = 2; i < colCount; i++) row.push(1);
    mp.spliceRows(2, 0, row);

    const filledPath = join(OUT_DIR, 'e2e-daily-filled.xlsx');
    await wb.xlsx.writeFile(filledPath);

    await page.setInputFiles('input[type="file"][accept=".xlsx"]', filledPath);
    await page.getByRole('button', { name: vi('dailyImport.preview') }).click();

    await expect(page.getByText(vi('dailyImport.summary', { ok: 1, invalid: 0 }))).toBeVisible();

    await page.getByRole('button', { name: /^Ghi/, exact: false }).click();
    // 'Da ghi {days} ngay (...)' - chi kiem phan tinh dau cau (khong doan chinh xac created/updated
    // vi du lieu hom nay co the da ton tai tu seed/test truoc, khien day la "sua" thay vi "moi").
    const doneStaticPrefix = vi('dailyImport.done').split('{')[0].trim();
    await expect(page.locator('.chip.c-ok', { hasText: doneStaticPrefix })).toBeVisible();
  });
});

test.describe('05b - Trang /import (admin) - file rac khong lam vo trang', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('tai trang OK, upload 1 file .txt khong lam vo trang', async ({ page }) => {
    await page.goto('/vi/import');
    // Input that trong <label> (className="hidden") - kiem co mat (attached), khong kiem visible.
    const fileInput = page.locator('input[type="file"][accept=".xlsx,.csv"]');
    await expect(fileInput).toBeAttached();

    const badPath = join(OUT_DIR, 'e2e-bad.txt');
    await import('node:fs').then((fs) => fs.writeFileSync(badPath, 'khong phai excel'));
    await fileInput.setInputFiles(badPath);

    // Trang khong duoc vo (van con nut upload, khong nhay ve trang loi).
    await expect(fileInput).toBeAttached();
    await expect(page.getByText('Application error')).toHaveCount(0);
  });
});
