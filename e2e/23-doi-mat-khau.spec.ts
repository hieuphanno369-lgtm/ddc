import { test, expect, type Page } from '@playwright/test';
import { E2E_LOCK_PASSWORD } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * S-2 (bao-mat.md vòng sửa bảo mật 4, chủ dự án chốt 2026-09-28, thay quyết định Q2=b cũ) - tự đổi
 * mật khẩu trong Cài đặt phải bump `passwordChangedAt` (vô hiệu các phiên KHÁC) nhưng KHÔNG đăng
 * xuất phiên hiện tại. Dùng tài khoản `e2e-doimk@daidung.com.vn` (tạo sẵn ở `global-setup.ts`, mật
 * khẩu ban đầu `E2E_LOCK_PASSWORD`, được upsert lại mỗi lần chạy).
 *
 * Giới hạn đã biết (K12, kế thừa từ Task 7) - vô hiệu phiên KHÁC trễ tối đa `ACCESS_RECHECK_INTERVAL_MS`
 * (5 phút): chờ 5 phút thật trong e2e là không khả thi (chậm, dễ vượt timeout CI). Phần "trình duyệt
 * B bị đăng xuất sau khi A đổi mật khẩu" đã kiểm ở mức unit/integration có giả lập thời gian
 * (`src/lib/auth-access-recheck.test.ts`, mô tả `S-2 trigger 'update'...` + các test T-5/S8 sẵn có).
 * Ở đây, e2e chứng minh phần khả thi trong thời gian thật: (1) phiên A vừa đổi mật khẩu VẪN dùng
 * được ngay (không bị đăng xuất, không cần đăng nhập lại); (2) mật khẩu CŨ hết dùng được ngay cho
 * lượt đăng nhập MỚI (chứng minh đã đổi thật ở DB, không chỉ đổi trên UI).
 */
const EMAIL = 'e2e-doimk@daidung.com.vn';
const NEW_PW = 'E2eDoiMk-Moi-2026!';

async function login(page: Page, email: string, password: string) {
  await fillLogin(page, email, password);
}

async function openChangePasswordModal(page: Page) {
  await page.getByTitle(vi('settings.title')).click();
  await page.getByRole('menuitem', { name: vi('settings.user'), exact: true }).click();
  await page.getByRole('menuitem', { name: vi('auth.changePassword'), exact: true }).click();
}

async function fillChangePassword(page: Page, current: string, next: string, confirm: string) {
  // ChangePasswordModal.tsx co dung 3 ".field" theo thu tu co dinh: hien tai, moi, nhap lai - dung
  // vi tri (khong dung khop chu) de tranh loi substring "Mật khẩu mới" nam trong "Nhập lại mật khẩu
  // mới" (da gap o Task 7, xem thay-doi.md).
  const modal = page.locator('.modal');
  const fields = modal.locator('.field');
  await fields.nth(0).locator('input').fill(current);
  await fields.nth(1).locator('input').fill(next);
  await fields.nth(2).locator('input').fill(confirm);
  await modal.getByRole('button', { name: vi('common.save') }).click();
}

test.describe('23 - tu doi mat khau trong Cai dat (S-2)', () => {
  test('doi mat khau thanh cong -> phien hien tai van dung duoc; mat khau cu het dung duoc cho lan dang nhap moi', async ({ browser }) => {
    test.setTimeout(120_000); // 3 lan dang nhap + 1 lan doi mat khau (bcrypt): 60s mac dinh khong du khi may e2e dang tai nang
    const ctxA =await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageA = await ctxA.newPage();
    await login(pageA, EMAIL, E2E_LOCK_PASSWORD);
    await pageA.waitForURL('**/vi/overview**');

    await openChangePasswordModal(pageA);
    await fillChangePassword(pageA, E2E_LOCK_PASSWORD, NEW_PW, NEW_PW);
    await expect(pageA.getByText(vi('authSecurity.changePasswordDone'))).toBeVisible();

    // Phien A (vua doi mat khau) van dung duoc NGAY, khong bi day ve /login.
    await pageA.goto('/vi/overview');
    await expect(pageA).toHaveURL(/\/vi\/overview/);
    await ctxA.close();

    // Mat khau CU khong con dang nhap duoc (da doi thuc su o DB, khong chi tren UI).
    const ctxOld = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageOld = await ctxOld.newPage();
    await login(pageOld, EMAIL, E2E_LOCK_PASSWORD);
    await expect(pageOld.getByText(vi('auth.invalidCredentials'))).toBeVisible();
    await ctxOld.close();

    // Mat khau MOI dang nhap duoc.
    const ctxNew = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageNew = await ctxNew.newPage();
    await login(pageNew, EMAIL, NEW_PW);
    await pageNew.waitForURL('**/vi/overview**');
    await ctxNew.close();
  });
});
