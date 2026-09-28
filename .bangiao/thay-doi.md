# P3E - Task 5, 6, 7, 8: bàn giao (C làm thay A)

Nhánh `feature/p3e-c-task5-8`, tách từ `9c74809` (`feature/p3e-dang-nhap`, đã gồm `main` mới nhất
với Task 1-4 và P7-C2). Không merge, không push. Ba commit chính:

- `fc00fd8` Task 5 - schema đăng nhập an toàn + xoá bảng ảnh (migration + rollback).
- `88d274f` Task 6 - D3 khoá tài khoản sau 5 lần sai, mở khoá admin + lệnh server.
- `b068ca8` Task 7 - D2 quên mật khẩu đặt lại qua email, vô hiệu phiên cũ.
- Commit này (chore) - Task 8 kiểm tổng, dọn nốt phần Task 1 bị chặn trước đó, viết hồ sơ bàn giao.

Việc "chờ điền" trong `.bangiao/ke-hoach.md` mục CÂU HỎI: tất cả Q1-Q7 đã được chủ dự án chốt
trước khi coder bắt đầu (xem đầu file kế hoạch, mục "ĐÃ QUYẾT"). Không có bước nào bị chặn vì thiếu
quyết định nghiệp vụ trong suốt Task 5-8.

---

## Task 5 - schema, migration, rollback, kho Prisma, seed

**File chính:**
- `prisma/schema.prisma`: `UserRole` thêm `failedLoginCount`, `lockedAt`, `passwordChangedAt`; model
  mới `PasswordResetToken` (`password_reset_token`), `AuthThrottle` (`auth_throttle`); xoá model
  `ProjectPhoto` + quan hệ `Project.photos`.
- `prisma/migrations/20260928080000_p3e_dang_nhap_bo_anh/migration.sql` (sinh bằng
  `prisma migrate diff --from-url <DB thật> --to-schema-datamodel prisma/schema.prisma --script` vì
  `prisma migrate dev` không chạy được trong môi trường non-interactive; đã đối chiếu SQL sinh ra
  đúng khớp mô tả trong kế hoạch: 1 DropForeignKey, 1 AlterTable thêm 3 cột, 1 DropTable, 2
  CreateTable + 4 CreateIndex + 1 AddForeignKey).
- `prisma/rollback/20260928080000_p3e_dang_nhap_bo_anh.down.sql`: xoá 2 bảng mới, xoá 3 cột, dựng
  lại `project_photos` đúng DDL gốc (copy từ migration `20260922220000_erp_model_v2` +
  `20260918071457_init`), xoá dấu vết trong `_prisma_migrations`.
- `src/server/repo/prisma-repo-auth.ts` + test mock (`prisma-repo-auth.test.ts`, 26 test) + test DB
  thật (`prisma-repo-auth-real-db.test.ts`, `describe.skipIf(!DATABASE_URL)` - tự bỏ qua khi chạy
  `npm test` bình thường): cài `AuthStore` bản Prisma đúng hợp đồng trong `types.ts`.
  `reserveThrottle`/`releaseThrottle` dùng `pg_advisory_xact_lock(hashtext(kind||':'||key))` trong
  `$transaction`; `registerFailedLogin`/`resetFailedLogin` nguyên tử qua `updateMany` có điều kiện
  `lockedAt`; `consumeResetToken` gộp điều kiện token VÀ tài khoản (qua quan hệ `user`) ngay trong
  `where` của 1 `updateMany` duy nhất (vừa nguyên tử theo K4, vừa đảm bảo L5 - token KHÔNG bị đốt khi
  tài khoản không hợp lệ, giống hệt hành vi kho bộ nhớ).
- `src/server/auth-store.ts`: `getAuthStore()` chọn `prismaAuthStore` (có `DATABASE_URL`) hoặc 1 kho
  bộ nhớ dựng trên `mock-repo`, giữ 1 lần trong `globalThis`.
- `src/server/jobs.ts`: `runJob` gọi thêm `getAuthStore().pruneAuthData(now - 24h)` sau khi chạy
  `alerts_daily`, bọc try/catch riêng (lỗi ở đây không làm hỏng job).
- `src/server/password-reset.ts` (R6): dòng `console.error` của hàng đợi nền đổi từ `e.message`
  sang `e.name`.
- `src/server/repo/types.ts`: `UserAccount` thêm `lockedAt`, thêm `AdminUserRow`, `ThrottleKind`
  thêm `'google_denied'`.
- `src/lib/schema-meta/docs.ts`, `prisma/rls.sql`, `prisma/seed.ts`: mô tả 2 bảng mới, xoá mô tả
  `project_photos`, RLS cho 2 bảng mới, seed dọn `auth_throttle`/`password_reset_token` trước
  `user_roles`, `syncSequences` thêm 2 bảng mới bớt `project_photos`. `npm run docs:erd` đã chạy lại
  `docs/DATA_WAREHOUSE_README.md`.
- Cập nhật mọi nơi tạo `UserAccount` literal (đã có `lockedAt`) - `actions.ts`, `auth.ts`,
  `data/seed/history.ts`, `mock-repo.ts`/`prisma-repo.ts`, và ~10 file test.

**Diễn tập migration + rollback (bước 5.4):** thực hiện trực tiếp trên DB `ddc_control_tower_c` (C
không có DB tạm e2e riêng như A - xem "Lệch kế hoạch" bên dưới): `migrate deploy` (forward) →
`db execute` rollback → `migrate status` xác nhận migration biến mất → `migrate deploy` lại → sạch.
Không mất dữ liệu dự án (chỉ `project_photos` - đã có 4 dòng mồ côi từ trước - bị xoá vĩnh viễn theo
đúng thiết kế "ảnh cũ không khôi phục được").

**Test DB thật (bước 5.5, chạy tay):**
```
$env:DATABASE_URL='postgresql://postgres:...@localhost:5433/ddc_control_tower_c?schema=public'
npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts
```
5/5 xanh: 30 lời gọi `reserveThrottle` song song cùng `kind:key` (limit 20) → đúng 20 id khác nhau,
10 `null`; `releaseThrottle` xoá đúng 1 dòng khi 2 dòng trùng `createdAt`; `resetFailedLogin` trả
`false` khi tài khoản đã bị khoá bởi request khác; 5 `registerFailedLogin` song song → `justLocked`
đúng ở duy nhất 1 lời gọi, trạng thái cuối cùng chắc chắn đã khoá; `consumeResetToken` trả
`{ ok: false }` khi tài khoản chuyển sang chỉ-Google dù token còn hạn, token KHÔNG bị đốt. Tự tạo +
tự dọn dữ liệu (email `test-p3e-real-db-*@daidung.com.vn`, `auth_throttle.key` tiền tố
`test-p3e-real-db-`) - đã xác nhận bằng SQL không còn sót lại sau khi chạy.

**Lệch kế hoạch:** kế hoạch (viết cho A) giả định diễn tập rollback + test DB thật chạy trên DB tạm
`ddc_control_tower_e2e_a`. C không có DB tạm riêng (chỉ có `ddc_control_tower_c`, dùng chung cho cả
dev lẫn e2e) nên mọi thao tác ở trên chạy thẳng trên `ddc_control_tower_c`, đúng theo lệnh giao việc
của điều phối cho C ("Migration ... chạy `npx prisma migrate deploy` trên DB `_c`"). Đã seed lại sau
mỗi lần thao tác, `check:read` xanh trước khi commit.

---

## Task 6 - D3: nối khoá tài khoản vào đăng nhập, trang quản trị, lệnh mở khoá

- `src/lib/auth.ts`: `authorize` (CredentialsProvider) nối vào `checkCredentials`/`AuthStore` thật
  thay vì tự đọc DB - `ip = clientIpFrom(await headers())`, `locked`/`ip_limited` ném nguyên văn qua
  `next-auth` (`res.error`), lỗi hạ tầng khác chỉ log `e.name` rồi trả `null` (G5). `signIn` Google
  dùng `getAuthStore().getAccountState()` lấy `lockedAt` thật (Task 5 mới có cột) +
  `reserveThrottle('google_denied', ...)` trước khi ghi `login_google_denied` (R7 phần 3, G4 - hạn
  chế log bị spam khi Google từ chối lặp lại cùng 1 email).
- `src/lib/login-policy.ts`: thêm `GOOGLE_DENIED_LIMIT = 5`, `GOOGLE_DENIED_WINDOW_MS =
  UNKNOWN_EMAIL_WINDOW_MS` (24h) - đúng giá trị đề xuất trong kế hoạch (K5), chủ dự án chưa yêu cầu đổi.
- `src/server/actions-account-lock.ts`: `unlockAccountAction(email, tempPassword?)` - admin, dùng
  `requireRoleUser(['admin'])`, `unlockAccount` + tuỳ chọn `setPassword(..., bumpChangedAt: true,
  ...)` khi có `tempPassword` (Q2 = phương án b: admin đặt mật khẩu tạm thì đăng xuất mọi phiên cũ).
- `src/lib/admin-user-row.ts`: `toAdminUserRow` bỏ `passwordHash`, thêm `hasPassword` (S15).
- `src/server/unlock-account-cli.ts` + `scripts/unlock-account.ts` + `npm run unlock-account -- <email>`:
  lệnh chạy trên server, dùng khi chính admin bị khoá không vào được UI.
- `src/components/admin/UserEditor.tsx`: nhận `AdminUserRow[]`; thêm khối "Tài khoản đang bị khoá"
  (nút "Mở khoá" và "Mở khoá + đặt mật khẩu tạm" mở modal); cột trạng thái ưu tiên hiện badge riêng
  khi `lockedAt` khác null (không bấm được, khác badge `isActive` cũ); cột email thêm badge "Chỉ
  Google" khi `!hasPassword`.
- `app/[locale]/(app)/admin/page.tsx`: truyền `users.map(toAdminUserRow)`.
- `src/components/layout/LoginForm.tsx`: map `res.error === 'locked'/'ip_limited'` sang thông báo
  đúng; các lỗi khác vẫn `auth.invalidCredentials`.
- `e2e/global-setup.ts` + `e2e/helpers/env.ts` (`E2E_LOCK_PASSWORD`): tạo 2 tài khoản viewer
  `e2e-khoa@daidung.com.vn`, `e2e-quenmk@daidung.com.vn`.
- `e2e/21-khoa-tai-khoan.spec.ts`: context riêng gán `x-forwarded-for` giả (203.0.113.77, RFC 5737)
  để tách khỏi khoá IP `'unknown'` dùng chung với các spec khác trong môi trường không có reverse
  proxy thật.

**Test cũ phải cập nhật theo hành vi mới** (không xoá, chỉ thêm mock cho phù hợp gọi mới):
`auth-credentials-google-only.test.ts` (thêm mock `next/headers`, `authThrottle`, `$transaction`),
`auth-google.test.ts` (thêm mock tương tự + 2 test mới: tài khoản đang khoá → `false`, Google thành
công không đổi `failedLoginCount`; thêm test "R7 phần 3"), `auth-access-recheck.test.ts` (thêm test
Q1 = phương án a: phiên đang mở vẫn hợp lệ khi tài khoản bị khoá - không cần sửa code, `jwt` chưa
bao giờ kiểm `lockedAt` ở nhánh kiểm lại định kỳ, chỉ cần chứng minh bằng test).

