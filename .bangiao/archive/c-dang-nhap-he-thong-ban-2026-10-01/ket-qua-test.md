KET QUA: XANH

# Kết quả kiểm thử: sửa lỗi đăng nhập "hệ thống bận" (Prisma P2028)

Nhánh `feature/c-dang-nhap-he-thong-ban`, worktree `D:\_project\DDC_Control_Tower-C`, commit đầu vào `ab92c3d`.
Tester dùng skill `test-driven-development` và `verification-before-completion`.
Không sửa code sản phẩm; chỉ thêm và sửa file test (liệt kê ở mục 6).
DB dùng để kiểm: `ddc_control_tower_c` (xác nhận bằng `select current_database()` qua `mcp__postgres`, chỉ đọc).

Lưu ý môi trường: máy tải 99 đến 100% CPU suốt phiên (3 tài khoản cùng chạy).
Mọi số đo thời gian dưới đây là trong điều kiện tải nặng đó.

## 1. Kiểm độc lập (không dùng số của coder)

| Lệnh | Kết quả thật |
|---|---|
| `npx tsc --noEmit` | exit 0, không lỗi (chạy lại sau khi thêm test: exit 0) |
| `npm test` lần 1 (code coder, chưa thêm gì) | `Test Files 305 passed \| 8 skipped (313)`, `Tests 3691 passed \| 75 skipped (3766)`, 90,5s, exit 0 |
| `npm test` lần cuối (sau khi thêm test và sửa test chập chờn) | `Test Files 305 passed \| 8 skipped (313)`, `Tests 3699 passed \| 75 skipped (3774)`, 188s, exit 0 |
| Real-db: `prisma-repo-auth-tx-real-db.test.ts` + `prisma-repo-auth-real-db.test.ts` (`DATABASE_URL` lấy từ `.env`) | `Test Files 2 passed (2)`, `Tests 21 passed (21)`, 38,7s |
| E2E 01, 21, 23, 24, 27-giao-dien-dang-nhap, 42 (dev server 3003, đã làm nóng) | lần cuối: `51 passed (5.2m)`, exit 0 |

Real-db test 3 in ra đúng P2028 thật: `The timeout for this transaction was 20000 ms, however 24855 ms passed`, tức hằng `AUTH_TX_OPTIONS` có hiệu lực.

Ghi rõ về e2e: dev server 3003 nguội, nên tôi tự bật `npx next dev -p 3003` rồi gọi nóng `/vi/login`, `/en/login`, `/api/auth/providers`, `/api/auth/csrf`, `/vi/overview` trước khi chạy.
Dù đã nóng, lần chạy đầu cả 6 file cho `47 passed, 4 failed` (xem mục 4 và mục 5).
Sau khi sửa e2e 42 và chạy lại thì `51 passed`.
Dev server 3003 đã tắt khi xong (cổng 3003 không còn LISTENING).

## 2. Soi các điểm coder nêu

1. `locked`/`ip_limited` vẫn ưu tiên trước `system_busy`: ĐẠT.
   Đọc `src/lib/auth.ts` dòng 124: so khớp NGUYÊN VĂN `e.message === 'locked' || 'ip_limited'` rồi mới tới `system_busy`.
   Test mới (xanh): lỗi hệ thống có message chứa chữ "locked" hoặc "ip_limited_by_proxy" vẫn ra `system_busy`, không bị coi là khoá.
   Test mới (xanh): lần trước vừa lỗi hệ thống, lần sau `reserveThrottle` trả `null` thì ra `ip_limited`; lỗi hệ thống xen giữa 5 lần sai thì lần sai thứ 5 vẫn ra `locked`.
2. Nhánh email lạ và nhánh tài khoản có thật cùng một lỗi: ĐẠT.
   Test mới: `getAccountState` lỗi (bước chạy cho MỌI email) thì email có thật và email lạ ra `Error` giống hệt (message, name, danh sách thuộc tính, không có `cause`, không có `code`, `JSON.stringify` bằng nhau).
   Test của coder cho `recordThrottle` (email lạ) và `reserveAccountGuess` (tài khoản thật) đều ra đúng `system_busy`.
3. Không lộ `e.message` ra client hay log: ĐẠT.
   Test mới: ném chuỗi trần có chứa `postgresql://...` và ném `undefined` đều ra `system_busy`, log chỉ có `errName: 'string'` / `'undefined'`, không chứa chuỗi kết nối.
   Test của coder: log `P2028` không chứa `postgresql://` và `Transaction already closed`.
