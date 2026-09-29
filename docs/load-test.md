# Kế hoạch load test

## 1. Mục tiêu và phạm vi

Load test cho biết app chịu được bao nhiêu người dùng cùng lúc trước khi chậm hoặc lỗi.
Phạm vi: chạy trên máy dev, app chạy bằng `next start -p 3001`, DB `ddc_control_tower_b`.
Máy dev chạy cả DB lẫn app nên số đo chỉ là mốc so sánh.
Số đo trên server thật được đo lại ở P6.

## 2. Môi trường

- Máy dev, `next build` rồi `next start -p 3001` (không đo trên `next dev`).
- Dữ liệu 10 triệu dòng do `npm run perf:seed` tạo (dự án mã `PERF-`).
- Dừng dev server cổng 3001 trước khi chạy `next start`.
- `npx playwright test` chạy `prisma db seed` ở global setup.
- Tester phải kiểm xem seed đó có xoá dữ liệu `PERF-` không.
- Nếu có xoá thì chạy load test TRƯỚC e2e, hoặc chạy lại `perf:seed` sau e2e.

## 3. Kịch bản

Mỗi người dùng ảo lặp: chọn một kịch bản theo trọng số, gọi, đọc hết nội dung, nghỉ 1 đến 3 giây, rồi lặp tới hết thời lượng.
Người dùng ảo vào dần trong 30 giây đầu (ramp) để không dồn một cú.
Người dùng ảo được chia đều cho các tài khoản trong file tài khoản (vai admin, bod, viewer).
Kịch bản chỉ gán cho vai được phép: viewer không xuất Excel, không vào `/vi/alerts`, `/vi/report` (trang tự chuyển 307) và không thấy dự án PERF (404), nên viewer chỉ chạy `overview_month`, `overview_all`, `api_health`.
`/vi/projects` không có kịch bản riêng vì trang chỉ chuyển 307 sang dự án đầu tiên theo thiết kế.
Script vẫn coi mọi mã 3xx hoặc khác 200 là lỗi, không nới.

| Kịch bản | Loại | Trọng số | Vai | Đường dẫn |
|---|---|---|---|---|
| `overview_month` | trang | 25 | admin, bod, viewer | `/vi/overview?month=<tháng hiện tại>` |
| `overview_all` | trang | 10 | admin, bod, viewer | `/vi/overview?month=all` |
| `project_detail` | trang | 45 | admin, bod | `/vi/projects/<mã dự án PERF ngẫu nhiên>` |
| `alerts` | trang | 5 | admin, bod | `/vi/alerts` |
| `report` | trang | 5 | admin, bod | `/vi/report` |
| `api_export` | API | 3 | admin, bod | `/api/export?month=<tháng hiện tại>` |
| `api_health` | API | 7 | admin, bod, viewer | `/api/health` |

Tổng trọng số là 100.
Mặc định 100 người dùng ảo cùng lúc trong 5 phút.
Mức 30 và 50 chạy bằng `--vus=30` và `--vus=50` để làm mốc so sánh.
Báo cáo ghi rõ mức nào bắt đầu vượt tiêu chí.

## 4. Đăng nhập và cách tránh khoá tài khoản

Mỗi người dùng ảo đăng nhập đúng một lần, lần lượt từng người, rồi dùng lại phiên đó cho cả lượt chạy.
Phiên đăng nhập sống 8 giờ nên đủ cho lượt chạy 5 phút.
Hệ thống chống đoán mật khẩu chỉ cho một số ít lượt kiểm tra mật khẩu chạy chồng nhau trên cùng một tài khoản (ngưỡng 5).
Đăng nhập lần lượt thì mỗi tài khoản luôn chỉ có một lượt đang chạy, nên 100 lượt đăng nhập liên tiếp không chạm ngưỡng đó, kể cả khi cả 100 người dùng ảo dùng chung một tài khoản.
Giới hạn theo IP chỉ đếm lần đăng nhập SAI (20 lần trong 15 phút), lần đúng được hoàn lại.
Vì vậy 100 lần đăng nhập đúng không làm IP nào bị chặn.
Nếu có một lần đăng nhập sai (sai mật khẩu, tài khoản bị khoá) thì script dừng ngay, không thử lại, nên không bao giờ tự khoá tài khoản.
Trước khi đăng nhập bất kỳ ai, script kiểm tài khoản có tồn tại, đang bật, chưa bị khoá và có vai trò xem được Tổng quan.
Trên localhost không có reverse proxy nên mọi request rơi vào một IP chung, các giới hạn xuất Excel (30 lần một phút mỗi IP) và health (120 lần một phút mỗi IP) sẽ báo 429 giả.
Vì thế mặc định script gửi `X-Forwarded-For` riêng cho từng người dùng ảo, giống hệt việc đứng sau proxy thật.
Tắt bằng `--xff=none` nếu muốn thử hành vi khi mọi người chung một IP.
`--xff=per-vu` chỉ có tác dụng khi không có proxy đứng giữa, vì proxy tin cậy sẽ ghi đè `X-Forwarded-For` bằng IP thật của người gọi.
Ở P6, qua proxy thật, mọi người dùng ảo chung một IP nguồn.
Khi đó phải chạy từ nhiều máy nguồn, hoặc nới giới hạn tần suất có chủ đích và ghi lại việc đã nới.

