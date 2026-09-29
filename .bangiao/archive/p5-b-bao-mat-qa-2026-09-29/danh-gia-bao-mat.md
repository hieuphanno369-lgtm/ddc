PHAN QUYET BAO MAT: CHOT

# Đánh giá bảo mật P5-B vòng 2 (diff `2171d61..HEAD`, HEAD `006c549`, bỏ qua CLAUDE.md)

Người rà: security-reviewer, dùng skill `ddc-tower:security-review`.
Agent này không có quyền ghi file nên điều phối viên chép nguyên nội dung báo cáo vào đây.
Nhánh `feature/p5-b-bao-mat-qa`.
Tôi đã đọc diff thật của commit sửa `006c549` (13 file), không chỉ dựa vào `.bangiao/thay-doi.md`.
Tôi tự chạy 7 file unit test liên quan (csp-report, csp-report-route, security-headers, middleware-csp, load-test, api-routes-guard, login-guard): 112/112 test xanh.

## Tóm tắt

Không còn lỗ hổng mức cao hay trung bình.
M1, L1, L2a/L2b, L3, L4 và I1 đã vá đúng gốc.
Commit `006c549` không sinh lỗ hổng mới.
Hai lớp chặn người chưa đăng nhập của P3D-B giữ nguyên: `006c549` không đụng tới `middleware.ts`, nên kết luận của vòng 1 vẫn đúng.
Còn 2 việc nhỏ, đều thuộc tài liệu hoặc test, không chặn merge (xem mục "Còn lại").

## Xác nhận từng mục vòng 1

### M1 (Trung bình): ĐÃ ĐÓNG

- `app/api/csp-report/route.ts:27-32`: `rateLimit('csp-report:global', CSP_REPORT_GLOBAL_PER_MIN, 60_000)` giờ chạy TRƯỚC `clientIpFrom` và `rateLimit(\`csp-report:${ip}\`, 30, 60_000)`.
- Đã chạm trần toàn hệ thống thì hàm trả 429 trước khi tạo khoá theo IP.
  Mỗi cửa sổ 60 giây có tối đa 60 khoá IP mới.
  Bộ dọn của `src/lib/rate-limit.ts` chạy mỗi 5 phút, nên lúc nhiều nhất còn khoảng 60 x 6 = 360 khoá sống, gần như không tốn bộ nhớ.
- Hết đường phình bộ nhớ bằng `X-Forwarded-For` giả hay bằng cách xoay địa chỉ IPv6.
- Có test hồi quy `src/server/csp-report-route.test.ts` ca "M1": mock `rateLimit` để ghi lại khoá, gửi 1.000 IP giả sau khi chạm trần, kiểm cả 1.000 đều 429 và số khoá `csp-report:<ip>` không tăng.
  Test xanh.
- Đánh đổi đã chấp nhận ở vòng 1 vẫn đúng: chỉ cần 2 IP (hoặc 1 IP giả XFF khi không có proxy) là làm cạn được quota báo cáo CSP.
  Không ảnh hưởng tính năng nào của người dùng.

### L1 (Thấp): ĐÃ ĐÓNG

- `src/lib/security-headers.ts:83-86`: `h.delete('content-security-policy')` chạy trước `h.set('content-security-policy-report-only', csp)` và `h.set(NONCE_HEADER, nonce)`.
- Next không còn nhận nonce do client gửi qua tên header enforce.
- Có ghi chú cho lúc chuyển sang enforce (set tên enforce, xoá tên `-report-only`).
- Test ở 2 lớp: `security-headers.test.ts` kiểm `content-security-policy` bằng `null`; `middleware-csp.test.ts` kiểm header `x-middleware-request-content-security-policy` không chứa `evil`.
- Nhánh `decodeURI` lỗi của next-intl vẫn dùng header gốc như vòng 1 đã nêu: Next trả 400 và chỉ ảnh hưởng chính người gửi.
  Không đổi, chấp nhận.

### L2a/L2b (Thấp): ĐÃ ĐÓNG (phần mã)

- `src/lib/csp-report.ts:32-36`: regex mới `/[\u0000-\u001f\u007f-\u009f  ‪-‮⁦-⁩]/g` phủ C0, DEL, C1 (có NEL U+0085), LS, PS và các ký tự bidi embedding, override, isolate.
  Viết bằng mã escape, không để ký tự vô hình trong file nguồn.
- `stripControl` được dùng ở cả 3 chỗ đưa dữ liệu vào log: dòng 61 (chuỗi thô), dòng 79 (pathname của URL), dòng 90 (các trường chuỗi).
- Có test U+2028, U+0085, U+202E trong `csp-report.test.ts`, xanh.
- L2b: thêm hằng `CSP_REPORT_GLOBAL_PER_MIN = 60`, route dùng hằng này, test dùng lại hằng chứ không ghi số cứng.
  Mỗi phút tối đa 60 x 10 = 600 dòng log, giảm 5 lần so với trước.

### L3 (Thấp, tài liệu): ĐÃ ĐÓNG

- QG-10 (`docs/qa-gate-truoc-go-live.md:29`) đã ghi rõ: máy dev chỉ chứng minh app không tin phần tử ĐẦU; khi không có proxy, đổi phần tử CUỐI vẫn né được giới hạn; chống giả IP thật chỉ có sau proxy tin cậy.
- QG-18 (`:37`) đã thêm 2 cách kiểm: `curl http://<server>:3000/` từ máy ngoài phải bị từ chối; gửi `X-Forwarded-For: 1.2.3.4` qua proxy 121 lần tới `/api/health` phải có 429.
- `docs/load-test.md` mục 4 (`:56-58`) đã ghi: `--xff=per-vu` chỉ có tác dụng khi không có proxy; ở P6 mọi người dùng ảo chung một IP nguồn, phải chạy từ nhiều máy nguồn hoặc nới giới hạn có chủ đích và ghi lại việc đã nới.

