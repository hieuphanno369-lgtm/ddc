import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('02 - Tong quan (admin)', () => {
  test('hien KPI/chart/bang du an; doi sort; bam dong -> sang chi tiet', async ({ page }) => {
    await page.goto('/vi/overview');
    await expect(page.getByText(vi('overview.title'))).toBeVisible();

    const firstKpis = page.locator('.kpis').first();
    await expect(firstKpis.locator('.kpi')).toHaveCount(6);

    // Cac chart dung dynamic({ ssr: false }) (chunk client rieng, xem OverviewChartsLazy.tsx) - o che do
    // `next dev` chunk nay bien dich khi request dau tien nen co the cham hon default expect timeout (5s).
    // Doi (khong phai gia lap "cache am") thay vi doc .count() 1 lan, tranh bao do gia khi chunk chua kip nap.
    await expect(async () => {
      const chartCount = await page.locator('.recharts-wrapper').count();
      expect(chartCount).toBeGreaterThanOrEqual(4);
    }).toPass({ timeout: 15_000 });

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

  test('KPI 2 nhom co tieu de, the doanh thu/san luong, bam "?" mo bong bong', async ({ page }) => {
    await page.goto('/vi/overview');
    await expect(page.getByText(vi('kpiGroup.now'), { exact: true })).toBeVisible();
    await expect(page.getByText(vi('kpiGroup.flow'), { exact: true })).toBeVisible();
    const flow = page.locator('.kpis').nth(1);
    await expect(flow.locator('.kpi')).toHaveCount(2);
    await expect(flow.locator('.kpi').first().locator('.lb')).toContainText(vi('kpiGroup.revenue'));
    await expect(page.locator('.kpis').first().locator('.kpi').first().locator('.lb')).toContainText(vi('kpi.totalProjects'));

    const help = page.locator('.kpis').first().locator('.help').first();
    await help.click();
    await expect(help.locator('.bub')).toBeVisible();
    await expect(help.locator('.bub')).toContainText('Số dự án có thi công trong kỳ');
  });
});
