# Kết quả kiểm thử P5-B, vòng kiểm commit `006c549` (sửa theo đánh giá bảo mật vòng 1)

XANH.
Đây là vòng kiểm ĐỘC LẬP cho commit `006c549` (message: "fix(p5b): sua theo danh-gia vong 1 (M1, L1, L2, QG-10, L3, L4, timeout lam nong, assertOutsideRepo)").
Bản trước (`ket-qua-test.md` vòng 2) chỉ phủ commit `1d6bbbb`, chưa xác nhận commit này, nay ghi đè.
Tester dùng skill `test-driven-development` và `verification-before-completion`.
Nhánh `feature/p5-b-bao-mat-qa`, tài khoản B, DB `ddc_control_tower_b`, cổng 3001.
Không sửa code sản phẩm, không sửa file test, không đụng file nóng, không đụng `PROGRESS.md`, `.serena/memories/`, không đụng worktree A hay C.

## Kết luận

Cả 5 điểm chính coder báo cáo đã sửa đúng, có bằng chứng đọc mã và test hồi quy thật, không chỉ tin lời coder.
Toàn bộ cổng kiểm (tsc, unit test, build production, e2e 26 và 27 trên `next start`) đều xanh.
Không phát hiện điểm nào trong 5 điểm bị sai hay thiếu so với báo cáo của coder.

## 1. Xác nhận độc lập 5 điểm sửa theo đánh giá vòng 1

### M1: đổi thứ tự rate limit trong `/api/csp-report`

Đọc `app/api/csp-report/route.ts` dòng 26-32: `rateLimit('csp-report:global', CSP_REPORT_GLOBAL_PER_MIN, 60_000)` chạy TRƯỚC, chỉ khi `global.ok` mới tính `clientIpFrom` rồi `rateLimit(csp-report:${ip}, ...)`.
Đúng như đánh giá yêu cầu.
Test hồi quy có thật: `src/server/csp-report-route.test.ts` dòng 87-105, ca "M1: da ccham tran toan he thong thi 1000 IP gia deu 429 va khong tao them khoa theo IP".
Test mock `rateLimit` để đếm số khoá được tạo, chạm trần toàn cục (60 request) rồi gửi thêm 1000 IP giả khác nhau, xác nhận `after === before` (không sinh thêm khoá `csp-report:<ip>`) và mọi phản hồi đều 429.
Đã tự chạy riêng test này (nằm trong `npm test` mục 3 bên dưới), xanh.

### L1: `withCspRequestHeaders` xoá header `content-security-policy` client tự gửi

Đọc `src/lib/security-headers.ts` dòng 81-89: có `h.delete('content-security-policy')` TRƯỚC khi `h.set('content-security-policy-report-only', csp)`, không chỉ ghi đè report-only như đánh giá phát hiện.
Test có thật ở hai nơi:
`src/lib/security-headers.test.ts` dòng 73-80: request gốc mang cả 3 header giả (`x-nonce`, `content-security-policy-report-only`, `content-security-policy` đều là `'evil'`), sau `withCspRequestHeaders` thì `content-security-policy` phải `toBeNull()`.
`src/server/middleware-csp.test.ts` dòng 89-95 (ca 7 theo mô tả của coder): gửi thêm header `content-security-policy: evil` qua middleware thật, xác nhận header chuyển tiếp cho Next không còn chứa `evil`.

### L2: `stripControl` lọc thêm C1, LS/PS, ký tự bidi

Đọc `src/lib/csp-report.ts` dòng 32-36: regex đã là `/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g`, đủ cả C0 (`\u0000-\u001f`), C1 (`\u007f-\u009f`, U+0085 nằm trong dải này), U+2028/2029 (LS/PS), và bidi (`\u202a-\u202e`, `\u2066-\u2069`).
Test có thật: `src/lib/csp-report.test.ts` dòng 118-125, ca "script-sample va blocked-uri chua U+2028, U+0085, U+202E -> khong con trong ket qua", đưa cả 3 ký tự vào rồi xác nhận không còn trong kết quả JSON, thay bằng khoảng trắng.
Hằng `CSP_REPORT_GLOBAL_PER_MIN = 60` (`src/lib/csp-report.ts` dòng 9) đúng như bảng coder báo, route dùng hằng này (đọc lại ở mục M1), có ca "gioi han toan cuc" dòng 76-86 dùng hằng qua import, không chép số cứng.

