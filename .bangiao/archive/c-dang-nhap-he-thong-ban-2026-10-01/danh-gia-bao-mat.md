KET LUAN: DAT

# Đánh giá bảo mật: sửa lỗi P2028 và thông báo "Hệ thống đang bận"

Nhánh `feature/c-dang-nhap-he-thong-ban`, commit cuối `07b82f0`, phạm vi `git diff main..HEAD`.
Skill đã dùng: `security-review`, `security-audit` (chế độ guidance, rà tập trung theo diff, không chạy đủ 6 pha).
Đã soi DB `_c` bằng `mcp__postgres` (chỉ đọc): `lock_timeout = 0`, `statement_timeout = 0`, `idle_in_transaction_session_timeout = 0`, `max_connections = 100`.
Không có lỗ hổng mức Cao hay Trung; có 2 phát hiện mức Thấp và 3 ghi nhận mức thông tin.

## 1. Oracle email qua `system_busy`

Không thành oracle.
Chuỗi lỗi luôn là `new Error(LOGIN_SYSTEM_BUSY)` mới, không có `cause` hay `code` (`src/lib/auth.ts:124-126`).
Tester đã kiểm thuộc tính lỗi giống hệt nhau giữa email có thật và email lạ (`src/lib/auth-authorize.test.ts`, describe "bo sung cua Tester").
Các bước chạm DB trước khi rẽ nhánh không phụ thuộc email: `reserveThrottle` theo IP (`src/server/login-guard.ts:102`) và `getAccountState` (`src/server/login-guard.ts:105`).
Sau khi rẽ nhánh, cả nhánh email lạ, chỉ Google, đang khoá (`recordThrottle`, `countThrottle`) lẫn nhánh có mật khẩu (`reserveAccountGuess`, `registerFailedLogin`, `releaseThrottle`, `resetFailedLogin`) đều có thao tác DB có thể lỗi.
Thời gian: nhánh nào cũng chạy bcrypt (thật hoặc giả); bản sửa không thêm bước chạy hay bước chờ nào phụ thuộc email.

Đánh giá Q4.4 (advisory lock `account_guess:<email>`, `src/server/repo/prisma-repo-auth.ts:164-165`): đồng ý kết luận "chấp nhận được", nhưng cần sửa 1 chỗ lập luận.
Hạn `timeout` 20s KHÔNG cắt được lúc đang chờ lock: Prisma chỉ báo P2028 ở câu lệnh kế tiếp sau khi lấy được lock.
Muốn ép ra `system_busy` ở nhánh này, phải có hàng chờ trên cùng 1 lock kéo dài quá 20s.
Mỗi lượt giữ lock chỉ vài mili giây (3 câu lệnh), và số phiên chờ đồng thời bị giới hạn bởi pool Prisma (khoảng 2 x CPU + 1), nên thực tế không ép được.
Đường P2028 do `maxWait` (hết chờ kết nối pool) có ở cả `reserveThrottle` (mọi email) lẫn các câu ngoài giao dịch (P2024) ở mọi nhánh.
Lúc pool đã bão hoà thì tín hiệu thời gian vốn đã có từ trước; tỷ lệ `system_busy` chỉ lệch nhẹ giữa các nhánh, không thành tín hiệu mới đáng kể.
Ngoài ra, dồn lượt sai vào 1 email có mật khẩu sẽ khoá tài khoản đó sau 5 lần, rồi chuyển sang `respondAccountLocked` (không còn lấy lock `account_guess`), giống hệt nhánh email lạ.

## 2. Lộ chi tiết lỗi kỹ thuật

Không lộ.
Client và URL (`?error=`) chỉ nhận chuỗi cố định `system_busy`; next-auth đưa `error.message` vào URL, mà message ở đây là hằng.
`LoginForm` ánh xạ qua `loginErrorKey`, mã lạ thì về `auth.invalidCredentials` (`src/lib/login-errors.ts`).
Trang login chỉ đọc `sp.error === 'AccessDenied'` (`app/[locale]/(auth)/login/page.tsx:19`), không phản chiếu chuỗi tuỳ ý.
Log chỉ ghi `errorFields(e)`: tên lỗi, mã khớp `/^[A-Z0-9_]{1,20}$/`, 8 dòng stack; không có `e.message` (`src/lib/logger.ts:83-101`).
Có test cho cả trường hợp ném chuỗi chứa `postgresql://`.

