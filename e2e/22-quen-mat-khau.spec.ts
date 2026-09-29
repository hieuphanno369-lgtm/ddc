import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { generateResetToken } from '../src/lib/reset-token';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * D2 (P3E, Task 7) - trang quên/đặt lại mật khẩu qua email. Tài khoản `e2e-quenmk@daidung.com.vn`
 * tạo sẵn ở `global-setup.ts` (mật khẩu ban đầu `E2E_LOCK_PASSWORD`).
 */
const { databaseUrl } = resolveE2eTarget(loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

const EMAIL = 'e2e-quenmk@daidung.com.vn';
const CHANNEL_NAME = 'E2E reset smtp';
const NEW_PW = 'E2e-Moi-2026!';

async function insertToken(expiresAt: Date): Promise<string> {
  const { token, tokenHash } = generateResetToken();
  await prisma.passwordResetToken.deleteMany({ where: { email: EMAIL } });
  await prisma.passwordResetToken.create({ data: { email: EMAIL, tokenHash, expiresAt } });
  return token;
}

test.describe('22 - quen mat khau (D2)', () => {
  test('khong co kenh email nao -> trang quen mat khau hien smtpMissing', async ({ page }) => {
    await page.goto('/vi/quen-mat-khau');
    await expect(page.getByText(vi('authSecurity.smtpMissing'))).toBeVisible();
  });

  test.describe('co kenh email (Q6=a: kenh dang TAT canh bao van dung duoc cho quen mat khau)', () => {
    test.beforeAll(async () => {
      await prisma.notifyChannel.deleteMany({ where: { name: CHANNEL_NAME } });
      await prisma.notifyChannel.create({
        data: {
          kind: 'email',
          name: CHANNEL_NAME,
          isEnabled: false,
          settings: { smtpHost: 'smtp.invalid', fromAddress: 'noreply@daidung.com.vn' },
        },
      });
    });
    test.afterAll(async () => {
      await prisma.notifyChannel.deleteMany({ where: { name: CHANNEL_NAME } });
      await prisma.passwordResetToken.deleteMany({ where: { email: EMAIL } });
      await prisma.$disconnect();
    });

    test('gui yeu cau voi email co tai khoan VA email la -> ca 2 deu thay forgotSent (S3)', async ({ page }) => {
      await page.goto('/vi/quen-mat-khau');
      await page.locator('#auth-email').fill(EMAIL);
      await page.getByRole('button', { name: vi('authPage.sendResetLink') }).click();
      await expect(page.getByText(vi('authPage.sentTitle'))).toBeVisible();

      await page.goto('/vi/quen-mat-khau');
      await page.locator('#auth-email').fill(`khong-ton-tai-${Date.now()}@daidung.com.vn`);
      await page.getByRole('button', { name: vi('authPage.sendResetLink') }).click();
      await expect(page.getByText(vi('authPage.sentTitle'))).toBeVisible();
    });

    test('token tu sinh: dat mat khau moi -> resetDone; dang nhap mat khau moi -> vao app; mo lai cung link -> resetInvalid', async ({ page }) => {
      const token = await insertToken(new Date(Date.now() + 30 * 60_000));

      await page.goto(`/vi/dat-lai-mat-khau?token=${token}`);
      // Khop CHINH XAC nhan (khong dung substring): "Nhap lai mat khau moi" chua san "mat khau moi"
      // nen hasText substring se khop nham ca 2 truong.
      await page.getByLabel(vi('auth.newPassword'), { exact: true }).fill(NEW_PW);
      await page.getByLabel(vi('auth.confirmPassword'), { exact: true }).fill(NEW_PW);
      await page.getByRole('button', { name: vi('authSecurity.resetSubmit') }).click();
      await expect(page.getByText(vi('authSecurity.resetDone'))).toBeVisible();

      await fillLogin(page, EMAIL, NEW_PW);
      await page.waitForURL('**/vi/overview**');

      await page.goto(`/vi/dat-lai-mat-khau?token=${token}`);
      await expect(page.getByText(vi('authSecurity.resetInvalid'))).toBeVisible();
    });

    test('token da het han -> resetInvalid', async ({ page }) => {
      const token = await insertToken(new Date(Date.now() - 1000));
      await page.goto(`/vi/dat-lai-mat-khau?token=${token}`);
      await expect(page.getByText(vi('authSecurity.resetInvalid'))).toBeVisible();
    });

    test('mo link tu trang dang nhap: bam forgotLink -> URL /vi/quen-mat-khau', async ({ page }) => {
      await page.goto('/vi/login');
      await page.getByRole('link', { name: vi('authSecurity.forgotLink') }).click();
      await page.waitForURL('**/vi/quen-mat-khau');
    });
  });
});
