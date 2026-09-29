# CSP và header bảo mật (bản nháp Report-Only)

## 1. Trạng thái

Đây là BẢN NHÁP Report-Only của phase P5-B.
Chính sách chỉ báo cáo vi phạm về `/api/csp-report`, chưa chặn bất cứ thứ gì.
Điều kiện chuyển sang chặn thật (enforce): xem mục 7, và P4-X (xuất PDF/JPG của C) đã vào `main` để đo lại vi phạm.
Bốn header còn lại (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy) đã áp thật ngay cho các trang đi qua middleware.
Chủ dự án chốt Q2 = (a): không cho nhúng app vào khung của trang khác, nên dùng `X-Frame-Options: DENY`.

## 2. Chuỗi CSP

Bản production (mỗi chỉ thị cách nhau bằng dấu chấm phẩy, `N` là nonce mới cho mỗi request):

```
default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report; report-to csp-endpoint
```

Bản dev chỉ khác ở `script-src`, có thêm `'unsafe-eval'` vì Next dev dùng eval cho React Refresh.

- `default-src 'self'`: mặc định chỉ nạp tài nguyên từ chính app.
- `script-src 'self' 'nonce-N' 'strict-dynamic'`: chỉ chạy script có nonce đúng của request đó, và script do script tin cậy nạp thêm; không cho script nội tuyến tuỳ ý.
- `style-src 'self' 'unsafe-inline'`: app dùng thuộc tính `style` khắp nơi (Recharts cũng vậy) nên phải cho style nội tuyến, không gắn nonce vào đây vì có nonce thì trình duyệt bỏ qua `'unsafe-inline'`.
- `img-src 'self' data: blob:`: ảnh từ app, ảnh nhúng dạng `data:` và ảnh `blob:` (chuẩn bị cho xuất ảnh).
- `font-src 'self' data:`: font từ app hoặc nhúng dạng `data:`.
- `connect-src 'self'`: fetch và XHR chỉ tới chính app.
- `object-src 'none'`: cấm plugin, thẻ `object`, `embed`.
- `base-uri 'self'`: chặn kẻ chèn thẻ `base` đổi gốc đường dẫn.
- `form-action 'self'`: form chỉ được gửi về chính app.
- `report-uri /api/csp-report` và `report-to csp-endpoint`: nơi gửi báo cáo (Firefox và Safari dùng `report-uri`, Chrome dùng `report-to` qua header `Reporting-Endpoints`).

Bản Report-Only cố ý KHÔNG chứa `frame-ancestors` và `upgrade-insecure-requests`, vì trình duyệt bỏ qua hai chỉ thị này ở chế độ báo cáo và in cảnh báo mỗi trang.
Chống nhúng khung tạm thời dựa vào `X-Frame-Options: DENY`.

Nonce được sinh trong `middleware.ts`, truyền vào render qua header request, `app/[locale]/layout.tsx` gắn vào script chọn giao diện sáng tối, Next tự gắn vào script của nó.
Hệ quả: layout gốc đọc `headers()` nên mọi trang render động.
Chi phí này được đo bằng load test (xem `docs/load-test.md`).

## 3. Header nào đặt ở đâu

| Header | Nơi đặt | Phạm vi | Ghi chú |
|---|---|---|---|
| CSP Report-Only + Reporting-Endpoints | Next `middleware.ts` | Trang (không gồm `/api`, `_next`, file tĩnh) | cần nonce theo request |
| X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy | Next `middleware.ts` | Trang | |
| X-Content-Type-Options: nosniff | Reverse proxy (C) | Mọi đường dẫn, `always` | phủ `/api`, `_next` |
| Strict-Transport-Security `max-age=31536000` (không `includeSubDomains`, không `preload`) | Reverse proxy (C) | Chỉ server block HTTPS | Next không biết chắc kết nối gốc là HTTPS |
| Ẩn X-Powered-By | Reverse proxy (C) hoặc `poweredByHeader: false` trong `next.config.mjs` (C đang dùng file này) | Mọi đường dẫn | |

