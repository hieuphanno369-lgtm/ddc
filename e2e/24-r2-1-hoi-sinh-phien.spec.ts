import { test, expect, type Page } from '@playwright/test';
import { E2E_LOCK_PASSWORD } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * Tester (vòng sau sửa bảo mật, R2-1 Cao, `.bangiao/bao-mat.md` vòng 2) - tái hiện ĐÚNG kịch bản
 * khai thác trên endpoint THẬT của next-auth (không gọi thẳng callback `jwt` như unit test
 * `src/lib/auth-access-recheck.test.ts` đã có, mà đi qua đúng đường HTTP `GET /api/auth/csrf` +
 * `POST /api/auth/session`).
 *
 * Kịch bản: A và B cùng đăng nhập 1 tài khoản e2e riêng (2 phiên khác nhau trên cùng tài khoản -
 * mô phỏng kẻ tấn công đang giữ cookie phiên của người dùng, hoặc chính người dùng mở 2 thiết bị).
 * A tự đổi mật khẩu qua giao diện (`ChangePasswordModal`). B (cookie CŨ, từ TRƯỚC khi A đổi) tự gọi
 * `GET /api/auth/csrf` lấy `csrfToken` công khai, rồi `POST /api/auth/session` với
 * `{csrfToken, data:{}}` - đúng đường mà `bao-mat.md` ghi là đường khai thác cũ (trước khi vá R2-1,
 * đây chính là đường mà client `update()` của next-auth tự gọi).
 *
 * Kỳ vọng SAU khi vá (commit ece0d95): B KHÔNG hồi sinh - cookie B nhận lại vẫn `invalid`, mở trang
 * bảo vệ bị đẩy về `/login`; A vẫn dùng được ngay (không bị ảnh hưởng bởi việc B gọi endpoint này).
 * Vì nhánh `trigger === 'update'` trong `jwt` callback so `changedAtMs > token.pwdAt` NGAY (không
 * chờ `ACCESS_RECHECK_INTERVAL_MS`), B phải bị chặn NGAY sau khi A đổi mật khẩu, không cần chờ 5 phút.
 */
const EMAIL = 'e2e-r21@daidung.com.vn';
const PW_1 = E2E_LOCK_PASSWORD;
const PW_2 = 'E2eR21-MoiCode-2026!';
const PW_3 = 'E2eR21-CuoiCung-2026!';

async function login(page: Page, email: string, password: string) {
  await fillLogin(page, email, password);
}

async function openChangePasswordModal(page: Page) {
  await page.getByTitle(vi('settings.title')).click();
  await page.getByRole('menuitem', { name: vi('settings.user'), exact: true }).click();
  await page.getByRole('menuitem', { name: vi('auth.changePassword'), exact: true }).click();
}

async function fillChangePassword(page: Page, current: string, next: string, confirm: string) {
  // Dùng vị trí cố định (không khớp chữ) - substring "Mật khẩu mới" nằm trong "Nhập lại mật khẩu
  // mới" đã gây lỗi locator ở Task 7 (xem thay-doi.md), giống cách spec 23 đã né.
  const modal = page.locator('.modal');
  const fields = modal.locator('.field');
  await fields.nth(0).locator('input').fill(current);
  await fields.nth(1).locator('input').fill(next);
  await fields.nth(2).locator('input').fill(confirm);
  await modal.getByRole('button', { name: vi('common.save') }).click();
}

/**
 * Tái hiện ĐÚNG 2 bước khai thác cũ trên cookie hiện có của `page`: GET csrf công khai rồi POST
 * session với `data: {}` rỗng (client không được dùng để mass-assign quyền - callback `jwt` không
 * đọc tham số `session`, chỉ đọc `token.email` từ cookie).
 */
async function tryReviveViaSessionUpdate(page: Page) {
  const csrfRes = await page.request.get('/api/auth/csrf');
  expect(csrfRes.ok()).toBe(true);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  return page.request.post('/api/auth/session', { data: { csrfToken, data: {} } });
}

