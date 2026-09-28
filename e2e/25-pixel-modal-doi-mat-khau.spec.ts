import { test, expect, type Page } from '@playwright/test';
import { vi } from './helpers/i18n';

/**
 * Tester (vòng sau sửa bảo mật, soi pixel `ChangePasswordModal` theo yêu cầu - xem thay-doi.md mục
 * "Vòng sửa bảo mật 2", "Cho Tester nên soi kỹ" #2 và yêu cầu điều phối phiên này) - phát hiện 1 lỗi
 * giao diện THẬT, có TRƯỚC vòng sửa bảo mật này (không phải do R2-1/S-2 gây ra), không liên quan
 * logic bảo mật: `ChangePasswordModal` được `SettingsMenu.tsx` render làm CON của chính `<aside
 * class="side">` (thanh điều hướng bên trái) thay vì render ở gốc layout. `.side` có
 * `backdrop-filter` (kính mờ Apple Glass, `app/globals.css`) - theo đặc tả CSS Filter Effects,
 * `backdrop-filter != none` tạo containing block MỚI cho hậu duệ `position: fixed`, nên
 * `.modal-scrim` (`position: fixed; inset: 0`, lẽ ra phải phủ TOÀN viewport) bị nhốt gọn trong hộp
 * của `.side` (~236px, đúng bằng chiều rộng sidebar) thay vì toàn màn hình:
 * - Desktop (>=1024px): modal hiện ở góc trái dưới, đè lên menu điều hướng, KHÔNG có nền tối
 *   (scrim) phủ phần còn lại của trang, KHÔNG canh giữa màn hình như CSS `.modal-scrim` mô tả.
 * - Mobile (<1024px, drawer ĐANG MỞ khi bấm "Đổi mật khẩu" - đường duy nhất chạm được nút "Cài
 *   đặt"): modal vẫn bị nhốt cùng bề rộng ~236px như desktop, nhưng 236px chiếm >60% màn hình 390px
 *   nên trông như modal "tràn kín" - ĐÚNG là hẹp hơn spec (`.modal { max-width: 420px }` +
 *   `.modal-scrim` canh giữa), không có nền tối phủ phần nội dung phía sau.
 * - Mobile, kịch bản NẶNG hơn (đã tự tay xác nhận qua `mcp__playwright` phiên này, KHÔNG đưa vào
 *   test tự động vì cần resize viewport SAU khi mở modal - ít gặp hơn đường trên): nếu modal đang mở
 *   trong lúc `.side` đổi từ trạng thái mở (desktop/`.is-open`) sang trạng thái đóng (`.side` thêm
 *   `transform: translate3d(-100%,0,0)` khi < 1024px và không có class `.is-open`) thì `.modal-scrim`
 *   (hậu duệ của `.side`) bị kéo HẲN ra ngoài viewport (đo được `x = -236px`), modal biến mất hoàn
 *   toàn dù state React `showPw` vẫn `true`.
 * Test dưới đây RED có chủ đích: xác nhận lỗi thật, không phải lỗi test. Không sửa
 * `SettingsMenu.tsx`/`ChangePasswordModal.tsx`/`app/globals.css` (code sản phẩm) - Tester chỉ được
 * sửa file test; báo cáo lại cho reviewer/coder xử lý (gợi ý: render `ChangePasswordModal` qua
 * `createPortal(document.body)` hoặc đặt ở gốc layout ngoài `.side`, không đổi hành vi S-2/R2-1).
 */
async function openChangePasswordModal(page: Page) {
  await page.getByTitle(vi('settings.title')).click();
  await page.getByRole('menuitem', { name: vi('settings.user'), exact: true }).click();
  await page.getByRole('menuitem', { name: vi('auth.changePassword'), exact: true }).click();
}

test.describe('25 - pixel: modal Doi mat khau phai phu toan man hinh, khong bi ket trong sidebar', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('1440px: .modal-scrim phai phu toan viewport (canh giua man hinh), khong bi nhot trong sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/vi/overview');
    await openChangePasswordModal(page);

    const scrim = page.locator('.modal-scrim');
    await expect(scrim).toBeVisible();
    const box = await scrim.boundingBox();
    expect(box).not.toBeNull();
    // Ky vong: scrim phu >=90% chieu rong viewport (position:fixed; inset:0 dung dung).
    // Thuc te (bug): scrim bi containing block cua .side (backdrop-filter) nhot lai con ~236px.
    expect(box!.width).toBeGreaterThan(1440 * 0.9);
  });

  test('390px (mobile, mo qua drawer - duong duy nhat cham duoc nut Cai dat): modal van phai phu toan viewport, khong bi nhot theo be rong sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vi/overview');
    // Tren mobile, "Cai dat" nam trong drawer - phai mo drawer truoc moi cham duoc nut nay (nut
    // hamburger, chung aria-label voi nut Loc o desktop - xem AppShell.tsx, aria-label={t('common.filter')}).
    await page.getByRole('button', { name: vi('common.filter') }).first().click();
    await openChangePasswordModal(page);

    const scrim = page.locator('.modal-scrim');
    await expect(scrim).toBeVisible();
    const box = await scrim.boundingBox();
    expect(box).not.toBeNull();
    // Modal phai o trong man hinh (khong bi day am ra ngoai)...
    expect(box!.x).toBeGreaterThanOrEqual(0);
    // ...VA phai phu >=90% be rong 390px (dung nhu .modal-scrim mo ta), khong chi "tinh co" nam
    // trong man hinh vi 236px (be rong sidebar) da chiem phan lon 390px.
    expect(box!.width).toBeGreaterThan(390 * 0.9);
  });
});
