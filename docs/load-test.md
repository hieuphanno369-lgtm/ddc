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
Vai viewer không có kịch bản xuất Excel.

| Kịch bản | Loại | Trọng số | Vai | Đường dẫn |
|---|---|---|---|---|
| `overview_month` | trang | 25 | admin, bod, viewer | `/vi/overview?month=<tháng hiện tại>` |
| `overview_all` | trang | 10 | admin, bod, viewer | `/vi/overview?month=all` |
| `projects_list` | trang | 15 | admin, bod, viewer | `/vi/projects` |
| `project_detail` | trang | 30 | admin, bod, viewer | `/vi/projects/<mã dự án PERF ngẫu nhiên>` |
| `alerts` | trang | 5 | admin, bod, viewer | `/vi/alerts` |
| `report` | trang | 5 | admin, bod, viewer | `/vi/report` |
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

Tester điền sau khi chạy: ngày, commit, tham số, bảng kết quả, kết luận (mức nào bắt đầu vượt tiêu chí).

