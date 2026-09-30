import { test, expect, type Page } from '@playwright/test';
import { E2E_LOCK_PASSWORD } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * D3 (P3E, Task 6) - khoá tài khoản sau 5 lần sai mật khẩu liên tiếp; admin mở khoá qua trang
 * quản trị. Dùng tài khoản `e2e-khoa@daidung.com.vn` (tạo sẵn ở `global-setup.ts`, mật khẩu
 * `E2E_LOCK_PASSWORD`). Gán `x-forwarded-for` giả (RFC 5737 TEST-NET-3) cho context riêng của spec
 * này để không cộng dồn vào khoá IP `'unknown'` dùng chung với các spec khác (không có reverse
 * proxy thật trong môi trường dev/e2e).
 */
const EMAIL = 'e2e-khoa@daidung.com.vn';
const FAKE_IP = '203.0.113.77';

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
    await fillLogin(page, EMAIL, E2E_LOCK_PASSWORD);
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

  /**
   * Tester (kiem cuoi truoc merge, soi pixel modal "Mo khoa + dat mat khau tam") - phat hien 1 loi
   * giao diem THAT, cung goc voi bug da vam o ChangePasswordModal (e2e 25): `UserEditor.tsx` render
   * ca 2 modal (`resetEmail` va `unlockTempEmail`) la con cua the `<div class="card ...">` co
   * `backdrop-filter` (Apple Glass) - tao containing block MOI cho hau due `position: fixed`, nen
   * `.modal-scrim` (`position: fixed; inset: 0`) bi "nhot" trong khung cua the `.card` thay vi phu
   * toan viewport. Dung `getBoundingClientRect` qua `boundingBox()` de do that, khong doan mo.
   */
  test('mo khoa + dat mat khau tam: modal phai phu toan viewport ca 1440 lan 390 (khong bi containing block cua .card nhot lai)', async ({ browser }) => {
    const FAKE_IP2 = '203.0.113.79';
    const ctx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { 'x-forwarded-for': FAKE_IP2 },
    });
    const page = await ctx.newPage();
    for (let i = 0; i < 4; i++) {
      await fillLogin(page, EMAIL, 'mat-khau-sai-e2e-tam');
      await expect(page.getByText(vi('auth.invalidCredentials'))).toBeVisible();
    }
    await fillLogin(page, EMAIL, 'mat-khau-sai-e2e-tam');
    await expect(page.getByText(vi('authSecurity.locked'))).toBeVisible();
    await ctx.close();

    const adminCtx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const adminPage = await adminCtx.newPage();
    await adminPage.setViewportSize({ width: 1440, height: 900 });
    await adminPage.goto('/vi/admin');
    const card = adminPage.locator('.card', { hasText: vi('admin.userRoles') }).first();
    const lockedHeading = card.getByText(vi('authSecurity.lockedList', { n: 1 }), { exact: true });
    await expect(lockedHeading).toBeVisible();
    const lockedBlock = lockedHeading.locator('xpath=..');
    await lockedBlock.getByRole('button', { name: vi('authSecurity.unlockWithTemp'), exact: true }).click();

    const scrim = adminPage.locator('.modal-scrim');
    await expect(scrim).toBeVisible();
    const box1440 = await scrim.boundingBox();
    expect(box1440).not.toBeNull();
    // Ky vong: scrim phu >=90% chieu rong viewport (position:fixed; inset:0 dung dung).
    expect(box1440!.width).toBeGreaterThan(1440 * 0.9);

    await adminPage.setViewportSize({ width: 390, height: 844 });
    const box390 = await scrim.boundingBox();
    expect(box390).not.toBeNull();
    expect(box390!.x).toBeGreaterThanOrEqual(0);
    expect(box390!.width).toBeGreaterThan(390 * 0.9);

    // Don sach: tai lai trang (dong modal), mo khoa binh thuong de khong anh huong spec khac.
    await adminPage.reload();
    const card2 = adminPage.locator('.card', { hasText: vi('admin.userRoles') }).first();
    const lockedHeading2 = card2.getByText(vi('authSecurity.lockedList', { n: 1 }), { exact: true });
    await expect(lockedHeading2).toBeVisible();
    const lockedBlock2 = lockedHeading2.locator('xpath=..');
    await lockedBlock2.getByRole('button', { name: vi('authSecurity.unlock'), exact: true }).click();
    await expect(lockedHeading2).not.toBeVisible();
    await adminCtx.close();
  });
});
