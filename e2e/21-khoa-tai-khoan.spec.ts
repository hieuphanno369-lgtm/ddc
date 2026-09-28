import { test, expect, type Page } from '@playwright/test';
import { E2E_LOCK_PASSWORD } from './helpers/env';
import { vi } from './helpers/i18n';

/**
 * D3 (P3E, Task 6) - khoá tài khoản sau 5 lần sai mật khẩu liên tiếp; admin mở khoá qua trang
 * quản trị. Dùng tài khoản `e2e-khoa@daidung.com.vn` (tạo sẵn ở `global-setup.ts`, mật khẩu
 * `E2E_LOCK_PASSWORD`). Gán `x-forwarded-for` giả (RFC 5737 TEST-NET-3) cho context riêng của spec
 * này để không cộng dồn vào khoá IP `'unknown'` dùng chung với các spec khác (không có reverse
 * proxy thật trong môi trường dev/e2e).
 */
const EMAIL = 'e2e-khoa@daidung.com.vn';
const FAKE_IP = '203.0.113.77';

async function fillLogin(page: Page, email: string, password: string) {
  await page.goto('/vi/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('.field', { hasText: vi('auth.password') }).locator('input').fill(password);
  await page.getByRole('button', { name: vi('auth.signIn') }).click();
}

test.describe('21 - khoa tai khoan sau 5 lan sai (D3)', () => {
  test('4 lan sai -> invalidCredentials; lan 5 -> locked; mat khau dung van locked; admin mo khoa; dang nhap lai duoc', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { 'x-forwarded-for': FAKE_IP },
    });
    const page = await ctx.newPage();

    for (let i = 0; i < 4; i++) {
      await fillLogin(page, EMAIL, 'mat-khau-sai-e2e');
      await expect(page.getByText(vi('auth.invalidCredentials'))).toBeVisible();
    }

    // Lan sai thu 5 - khoa tai khoan.
    await fillLogin(page, EMAIL, 'mat-khau-sai-e2e');
    await expect(page.getByText(vi('authSecurity.locked'))).toBeVisible();

    // Dung mat khau van bao locked (khong noi mat khau dung/sai).
    await page.goto('/vi/login');
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('.field', { hasText: vi('auth.password') }).locator('input').fill(E2E_LOCK_PASSWORD);
    await page.getByRole('button', { name: vi('auth.signIn') }).click();
    await expect(page.getByText(vi('authSecurity.locked'))).toBeVisible();

    // R4 - IP that su toi duoc dev server qua X-Forwarded-For (context nay gan header gia lap).
    const health = await page.request.get('/api/health');
    const healthJson = (await health.json()) as { clientIpResolved: boolean };
    expect(healthJson.clientIpResolved).toBe(true);

    await ctx.close();

    // Admin mo /vi/admin, thay email trong khoi "Tai khoan dang bi khoa", bam "Mo khoa".
    const adminCtx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto('/vi/admin');
    const card = adminPage.locator('.card', { hasText: vi('admin.userRoles') }).first();
    const lockedHeading = card.getByText(vi('authSecurity.lockedList', { n: 1 }), { exact: true });
    await expect(lockedHeading).toBeVisible();
    const lockedBlock = lockedHeading.locator('xpath=..');
    await expect(lockedBlock.getByText(EMAIL, { exact: true })).toBeVisible();
    await lockedBlock.getByRole('button', { name: vi('authSecurity.unlock'), exact: true }).click();
    await expect(lockedHeading).not.toBeVisible();
    await adminCtx.close();

    // Context moi dang nhap dung -> ve /vi/overview.
    const ctx2 = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page2 = await ctx2.newPage();
    await fillLogin(page2, EMAIL, E2E_LOCK_PASSWORD);
    await page2.waitForURL('**/vi/overview**');
    expect(page2.url()).toContain('/vi/overview');
    await ctx2.close();
  });
});
