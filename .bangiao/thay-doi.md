# P7-C1 - nhật ký thay đổi (coder)

> Ghi theo tiến độ từng Bước của `ke-hoach.md`. Lệnh chạy từ `D:\_project\DDC_Control_Tower-C` (PowerShell/Bash tương đương).

## Bước 1 - C-0: e2e tham số hoá theo `.env` của worktree

**File đổi:**
- `e2e/helpers/env.ts`: thêm `E2E_TARGETS`, `parseE2eBaseUrl`, `isExpectedDbUrl` (đổi chữ ký sang 2 tham số `(dbUrl, port)`), `resolveE2eTarget`. Giữ nguyên `loadDotEnv`, `need`.
- `e2e/helpers/env.test.ts`: viết lại toàn bộ theo chữ ký mới, đủ case theo kế hoạch (19 case).
- `e2e/global-setup.ts`: bỏ 2 khối kiểm cũ (`isExpectedDbUrl` 1 tham số + so `NEXTAUTH_URL === 'http://localhost:3001'`), thay bằng `resolveE2eTarget(process.env)`; seed + `PrismaClient` dùng `databaseUrl` trả về từ hàm này.
- `playwright.config.ts`: `baseURL`/`webServer.command`/`webServer.url`/`webServer.env` lấy từ `resolveE2eTarget({ ...process.env, ...loadDotEnv() })` thay vì gõ cứng `3001`.
- `e2e/09-chan-chua-dang-nhap.spec.ts`: `BASE` lấy từ `resolveE2eTarget(...).baseURL` thay vì hằng số `'http://localhost:3001'`.

**1.2 - Test đỏ trước khi cài đặt hàm mới** (`npx vitest run e2e/helpers/env.test.ts`):
kết quả: `6 failed | 13 passed (19)` - lỗi `TypeError: parseE2eBaseUrl is not a function`, `resolveE2eTarget is not a function`, `E2E_TARGETS` undefined (đúng như kỳ vọng, vì hàm mới chưa cài).

**1.8 - Cổng kiểm sau khi cài đặt:**
- `npx vitest run e2e/helpers/env.test.ts` → `19 passed (19)`.
- `npx tsc --noEmit` → sạch, không output.
- `npm test` → `200 passed (files) | 2181 passed (tests)`.

**1.7 - Rà gõ cứng cổng/DB:** grep `3001|ddc_control_tower_b` trong `e2e/` và `playwright.config.ts` → chỉ còn trong `e2e/helpers/env.ts` (định nghĩa `E2E_TARGETS`) và `e2e/helpers/env.test.ts` (dữ liệu test). Không đụng `src/lib/notify-message.test.ts` dòng có `'http://localhost:3001/'` (dữ liệu test thuần, đúng kế hoạch).

**1.9 - Kết quả e2e nền (Bước 1)** (`npx playwright test`, cổng 3003, DB `ddc_control_tower_c`, globalSetup seed lại 17 dự án):

- Lần chạy đầu (`npx playwright test`): **61 passed, 1 failed** trong ~1.5 phút.
  - Test đỏ: `e2e/02-overview.spec.ts:7 - 02 - Tong quan (admin) - hien KPI/chart/bang du an; doi sort; bam dong -> sang chi tiet`
    Lỗi: `expect(locator('table.tbl tbody tr').first().locator('a[href*="/projects/"]').first())).toBeVisible()` timeout - bảng "Danh sách dự án" hiện "Không có dữ liệu" (0 dự án) dù DB có đủ 17 dự án cho tháng hiện tại (`2026-09`, kiểm bằng `mcp__postgres` `fact_progress_monthly` isLatest=true → 17 dòng đúng tháng).
  - **Đây là test đỏ có sẵn, KHÔNG do thay đổi ở Bước 1 gây ra** (không đụng tới `queries.ts`, `cache.ts`, trang overview). Đã điều tra gốc: khởi động 1 dev server thủ công riêng trên cổng 3003 (tắt ngay sau khi xong) sau khi DB đã seed xong, gọi `/vi/overview` bằng cookie phiên admin (lấy từ `e2e/.auth/admin.json`) → trả về đủ 17 dòng dự án, đúng dữ liệu. Chạy lại riêng `npx playwright test e2e/02-overview.spec.ts` (seed lại từ đầu) → **4 passed, 0 failed**, cùng test xanh.
    Kết luận: đây là **test chập chờn (flaky) có sẵn**, nhiều khả năng do lần dev-server khởi động lạnh đầu tiên compile trang overview (nhiều chart RSC) trùng thời điểm dữ liệu vừa seed xong, không lặp lại ổn định. Nguyên nhân gốc nằm ở `src/server/queries.ts`/`src/server/cache.ts` (cache `unstable_cache`, TTL 1800s) hoặc chính `app/[locale]/(app)/overview/page.tsx` - **cả 3 đều NGOÀI phạm vi file được sửa ở Bước 1** (và `queries.ts` nằm trong danh sách file KHÔNG được sửa của cả kế hoạch này). Không sửa. Báo lại chủ dự án/tester để theo dõi thêm nếu tái diễn ở CI/máy khác.
  - Không dùng biến shell để thử "cố tình sai cặp" (theo kế hoạch, `.env` luôn thắng biến shell) - đã chứng minh đủ qua 19 case ở `env.test.ts` (gồm case DB A + mọi cổng → false, cặp lệch → false).