test.describe('24 - R2-1: phien bi vo hieu KHONG duoc hoi sinh qua POST /api/auth/session', () => {
  test('B giu cookie cu, A doi mat khau qua giao dien -> B goi csrf+session KHONG hoi sinh duoc, van bi day ve dang nhap; A van dung duoc', async ({
    browser,
  }) => {
    const ctxA = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageA = await ctxA.newPage();
    await login(pageA, EMAIL, PW_1);
    await pageA.waitForURL('**/vi/overview**');

    const ctxB = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageB = await ctxB.newPage();
    await login(pageB, EMAIL, PW_1);
    await pageB.waitForURL('**/vi/overview**');

    // Doi chung truoc: B con dung duoc TRUOC khi A doi mat khau (khong phai test duong nhu).
    await pageB.goto('/vi/overview');
    await expect(pageB).toHaveURL(/\/vi\/overview/);

    // A tu doi mat khau qua giao dien (khong dang xuat phien A, theo S-2).
    await openChangePasswordModal(pageA);
    await fillChangePassword(pageA, PW_1, PW_2, PW_2);
    await expect(pageA.getByText(vi('authSecurity.changePasswordDone'))).toBeVisible();

    // Khai thac cu (bao-mat.md vong 2, R2-1): B (cookie TU TRUOC khi A doi) tu cap cho chinh minh
    // 1 "session update" cong khai - endpoint next-auth van tra 200 binh thuong (khong bi tat).
    const sessionRes = await tryReviveViaSessionUpdate(pageB);
    expect(sessionRes.ok()).toBe(true);

    // B PHAI van bi day ve trang dang nhap khi mo trang bao ve - KHONG hoi sinh duoc, khong can cho
    // 5 phut (nhanh trigger 'update' so pwdAt ngay, khong qua dieu kien ACCESS_RECHECK_INTERVAL_MS).
    await pageB.goto('/vi/overview');
    await expect(pageB).toHaveURL(/\/vi\/login/);

    // A (phien vua tu doi mat khau) van dung duoc ngay, khong bi anh huong boi viec B goi endpoint tren.
    await pageA.goto('/vi/overview');
    await expect(pageA).toHaveURL(/\/vi\/overview/);

    await ctxA.close();
    await ctxB.close();

    // Xac nhan da doi mat khau THAT o DB (khong chi tren UI): dang nhap moi bang mat khau MOI phai vao duoc.
    const ctxCheck = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageCheck = await ctxCheck.newPage();
    await login(pageCheck, EMAIL, PW_2);
    await pageCheck.waitForURL('**/vi/overview**');
    await ctxCheck.close();
  });

  test('B tu goi update() dinh ky NHIEU LAN TRUOC khi A doi mat khau khong lam B mien nhiem - sau khi A doi, B van bi chan ngay', async ({
    browser,
  }) => {
    // Mat khau hien tai cua tai khoan sau test truoc trong cung file nay la PW_2 (thu tu chay trong
    // 1 file .spec.ts la tuan tu - Playwright config workers:1, fullyParallel:false).
    const ctxA = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageA = await ctxA.newPage();
    await login(pageA, EMAIL, PW_2);
    await pageA.waitForURL('**/vi/overview**');

    const ctxB = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pageB = await ctxB.newPage();
    await login(pageB, EMAIL, PW_2);
    await pageB.waitForURL('**/vi/overview**');

    // B tu goi "update dinh ky" nhieu lan LIEN TIEP TRUOC khi A doi mat khau - khong duoc phep lam
    // B "mien nhiem" voi lan doi mat khau se xay ra SAU do.
    for (let i = 0; i < 3; i++) {
      const res = await tryReviveViaSessionUpdate(pageB);
      expect(res.ok()).toBe(true);
    }
    await pageB.goto('/vi/overview');
    await expect(pageB).toHaveURL(/\/vi\/overview/); // truoc khi A doi mat khau, B con hop le binh thuong

    await openChangePasswordModal(pageA);
    await fillChangePassword(pageA, PW_2, PW_3, PW_3);
    await expect(pageA.getByText(vi('authSecurity.changePasswordDone'))).toBeVisible();

    // Du B da tu "lam moi" nhieu lan TRUOC do, ngay sau khi A doi mat khau, B goi lai update() 1 lan
    // nua van KHONG hoi sinh duoc - viec goi truoc khong tao "mien dich" cho lan doi mat khau sau.
    const finalRes = await tryReviveViaSessionUpdate(pageB);
    expect(finalRes.ok()).toBe(true);
    await pageB.goto('/vi/overview');
    await expect(pageB).toHaveURL(/\/vi\/login/);

    await pageA.goto('/vi/overview');
    await expect(pageA).toHaveURL(/\/vi\/overview/);

    await ctxA.close();
    await ctxB.close();
  });
});
