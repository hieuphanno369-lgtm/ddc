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
- Nếu `redirect` xuất hiện, phiên bị mất giữa chừng. Script không tự đăng nhập lại.

## 8. Dọn dẹp

- `npm run perf:clean` xoá dữ liệu `PERF-`.
- `npx prisma db seed` đưa dữ liệu seed thường về như cũ.
- Sau lượt chạy, kiểm không tài khoản nào bị khoá (`lockedAt` rỗng, `failedLoginCount` bằng 0).

## 9. Kết quả đo

Đo ngày 2026-09-29 trên commit `11caa2d` (nhánh `feature/p5-b-bao-mat-qa`), bản build production, `next start -p 3001`, DB `ddc_control_tower_b` với 10.064.500 dòng do `perf:seed` tạo (500 dự án PERF).
Máy dev chạy cả app, DB lẫn công cụ tải nên đây chỉ là mốc so sánh, không phải năng lực của server thật.
Tham số chung: 5 phút, ramp 30 giây, nghỉ 1 đến 3 giây, seed 1, XFF riêng từng người dùng ảo, 3 tài khoản admin, bod, viewer.
Số p50, p95, p99 chỉ tính trên yêu cầu thành công (đơn vị mili giây).

### 9.1. Mức 100 người dùng ảo (mặc định)

Lệnh: `npm run perf:load -- --out=<ngoài repo>`. Kết luận của script: KHÔNG ĐẠT.

| Kịch bản | n | lỗi | lỗi% | p50 | p95 | p99 | max | rps |
|---|---|---|---|---|---|---|---|---|
| project_detail | 1271 | 413 | 32,49% | 5187 | 8604 | 11097 | 15826 | 4,2 |
| api_export | 69 | 0 | 0,00% | 4992 | 7506 | 8625 | 8625 | 0,2 |
| overview_month | 1120 | 0 | 0,00% | 5221 | 8407 | 10638 | 11955 | 3,7 |
| api_health | 290 | 0 | 0,00% | 156 | 524 | 839 | 1094 | 1,0 |
| overview_all | 438 | 0 | 0,00% | 5261 | 8361 | 9037 | 12030 | 1,5 |
| projects_list | 610 | 610 | 100,00% | - | - | - | - | 2,0 |
| alerts | 231 | 88 | 38,10% | 5256 | 8195 | 8560 | 9481 | 0,8 |
| report | 209 | 77 | 36,84% | 5797 | 8750 | 11113 | 11329 | 0,7 |
| trang (gộp) | 3879 | 1188 | 30,63% | 5256 | 8444 | 10638 | 15826 | 12,9 |
| TỔNG | 4238 | 1188 | 28,03% | 5001 | 8400 | 9462 | 15826 | 14,1 |

Vi phạm tiêu chí: tỷ lệ lỗi 28,03% > 1%, trang p95 8444 ms > 3000 ms, trang p99 10638 ms > 5000 ms. Xuất Excel p95 7506 ms đạt (ngưỡng 8000 ms).

### 9.2. Mức 30 người dùng ảo (mốc so sánh)

Lệnh: `npm run perf:load -- --vus=30 --out=<ngoài repo>`. Kết luận của script: KHÔNG ĐẠT.

| Kịch bản | n | lỗi | lỗi% | p50 | p95 | p99 | max | rps |
|---|---|---|---|---|---|---|---|---|
| project_detail | 763 | 255 | 33,42% | 1641 | 3119 | 3684 | 4333 | 2,5 |
| api_export | 65 | 0 | 0,00% | 1613 | 3042 | 3837 | 3837 | 0,2 |
| overview_month | 672 | 0 | 0,00% | 1543 | 3168 | 3778 | 4398 | 2,2 |
| api_health | 187 | 0 | 0,00% | 37 | 206 | 291 | 332 | 0,6 |
| overview_all | 267 | 0 | 0,00% | 1454 | 3266 | 3651 | 4338 | 0,9 |
| projects_list | 370 | 370 | 100,00% | - | - | - | - | 1,2 |
| alerts | 141 | 53 | 37,59% | 1352 | 2833 | 3264 | 3264 | 0,5 |
| report | 129 | 49 | 37,98% | 1911 | 3472 | 4604 | 4604 | 0,4 |
| trang (gộp) | 2342 | 727 | 31,04% | 1573 | 3171 | 3711 | 4604 | 7,8 |
| TỔNG | 2594 | 727 | 28,03% | 1437 | 3119 | 3698 | 4604 | 8,6 |