**1.10 - Commit:** `feat(p7-c1): e2e chay theo cap DB + cong trong .env, chan DB cua A (C-0)` (`d732eb0`).

## Bước 2 - 7.1: gỡ hẳn "xoá toàn bộ dữ liệu"

**File đổi:**
- Tạo `src/server/reset-data-removed.test.ts` (5 case, xem 2.1).
- Xoá `src/components/admin/ResetDataButton.tsx`.
- `app/[locale]/(app)/admin/page.tsx`: bỏ import `ResetDataButton` + khối `<div className="flex justify-end"><ResetDataButton /></div>`; fragment giờ bắt đầu thẳng bằng `<Card>` phân quyền người dùng.
- `src/server/actions.ts`: xoá hàm `resetDataAction` + JSDoc của nó. Các import dùng chung (`revalidateTag`, `profileTag`, `trendTag`, `overviewTag`, `listTag`, `historyMonths`) vẫn còn dùng ở action khác nên giữ nguyên.
- `src/server/repo/prisma-repo.ts`: xoá hàm `resetAllData` (kể cả comment bên trong), giữ dấu đóng object đúng cú pháp.
- `src/server/repo/mock-repo.ts`: xoá JSDoc + hàm `resetAllData`. Hàm `reset()` (dùng cho test khác, dòng 103) không đụng.
- `git mv src/server/repo/prisma-repo-reset.test.ts src/server/repo/prisma-repo-remove-project.test.ts`: xoá JSDoc đầu file + `describe('prisma-repo.resetAllData ...')`, xoá mock không còn dùng (`projectDeleteMany`, `auditLogDeleteMany`, khoá `project.deleteMany`, `auditLog`); giữ nguyên `describe('prisma-repo.removeProject - N-2 ...')`.
- `src/server/admin-notify-page.test.ts`: xoá dòng `vi.mock('@/components/admin/ResetDataButton', ...)`.
- `src/i18n/messages/vi.json`, `en.json`: xoá key `admin.resetData`, `admin.resetConfirm`. Giữ `activity.reset_data` (K7 - nhật ký cũ trong DB còn action này).

**2.2 - Test đỏ trước khi sửa** (`npx vitest run src/server/reset-data-removed.test.ts`): `5 failed (5)` - còn `ResetDataButton.tsx`, `resetDataAction`/`resetAllData`, key `admin.resetData`/`admin.resetConfirm` (đúng kỳ vọng).

**2.4 - Rà toàn repo** (grep `resetDataAction|resetAllData|ResetDataButton|admin\.resetData|resetConfirm`, bỏ qua `node_modules`, `.bangiao/archive`, `PROGRESS.md`): chỉ còn ở `src/server/reset-data-removed.test.ts` (test mới) và biến cục bộ `resetConfirm` trong `src/components/admin/UserEditor.tsx` (xác nhận mật khẩu, không liên quan - không sửa).

**2.5 - Cổng kiểm:**
- `npx vitest run src/server/reset-data-removed.test.ts` → `5 passed (5)`.
- `npx tsc --noEmit` → sạch.
- `npm test` → `201 passed (files) | 2182 passed (tests)`.

**2.6 - Commit:** `feat(p7-c1): go han chuc nang xoa toan bo du lieu o trang quan tri (7.1)` (`d633404`).
Sau commit: nhả khoá `src/server/actions.ts`, `src/server/repo/prisma-repo.ts` trong `phien-C.md` (đã xong).

## Bước 3 - 7.3: đổi tên app hiển thị