### Tài liệu QG-10, QG-18, mục 3-4 `docs/csp-header-bao-mat.md`

`docs/qa-gate-truoc-go-live.md` dòng 29 (QG-10): đã sửa chữ đúng nội dung đánh giá yêu cầu, ghi rõ máy dev chỉ chứng minh không tin phần tử ĐẦU của XFF, đổi phần tử CUỐI vẫn né được khi không có proxy, chống giả IP thật chờ hạ tầng C.
Dòng 37 (QG-18): đã thêm đúng 2 cổng kiểm mới nêu trong đánh giá (curl từ máy ngoài vào cổng 3000 phải bị từ chối; qua proxy giả XFF rồi gửi 121 lần `/api/health` phải có 429 ở lần thứ 121).
`docs/csp-header-bao-mat.md` mục 4 (dòng 51-68): đủ cả 6 ý L4 yêu cầu, mỗi ý một dòng riêng: (1) không cache HTML/RSC ở proxy (dòng 55-56), (2) HSTS thêm `always` (dòng 57), (3) bẫy thừa kế `add_header` của Nginx, kiểm bằng `curl -I` ba đường dẫn (dòng 58-60), (4) `client_max_body_size 32k` và `limit_req` riêng cho `/api/csp-report` (dòng 61), (5) bind `127.0.0.1`/mạng nội bộ, không publish cổng 3000 (dòng 62-63), (6) proxy gỡ header `x-middleware-subrequest` (dòng 64).
Tài liệu đúng định dạng mỗi câu một dòng, không có dấu gạch dài.
`docs/load-test.md` dòng 56 cũng đã ghi rõ ý L3 ("`--xff=per-vu` chỉ có tác dụng khi không có proxy đứng giữa...").

### `assertOutsideRepo` dùng `realpathSync` và gốc lấy từ `__dirname`

Đọc `src/lib/load-test.ts` dòng 1, 190-212: có hàm phụ `realOrResolved` gọi `realpathSync(abs)` (bọc try/catch, file không tồn tại thì chỉ resolve), `assertOutsideRepo` áp hàm này cho CẢ `filePath` và `repoRoot` trước khi so sánh.
`scripts/perf/load-test.ts` dòng 53: gọi `assertOutsideRepo(file, path.resolve(__dirname, '../..'))`, không còn dùng `process.cwd()`.
Test có thật: `src/lib/load-test.test.ts` dòng 141-175, ca "duong dan qua symlink/junction tro vao repo van ne loi" (dòng 155-168, tự bỏ qua nếu máy không tạo được junction, đúng như coder ghi chú) và ca so sánh không phân biệt hoa thường trên win32 (dòng 174).

## 2. tsc và unit test

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` (trước khi phát hiện môi trường thiếu) | exit 0, sạch |
| `npm test` lượt 1 | 246 file xanh (1 skip), 2818 test xanh, 15 skip, 62 giây |
| `npm test` lượt 2 | 246 file xanh (1 skip), 2818 test xanh, 15 skip, 73 giây, khớp lượt 1, không chập chờn |
| `npx tsc --noEmit` (sau khi chạy `npm ci`, xem mục 4) | exit 0, sạch |
| `npm test` lượt 3 (sau `npm ci`) | 246 file xanh (1 skip), 2818 test xanh, 15 skip, 93 giây |

Ca test M1, L1, L2 nêu ở mục 1 đều nằm trong các lượt `npm test` trên, không tách riêng.

## 3. Build production

`rm -rf .next` rồi build với font mock: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=.../font-mock.js npm run build`, exit 0.
Có `/api/csp-report`, `ƒ Middleware 69.7 kB`, mọi trang `[locale]` là động, khớp báo cáo coder.