4. E2E 42 không để lại cửa hậu ở production, tự dọn: ĐẠT.
   `grep` toàn bộ `src` và `app`: không có cờ, biến môi trường hay route nào giả lập lỗi (chỉ có `DDC_FAKE_TODAY` có từ trước, không liên quan).
   Lỗi được tạo bằng giao dịch riêng của spec giữ advisory lock trên DB e2e, tự nhả khi spec xong.
   Sau khi chạy: `auth_throttle` có 0 dòng (cả bảng), 0 advisory lock còn tồn tại, 0 user test `test-tx-real-db`.
5. 8 giao dịch dùng đúng `AUTH_TX_OPTIONS`: ĐẠT.
   `grep`: 6 `$transaction` trong `prisma-repo-auth.ts` (dòng 120, 139, 172, 194, 227, 277) và 2 trong `prisma-repo-signup.ts` (dòng 83, 163) đều truyền `AUTH_TX_OPTIONS`; không còn `$transaction` nào trần trong 2 file đó.
   Unit test `toBe(AUTH_TX_OPTIONS)` của coder cho cả 8 xanh.
6. Thêm test thiếu (bổ sung vào `src/lib/auth-authorize.test.ts`, 8 test mới, tổng file 17 test xanh):
   lỗi ở `getAccountState` (so sánh 2 nhánh email), lỗi ở `releaseThrottle` trong `finally` (chỗ đoán tài khoản), lỗi ở `releaseThrottle` rút chỗ IP, không thử lại (`reserveThrottle` lỗi chỉ gọi đúng 1 lần), message chứa chữ "locked", giá trị ném không phải `Error`, `ip_limited` sau lỗi hệ thống, `locked` lần 5 sau lỗi hệ thống.
   Ghi chú: các test này đi qua ngay (đặc trưng hóa hành vi đã có), không phải test đỏ trước sửa, vì code sản phẩm đã đúng.
   Hành vi cần chủ dự án biết (không phải lỗi): đúng mật khẩu nhưng bước rút chỗ trong `finally` lỗi thì người dùng thấy "Hệ thống đang bận" và không đăng nhập được (đóng an toàn).

## 3. Phát hiện cần Reviewer biết (không sửa code sản phẩm)

### 3.1 Hạn giao dịch KHÔNG giới hạn thời gian chờ lock

Khi chạy e2e 42 lần 2 (bản giữ lock "đến khi thấy thông báo bận") app treo đúng 50,4s tới khi spec nhả lock.
Log: `The timeout for this transaction was 20000 ms, however 49802 ms passed since the start of the transaction`.
Nguyên nhân: Prisma chỉ phát hiện quá `timeout` ở câu lệnh KẾ TIẾP sau khi câu đang chờ `pg_advisory_xact_lock` trả về; không huỷ câu đang bị chặn trong Postgres.
Hệ quả: `AUTH_TX_OPTIONS.timeout` giới hạn "tổng thời gian sống của giao dịch" chứ không giới hạn "thời gian chờ lock".
Một giao dịch giữ cùng khoá bị kẹt thì các lượt đăng nhập cùng IP (hoặc cùng email) chờ tới khi nó nhả, rồi mới ra `system_busy`.
Câu "kẹt tối đa 20s" trong JSDoc `auth-tx.ts` và kế hoạch Q1 chỉ đúng khi bên giữ lock tự nhả trong 20s.
Không phải lỗi của bản sửa (trước sửa cũng y vậy, hạn 5s).
Nếu muốn chặn thật: thêm `SET LOCAL lock_timeout` trong giao dịch (sửa code sản phẩm, ngoài phạm vi tôi).

### 3.2 Giao diện: thông báo bận xuống dòng (coder chỉ ghi nhận 390px, thiếu 1440 en)

Đo bằng script Playwright (viết ở scratchpad, đi đúng đường lỗi thật bằng cách giữ advisory lock của IP giả), số đo trong `.bangiao/anh-p2028/do-luong.json`.

| Trường hợp | Khung | Số dòng, dòng cuối |
|---|---|---|
| Bận vi 1440 | 370 x 44,3 | 1 dòng |
| Bận en 1440 | 370 x 64,6 | 2 dòng, dòng 2 chỉ còn "minutes." (mồ côi, MỚI, coder không ghi) |
| Bận vi 390 | 316 x 64,6 | 2 dòng, dòng 2 chỉ còn "ít phút." |
| Bận en 390 | 316 x 64,6 | 2 dòng, dòng 2 "a few minutes." |
| Sai mật khẩu (cả 4 tổ hợp) | 44,3 cao | 1 dòng |

