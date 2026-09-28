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
- R4 (vòng 2) = (a): giữ gom khoá `'unknown'` khi không xác định được IP; ở production `console.warn` tối đa 1 lần mỗi cửa sổ 15 phút khi gặp `'unknown'`; `/api/health` trả thêm cờ `clientIpResolved` (boolean, không lộ IP thật); ghi yêu cầu "bắt buộc reverse proxy nối X-Forwarded-For" vào checklist deploy (Task 8.4, `ke-hoach.md`) và `.env.example`.

---

# Vòng 2 - rà lại bản sửa L1-L8 (commit `33642e9..236da72`)

KET LUAN: KHONG DAT

Người rà: security-reviewer (chỉ đọc); điều phối viên ghi lại báo cáo.
Test đã chạy: 10 file liên quan, 104/104 xanh.
Lý do KHÔNG ĐẠT: bản sửa L7 mở đường lộ email mới (R1), và phần đếm theo IP của L3 vẫn còn race (R2).

## Trạng thái lỗi vòng 1

| Lỗi | Trạng thái |
|---|---|
| L1 | Đã đóng (`login-guard.ts:73`); chênh 2 thao tác DB giữa 2 nhánh, không đáng kể. |
| L2 | Đóng một phần: cách lấy IP đúng, dùng chung hàm; còn R3, R4, R5. |
| L3 | Đóng một phần: phần tài khoản đúng, `checkCredentials` chỉ có 1 đường `ok: true` (`login-guard.ts:101`) và luôn qua `resetFailedLogin`; phần IP còn R2. |
| L4 | Đã đóng. |
| L5 | Đã đóng ở mock và interface; bản Prisma và FK cascade: chưa tới lượt. |
| L6 | Đã đóng; góp ý R6. |
| L7 | Đúng quyết định (b) nhưng mở R1. |
| L8 | Đã đóng; góp ý R7. |
| 0509cde | Không có vấn đề bảo mật; chỉ dùng ở `createAccountAction` (có `requireRole`), khớp `normalizeEmail`. Ghi chú: `actions.ts:351` gọi `.toLowerCase()` thừa; `resetPasswordSchema` không trim nên báo `too_short` sai lý do. |

## Lỗi còn lại

**R1. [Trung bình] Bản sửa L7: tài khoản chỉ Google không bao giờ báo `locked`, email lạ thì báo, nên lộ email tồn tại**

- File: `src/server/login-guard.ts:78-85`; test "L7 ... 10 lần -> invalid" đang khoá cứng hành vi này.
- K6 yêu cầu email lạ sai 5 lần cũng báo "đã khoá" như tài khoản thật; hiện email lạ và tài khoản có mật khẩu báo `locked` từ lần 5, tài khoản chỉ Google báo `invalid` mãi.
- Khai thác: sai 5 lần cho email X, lần 6 vẫn `invalid` thì X là tài khoản thật loại chỉ Google.
- Sửa (giữ L7 b): nhánh chỉ Google đi y hệt nhánh email lạ (ghi throttle theo email, `recordIpFail()`, đếm cùng cửa sổ, đủ 5 thì trả `locked`), KHÔNG gọi `registerFailedLogin`, KHÔNG đặt `lockedAt`.
- Test: lần 1-4 `invalid`, lần 5 `locked`, `failedLoginCount` 0, `lockedAt` null, `googleAccessDecision` vẫn `allow`; thêm test bảng so `reason` của 3 loại email qua 6 lần sai phải giống nhau.

**R2. [Trung bình] Giới hạn IP đếm xong mới ghi, bắn song song vượt ngưỡng 20/15 phút**

- File: `src/server/login-guard.ts:48-57`; cùng lỗi ở `password-reset.ts:102-110`.
- Khai thác: 1 IP bắn cùng lúc 1000 request cho khoảng 250 email, mỗi email 4 mật khẩu; mọi request đọc count < 20 trước khi ghi.
- Sửa: ghi trước, đếm sau (đếm cả dòng vừa ghi); hoặc bộ đếm nguyên tử `INSERT ... ON CONFLICT DO UPDATE SET n = n + 1 RETURNING n` ở Prisma store (Task 5). Reset làm tương tự.
- Test: `Promise.all` 30 request sai từ 1 IP, số request tới bcrypt phải <= 20.

**R3. [Thấp, bắt buộc trước Task 6/7] Lõi vẫn bỏ giới hạn IP khi `ip === ''`**

