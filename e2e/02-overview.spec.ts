import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('02 - Tong quan (admin)', () => {
  test('hien KPI/chart/bang du an; doi sort; bam dong -> sang chi tiet', async ({ page }) => {
    await page.goto('/vi/overview');
    await expect(page.getByText(vi('overview.title'))).toBeVisible();

    const firstKpis = page.locator('.kpis').first();
    await expect(firstKpis.locator('.kpi')).toHaveCount(6);

    const chartCount = await page.locator('.recharts-wrapper').count();
    expect(chartCount).toBeGreaterThanOrEqual(4);

    const rows = page.locator('table.tbl tbody tr');
    await expect(rows.first()).toBeVisible();
    const firstProjectLink = rows.first().locator('a[href*="/projects/"]').first();
    await expect(firstProjectLink).toBeVisible();

    // Select sap xep - chi select co option tinh "Priority" (khong dich) la select sort cua bang du an.
    const sortSelect = page.locator('select').filter({ hasText: 'Priority' });
    await sortSelect.selectOption({ label: vi('common.value') });
    await expect(page).toHaveURL(/sort=value/);

    await firstProjectLink.click();
    await page.waitForURL(/\/projects\/\d+/);
  });
});