Khung, nền `rgba(255, 59, 48, 0.14)`, chữ `rgb(10, 31, 61)` 14px / 20,3px, class `auth_notice auth_noticeError`, icon cảnh báo: GIỐNG HỆT thông báo sai mật khẩu.
Không tràn khung, không cuộn ngang ở cả 4 tổ hợp.
Hệ quả bố cục: khung cao thêm 20,3px nên thẻ đăng nhập ở 1440 cao thêm và dịch lên 10px (en), nút Đăng nhập ở 390 dịch xuống 20px.
Không sửa CSS (cấm đổi giao diện). Nếu chủ dự án muốn 1 dòng ở 1440 en và 390 vi thì phải rút gọn chữ (vd "Hệ thống đang bận, vui lòng thử lại sau." và "The system is busy, please try again later.").
Ảnh: `.bangiao/anh-p2028/` (`busy-{vi,en}-{1440,390}.png`, `wrong-{vi,en}-{1440,390}.png`, `issues-dialog-vi-1440.png`), không commit.

### 3.3 Nút "1 Issue" của Next Dev Tools

Mở hộp thoại Issues trên màn đăng nhập (cả màn sai mật khẩu, tức có từ trước): đó là `Console Error` "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties".
Phần khác biệt React in ra duy nhất là `nonce` của thẻ `<script>` ở `app/[locale]/layout.tsx` dòng 40: server render `nonce="TUHBVDc7LJX2GGKG91ZI0w=="`, client thấy `nonce=""`.
Nguyên nhân: trình duyệt cố ý ẩn thuộc tính `nonce` khỏi DOM khi có CSP nonce, React so sánh và cảnh báo; là cảnh báo dev quen thuộc khi dùng CSP nonce.
Không phải lỗi của thay đổi này (file `layout.tsx` không nằm trong diff), không ảnh hưởng người dùng (chỉ có ở `next dev`, production không hiện), không cần sửa trong phạm vi này.
Ngoài ra console có thêm dòng `401 (Unauthorized)` của `POST /api/auth/callback/credentials`: đúng thiết kế next-auth khi `authorize` ném lỗi hoặc trả `null`, cả thông báo sai mật khẩu cũng có.

## 4. Lỗi test của chính thay đổi này, đã sửa trong file test

### E2E 42: giữ lock theo giờ cố định nên đỏ khi máy chậm

Bản coder giữ lock `AUTH_TX_OPTIONS.timeout + 5` giây (25s) tính từ lúc spec mở lock.
Trên máy tải nặng trình duyệt gửi form trễ, app chỉ chờ khoảng 18,7s (< 20s) thì lock đã được nhả, đăng nhập THÀNH CÔNG, thông báo bận không bao giờ hiện.
Bằng chứng đỏ (lần chạy đầu của tôi): `POST /api/auth/callback/credentials 200 in 18664ms`, spec báo `getByText('Hệ thống đang bận...') element(s) not found`.
Bản sửa tạm thứ nhất (giữ đến khi thấy thông báo) cũng đỏ vì lý do ở mục 3.1 (thông báo chỉ hiện SAU khi lock nhả).
Bản sửa cuối: spec giữ lock, chờ tới khi `pg_locks` cho thấy có phiên của app đang xếp hàng đợi đúng khoá này (`NOT granted`), chờ thêm `AUTH_TX_OPTIONS.timeout + 2s` tính từ lúc đó, rồi nhả lock; có `try/finally` nhả lock dù spec đỏ ở đâu.
Kết quả: `4 passed (56.4s)` (máy tải thường), `4 passed (2.1m)` khi tôi ép thêm 6 tiến trình ăn CPU, và nằm trong lần chạy 6 file `51 passed (5.2m)`.

## 5. E2E 21 và 24 đỏ khi máy quá tải (không phải lỗi của thay đổi)

