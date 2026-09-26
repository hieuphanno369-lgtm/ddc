import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('03 - Chi tiet du an (admin, du an 1)', () => {
  test('hien du KPI, cuon toi nhan luc, chuoi gia tri, gantt thiet bi, chart xu huong, what-if', async ({ page }) => {
    await page.goto('/vi/projects/1');

    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('.kpis').first().locator('.kpi')).toHaveCount(6);

    await page.locator('a[href="#res-manpower"]').click();
    await expect(page.locator('#res-manpower')).toBeInViewport();

    await expect(page.locator('.valueChainCard .stage').first()).toBeVisible();

    const gantt = page.locator('#eq-gantt');
    await expect(gantt).toBeVisible();
    const hasChart = await gantt.locator('svg.chart').count();
    const hasEmptyText = await gantt.getByText(vi('equipmentPlanGantt.noPlan')).count();
    expect(hasChart > 0 || hasEmptyText > 0).toBe(true);

    const resShift = page.locator('#res-shift');
    await expect(resShift).toBeVisible();
    const hasShiftChart = await resShift.locator('svg.chart').count();
    const hasShiftEmptyText = await page.getByText(vi('manpowerMonthChart.noData')).count();
    expect(hasShiftChart > 0 || hasShiftEmptyText > 0).toBe(true);

    await expect(page.getByText(vi('detail.sCurve12'))).toBeVisible();
    await expect(page.getByText(vi('whatif.title'))).toBeVisible();
    await expect(page.getByText(vi('metric.contractValue'))).toBeVisible();
  });
});
