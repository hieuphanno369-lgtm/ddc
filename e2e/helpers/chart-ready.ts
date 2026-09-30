import { expect, type Page } from '@playwright/test';

/**
 * Chờ chart Recharts VẼ XONG trước khi chụp ảnh (T-6/mục 3.1 của ket-qua-test.md): Recharts có animation ~1,5 giây nên chụp
 * ngay khi `.recharts-wrapper` hiện sẽ ra cột/lát donut còn trống. Cách làm theo `e2e/34-p4-bien.spec.ts`: chờ có lát/cột,
 * rồi chờ hết animation.
 */
export async function waitChartsDrawn(page: Page): Promise<void> {
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.locator('.recharts-wrapper svg *').count(), { timeout: 15_000 }).toBeGreaterThan(10);
  await page.waitForTimeout(2500);
}