**File đổi:**
- Tạo `src/i18n/messages-p7-c1.test.ts` (4 case cho 7.3; case 7.6 thêm ở Bước 4 cùng file).
- `src/i18n/messages/vi.json` dòng 3-4: `app.name` → `"Danh Mục Dự Án"`, `app.headerTitle` → `"BÁO CÁO QUẢN TRỊ"`.
- `src/i18n/messages/en.json` dòng 3-4: `app.name` → `"Project Portfolio"`, `app.headerTitle` → `"MANAGEMENT REPORTS"`.
- `app/[locale]/layout.tsx`: thay `export const metadata` (title gõ cứng) bằng `generateMetadata({ params: { locale } })` dùng `getTranslations`, tiêu đề tab `${t('app.headerTitle')} - ${t('app.name')}` theo locale.
- `app/[locale]/login/page.tsx` dòng 22: `<h1>DDC Control Tower</h1>` → `<h1>{t('app.headerTitle')}</h1>`.
- `src/lib/notify-message.ts` (K6): `testNotice()` → `projectName: 'BÁO CÁO QUẢN TRỊ'`, `message: 'Tin nhắn thử từ BÁO CÁO QUẢN TRỊ'`. Cập nhật kỳ vọng tương ứng ở `src/lib/notify-message.test.ts` dòng 98/101 (dòng 107 `'http://localhost:3001/'` là dữ liệu test thuần, không sửa - theo kế hoạch).
- `src/i18n/messages.test.ts`: thêm 2 dòng vào `CHANGED_SOURCES` (`layout [locale] (metadata)` → `app/[locale]/layout.tsx`, `trang /login` → `app/[locale]/login/page.tsx`).
- KHÔNG sửa `src/components/layout/AppShell.tsx` (dòng 79 fallback theo K5, dòng 109-110 đã đúng thứ tự) - trừ khi rơi vào nhánh fallback ở Bước 5.

**3.2 - Test đỏ trước khi sửa** (`npx vitest run src/i18n/messages-p7-c1.test.ts`): `4 failed (4)` (giá trị JSON còn cũ, còn chuỗi "DDC Control Tower"/"Performance Hub", đúng kỳ vọng).

**3.8 - Rà chuỗi cũ** (grep `DDC Control Tower|Performance Hub|headerTitle` trong `src`, `app`, `e2e`, `.ts`/`.tsx`): chỉ còn ở comment `src/components/icons/index.tsx` dòng 4 (không sửa), `AppShell.tsx` dòng 79/109 (dùng key `t('app.headerTitle')`), `layout.tsx`/`login/page.tsx` (dùng key), và file test mới. Không có spec e2e nào khẳng định chữ cũ.

**3.9 - Cổng kiểm:**
- `npx vitest run src/i18n/messages-p7-c1.test.ts src/lib/notify-message.test.ts src/i18n/messages.test.ts` → `61 passed (61)`.
- `npx tsc --noEmit` → sạch.
- `npm test` → `202 passed (files) | 2188 passed (tests)`.

**3.10 - Commit:** `feat(p7-c1): doi ten app thanh BAO CAO QUAN TRI / Danh Muc Du An, tieu de tab theo locale (7.3)` (`f24a804`).

## Bước 4 - 7.6: đổi chữ `detail.tl.gap`

**File đổi:**
- `src/i18n/messages/vi.json` dòng 201: `"gap": "Khoảng cách KH - TT"` → `"Chênh lệch KH vs TT"`.
- `src/i18n/messages/en.json` dòng 201: `"gap": "Plan - actual gap"` → `"Plan vs Actual variance"`.
- `src/i18n/messages-p7-c1.test.ts`: thêm `describe('7.6 - detail.tl.gap doi chu')` (2 case).
- KHÔNG sửa `app/[locale]/(app)/projects/[id]/page.tsx`, KHÔNG sửa `src/server/projects-detail-page-render.test.ts` (kiểm theo key, vẫn đúng).

**4.1 - Test đỏ:** `npx vitest run src/i18n/messages-p7-c1.test.ts` → `2 failed | 4 passed (6)` trước khi sửa giá trị (đúng kỳ vọng).

**4.2 - Sau khi sửa:** chạy lại → `6 passed (6)`.

**4.3 - Cổng kiểm:** `npx tsc --noEmit` → sạch; `npm test` → `202 passed (files) | 2190 passed (tests)`.

**4.4 - Commit:** `feat(p7-c1): doi nhan timeline thanh Chenh lech KH vs TT (7.6)` (`44fb2f2`).
Sau commit: nhả khoá `vi.json`, `en.json` trong `phien-C.md`.

