import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/viewer.json' });

test.describe('08 - N-3 gate so tien (viewer)', () => {
  test('Tong quan: khong co KPI backlog, cot/option Gia tri', async ({ page }) => {
    await page.goto('/vi/overview');

    await expect(page.getByText(vi('kpi.backlog'))).toHaveCount(0);
    await expect(page.getByText('Trị (tỷ VNĐ)')).toHaveCount(0);
    await expect(page.locator('th', { hasText: vi('metric.contractValue') })).toHaveCount(0);
    await expect(page.locator('option', { hasText: vi('common.value') })).toHaveCount(0);
  });

  test('Chi tiet du an: khong co HD, S-curve, What-if, tai chinh; khong lo so tien qua source', async ({ page }) => {
    await page.goto('/vi/projects/1');

    await expect(page.getByText(vi('metric.contractValue'))).toHaveCount(0);
    await expect(page.getByText(vi('detail.sCurve12'))).toHaveCount(0);
    await expect(page.getByText(vi('whatif.title'))).toHaveCount(0);
    await expect(page.getByText(vi('detail.financial'))).toHaveCount(0);

    // page.content() la HTML tho, ca payload RSC/script cho hydrate - chua nguyen catalog i18n
    // (vd "Tiền tệ & tỷ giá") du component do khong render cho viewer, gay bao gia (false positive:
    // JSON escape "& tỷ" cung khop regex). Kiem chu THAT SU hien thi cho nguoi dung qua innerText.
    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toMatch(/\d[\d.,]*\s?tỷ/);
  });

  test('export bi chan 403', async ({ page }) => {
    // page.request (khong phai fixture "request" rieng) de dung chung cookie dang nhap voi trang.
    const exportRes = await page.request.get('/api/export');
    expect(exportRes.status()).toBe(403);
    const reportExportRes = await page.request.get('/api/report/export');
    expect(reportExportRes.status()).toBe(403);
  });

  test('/vi/admin -> bi dua ve trang chu cua viewer', async ({ page }) => {
    await page.goto('/vi/admin');
    await page.waitForURL((url) => !url.pathname.includes('/admin'));
  });
});