- File: `login-guard.ts:48`, `:56`; `password-reset.ts:102`, `:110`; test `login-guard.test.ts:229`; plan dòng 389 và 418 còn luật cũ.
- Bên gọi ở Task 6/7 truyền `''` là quay lại fail-open.
- Sửa: `const ipKey = ip.trim() || 'unknown'`, luôn đếm, luôn ghi; sửa test và plan.

**R4. [Thấp, trung bình nếu deploy không có reverse proxy] Khoá chung `'unknown'` thành cách DoS toàn hệ thống**

- File: `src/lib/client-ip.ts:32` phối hợp `login-guard.ts:50` (20/15 phút) và `password-reset.ts:102` (10/giờ).
- Không có proxy thì mọi người dùng chung khoá `'unknown'`: 20 lần sai là cả công ty bị chặn 15 phút; kẻ tấn công lại né được bằng XFF tự gửi.
- Là rủi ro theo cấu hình; chờ chủ dự án chọn: (a) cảnh báo + checklist deploy bắt buộc có proxy + cờ `clientIpResolved` ở `/api/health` (đề xuất); (b) ngưỡng riêng cao hơn cho `'unknown'`; (c) `TRUSTED_PROXY_HOPS=0` tắt giới hạn IP có chủ đích.

**R5. [Thấp] Proxy chỉ đặt `X-Real-IP` thì XFF do client gửi được tin trước**

- File: `src/lib/client-ip.ts:17-31`.
- Sửa: thêm `CLIENT_IP_HEADER=xff|x-real-ip` (mặc định `xff`), hoặc ghi rõ trong `.env.example` và checklist deploy rằng proxy bắt buộc nối `X-Forwarded-For`; sửa chú thích `client-ip.ts:9-10`.

**R6. [Thấp] Hàng đợi nền quên mật khẩu chạy nối tiếp, một việc treo thì chặn mọi việc sau; chưa có test lỗi nền**

- File: `src/server/password-reset.ts:111-116`.
- Sửa: timeout (ví dụ 30 giây) hoặc bỏ nối tiếp, mỗi việc chạy độc lập kèm `.catch`; test việc đầu ném lỗi thì việc sau vẫn gửi, log không chứa token hay email.

**R7. [Thấp] L8 ghi dữ liệu Google chưa xác minh vào `activity_log`, không giới hạn độ dài và tần suất**

- File: `src/lib/auth.ts:152`, `src/lib/activity.ts:13-17`, `prisma-repo.ts:664-667`.
- Nhánh `unverified` cho phép khai email người khác, admin dễ hiểu nhầm; `name` tuỳ ý; không trần số dòng. React đã escape nên không có XSS.
- Sửa: cắt `userEmail` <= 254, `userName` <= 100, `userAgent` <= 256, `detail` <= 500 trong `logActivity`; nhánh `unverified` đặt `name` cố định; giới hạn ghi `login_google_denied` (dùng `auth_throttle` khi Task 5 có bảng).

## Chưa tới lượt (Task 5-8)

- Prisma store: `resetFailedLogin` có điều kiện, `registerFailedLogin` nguyên tử, `consumeResetToken` kiểm `isActive`/hash, FK cascade token.
- `googleAccessDecision` nhận `lockedAt` thật; `authorize` nối `checkCredentials`; action quên mật khẩu lấy IP qua `clientIpFrom`.
- Checklist deploy về proxy (R4, R5); kiểm lại S1, S2, S4-S6 trên Prisma, S8, S11, S12, S15, e2e 21 và 22.

## Việc cần coder sửa ở vòng 2

Bắt buộc: R1, R2, R3.
Nên sửa: R6, R7, R5.
Chờ chủ dự án chọn: R4.

---

# Vòng 3 - rà lại bản sửa R1-R7 (commit `33b0e3f`, diff `26529a8..HEAD`)

KET LUAN: KHONG DAT

Người rà: security-reviewer (chỉ đọc); điều phối viên ghi lại báo cáo.
Test đã chạy: 8 file liên quan, 110/110 xanh.
Lý do KHÔNG ĐẠT: bản sửa R2 ở `requestPasswordReset` đặt chỗ theo email TRƯỚC IP, nên một IP đã hết lượt vẫn đốt được lượt xin link của mọi email (N1).
R1, R3, R4, R6, R7 đã đóng đúng gốc; R5 chấp nhận được.

## Trạng thái lỗi vòng 2

