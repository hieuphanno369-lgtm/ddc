import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

/**
 * P4 (C1): bo loc ky ngay-ngay thay o chon thang, dong tom tat ky, chip ten chieu loc, chip "Tu bieu do".
 * Anh chup o .bangiao/anh-p4 de soi pixel (1440 va 390, sang va toi).
 */
test.use({ storageState: 'e2e/.auth/admin.json' });

const SHOTS = '.bangiao/anh-p4';

test.describe('32 - Bo loc ky Tong quan', () => {
  test('from/to tren URL -> dong tom tat ghi thang tron va ngay mot', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-07-15&to=2026-08-20');
    const summary = page.getByTestId('period-summary');
    await expect(summary).toContainText('15/07/2026');
    await expect(summary).toContainText('20/08/2026');
    await expect(summary).toContainText('07/2026 - 08/2026');
    await expect(page.locator('input[type="date"]').first()).toHaveValue('2026-07-15');
    // Khong con o chon thang / lua chon "Tat ca".
    await expect(page.locator('select option', { hasText: /^Tất cả$/ })).toHaveCount(0);
  });

  test('link cu ?month=all mo duoc, roi ve ky mac dinh 12 thang', async ({ page }) => {
    const res = await page.goto('/vi/overview?month=all');
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId('period-summary')).toBeVisible();
    await expect(page.getByTestId('period-summary')).toContainText(/^Kỳ /);
  });

  test('doi ngay Tu ngay ghi ca from va to len URL', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-07-01&to=2026-08-31');
    await page.locator('input[type="date"]').first().fill('2026-06-10');
    await expect(page).toHaveURL(/from=2026-06-10/);
    await expect(page).toHaveURL(/to=2026-08-31/);
    await expect(page.getByTestId('period-summary')).toContainText('06/2026 - 08/2026');
  });

  test('chip ten chieu loc, dem n / total, xoa tat ca giu ky', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-07-01&to=2026-08-31');
    const count = page.getByTestId('filter-count');
    await expect(count).toContainText('/');
    const before = await count.textContent();
    const statusSelect = page.locator('select[aria-label="' + vi('common.status') + '"]');
    await statusSelect.selectOption({ index: 2 });
    await expect(statusSelect.locator('option:checked')).toContainText(vi('common.status') + ':');
    await expect(count).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: new RegExp(vi('filterChip.clearAll')) }).click();
    await expect(page).toHaveURL(/from=2026-07-01/);
    await expect(page).not.toHaveURL(/status=/);
    await expect(count).toHaveText(before ?? '');
  });

  test('bam cot bieu do -> chip "Tu bieu do", bam X -> chip mat', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-01-01&to=2026-09-16');
    const bar = page.locator('.recharts-bar-rectangle').first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await bar.click({ force: true });
    const chip = page.getByTestId('chip-from-chart');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(vi('filterChip.fromChart', { value: '' }).trim().replace(/:$/, ''));
    await chip.click();
    await expect(chip).toHaveCount(0);
    await expect(page).not.toHaveURL(/groupKey=/);
  });

  test('chart chay theo ky: 3 thang, co dong Cach doc, ky 1 thang co ghi chu', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-06-01&to=2026-08-31');
    const spi = page.locator('.card', { hasText: vi('overview.spiCpiTrend') }).first();
    await expect(spi.locator('.recharts-xAxis .recharts-cartesian-axis-tick')).toHaveCount(3, { timeout: 30_000 });
    await expect(spi.getByText(vi('chartHowTo.spiCpi'))).toBeVisible();
    await expect(spi.getByText('06/2026 - 08/2026')).toBeVisible();
    await page.goto('/vi/overview?from=2026-06-01&to=2026-06-30');
    const one = page.locator('.card', { hasText: vi('overview.spiCpiTrend') }).first();
    await expect(one.getByText(vi('period.oneMonth'))).toBeVisible({ timeout: 30_000 });
  });

  test('cot "So lieu" o bang du an; link sang Chi tiet giu ky', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-07-01&to=2026-08-31');
    await expect(page.locator('table.tbl thead th', { hasText: vi('asOf.colData') })).toBeVisible();
    const firstCell = page.locator('table.tbl tbody tr').first().locator('td').nth(9);
    await expect(firstCell).toContainText(/Số tại|Dùng số tháng|Hoàn thành|Chưa có số/);
    await page.locator('table.tbl tbody tr').first().locator('a[href*="/projects/"]').first().click();
    await page.waitForURL(/\/projects\/\d+\?from=2026-07-01&to=2026-08-31/);
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      test(`anh thanh loc ${w}px ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/vi/overview?from=2026-07-15&to=2026-09-16');
        const bar = page.getByTestId('period-summary');
        await expect(bar).toBeVisible();
        await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 30_000 });
        await page.screenshot({ path: `${SHOTS}/tong-quan-${w}-${theme}.png`, fullPage: true });
      });
    }
  }
});
