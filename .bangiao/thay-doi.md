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