| Lỗi | Trạng thái |
|---|---|
| R1 | Đã đóng: nhánh chỉ Google (`login-guard.ts:87-99`) dùng chung kho `login_fail_unknown_email`, không `registerFailedLogin`, không `lockedAt`; bảng 3 loại email qua 6 lần ra cùng `invalid x4, locked x2`. Chênh 1-2 lượt DB không đáng kể so với bcrypt. Xem G1. |
| R2 | Đóng ở `checkCredentials` và kho bộ nhớ; `requestPasswordReset` mở N1; hợp đồng Prisma gợi ý SQL không nguyên tử (N2). |
| R3 | Đã đóng (`login-guard.ts:53`, `password-reset.ts:130`); kế hoạch còn chữ cũ (N3). |
| R4 | Đã đóng theo (a): `clientIpResolved` chỉ boolean; `console.warn` chuỗi cố định, chỉ production, tối đa 1 lần/15 phút. Cờ không phát hiện được cấu hình R5. |
| R5 | Chấp nhận, với điều kiện checklist deploy Task 8.4 bắt buộc proxy nối thêm vào XFF. |
| R6 | Đã đóng: timeout 30 giây có test ném lỗi và treo; việc chạy ngầm sau timeout không mở lỗ (hạn token tính theo lúc nhận yêu cầu). Task 5: log `e.name`/mã lỗi thay vì `message` của Prisma. |
| R7 | Đã đóng phần làm được (`activity.ts:27-34`, `auth.ts:162`); giới hạn tần suất ghi `login_google_denied`: chưa tới lượt (Task 5). |

## Lỗi còn lại

**N1. [Trung bình, lỗ mới do bản sửa R2] Đặt chỗ throttle theo email trước IP**

- File: `src/server/password-reset.ts:135-136`.
- IP đã hết 10/giờ vẫn ghi dòng email trước khi bị chặn, nên 1 IP khoá được quên mật khẩu của toàn công ty (nạn nhân nhận `accepted` mà không có mail).
- Sửa: đặt chỗ `reset_req_ip` trước, chỉ khi còn lượt mới đặt chỗ `reset_req_email`.
- Test: IP X gửi 10 yêu cầu cho 10 email rác, yêu cầu thứ 11 cho V bị chặn và `countThrottle('reset_req_email', V)` vẫn 0; từ IP Y, V vẫn nhận đủ mail.

**N2. [Thấp ở Task 1-4, bắt buộc sửa trước Task 5] SQL gợi ý cho `reserveThrottle` bản Prisma không nguyên tử; `releaseThrottle` khoá theo timestamp**

- File: `src/server/repo/types.ts:623-642` (dòng 629), `.bangiao/ke-hoach.md:393-396`.
- `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < $limit` ở READ COMMITTED không nguyên tử, R2 sẽ quay lại nếu Task 5 làm theo.
- `releaseThrottle` theo `createdAt` nếu viết bằng `deleteMany` có thể xoá luôn các dòng sai trùng mili giây.
- Bản bộ nhớ hiện tại đúng (`splice` đúng 1 dòng), đăng nhập đúng xen kẽ không reset được quota IP.
- Sửa hợp đồng và kế hoạch: `reserveThrottle` trong transaction có `pg_advisory_xact_lock(hashtext(kind || ':' || key))` (hoặc SERIALIZABLE kèm thử lại), ghi rõ INSERT SELECT đơn thuần là KHÔNG ĐỦ; `reserveThrottle` trả id dòng, `releaseThrottle(id)` xoá theo id (cấm `deleteMany`).
- Test Task 5 trên DB thật: 30 lời gọi song song, limit 20, đúng 20 true; release khi 2 dòng trùng `createdAt` chỉ xoá 1.

**N3. [Thấp, tài liệu] Kế hoạch còn luật cũ mâu thuẫn code**

- File: `.bangiao/ke-hoach.md:399`, `:401`, `:409`, `:424`.
- Sửa theo code hiện tại (và thứ tự IP rồi email của N1).

**N4. [Thấp, thiếu test] Chưa có test tầng `checkCredentials` chứng minh đăng nhập đúng xen kẽ không làm giảm số lần sai theo IP**

- Test đề nghị: 19 lần sai từ IP X, 5 lần đúng từ X, lần sai thứ 20 vẫn `invalid`, lần kế tiếp `ip_limited`; `countThrottle('login_fail_ip', X)` bằng 20.

## Ghi chú (không chặn)