**Kiểm tay:** `npm run unlock-account -- khong-co@x.com` → exit 1; tạo 1 tài khoản test bị khoá
(`failedLoginCount=5, lockedAt=now()`) rồi chạy `npm run unlock-account -- <email đó>` → exit 0,
`user_roles.lockedAt` về `null`, có đúng 1 dòng `activity_log` action `account_unlock_cli`. Đã dọn
dữ liệu test này ngay sau khi kiểm.

---

## Task 7 - D2: trang quên/đặt lại mật khẩu, vô hiệu phiên cũ

- `app/[locale]/quen-mat-khau/page.tsx` + `src/components/layout/ForgotPasswordForm.tsx`: hiện
  form khi `smtpReady` (có `NEXTAUTH_URL` và kênh SMTP hợp lệ), luôn hiện "đã gửi" giống nhau kể cả
  email lạ (S3).
- `app/[locale]/dat-lai-mat-khau/page.tsx` (metadata `referrer: 'no-referrer'`, `robots.index:
  false` - S12) + `src/components/layout/ResetPasswordForm.tsx`: GET chỉ đọc token
  (`isResetTokenUsable`, không tiêu token); form 2 ô mật khẩu, lỗi `too_short`/`mismatch`/
  `invalid_token` map đúng key.
- `src/server/actions-password-reset.ts` + test (12 test, cả 2 file): nối `requestPasswordReset`/
  `resetPasswordWithToken` (đã có sẵn từ Task 4) với `headers()`/`clientIpFrom`/`getAuthStore`/
  `resetMailer` thật; bọc try/catch, lỗi hạ tầng trả phản hồi giống bình thường, chỉ log `e.name`
  (G5).
- `middleware.ts`: `PUBLIC_PATHS` thêm `/quen-mat-khau`, `/dat-lai-mat-khau`.
- `src/lib/auth.ts` (`jwt` callback, S8): thêm `token.pwdAt` = `Date.parse(passwordChangedAt)` lúc
  đăng nhập; nhịp kiểm lại định kỳ (đã có sẵn từ T-5, 5 phút) so `Date.parse(account.passwordChangedAt)`
  với `token.pwdAt` - lớn hơn thì `token.invalid = true`. Nhân tiện đổi cả 2 nhánh `jwt` từ
  `findAccount()` cục bộ (không có `passwordChangedAt`) sang `getAuthStore().getAccountState()`
  (đã có sẵn field này) - xoá hẳn hàm `findAccount()` cục bộ không còn ai gọi.
- `src/types/next-auth.d.ts`: JWT thêm `pwdAt?: number`.
- `src/server/actions.ts`: `resetPasswordAction` (admin đặt lại mật khẩu qua trang quản trị) đổi
  sang `getAuthStore().setPassword(email, hash, true, now)` (Q2 = b, luôn bump). `changePasswordAction`
  (tự đổi trong menu Cài đặt) **GIỮ NGUYÊN** `repo.changePassword` - Q2 = b không áp dụng cho tự đổi.
- i18n: nhóm `authSecurity` thêm `forgotLink/forgotTitle/forgotIntro/forgotSubmit/forgotSent/
  smtpMissing/backToLogin/resetTitle/resetSubmit/resetDone/resetDoneLocked/resetInvalid/mailSubject/
  mailBody`; nhóm `activity` thêm `password_reset_request`, `password_reset_done`. Đúng nguyên văn
  chữ trong bảng key của kế hoạch (Q7 áp dụng cho `fxRates.hint` ở Task 1, không liên quan bảng này,
  nhưng cũng dùng nguyên văn đề xuất như mọi key khác của kế hoạch).
- e2e: `09-chan-chua-dang-nhap.spec.ts` thêm 1 test (2 trang mới public); `22-quen-mat-khau.spec.ts`
  (8 test): không có kênh email → `smtpMissing`; có kênh (tạo bằng Prisma, `isEnabled: false` để
  chứng minh Q6 = a - kênh tắt cảnh báo vẫn dùng được cho quên mật khẩu) → gửi cho cả email có tài
  khoản lẫn email lạ đều `forgotSent`; tự sinh token qua `generateResetToken()` + insert Prisma → đặt
  lại thành công → đăng nhập mật khẩu mới → mở lại cùng link → `resetInvalid`; token hết hạn →
  `resetInvalid`; bấm link "Quên mật khẩu?" từ trang đăng nhập.
- Ảnh giao diện 1440px/390px (trạng thái `smtpMissing` và `resetInvalid`, chưa cấu hình SMTP/token
  sai) lưu ở `.bangiao/anh-task7/` - card cùng khung với trang đăng nhập, không vỡ ở cả 2 kích
  thước. **Chưa chụp** trạng thái form đã điền (email/mật khẩu) hay trạng thái thành công
  (`forgotSent`/`resetDone`) - các trạng thái này đã được xác nhận đúng NỘI DUNG qua e2e (kiểm text
  hiển thị) nhưng chưa soi PIXEL; Tester nên soi thêm nếu cần khắt khe tuyệt đối.

**Sự cố nhỏ tự phát hiện + tự sửa khi viết `e2e/22-quen-mat-khau.spec.ts`:** locator
`.field({hasText: vi('auth.newPassword')})` ("Mật khẩu mới") khớp NHẦM cả ô "Nhập lại mật khẩu mới"
(chuỗi `confirmPassword` chứa sẵn `"mật khẩu mới"` làm hậu tố) - không phải lỗi code UI, chỉ là
locator e2e dùng substring quá lỏng; đã sửa bằng regex khớp CHÍNH XÁC (`^...$`). Ghi lại để Tester
biết đây không phải bug thật, và cẩn thận khi viết thêm locator theo nhãn tiếng Việt có tiền tố/hậu
tố trùng nhau.

---

## Task 8 - kiểm tổng + dọn

- `src/server/repo/types.ts`: `JobName` thu hẹp về đúng `'alerts_daily'` (Task 1 dự định làm việc
  này nhưng bị chặn vì `admin/page.tsx` lúc đó do C giữ khoá cho P7-C2 - nay C đã rảnh tay, hoàn
  thiện nốt phần này trong Task 8 vì cùng nằm trong phạm vi "dọn" của Task 8).
- `app/[locale]/(app)/admin/page.tsx`: bỏ prop `lastRun` (đọc `getRecentJobRuns('rates_monthly', 1)`)
  truyền cho `ExchangeRateEditor` - không còn dùng từ Task 1.
- `src/components/admin/ExchangeRateEditor.tsx`: bỏ prop tuỳ chọn `lastRun`/import `JobRunEntry`
  không còn dùng (comment cũ ghi rõ "xoá hết khi C nhả khoá" - nay đã nhả).
- `src/server/jobs.test.ts`: 1 chỗ ép kiểu `'rates_monthly' as never` để test vẫn kiểm được không
  còn `job_run` tên cũ dù `JobName` đã thu hẹp.