Lần chạy đầu: 21 (2 test, lan truyền do test 1 timeout để tài khoản `e2e-khoa` bị khoá) và 24 (2 test) đỏ do hạn 60s mỗi test.
Cụ thể: 21 kẹt ở `click` nút "Mở khoá" (chờ "stable") và `waitForURL`, 24 báo `page.goto ... invalid URL` sau khi test ended (hệ quả của timeout).
Log server không có lỗi nào ở các route đó, mọi request trả 200/401 đúng; chỉ là chậm.
Chạy riêng 21: 2/2 lần xanh (1,7 phút và 3,3 phút, chênh gấp đôi vì tải).
Chạy riêng 24: xanh (ở lần chạy 21+24).
Lần chạy 6 file cuối: toàn bộ xanh.
Kết luận: chập chờn do tải máy (hạn 60s mỗi test của `playwright.config.ts`), không liên quan thay đổi.
Tôi không đổi hạn trong config (ngoài phạm vi), chỉ ghi lại.

## 6. Test chập chờn (việc 4): tái hiện, nguyên nhân gốc, đã sửa

Cách tái hiện: chạy `npx vitest run` toàn bộ trong lúc 6 tiến trình Node vòng lặp ăn hết 6 CPU.

Trước khi sửa (cùng điều kiện ép tải): `Test Files 2 failed | 303 passed | 8 skipped (313)`, `Tests 2 failed | 3697 passed`, 208s.
Sau khi sửa (cùng điều kiện ép tải): `Test Files 305 passed | 8 skipped (313)`, `Tests 3699 passed | 75 skipped`, exit 0.
Chạy lặp riêng 4 file này 3 lần dưới ép tải: 3/3 `Test Files 4 passed (4)`, `45 passed | 1 skipped`.
Chạy riêng 5 lần không ép thêm (máy vốn đã 99% CPU): 5/5 xanh (tức không tái hiện được chỉ bằng chạy riêng, cần ép tải).

| File | Nguyên nhân gốc | Sửa (chỉ trong file test) |
|---|---|---|
| `src/server/backup-scripts-lock.test.ts` (đã tái hiện đỏ: `timeout cho dieu kien`) | Tiến trình A giữ khoá bằng `pg_dump` giả ngủ cố định 3s, `waitFor` chỉ 2s, tiến trình B phải mở xong trong 3s. Mở `sh` (MSYS) mất vài giây khi máy tải nên A đã xong và nhả khoá trước khi B thấy, hoặc `waitFor` hết hạn. | `pg_dump` giả chặn tới khi test tạo file nhả (`FAKE_RELEASE_FILE`, tối đa 120s), `waitFor` 20s, `finally` luôn nhả và chờ A thoát, hạn mỗi test 10s lên 30s (test SIGTERM 60s). |
| `src/server/daily-import.test.ts` (e) zip bomb (đã tái hiện đỏ: `Test timed out in 5000ms`) | Chính test dựng zip 3 x 15MB nén DEFLATE mức 9 (nằm ngoài phép đo `elapsed`) mất hơn 5s (hạn mặc định) khi CPU quá tải. | Hạn test 60s; ngưỡng `elapsed < 2000` của phép đo thật giữ nguyên. |
| `src/server/jobs.test.ts` K19 và S3 (không tái hiện được trong lần ép tải này, nhưng nguyên nhân rõ từ số đo của coder `86397338 < 86399000`) | Dung sai cố định 1s giữa `before = Date.now()` và lúc job tính mốc `now - 24h`; `runJob('alerts_daily')` mất 1 đến 3s khi máy tải, vượt dung sai. | Chặn đúng theo ngữ nghĩa: mốc nằm trong `[before - 24h, after - 24h]` với `after = Date.now()` sau lời gọi; không phụ thuộc tốc độ máy. Áp cho cả test S3 (14 ngày) cùng kiểu. |
| `src/server/report-export-route.test.ts` S-2 (không tái hiện được trong lần ép tải này; nguyên nhân từ đọc code) | `rateLimit` dùng cửa sổ 60 giây THẬT (`Date.now()` trong `src/lib/rate-limit.ts`); mỗi request xuất 1 file Excel, máy tải thì 30 request kéo dài quá 60s, cửa sổ hết hạn giữa chừng và request thứ 31 được 200 thay vì 429. | Trong describe S-2: `vi.useFakeTimers({ toFake: ['Date'], now: new Date() })` ở `beforeEach`, `vi.useRealTimers()` ở `afterEach` (chỉ đóng băng `Date`, timer thật vẫn chạy cho exceljs). |

