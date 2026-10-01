# Thay đổi: sửa lỗi đăng nhập đúng mật khẩu bị báo sai khi hệ thống chậm (Prisma P2028)

Nhánh `feature/c-dang-nhap-he-thong-ban`, worktree `D:\_project\DDC_Control_Tower-C`.
Skill đã dùng: `coding-standards`, `backend-patterns`, `frontend-patterns`.
Kế hoạch: `.bangiao/ke-hoach.md`.

## Điểm lệch so với kế hoạch

- E2E đổi tên thành `e2e/42-dang-nhap-he-thong-ban.spec.ts` (số 41 đã dùng ở nhánh `feature/c-ui-form-du-an` cho `41-ho-so-khoang-cach-the.spec.ts`), theo ghi chú điều phối.
  Mọi chỗ nhắc "e2e 41" trong code mới (tên test real-db thứ 3, tên describe e2e) đổi thành 42.

## Task 1: giao dịch auth không bị huỷ khi máy chậm

### File đã đổi

| File | Việc |
|---|---|
| `src/server/repo/auth-tx.ts` (mới) | Hằng `AUTH_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const`, JSDoc lý do chọn hạn và 3 lý do không thử lại (Q1, Q2). File không import gì. |
| `src/server/repo/prisma-repo-auth.ts` | Import hằng, truyền làm tham số 2 cho 6 giao dịch: `setPassword`, `setPasswordIfHash`, `reserveAccountGuess`, `reserveThrottle`, `replaceResetToken`, `consumeResetToken`. Thân giao dịch không đổi. |
| `src/server/repo/prisma-repo-signup.ts` | Import hằng, truyền cho 2 giao dịch `deleteDepartment`, `approveRequest`. |
| `src/server/repo/prisma-repo-auth-tx-real-db.test.ts` (mới) | 3 test DB thật (chạy tay): chặn event loop 6s giữa `reserveThrottle` và giữa `reserveAccountGuess`; giữ advisory lock lâu hơn `AUTH_TX_OPTIONS.timeout` thì `reserveThrottle` ra P2028 và không để lại dòng giữ chỗ (cơ chế e2e 42 dựa vào). |
| `src/server/repo/prisma-repo-auth.test.ts` | Mock `transaction` nhận tham số 2; 6 test mới kiểm mỗi giao dịch nhận đúng `AUTH_TX_OPTIONS` (so `toBe`, cùng tham chiếu). |
| `src/server/repo/prisma-repo-signup-p2003.test.ts` | Mock `$transaction` chuyển tiếp tham số 2, thêm `signupRequest.delete`, `userRole.create` vào `tx`; 2 test mới cho `deleteDepartment`, `approveRequest`. |

### Test đỏ trước sửa

Real-db (`$env:DATABASE_URL` trỏ `ddc_control_tower_c`), `npx vitest run src/server/repo/prisma-repo-auth-tx-real-db.test.ts`:

```
× reserveThrottle: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)
  PrismaClientKnownRequestError: Invalid `prisma.$executeRaw()` invocation:
  Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.
  The timeout for this transaction was 5000 ms, however 6011 ms passed since the start of the transaction.
× reserveAccountGuess: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)
  ... The timeout for this transaction was 5000 ms, however 6004 ms passed since the start of the transaction.
Test Files  1 failed (1)
     Tests  2 failed | 1 passed (3)
  Duration  38.01s
```

Test thứ 3 (giữ lock quá hạn) PASS ngay trước sửa, tức là ra đúng mã P2028: cơ chế e2e 42 dùng được, không phải dừng.

Unit, `npx vitest run src/server/repo/prisma-repo-auth.test.ts src/server/repo/prisma-repo-signup-p2003.test.ts`:

```
× AUTH_TX_OPTIONS - moi giao dich auth dung chung 1 han (sua loi P2028) > setPassword (va 5 giao dich con lai)
  → expected undefined to be { maxWait: 10000, timeout: 20000 } // Object.is equality
× AUTH_TX_OPTIONS - giao dich dang ky dung chung han voi auth (sua loi P2028) > deleteDepartment, approveRequest
  → expected undefined to be { maxWait: 10000, timeout: 20000 } // Object.is equality
Test Files  2 failed (2)
     Tests  8 failed | 49 passed (57)
```

