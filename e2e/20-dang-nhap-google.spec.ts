import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * D1 (P3E) - dang nhap Google theo danh sach admin them. Khong co tai khoan Google that trong CI
 * nen chi kiem duoc 2 phan khong can OAuth that: (1) trang /login hien loi khi Google tu choi
 * (callback signIn tra false -> next-auth redirect ve pages.error voi ?error=AccessDenied);
 * (2) tai khoan chi Google (khong mat khau) khong dang nhap duoc bang Credentials.
 */
test.describe('20 - dang nhap Google (tu choi + tai khoan chi Google)', () => {
  test('mo /login?error=AccessDenied -> o lai dung URL, thay thong bao googleDenied', async ({ page }) => {
    await page.goto('/vi/login?error=AccessDenied');
    await page.waitForURL('**/vi/login?error=AccessDenied');
    expect(page.url()).toContain('/vi/login?error=AccessDenied');
    await expect(page.getByText(vi('authSecurity.googleDenied'))).toBeVisible();
  });

  test('admin them tai khoan Google (khong mat khau); dang nhap bang mat khau bat ky -> invalidCredentials', async ({ browser }) => {
    const email = `e2e-google-${Date.now()}@gmail.com`;

    const adminCtx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto('/vi/admin');
    const card = adminPage.locator('.card', { hasText: vi('admin.userRoles') }).first();
    await card.locator('.field', { hasText: vi('admin.email') }).locator('input').fill(email);
    await card.locator('.field', { hasText: vi('admin.name') }).locator('input').fill('E2E Google');
    await card.getByRole('button', { name: vi('common.add') }).click();
    await expect(card.getByText(email)).toBeVisible();
    await adminCtx.close();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await fillLogin(page, email, 'mat-khau-bat-ky-123');
    await expect(page.getByText(vi('auth.invalidCredentials'))).toBeVisible();
    await ctx.close();
  });
});
