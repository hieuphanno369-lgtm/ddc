# Bàn giao coder - P3F Đăng nhập/Đăng ký kính mờ + icon (Task 1-7)

Nhánh `feature/p3f-dang-nhap-moi`, tách từ `main` @ `2171d61`.
Làm theo `.bangiao/ke-hoach.md` (7 task), Q1-Q6 theo phương án Đề xuất, quyết định kỹ thuật K1-K18 của planner.

## Commit

| Commit | Task |
|---|---|
| `747ae23` | Task 1: vẽ lại bộ icon nét 1.8 + icon ngành thép + đai ốc xoay `NutSpinner` |
| `1dc061a` | Task 2: icon giai đoạn trên thẻ Chuỗi giá trị + e2e soi icon |
| `1dd426a` | Task 3: khung `(auth)` kính mờ, nửa trái minh hoạ cẩu tháp + Gantt, nút VI/EN |
| `08c6084` | Task 4: form Đăng nhập, Quên mật khẩu, Đặt lại mật khẩu + e2e pixel |
| `4dbd182` | Task 5: schema Phòng ban + đăng ký chờ bật, migration `20260929023746_p3f_dang_ky_phong_ban` có rollback, `SignupStore` |
| `2520908` | Task 6: `requestSignup` + action, trang `/dang-ky`, trang `/dieu-khoan` bản nháp |
| (commit Task 7) | Task 7: quản trị duyệt đăng ký, Phòng ban, email bật tài khoản, nhắc admin + e2e 28 |

## Task 7 - chi tiết

**File mới:** `src/server/actions-signup-admin.ts` (5 action, đều `requireRoleUser(['admin'])` đầu tiên), `src/components/admin/SignupRequestList.tsx`, `src/components/admin/DepartmentEditor.tsx`, `src/components/layout/SignupReminder.tsx`, `e2e/28-dang-ky.spec.ts`, cùng test đơn vị `actions-signup-admin.test.ts`, `SignupRequestList.test.ts`, `DepartmentEditor.test.ts`.

**File sửa:** `app/[locale]/(app)/admin/page.tsx` (thẻ "Đăng ký đang chờ" đầu trang `#dang-ky-cho`, thẻ "Phòng ban" sau thẻ Khu vực/Nhà máy), `app/[locale]/(app)/layout.tsx` (admin có đăng ký chờ thì hiện dải nhắc sau `RateReminder`, vai trò khác không truy vấn), `src/server/auth-mail.ts` (`signupMailer`), `vi.json`, `en.json` (nhóm `signup`, `department`, cuối nhóm `activity`), `src/i18n/messages.test.ts`, `src/server/auth-mail.test.ts`, `src/server/admin-notify-page.test.ts`.

**Sửa giao diện phát hiện khi soi pixel (ngoài kế hoạch, theo luật pixel-perfect):**
- `src/components/admin/ActivityViewer.tsx`: ô lọc người dùng `width: auto` tràn khỏi thẻ ở màn 390 khi có email dài; thêm `maxWidth: '100%'`.
- `src/components/admin/UserEditor.tsx`: icon con mắt ở ô "Mật khẩu ban đầu" dạt ra mép cột (khung `relative` của `PasswordInput` rộng hết cột, ô chỉ `w-44`); bọc khung `w-44` bên ngoài, ô `w-full`. Kiểm bằng trình duyệt: icon nằm trong ô ở cả 1440 và 390.
- `src/components/layout/RateReminder.tsx`, `SignupReminder.tsx`: link trong dải nhắc trông như chữ thường (Tailwind preflight reset `a`); thêm `font-semibold underline underline-offset-2`.

**e2e 28:** bước 10 hiện lại phòng ban test trước khi chụp để ảnh Đăng ký có ô Phòng ban như `DangKy.dc.html`, chụp xong ẩn lại cho bước 11; phép kiểm "ô nhập tràn thẻ" bỏ qua ô nằm trong vùng cuộn ngang (bảng rộng ở màn 390 cuộn trong `.scroll` là đúng thiết kế) và in ra ô vi phạm.

## Soi pixel

Ảnh ở `.bangiao/anh-p3f/` (không commit).
Đăng ký 1440 so với `docs/design/dang-nhap-2026-09-29/DangKy.dc.html`: khớp bố cục, cỡ chữ, khoảng cách (lệch 1-2px ở khoảng cách nhãn).
Các chỗ khác mock-up đều theo quyết định đã ghi: câu phụ không nhắc chuyện duyệt (K1), thẻ "Thiết kế vừa hoàn thành" không có `[TÊN DỰ ÁN]` (K9), dầm đã đặt ẩn khi `reduced-motion` (Task 3), gợi ý nhận cả 2 đuôi email (Q2).
Ảnh fullPage 390 sáng có vệt đổi nền ở y≈845: là hiệu ứng chụp fullPage với nền `position: fixed`, cuộn thật trên trình duyệt không có.

## Cổng kiểm

- `npx tsc --noEmit`: sạch.
- `npm test`: 252 file / 2930 test xanh, 26 skip (test cần DB thật).
- `npx playwright test`: 166/166 đạt (6.8 phút, DB `_c`, cổng 3003), gồm 26, 27, 28 và mọi spec cũ; bước 11 của e2e 28 chạy thật (danh mục trống).
- `next build` với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`: qua.
- Dự án không có script lint.

## Việc để lại cho tester / security

- Đối chiếu mục "Trường hợp biên bắt buộc" cuối `ke-hoach.md`.
- `/dieu-khoan` còn chỗ `[LIÊN HỆ]` chờ chủ dự án điền (bản nháp theo quyết định 5).