## 4. Sự cố môi trường phát hiện giữa chừng (đã sửa, không phải lỗi mã)

Lần đầu chạy `npx playwright test e2e/26 e2e/27` trên `next start` thì 26/26 xanh, nhưng lần chạy lại ngay sau đó báo `Cannot find module '...\\playwright-core\\index.js'`.
Kiểm tra: `node_modules/playwright` không tồn tại, `node_modules/playwright-core` chỉ còn `lib/tools`, `lib/vite` (thiếu `package.json`, thiếu `index.js`), dù `package-lock.json` khai đủ `playwright@1.63.0`.
Đây là cùng loại sự cố "node_modules lệch lockfile" mà coder từng gặp và ghi trong `thay-doi.md` ("Debugger vòng 1"), không liên quan gì đến việc nâng cấp Node.js (Node vẫn `v20.20.2`, không đổi).
Đã xác nhận `package.json` và `package-lock.json` không bị sửa (`git status --short` rỗng) trước và sau khi sửa.
Sửa bằng `npm ci` (đồng bộ đúng lockfile, không thêm/đổi dependency) rồi `npx prisma generate`, chỉ chạy trong thư mục `D:\_project\DDC_Control_Tower-B` (worktree B, không đụng worktree A hay C).
Trước khi chạy `npm ci` đã tắt tiến trình `next start` cổng 3001 đang giữ file (`EPERM` lần đầu do file bị khoá).
Sau khi sửa: chạy lại `npx tsc --noEmit` (sạch), `npm test` (lượt 3, xanh, xem mục 2), rồi build và e2e lại từ đầu (mục 3, 5).
Đã kiểm không đụng cổng 3000 (A) hay 3003 (C): trước khi tắt server của mình, cổng 3003 vẫn đang `LISTENING` (tài khoản C đang chạy), cổng 3000 không mở.

## 5. e2e 26, 27 trên `next start` (sau khi sửa môi trường ở mục 4)

`npx playwright test e2e/26-header-bao-mat.spec.ts e2e/27-csp-vi-pham.spec.ts`: **26 passed (1,1 phút)**, exit 0.
Gồm 3 ca setup đăng nhập, 13 ca e2e 26 (header, nonce khớp HTML, endpoint báo cáo 204/415/413/405), 10 ca e2e 27 (0 vi phạm CSP trên 8 trang có phiên + 1 trang không phiên), 1 ca tổng hợp.
Dòng tổng hợp: `[csp] Tong 0 vi pham (Report-Only)`, khớp báo cáo coder.
Đã tắt `next start` cổng 3001 ngay sau khi chạy xong (xác nhận lại bằng `netstat`, không còn `LISTENING` trên 3001).

## Việc còn treo (không phải lỗi, đã có trong hồ sơ trước, nhắc lại cho Reviewer)

- QG-13 (load test 100 người dùng ảo) vẫn `CHỜ SERVER (P6)`, số đo máy dev không đạt tiêu chí độ trễ từ mức 50 người dùng ảo trở lên, đã ghi trong `docs/qa-gate-truoc-go-live.md` và `docs/load-test.md` mục 9.
- Spec `10-ten-app` bản en (2 ca) chỉ đỏ do font mock, không liên quan phase này, không nằm trong phạm vi test được giao ở vòng kiểm này (không chạy `npm run test:e2e` toàn bộ ở vòng này, chỉ chạy đúng 2 spec 26 và 27 theo yêu cầu).
- Cần tester/Reviewer nhớ: máy nào chạy lại vòng kiểm sau này nên `npm ci` trước nếu nghi ngờ `node_modules` lệch lockfile (không riêng gì `playwright`, coder từng gặp với `next`/`react`/`sharp`).
