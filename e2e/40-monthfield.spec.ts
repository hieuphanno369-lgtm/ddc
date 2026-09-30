import { test, expect, type Page } from '@playwright/test';
import { en, vi } from './helpers/i18n';

/**
 * P4 P-2: ô thêm tháng của bảng kế hoạch nhân lực là `MonthField` mm/yyyy (không còn input[type=month] theo ngôn ngữ
 * trình duyệt): gõ được, tự chèn "/", báo lỗi theo ngôn ngữ ứng dụng (vi/en), tháng trùng báo "đã có trong bảng".
 * Chỉ thao tác trạng thái trên trang (không bấm Lưu) nên không ghi gì vào DB e2e. Ảnh ở .bangiao/anh-p4-sua.
 */
test.use({ storageState: 'e2e/.auth/admin.json' });

const SHOTS = '.bangiao/anh-p4-sua';
const field = (page: Page) => page.getByTestId('plan-new-month');

async function open(page: Page, locale: 'vi' | 'en' = 'vi') {
  await page.goto(`/${locale}/nhap-lieu?project=1&step=resources`);
  await expect(field(page)).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await field(page).scrollIntoViewIfNeeded();
}

test.describe('40 - MonthField (ô tháng mm/yyyy)', () => {
  test('hiện mm/yyyy, gõ 6 chữ số tự chèn "/", thêm tháng vào bảng rồi ô nhảy sang tháng kế', async ({ page }) => {
    await open(page);
    const f = field(page);
    await expect(f).toHaveValue(/^\d{2}\/\d{4}$/);
    await expect(f).toHaveAttribute('placeholder', vi('monthField.placeholder'));
    await f.fill('');
    await f.pressSequentially('022041');
    await expect(f).toHaveValue('02/2041');
    await f.press('Enter');
    await expect(page.getByTestId('plan-new-month-error')).toHaveCount(0);
    const btn = page.getByRole('button', { name: vi('manpowerPlan.addMonth') });
    await btn.click();
    await expect(page.getByRole('cell', { name: '02/2041', exact: true })).toBeVisible();
    await expect(f).toHaveValue('03/2041');
  });

  test('gõ sai (13/2027) báo lỗi tiếng Việt, không đổi giá trị đã áp dụng; sửa lại thì hết lỗi', async ({ page }) => {
    await open(page);
    const f = field(page);
    const before = await f.inputValue();
    await f.fill('13/2027');
    await f.press('Enter');
    const err = page.getByTestId('plan-new-month-error');
    await expect(err).toHaveText(vi('monthField.invalid'));
    await expect(f).toHaveAttribute('aria-invalid', 'true');
    // Thêm tháng khi ô đang sai: không thêm dòng, giá trị áp dụng vẫn là tháng cũ.
    await page.getByRole('button', { name: vi('manpowerPlan.addMonth') }).click();
    await expect(page.getByRole('cell', { name: '13/2027', exact: true })).toHaveCount(0);
    await f.fill(before);
    await f.press('Enter');
    await expect(err).toHaveCount(0);
  });

  test('tháng trùng dòng đã có báo "đã có trong bảng"', async ({ page }) => {
    await open(page);
    const f = field(page);
    await f.fill('');
    await f.pressSequentially('062041');
    await f.press('Enter');
    const add = page.getByRole('button', { name: vi('manpowerPlan.addMonth') });
    await add.click();
    await f.fill('06/2041');
    await f.press('Enter');
    await add.click();
    await expect(page.getByText(vi('manpowerPlan.err.duplicate'))).toBeVisible();
  });

  test('bản tiếng Anh: lỗi bằng tiếng Anh', async ({ page }) => {
    await open(page, 'en');
    const f = field(page);
    await f.fill('99/2027');
    await f.press('Enter');
    await expect(page.getByTestId('plan-new-month-error')).toHaveText(en('monthField.invalid'));
    await expect(page.getByTestId('plan-new-month-error')).not.toHaveText(vi('monthField.invalid'));
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      test(`anh o thang ${w}px ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width: w, height: h });
        await open(page);
        const bar = field(page).locator('xpath=ancestor::div[1]');
        await expect(bar).toBeVisible();
        const box = await bar.boundingBox();
        expect(box && box.x + box.width, 'thanh them thang vuot khung').toBeLessThanOrEqual(w + 1);
        await bar.screenshot({ path: `${SHOTS}/o-thang-${w}-${theme}.png` });
        // Lỗi cũng chụp để soi pixel (viền đỏ + dòng báo lỗi).
        await field(page).fill('13/2027');
        await field(page).press('Enter');
        await expect(page.getByTestId('plan-new-month-error')).toBeVisible();
        await bar.screenshot({ path: `${SHOTS}/o-thang-loi-${w}-${theme}.png` });
      });
    }
  }
});