### L4 (Thấp, tài liệu): ĐÃ ĐÓNG

`docs/csp-header-bao-mat.md` mục 4 (`:55-64`) có đủ 6 ý:

1. Không cache HTML hoặc RSC, chỉ cache `/_next/static`.
2. HSTS có `always`.
3. Bẫy thừa kế `add_header` của Nginx, kèm cách kiểm `curl -I` cho `/`, `/api/health` và `/_next/static/...`.
4. `location /api/csp-report` có `client_max_body_size 32k` và `limit_req`.
5. App bind `127.0.0.1` hoặc mạng nội bộ, không publish cổng 3000.
6. Proxy gỡ `x-middleware-subrequest`.

### I1 (Thông tin): ĐÃ ĐÓNG

- `src/lib/load-test.ts:190-203`: `realOrResolved` giải symlink/junction bằng `realpathSync` cho cả file lẫn gốc repo.
  File không tồn tại thì quay về `path.resolve`; khi đó `readFileSync` cũng lỗi, nên không có đường lọt nào đọc được file.
- `scripts/perf/load-test.ts:53`: gốc repo lấy từ `path.resolve(__dirname, '../..')`, không còn phụ thuộc `process.cwd()`.
  `package.json` không khai `"type"`, `tsx` chạy ở chế độ CJS nên có `__dirname`.
- Có test junction; ca này tự bỏ qua nếu máy không cho tạo symlink.

## Kiểm lỗ hổng mới trong `006c549`

- Route csp-report: chỉ đổi thứ tự và hằng số.
  Kiểm Content-Type, trần body 16 KB đọc theo luồng, `no-store` và `nosniff` giữ nguyên.
- `withCspRequestHeaders`: chỉ thêm một lệnh xoá header.
  Không đổi URL, không đổi body, cookie vẫn được giữ (có test).
- Làm nóng load test: thêm `AbortSignal.timeout(opts.timeoutMs)` và `try/catch`.
  Nhánh lỗi chỉ in loại lỗi (`timeout` hoặc `network`) và đường dẫn, không in cookie, mật khẩu hay nội dung lỗi thô.
- Tài liệu: phần thêm mới không chứa secret, mật khẩu hay IP thật của server.
  Dòng nhật ký qa-gate chỉ có số đo.
- Kết luận: không có lỗ hổng mới.

## Hai lớp chặn người chưa đăng nhập (P3D-B)

- `006c549` không sửa `middleware.ts` và không sửa route API nào.
- Diff `2171d61..HEAD` của `middleware.ts` giống hệt lúc rà vòng 1:
  - thân `route()` giữ logic cũ;
  - `getToken` đọc request gốc;
  - mọi nhánh return đều đi qua `applySecurityHeaders`;
  - matcher không đổi.
- `api-routes-guard.test.ts` và `login-guard.test.ts` xanh.
- Kết luận: không bị yếu đi.

## Còn lại (không chặn merge)

### R1. Checklist log xoay vòng cho C chưa được ghi (Thấp, tài liệu, làm ở P6 hoặc trong lượt merge)

- Vị trí: `docs/qa-gate-truoc-go-live.md:36` (QG-17).
- Vòng 1 mục L2 có yêu cầu "Ghi vào checklist của C (QG-17): log có xoay vòng và trần dung lượng".
  Coder không làm ý này, và bảng sửa trong `.bangiao/thay-doi.md` cũng không nhắc tới.
- Rủi ro còn lại: 600 dòng log mỗi phút từ endpoint công khai. Nếu log không xoay vòng, đĩa đầy dần qua nhiều tháng.
- Cách vá: thêm vào cột Đạt khi của QG-17: "log stdout của app có xoay vòng (ví dụ Docker `max-size`/`max-file` hoặc logrotate) và có trần dung lượng".
  Nên thêm một câu vào `docs/csp-header-bao-mat.md` mục 5: danh sách dùng để quyết định chuyển enforce lấy từ e2e 27, không lấy từ log công khai, vì log này ai cũng bơm được.
  Hiện dòng 74-75 mới chỉ ngầm hiểu như vậy.

### R2. Lỗi chính tả trong tên test (Thông tin)

- `src/server/csp-report-route.test.ts`, ca M1: "da ccham tran" nên là "da cham tran".
  Không ảnh hưởng bảo mật.

### Ghi chú ngoài phạm vi commit

- Cây làm việc có `package.json` sửa nhưng chưa commit: thêm khối `allowScripts` (danh sách gói được chạy install script).
  Thay đổi này không nằm trong diff đã rà và không phải lỗ hổng.
  Điều phối viên cần quyết định commit riêng hay bỏ, đừng để lẫn vào commit của phase mà không ai rà.

## Kết luận

PHAN QUYET BAO MAT: CHOT.
Không còn mục bắt buộc sửa trước khi merge.
Để P6 hoặc lượt merge: R1 (QG-17 log xoay vòng và câu về nguồn số liệu enforce), R2 (chính tả).
Việc còn phải xong trước go-live vẫn là QG-10, QG-12, QG-17, QG-18 ở hạ tầng của C, theo đúng checklist đã cập nhật.
Không thấy lộ secret, mật khẩu hay cookie trong mã và log của phase này.
