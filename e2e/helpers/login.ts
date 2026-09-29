import type { Page } from '@playwright/test';
import { vi } from './i18n';

/** Mở trang đăng nhập và điền email + mật khẩu rồi bấm Đăng nhập (form P3F: ô có id cố định). */
export async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/vi/login');
  // Cho React hydrate xong: bam Dang nhap truoc luc do la submit goc cua trinh duyet, trang tai lai thanh /vi/login? (chap chon e2e).
  await page.waitForLoadState('networkidle');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: vi('auth.signIn') }).click();
}
