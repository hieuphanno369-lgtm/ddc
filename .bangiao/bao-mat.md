PHAN QUYET BAO MAT: LO HONG

# Rà soát bảo mật P3F - CẦN SỬA

Nhánh `feature/p3f-dang-nhap-moi`, diff `2171d61..37fd556`.
Skill: `ddc-tower:security-review`.
Chưa pentest trên app đang chạy, vì dev server 3003 đang hỏng và chờ chủ dự án xử lý.

## S1 - CAO - Không xác minh người đăng ký có sở hữu email, nên chiếm được tài khoản của đồng nghiệp

**Vị trí:**

- `src/server/signup.ts:158`: mật khẩu do người gửi form tự chọn được băm, rồi lưu vào `signup_request.passwordHash`.
- `src/server/repo/prisma-repo-signup.ts:137-148`: khi bật, hàm `approveRequest` chép nguyên `req.passwordHash` sang `user_roles`.
- `src/server/actions-signup-admin.ts:48`: admin bật tài khoản.
- `src/components/admin/SignupRequestList.tsx:83-84`: admin chỉ thấy họ tên và email do chính người gửi form tự nhập.

**Kịch bản khai thác:**

1. Kẻ tấn công ở ngoài công ty mở `/vi/dang-ky`, là trang công khai.
2. Hắn nhập email của một nhân viên thật chưa có tài khoản, ví dụ `truongphong@daidung.vn`, nhập đúng họ tên người đó và mật khẩu do hắn chọn.
3. Admin thấy tên và email hợp lệ nên bật tài khoản với vai trò `bod` hoặc `data-entry`, kèm quyền `canViewFinance = true`.
4. Kẻ tấn công đăng nhập bằng email đó và mật khẩu của hắn, rồi xem được dữ liệu dự án và tài chính nội bộ.

Biến thể "giữ chỗ": kẻ tấn công gửi trước cho nhiều email.
Khi người thật đăng ký sau, họ vẫn thấy "accepted" nhưng yêu cầu của họ bị bỏ lặng lẽ (`finishSignup` ghi `duplicate`).
Admin sẽ bật đúng yêu cầu mang mật khẩu của kẻ tấn công.

Email "tài khoản đã sẵn sàng" chỉ giảm nhẹ rủi ro sau khi sự việc đã xảy ra, và chỉ khi có SMTP.
Không có SMTP thì không có tín hiệu nào.

**Cách sửa đúng gốc:** phải chứng minh người đăng ký sở hữu hộp thư trước khi mật khẩu của họ có hiệu lực.
Đây là thay đổi luồng nghiệp vụ nên chủ dự án cần chọn phương án:

- **(a) Đề xuất: xác minh email lúc đăng ký.**
  - Khi gửi form, tạo token ngẫu nhiên (chỉ lưu SHA-256, hạn 24 giờ, dùng 1 lần, khuôn `PasswordResetToken`) và gửi link xác nhận.
  - `listPending`, `countPending` và `approveRequest` chỉ tính những đăng ký đã xác nhận (thêm cột `verifiedAt`).
  - Phản hồi form vẫn luôn là `accepted`, nên vẫn không lộ email đã tồn tại.
  - Yêu cầu chưa xác nhận không chặn được người đăng ký sau: bỏ `@unique` cứng trên `signup_request.email` với dòng chưa xác nhận, hoặc cho yêu cầu mới thay yêu cầu chưa xác nhận.
- **(b) Không nhận mật khẩu ở form.** Khi admin bật, tạo tài khoản với `passwordHash = ''`, sinh token đặt mật khẩu (hạn 72 giờ) và gửi link tới email. Chỉ chủ hộp thư đặt được mật khẩu.
- Cả hai phương án cần SMTP. Khi thiếu SMTP thì tắt form đăng ký, như trang Quên mật khẩu đang làm.
- Nên hiện thêm `requestIp` cho admin làm thông tin phụ.

**Test đỏ cần có:** đăng ký email X rồi admin bật. Đăng nhập bằng mật khẩu nhập ở form phải thất bại khi chưa đi qua link gửi tới hộp thư X.

## S2 - THẤP - Họ tên tự nhập được chèn vào email gửi từ SMTP công ty, và không lọc ký tự điều khiển

**Vị trí:**

- `src/server/signup.ts:103`: chỉ `trim()`, nhận cả xuống dòng và ký tự điều khiển.
- `src/server/actions-signup-admin.ts:30`.
- `src/i18n/messages/vi.json:1322` và `en.json`: `signup.mailBody` có `{name}`.

**Khai thác:**

- Kẻ tấn công đặt họ tên kiểu "A\n\nVui lòng xác nhận tại http://gia-mao...". Nếu admin bật, hộp thư thật nhận email từ hệ thống công ty chứa đoạn chữ lừa đảo.
- Các ký tự RTL hoặc zero-width còn làm tên hiển thị sai trong bảng admin, khiến admin khó nhận ra tên giả.

**Sửa:** chặn ký tự `\p{C}` (xuống dòng, điều khiển, ký tự định dạng) trong `validate`, trả `invalid name`.
Nên bỏ `{name}` khỏi email, hoặc chỉ chèn tên sau khi đã lọc.

## S3 - THẤP - Đăng ký chờ không có hạn

**Vị trí:** bảng `signup_request` (migration `20260929023746`). Không có job dọn.