- `.env.example`: thêm dòng chú thích cho `NEXTAUTH_URL` ("dùng để dựng link đặt lại mật khẩu, phải
  là URL thật khi deploy" - K11/S11); xác nhận không còn `VCB_RATE_URL`/`ROLE_SEED`/
  `ALLOWED_EMAIL_DOMAINS` (đã bị xoá từ Task 1/3, Task 8 chỉ xác nhận lại).
- Tìm lại toàn bộ `src/`, `app/`, `scripts/`, `e2e/`: không còn `ROLE_SEED`, `isAllowedDomain`,
  `ALLOWED_EMAIL_DOMAINS`, `ProjectPhoto`/`projectPhoto`, `photo-upload`, `/api/photos`,
  `VCB_RATE_URL` trong code thật (chỉ còn trong tên biến test cố ý kiểm "không còn" hoặc comment
  lịch sử giải thích dữ liệu DB cũ). `rates_monthly` chỉ còn trong: comment lịch sử ở `docs.ts`
  (giải thích dữ liệu `job_run` cũ trên DB thật có thể còn dòng tên này), và trong các test cố ý
  kiểm hành vi 404/không tạo job_run mới tên đó (`cron-route.test.ts`, `jobs.test.ts`).
- `src/server/api-routes-guard.test.ts`: đã khớp đúng 6 route (`auth/[...nextauth]`, `health`,
  `cron/[job]`, `export`, `report/export`, `templates/daily-resources`) - test này tự dò thư mục
  `app/api` nên tự xác nhận, không cần sửa gì thêm.

---

## Cổng kiểm cuối (Task 8, sau khi dọn xong)

- `npx tsc --noEmit`: sạch.
- `npm test`: **235 file / 2628 test** (2623 xanh + 5 skip khi không có `DATABASE_URL` - đúng 5 test
  của `prisma-repo-auth-real-db.test.ts`, đã xác nhận riêng 5/5 xanh khi chạy tay với
  `DATABASE_URL` trỏ `ddc_control_tower_c`, xem mục Task 5). Không tụt so với mốc trước Task 5
  (229 file/2544 test).
- `npm run check:read`: OK (đã seed lại DB `_c` sau khi chạy e2e ghi dữ liệu thật).
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=... npm run build`: qua sạch (2 route mới `/quen-mat-khau`,
  `/dat-lai-mat-khau` có trong danh sách route sinh ra).
- `npx prisma migrate status`: up to date trên `ddc_control_tower_c` (11 migrations).
- `npm run test:e2e` (toàn bộ, không lọc spec, cổng 3003 + DB `ddc_control_tower_c`):
  **92/92 xanh**, không có test chập chờn (chạy nguyên suite 1 lần, không phải chạy lại để qua).

---

## Giới hạn đã biết (kế thừa từ Task 1-4, vẫn đúng sau Task 5-8)

- **K6** - email không tồn tại bị "khoá" tự hết sau 24 giờ (khác tài khoản thật, khoá tới khi admin
  mở); đây là giới hạn có chủ đích để cân bằng giữa chống dò email và không khoá vĩnh viễn 1 chuỗi
  email bất kỳ ai đó gõ sai.
- **K12** - vô hiệu phiên cũ (đổi vai trò, khoá tài khoản, đổi mật khẩu) trễ tối đa 5 phút
  (`ACCESS_RECHECK_INTERVAL_MS`), không tức thời.
- **G1** - tài khoản chỉ Google thừa hưởng nguyên giới hạn K6 của nhánh "email không tồn tại" khi bị
  ai đó thử sai mật khẩu qua form Credentials (không bao giờ khoá vĩnh viễn qua đường này, chỉ khoá
  tạm 24h theo cùng cơ chế K6) - có chủ đích, tránh DoS tài khoản chỉ-Google bằng cách cố tình gõ sai
  mật khẩu nhiều lần (L7).
- **Khoá chung `'unknown'` (R4)** - môi trường KHÔNG có reverse proxy thật đặt `X-Forwarded-For`
  đúng cách thì mọi người dùng rơi vào chung 1 khoá giới hạn IP, có thể tự khoá lẫn nhau. Trong môi
  trường dev/e2e của C, quan sát được `X-Forwarded-For`/hoặc IP loopback `::1` tới được server dù
  không có reverse proxy thật (có thể do phần mềm mạng/bảo mật cục bộ trên máy chèn header này) -
  đây là đặc thù MÁY DEV, không nên coi là đã "chứng minh" reverse proxy production hoạt động đúng;
  bắt buộc kiểm lại bằng `GET /api/health` → `clientIpResolved: true` SAU KHI deploy thật (xem mục
  dưới).
- **L1 phương án b** - khi IP còn chỗ nhưng 1 email đã hết lượt xin link, `requestPasswordReset` nhả
  lại đúng chỗ IP vừa đặt (không tính lượt bấm dư của 1 email vào hạn mức IP) - quyết định chủ dự án
  2026-09-28, chặn spam theo IP là việc của tầng reverse proxy (xem checklist deploy).

---

## Việc cho tài liệu deploy (C, T17)

1. Tạo Google OAuth Client theo `docs/HUONG_DAN_GOOGLE_OAUTH.md` (đã có từ Task 3), điền
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; để trống thì ẩn nút Google (đã có sẵn).
2. **SMTP bắt buộc** (trang quản trị, mục Thông báo, thêm 1 kênh `kind: email` có `smtpHost` +
   `fromAddress`) để tính năng quên mật khẩu hoạt động; thiếu thì trang `/quen-mat-khau` chỉ hiện
   thông báo "chưa cấu hình", không có form.
3. `NEXTAUTH_URL` phải là domain THẬT khi deploy (dùng để dựng link đặt lại mật khẩu - K11/S11,
   không bao giờ lấy từ header `Host`).
4. **Reverse proxy BẮT BUỘC** tự NỐI THÊM (append, KHÔNG ghi đè) IP khách vào CUỐI
   `X-Forwarded-For` - ví dụ Nginx dùng `proxy_add_x_forwarded_for`, KHÔNG dùng
   `proxy_set_header X-Forwarded-For $remote_addr` (lệnh đó GHI ĐÈ, xoá mất phần client tự gửi).
   Đặt đúng `TRUSTED_PROXY_HOPS` trong `.env` khớp số tầng proxy thật (mặc định 1). Thiếu bước này
   thì MỌI người dùng rơi vào khoá `'unknown'` dùng chung, có thể tự khoá lẫn nhau (R4/R5).
   **Kiểm nhanh sau deploy:** `GET /api/health` → trường `clientIpResolved` PHẢI là `true`; `false`
   thì soi lại cấu hình reverse proxy TRƯỚC khi coi việc deploy đăng nhập an toàn đã xong.
5. Reverse proxy đặt giới hạn tần suất riêng cho `POST` các action quên mật khẩu theo IP (L1 ở trên
   - chủ dự án chọn không tính lượt bấm dư của 1 email vào hạn mức IP ở tầng app, nên việc chặn spam
   theo IP phải làm ở tầng proxy khi deploy thật).
6. Lệnh `npm run unlock-account -- <email>` chạy được trên server (dùng khi chính admin bị khoá,
   không vào được UI để tự mở khoá).
7. Cron chỉ còn đúng 1 job `alerts_daily` (đã bỏ `rates_monthly` từ Task 1) - cấu hình cron ngoài chỉ
   cần gọi đúng job này.
8. Không còn thư mục ảnh hiện trường (`data/uploads/`) cần backup - tính năng ảnh đã gỡ từ Task 2.

---

## Cho Tester nên soi kỹ

1. **Race thật trên Postgres** (`reserveThrottle`/`releaseThrottle`, `registerFailedLogin`) - đã tự
   kiểm bằng `prisma-repo-auth-real-db.test.ts` (5/5 xanh, chạy tay với `DATABASE_URL` thật), nhưng
   đáng kiểm độc lập lại vì đây là phần khó nhất của Task 5 (advisory lock, nguyên tử).
2. **`consumeResetToken` (K4 + L5 gộp trong 1 `updateMany`)** - kiểm kỹ case tài khoản chuyển từ có
   mật khẩu sang chỉ-Google (hoặc bị tắt) NGAY SAU KHI cấp token nhưng TRƯỚC KHI người dùng bấm link
   - phải trả `{ ok: false }` và token KHÔNG bị đốt (vẫn `usedAt: null`), khác với thiết kế "đốt
   token trước rồi mới kiểm tài khoản" (dễ mắc lỗi nếu sửa lại sau này).
3. **`token.pwdAt` (S8)** - vô hiệu phiên đăng nhập cũ khi mật khẩu đổi qua email/admin, trễ tối đa
   5 phút; kiểm case đăng nhập mới NGAY SAU khi đổi mật khẩu (không nên bị vô hiệu nhầm phiên vừa
   tạo - phiên mới luôn đọc `pwdAt` tươi ngay lúc đăng nhập, không qua nhánh so sánh).
4. **Khối "Tài khoản đang bị khoá" ở `/admin`** - kiểm khi có NHIỀU tài khoản cùng bị khoá 1 lúc
   (danh sách hiện đủ, mỗi dòng mở khoá đúng đúng tài khoản đó, không nhầm dòng).
5. **e2e `21-khoa-tai-khoan.spec.ts`** dùng `x-forwarded-for` giả lập qua context riêng để tách khỏi
   khoá IP `'unknown'` dùng chung - nếu Tester thêm spec mới có nhiều lần đăng nhập sai, nên cân nhắc
   làm tương tự (context riêng + IP giả) để tránh vô tình cộng dồn vào giới hạn IP `'unknown'` dùng
   chung của các spec khác (giới hạn 20 lần/15 phút, hiện tổng các spec cũ + mới cỡ 8 lần, còn dư
   nhưng không vô hạn).
6. **Google OAuth thật** - Task 3/6 chỉ kiểm được phần không cần OAuth thật (từ chối qua
   `?error=AccessDenied`, tài khoản chỉ-Google không đăng nhập được bằng mật khẩu). Chưa có môi
   trường để kiểm luồng Google THẬT đầy đủ (cần Google Cloud Console + domain thật) - để dành cho
   giai đoạn UAT/staging.

---

## Số liệu bàn giao

- Test: 229 file/2544 test (mốc trước Task 5) → **235 file/2628 test** (2623 xanh + 5 skip).
- e2e: 85/85 (mốc trước Task 5) → **92/92 xanh** (toàn bộ suite, thêm spec 21, 22, thêm test trong 09).
- Migration mới: `20260928080000_p3e_dang_nhap_bo_anh` (đã diễn tập rollback thành công trên DB `_c`).
- 3 commit `feat(p3e)` (Task 5, 6, 7) + 1 commit `chore(p3e)` (Task 8, hồ sơ này).

---

## Vòng sửa bảo mật (sau `security-reviewer`, `.bangiao/bao-mat.md`)

Sửa theo TDD (viết test đỏ tái hiện trước, rồi mới sửa) cho S-1, S-2, S-3, I-3. S-4 và I-2 chỉ ghi
nhận theo yêu cầu chủ dự án (không sửa code), xem mục "Việc cho tài liệu deploy" ở cuối phần này.

### S-1 (Trung) - Đặt lại mật khẩu không giới hạn tần suất, bcrypt chạy trước khi kiểm token

- `src/server/password-reset.ts` (`resetPasswordWithToken`): đổi thứ tự - đặt chỗ NGUYÊN TỬ theo IP
  (`reserveThrottle('reset_submit_ip', ...)`) NGAY ĐẦU HÀM, trước cả kiểm định dạng token; hết chỗ
  trả `invalid_token` ngay, không đụng bảng token. Token hợp lệ hình thức + mật khẩu đủ dài mới gọi
  `store.peekResetToken` (chỉ đọc, không đốt token) - token không tồn tại/hết hạn/đã dùng thì trả
  `invalid_token` NGAY, không gọi `hashPassword` (trước đây `hashPassword` chạy trước khi biết token
  có tồn tại, cho phép từ chối dịch vụ CPU từ người không đăng nhập bằng cách gửi token rác liên tục).
  Token dùng được mới `hashPassword` rồi `consumeResetToken` (vẫn nguyên tử như cũ, K4 không đổi).
  Thêm `ip?: string` vào input (tuỳ chọn, không có thì gom khoá `'unknown'` giống các hàm khác).
- `src/lib/login-policy.ts`: thêm `RESET_SUBMIT_IP_LIMIT = 20`, `RESET_SUBMIT_IP_WINDOW_MS = 15 phút`
  (tái dùng đúng giá trị của `IP_FAIL_LIMIT`/`IP_FAIL_WINDOW_MS`, tách hằng số riêng vì đây là hành
  động khác - gửi token đặt lại, không phải đăng nhập sai).
- `src/server/repo/types.ts`: `ThrottleKind` thêm `'reset_submit_ip'`.
- `src/server/actions-password-reset.ts` (`submitPasswordResetAction`): lấy IP qua
  `clientIpFrom(await headers())`, truyền vào `resetPasswordWithToken`.
- `src/lib/password.ts` (`hashPassword`): đổi từ `bcryptjs.hashSync` (đồng bộ, chặn event loop) sang
  `bcryptjs.hash` (bất đồng bộ) - áp dụng THỐNG NHẤT cho mọi nơi gọi hàm này (không tách riêng 1 bản
  bất đồng bộ chỉ cho `password-reset.ts`). Đã sửa mọi nơi gọi theo (thêm `await`):
  `src/server/actions.ts` (`changePasswordAction`, `createAccountAction`, `resetPasswordAction`),
  `src/server/actions-account-lock.ts` (`unlockAccountAction`), `e2e/global-setup.ts`.
  `src/server/login-guard.ts`: `DUMMY_HASH` (module-level, dùng để cân thời gian bcrypt cho tài khoản
  không tồn tại) không còn tính được đồng bộ lúc load module - đổi sang `getDummyHash()` tính lười
  (lazy) 1 lần, cache lại `Promise<string>`, 3 chỗ gọi `verifyPassword(password, DUMMY_HASH)` đổi
  thành `verifyPassword(password, await getDummyHash())`.
  Kéo theo: 8 file test (`auth-authorize.test.ts`, `auth-credentials-google-only.test.ts`,
  `login-guard.test.ts`, `password-reset.test.ts`, `login-reset-integration.test.ts`,
  `actions-password-reset.test.ts`, `repo/account.test.ts`) đổi các hàm dựng tài khoản mẫu sang tính
  hash 1 lần trong `beforeAll`/`beforeEach` (không gọi `hashPassword` đồng bộ nữa).
- Test đỏ → xanh: `password-reset.test.ts` mục "S-1" - token đúng dạng nhưng không tồn tại thì spy
  `hashPassword` KHÔNG được gọi; quá `RESET_SUBMIT_IP_LIMIT` lần thì trả `invalid_token`, spy
  `peekResetToken`/`consumeResetToken` KHÔNG được gọi.

### S-2 (Thấp, chủ dự án chốt lại 2026-09-28, thay quyết định Q2=b cũ)

Quyết định mới: tự đổi mật khẩu trong Cài đặt CŨNG vô hiệu các phiên KHÁC (bump `passwordChangedAt`),
nhưng phiên đang dùng để đổi thì KHÔNG bị đăng xuất.

- `src/server/repo/types.ts` (`AuthStore.setPassword`): thêm vào hợp đồng - LUÔN huỷ (đặt
  `usedAt = nowIso`) mọi token đặt lại còn hạn của email đó, bất kể `bumpChangedAt` true/false.
  `src/server/repo/mock-repo-auth.ts`, `src/server/repo/prisma-repo-auth.ts`: cài theo (bản Prisma
  gộp cả 2 lệnh `userRole.updateMany` + `passwordResetToken.updateMany` trong 1 `$transaction`).
  Áp dụng cho CẢ hai nơi gọi `setPassword` (tự đổi mật khẩu VÀ admin đặt mật khẩu tạm/đặt lại), đúng
  yêu cầu "Admin đặt mật khẩu tạm (setPassword) cũng huỷ token đặt lại còn hạn".
- `src/server/actions.ts` (`changePasswordAction`): đổi từ `repo.changePassword(...)` (không bump)
  sang `getAuthStore().setPassword(user.email, await hashPassword(...), true, now)` (bump, giống
  `resetPasswordAction`).
- `src/lib/auth.ts` (callback `jwt`): thêm nhánh `trigger === 'update'` - đọc lại tài khoản NGAY (bỏ
  qua điều kiện "đã qua `ACCESS_RECHECK_INTERVAL_MS`" của nhánh kiểm lại định kỳ thường), làm mới
  `token.pwdAt`/quyền cho CHÍNH phiên gọi `update()` - để phiên vừa tự đổi mật khẩu không bị nhánh
  kiểm lại định kỳ vô hiệu nhầm (do `token.pwdAt` cũ < `passwordChangedAt` mới vừa tự đặt).
- `src/components/layout/ChangePasswordModal.tsx`: bỏ `signOut()` sau khi đổi thành công (trước đây
  đăng xuất luôn); thay bằng gọi `update()` (next-auth, qua `useSession()`) rồi hiện thông báo thành
  công (`authSecurity.changePasswordDone`), KHÔNG đăng xuất. Vì repo chưa có `SessionProvider` ở
  layout gốc (chỉ dùng session server-side), bọc RIÊNG 1 `SessionProvider` quanh modal này (không đổi
  kiến trúc đăng nhập toàn app) chỉ để lấy `update()`.
  `src/lib/drafts.ts`: sửa lại comment `clearDraftsOnLogout` (không còn được gọi từ modal này nữa).
- i18n: thêm `authSecurity.changePasswordDone` (cuối nhóm `authSecurity`, cả `vi.json`/`en.json`).
- Test: `src/lib/auth-access-recheck.test.ts` thêm 2 test cho nhánh `trigger: 'update'`;
  `src/server/actions-reset-password-session.test.ts` sửa lại mô tả + test `changePasswordAction`
  (trước đây khẳng định KHÔNG gọi `setPassword`, giờ khẳng định CÓ gọi với `bumpChangedAt: true`);
  `src/server/repo/mock-repo-auth.test.ts` + `prisma-repo-auth.test.ts` thêm test `setPassword` huỷ
  token đặt lại còn hạn.
- e2e mới `e2e/23-doi-mat-khau.spec.ts` (tài khoản `e2e-doimk@daidung.com.vn`, thêm vào
  `e2e/global-setup.ts`): đổi mật khẩu ở 1 trình duyệt → hiện thông báo thành công, phiên đó vẫn vào
  được `/vi/overview` ngay (không bị đăng xuất); mật khẩu CŨ hết dùng được cho lượt đăng nhập MỚI
  ngay (chứng minh đã đổi thật ở DB); mật khẩu MỚI đăng nhập được.
  **Giới hạn e2e đã biết (kế thừa K12):** vô hiệu phiên KHÁC trễ tối đa `ACCESS_RECHECK_INTERVAL_MS`
  (5 phút) - chờ 5 phút thật trong e2e không khả thi (chậm, dễ vượt timeout CI), nên phần "trình
  duyệt B bị đăng xuất sau khi A đổi mật khẩu" chỉ kiểm ở mức unit/integration có giả lập thời gian
  (`auth-access-recheck.test.ts`), KHÔNG có e2e đa trình duyệt chờ thật 5 phút. Tester nên biết đây
  là giới hạn có chủ đích, không phải thiếu sót.

### S-3 (Thấp) - Oracle do tồn tại tài khoản qua thời gian

- `src/server/login-guard.ts` (`checkCredentials`): nhánh "tài khoản thật đang khoá" trước đây chỉ
  chạy 1 lần bcrypt giả rồi trả ngay, trong khi nhánh "email lạ" chạy bcrypt giả + `recordThrottle` +
  `countThrottle` (2 lượt DB) - chênh lệch đo được khi lấy trung bình nhiều lần. Nay nhánh "đang khoá"
  CŨNG chạy đúng 1 `recordThrottle` + 1 `countThrottle` (kind riêng `login_locked_probe`, KHÔNG dùng
  chung `login_fail_unknown_email` để không làm nhiễu dữ liệu dùng cho quyết định khoá email lạ) -
  kết quả bị bỏ qua, chỉ để cân thời gian. Cửa sổ 24h giữ như K6 (không đổi).
- `src/server/repo/types.ts`: `ThrottleKind` thêm `'login_locked_probe'`.
- Test đỏ → xanh: `login-guard.test.ts` mục "S-3" - so số lượt gọi `recordThrottle`/`countThrottle`
  giữa nhánh "đang khoá" và "email lạ", phải bằng nhau (đều > 0).

### I-3 (Thông tin) - `unlockAccountAction` kiểm kiểu trước khi trim, giới hạn độ dài `tempPassword`

- `src/server/actions-account-lock.ts`: thêm `if (typeof email !== 'string') return { ok: false,
  error: 'Invalid input' };` TRƯỚC khi gọi `email.trim()` (trước đây gọi `.trim()` ngay trên tham số
  hàm, đầu vào không phải chuỗi - ví dụ ai đó gọi thẳng server action qua devtools, bỏ qua kiểm
  TypeScript phía client - làm `TypeError` ném ra trước khi zod kịp kiểm, lộ lỗi 500 thay vì phản hồi
  bình thường). `tempPassword` thêm `.max(72)` (giới hạn bcrypt cắt ở 72 byte).
- Test: `actions-account-lock.test.ts` thêm 2 test - email không phải chuỗi (ép kiểu `unknown`) trả
  `Invalid input`, không ném lỗi; `tempPassword` 73 ký tự trả `too_short` (dùng chung thông điệp có
  sẵn với lỗi quá ngắn, không thêm key i18n mới vì chưa có thông điệp "quá dài" riêng cho mật khẩu).

### S-4, I-2 - chỉ ghi nhận, không sửa code (theo yêu cầu chủ dự án)

- **S-4** - khoá tài khoản bị dùng để từ chối dịch vụ có chủ đích (kể cả admin): đúng thiết kế D3 đã
  duyệt, chủ dự án chốt chỉ ghi nhận. Đề xuất cho việc sau (không thuộc phạm vi vòng sửa này): cảnh
  báo admin khi tài khoản admin bị khoá, theo dõi `activity_log` action `login_locked`.
- **I-2** - token trong query string `/dat-lai-mat-khau?token=...` sẽ vào access log của reverse
  proxy. Đã thêm vào mục "Việc cho tài liệu deploy" bên dưới (không sửa code app - việc của tầng
  reverse proxy khi deploy).

### Việc cho tài liệu deploy (bổ sung, cùng nhóm với mục đã có ở trên)

9. **I-2 (bao-mat.md)** - cấu hình reverse proxy LỌC BỎ query string `token` khỏi access log (link
   `/dat-lai-mat-khau?token=...` không nên bị ghi log dạng plaintext ở tầng hạ tầng); ví dụ Nginx dùng
   `log_format` tuỳ biến bỏ `$request` gốc, thay bằng URI đã lọc query, hoặc dùng module chuyên lọc.

### Cổng kiểm (vòng sửa bảo mật)

- `npx tsc --noEmit`: sạch.
- `npm test`: **235 file/2648 test** (2641 xanh + 7 skip - đúng 5 skip cũ của
  `prisma-repo-auth-real-db.test.ts` + kiểm tra lại KHÔNG tăng số skip nào khác; đã chạy tay riêng
  file này với `DATABASE_URL` trỏ `ddc_control_tower_c`: 7/7 xanh).
- `npm run check:read`: OK.
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=... npm run build`: qua sạch.
- `npm run test:e2e` (toàn bộ, không lọc spec): **93/93 xanh** (thêm spec 23), đã seed lại DB `_c`
  sau khi chạy.

### Cho Tester nên soi kỹ (bổ sung riêng cho vòng sửa bảo mật này)

1. **S-1** - thử tái tạo lại kịch bản DoS gốc (gửi token rác liên tục tới
   `submitPasswordResetAction`) và xác nhận CPU không còn bị tốn bởi `hashPassword` khi token không
   tồn tại; xác nhận `RESET_SUBMIT_IP_LIMIT` (20/15 phút) không quá chặt với người dùng thật (1 người
   quên mật khẩu vài lần liên tiếp không nên bị chặn).
2. **S-2** - soi kỹ `ChangePasswordModal.tsx` mới bọc `SessionProvider` riêng: xác nhận không có tác
   dụng phụ nào khi mở/đóng modal nhiều lần liên tục (mount/unmount `SessionProvider` lặp lại); soi
   e2e `23-doi-mat-khau.spec.ts` và cân nhắc bổ sung kiểm tra thật với thời gian giả lập (fake timers
   ở tầng Next.js) nếu muốn phủ hết trường hợp "phiên B bị đăng xuất" bằng e2e (hiện chưa khả thi).
3. **S-3** - đây là fix mức "Thấp", đáng đối chiếu lại bằng đo thời gian thực tế (không chỉ đếm số
   lượt gọi DB) nếu có công cụ đo timing side-channel chuyên dụng.

## Vòng sửa bảo mật 2 (sau `security-reviewer` vòng 2, `.bangiao/bao-mat.md`)

Vòng 1 đóng S-1/S-3/I-3 đúng, nhưng cách giữ phiên hiện tại của S-2 (client gọi `update()` next-auth)
lại mở ra 1 lỗ hổng MỚI mức Cao (R2-1). Phiên điều phối đã chọn **CÁCH VÁ 1** trong `bao-mat.md`
(gọn nhất - chỉ request đã qua kiểm mật khẩu hiện tại mới làm mới được `pwdAt`, bỏ được
`SessionProvider` lồng + `update()` phía client).

### R2-1 (Cao) - Phiên đã bị vô hiệu tự "hồi sinh" qua `update()`

- **Gốc lỗi**: `src/lib/auth.ts` callback `jwt`, nhánh `trigger === 'update'` (dòng ~178-190 cũ) chỉ
  dựa vào `token.email` trong cookie để đọc lại tài khoản, gán `invalid = false` (qua
  `applyAccountToToken`) rồi ghi đè `token.pwdAt` bằng mốc mới nhất trong DB - KHÔNG so với
  `token.pwdAt` cũ trước khi ghi đè. `POST /api/auth/session` (kèm `csrfToken` lấy công khai qua
  `GET /api/auth/csrf`) sinh `trigger: 'update'` cho BẤT KỲ ai đang giữ cookie phiên, kể cả cookie bị
  đánh cắp - nên ai giữ được cookie phiên (đã bị đá do đổi mật khẩu) đều tự "hồi sinh" lại được, xoá
  sạch tác dụng của S8/S-2 (khoá vô hiệu phiên cũ khi đổi mật khẩu).
- **`src/lib/auth.ts`** (callback `jwt`) - bỏ hẳn việc làm mới `pwdAt`/nới lỏng `invalid` trong nhánh
  `trigger === 'update'`. Nhánh này giờ CHỈ được phép SIẾT CHẶT thêm: đọc tài khoản, so
  `changedAtMs > token.pwdAt` (giữ nguyên `token.pwdAt` cũ, không ghi đè) rồi đặt `invalid = true` nếu
  phát hiện mật khẩu đã đổi sau lúc phiên đăng nhập - KHÔNG BAO GIỜ hạ `invalid` từ true về false
  (không gọi `applyAccountToToken` nữa ở nhánh này). Vì `ChangePasswordModal` không còn gọi
  `update()`, nhánh này gần như trở thành hàng rào phòng thủ cho `POST /api/auth/session` (endpoint
  next-auth vẫn công khai, không tắt được).
- **`src/lib/auth.ts`** (hàm mới `reissueSessionCookie(email)`) - thay cho việc dựa vào client
  `update()`: đọc token TỪ COOKIE HIỆN TẠI của chính request (không nhận tham số từ ngoài ngoài
  `email` đã được `changePasswordAction` xác thực), so `token.email === email` (chỉ làm mới cookie
  của ĐÚNG người vừa đổi mật khẩu), đọc lại tài khoản từ DB lấy đúng `passwordChangedAt` vừa ghi, gán
  `token.pwdAt` + `applyAccountToToken`, mã hoá lại bằng `next-auth/jwt` `encode()` (cùng
  `secret`/`session.maxAge` của `authOptions`, không nhân bản hằng số), rồi `cookies().set()` đúng
  tên cookie phiên (`next-auth.session-token`, tự thêm tiền tố `__Secure-` khi `NEXTAUTH_URL` là
  `https://`, cùng quy ước K11 - không bao giờ tin header `Host`), cùng thuộc tính `httpOnly`/
  `sameSite: 'lax'`/`path: '/'`/`secure` như mặc định next-auth (`defaultCookies`, không có
  `authOptions.cookies` tuỳ biến). Không xử lý cookie bị chia nhỏ (chunk) - payload JWT app này nhỏ,
  không chạm ngưỡng ~4KB. Lỗi bất kỳ trong hàm này chỉ log `e.name` (không log message) và KHÔNG được
  làm hỏng việc đổi mật khẩu đã thành công (chỉ là tiện ích giữ phiên, không phải điều kiện thành
  công của action).
- **`src/server/actions.ts`** (`changePasswordAction`) - sau khi `getAuthStore().setPassword(...)`
  thành công, gọi `reissueSessionCookie(user.email)` (không còn phần client tự `update()`). Đổi
  `verifyPassword(...)` thành `await verifyPassword(...)` (xem mục kèm theo dưới đây).
- **`src/components/layout/ChangePasswordModal.tsx`** - bỏ `SessionProvider` bọc riêng, bỏ
  `useSession()`/`update()`. Không đổi hành vi hiển thị: vẫn không đăng xuất, vẫn hiện
  `authSecurity.changePasswordDone` khi thành công.
- **Kèm theo (theo yêu cầu)**: `src/lib/password.ts` `verifyPassword` đổi từ `bcryptjs.compareSync`
  (đồng bộ) sang `bcryptjs.compare` (bất đồng bộ) - nhất quán với `hashPassword` đã bất đồng bộ từ
  vòng sửa 1. Cập nhật mọi nơi gọi thêm `await`: `src/server/actions.ts` (`changePasswordAction`),
  `src/server/login-guard.ts` (4 chỗ, cả 3 nhánh bcrypt giả + nhánh mật khẩu thật), test
  `src/server/repo/account.test.ts`. `src/server/login-guard.test.ts` không cần sửa (chỉ spy
  `verifyPassword`, không gọi trực tiếp).
- **Test đỏ → xanh**:
  - `src/lib/auth-access-recheck.test.ts` (thay hẳn 2 test cũ của mô tả "S-2 trigger 'update'..." bằng
    3 test mới, mô tả "R2-1 trigger 'update' CHI duoc siet chat, khong bao gio noi long"): token đang
    `invalid: true` + DB `passwordChangedAt` mới hơn `pwdAt` → `invalid` VẪN true, `pwdAt` KHÔNG bị
    ghi đè; token `pwdAt` cũ hơn DB (dù `accessCheckedAt` vừa kiểm xong, không chờ
    `ACCESS_RECHECK_INTERVAL_MS`) → `invalid = true` ngay; token `pwdAt` đã khớp DB → không tự đặt
    `invalid` (không tự hạ thấp quyền một cách vô cớ).
  - `src/lib/auth-reissue-session-cookie.test.ts` (file mới, 4 test) - giải mã lại cookie mới do
    `reissueSessionCookie` set để xác nhận nội dung thật (không chỉ spy lời gọi): không có cookie
    phiên nào đang mở → không làm gì, không ném lỗi; cookie hiện tại thuộc email KHÁC → không cấp lại
    (không làm mới nhầm phiên người khác); đúng email vừa đổi mật khẩu → cookie mới giải mã ra
    `pwdAt` = `passwordChangedAt` mới từ DB, `invalid = false`, `role`/`canViewFinance` làm mới theo
    DB; `getAccountState` trả `null` (tài khoản bị xoá giữa chừng) → cookie mới có `invalid = true`.
  - `src/server/actions-reset-password-session.test.ts` (mock `@/lib/auth` để spy
    `reissueSessionCookie`) - đổi mật khẩu thành công → gọi `reissueSessionCookie('admin@daidung.com.vn')`
    (đúng email, đúng SAU KHI `setPassword` thành công); mật khẩu hiện tại sai → KHÔNG gọi
    `setPassword` VÀ KHÔNG gọi `reissueSessionCookie`.
- e2e: `e2e/23-doi-mat-khau.spec.ts` (đã có từ vòng sửa 1) không cần sửa, vẫn xanh - chứng minh phiên
  A vẫn dùng được ngay sau khi tự đổi mật khẩu, giờ qua đường cookie server tự cấp lại (không còn qua
  `update()` client).

### R2-2 (Thấp) - chỉ ghi nhận, không sửa code (theo yêu cầu chủ dự án)

- Khoá `'unknown'` dùng chung cho `reset_submit_ip` (giống R4/R5 ở đăng nhập, đã chấp nhận từ vòng
  trước): proxy không gửi `x-forwarded-for`/`x-real-ip` → mọi người dùng chung 1 khoá giới hạn IP cho
  chức năng đặt lại mật khẩu, có thể tự khoá lẫn nhau 15 phút. Đã thêm mục 10 vào "Việc cho tài liệu
  deploy" bên dưới.

### Việc cho tài liệu deploy (bổ sung thêm, cùng nhóm với các mục đã có ở trên)

10. **R2-2 (bao-mat.md vòng 2)** - bắt buộc cấu hình đúng header IP (`X-Forwarded-For`/`X-Real-Ip`) +
    `TRUSTED_PROXY_HOPS` (xem mục 4 ở trên) - áp dụng cho khoá đăng nhập (`login_fail_ip`), khoá
    gửi đặt lại mật khẩu (`reset_submit_ip`) VÀ khoá đoán mật khẩu hiện tại ở Đổi mật khẩu
    (`change_pwd_fail_ip`, R4-5), cùng chung khoá `'unknown'` khi thiếu header. Theo dõi
    cảnh báo `warnUnknownIpOnce` (log 1 lần khi rơi vào khoá `'unknown'`) sau khi deploy để phát hiện
    sớm nếu reverse proxy cấu hình sai.

### Cổng kiểm (vòng sửa bảo mật 2)

- `npx tsc --noEmit`: sạch.
- `npm test`: **237 file/2653 test** (2646 xanh + 7 skip - đúng 7 skip cũ của
  `prisma-repo-auth-real-db.test.ts`, không tăng thêm; đã chạy tay riêng file này với `DATABASE_URL`
  trỏ `ddc_control_tower_c`: 7/7 xanh).
- `npm run check:read`: OK.
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=... npm run build`: qua sạch.
- `npm run test:e2e` (toàn bộ, không lọc spec): **93/93 xanh** (không tăng/giảm so với vòng sửa 1 -
  không thêm spec mới, chỉ đổi cách phiên hiện tại được giữ), đã seed lại DB `_c` sau khi chạy.

### Cho Tester nên soi kỹ (bổ sung riêng cho vòng sửa bảo mật 2 này)

1. **R2-1** - đây là lỗ hổng mức Cao, đáng kiểm độc lập bằng cách tái hiện đúng kịch bản khai thác cũ:
   2 context (A đổi mật khẩu, B giữ cookie cũ của A trước khi đổi) → B gọi
   `GET /api/auth/csrf` lấy `csrfToken` rồi `POST /api/auth/session` với cookie cũ - phải KHÔNG hồi
   sinh được phiên B (B vẫn bị đá trong tối đa 5 phút như S8/S-2 dự định), khác với trước khi vá (B
   gọi được `update()` để tự làm mới `pwdAt`).
2. **`reissueSessionCookie`** - soi kỹ điều kiện `token.email !== email` (chỉ làm mới đúng phiên của
   người vừa đổi mật khẩu) và trường hợp không có cookie phiên nào (`raw` rỗng) - cả 2 đều phải thoát
   êm, không ném lỗi ra ngoài `changePasswordAction`.
3. **Nhánh `trigger === 'update'` còn lại** - sau khi bỏ `update()` ở `ChangePasswordModal`, nhánh
   này trong `jwt` callback không còn được gọi từ UI nào của app nữa, chỉ còn là hàng rào phòng thủ
   cho `POST /api/auth/session` (next-auth expose công khai, không tắt được) - nên kiểm tra thêm nếu
   sau này có tính năng mới gọi `update()` (ví dụ đồng bộ `session` phía client) thì đọc lại đoạn
   comment ở `auth.ts` trước khi thêm logic mới vào nhánh này.

## Vòng sửa bảo mật 3 (bao-mat.md vòng 3: R3-1, R3-2 Trung; R3-4 Thấp; tester e2e 25)

- **R3-1 - compare-and-swap khi tự đổi mật khẩu.**
  `AuthStore.setPasswordIfHash(email, oldHash, newHash, nowIso)` (Prisma: `updateMany where { email, passwordHash: oldHash }` trong transaction, chỉ huỷ token đặt lại khi ghi thắng; bản bộ nhớ tương đương).
  `changePasswordAction` đọc `oldHash` qua `getAccountState`, ghi bằng CAS; thua CAS thì trả `current` và không cấp lại cookie.
  `reissueSessionCookie(email, changedAtIso)` nhận mốc vừa ghi; DB có `passwordChangedAt` mới hơn thì đặt `invalid = true` thay vì hồi sinh phiên.
- **R3-2 - đoán mật khẩu hiện tại (theo chốt của chủ dự án).**
  Tài khoản đang khoá bị từ chối trước bcrypt (`locked`).
  Giới hạn theo IP trước bcrypt: `reserveThrottle('change_pwd_fail_ip', ...)` cùng ngưỡng/cửa sổ với đăng nhập (`ip_limited`), đúng mật khẩu thì `releaseThrottle`.
  Sai mật khẩu tính chung bộ đếm khoá 5 lần (`registerFailedLogin`); đủ ngưỡng thì ghi `login_locked` và `invalidateCurrentSessionCookie` (đặt `invalid = true` trên cookie của chính người gọi).
  Đúng mật khẩu thì `resetFailedLogin` (false nghĩa là vừa bị khoá song song, trả `locked`).
  `withOwnSessionCookie` là phần dùng chung của `reissueSessionCookie` và `invalidateCurrentSessionCookie`.
- **R3-4.** Nhánh `jwt` `trigger === 'update'` đặt `invalid = true` khi tài khoản không còn hoặc `isActive = false`.
- **R3-3 (Thấp).** Không sửa trong vòng này: kiểm lại định kỳ đọc DB là fail-closed, tải DB chấp nhận được với quy mô người dùng nội bộ; ghi nhận để xem lại khi có SessionProvider/làm mới cookie.
- **Modal Đổi mật khẩu (e2e 25).** `ChangePasswordModal` render qua `createPortal(..., document.body)`, thoát containing block do `backdrop-filter` của `.side`; hiển thị thông báo `authSecurity.locked` (rồi tải lại trang) và `authSecurity.ipLimited`, không thêm key i18n.

### Test mới/sửa (vòng sửa bảo mật 3)

- `src/server/actions-change-password-lock.test.ts` (mới): khoá sau 5 lần sai + đá phiên, đã khoá thì không gọi bcrypt, đúng mật khẩu reset bộ đếm, `ip_limited`, CAS thua khi có request khác ghi đè giữa verify và ghi.
- `src/lib/auth-invalidate-session-cookie.test.ts` (mới); `auth-reissue-session-cookie.test.ts`, `auth-access-recheck.test.ts` (R3-4), repo auth mock/prisma (`setPasswordIfHash`) cập nhật.
- `prisma-repo-auth-real-db.test.ts`: thêm ca 2 lời gọi `setPasswordIfHash` song song cùng `oldHash` chỉ 1 cái thắng.
- `login-guard.test.ts`: bổ sung `setPasswordIfHash` vào store giả (lỗi tsc).

### Cổng kiểm (vòng sửa bảo mật 3)

- `npx tsc --noEmit`: sạch.
- `npm test`: 239 file, 2665 xanh + 8 skip (8 ca real-db, bỏ qua khi không có `DATABASE_URL`).
- Real-db (`DATABASE_URL` trỏ `ddc_control_tower_c`): 8/8 xanh.
- e2e 24 + 25 (kèm setup): 7/7 xanh; e2e 25 trước đó đỏ chủ đích, nay xanh nhờ portal.
- Chưa chạy lại toàn bộ e2e và `npm run build` trong vòng này.

## Vòng sửa bảo mật 4 (bao-mat.md vòng 4: R4-1 Trung; R4-2, R4-3, R4-4 Thấp; R4-5 chỉ ghi nhận)

Làm TDD: viết test đỏ trước (tái hiện đúng kịch bản trong `bao-mat.md`), chạy thấy đỏ, rồi mới sửa.

- **R4-1 (Trung) - khoá do đoán sai mật khẩu hiện tại phải vô hiệu MỌI phiên phía server, `invalid` phải "dính".**
  Chốt của chủ dự án: khoá do đoán sai mật khẩu hiện tại đăng xuất MỌI phiên của tài khoản (thu hồi phía server bằng cách bump `passwordChangedAt`, không làm bảng thu hồi/`sid` riêng - phương án đơn giản nhất, tận dụng đúng cơ chế S8 sẵn có).
  (a) `src/server/repo/types.ts` (`AuthStore`): thêm `revokeSessions(email, nowIso): Promise<boolean>` - bump `passwordChangedAt = nowIso`, KHÔNG đổi `passwordHash`. Cài ở `src/server/repo/prisma-repo-auth.ts` (`updateMany({ where: { email } })`) và `src/server/repo/mock-repo-auth.ts` (ghi lại `counters`). Chọn hàm RIÊNG thay vì gộp vào `registerFailedLogin` vì `registerFailedLogin` chạy ở CẢ đăng nhập lẫn đổi mật khẩu nhưng chỉ đổi mật khẩu mới cần thu hồi phiên - gộp chung sẽ vô tình bump `passwordChangedAt` mỗi lần đăng nhập sai (không đúng ý định, cũng không cần thiết vì đăng nhập sai không có phiên nào để giữ mà cần đá).
  `src/server/actions.ts` (`changePasswordAction`): khi `result.justLocked` (đúng lượt khoá tài khoản, chỉ 1 lần) thì gọi thêm `store.revokeSessions(user.email, nowIso)` ngay cạnh `logActivity('login_locked', ...)` đã có, TRƯỚC `invalidateCurrentSessionCookie` (giữ nguyên - vẫn lo phần cookie của CHÍNH request đang chạy, `revokeSessions` lo các phiên KHÁC). Chỉ gọi khi `justLocked` (không gọi lặp lại ở các lượt đã khoá sẵn) - tránh ghi DB thừa, phiên khác vẫn bị đá đúng 1 lần là đủ.
  (b) `src/lib/auth.ts` (callback `jwt`, nhánh kiểm định kỳ T-5): trước đây `applyAccountToToken(token, account)` có thể đặt lại `invalid = false` (dựa theo `isActive` hiện tại), rồi phép so `changedAtMs > pwdAt` MỚI đặt lại `true` nếu cần - nếu DB CHƯA (hoặc không) phản ánh lý do vô hiệu bằng `passwordChangedAt` thì `invalid` bị hạ nhầm về `false`. Sửa: chụp `wasInvalid = token.invalid === true` TRƯỚC khi gọi `applyAccountToToken`, cuối nhánh nếu `wasInvalid` thì ép lại `token.invalid = true` - nhánh này giờ CHỈ SIẾT, không bao giờ NỚI. Nhánh đăng nhập mới (`user?.email`) và nhánh `trigger === 'update'` (đã sticky từ vòng 3) không đổi.
- **R4-2 (Thấp) - giới hạn theo TÀI KHOẢN trước bcrypt khi gọi song song.**
  Vấn đề: nhiều yêu cầu chạy đồng thời (`Promise.all`) cho CÙNG 1 email đều đọc `failedLoginCount` CŨ (chưa ai kịp ghi `registerFailedLogin`, việc ghi chỉ xảy ra SAU khi bcrypt xong) nên đều lọt qua kiểm `lockedAt` và đều chạy bcrypt thật - vượt hẳn `LOGIN_LOCK_THRESHOLD` (5).
  Lựa chọn kỹ thuật: dùng LẠI cơ chế `reserveThrottle` sẵn có (advisory lock theo `kind:key`, đã dùng cho khoá IP) với 2 `ThrottleKind` MỚI (`login_fail_account`, `change_pwd_fail_account`) thay vì phương án "tăng trước `failedLoginCount`" - lý do: tăng trước cột `failedLoginCount` thật sẽ khoá NHẦM một lượt đoán ĐANG chạy song song mà sau đó hoá ra ĐÚNG mật khẩu (ví dụ 2 tab gửi cùng lúc), vì lượt đó bị tính là "sai" trước khi biết kết quả; dùng `reserveThrottle` như một "chỗ giữ" tạm thời, RÚT LẠI NGAY (`finally`) sau khi bcrypt xong (dù đúng hay sai) thì không đụng tới bộ đếm khoá CHÍNH THỨC (`failedLoginCount`), chỉ giới hạn SỐ LƯỢT ĐANG CHẠY ĐỒNG THỜI không vượt quá số lượt còn lại trước ngưỡng (`LOGIN_LOCK_THRESHOLD - failedLoginCount` đọc tại đầu hàm). Hết chỗ thì coi như đã khoá, KHÔNG chạy bcrypt (kể cả bcrypt giả - đổi khác các nhánh "đã khoá" khác vì mục tiêu ở đây là giảm CPU thật khi bị dồn dập, không phải chống timing oracle).
  `src/lib/login-policy.ts`: thêm hằng `ACCOUNT_GUESS_WINDOW_MS = 5_000` (cửa sổ ngắn, chỉ đủ bắt các lượt THỰC SỰ chồng nhau, không dùng để đếm dài hạn).
  `src/server/login-guard.ts` (`checkCredentials`) và `src/server/actions.ts` (`changePasswordAction`): thêm gate giống nhau (đặt chỗ theo `kind` riêng cho từng màn, `limit = LOGIN_LOCK_THRESHOLD - failedLoginCount`) ngay trước lời gọi `verifyPassword` thật (không áp cho nhánh bcrypt giả/email lạ/chỉ-Google - các nhánh đó không tăng `failedLoginCount` nên không có gì cần giới hạn thêm).
  `src/server/repo/types.ts`: `ThrottleKind` thêm `'login_fail_account'`, `'change_pwd_fail_account'` (cột `kind` là `String` trong Prisma, không cần migration; `pruneAuthData` xoá theo `createdAt` không liệt kê `kind` nên không cần sửa).
- **R4-3 (Thấp) - `reissueSessionCookie` so theo hash thay vì mốc giờ.**
  `src/lib/auth.ts` (`reissueSessionCookie`): đổi tham số thứ 2 từ `changedAtIso` sang `newHash` (hash mật khẩu vừa ghi) - so trực tiếp `account.passwordHash !== newHash` thay vì so `dbChangedAtMs > Date.parse(changedAtIso)`. So hash không lệ thuộc độ chính xác đồng hồ giữa nhiều instance hay 2 lần ghi trùng mili giây (điều mà so mốc giờ có thể bỏ lọt). `src/server/actions.ts` (`changePasswordAction`): gọi `reissueSessionCookie(user.email, newHash)` (biến `newHash` đã có sẵn từ bước `hashPassword`).
- **R4-4 (Thấp) - tài khoản bị TẮT/KHOÁ không được đổi mật khẩu qua đường tự đổi.**
  `src/server/actions.ts` (`changePasswordAction`): thêm `!account.isActive` vào điều kiện trả `current` sớm (gộp cùng nhánh chỉ-Google có sẵn).
  `src/server/repo/types.ts`/`prisma-repo-auth.ts`/`mock-repo-auth.ts` (`setPasswordIfHash`): thêm điều kiện `isActive: true, lockedAt: null` vào `where` (Prisma) / kiểm tương đương trong bộ nhớ - tài khoản bị TẮT hoặc bị KHOÁ xen giữa lúc kiểm mật khẩu hiện tại và lúc ghi (ví dụ admin thao tác đồng thời) cũng phải làm CAS thua (trả `current`), không cho đổi mật khẩu "chui".
- **R4-5 (Thấp)** - chỉ ghi nhận theo yêu cầu chủ dự án, không sửa code (khoá `'unknown'` dùng chung cho `change_pwd_fail_ip`, cùng loại R2-2/R4 đã chấp nhận).

### Test mới/sửa (vòng sửa bảo mật 4)

- `src/lib/auth-access-recheck.test.ts`: thêm 2 test R4-1b (token đã `invalid=true` + tua qua `ACCESS_RECHECK_INTERVAL_MS`, DB chưa/không bump `passwordChangedAt` -> vẫn `invalid=true`; lặp lại nhiều vòng kiểm định kỳ liên tiếp vẫn không hồi sinh).
- `src/lib/auth-reissue-session-cookie.test.ts`: viết lại theo tham số `newHash` (so hash thay vì so mốc giờ), giữ đủ các ca cũ (không cookie, email khác, tài khoản bị xoá, race - hash khác nhau, không race - hash khớp).
- `src/server/login-guard.test.ts`: thêm `revokeSessions: vi.fn()` vào `AuthStore` mock thủ công (lỗi tsc nếu thiếu); sửa test `Promise.all` N=10 cũ (trước đây kỳ vọng `failedLoginCount === 10`, nay đúng thiết kế R4-2 là dừng ở `LOGIN_LOCK_THRESHOLD`); thêm test spy `verifyPassword` gọi `<= LOGIN_LOCK_THRESHOLD` lần khi 10 lượt sai chạy song song.
- `src/server/actions-change-password-lock.test.ts`: thêm test R4-1a (`revokeSessions` gọi đúng 1 lần lúc `justLocked`, không gọi thêm ở các lượt đã khoá sẵn), R4-2 (`Promise.all` 10 lượt sai, `verifyPassword` gọi `<= LOGIN_LOCK_THRESHOLD` lần), R4-4 (`isActive=false` -> `current`, không gọi `verifyPassword`).
- `src/server/repo/mock-repo-auth.test.ts`, `src/server/repo/prisma-repo-auth.test.ts`: thêm test `revokeSessions` (bump `passwordChangedAt`, không đổi `passwordHash`, `false` khi không có tài khoản); cập nhật/thêm test `setPasswordIfHash` cho điều kiện `isActive`/`lockedAt` mới (R4-4).
- `src/server/repo/prisma-repo-auth-real-db.test.ts`: thêm 4 ca DB thật - `revokeSessions` bump đúng cột, trả `false` khi không có tài khoản; `setPasswordIfHash` trả `false` khi tài khoản bị TẮT hoặc đang bị KHOÁ xen giữa (R4-4).

### Cổng kiểm (vòng sửa bảo mật 4)

- `npx tsc --noEmit`: sạch.
- `npm test`: **239 file / 2690 test** (2678 xanh + 12 skip - đúng 12 ca real-db, tăng từ 8 vì thêm 4 ca mới ở mục R4-1a/R4-4).
- Real-db (`DATABASE_URL` trỏ `ddc_control_tower_c`): `npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts` -> **12/12 xanh**.
- e2e liên quan (`e2e/21*`, `22*`, `23*`, `24*`, `25*`, kèm 3 spec `auth.setup.ts`): **14/14 xanh**, không chập chờn (chạy 1 lần, không phải chạy lại).
- Chưa chạy lại toàn bộ e2e (`npm run test:e2e`) và `npm run build` trong vòng này (ngoài phạm vi lệnh giao việc).

### Cho Tester nên soi kỹ (bổ sung riêng cho vòng sửa bảo mật 4 này)

1. **R4-1b (tính "dính" của `invalid`)** - đáng kiểm thêm kịch bản: tài khoản bị khoá rồi được ADMIN mở khoá lại (`unlockAccountAction`, không đổi mật khẩu) trong lúc phiên cũ vẫn đang `invalid=true` - phiên đó có nên tự hồi sinh không hay bắt buộc đăng nhập lại? Hiện tại `wasInvalid` khiến nó KHÔNG bao giờ hồi sinh (phải đăng nhập lại) - đây là lựa chọn an toàn hơn nhưng đáng xác nhận lại với chủ dự án có đúng ý muốn hay không (không nằm trong phạm vi R4-1 được giao, chỉ là hệ quả phụ của thiết kế "chỉ siết").
2. **R4-2 (giới hạn theo tài khoản)** - cửa sổ `ACCOUNT_GUESS_WINDOW_MS = 5s` là ước lượng hợp lý cho môi trường hiện tại; nếu thấy nhiều lượt đăng nhập hợp lệ bị từ chối oan (hiếm, chỉ khi có ĐÚNG lúc `LOGIN_LOCK_THRESHOLD` lượt cùng tài khoản chạy trong vòng 5 giây) thì đây là nơi cần xem lại đầu tiên. **(Cập nhật vòng 5: cửa sổ này đã đổi thành 5 phút và không còn là cơ chế giới hạn concurrency chính - xem R5-1/R5-2 bên dưới.)**
3. **R4-4 (CAS thêm điều kiện `isActive`/`lockedAt`)** - kiểm lại `resetPasswordAction` (admin đặt mật khẩu qua trang quản trị) và `resetPasswordWithToken` (đặt lại qua email) KHÔNG bị ảnh hưởng - 2 đường đó dùng `setPassword` (không CAS), cố tình ghi đè vô điều kiện kể cả khi tài khoản đang khoá (admin/token được phép "cứu" tài khoản bị khoá), không nên thêm nhầm điều kiện `isActive`/`lockedAt` vào đó.

## Vòng sửa bảo mật 5 (bao-mat.md vòng 5: R5-1 Thấp bắt buộc; R5-2, R5-3, R5-4, R5-5, R5-6 Thấp)

Làm TDD: viết test đỏ trước (tái hiện đúng kịch bản trong `bao-mat.md`), chạy thấy đỏ, rồi mới sửa.

- **R5-1 (Thấp, bắt buộc, cả Đăng nhập lẫn Đổi mật khẩu) - gốc lỗi vòng 4: đọc `failedLoginCount` từ bản chụp CŨ + rút chỗ QUÁ SỚM (ngay sau bcrypt, trước `registerFailedLogin`) có thể để lọt quá 5 lượt bcrypt thật khi nhiều yêu cầu chạy chồng chéo (không chỉ đơn thuần `Promise.all` đồng loạt).**
  Thêm `AuthStore.reserveAccountGuess(kind, email, nowIso, sinceIso, threshold)` (thay `reserveThrottle` dùng chung ở vòng 4) ở `src/server/repo/types.ts`, cài ở `prisma-repo-auth.ts` và `mock-repo-auth.ts`: trong 1 giao dịch (Prisma: `pg_advisory_xact_lock(hashtext(kind:email))` rồi mới đọc), đọc `failedLoginCount`/`lockedAt` TỪ DB NGAY TRONG GIAO DỊCH (không dựa vào bản chụp đọc trước đó), đếm số chỗ ĐANG GIỮ (`auth_throttle` cùng `kind:key`, `createdAt >= sinceIso`), từ chối khi tài khoản không còn, đã bị khoá, hoặc `failedLoginCount + số chỗ đang giữ >= threshold`.
  `src/server/login-guard.ts` (`checkCredentials`) và `src/server/actions.ts` (`changePasswordAction`): đổi sang gọi `reserveAccountGuess`, bọc `verifyPassword` + `registerFailedLogin`(nhánh sai)/`resetFailedLogin`(nhánh đúng) trong `try { ... } finally { await store.releaseThrottle(accountReserved); }` - CHỈ rút chỗ SAU KHI ghi xong (khác vòng 4 - rút ngay sau bcrypt, trước khi ghi). Bất biến: số chỗ đang giữ + số lượt sai đã ghi (`failedLoginCount`) không bao giờ vượt `LOGIN_LOCK_THRESHOLD`.
- **R5-2 (Thấp) - cửa sổ 5 giây của vòng 4 có thể hết hạn khi server bị dồn tải (nhiều bcrypt cùng chạy, `bcryptjs` chạy chậm hẳn đi), khiến 1 chỗ vẫn đang được xử lý bị coi là "đã hết hạn" trong phép đếm.**
  `src/lib/login-policy.ts`: `ACCOUNT_GUESS_WINDOW_MS` đổi từ 5 GIÂY sang **5 PHÚT** (cùng mốc `ACCESS_RECHECK_INTERVAL_MS`) - từ vòng 5, cửa sổ này CHỈ còn tác dụng dọn dòng mồ côi nếu tiến trình crash giữa chừng không kịp `releaseThrottle` (không còn dùng để giới hạn concurrency theo thời gian - việc đó nay do `reserveAccountGuess` đếm đúng số chỗ ĐANG GIỮ đảm nhiệm, xem R5-1).
- **R5-3 (Thấp) - nhánh "hết chỗ" ở màn Đăng nhập trả `locked` ngay (không bcrypt), lộ thời gian phản hồi khác nhánh "đã khoá thật" (có bcrypt giả) - đo được khi 1 tài khoản thật có mật khẩu đang ở gần ngưỡng khoá khác với "đã khoá hẳn"/"email lạ".**
  `src/server/login-guard.ts`: rút phần xử lý của nhánh `account.lockedAt !== null` (bcrypt giả `getDummyHash()` + `recordThrottle`/`countThrottle` kind `login_locked_probe`) thành hàm dùng chung `respondAccountLocked(...)`, gọi từ CẢ nhánh `lockedAt !== null` LẪN nhánh `reserveAccountGuess` trả `null`. Màn Đổi mật khẩu không có kiểu bcrypt-giả cân thời gian này nên không cần áp dụng tương tự (như bao-mat.md ghi rõ).
- **R5-4 (Thấp) - `logActivity` ném lỗi TRƯỚC `revokeSessions` có thể khiến tài khoản bị khoá nhưng phiên không được thu hồi (lỗi ném ra làm dừng hàm giữa chừng).**
  `src/server/actions.ts` (`changePasswordAction`): đổi thứ tự trong nhánh `justLocked` - gọi `revokeSessions` rồi `invalidateCurrentSessionCookie` TRƯỚC, `logActivity` chạy SAU CÙNG và được bọc `try/catch` riêng (lỗi ghi log chỉ log `e.name`, không ném ra ngoài action, không cản trở phần thu hồi phiên đã chạy xong).
- **R5-5 (Thấp, chủ dự án chốt 2026-09-28) - lượt khoá do đăng nhập sai (Q1=a, không đá phiên đang mở) có thể bị lợi dụng để né bị đá: đoán 4 lần ở Đổi mật khẩu (chưa chạm ngưỡng) + lần 5 ở Đăng nhập (khoá kiểu Q1=a, không đá phiên) - tổng vẫn đúng 5 lượt đoán nhưng phiên đang mở (đang đổi mật khẩu) không bị đá.**
  `src/server/actions.ts` (`changePasswordAction`): ở nhánh `account.lockedAt !== null` (tài khoản ĐÃ khoá từ trước, BẤT KỂ lý do/đường khoá), gọi `invalidateCurrentSessionCookie(user.email)` rồi mới trả `'locked'` - phiên đang cố đổi mật khẩu trên 1 tài khoản đã khoá luôn bị đăng xuất ngay, mỗi lần gọi (không chỉ 1 lần lúc vừa khoá). Q1=a ở màn Đăng nhập GIỮ NGUYÊN (không đá phiên đang mở do đăng nhập sai).
- **R5-6 (Thấp) - `revokeSessions` dùng `nowIso` chụp lúc ĐẦU request, có thể kéo `passwordChangedAt` LÙI LẠI nếu 1 thao tác KHÁC nhanh hơn đã ghi 1 mốc MỚI HƠN xen giữa.**
  `src/server/repo/prisma-repo-auth.ts`: `where` thêm điều kiện kiểu "GREATEST" (`OR: [{ passwordChangedAt: null }, { passwordChangedAt: { lt: now } }]`) - chỉ ghi khi CHƯA có mốc hoặc mốc hiện tại CŨ HƠN; `count === 0` do đã có mốc mới hơn vẫn trả `true` (tài khoản tồn tại, mọi phiên vẫn bị thu hồi nhờ mốc mới hơn đó) - chỉ `findUnique` thêm 1 lần để phân biệt với trường hợp KHÔNG có tài khoản (trả `false`). `mock-repo-auth.ts`: kiểm tương đương (`c.passwordChangedAt === null || c.passwordChangedAt < nowIso` mới ghi).

### Test mới/sửa (vòng sửa bảo mật 5)

- `src/server/repo/types.ts`: JSDoc `reserveAccountGuess` (mới) + cập nhật JSDoc `revokeSessions` (R5-6).
- `src/server/repo/mock-repo-auth.test.ts`: thêm `reserveAccountGuess` (còn chỗ, hết chỗ do held, tài khoản đã khoá, không có tài khoản, R5-2 cửa sổ 5 phút với ca "tua 6 giây", `releaseThrottle` trả lại chỗ); thêm 2 test `revokeSessions` R5-6 (không kéo lùi khi nowIso cũ hơn, ghi đè khi mới hơn).
- `src/server/repo/prisma-repo-auth.test.ts`: thêm `reserveAccountGuess` (mock Prisma, các nhánh còn chỗ/hết chỗ/đã khoá/không có tài khoản); sửa `revokeSessions` theo `where` mới (GREATEST) + thêm ca "count 0 vì đã có mốc mới hơn" và "count 0 vì không có tài khoản".
- `src/server/repo/prisma-repo-auth-real-db.test.ts`: thêm ca DB thật - `reserveAccountGuess` 10 lời gọi song song cùng email, threshold=5 -> đúng 5 id/5 null (advisory lock thật); tài khoản đang khoá -> null ngay; `revokeSessions` không bị kéo lùi khi gọi với mốc cũ hơn.
- `src/server/login-guard.test.ts`: thêm `reserveAccountGuess: vi.fn().mockResolvedValue(1)` vào `AuthStore` mock thủ công (lỗi tsc nếu thiếu); sửa test đếm `verifyPassword` của vòng 4 (nay lọc theo HASH THẬT, loại các lượt bcrypt giả của R5-3); thêm 2 test R5-1 (ca A: `registerFailedLogin` của lượt đầu treo, lượt thứ 6 không được bcrypt thật; ca B: 1 "kẻ giữ chỗ" treo giữa lúc verify, tổng bcrypt thật không vượt 5).
- `src/lib/auth-credentials-google-only.test.ts`: fixture `row()` thêm `lockedAt: null, failedLoginCount: 0` - từ vòng 5, `authorize` đi qua `reserveAccountGuess` (đọc `lockedAt` qua Prisma mock), fixture cũ thiếu field này bị hiểu nhầm `undefined !== null` là "đang khoá" (test đỏ phát hiện đúng lúc, không phải lỗi thiết kế, chỉ là fixture cũ thiếu field mới).
- `src/server/actions-change-password-lock.test.ts`: sửa test "đã khoá -> từ chối trước bcrypt" theo R5-5 (nay `invalidateCurrentSessionCookie` được gọi ở MỌI lần gọi trên tài khoản đã khoá, không chỉ lần vừa khoá); thêm test R5-4 (`logActivity` ném lỗi vẫn không cản `revokeSessions`/`invalidateCurrentSessionCookie`, action không ném lỗi ra ngoài); thêm test R5-5 riêng (tài khoản bị khoá qua đường KHÁC, gọi `changePasswordAction` với đúng mật khẩu vẫn bị đá phiên).

### Cổng kiểm (vòng sửa bảo mật 5)

- `npx tsc --noEmit`: sạch.
- `npm test`: **238 file / 2710 test** (2695 xanh + 15 skip - đúng 15 ca real-db, tăng từ 12 vì thêm 3 ca mới cho `reserveAccountGuess`/`revokeSessions` R5-6).
- Real-db (`DATABASE_URL` trỏ `ddc_control_tower_c`): `npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts` -> **15/15 xanh** (gồm ca 10 lời gọi `reserveAccountGuess` song song, đúng 5 id/5 null).
- e2e liên quan (`e2e/21*`, `22*`, `23*`, `24*`, `25*`, kèm 3 spec `auth.setup.ts`): **14/14 xanh**, không chập chờn (chạy 1 lần).
- Chưa chạy lại toàn bộ e2e (`npm run test:e2e`) và `npm run build` trong vòng này (ngoài phạm vi lệnh giao việc).

### Cho Tester nên soi kỹ (bổ sung riêng cho vòng sửa bảo mật 5 này)

1. **R5-1 (ca A/ca B)** - đây là 2 test mô phỏng bằng tay (điều khiển thời điểm `resolve` của `registerFailedLogin`/`verifyPassword`), không phải `Promise.all` thô - đáng kiểm lại logic mô phỏng có đúng tái hiện kịch bản thật hay không (đọc kỹ comment trong từng test); nếu nghi ngờ, có thể tạm revert `try/finally` về vị trí cũ (rút chỗ ngay sau bcrypt) để xác nhận test thật sự ĐỎ trước khi có bản sửa này.
2. **R5-3 (gộp nhánh hết chỗ với nhánh đã khoá)** - kiểm lại bằng đo thời gian thực tế (không chỉ đếm số lượt gọi DB) nếu có công cụ đo timing side-channel, giống lưu ý đã ghi ở vòng 1 cho S-3.
3. **R5-5** - xác nhận với chủ dự án: hành vi mới (đăng xuất phiên đang thao tác MỖI LẦN gọi `changePasswordAction` trên 1 tài khoản đã khoá, không chỉ lần đầu) có gây khó chịu cho người dùng hợp lệ hay không (ví dụ trình duyệt tự động gọi lại action do lỗi mạng) - hiện ưu tiên an toàn hơn trải nghiệm.
4. **R5-6** - so sánh chuỗi ISO 8601 bằng toán tử `<`/`<lt>` (Prisma) đúng thứ tự thời gian vì định dạng cố định (luôn có mili giây, luôn `Z`) - nếu sau này có nơi khác ghi `passwordChangedAt` bằng định dạng khác (không qua `toISOString()`), phép so này có thể sai; nên rà soát nếu phát hiện điểm ghi mới.

## Vòng sửa bảo mật 6 (bao-mat.md vòng 6: R6-1, R6-4; phiên điều phối C tự sửa)

- **R6-1 (lệch chốt R3-2 + R4-2).**
  `AuthStore.reserveAccountGuess(email, nowIso, sinceIso, threshold)` bỏ tham số `kind`, luôn dùng 1 kind chung `account_guess` (Prisma: advisory lock và đếm theo `account_guess:email`; bộ nhớ tương đương).
  `ThrottleKind` thay `login_fail_account` + `change_pwd_fail_account` bằng `account_guess`.
  Lý do chọn bỏ tham số thay vì chỉ đổi giá trị truyền vào: không nơi gọi nào có thể tách bộ đếm được nữa.
- **R6-4 (ghi nhận, sửa luôn vì rẻ và khớp chốt R5-5).**
  `changePasswordAction`: nhánh hết chỗ đọc lại `getAccountState`, tài khoản đã khoá thì `invalidateCurrentSessionCookie`; nhánh `resetFailedLogin` trả `false` thì đá phiên.
- **R6-2, R6-3, R6-5:** ghi nhận, không sửa (R6-2 được bù bằng test tích hợp chéo màn bên dưới).

### Test mới (vòng sửa bảo mật 6)

- `actions-change-password-lock.test.ts`: R6-1 (5 lượt `checkCredentials` sai đang giữ chỗ với bcrypt treo, `changePasswordAction` không được chạy bcrypt thật, trả `locked`; đỏ trên `d467732`: 6 lượt), R6-4 (3 ca: khoá xen giữa thì đá, hết chỗ mà chưa khoá thì không đá, `resetFailedLogin` false thì đá; 2 ca đỏ trên `d467732`).
- Test kho mock/prisma/real-db đổi theo chữ ký mới.

### Cổng kiểm (vòng sửa bảo mật 6)

- `npx tsc --noEmit`: sạch.
- `npm test`: 2699 xanh + 15 skip.
- Real-db: 15/15 xanh (chạy trước khi thêm R6-4, R6-4 không đổi kho).

## Vòng sửa sau reviewer (kiểm cuối, 2026-09-28)

Tester bị dừng giữa chừng (hết hạn mức phiên, HTTP 429) khi đang soi ảnh 390px; phiên điều phối C làm nốt và ghi mục này.

### Lỗi pixel tester phát hiện và sửa

- Modal "Đặt lại mật khẩu" và "Mở khoá + đặt mật khẩu tạm" trong `UserEditor.tsx` bị nhốt trong thẻ `.card` (có `backdrop-filter` tạo containing block mới cho `position: fixed`), cùng gốc với lỗi modal Đổi mật khẩu (e2e 25).
- Sửa: render cả 2 modal qua `createPortal(..., document.body)`.
- Test: thêm ca vào `e2e/21-khoa-tai-khoan.spec.ts` đo `.modal-scrim` phủ >= 90% viewport ở 1440 và 390.
- Phiên C xác nhận test đỏ trên bản chưa sửa (scrim rộng 1162px, cần > 1296px) rồi xanh sau khi sửa.
- Đã rà toàn bộ `src`: không còn lớp phủ `position: fixed` nào khác nằm trong thẻ có `backdrop-filter`.

### Ảnh đã chụp (`.bangiao/anh-tester/`, 1440 và 390)

- `quenmk-forgotSent-*`, `datlaimk-resetDone-*`, `datlaimk-resetDoneLocked-*`, `admin-modal-mokhoa-tam-*`, `changepw-done-*`, `admin-badges-1440`, `admin-badges-390-scrolled*`, `admin-locked-block-390`.
- Soi: modal phủ kín màn hình ở cả 2 bề rộng; chữ mới "sẽ bị đăng xuất trong vài phút" và badge "Ngưng sử dụng" không tràn, không xuống dòng xấu.
- Ghi nhận (không sửa, có từ trước Task 5-8): bảng người dùng ở trang Quản trị cuộn ngang ở cả 1440 và 390 (cột cuối nằm ngoài khung, cuộn tới được).

### Dọn dẹp

- Xoá `scripts/_tmp-regen-token.ts` (script tạm của tester), dừng dev server cổng 3003 tester bỏ lại.
- Xoá 3 kênh thông báo thừa trong DB `_c` (id 86 "Tester pixel smtp" do tester tạo; id 90, 91 do lượt e2e 07 bị dừng giữa chừng), làm e2e 07 và 22 đỏ trước khi dọn.
- Ghi nhận: e2e 07 không tự dọn kênh khi đỏ giữa chừng, dữ liệu thừa làm lượt sau đỏ theo; chưa sửa trong phase này.

### Cổng kiểm (commit cuối của phase)

- `npx tsc --noEmit`: sạch.
- `npm test`: 2700 xanh + 15 skip.
- Real-db (`DATABASE_URL` trỏ `ddc_control_tower_c`, `npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts`): 15/15 xanh.
- Toàn bộ e2e (`npx playwright test`): 98/98 xanh (sau khi dọn DB).
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=... npm run build`: qua.