### Sau sửa (xanh)

- Unit 2 file trên: `Test Files 2 passed (2)`, `Tests 57 passed (57)`.
- Real-db mới: `Test Files 1 passed (1)`, `Tests 3 passed (3)`, 37,8s.
- Real-db auth cũ `prisma-repo-auth-real-db.test.ts`: `Test Files 1 passed (1)`, `Tests 18 passed (18)`, 1,8s.
- `npx tsc --noEmit`: exit 0, không lỗi.
- `npm test` (không `DATABASE_URL`): `Test Files 3 failed | 300 passed | 8 skipped (311)`, `Tests 4 failed | 3674 passed | 75 skipped (3753)`, 224,9s.
  4 ca đỏ đều là test phụ thuộc thời gian, ở file không import code đã đổi:
  `daily-import.test.ts` (e) zip bomb "Test timed out in 5000ms",
  `jobs.test.ts` K19 x2 ("expected 86397338 to be greater than or equal to 86399000", tức job chạy chậm hơn 1s so với mốc),
  `report-export-route.test.ts` S-2 rate limit 30 lần/60 giây.
  Chạy riêng 3 file này 3 lần: lần 1 đỏ 2/40, lần 2 đỏ 3/40, lần 3 xanh 40/40.
  Máy lúc đó CPU 68%, còn khoảng 1,7GB RAM trống (các tài khoản khác đang chạy).
  Đây là test chập chờn do tải máy, không do thay đổi này; ngoài phạm vi kế hoạch nên chưa sửa, ghi lại để chủ dự án quyết.

Commit Task 1: `3f59e02`.

## Task 2: màn đăng nhập báo "Hệ thống đang bận" khi lỗi hệ thống

### File đã đổi

| File | Việc |
|---|---|
| `src/lib/login-errors.ts` (mới) | `LOGIN_SYSTEM_BUSY = 'system_busy'`, kiểu `LoginErrorKey`, hàm thuần `loginErrorKey(code)`. File không import gì (dùng chung server và client). |
| `src/lib/auth.ts` | Khối `catch` của `authorize`: `locked`/`ip_limited` vẫn ném nguyên văn và kiểm TRƯỚC; mọi lỗi khác log `errorFields(e)` rồi `throw new Error(LOGIN_SYSTEM_BUSY)` thay cho `return null`. Không đổi gì khác. |
| `src/components/auth/LoginForm.tsx` | `setError(t(loginErrorKey(res.error)))` thay cho chuỗi toán tử 3 ngôi. Không đổi JSX, class, `AuthNotice`. |
| `src/i18n/messages/vi.json`, `en.json` (file nóng, C đang giữ) | Nhóm mới `loginBusy.systemBusy` ở CUỐI file, sau `monthField`. vi: "Hệ thống đang bận, vui lòng thử lại sau ít phút." en: "The system is busy, please try again in a few minutes." |
| `src/lib/login-errors.test.ts` (mới) | 3 test ánh xạ mã lỗi. |
| `src/i18n/messages-login-busy.test.ts` (mới) | vi/en cùng key, đúng chữ, không gạch dài, nhóm nằm cuối file. |
| `src/lib/auth-authorize.test.ts` | 5 test nhánh lỗi hệ thống (giữ chỗ IP lỗi, `reserveAccountGuess` lỗi, nhánh email lạ lỗi cho cùng `system_busy`, log không lộ `e.message`, sai mật khẩu vẫn `null`); `afterEach` thêm `vi.restoreAllMocks()`. |
| `src/server/login-guard.test.ts` | 2 test canh (`checkCredentials` ném lỗi store lên, không gọi `registerFailedLogin`; chỗ đoán vẫn được rút trong `finally`); `beforeEach` thêm `vi.restoreAllMocks()` vì file chưa gỡ spy giữa các test. |
| `e2e/42-dang-nhap-he-thong-ban.spec.ts` (mới) | Giữ advisory lock `login_fail_ip:203.0.113.91` lâu hơn `AUTH_TX_OPTIONS.timeout` để giao dịch giữ chỗ IP của app bị P2028 thật; kiểm thông báo bận, không có thông báo sai mật khẩu, 0 dòng `auth_throttle` cho IP giả, hết bận đăng nhập lại vào `/vi/overview`. |