Phase này không sửa `next.config.mjs`.

## 4. Việc bàn giao cho C (reverse proxy)

- KHÔNG thêm hay ghi đè header CSP ở proxy, để tránh hai chính sách chồng nhau.
- Thêm HSTS, nosniff và ẩn X-Powered-By như bảng ở mục 3.
- Không cache HTML và phản hồi RSC ở proxy, chỉ cache `/_next/static`.
  Trang render động theo phiên và theo nonce, cache sẽ làm lộ dữ liệu giữa người dùng và làm nonce hết tác dụng.
- HSTS thêm `always` (`add_header Strict-Transport-Security "max-age=31536000" always;`) để phủ cả phản hồi lỗi.
- Bẫy thừa kế `add_header` của Nginx: khi một `location` có `add_header` riêng thì mọi `add_header` ở cấp trên bị bỏ.
  Phải lặp lại nosniff và HSTS trong từng `location` có `add_header`.
  Kiểm bằng `curl -I` cho `/`, `/api/health` và `/_next/static/...`, cả ba phải có đủ header.
- `location /api/csp-report` đặt `client_max_body_size 32k` và `limit_req` riêng (endpoint công khai, không phiên).
- Chạy app bind `127.0.0.1` hoặc mạng nội bộ Docker, không publish cổng 3000 ra ngoài.
  Nếu không, người ngoài gọi thẳng app và tự đặt `X-Forwarded-For` giả.
- Proxy gỡ header `x-middleware-subrequest` của client (`proxy_set_header x-middleware-subrequest "";`).
- Proxy phải đặt `X-Forwarded-For` đáng tin: nối thêm IP thật vào cuối, hoặc ghi đè bằng `$remote_addr` như mục R7 của `D:\_project\DDC_dieu-phoi\deploy-chuan-bi-lam-viec-voi-IT.md`.
- Cả hai cách trên đều đúng với `TRUSTED_PROXY_HOPS=1` (đã chốt trong `.bangiao/archive/p3e-phan1-2026-09-28/bao-mat.md`).
- Giới hạn tần suất `POST` quên mật khẩu ở proxy (quyết định L1 = b).
- Cho phép `POST /api/csp-report` đi qua proxy (báo cáo vi phạm từ trình duyệt).

## 5. Cách đọc báo cáo vi phạm

- Log của app: các dòng có tiền tố `[csp-report]`, mỗi dòng là một JSON đã lọc (đường dẫn trang không kèm query, chỉ thị bị vi phạm, nguồn bị chặn, dòng, mẫu ngắn).
- Endpoint không ghi DB, không ghi IP hay cookie.
- Danh sách trên trình duyệt thật: chạy e2e 27 (`npx playwright test e2e/27-csp-vi-pham.spec.ts`), tệp đính kèm `csp-vi-pham.json` nằm trong báo cáo Playwright ở `e2e/.report`, kèm bảng tóm tắt in ra console.
- Nên chạy e2e 27 trên `next start` (bản production, không có `'unsafe-eval'`) để số liệu sát thực tế.
- Quyết định chuyển CSP sang enforce chỉ dựa vào số đo e2e 27 (trình duyệt thật, có kiểm soát), không dựa vào log `[csp-report]` công khai: endpoint không yêu cầu đăng nhập nên ai cũng gửi được báo cáo giả để làm sai lệch danh sách vi phạm.

## 6. Việc phải xem lại khi P4-X (xuất PDF/JPG của C) vào `main`

C ghi thư viện chụp ảnh dùng gì trong `thay-doi.md` của P4-X (`lenh-cho-C-2026-09-28-p4.md` dòng 78).
Cần đối chiếu các điểm sau, chạy lại e2e 27 rồi cập nhật mục 8:

- Thư viện có dùng `eval` hoặc `new Function` không.
  Nếu cần `'unsafe-eval'` thì là điểm trừ, ưu tiên thư viện không cần.