## 3. Thứ tự ưu tiên, throttle, DoS

`locked`/`ip_limited` được kiểm nguyên văn trước khi đổi sang `system_busy` (`src/lib/auth.ts:124`).
Message chỉ "chứa" chữ `locked` (vd `deadlock ... locked`) không khớp, đã có test.
Không đường nào biến lỗi thành đăng nhập thành công: mọi lỗi đều `throw`, next-auth không cấp phiên.
R2: chưa giữ được chỗ IP thì không bcrypt mật khẩu thật (`src/server/login-guard.ts:102-103`), nên lỗi ở bước này không mở đường đoán mật khẩu.
Giao dịch bị huỷ thì rollback, không để lại dòng (real-db test 3, e2e 42).
R5-1: chỗ đoán vẫn được rút trong `finally` (`src/server/login-guard.ts:174-176`); không thử lại (Q2), nên không đếm trùng.
L3: `resetFailedLogin` không đổi.
N2: thân giao dịch không đổi, chỉ thêm tham số 2.

Hạn mới (maxWait 10s, timeout 20s):
- Giao dịch đang giữ lock mà bị kẹt (event loop Node bị chặn) thì giữ lock của 1 cặp kind:key tối đa 20s thay vì 5s, chỉ chặn các lượt cùng khoá đó.
- Ở production không có webpack dev; kẻ tấn công không chủ động gây ra được việc chặn event loop.
- `maxWait` 10s làm yêu cầu chờ pool lâu hơn trước khi báo lỗi, nhưng không tăng số kết nối bị chiếm.
- Kết luận: không mở đường DoS mới.

### S1. Thấp: chờ advisory lock không giới hạn thời gian (có từ trước, không phải hồi quy)

Bằng chứng: `src/server/repo/prisma-repo-auth.ts:165` và `:189` gọi `pg_advisory_xact_lock` trong lúc DB đang để `lock_timeout = 0`; e2e 42 ghi nhận app treo tới khi lock được nhả.
Cách khai thác: không có cách trực tiếp cho kẻ tấn công từ ngoài, vì chỉ giao dịch của chính app mới giữ các lock này, mỗi lượt vài mili giây.
Rủi ro thật: nếu 1 phiên giữ lock bị kẹt (DB stall, I/O), mọi lượt cùng khoá xếp hàng, mỗi lượt chiếm 1 kết nối pool, không có hạn.
Với khoá `login_fail_ip:unknown` (proxy cấu hình sai, mọi người chung 1 khoá), việc này có thể làm cạn pool và treo toàn bộ app.
Mức Thấp: cần điều kiện hạ tầng bất thường; hành vi y hệt trước bản sửa (hạn 5s cũ cũng không cắt được lúc chờ lock).
Đề xuất sửa (task riêng, không chặn merge): câu đầu tiên trong giao dịch `reserveThrottle` và `reserveAccountGuess` là `` await tx.$executeRaw`SET LOCAL lock_timeout = '5s'` ``.
Lỗi 55P03 lúc đó lên thành lỗi Prisma, giao dịch rollback, không để lại dòng, người dùng thấy `system_busy`.
Đặt cùng 1 giá trị cho cả 2 loại khoá, đủ lớn (từ 5s trở lên), để không tạo chênh lệch tỷ lệ `system_busy` giữa nhánh email lạ và nhánh có mật khẩu (giữ kết luận mục 1).
Thêm 1 test real-db: giữ lock 10s thì `reserveThrottle` bị reject trong khoảng 6s và còn 0 dòng.
Có thể đặt thêm `idle_in_transaction_session_timeout` ở mức role DB của app làm lưới an toàn.

## 4. E2E 42