- G1: tài khoản chỉ Google thừa hưởng giới hạn đã biết K6 (phân biệt được bằng cách chậm hơn 24 giờ); ghi thêm vào mục giới hạn đã biết ở `thay-doi.md`.
- G2: `checkCredentials` dùng `email` thô làm khoá throttle email lạ; thêm `email.trim().toLowerCase()` phòng thủ trong `checkCredentials`.

## Việc cần coder sửa ở vòng 3

Bắt buộc: N1, N2.
Nên sửa: N3, N4, G2.
Nếu chỉ còn N3, N4, G1, G2 thì có thể coi là ĐẠT cho phạm vi Task 1-4.

# Vòng 4 - rà lại bản sửa N1-N4 (commit `47a8652` code, `5468a3a` tài liệu, diff `aa197f1..HEAD`)

KET LUAN: DAT

Người rà: security-reviewer (chỉ đọc), skill đã dùng: `ddc-tower:security-review`; điều phối viên ghi lại báo cáo.
Phạm vi: phần Task 1-4 của P3E; Task 5-8 chưa tới lượt nên không tính là thiếu.
Test tự chạy: `login-guard.test.ts`, `password-reset.test.ts`, `repo/mock-repo-auth.test.ts` được 3 file, 58/58 xanh.
Test tự chạy thêm: 12 file auth liên quan (`src/lib/auth-*.test.ts`, `app-pages-auth-guard`, `auth-mail`, `authz`, `login-reset-integration`, `middleware-auth`, `middleware-auth.qa`, `reset-data-removed`) được 120/120 xanh.
`npx tsc --noEmit`: exit 0, không lỗi.
Không chạy lại toàn bộ `npm test`; con số 218 file / 2433 test là theo `thay-doi.md` của coder.
Lý do ĐẠT: N1, N2 (phần hợp đồng và kho bộ nhớ), N3, N4, G2 đều đã đóng đúng gốc; bản sửa không mở lỗ mức trung bình hay cao; chỉ còn vấn đề mức thấp và ghi chú cho Task 5.

## Trạng thái lỗi vòng 3

| Lỗi | Trạng thái |
|---|---|
| N1 | Đã đóng: `password-reset.ts:141-144` đặt chỗ `reset_req_ip` trước, IP hết chỗ thì trả `accepted` ngay và không đụng email; `:146-151` chỉ đặt chỗ email khi IP còn chỗ, email hết chỗ thì `releaseThrottle(ipReserved)`. Test N1 (`password-reset.test.ts:332-363`) chứng minh đúng kịch bản vòng 3 yêu cầu. Việc nhả chỗ IP có hệ quả phụ mức thấp, xem L1. |
| N2 | Đã đóng phần làm được ở Task 1-4: `types.ts:644` trả `Promise<number \| null>`, `:655` đổi thành `releaseThrottle(id: number)`; JSDoc `:628-655` bắt buộc `pg_advisory_xact_lock(hashtext(kind \|\| ':' \|\| key))` trong transaction, ghi rõ INSERT SELECT ở READ COMMITTED là KHÔNG ĐỦ, cấm `deleteMany` lọc theo `kind/key/createdAt`. Kho bộ nhớ (`mock-repo-auth.ts:124-137`) cấp `id` tăng dần và xoá đúng 1 dòng theo `id`. Cả 2 nơi gọi (`login-guard.ts:68-74`, `password-reset.ts:141-150`) khớp chữ ký mới và so `=== null`. Model `AuthThrottle.id Int @default(autoincrement())` trong kế hoạch (`ke-hoach.md:539`) khớp kiểu `number`. Phần Prisma để Task 5. |
| N3 | Đã đóng: `ke-hoach.md:388-437` khớp code (G2 chuẩn hoá email, IP trước email, hợp đồng `id`, nhánh chỉ Google chung kho email lạ, `resetFailedLogin` luôn gọi, bỏ `rate_limited`, `no_account` ghi tên cố định); test-plan 4.4 và 4.5 đã cập nhật. |
| N4 | Đã đóng: test `login-guard.test.ts:296-321` dùng 19 email lạ khác nhau, 5 lần đúng xen giữa, lần sai thứ 20 `invalid`, lần 21 `ip_limited`, đếm bằng 20. Test bắt được cả 2 kiểu hỏng: không nhả và nhả quá tay. |
| G1 | Đã ghi vào `thay-doi.md` và `ke-hoach.md:423-424` như giới hạn đã biết. |
| G2 | Đã đóng: `login-guard.ts:56` chuẩn hoá `input.email.trim().toLowerCase()` trước mọi khoá throttle và `getAccountState`; test `login-guard.test.ts:324-333` với 3 biến thể ra cùng 1 khoá, đếm 3. |