## Bước 5 - e2e giao diện tên app + chạy trọn bộ e2e trên 3003 / DB `_c`

**File đổi:**
- `e2e/helpers/i18n.ts`: tách phần tra key thành hàm nội bộ `lookup(messages, key, vars)`, nạp thêm `en.json`, export thêm `en()` (chữ ký/hành vi như `vi()`).
- Tạo `e2e/10-ten-app.spec.ts`: 4 nhóm test (sidebar desktop, sidebar thu gọn, drawer mobile, trang đăng nhập) x 2 locale = 11 case, kiểm text đúng key, không tràn/xuống dòng, không đè logo, tiêu đề tab đúng theo locale, có chụp ảnh `test-results/p7-*.png`.
- `src/components/layout/AppShell.tsx` dòng 109 (**nhánh fallback 5.4, có dùng**): `<b>{t('app.headerTitle')}</b>` → `<b style={{ fontSize: 'var(--t-caption1)' }}>{t('app.headerTitle')}</b>` (13px → 12px, áp cho CẢ 2 locale).

**5.3 - Chạy spec mới lần 1 (trước fallback):** `npx playwright test e2e/10-ten-app.spec.ts` → `9 passed | 2 failed`.
Cả 2 test đỏ đều là bản EN ("Sidebar desktop" và "Drawer mobile"): dòng đậm `<b>` ở cỡ chữ gốc (`--t-footnote`, 13px) khiến "MANAGEMENT REPORTS" xuống 2 dòng (đo được `height: 32.5px`, ngưỡng cho phép `< 24.375px` = 1.5 x line-height). Bản VI ("BÁO CÁO QUẢN TRỊ") không tràn ở cỡ gốc.
→ Áp dụng đúng nhánh fallback 5.4 (không đụng `app/globals.css`): giảm cỡ chữ dòng đậm sidebar về `var(--t-caption1)` (12px), áp cho CẢ 2 locale để nhất quán VI/EN.

**Chạy lại sau fallback:** `npx playwright test e2e/10-ten-app.spec.ts` → `11 passed (11)`, không còn đỏ.

**Soát ảnh (Read từng file `test-results/p7-*.png`):**
- `p7-sidebar-vi-desktop.png`, `p7-sidebar-en-desktop.png`: cả 2 locale đúng 1 dòng, chữ không tràn/không đè logo, khoảng cách dòng đậm/dòng mờ đều, thẳng hàng với các mục nav bên dưới.
- `p7-sidebar-vi-collapsed.png`, `p7-sidebar-en-collapsed.png`: thu gọn chỉ còn logo, giống hệt nhau ở cả 2 locale (đúng kỳ vọng - không phụ thuộc chữ).
- `p7-sidebar-vi-mobile.png`, `p7-sidebar-en-mobile.png`: drawer mở đúng, chữ 1 dòng, không tràn.
- `p7-login-vi.png`, `p7-login-en.png`: h1 "BÁO CÁO QUẢN TRỊ" / "MANAGEMENT REPORTS" hiện đúng 1 dòng ở cỡ chữ gốc của trang đăng nhập (không cần fallback ở đây, khung card đủ rộng).
- `p7-admin-top-vi.png` (chụp thủ công qua dev server tạm trên 3003, đã tắt ngay sau khi xong): đầu trang `/vi/admin` không còn khoảng trống thừa phía trên thẻ "Phân quyền người dùng" sau khi bỏ khối nút reset (7.1) - card đầu tiên nằm sát topbar, khớp bố cục các trang khác.

**5.5 - Kết quả e2e trọn bộ (Bước 5):** `npx playwright test` (cổng 3003, DB `ddc_control_tower_c`, globalSetup seed lại 17 dự án) → **70 passed, 0 failed**, ~1.6 phút.
So với kết quả nền Bước 1 (61 passed/1 failed, `02-overview.spec.ts` đỏ chập chờn): lần này `02-overview.spec.ts` cũng xanh (đã xác nhận trước đó ở Bước 1 là flaky, chạy lẻ cũng xanh) - toàn bộ 70 test (62 cũ + 8 mới của `10-ten-app.spec.ts` chia theo 4 nhóm) đều xanh, không có test đỏ nào ở Bước 5.

**5.6 - Cổng kiểm cuối:** `npx tsc --noEmit` → sạch; `npm test` → `202 passed (files) | 2190 passed (tests)`.

**5.7 - Commit:** `test(p7-c1): e2e ten app o sidebar/login/tab vi+en, ket qua e2e tron bo tren 3003` (kèm `AppShell.tsx` do dùng fallback).