Không có cửa hậu: diff không thêm biến môi trường, cờ, route hay tham số giả lập lỗi nào trong `src/` hay `app/`.
Lỗi được tạo bằng cách spec tự giữ advisory lock trên DB e2e.
Spec chỉ chạy trên DB e2e đã đăng ký: `resolveE2eTarget` kiểm danh sách cặp DB/cổng (`e2e/helpers/env.ts:48-54`, `:149-168`), không có DB thật của A.
Dùng IP giả RFC 5737 riêng (`e2e/42-dang-nhap-he-thong-ban.spec.ts:17`).
Lock được nhả cả khi đỏ (`finally`, dòng 86-88), giao dịch giữ lock có hạn riêng.
Kiểm 0 dòng `auth_throttle` cho IP giả; lượt đăng nhập đúng ở cuối spec reset bộ đếm của `e2e-khoa`.
Các truy vấn `pg_locks` và `pg_try_advisory_xact_lock` chỉ đọc, khoá tự nhả cuối câu lệnh.

## 5. Sửa test chập chờn (commit `07b82f0`)

Không làm yếu test bảo mật nào.
`src/server/report-export-route.test.ts` S-2: chỉ đóng băng `Date` trong describe S-2; vẫn kiểm 30 lần được 200, lần 31 ra 429 kèm `Retry-After`, và đổi phần tử đầu XFF không lách được.
`src/server/jobs.test.ts` K19/S3: giới hạn mốc theo khoảng [before, after], chặt hơn dung sai cũ +5000ms.
`src/server/daily-import.test.ts` zip bomb: chỉ nới hạn test lên 60s; ngưỡng đo `elapsed < 2000` của phép kiểm thật giữ nguyên.
`src/server/backup-scripts-lock.test.ts`: `pg_dump` giả chờ file nhả thay vì ngủ cố định, vẫn kiểm thoát mã 3 và khoá còn tồn tại, có dọn tiến trình trong `finally`.
`vi.restoreAllMocks()` thêm vào `auth-authorize.test.ts` và `login-guard.test.ts` chỉ gỡ spy giữa các test, không bỏ kiểm tra nào.

## 6. Phát hiện khác

### S2. Thấp: mật khẩu Postgres local trong file test mới

Bằng chứng: `src/server/repo/prisma-repo-auth-tx-real-db.test.ts:4` chứa chuỗi kết nối kèm mật khẩu user `postgres`.
Cùng mật khẩu này đã có trên `main` ở `src/server/repo/prisma-repo-auth-real-db.test.ts:6` và `.vscode/settings.json:12`.
Rủi ro: nếu mật khẩu này được dùng lại ở môi trường khác thì ai đọc repo cũng có quyền superuser DB.
Đề xuất sửa: trong nhánh này, thay mật khẩu ở dòng 4 bằng `<mat-khau>` (hoặc chỉ ghi "đặt DATABASE_URL trỏ DB _c theo .env").
Mở task riêng để dọn 2 chỗ cũ trên `main` và xác nhận production không dùng mật khẩu này.

### I1. Thông tin: lập luận Q4.4

Xem mục 1: hạn 20s không cắt lúc đang chờ lock; rủi ro vẫn không khai thác được vì hàng chờ bị giới hạn bởi kích thước pool.

### I2. Thông tin: `system_busy` sau khi mật khẩu đã đúng

`touchLastLogin` lỗi (`src/lib/auth.ts:116`) thì ra `system_busy` sau khi đã rút chỗ IP và reset bộ đếm.
Không có phiên nào được cấp; kẻ tấn công không điều khiển được việc DB lỗi đúng lúc này, nên không phải oracle mật khẩu.
Không cần sửa.

### I3. Thông tin: chuỗi lỗi trên URL

Chuỗi lỗi lên `?error=` là hằng cố định, trang login chỉ đọc `AccessDenied` (xem mục 2).
Không có đường phản chiếu chuỗi tuỳ ý ra giao diện, không cần sửa.

## Đề xuất thứ tự

1. Trước merge: sửa S2 ở file mới (1 dòng comment).
2. Task sau: S1 (`SET LOCAL lock_timeout`) kèm test real-db; dọn mật khẩu ở 2 chỗ cũ trên `main`.

## Vòng 2