## 5. Tiêu chí đạt

Chủ dự án đã chốt phương án (c) ngày 2026-09-29: 100 người dùng ảo cùng lúc, thử sức chịu.

| Tiêu chí | Ngưỡng |
|---|---|
| Trang, p95 | không quá 3 giây |
| Trang, p99 | không quá 5 giây |
| Xuất Excel, p95 | không quá 8 giây |
| Tỷ lệ lỗi | dưới 1% |

Có thể đổi ngưỡng bằng `--page-p95`, `--page-p99`, `--export-p95`, `--max-error-rate` (ví dụ chạy mốc 30 người dùng với ngưỡng cũ 1500 mili giây).

## 6. Cách chạy

Tạo file tài khoản NGOÀI repo (mật khẩu không bao giờ ghi vào file trong repo).
Nội dung dạng `[{"email":"...","password":"..."}]`, nên có đủ tài khoản admin, bod, viewer.
Tài khoản data-entry không vào được Tổng quan nên không dùng.

PowerShell:

```powershell
$env:PERF_CONFIRM='ddc_control_tower_b'; npm run perf:seed
Remove-Item -Recurse -Force .next\cache\fetch-cache -ErrorAction SilentlyContinue
$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES='D:\_project\DDC_dieu-phoi\tools\font-mock.js'; npx next build
npx next start -p 3001
# cua so khac:
$env:LOAD_CREDENTIALS_FILE="$env:TEMP\ddc-load-users.json"; npm run perf:load -- --duration=300 --out="$env:TEMP\ddc-load.json"
```

Bash:

```bash
PERF_CONFIRM=ddc_control_tower_b npm run perf:seed
rm -rf .next/cache/fetch-cache
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/d/_project/DDC_dieu-phoi/tools/font-mock.js npx next build
npx next start -p 3001
# cua so khac:
LOAD_CREDENTIALS_FILE=/tmp/ddc-load-users.json npm run perf:load -- --duration=300 --out=/tmp/ddc-load.json
```

Chạy khói ngắn trước: `npm run perf:load -- --vus=3 --duration=15 --ramp=3`.
Mức so sánh: thêm `--vus=30` hoặc `--vus=50`.
Nên ghi file kết quả (`--out`) ra ngoài repo.
File kết quả không chứa mật khẩu hay email nhưng không cần commit.
Nhấn Ctrl+C sẽ dừng sớm và vẫn in bảng, nhưng lượt đó tính là không đạt vì chưa đủ thời lượng.

## 7. Đọc kết quả

- p50 là thời gian của yêu cầu ở giữa, p95 nghĩa là 95% yêu cầu nhanh hơn số đó, p99 tương tự với 99%.
- Các số p chỉ tính trên yêu cầu thành công, còn lỗi được đếm riêng ở cột lỗi.
- `rps` là số yêu cầu mỗi giây trung bình trên cả lượt chạy.
- Loại lỗi: `status` (mã khác 200 hoặc sai loại nội dung), `redirect` (bị đá về trang đăng nhập, phiên mất), `timeout` (quá 30 giây), `network` (đứt kết nối), `rate_limited` (mã 429).
- 429 nghĩa là chạm giới hạn tần suất của app, thường do chạy `--xff=none` hoặc lệch cấu hình proxy, không phải app chậm.
- Nếu `redirect` xuất hiện, phiên bị mất giữa chừng.
  Script không tự đăng nhập lại.

## 8. Dọn dẹp

- `npm run perf:clean` xoá dữ liệu `PERF-`.
- `npx prisma db seed` đưa dữ liệu seed thường về như cũ.
- Sau lượt chạy, kiểm không tài khoản nào bị khoá (`lockedAt` rỗng, `failedLoginCount` bằng 0).

## 9. Kết quả đo