Hai ca K19 và S-2 tôi chỉ chứng minh bằng đọc code và số đo của coder, không có lần đỏ tự tái hiện; bản sửa của chúng xanh trong cả 4 lần chạy ép tải ở trên.
Test SIGTERM trong `backup-scripts-lock.test.ts` bị `skipIf` trên máy này (Windows/Git Bash không chuyển tín hiệu), nên phần hạn 60s của nó chưa được kiểm thực tế.
Không có chỗ nào phải sửa code sản phẩm.

## 7. File test tôi đã thêm hoặc sửa

- `src/lib/auth-authorize.test.ts` (thêm 8 test).
- `e2e/42-dang-nhap-he-thong-ban.spec.ts` (sửa cơ chế giữ lock).
- `src/server/backup-scripts-lock.test.ts`, `src/server/daily-import.test.ts`, `src/server/jobs.test.ts`, `src/server/report-export-route.test.ts` (sửa chập chờn).

Không đụng file nóng, không đụng `vi.json`, `en.json`, `globals.css`.
Ảnh và `do-luong.json` ở `.bangiao/anh-p2028/`, không commit. `.bangiao/anh-p3f/` và `.bangiao/ke-hoach.md` vẫn chưa theo dõi như trước.

## Vòng 2 (sau vòng sửa 1, commit cuối 6b7f5af)

Kết luận vòng 2: XANH. Tester dùng skill `test-driven-development` và `verification-before-completion`.
Không sửa code sản phẩm, không thêm test mới (vòng sửa 1 chỉ đổi comment và tài liệu).

| Kiểm | Kết quả thật |
|---|---|
| `git diff 07b82f0..HEAD --stat` | 3 file: `.bangiao/thay-doi.md` (+12), `src/server/repo/auth-tx.ts` (+3), `src/server/repo/prisma-repo-auth-tx-real-db.test.ts` (1 dòng) |
| Dòng đổi trong `src` có phải comment không | Lọc bỏ mọi dòng bắt đầu bằng `*`, `//`, `/*` thì không còn dòng nào: chỉ chạm JSDoc (auth-tx.ts, 3 dòng ghi chú lock_timeout) và comment đầu file test (mật khẩu thay bằng `<mat-khau>`). Không đổi logic |
| `npx tsc --noEmit` | exit 0, không lỗi |
| `npm test` toàn bộ | `Test Files 305 passed \| 8 skipped (313)`, `Tests 3699 passed \| 75 skipped (3774)`, 83,55s, exit 0 |
| Real-db `prisma-repo-auth-tx-real-db.test.ts` + `prisma-repo-auth-real-db.test.ts` (`DATABASE_URL` từ `.env`, DB `ddc_control_tower_c`) | `Test Files 2 passed (2)`, `Tests 21 passed (21)`, 37,86s, exit 0; vẫn in P2028 thật `timeout 20000 ms, however 24949 ms passed` |
| Grep mật khẩu Postgres (lấy từ `.env`, 12 ký tự, so khớp nguyên văn) trong nội dung mọi file của `git diff main..HEAD --name-only` (21 file) | 0 file chứa |
| Grep mật khẩu đó và chuỗi `<mat-khau>` trong `.bangiao/` trừ `archive` (gồm các file chưa theo dõi) | 0 file chứa |
| E2E 42 + 01 trên cổng 3003 (tự bật `npx next dev -p 3003`, gọi nóng `/vi/login`, `/en/login`, `/api/auth/providers`, `/api/auth/csrf`, `/vi/overview`) | `9 passed (2.3m)`, exit 0: 3 setup, 5 test của 01, 1 test của 42 (28,7s) |
| Sau e2e (`mcp__postgres`, chỉ đọc, DB `ddc_control_tower_c`) | 0 advisory lock còn tồn tại; `auth_throttle` còn 1 dòng `login_fail_ip` `::1` do test "sai mật khẩu" của e2e 01 tạo (hành vi đúng, không phải rác của e2e 42) |
| Dọn | Dev server 3003 đã tắt (0 tiến trình LISTENING cổng 3003) |

Ghi chú: global setup của Playwright chạy lại seed trên DB `_c` (cơ chế có từ trước, không phải thay đổi của vòng này).
Phát hiện 3.1 (hạn giao dịch không giới hạn thời gian chờ lock) nay đã được ghi trong JSDoc `auth-tx.ts` và hoãn cho task S1; không còn là điểm mở về tài liệu.
Mục 3.2 (xuống dòng thông báo bận) vẫn chờ chủ dự án quyết, không thuộc vòng sửa 1.
