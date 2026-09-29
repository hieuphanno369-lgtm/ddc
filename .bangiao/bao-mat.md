PHAN QUYET BAO MAT: DAT

# Rà soát bảo mật P3F vòng 2 - CHỐT

Nhánh `feature/p3f-dang-nhap-moi`, diff `2a2802f..8986f79` (các commit `592f136`, `431b1be`, `8986f79`), có soi thêm tương tác với luồng đặt lại mật khẩu P3E.
Skill: `ddc-tower:security-review`.
DB: đã soi `ddc_control_tower_c` bằng `mcp__postgres` (chỉ đọc).
Pentest: chưa làm được. Cổng 3003 không có tiến trình nghe lúc rà (curl tới `/vi/dang-ky` trả mã 000), và người rà chỉ đọc nên không tự dựng server.

## Kết quả các lỗi vòng 1

| Mã | Mức vòng 1 | Trạng thái | Căn cứ |
|---|---|---|---|
| S1 | Cao | Đã đóng | Form bỏ ô mật khẩu. Migration xoá cột `signup_request.passwordHash`. `approveSignupAction` tạo tài khoản bằng hash của chuỗi ngẫu nhiên đã vứt, rồi gửi link đặt mật khẩu tới đúng email đăng ký. |
| S2 | Thấp | Đã đóng | `hasInvisibleChars` kiểm ở server (`src/server/signup.ts`, hàm `validate`) và ở form. Email bật tài khoản không còn chứa họ tên. |
| S3 | Thấp | Đã đóng | `pruneStale` xoá đăng ký chờ quá 14 ngày, chạy trong job `alerts_daily` với khối bắt lỗi riêng, có ghi nhật ký `signup_expire`. |
| I1 | Thông tin | Đã đóng | `deleteDepartment` bắt P2003 và trả `{ inUse: 1 }` thay vì lỗi 500. |

## Kiểm các điểm được yêu cầu

### 1. Tài khoản mới bật, trước khi đặt mật khẩu

- `src/server/actions-signup-admin.ts:67`: mật khẩu được băm là `randomBytes(32).toString('hex')`, tức 256 bit ngẫu nhiên, không lưu và không trả về. Không đoán được bằng `checkCredentials`.
- Đăng nhập Google (`src/lib/auth.ts:134-142`) đòi email đã được Google xác minh (`email_verified`). Chỉ chủ hộp thư mới vào được bằng đường này, nên không phải là đường vòng.
- Hash khác rỗng nên tài khoản không bị coi là "chỉ Google". Luật L5 trong `peekResetToken`/`consumeResetToken` (`prisma-repo-auth.ts:200` và `:216`) vẫn cho đặt mật khẩu, đúng thiết kế.
- Token lời mời:
  - Sinh bằng `generateResetToken`: 32 byte base64url, DB chỉ lưu SHA-256.
  - Chỉ gửi tới `person.email`, là email trong bản ghi đăng ký. Token không trả về client và không ghi log.
  - Dùng 1 lần: `consumeResetToken` đặt `usedAt` một cách nguyên tử.
  - Trang `dat-lai-mat-khau` đặt `referrer: 'no-referrer'`.
  - Không thấy đường nào để người khác chủ hộp thư lấy được token.
- "Quên mật khẩu" với tài khoản này đi đúng nhánh "có tài khoản, đang hoạt động, có hash" như mọi tài khoản mật khẩu khác. Phản hồi luôn là `accepted`, phần xử lý chạy nền (L6). Không lộ thêm trạng thái hay email nào tồn tại.

### 2. Lỗi khi lưu token hoặc gửi mail sau khi đã bật (`mailed:false`)

- Tài khoản vẫn được tạo nhưng không ai biết mật khẩu, nên đây là trạng thái an toàn (fail-closed).
- Người dùng tự lấy link qua "Quên mật khẩu". Thông báo cho admin (`approvedNoMail`) nói đúng điều đó.
- Nếu `replaceResetToken` chạy xong rồi mới lỗi ở bước soạn mail, token mồ côi vẫn chỉ ở dạng hash và tự hết hạn sau 72 giờ, nên vô hại.
- Kiểm SMTP và `NEXTAUTH_URL` ở dòng 61-63, trước `approveRequest`. Vì vậy thiếu cấu hình thì không bật tài khoản, tránh được trạng thái "bật rồi mà không bao giờ gửi được link".

### 3. Link và locale

- Link dựng từ `process.env.NEXTAUTH_URL` (`actions-signup-admin.ts:62` và `:35`), không đọc header Host.
- Locale đi qua `toLocale`, là danh sách trắng `routing.locales` (dòng 23), nên không tiêm được đường dẫn.
- Token là base64url `[A-Za-z0-9_-]`, không cần mã hoá thêm khi đặt vào URL.

### 4. `pruneAuthData` đổi tiêu chí xoá

