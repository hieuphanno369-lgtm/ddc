import { test, expect } from '@playwright/test';
import { need, loadE2eEnv } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

Object.assign(process.env, loadE2eEnv());

test.describe('01 - dang nhap / dang xuat / chan truy cap chua dang nhap', () => {
  test('sai mat khau -> thay thong bao loi', async ({ page }) => {
    await fillLogin(page, need('E2E_ADMIN_EMAIL'), 'mat-khau-sai-e2e');
    await expect(page.getByText(vi('auth.invalidCredentials'))).toBeVisible();
  });

  test('admin dang nhap dung -> ve /vi/overview', async ({ page }) => {
    await fillLogin(page, need('E2E_ADMIN_EMAIL'), need('E2E_ADMIN_PASSWORD'));
    await page.waitForURL('**/vi/overview**');
    expect(page.url()).toContain('/vi/overview');
  });

  test('pm dang nhap dung -> ve /vi/nhap-lieu', async ({ page }) => {
    await fillLogin(page, need('E2E_PM_EMAIL'), need('E2E_PM_PASSWORD'));
    await page.waitForURL('**/vi/nhap-lieu**');
    expect(page.url()).toContain('/vi/nhap-lieu');
  });

  test('dang xuat qua menu Cai dat -> ve /login', async ({ page }) => {
    await fillLogin(page, need('E2E_ADMIN_EMAIL'), need('E2E_ADMIN_PASSWORD'));
    await page.waitForURL('**/vi/overview**');

    await page.getByTitle(vi('settings.title')).click();
    await page.getByRole('menuitem', { name: vi('nav.logout') }).click();
    await page.waitForURL('**/login**');
  });

  test('chua dang nhap mo /vi/admin -> bi dua ve /login', async ({ page }) => {
    await page.goto('/vi/admin');
    await page.waitForURL('**/login**');
  });
});