**Rủi ro:** mã băm mật khẩu và IP nằm lại vô thời hạn.
Admin có thể bật một yêu cầu cũ nhiều tháng, lúc người đó có thể đã nghỉ việc.

**Sửa:** job trong `runDueJobs` xoá đăng ký quá N ngày (ví dụ 14 ngày), ghi nhật ký.
Nếu làm S1(a) thì xoá luôn yêu cầu chưa xác nhận sau 24 giờ.

## Thông tin, không chặn

- I1: `deleteDepartment` (`prisma-repo-signup.ts:73-81`) đếm rồi xoá. Nếu có đăng ký chen vào giữa, FK `RESTRICT` vẫn chặn đúng, nhưng lỗi `P2003` bị ném ra thành lỗi 500 chung thay vì `in_use`. Nên bắt `P2003` và trả `in_use`.
- I2: giới hạn 3 lần/giờ/email cho phép người khác làm một email hết lượt đăng ký trong 1 giờ. Đây là đánh đổi có chủ đích để không lộ email tồn tại, chấp nhận được.

## Đã kiểm và ĐẠT

- **Hai lớp chặn đăng nhập không bị yếu đi:**
  - `middleware.ts` chỉ thêm `/dang-ky` và `/dieu-khoan`, khớp đúng đường dẫn hoặc tiền tố có `/` (`/dang-ky-gia` vẫn bị chặn, có test).
  - `src/lib/auth.ts` không đổi.
  - `login-policy.ts` chỉ thêm hằng số `SIGNUP_*`, không đổi luật khoá hay giới hạn P3E.
  - Luồng revoke phiên không đổi.
- **Tài khoản chờ bật:**
  - Không có dòng `user_roles`, nên đăng nhập bằng mật khẩu nhận lỗi chung.
  - Đăng nhập Google bị từ chối và không tự tạo tài khoản (`auth-google-cho-bat.test.ts`).
- **Phân quyền:**
  - Cả 5 action quản trị gọi `requireRoleUser(['admin'])` đầu tiên và kiểm `id` là INT4 dương, `role` thuộc danh sách trắng.
  - Trang `/admin` có `requireUser(locale, ['admin'])` và middleware `DENIED`.
  - Dải nhắc chỉ truy vấn khi là admin.
  - Không có IDOR vì tài nguyên là danh mục chung chỉ admin thao tác.
- **Hai admin bật cùng lúc:** xoá đăng ký trước trong `$transaction`, người thua nhận `P2025` và thấy `not_found`. Email đã có tài khoản thì `duplicate_account`, giao dịch hoàn tác, không ghi đè mật khẩu.
- **Không lộ email tồn tại:**
  - Kiểm dữ liệu không đọc bảng tài khoản.
  - Đặt chỗ giới hạn IP rồi email trước khi băm; hết lượt thì không băm, không ghi log, nhả chỗ IP.
  - Mọi nhánh còn lại đều băm, phần tra DB chạy nền. Phản hồi luôn là `accepted`, lỗi hạ tầng cũng trả `accepted` và chỉ log `e.name`.
  - IP lấy qua `clientIpFrom` với số tầng proxy tin cậy (`TRUSTED_PROXY_HOPS`).
- **CSRF:** dùng server action của Next, có kiểm Origin và Host. Không thêm route API mới.
- **Injection:** mọi truy vấn qua Prisma có tham số, không có `$queryRawUnsafe`. `SignupStore` không nối chuỗi SQL.
- **XSS:** tên và phòng ban hiển thị qua React, không có `dangerouslySetInnerHTML`. `confirm` chỉ nhận chuỗi.
- **Không lộ bí mật:**
  - `SignupRequestRow` không có `passwordHash`, `requestIp`.
  - Log nền chỉ ghi tên lỗi. Nhật ký trùng dùng id cố định `dang-ky-trung`.
  - Mật khẩu chỉ nằm trong state React và bị xoá sau khi gửi.
  - Email không chứa mật khẩu hay token. Link dựng từ `NEXTAUTH_URL`, không lấy từ header Host.
- **Trang công khai:**
  - `/dieu-khoan` tĩnh, các component `auth/*` không import repo hay prisma.
  - `/dang-ky` chỉ lộ tên phòng ban đang dùng, đúng thiết kế.
  - `/dat-lai-mat-khau` giữ `referrer: no-referrer` và `noindex`.
- **Migration:**
  - Chỉ thêm: cột nullable, 2 bảng mới, FK `RESTRICT`, index.
  - Có rollback trong `BEGIN/COMMIT`, có ghi chú mất dữ liệu.
  - Đã áp trên DB C.
- **Thay đổi test không che kiểm tra bảo mật nào:**
  - `expect.timeout` 15 giây và `setTimeout` 120 giây ở e2e 12, 23 chỉ nới thời gian chờ.
  - `fillLogin` chỉ thêm chờ `networkidle`.
  - Mọi phép kiểm `invalidCredentials`, `locked`, `forgotSent`/`sentTitle` và dùng lại token vẫn còn nguyên.
  - `global-setup` xoá `authThrottle` sau khi `resolveE2eTarget` đã khoá cứng vào DB e2e, không chạm DB thật.

## Chưa kiểm được

- Pentest trên app đang chạy: dev server 3003 đang hỏng, chưa gửi request thật tới server action công khai hay thử giả X-Forwarded-For. Cần chạy lại khi server hoạt động.
