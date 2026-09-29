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

## Vòng sửa bảo mật (theo `.bangiao/bao-mat.md`)

Chủ dự án chốt: S1 theo phương án (b), S2, S3, I1 sửa hết.

### S1 (Cao): người đăng ký không tự chọn mật khẩu nữa

- **Form Đăng ký** (`src/components/auth/SignupForm.tsx`): bỏ 2 ô mật khẩu và đồng hồ độ mạnh, giữ style kính mờ còn lại.
  `submitSignupAction` không nhận `password`; `requestSignup` không băm gì nữa (thời gian phản hồi vẫn không phụ thuộc email mới hay đã có, vì phần tra DB chạy nền).
- **Migration** `20260929120000_p3f_dang_ky_bo_mat_khau`: bỏ cột `signup_request.passwordHash`. Rollback `prisma/rollback/20260929120000_p3f_dang_ky_bo_mat_khau.down.sql` (xoá đăng ký chờ vì không khôi phục được hash). Đã `prisma migrate deploy` trên DB `ddc_control_tower_c`.
- **Bật tài khoản** (`approveSignupAction` trong `src/server/actions-signup-admin.ts`):
  1. Thiếu SMTP hoặc `NEXTAUTH_URL` thì KHÔNG bật, trả `smtp_missing` (admin thấy `signup.errSmtpMissing`), đăng ký vẫn còn.
  2. Tài khoản tạo với `passwordHash` = bcrypt của 32 byte ngẫu nhiên đã vứt: không ai đăng nhập bằng mật khẩu được cho tới khi đặt qua link.
     Cố ý KHÔNG dùng hash rỗng, vì rỗng nghĩa là "chỉ Google" và bị chặn đặt lại mật khẩu (luật L5); dùng hash thật nên luồng `PasswordResetToken`, trang `/dat-lai-mat-khau` và "Quên mật khẩu" chạy nguyên, không sửa `peek/consume`.
  3. Sinh token (`generateResetToken`), lưu qua `replaceResetToken` chỉ hash, hạn `SIGNUP_INVITE_TTL_MS` = 72 giờ, dùng 1 lần; gửi link `/{locale}/dat-lai-mat-khau?token=...` tới đúng email đăng ký. Lỗi lưu token hoặc gửi mail không hoàn tác việc bật, chỉ báo `mailed: false` (`signup.approvedNoMail`, hướng người dùng dùng "Quên mật khẩu").
- **Email** (`signupMailer.compose(locale, email, link)`, key `signup.mailSubject/mailBody`): đổi thành email "đặt mật khẩu", có nhắc hạn 72 giờ và cách lấy link mới; không còn `{name}`.
- **Không có SMTP**: trang `/dang-ky` hiện thông báo `signup.smtpMissing` thay form (khuôn trang Quên mật khẩu); `submitSignupAction` trả `smtp_missing` (phòng gọi trực tiếp).
- **Link hết hạn**: người dùng dùng "Quên mật khẩu" (đã kiểm bằng test: tài khoản chưa từng đặt mật khẩu vẫn nhận được link mới vì hash là hash thật). Chưa làm nút "gửi lại link" cho admin (ngoài phạm vi chốt).
- **Dọn token** (`pruneAuthData`, cả Prisma và bộ nhớ): xoá token theo HẠN DÙNG (`expiresAt < mốc` hoặc `usedAt < mốc`) thay vì theo `createdAt`, nếu không link 72 giờ bị xoá sau 24 giờ.
- Admin thấy thêm cột "IP gửi" (`requestIp`) ở bảng Đăng ký đang chờ.
- Lớp chặn đăng nhập P3D-B/P3E, `auth.ts`, `middleware.ts`, luồng Google: không đổi.

### S2 (Thấp)
`validate` trong `src/server/signup.ts` (và form) từ chối họ tên chứa ký tự Unicode nhóm `\p{C}` (`hasInvisibleChars` trong `src/lib/signup-policy.ts`), trả `invalid name`. `{name}` đã bỏ khỏi email.

### S3 (Thấp)
`runJob` (chạy trong `runDueJobs`, job `alerts_daily`) gọi `SignupStore.pruneStale` xoá đăng ký chờ quá `SIGNUP_PENDING_MAX_AGE_MS` = 14 ngày, ghi nhật ký `signup_expire` (số dòng, chỉ khi > 0); lỗi bọc riêng, không làm hỏng job. Token lời mời hết hạn được dọn bởi `pruneAuthData` như trên.

### I1
`deleteDepartment` (Prisma) bắt `P2003` trả `{ inUse: 1 }` nên action trả `in_use`.

### File đã đổi
`prisma/schema.prisma`, migration + rollback mới, `docs/DATA_WAREHOUSE_README.md` (chạy `npm run docs:erd`), `src/lib/{login-policy,signup-policy,schema-meta/docs}.ts`, `src/server/{signup,actions-signup,actions-signup-admin,auth-mail,jobs}.ts`, `src/server/repo/{signup-types,mock-repo-signup,prisma-repo-signup,mock-repo-auth,prisma-repo-auth,types}.ts`, `src/components/auth/SignupForm.tsx`, `app/[locale]/(auth)/dang-ky/page.tsx`, `src/components/admin/SignupRequestList.tsx`, `vi.json`, `en.json` (nhóm `signup`, cuối nhóm `activity`: `signup_expire`; xoá `passwordPlaceholder`, `passwordTooLong`).
Test: `src/server/signup-moi-dat-mat-khau.test.ts` (mới, test đỏ S1), `prisma-repo-signup-p2003.test.ts` (mới), cập nhật `signup*.test.ts`, `actions-signup*.test.ts`, `auth-mail.test.ts`, `jobs.test.ts`, `signup-store-contract.ts`, `mock-repo-auth.test.ts`, `prisma-repo-auth.test.ts`, `SignupForm.test.ts`, `SignupRequestList.test.ts`, e2e 28 và 29 (tự tạo kênh email `E2E ... smtp` rồi xoá).

### Chỗ Tester nên soi kỹ
- Đăng ký X, admin bật: đăng nhập bằng mọi mật khẩu phải thất bại; chỉ link tới X đặt được mật khẩu; link dùng lại và link quá 72 giờ hỏng.
- Bật khi thiếu SMTP hoặc `NEXTAUTH_URL`: không tạo tài khoản, đăng ký còn nguyên.
- `pruneAuthData` không xoá token còn hạn (job chạy sau 24 giờ).
- Admin UI `hasPassword` của tài khoản vừa bật hiển thị "có mật khẩu" (hash ngẫu nhiên), chưa có nhãn "chưa đặt mật khẩu".
- Tài khoản bật rồi mà người dùng đăng nhập bằng Google: vẫn theo luật hiện có (Google xác minh email).
