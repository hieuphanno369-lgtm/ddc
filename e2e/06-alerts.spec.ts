import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('06 - Canh bao (admin)', () => {
  test('dong 1 alert dang mo -> con lai N-1 dong; hanh dong qua ngan bi tu choi', async ({ page }) => {
    await page.goto('/vi/alerts');

    const rows = page.locator('table.tbl tbody tr');
    const before = await rows.count();
    test.skip(before === 0, 'Khong con alert nao dang mo de test dong (chap nhan bo qua).');

    const firstRow = rows.first();
    await firstRow.getByRole('button', { name: vi('alert.closeAlert') }).click();
    await firstRow.getByPlaceholder(vi('alertClose.action')).fill('ab');
    await firstRow.getByRole('button', { name: vi('alertClose.confirm') }).click();
    await expect(page.getByText(vi('alertClose.err.action_short'))).toBeVisible();

    await firstRow.getByPlaceholder(vi('alertClose.action')).fill('Da xu ly e2e');
    await firstRow.getByRole('button', { name: vi('alertClose.confirm') }).click();

    await expect(rows).toHaveCount(before - 1);
  });
});