- Ảnh `blob:` và `data:` (đã có trong `img-src`).
- Worker (`worker-src`).
- Nhúng font dạng `data:` hoặc tải CSS font (`font-src`, `style-src`).
- Iframe tạm (ví dụ html2canvas tạo iframe clone): kiểm `frame-src` và `child-src`.
- Tải file bằng URL `blob:` (kiểm `connect-src` và cách tải).

## 7. Việc cho bản cuối (enforce)

- Đổi tên header từ `Content-Security-Policy-Report-Only` sang `Content-Security-Policy` (sửa `CSP_HEADER_NAME`, tên header request trong `withCspRequestHeaders` và `middleware.ts` cho khớp).
- Thêm `frame-ancestors 'none'` (theo Q2 = a) và `upgrade-insecure-requests` (chỉ khi chạy HTTPS).
- Bỏ các nguồn không có vi phạm thật.
- Chạy lại e2e 27 trên `next start`: phải 0 vi phạm, các chức năng chart, nút Google, quên mật khẩu, xuất PDF/JPG vẫn chạy.

## 8. Danh sách vi phạm đã đo

Đo lại vòng 2 ngày 2026-09-29 (thay số vòng 1, vì vòng 1 chạy trên `node_modules` lệch: Next 14.2.35, React 18, không có `sharp`).
Môi trường vòng 2: Next 15.5.26, React 19.3.0, `sharp` có, `npm ci` đúng lockfile, build production mới (đã xoá `.next`) với font mock, chạy `next start -p 3001` (không có `'unsafe-eval'`), Chromium của Playwright, DB `ddc_control_tower_b`.
Dùng `e2e/27-csp-vi-pham.spec.ts`, toàn bộ 40 ca của e2e 26, 27, 28, 29 xanh.
Kết quả: 0 vi phạm trên 11 trang, không có tài nguyên nào bị chặn (mọi vi phạm sẽ có disposition `report`).
Dòng tổng hợp của spec: `[csp] Tong 0 vi pham (Report-Only)`.
Số vi phạm vòng 1 cũng là 0, nên bản danh sách không đổi; chỉ đổi điều kiện đo.

| Trang | Chỉ thị | Nguồn bị chặn | Đề xuất xử lý |
|---|---|---|---|
| `/vi/login` | không có | không có | không cần |
| `/vi/quen-mat-khau` | không có | không có | không cần |
| `/vi/dat-lai-mat-khau?token=x` | không có | không có | không cần |
| `/vi/overview` (phiên admin, có biểu đồ Recharts) | không có | không có | không cần |
| `/vi/overview?month=all` | không có | không có | không cần |
| `/vi/projects` | không có | không có | không cần |
| `/vi/projects/1` (có biểu đồ) | không có | không có | không cần |
| `/vi/report` | không có | không có | không cần |
| `/vi/alerts` | không có | không có | không cần |
| `/vi/admin` | không có | không có | không cần |
| `/vi/nhap-lieu` | không có | không có | không cần |

Ghi chú khi đọc số liệu:

- Nút Google không được bấm vì `.env` của B để trống `GOOGLE_CLIENT_ID`, nên luồng chuyển hướng sang `accounts.google.com` chưa đo (chỉ thị `form-action 'self'` có thể chặn bước này, phải đo lại trên môi trường có Google).
- Trang quên mật khẩu chưa đo phần form vì B không có SMTP (trang chỉ hiện thông báo thiếu SMTP).
- Xuất PDF/JPG của P4-X chưa có trên nhánh này, xem mục 6.
- Khi duyệt bằng Playwright MCP, log server có 2 cặp báo cáo `documentPath=/vi/login`, `blocked=inline` và `blocked=eval`, `source` và `line` đều rỗng.
  Đây là do công cụ điều khiển trình duyệt tự chèn script, không phải mã của app.
  Cùng trang đó chạy bằng Playwright test không sinh thêm dòng nào.
