# Rà soát bảo mật P3E - lượt trước một phần (Task 1-4)

PHAN QUYET BAO MAT: LO HONG
KET LUAN: KHONG DAT (lượt rà trước một phần, chỉ Task 1-4, diff `7b6603e..HEAD`)

Người rà: security-reviewer (chỉ đọc, không có quyền ghi file); điều phối viên ghi nguyên văn báo cáo vào file này.
Skill đã dùng: `ddc-tower:security-review`.
Không pentest vì hạ tầng Task 4 chưa nối vào route thật; không truy vấn DB vì Task 1-4 không đổi schema.

## Phạm vi và cách kiểm

- Lượt rà trước một phần, gồm 4 commit: `6139f72` (tỷ giá nhập tay), `b6056a0` (gỡ ảnh hiện trường), `c2ffe96` (đăng nhập Google theo danh sách admin), `3414fff` (hạ tầng khoá đăng nhập và đặt lại mật khẩu).
- Task 5-8 chưa làm vì C đang giữ khoá schema; yêu cầu thuộc Task 5-8 ghi "chưa tới lượt", không tính là trượt.
- Đã đọc toàn bộ: `src/lib/auth.ts`, `src/server/google-access.ts`, `src/lib/reset-token.ts`, `src/lib/client-ip.ts`, `src/lib/login-policy.ts`, `src/server/login-guard.ts`, `src/server/password-reset.ts`, `src/server/auth-mail.ts`, `src/server/repo/mock-repo-auth.ts`.
- Đã đọc phần diff của `actions.ts`, `validation.ts`, `dispatch.ts`, `types.ts`, `jobs.ts`, `cron/[job]/route.ts`, `actions-master.ts`.
- Đã chạy 10 file test bảo mật liên quan: 73/73 xanh.
- KHONG DAT vì hạ tầng Task 4 còn 3 lỗi mức trung (L1, L2, L3).
- Cả 3 hiện chưa khai thác được trên hệ thống chạy thật vì `checkCredentials` và `requestPasswordReset` chưa nối vào auth, nhưng phải sửa trước khi Task 6 nối vào đăng nhập.
- Task 1, 2, 3 tự thân đạt.

## Lỗ hổng theo mức độ

### Cao

Không có.

### Trung

**L1. Timing oracle ở nhánh "tài khoản đang khoá" làm lộ email tồn tại (vi phạm S3/K6)**

- File: `src/server/login-guard.ts:62-65`.
- Nhánh `account.lockedAt !== null` trả `locked` ngay, không chạy bcrypt.
- Nhánh email lạ (dòng 53-60) luôn chạy `verifyPassword(password, DUMMY_HASH)`, kể cả khi đã đủ 5 lần và cũng báo `locked`.
- Khai thác: gửi 5 lần sai cho email X rồi đo lần thứ 6; tài khoản thật đã khoá trả nhanh hơn email lạ khoảng một lượt bcrypt cost 10 (50-100 ms).
- Chỉ cần 1 mẫu là phân biệt được, dò được email nào có tài khoản, kèm theo khoá luôn tài khoản nạn nhân.
- Vá: trong nhánh locked chạy `verifyPassword(password, DUMMY_HASH)` trước khi `return`; thêm test so số lần gọi bcrypt ở 2 nhánh.

**L2. `clientIpFrom` tin phần tử ĐẦU của `X-Forwarded-For`, giả được IP; thiếu header thì bỏ giới hạn IP (fail-open)**

