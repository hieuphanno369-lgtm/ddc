import { test as setup } from '@playwright/test';
import { loadE2eEnv, need } from './helpers/env';
import { vi } from './helpers/i18n';

Object.assign(process.env, loadE2eEnv());

/**
 * Task 9 (P3B) - đăng nhập sẵn 3 vai (admin/pm/viewer) 1 lần, lưu storageState để mọi spec khác
 * dùng lại (test.use({ storageState: 'e2e/.auth/<role>.json' })), không phải đăng nhập lại mỗi spec.
 * Ô mật khẩu (PasswordInput) chỉ có nhãn dạng <span> cạnh input (không phải <label for>), nên
 * KHÔNG dùng getByLabel trực tiếp được - định vị input trong ô ".field" chứa đúng chữ nhãn đó
 * (vẫn lấy chữ qua vi(), không gõ cứng tiếng Việt).
 */
const ROLES: Array<{ name: 'admin' | 'pm' | 'viewer'; emailKey: string; passwordKey: string }> = [
  { name: 'admin', emailKey: 'E2E_ADMIN_EMAIL', passwordKey: 'E2E_ADMIN_PASSWORD' },
  { name: 'pm', emailKey: 'E2E_PM_EMAIL', passwordKey: 'E2E_PM_PASSWORD' },
  { name: 'viewer', emailKey: 'E2E_VIEWER_EMAIL', passwordKey: 'E2E_VIEWER_PASSWORD' },
];

for (const role of ROLES) {
  setup(`dang nhap ${role.name}`, async ({ page }) => {
    const email = need(role.emailKey);
    const password = need(role.passwordKey);

    await page.goto('/vi/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('.field', { hasText: vi('auth.password') }).locator('input').fill(password);
    await page.getByRole('button', { name: vi('auth.signIn') }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'));

    await page.context().storageState({ path: `e2e/.auth/${role.name}.json` });
  });
}