Lệch nhỏ so với mã mẫu trong kế hoạch: regex kiểm gạch dài trong `messages-login-busy.test.ts` viết bằng chuỗi thoát `/[\u2013\u2014]/` thay vì ký tự thật, để chính file test không chứa gạch dài (luật không dùng gạch dài ở bất kỳ đâu).
Ý nghĩa test không đổi.

### Test đỏ trước sửa

E2E `npx playwright test e2e/42-dang-nhap-he-thong-ban.spec.ts` (dev server 3003 do Playwright tự bật, DB `_c`):

```
x  4 [chromium] › e2e\42-dang-nhap-he-thong-ban.spec.ts:34:7 › 42 - dang nhap khi he thong ban (sua loi P2028) › ... (2.8s)
[WebServer] {"level":"error","event":"auth.authorize_failed","errName":"PrismaClientKnownRequestError","errCode":"P2028", ... "at async checkCredentials (... login-guard.ts:84:24)","at async Object.authorize (... auth.ts:140:36)"]}
  Error: Khong tim thay key i18n: loginBusy.systemBusy
  1 failed
  3 passed (2.0m)
```

Log server xác nhận đúng đường lỗi thật: `reserveThrottle` bị P2028, `authorize` bắt rồi (trước sửa) trả `null`.

Unit `npx vitest run src/lib/login-errors.test.ts src/i18n/messages-login-busy.test.ts src/lib/auth-authorize.test.ts src/server/login-guard.test.ts`:

```
FAIL src/lib/login-errors.test.ts (chua co module)
× i18n loginBusy > vi/en cung tap key, dung chu
× i18n loginBusy > nhom loginBusy nam CUOI file (khong chen giua key co san)
× authorize - loi he thong (sua loi P2028) > giu cho IP loi P2028 ... / reserveAccountGuess loi / nhanh email la / log chi co ma loi
  [Error: rejected promise]  (authorize dang tra null)
✓ src/server/login-guard.test.ts (21 tests)
Test Files  3 failed | 1 passed (4)
     Tests  6 failed | 27 passed (33)
```

Đúng kỳ vọng: test "sai mat khau van tra null" và 2 test canh `login-guard` xanh ngay; test "khong co dau gach dai" xanh ngay (chưa có nhóm nên rỗng).

### Sau sửa (xanh)

- Unit 6 file (Bước 2.7, gồm `LoginForm.test.ts`, `auth-credentials-google-only.test.ts`): `Test Files 6 passed (6)`, `Tests 46 passed (46)`.
- E2E 42: `4 passed (1.9m)` (3 setup + 1 ca, ca 42 mất 33.9s).
  2 lần chạy trước đó (dev server nguội do Playwright tự bật) đỏ ở `auth.setup.ts` admin: nút "Đang đăng nhập" còn treo khi hết 60s, không có thông báo lỗi nào, tức là chờ dev server dịch route; ca 42 không chạy tới.
  Tôi tự bật `npx next dev -p 3003`, gọi trước `/vi/login`, `/api/auth/providers` (6.5s lần đầu) rồi chạy lại thì xanh. Đây là chậm của máy (CPU 68%, 3 tài khoản cùng chạy), không do thay đổi.
- E2E đăng nhập (Bước 2.8 mục 4) `01-login`, `21-khoa-tai-khoan`, `23-doi-mat-khau`, `24-r2-1-hoi-sinh-phien`, `27-giao-dien-dang-nhap`, `42-dang-nhap-he-thong-ban`: `51 passed (3.9m)`.
- `npx tsc --noEmit`: exit 0.
- `npm test` (không `DATABASE_URL`): `Test Files 1 failed | 304 passed | 8 skipped (313)`, `Tests 1 failed | 3690 passed | 75 skipped (3766)`, 137,4s.
  Ca đỏ: `src/server/backup-scripts-lock.test.ts` "tien trinh thua khoa (thoat ma 3) KHONG duoc xoa khoa cua tien trinh dang giu", không liên quan; chạy riêng 2 lần đều xanh `5 passed | 1 skipped (6)`. Chập chờn do tải máy.