- File: `src/lib/client-ip.ts:8-9`; cùng lỗi ở `src/lib/activity.ts:10`, `app/api/export/route.ts:18`, `app/api/health/route.ts:7`.
- Phần tử đầu của XFF là giá trị client tự gửi.
- Cấu hình phổ biến (nginx `proxy_add_x_forwarded_for`, nhiều LB) nối thêm vào cuối chứ không ghi đè.
- Yêu cầu "proxy phải ghi đè" (K13) mới là ghi chú, code không ép.
- Khai thác: mỗi request gửi `X-Forwarded-For: <ngẫu nhiên>` là vô hiệu giới hạn IP của đăng nhập sai (20/15 phút, S6) và xin link đặt lại (10/giờ, S4).
- Từ đó password spraying không giới hạn trên nhiều tài khoản (mỗi email 4 lần, không khoá) và làm ngập `auth_throttle`.
- Không có header (`ip = ''`) cũng bỏ qua giới hạn IP (`login-guard.ts:40`, `password-reset.ts:48`).
- Vá: thêm cấu hình `TRUSTED_PROXY_HOPS` (mặc định 1), lấy phần tử thứ N tính từ PHẢI của XFF; hoặc chỉ đọc `x-real-ip` do proxy đặt.
- Dùng chung 1 hàm cho `activity.ts`, `export`, `health`.
- Không lấy được IP thì gom vào khoá `'unknown'` chứ không bỏ giới hạn; nếu giữ K13 thì ít nhất cảnh báo lúc khởi động ở production.
- Đụng quyết định K13, cần chủ dự án xác nhận.

**L3. Race TOCTOU trong `checkCredentials`: đoán song song vượt ngưỡng khoá 5 lần**

- File: `src/server/login-guard.ts:51` (đọc `getAccountState`), `:62` (kiểm `lockedAt`), `:70-80` (`registerFailedLogin`, `resetFailedLogin`); kiểm IP dòng 40-45 cũng là đếm rồi mới ghi.
- Khai thác: bắn N request song song với N mật khẩu khác nhau; tất cả cùng đọc `lockedAt = null` trước khi request nào ghi bộ đếm, nên cả N đều chạy bcrypt.
- Nếu có mật khẩu đúng trong N, request đó trả `ok: true` dù các request khác đã đẩy tài khoản vào trạng thái khoá; kết hợp L2 thì không bị giới hạn IP chặn.
- Vá (bắt buộc cho Prisma store ở Task 5/6): `registerFailedLogin` là 1 câu `UPDATE ... SET failed_login_count = failed_login_count + 1, locked_at = CASE ... END ... RETURNING`.
- Nhánh đúng mật khẩu xác nhận lại nguyên tử, ví dụ `UPDATE ... SET failed_login_count = 0 WHERE email = $1 AND locked_at IS NULL`; 0 dòng thì trả `locked`.
- Thêm test "5 request sai đồng thời, 1 request đúng đồng thời, đúng không được vào khi đã khoá".

### Thấp

**L4. Nhánh `rate_limited` của quên mật khẩu ghi `activity_log` mỗi request, không giới hạn**

- File: `src/server/password-reset.ts:50-53`; nhánh `no_account` (dòng 59-61) ghi chuỗi email do kẻ tấn công chọn.
- Khai thác: spam endpoint (khi Task 7 nối vào) làm phình `activity_log`, ngập nhật ký admin; retention 14 ngày nhưng không có trần số dòng.
- Vá: không ghi log ở nhánh `rate_limited` (hoặc chỉ lần đầu mỗi cửa sổ); nhánh `no_account` cân nhắc không lưu email thô.

**L5. `consumeResetToken` (bản mock) không kiểm lại `isActive` và `passwordHash !== ''` lúc tiêu token**

- File: `src/server/repo/mock-repo-auth.ts:130-144`; `peekResetToken` (dòng 125-126) có kiểm, `consume` thì không.
- Khai thác: token được cấp, sau đó admin tắt tài khoản; người cầm link vẫn đặt được mật khẩu, bật lại tài khoản thì mật khẩu đó còn hiệu lực.
- Vá: `consume` kiểm cùng điều kiện với `peek`; ghi ràng buộc vào comment interface `AuthStore.consumeResetToken` (`types.ts`) để Prisma store Task 5 làm giống.
- Token nên gắn FK cascade theo tài khoản để xoá rồi tạo lại cùng email thì token cũ mất.

