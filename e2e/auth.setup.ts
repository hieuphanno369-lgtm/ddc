import { test as setup } from '@playwright/test';
import { loadE2eEnv, need } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

Object.assign(process.env, loadE2eEnv());

/**
 * Task 9 (P3B) - đăng nhập sẵn 3 vai (admin/pm/viewer) 1 lần, lưu storageState để mọi spec khác
 * dùng lại (test.use({ storageState: 'e2e/.auth/<role>.json' })), không phải đăng nhập lại mỗi spec.
 * Form đăng nhập P3F có id cố định (#auth-email, #auth-password), dùng chung helper `fillLogin`.
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

    await fillLogin(page, email, password);
    await page.waitForURL((url) => !url.pathname.includes('/login'));

    await page.context().storageState({ path: `e2e/.auth/${role.name}.json` });
  });
}
