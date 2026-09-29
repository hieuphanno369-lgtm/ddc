import type { Page } from '@playwright/test';
import { vi } from './i18n';

/** Mở trang đăng nhập và điền email + mật khẩu rồi bấm Đăng nhập (form P3F: ô có id cố định). */
export async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/vi/login');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: vi('auth.signIn') }).click();
}
