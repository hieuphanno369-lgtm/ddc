import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('12 - Chuoi gia tri quan ly du an (P7-C2)', () => {
  test('/vi/projects/1: tieu de the, 2 cot dung 4+4 giai doan dung thu tu, chan the Sigma trong so 100%', async ({ page }) => {
    await page.goto('/vi/projects/1');

    const card = page.locator('.valueChainCard');
    await expect(card.getByText(vi('detail.valueChain'))).toBeVisible();

    const cols = card.locator('.stagecol');
    await expect(cols).toHaveCount(2);

    const leftNames = await cols.nth(0).locator('.stage .nm').allTextContents();
    expect(leftNames).toEqual(['Thiết kế', 'Shop Drawing', 'Vật tư', 'Gia công']);

    const rightNames = await cols.nth(1).locator('.stage .nm').allTextContents();
    expect(rightNames).toEqual(['Vận chuyển', 'Lắp dựng', 'Nghiệm thu', 'Thanh quyết toán']);

    await expect(card.locator('.chainfoot')).toContainText('100%');
  });

  test('/vi/nhap-lieu?project=1: luoi tien do co o "Thanh quyet toan"', async ({ page }) => {
    await page.goto('/vi/nhap-lieu?project=1');

    await expect(page.getByText('Thanh quyết toán')).toBeVisible();
  });
});
