import { test, expect, type Page } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

/** The quan tri giai doan tren /admin - chon theo dung tieu de h3 (the Nhat ky hoat dong cung co chu "giai doan"). */
const stageCard = (page: Page) =>
  page.locator('.card').filter({ has: page.locator('.hd h3', { hasText: new RegExp(`^${vi('stageAdmin.title')}$`) }) });

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

  test('/vi/admin: them giai doan moi ben trai -> hien cuoi cot trai + bang trong so 0%; ngung dung -> an khoi the', async ({ page }) => {
    test.setTimeout(120_000); // dev server bien dich trang theo yeu cau: goto co luc qua 60s khi may tai nang
    const name = `E2E GĐ ${Date.now()}`;
    await page.goto('/vi/admin');
    const card = stageCard(page);
    await expect(card).toBeVisible();

    const newRow = card.locator('tbody tr').last();
    await newRow.getByLabel(vi('stageAdmin.order')).fill('5');
    await newRow.getByLabel(vi('stageAdmin.nameVi')).fill(name);
    await newRow.getByLabel(vi('stageAdmin.nameEn')).fill('E2E stage');
    await newRow.getByLabel(vi('stageAdmin.side')).selectOption('left');
    await newRow.getByRole('button', { name: vi('stageAdmin.add') }).click();

    const row = card.locator('tbody tr').filter({ has: page.locator(`input[value="${name}"]`) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(vi('stageAdmin.active'));

    await page.goto('/vi/projects/1');
    const left = page.locator('.valueChainCard .stagecol').nth(0).locator('.stage .nm');
    await expect(left.last()).toHaveText(name);

    await page.goto('/vi/ho-so-du-an?project=1');
    const weightRow = page.locator('tr', { hasText: name });
    await expect(weightRow).toBeVisible();
    await expect(weightRow.locator('input.inp').first()).toHaveValue('0');

    await page.goto('/vi/admin');
    const row2 = stageCard(page)
      .locator('tbody tr').filter({ has: page.locator(`input[value="${name}"]`) });
    await row2.getByRole('button', { name: vi('stageAdmin.deactivate') }).click();
    await expect(row2).toContainText(vi('stageAdmin.inactive'));

    await page.goto('/vi/projects/1');
    await expect(page.locator('.valueChainCard')).not.toContainText(name);
  });

  test('/vi/admin: ngung dung "Gia cong" (con du an dat trong so > 0%) -> bao in_use, khong doi trang thai', async ({ page }) => {
    await page.goto('/vi/admin');
    const card = stageCard(page);
    const row = card.locator('tbody tr').filter({ has: page.locator('input[value="Gia công"]') });
    await row.getByRole('button', { name: vi('stageAdmin.deactivate') }).click();

    await expect(card.locator('.sumbar.bad')).toContainText('dự án đang đặt trọng số');
    await expect(row).toContainText(vi('stageAdmin.active'));
  });
});
