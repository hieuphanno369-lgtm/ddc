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
- Proxy phải đặt `X-Forwarded-For` đáng tin: nối thêm IP thật vào cuối, hoặc ghi đè bằng `$remote_addr` như mục R7 của `D:\_project\DDC_dieu-phoi\deploy-chuan-bi-lam-viec-voi-IT.md`.
- Cả hai cách trên đều đúng với `TRUSTED_PROXY_HOPS=1` (đã chốt trong `.bangiao/archive/p3e-phan1-2026-09-28/bao-mat.md`).
- Giới hạn tần suất `POST` quên mật khẩu ở proxy (quyết định L1 = b).
- Cho phép `POST /api/csp-report` đi qua proxy (báo cáo vi phạm từ trình duyệt).

## 5. Cách đọc báo cáo vi phạm

- Log của app: các dòng có tiền tố `[csp-report]`, mỗi dòng là một JSON đã lọc (đường dẫn trang không kèm query, chỉ thị bị vi phạm, nguồn bị chặn, dòng, mẫu ngắn).
- Endpoint không ghi DB, không ghi IP hay cookie.
- Danh sách trên trình duyệt thật: chạy e2e 27 (`npx playwright test e2e/27-csp-vi-pham.spec.ts`), tệp đính kèm `csp-vi-pham.json` nằm trong báo cáo Playwright ở `e2e/.report`, kèm bảng tóm tắt in ra console.
- Nên chạy e2e 27 trên `next start` (bản production, không có `'unsafe-eval'`) để số liệu sát thực tế.

## 6. Việc phải xem lại khi P4-X (xuất PDF/JPG của C) vào `main`

C ghi thư viện chụp ảnh dùng gì trong `thay-doi.md` của P4-X (`lenh-cho-C-2026-09-28-p4.md` dòng 78).
Cần đối chiếu các điểm sau, chạy lại e2e 27 rồi cập nhật mục 8:

- Thư viện có dùng `eval` hoặc `new Function` không. Nếu cần `'unsafe-eval'` thì là điểm trừ, ưu tiên thư viện không cần.
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

Để trống, tester điền sau khi chạy e2e 27 trên `next start`.
Bảng gồm: trang, chỉ thị, nguồn bị chặn, đề xuất xử lý.

| Trang | Chỉ thị | Nguồn bị chặn | Đề xuất xử lý |
|---|---|---|---|
| | | | |