- Trước đây token bị xoá khi `createdAt` cũ hơn 24 giờ. Nay xoá khi `expiresAt < now-24h` hoặc `usedAt < now-24h` (`prisma-repo-auth.ts:248`). Bản mock ở `mock-repo-auth.ts` được sửa khớp.
- Không làm token sống lâu hơn hạn dùng. `peekResetToken` và `consumeResetToken` luôn tự kiểm `expiresAt > now` và `usedAt null`. Việc dọn chỉ để giảm dữ liệu, không phải là cơ chế hết hạn.
- Không làm yếu giới hạn tần suất của P3E. Các giới hạn `reset_req_ip`, `reset_req_email` và `reset_submit_ip` đếm trên bảng `auth_throttle`, và bảng này vẫn được dọn theo `createdAt` như cũ. Không có chỗ nào đếm dòng `password_reset_token` (grep `passwordResetToken.count|findMany|aggregate` ngoài file test: 0 kết quả).
- Hệ quả phụ chấp nhận được: token 30 phút đã hết hạn nay nằm lại tối đa khoảng 24,5 giờ, thay vì 24 giờ tính từ lúc tạo. Lời mời có `requestIp = ''` nên không giữ thêm dữ liệu cá nhân.

### 5. Migration `20260929120000_p3f_dang_ky_bo_mat_khau` và rollback

- Migration xuôi chỉ `DROP COLUMN "passwordHash"`. Việc này cũng xoá luôn các hash do người gửi form tự chọn còn tồn trong DB, đúng mục tiêu S1.
- Các đăng ký chờ cũ, khi được bật, sẽ đi luồng lời mời mới.
- Trên DB `_c`: migration đã áp lúc 2026-09-29 15:11:03 +07. Bảng `signup_request` còn các cột `id,email,name,departmentId,locale,requestIp,createdAt`, 0 dòng. `password_reset_token` có 0 dòng.
- Rollback (`prisma/rollback/...down.sql`):
  - Chạy trong `BEGIN/COMMIT`, xoá hết đăng ký chờ trước rồi mới thêm lại cột `NOT NULL`, nên không vỡ ràng buộc. Sau đó xoá dấu vết trong `_prisma_migrations`.
  - Có ghi rõ "revert code trước". Rollback đưa luồng S1 cũ quay lại, nên chỉ dùng khi khẩn cấp.

### 6. Regex `\p{C}`

Đã chạy thử bằng node.

- Tên tiếng Việt có dấu ở cả dạng dựng sẵn (NFC) lẫn tổ hợp (NFD), ví dụ "Nguyễn Văn Ấn" và "Trần Thị Hồng Ngọc" dạng NFD: không bị chặn. Dấu tổ hợp thuộc nhóm Mn, không thuộc C.
- Bị chặn đúng: ZWJ U+200D, RLO U+202E, soft hyphen U+00AD, BOM U+FEFF, cùng CR/LF và các ký tự điều khiển khác.
- Còn lọt: xem mục T2 bên dưới.

## Phát hiện vòng 2

### T1 - THẤP - Yêu cầu "Quên mật khẩu" huỷ link lời mời 72 giờ còn hạn

- **Vị trí:** `src/server/password-reset.ts:99` và `src/server/repo/prisma-repo-auth.ts:185-191`. `replaceResetToken` xoá mọi token của email trước khi tạo token mới. Lời mời được tạo cũng bằng hàm này ở `actions-signup-admin.ts:34`.
- **Kịch bản:**
  1. Admin bật tài khoản `x@daidung.vn`, hệ thống gửi link 72 giờ.
  2. Một người bất kỳ biết email đó gửi "Quên mật khẩu" cho `x@daidung.vn`.
  3. Link lời mời mất hiệu lực và được thay bằng link 30 phút, cũng gửi tới đúng chủ hộp thư.
  4. Lặp tối đa 3 lần/giờ cho mỗi email (`RESET_EMAIL_LIMIT`).
- **Hậu quả:** không ai chiếm được tài khoản, vì mọi link vẫn chỉ tới hộp thư chủ. Chỉ gây phiền: người dùng mở email lời mời thì gặp "link không hợp lệ", phải dùng email mới hơn.
- **Cách sửa (không bắt buộc):** chấp nhận như hiện tại và ghi chú. Hoặc thêm cột `purpose` (`reset` hoặc `invite`) để `requestPasswordReset` không xoá token lời mời còn hạn. Nếu đã có token còn hạn thì nên gửi lại chính link đó, nhưng làm vậy phải lưu token thô nên không khuyến nghị.

### T2 - THẤP - `\p{C}` không bao phủ một số ký tự tàng hình hoặc ngắt dòng ngoài nhóm C

- **Vị trí:** `src/lib/signup-policy.ts:13-15`.
- **Còn lọt (đã chạy thử):**
  - U+2028 LINE SEPARATOR và U+2029 (nhóm Zl, Zp).
  - U+034F COMBINING GRAPHEME JOINER (Mn).
  - Ký tự lấp chỗ Hangul U+115F và U+3164 (Lo, hiển thị như khoảng trắng).
  - U+00A0 và U+3000 (Zs).