Đo lại vòng 2 ngày 2026-09-29, nhánh `feature/p5-b-bao-mat-qa` (commit `1d6bbbb`), bản build production mới, `next start -p 3001`, DB `ddc_control_tower_b` với 10.064.500 dòng do `perf:seed` tạo (500 dự án PERF, id 18 đến 517).
Môi trường: Next 15.5.26, React 19.3.0, `sharp` có (sau `npm ci` đúng lockfile), font giả để build.
Số đo vòng 1 đã BỎ: vòng 1 chạy trên `node_modules` lệch (Next 14.2.35, React 18, không có `sharp`) và bộ kịch bản cũ sinh lỗi giả, nên không còn giá trị.
Máy dev chạy cả app, DB lẫn công cụ tải nên đây chỉ là mốc so sánh, không phải năng lực của server thật.
Tham số chung: 5 phút, ramp 30 giây, nghỉ 1 đến 3 giây, seed 1, XFF riêng từng người dùng ảo, 3 tài khoản admin, bod, viewer (`creds[i % n]`).
Số p50, p95, p99 chỉ tính trên yêu cầu thành công (đơn vị mili giây).
Trước mỗi bộ đo: xoá `.next/cache/fetch-cache`, khởi động lại `next start`.
Chạy khói `--vus=3 --duration=15 --ramp=3` trước: 22 yêu cầu, 0 lỗi, kết luận ĐẠT.

### 9.1. Mức 100 người dùng ảo (mặc định)

Lệnh: `npm run perf:load -- --out=<ngoài repo>`.
Kết luận của script: KHÔNG ĐẠT.

| Kịch bản | n | lỗi | lỗi% | p50 | p95 | p99 | max | rps |
|---|---|---|---|---|---|---|---|---|
| project_detail | 1179 | 0 | 0.00% | 5645 | 8195 | 17663 | 18756 | 3.9 |
| overview_all | 591 | 0 | 0.00% | 5434 | 7935 | 17489 | 18215 | 2.0 |
| api_export | 63 | 0 | 0.00% | 5523 | 7092 | 14131 | 14131 | 0.2 |
| overview_month | 1540 | 0 | 0.00% | 5460 | 7814 | 17597 | 18271 | 5.1 |
| api_health | 427 | 0 | 0.00% | 183 | 645 | 1034 | 1272 | 1.4 |
| alerts | 135 | 0 | 0.00% | 5234 | 7404 | 16782 | 17357 | 0.4 |
| report | 127 | 0 | 0.00% | 5840 | 8475 | 18492 | 18723 | 0.4 |
| trang (gộp) | 3572 | 0 | 0.00% | 5512 | 7992 | 17615 | 18756 | 11.9 |
| TỔNG | 4062 | 0 | 0.00% | 5341 | 7925 | 17547 | 18756 | 13.5 |

Vi phạm tiêu chí: trang p95 7992 ms > 3000 ms, trang p99 17615 ms > 5000 ms.
Tỷ lệ lỗi 0,00% đạt.
Xuất Excel p95 7092 ms đạt (ngưỡng 8000 ms).

### 9.2. Mức 50 người dùng ảo (mốc so sánh)

Lệnh: `npm run perf:load -- --vus=50 --out=<ngoài repo>`.
Kết luận của script: KHÔNG ĐẠT.

| Kịch bản | n | lỗi | lỗi% | p50 | p95 | p99 | max | rps |
|---|---|---|---|---|---|---|---|---|
| project_detail | 1054 | 0 | 0.00% | 2418 | 4000 | 4566 | 5128 | 3.5 |
| overview_all | 526 | 0 | 0.00% | 2185 | 3729 | 4359 | 4797 | 1.7 |
| api_export | 73 | 0 | 0.00% | 2325 | 3547 | 4078 | 4078 | 0.2 |
| api_health | 383 | 0 | 0.00% | 70 | 230 | 309 | 488 | 1.3 |
| overview_month | 1341 | 0 | 0.00% | 2211 | 3826 | 4547 | 4944 | 4.5 |
| alerts | 129 | 0 | 0.00% | 1927 | 3061 | 3618 | 4147 | 0.4 |
| report | 113 | 0 | 0.00% | 2604 | 4181 | 4485 | 5340 | 0.4 |
| trang (gộp) | 3163 | 0 | 0.00% | 2302 | 3891 | 4547 | 5340 | 10.5 |
| TỔNG | 3619 | 0 | 0.00% | 2131 | 3830 | 4470 | 5340 | 12.0 |

Vi phạm tiêu chí: trang p95 3891 ms > 3000 ms.
Trang p99 4547 ms đạt (ngưỡng 5000 ms), tỷ lệ lỗi 0,00% đạt, xuất Excel p95 3547 ms đạt.

### 9.3. Mức 30 người dùng ảo (mốc so sánh)

Lệnh: `npm run perf:load -- --vus=30 --out=<ngoài repo>`.
Kết luận của script: ĐẠT.