Vi phạm tiêu chí: tỷ lệ lỗi 28,03% > 1%, trang p95 3171 ms > 3000 ms. Trang p99 3711 ms và xuất Excel p95 3042 ms đạt.

### 9.3. Đọc kết quả

Ghi chú (debugger vòng 1): các số ở mục 9.1, 9.2 đo với bộ kịch bản CŨ (có `projects_list` và viewer vào `alerts`, `report`, `project_detail`). Bộ kịch bản đã sửa ở mục 3, phải đo lại để có số chính thức.

Tỷ lệ lỗi 28% ở cả hai mức KHÔNG phản ánh app lỗi, mà do bộ kịch bản của script sinh lỗi giả. Đã đối chiếu từng nguồn lỗi bằng cách gọi tay từng đường dẫn với từng vai:

- `projects_list` (`/vi/projects`) luôn trả 307 chuyển sang `/vi/projects/1` theo thiết kế của trang, nên script tính 100% là lỗi `redirect` (610 ở mức 100, 370 ở mức 30).
- Vai viewer nhận 404 với mọi dự án PERF (viewer chỉ thấy dự án được phân quyền), nên `project_detail` của viewer là lỗi `status` (413 ở mức 100, 255 ở mức 30).
- Vai viewer bị chuyển (307) khỏi `/vi/alerts` và `/vi/report`, nên hai kịch bản này của viewer là lỗi `redirect` (165 ở mức 100, 102 ở mức 30).

Ở mức 100: 610 + 413 + 165 = 1188, đúng bằng số lỗi. Ở mức 30: 370 + 255 + 102 = 727, đúng bằng số lỗi. Nghĩa là không còn lỗi thật nào (không timeout, không lỗi mạng, không 429, không 5xx).

Độ trễ là tín hiệu thật:

- Mức 30: trang p50 khoảng 1,5 giây, p95 khoảng 3,2 giây, vượt nhẹ ngưỡng 3 giây. Một yêu cầu đơn lẻ lúc làm nóng chỉ 150 đến 320 ms, nên độ trễ tăng theo tải đồng thời.
- Mức 100: trang p50 khoảng 5,3 giây, p95 khoảng 8,4 giây, p99 khoảng 10,6 giây, xa ngưỡng. Thông lượng chỉ đạt 14,1 yêu cầu mỗi giây, gần như không tăng so với mức 30 (8,6), cho thấy máy dev đã bão hoà (một tiến trình Node cùng DB và công cụ tải chung máy).
- Kết luận: mức đầu tiên vượt tiêu chí trang là 30 người dùng ảo (p95 vượt khoảng 6%); ở 100 người dùng vượt gần gấp 3. Xuất Excel đạt ở cả hai mức. `/api/health` luôn nhanh.
- Chưa có mức 50. Cần sửa kịch bản (xem `.bangiao/ket-qua-test.md`) rồi chạy lại để có số lỗi sạch, và đo lại trên server thật ở P6.

Sau cả hai lượt: `admin@`, `bod@`, `viewer@daidung.com.vn` đều `lockedAt` rỗng và `failedLoginCount` bằng 0. Đăng nhập tuần tự 100 lượt và 30 lượt không gặp 429 nào.

Lưu ý: `npx playwright test` chạy `prisma db seed` ở global setup và ĐÃ xoá dữ liệu PERF (sau khi chạy e2e, DB còn 0 dự án PERF, 17 dự án thường). Muốn chạy lại load test phải `perf:seed` lại.