**L6. Timing ở `requestPasswordReset`: nhánh có tài khoản làm thêm việc đồng bộ**

- File: `src/server/password-reset.ts:72-78` (`replaceResetToken`, `compose`/`getTranslations`, `logActivity` đều được `await` trước khi trả).
- Mức thấp vì mỗi email chỉ 3 mẫu/giờ, sau đó rơi vào `rate_limited` đồng nhất.
- Vá: đẩy khối sinh token, lưu, soạn và gửi mail vào hàng đợi nền (giống `queueAuthEmail`), trả `accepted` ngay sau khi ghi throttle.

**L7. Khoá tài khoản chỉ Google qua form mật khẩu (DoS)**

- File: `src/server/login-guard.ts:67-77` phối hợp `src/server/google-access.ts:26`.
- Khai thác: biết email người dùng chỉ Google, nhập sai 5 lần ở form mật khẩu; tài khoản bị khoá và từ Task 6 `googleAccessDecision` từ chối cả đăng nhập Google.
- Admin cũng khoá được theo cách này, khi đó chỉ còn lệnh `unlock-account` trên server.
- Là hệ quả của K5 ("admin cũng bị khoá"), có lối thoát là lệnh CLI.
- Chờ chủ dự án chọn: (a) giữ như kế hoạch; (b) tài khoản chỉ Google không tăng bộ đếm khi sai ở form mật khẩu (reviewer đề xuất b).

**L8. Từ chối đăng nhập Google không để lại dấu vết**

- File: `src/lib/auth.ts:150`: `return false` không `logActivity`.
- Hậu quả: admin không thấy ai đã thử vào bằng Gmail không có trong danh sách.
- Vá: ghi `login_google_denied` kèm decision (`unverified`, `not_found`, `inactive`, `locked`), không ghi token.

## Đối chiếu "Yêu cầu bảo mật phải kiểm được"

| # | Kết quả lượt này |
|---|---|
| S1 | Code đạt: 32 byte `randomBytes`, base64url 43 ký tự, chỉ lưu SHA-256 hex, kiểm dạng regex trước khi tra; tra theo hash nên không cần `timingSafeEqual`. Schema: chưa tới lượt. |
| S2 | Logic đạt trên mock: TTL 30 phút, dùng 1 lần, xin mới thì xoá token cũ, `consume` vô hiệu mọi token của email. Prisma và e2e 22: chưa tới lượt. |
| S3 | KHÔNG ĐẠT: L1, phụ thêm L6. Giá trị trả về đã đồng nhất `accepted`. |
| S4 | Logic đạt: 3/giờ/email, 10/giờ/IP, ghi throttle trước khi tra tài khoản. Bị L2 làm yếu. Bảng DB: chưa tới lượt. |
| S5 | Logic đạt: ngưỡng 5, `justLocked` ghi `login_locked`. Bị L3. Lưu DB: chưa tới lượt. |
| S6 | Logic đạt nhưng bị L2 vô hiệu nếu proxy nối XFF. `auth-authorize.test.ts`: chưa tới lượt. |
| S7 | Đạt: `consume` giữ nguyên `lockedAt` và bộ đếm khi đang khoá. |
| S8 | Chưa tới lượt: `passwordChangedAt` chưa được `jwt` đọc. |
| S9 | Đạt: `email_verified !== true` thì từ chối; không có trong `user_roles` hoặc `isActive=false` thì từ chối; không tự tạo viewer; email hạ chữ thường; `jwt` kiểm lại mỗi 5 phút. `lockedAt` thật: chưa tới lượt. |
| S10 | Đạt: không còn đọc `ALLOWED_EMAIL_DOMAINS`/`ROLE_SEED` ở file nguồn nào. |
| S11 | Đạt ở tầng hàm (link dựng từ `baseUrl`). Phía gọi truyền `NEXTAUTH_URL`: chưa tới lượt. |
| S12 | Đạt phần `isResetTokenUsable` (chỉ `peek`). Metadata `referrer`: chưa tới lượt. |
| S13 | Đạt: không log địa chỉ, nội dung, token hay link. |
| S14 | Đạt: `app/api` chỉ còn `auth`, `cron`, `export`, `health`, `report`, `templates`; không còn action/đường ghi file ảnh; thư mục `data` rỗng. |
| S15 | Chưa tới lượt. |
| S16 | Đạt: `resolveAccess`/`findAccount` trả `null` khi DB lỗi; `jwt` gắn `invalid=true`, `session` xoá email. |