## Lỗi còn lại

**L1. [Thấp, hệ quả phụ của bản sửa N1] Email đã hết lượt thì yêu cầu xin link không còn bị tính vào giới hạn IP, nên có thể gửi vô hạn**

- File: `src/server/password-reset.ts:146-151`.
- Cách khai thác: làm hết 3 lượt/giờ của một email E, sau đó gửi liên tục yêu cầu cho E từ cùng 1 IP; mỗi yêu cầu đặt chỗ IP rồi nhả ngay, bộ đếm IP không bao giờ tăng.
- Tác động: không gửi mail, không ghi `activity_log`, không lộ email tồn tại; thiệt hại duy nhất là 3 lượt gọi DB mỗi yêu cầu, không có trần theo IP.
- Đánh giá: chấp nhận được cho Task 1-4, nhưng phải quyết trước khi chạy Prisma thật (Task 5).
- Cách sửa, chọn 1 trong 2:
  - (a, khuyên dùng) bỏ `releaseThrottle(ipReserved)` ở nhánh email hết lượt; N1 vẫn đóng. Cái giá: người dùng thật sau cùng 1 IP văn phòng tự bấm quá 3 lần sẽ ăn chung 10/giờ của văn phòng.
  - (b) giữ việc nhả chỗ nhưng thêm giới hạn tần suất ở tầng route hoặc proxy (Task 8, checklist deploy).
- Test đề nghị với (a): làm hết lượt email E từ IP X, gửi thêm 20 yêu cầu cho E từ X, rồi `countThrottle('reset_req_ip', X)` bằng 10 và 1 email khác từ X bị chặn.

**L2. [Thấp, thiếu test] Chưa có test cho nhánh "email hết lượt thì nhả chỗ IP" ở `requestPasswordReset`**

- File: `src/server/password-reset.ts:147-151`.
- Nếu giữ hành vi nhả chỗ (L1 phương án b): từ IP X gửi 5 yêu cầu cho cùng email E, `countThrottle('reset_req_ip', X)` bằng 3, `countThrottle('reset_req_email', E)` bằng 3.
- Nếu chọn L1 phương án (a) thì thay bằng test của L1.

## Ghi chú (không chặn)

- G3 (Task 5): advisory lock phải chạy trên cùng kết nối với câu đếm và câu ghi, tức là trong `prisma.$transaction(async (tx) => { ... })` và gọi qua `tx`.
- G3 (tiếp): `pg_advisory_xact_lock` trả kiểu `void`, dùng `tx.$executeRaw` hoặc ép `::text`.
- G3 (tiếp): test concurrency trên DB thật (30 lời gọi song song, limit 20, đúng 20 id khác null; release khi 2 dòng trùng `createdAt` chỉ xoá 1).
- G4 (Task 5): không dùng chung `kind` `login_fail_unknown_email` để giới hạn ghi `login_google_denied` như chú thích `src/lib/auth.ts:156-161` gợi ý; nên thêm loại riêng, ví dụ `google_denied`.
- G5: nếu `releaseThrottle` ném lỗi thì `requestPasswordReset` ném theo, hỏng theo hướng an toàn; route ở Task 5-6 phải bọc lỗi thành phản hồi chung, không lộ `message` của Prisma.
- G6: với Prisma, trong khoảng ngắn giữa đặt chỗ và nhả chỗ IP, yêu cầu đồng thời cùng IP có thể bị chặn nhầm tạm thời; không đáng kể.
- G7: nhánh nhả chỗ IP thêm 1 lượt gọi DB, đo thời gian có thể biết email đang hết lượt; không lộ email có tồn tại hay không, không đáng kể.

## Quyết định của chủ dự án (2026-09-28)

L1: chọn phương án (b), không tính lượt bấm dư của 1 email vào hạn mức IP.
Lý do nghiệp vụ: một người bấm quá tay không được làm đồng nghiệp chung mạng văn phòng mất lượt xin link.
Giữ nguyên `releaseThrottle(ipReserved)` ở `password-reset.ts`; chặn spam bằng giới hạn tần suất ở reverse proxy, đã ghi vào checklist deploy Task 8.4 trong `ke-hoach.md`.
L2: đã thêm test `password-reset.test.ts` "L2 (bao mat vong 4 ...)" chốt hành vi nhả chỗ IP; đã kiểm bằng cách tạm bỏ dòng nhả chỗ thì test đỏ (`expected 10 to be 3`).