| Kịch bản | n | lỗi | lỗi% | p50 | p95 | p99 | max | rps |
|---|---|---|---|---|---|---|---|---|
| project_detail | 1056 | 0 | 0.00% | 359 | 1265 | 1623 | 1726 | 3.5 |
| overview_all | 534 | 0 | 0.00% | 270 | 1080 | 1433 | 1562 | 1.8 |
| api_health | 371 | 0 | 0.00% | 6 | 49 | 93 | 175 | 1.2 |
| api_export | 92 | 0 | 0.00% | 372 | 1008 | 1321 | 1321 | 0.3 |
| overview_month | 1315 | 0 | 0.00% | 280 | 1052 | 1477 | 1753 | 4.4 |
| alerts | 120 | 0 | 0.00% | 100 | 578 | 700 | 773 | 0.4 |
| report | 113 | 0 | 0.00% | 463 | 1545 | 1723 | 1774 | 0.4 |
| trang (gộp) | 3138 | 0 | 0.00% | 301 | 1148 | 1543 | 1774 | 10.5 |
| TỔNG | 3601 | 0 | 0.00% | 266 | 1116 | 1514 | 1774 | 12.0 |

Đạt cả bốn tiêu chí: trang p95 1148 ms, trang p99 1543 ms, xuất Excel p95 1008 ms, lỗi 0,00%.

### 9.4. Đọc kết quả

- Bộ kịch bản đã sửa (mục 3) không còn lỗi giả: cả ba mức đều 0 lỗi, không 429, không timeout, không 5xx, không `redirect`.
- Mức đầu tiên vượt tiêu chí trang là 50 người dùng ảo (p95 3891 ms, vượt khoảng 30%).
- Ở 30 người dùng còn dư nhiều (p95 1148 ms).
- Mức 100 vượt xa: p95 gấp khoảng 2,7 lần ngưỡng, p99 gấp khoảng 3,5 lần.
- Đuôi phân bố dài (p99 17,6 giây so với p95 8 giây) cho thấy hàng đợi trong một tiến trình Node.
- Thông lượng: 12,0 yêu cầu mỗi giây ở mức 30, 12,0 ở mức 50, 13,5 ở mức 100.
- Từ mức 50 trở lên máy dev đã bão hoà quanh 12 đến 13 yêu cầu mỗi giây (một tiến trình Node, DB và công cụ tải chung máy), thêm người dùng chỉ làm tăng độ trễ.
- `/api/health` luôn nhanh (p95 49 ms ở mức 30, 645 ms ở mức 100).
- Xuất Excel đạt ở cả ba mức.
- Cần đo lại trên server thật ở P6 (nhiều nhân CPU, DB tách riêng, nhiều tiến trình).

### 9.5. Chi phí của nonce

Không tách được chi phí nonce riêng: muốn so sánh có và không nonce cần một bản build khác (không đọc `headers()` ở layout), mà đo không được sửa code sản phẩm.
Chỉ có số gián tiếp, tuần tự một luồng, 200 yêu cầu sau 10 yêu cầu làm nóng, mỗi yêu cầu một XFF riêng:

| Đường dẫn | Loại | p50 (ms) | p95 (ms) |
|---|---|---|---|
| `/vi/login` | trang động, qua middleware, có nonce | 14,5 | 20,1 |
| `/vi/quen-mat-khau` | trang động, qua middleware, có nonce | 13,2 | 18,3 |
| `/api/health` | route động, không qua middleware trang | 1,8 | 3,4 |
| `/logo.png` | file tĩnh | 1,2 | 2,1 |

Diễn giải: một trang động tốn khoảng 13 đến 15 ms mỗi yêu cầu khi máy rảnh, gồm render phía server, middleware và tạo nonce.
Phần riêng của nonce (sinh 16 byte ngẫu nhiên, dựng chuỗi CSP) rất nhỏ so với render nên khó có thể là nguyên nhân độ trễ ở mức 50 và 100, nhưng đây là suy luận, chưa đo trực tiếp.
Độ trễ ở tải cao chủ yếu do hàng đợi CPU.

### 9.6. Sau khi chạy

`admin@`, `bod@`, `viewer@daidung.com.vn` đều `lockedAt` rỗng và `failedLoginCount` bằng 0 (truy vấn read-only sau cả bốn lượt chạy: khói, 100, 50, 30).
Đăng nhập tuần tự không gặp 429 nào.

Lưu ý: `npx playwright test` chạy `prisma db seed` ở global setup và xoá dữ liệu PERF (sau khi chạy e2e, DB còn 0 dự án PERF).
Muốn chạy lại load test phải `perf:seed` lại.