## Các điểm đã soi và không có lỗi

- Tài khoản chỉ Google (`passwordHash = ''`) không đăng nhập được bằng credentials: `auth.ts:125` trả `null` trước bcrypt; `login-guard.ts:67-68` coi là sai và vẫn chạy bcrypt giả; `changePasswordAction` (`actions.ts:334`) chặn hash rỗng; quên mật khẩu không cấp token cho tài khoản chỉ Google.
- `createAccountAction`: `requireRole(['admin'])` trước mọi xử lý; zod `email()` loại khoảng trắng và CRLF; email hạ chữ thường, kiểm trùng; bắt P2002 cho race; email là khoá chính nên không tạo được bản trùng; mật khẩu là `''` hoặc tối thiểu 8 ký tự.
- Chèn header email: `to` luôn lấy từ DB, subject từ i18n, nodemailer lọc CRLF.
- `smtpConfigFromChannel`: chỉ tách hàm, mật khẩu SMTP mở từ `secret-box`, không trả ra client, không log.
- Task 1: không còn `fetch` ra Vietcombank; cron chỉ nhận `alerts_daily`, tên lạ trả 404; vẫn so bí mật cron bằng `safeEqual`; `fetchRatesNowAction` đã xoá.
- Còn `admin/page.tsx:107` đọc `getRecentJobRuns('rates_monthly')`, chỉ đọc nên vô hại; dọn khi C nhả khoá.

## Việc cần coder sửa

Bắt buộc, trước hoặc trong Task 6:

1. L1: bcrypt giả ở nhánh locked `src/server/login-guard.ts:62-65`, kèm test.
2. L2: sửa `src/lib/client-ip.ts` theo số hop proxy tin cậy hoặc chỉ tin `x-real-ip`; IP rỗng không được bỏ giới hạn; dùng chung cho `activity.ts`, `export`, `health` (chờ chủ dự án xác nhận vì đụng K13).
3. L3: `registerFailedLogin` và nhánh đúng mật khẩu thành thao tác nguyên tử có điều kiện `locked_at IS NULL` trong Prisma store (Task 5/6), kèm test đồng thời.

Nên sửa:

4. L4: bỏ log ở nhánh `rate_limited`, không lưu email thô ở nhánh `no_account`.
5. L5: `consumeResetToken` kiểm `isActive` và hash khác rỗng, ghi ràng buộc vào interface `AuthStore`.
6. L6: chuyển sinh và gửi token sang hàng đợi nền.
7. L8: log các lần Google bị từ chối.

Chờ chủ dự án chọn:

8. L7: tài khoản chỉ Google có bị khoá vì sai ở form mật khẩu không (đề xuất b: không).

Lượt rà sau (sau Task 5-8) cần kiểm lại S1 (schema), S2, S4-S6 trên Prisma, S8, S11, S12, S15, cùng e2e 21 và 22.

## Quyết định của chủ dự án (2026-09-27)

- L7 = (b): tài khoản chỉ Google (không có mật khẩu) KHÔNG tăng bộ đếm sai và KHÔNG bị khoá vì nhập sai ở form mật khẩu.
- L2: thêm cấu hình số tầng proxy tin cậy (`TRUSTED_PROXY_HOPS`, mặc định 1), lấy IP từ phải của `X-Forwarded-For`; không xác định được IP thì gom vào khoá `'unknown'` chứ không bỏ giới hạn; dùng chung hàm cho `activity.ts`, `export`, `health`. Thay cho ghi chú K13.
