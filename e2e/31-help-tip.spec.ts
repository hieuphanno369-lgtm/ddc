import { test, expect } from '@playwright/test';

/**
 * P4 (E3): icon "?" mo bang BAM (dien thoai khong co hover, iOS Safari bam khong focus nut).
 * Chay o 390px co cam ung: tap "?" -> bong bong hien + aria-expanded=true; tap ra ngoai -> an.
 * Dung trang Ho so du an vi hien tai chi noi do co "?" (KpiCard co "?" o Task C2).
 */
test.use({ storageState: 'e2e/.auth/admin.json', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe('31 - HelpTip mo bang bam (390px)', () => {
  test('tap "?" hien bong bong, tap ra ngoai thi an', async ({ page }) => {
    await page.goto('/vi/ho-so-du-an?project=1');

    const help = page.locator('.help').first();
    await help.scrollIntoViewIfNeeded();
    const bub = help.locator('.bub');
    await expect(help).toHaveAttribute('aria-expanded', 'false');

    await help.tap();
    await expect(help).toHaveAttribute('aria-expanded', 'true');
    await expect(bub).toBeVisible();

    // Bong bong nam gon trong khung nhin 390px (khong tran ngang).
    const box = await bub.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);

    // Tap ra ngoai (vung trong o goc tren cung cua trang) -> dong.
    await page.touchscreen.tap(2, 2);
    await expect(help).toHaveAttribute('aria-expanded', 'false');
    await expect(bub).toBeHidden();
  });

  test('tap lai chinh "?" thi dong; Escape cung dong', async ({ page }) => {
    await page.goto('/vi/ho-so-du-an?project=1');
    const help = page.locator('.help').first();
    await help.scrollIntoViewIfNeeded();
    const bub = help.locator('.bub');

    await help.tap();
    await expect(bub).toBeVisible();
    await help.tap();
    await expect(help).toHaveAttribute('aria-expanded', 'false');

    await help.tap();
    await expect(help).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(help).toHaveAttribute('aria-expanded', 'false');
    await expect(bub).toBeHidden();
  });
});
