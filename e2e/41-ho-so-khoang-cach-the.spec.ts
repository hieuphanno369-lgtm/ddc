import { test, expect, type Page } from '@playwright/test';

/**
 * Lỗi giao diện chủ dự án báo 2026-10-01: ở trang Tạo / Sửa dự án, thẻ "Tạo dự án mới" và thẻ "Định danh dự án"
 * dính sát nhau (0px). Các thẻ của trang phải cách nhau 20px như các trang khác (`space-y-5`).
 * Chỉ đọc trang, không ghi gì vào DB e2e.
 */
test.use({ storageState: 'e2e/.auth/admin.json' });

async function gapBetweenCards(page: Page): Promise<number> {
  const cards = page.locator('main .card.rise');
  await expect(cards.nth(1)).toBeVisible({ timeout: 30_000 });
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  if (!a || !b) throw new Error('Khong lay duoc vi tri the');
  return Math.round(b.y - (a.y + a.height));
}

test.describe('41 - Tạo / Sửa dự án: khoảng cách giữa các thẻ', () => {
  test('chế độ Tạo mới: thẻ đầu trang cách thẻ Định danh 20px', async ({ page }) => {
    await page.goto('/vi/ho-so-du-an?mode=new');
    expect(await gapBetweenCards(page)).toBe(20);
  });

  test('chế độ Cập nhật dự án: thẻ đầu trang cách thẻ Định danh 20px', async ({ page }) => {
    await page.goto('/vi/ho-so-du-an?project=1');
    expect(await gapBetweenCards(page)).toBe(20);
  });
});