Skill đã dùng: `security-review`, `security-audit` (chế độ hướng dẫn).
Phạm vi: `git diff 07b82f0..HEAD` (commit a4ec946, 6b7f5af), cùng các file chưa theo dõi trong `.bangiao/`.

### Vòng sửa không đổi logic

Diff chỉ đụng 3 file: `.bangiao/thay-doi.md`, thêm 3 dòng JSDoc trong `src/server/repo/auth-tx.ts`, và 1 dòng comment trong `src/server/repo/prisma-repo-auth-tx-real-db.test.ts`.
Không có dòng code chạy nào thay đổi, `AUTH_TX_OPTIONS` và các câu `pg_advisory_xact_lock` vẫn như vòng 1.
Vòng sửa không mở lỗ hổng mới.

### S1: JSDoc mới mô tả đúng

`auth-tx.ts` dòng 8 đến 10 ghi rõ: hạn 20s không cắt một câu đang chạy, giao dịch đang chờ `pg_advisory_xact_lock` sẽ chờ tới khi bên giữ lock nhả vì không có `lock_timeout`, và việc đặt `SET LOCAL lock_timeout` để lại cho task sau.
Nội dung này khớp với phân tích S1 ở vòng 1 và khớp code hiện tại (`prisma-repo-auth.ts` dòng 13, 165, 189 không đặt `lock_timeout`).
S1 vẫn để mở ở mức thấp, đã được ghi lại làm task sau, không chặn merge.

### S2: đã đóng trong file được theo dõi

Comment trong `prisma-repo-auth-tx-real-db.test.ts` dòng 4 nay dùng `<mat-khau>`.
`.bangiao/ke-hoach.md`, `.bangiao/thay-doi.md`, `.bangiao/danh-gia.md` không còn chứa mật khẩu.
Trong cây HEAD, mật khẩu chỉ còn ở 2 chỗ cũ, và 2 chỗ này đã có sẵn trên `main`: `.vscode/settings.json` dòng 12 và `src/server/repo/prisma-repo-auth-real-db.test.ts` dòng 6.

Lịch sử nhánh: commit 3f59e02 thêm mật khẩu, a4ec946 xoá đi.
Khi merge vào `main`, chuỗi này sẽ nằm trong lịch sử của `main`.
Rủi ro thêm gần như bằng 0, vì cùng mật khẩu đã có trên `main` ở 2 chỗ nói trên, và đây là mật khẩu Postgres local (localhost:5433), không phải mật khẩu production.
Không cần viết lại lịch sử, việc này cũng trái luật không `push --force`.
Nếu repo từng được push lên remote dùng chung, hoặc mật khẩu này được dùng lại ở chỗ khác, thì cách vá đúng là đổi mật khẩu Postgres local, chứ không phải xoá lịch sử.

### S2b. Thấp: mật khẩu còn trong `.bangiao/ket-qua-test.md`

File: `.bangiao/ket-qua-test.md` dòng 157 (file chưa theo dõi).
Dòng này viết nguyên chuỗi mật khẩu trong bảng mô tả lệnh grep, trong khi chính dòng đó ghi kết quả "0 file chứa".
Cách khai thác: khi file được chuyển vào `.bangiao/archive/` và commit trước merge (luật mục 4), mật khẩu lại vào cây `main` dưới dạng một file mới.
Mức thấp vì lý do giống S2: mật khẩu local, đã có trên `main`.
Cách vá: thay chuỗi đó bằng `<mat-khau>` trước khi archive, rồi grep lại `.bangiao/` (gồm cả file chưa theo dõi) để chắc còn 0 chỗ.
**Đã vá (bên điều phối, 2026-10-01):** thay 1 chỗ bằng `<mat-khau>`; grep lại `.bangiao/` (trừ archive) và các file của `git diff main..HEAD`: 0 chỗ.

### Kết luận vòng 2

Không có lỗ hổng mức cao hay trung.
S1 (thấp) còn mở và đã ghi làm task sau.
S2 đã đóng trong các file được theo dõi.
S2b (thấp) đã vá.
Task sau: dọn 2 chỗ cũ trên `main` như đã ghi ở vòng 1.
