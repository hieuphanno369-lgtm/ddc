import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/pm.json' });

const STEP_LABELS = [
  vi('form.stepProgress'),
  vi('form.stepFinance'),
  vi('form.stepProfile'),
  vi('form.stepExtras'),
  vi('dailyEntry.step'),
];

test.describe('04 - Nhap lieu (pm, du an 1)', () => {
  test('bam lan luot cac buoc wizard khong loi trang; sua 1 o so nhan luc va luu', async ({ page }) => {
    await page.goto('/vi/nhap-lieu?project=1');

    for (const label of STEP_LABELS) {
      await page.getByRole('button', { name: label }).click();
      // Moi buoc khong duoc de trang vo (van con phan sect chinh).
      await expect(page.locator('body')).not.toContainText('Application error');
    }

    await expect(page.getByText(vi('dailyEntry.manpower'))).toBeVisible();

    const firstManpowerInput = page.locator('table.tbl input[type="number"]').first();
    const before = await firstManpowerInput.inputValue();
    const next = String(Number(before || '0') + 1);
    await firstManpowerInput.fill(next);

    const saveStaticPrefix = vi('dailyEntry.save').split('{')[0].trim();
    await page.getByRole('button', { name: saveStaticPrefix, exact: false }).click();

    const savedStaticPrefix = vi('dailyEntry.saved').split('{')[0].trim();
    await expect(page.getByText(savedStaticPrefix, { exact: false })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: vi('dailyEntry.step') }).click();
    await expect(page.locator('table.tbl input[type="number"]').first()).toHaveValue(next);
  });
});