- Real-db (`DATABASE_URL` trỏ `_c`) `prisma-repo-auth-tx-real-db.test.ts` + `prisma-repo-auth-real-db.test.ts`: `Test Files 2 passed (2)`, `Tests 21 passed (21)`.
- Dev server 3003 đã tắt sau khi chạy xong.

### Ảnh so sánh thông báo (chụp tay, không đưa vào spec)

Chụp bằng script tạm ở scratchpad, đi đúng đường lỗi thật (giữ advisory lock của IP giả `203.0.113.93`), đã dọn các dòng `auth_throttle` của IP giả sau khi chụp.

| Ảnh | Khung (class) | Nền | Chữ | Khung cao x rộng |
|---|---|---|---|---|
| Bận 1440 | `auth_notice auth_noticeError` | `rgba(255, 59, 48, 0.14)` | 14px / 20.3px, `rgb(10, 31, 61)` | 44.3 x 370 |
| Sai mật khẩu 1440 | giống hệt | giống hệt | giống hệt | 44.3 x 370 |
| Bận 390 | giống hệt | giống hệt | giống hệt | 64.6 x 316 (2 dòng) |
| Sai mật khẩu 390 | giống hệt | giống hệt | giống hệt | 44.3 x 316 |

Nhận xét: cùng khung, màu, cỡ chữ, icon cảnh báo; 1440 một dòng.
Ở 390 câu bận xuống 2 dòng, dòng 2 chỉ còn "ít phút.", căn trái thẳng với dòng 1, không tràn khung, không cuộn ngang; nút Đăng nhập dịch xuống 20px theo khung.
Không sửa CSS (kế hoạch cấm đổi giao diện); nếu chủ dự án muốn 1 dòng ở 390 thì phải rút gọn câu chữ.
Ảnh dev có nút "1 Issue" của Next Dev Tools ở góc trái dưới, có cả ở ảnh sai mật khẩu (có từ trước, chỉ ở dev), chưa soi nguyên nhân.

## Chỗ Tester nên soi kỹ

1. `src/lib/auth.ts` khối `catch`: thứ tự kiểm `locked`/`ip_limited` trước `system_busy`; `Error` ném ra chỉ mang `system_busy`.
2. Oracle email: nhánh email lạ và nhánh tài khoản có thật lỗi DB đều ra cùng `system_busy` (test ở `auth-authorize.test.ts`); thử thêm bằng tay qua giao diện nếu được.
3. Giao dịch bị huỷ không để lại dòng giữ chỗ (`auth_throttle`): real-db test 3 và e2e 42.
4. E2E 42 mất khoảng 30s (giữ lock 25s), timeout riêng 115s; chạy cả bộ thì dev server nên nóng trước, nếu không `auth.setup.ts` có thể quá 60s trên máy tải nặng.
5. 390px: thông báo bận 2 dòng (xem bảng trên).
6. Test chập chờn ngoài phạm vi, chưa sửa: `jobs.test.ts` K19 (mốc 24h lệch hơn 1s), `daily-import.test.ts` (e) zip bomb (timeout 5s), `report-export-route.test.ts` S-2, `backup-scripts-lock.test.ts`. Đều phụ thuộc thời gian, đỏ khi máy tải nặng.
7. `.bangiao/anh-p3f/` (ảnh do e2e 27 ghi ra) và `.bangiao/ke-hoach.md` đang chưa theo dõi, tôi không commit (không nằm trong danh sách `git add` của kế hoạch).

## Các commit

- `3f59e02` Task 1: `AUTH_TX_OPTIONS` cho 8 giao dịch auth và đăng ký.
- `e2b12d2` Task 2: `system_busy`, `loginErrorKey`, nhóm i18n `loginBusy`, e2e 42.