- **Hậu quả hiện tại thấp:**
  - Họ tên không còn nằm trong bất kỳ email nào: `signup.mailBody` chỉ dùng `{email, link}`, và grep `{name}` trong `vi.json` không thấy mẫu email nào.
  - Bảng admin do React escape.
  - Rủi ro còn lại chỉ là họ tên trông giống người khác trong bảng admin hoặc nhật ký.
- **Cách sửa (không bắt buộc):** đổi thành `/[\p{C}\p{Zl}\p{Zp}͏ᅟᅠㅤﾠ]/u`, và gộp mọi khoảng trắng Zs về dấu cách thường trước khi lưu, ví dụ `name.normalize('NFC').replace(/\p{Zs}+/gu, ' ')`.

### T3 - THẤP - `approveSignupAction` ném lỗi sau khi đã tạo tài khoản thì không gửi lời mời

- **Vị trí:** `src/server/actions-signup-admin.ts:71`. `logActivity` được `await` giữa `approveRequest` (dòng 68) và `sendInvite` (dòng 72).
- **Kịch bản:** DB chập chờn làm `logActivity` ném lỗi. Tài khoản đã được tạo nhưng không có email nào được gửi. Admin thấy lỗi, bấm lại thì nhận `not_found`.
- **Hậu quả:** trạng thái vẫn an toàn (không ai biết mật khẩu). Người dùng vẫn tự cứu được qua "Quên mật khẩu", nhưng không ai báo cho họ.
- **Cách sửa:** gọi `sendInvite` trước `logActivity`, hoặc bọc `logActivity` bằng try/catch.

### Thông tin (không cần sửa)

- **N1 - `mailed:true` không có nghĩa là mail đã tới nơi.** `signupMailer.queue` chạy nền kiểu fire-and-forget, nên SMTP lỗi lúc gửi thật vẫn báo `mailed:true`. Chấp nhận được vì có đường "Quên mật khẩu", giống P3E.
- **N2 - Giữ chỗ email vẫn còn nhưng đã mất tác dụng.**
  - Kẻ tấn công vẫn gửi trước được đăng ký cho email người khác, với họ tên và phòng ban tuỳ chọn. Đăng ký thật của nạn nhân gửi sau bị gộp lặng lẽ thành `duplicate`.
  - Sau S1, kẻ tấn công không còn thu được gì: tài khoản thuộc về chủ hộp thư. Hậu quả chỉ là họ tên hoặc phòng ban sai (admin sửa được), cùng một email không mong muốn gửi tới nạn nhân.
  - Admin nay thấy thêm cột "IP gửi". IP này đáng tin chỉ khi proxy nối `X-Forwarded-For` đúng như R5 của P3E.
  - S3 (xoá sau 14 ngày) giới hạn thời gian giữ chỗ.
- **N3 - Lộ trạng thái cấu hình SMTP và đọc DB không giới hạn tần suất.** Trang `/dang-ky` và `submitSignupAction` (`actions-signup.ts:27`) báo "chưa cấu hình email" trước khi đặt chỗ throttle, và mỗi request đọc cấu hình SMTP từ DB một lần. Cùng khuôn với trang Quên mật khẩu của P3E. Chỉ lộ một cờ cấu hình, chấp nhận được.

## Kiểm tra chung

| Hạng mục | Kết quả |
|---|---|
| Authorization | `approveSignupAction` và `rejectSignupAction` gọi `requireRoleUser(['admin'])` trước mọi việc. `id` và `role` được kiểm theo danh sách trắng. |
| Injection | Prisma có tham số hoá, không có SQL ghép chuỗi mới. `requestIp` hiển thị qua React (có escape) và đã bị cắt tối đa 64 ký tự trong `clientIpFrom`. |
| Secret | Không có secret mới trong code. Token lời mời không ghi log (chỉ log `e.name`). |
| Rate limit | Giới hạn đăng ký 10/giờ theo IP và 3/giờ theo email vẫn giữ nguyên. Bỏ bcrypt ở form nên không còn DoS CPU qua đăng ký. |
| Fail-open | Không có. Thiếu SMTP thì chặn cả form đăng ký lẫn nút bật. Lỗi gửi mail để lại tài khoản không ai đăng nhập được. |

## Tóm tắt vòng 1 (commit `2a2802f`, diff `2171d61..37fd556`)

Phán quyết vòng 1: LO HONG / CẦN SỬA.

- **S1 Cao:** không xác minh người đăng ký sở hữu email. Mật khẩu do người gửi form chọn được chép thẳng sang `user_roles` khi admin bật, nên chiếm được tài khoản đồng nghiệp. Chủ dự án chọn phương án (b): bỏ mật khẩu ở form, bật xong gửi link đặt mật khẩu 72 giờ.
- **S2 Thấp:** ký tự điều khiển trong họ tên được chèn vào email "tài khoản đã sẵn sàng".
- **S3 Thấp:** đăng ký chờ nằm vô thời hạn, kèm IP. Chủ dự án chọn xoá sau 14 ngày.
- **I1 Thông tin:** `deleteDepartment` trả lỗi 500 khi bị FK P2003 chen ngang.
