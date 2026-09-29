# Checklist qa-gate trước go-live

## Mục đích và cách dùng

Danh sách các cổng kiểm phải qua trước khi đưa app lên server thật.
Chạy từ trên xuống dưới, mục nào đỏ thì dừng go-live, sửa xong mới chạy tiếp.
Cột Trạng thái dùng đúng một trong các nhãn sau:

- `SẴN SÀNG`: kiểm được ngay trên máy dev.
- `CHỜ P4`: chờ phase giao diện P4 vào `main`.
- `CHỜ P4-X`: chờ phase xuất PDF/JPG (P4-X) của C vào `main`.
- `CHỜ HẠ TẦNG C`: chờ hạ tầng do C dựng (reverse proxy, backup, health check).
- `CHỜ SERVER (P6)`: chỉ đo được trên server thật.
- `CHỜ CHỦ DỰ ÁN`: việc của chủ dự án, kiểm tay.

## Bảng cổng kiểm

| Mã | Cổng | Cách kiểm | Tiêu chí đạt | Nguồn/người giữ | Trạng thái |
|---|---|---|---|---|---|
| QG-01 | Kiểu TypeScript | `npx tsc --noEmit` | 0 lỗi | B | SẴN SÀNG |
| QG-02 | Unit test | `npm test` | 0 đỏ, không test chập chờn | B | SẴN SÀNG |
| QG-03 | e2e toàn bộ | `npm run test:e2e` trên cặp cổng và DB đã đăng ký | 0 đỏ | B | SẴN SÀNG |
| QG-04 | Build production | `next build` (font mock trên máy dev) | build qua | B | SẴN SÀNG |
| QG-05 | Đối chiếu đọc DB | `npm run check:read` | OK | B | SẴN SÀNG |
| QG-06 | Header bảo mật có mặt | e2e 26 | đủ 6 header trên trang, redirect, intl | B | SẴN SÀNG |
| QG-07 | CSP chuyển enforce | e2e 27 trên `next start` | 0 vi phạm; chart, nút Google, quên mật khẩu, xuất PDF/JPG chạy | B | CHỜ P4-X |
| QG-08 | Chặn người chưa đăng nhập, lớp 1 (middleware) và lớp 2 (page và route tự kiểm) | e2e 09 + `src/server/api-routes-guard.test.ts` + tấn công thật bằng curl không cookie, có header `RSC: 1` | mọi trang redirect về đăng nhập, mọi API trả 401 hoặc 403, không lộ dữ liệu | B | SẴN SÀNG |
| QG-09 | Khoá sau 5 lần sai | e2e 21 + tấn công thật: 5 lần sai tuần tự và 10 lần song song | lần 5 khoá, song song không lọt quá 5 lượt bcrypt, email lạ và tài khoản chỉ Google trả cùng thông báo | B | SẴN SÀNG |
| QG-10 | Giới hạn theo IP | tấn công thật đổi phần tử đầu `X-Forwarded-For` | 20 lần sai trong 15 phút mỗi IP vẫn chặn. Máy dev chỉ chứng minh app không tin phần tử ĐẦU của `X-Forwarded-For`; đổi phần tử CUỐI vẫn né được khi không có proxy. Chống giả IP thật chỉ có sau proxy tin cậy, kiểm lại ở đó | B | SẴN SÀNG (máy dev), CHỜ HẠ TẦNG C (sau proxy) |
| QG-11 | Quên mật khẩu, đặt lại mật khẩu | e2e 22 + tấn công thật | 3 lần mỗi giờ mỗi email, 10 lần mỗi giờ mỗi IP, không lộ email tồn tại, token 30 phút dùng 1 lần, có giới hạn gửi đặt lại theo IP | B | SẴN SÀNG |
| QG-12 | Giới hạn `POST` quên mật khẩu ở proxy (L1 = b) | gửi dồn qua proxy | proxy trả 429 | C | CHỜ HẠ TẦNG C |
| QG-13 | Load test | `docs/load-test.md` | đạt 4 tiêu chí (100 người dùng ảo, trang p95 không quá 3 giây, p99 không quá 5 giây, xuất Excel p95 không quá 8 giây, lỗi dưới 1%) | B | SẴN SÀNG (máy dev), CHỜ SERVER (P6) |
| QG-14 | Hiệu năng trang đơn lẻ T1 | `npm run perf:pages` | mọi request không quá 1500 ms | B | SẴN SÀNG |
| QG-15 | Health check có kiểm DB | route mới của C | DB tắt thì báo lỗi | C | CHỜ HẠ TẦNG C |
| QG-16 | Backup hằng ngày và thử khôi phục thật | script của C | khôi phục ra DB tạm, số dòng khớp | C | CHỜ HẠ TẦNG C |
| QG-17 | Kiểm env khi khởi động, log có cấu trúc không lộ dữ liệu nhạy cảm, log stdout có xoay vòng (Docker `max-size`/`max-file` hoặc logrotate) và có trần dung lượng | của C | thiếu biến bắt buộc thì dừng rõ ràng; log không phình đĩa không giới hạn | C | CHỜ HẠ TẦNG C |
| QG-18 | Reverse proxy: `X-Forwarded-For`, HSTS, nosniff mọi đường dẫn, upload 12 MB, chờ 120 giây | `curl -I` qua proxy, `/api/health` trả `clientIpResolved: true` | đúng `docs/csp-header-bao-mat.md` mục 3 và 4; từ máy ngoài `curl http://<server>:3000/` bị từ chối; qua proxy gửi `X-Forwarded-For: 1.2.3.4` 121 lần tới `/api/health` phải có 429 | C | CHỜ HẠ TẦNG C |
| QG-19 | Giao diện P4 soi pixel 1440 px và 390 px, sáng và tối | e2e + soi tay | không lệch | C | CHỜ P4 |
| QG-20 | Xuất PDF/JPG đúng quyền xem tiền | e2e của P4-X | viewer không thấy số tiền | C | CHỜ P4-X |
| QG-21 | Repo GitHub chuyển Private, đổi `NEXTAUTH_SECRET` và mật khẩu tài khoản seed trên server thật | kiểm tay | xong | Chủ dự án | CHỜ CHỦ DỰ ÁN |
| QG-22 | Pentest tổng trên bản sẽ deploy | `/ddc-tower:pentest` | 0 lỗi mức cao và trung bình | B | CHỜ P4-X và HẠ TẦNG C |

## Cách chạy một lượt qa-gate

Dùng skill `/ddc-tower:golive` ở chặng qa-gate, đưa danh sách bảng trên làm đầu vào.
Chạy các mục theo thứ tự mã, ghi kết quả từng mục vào bảng "Nhật ký các lượt chạy" bên dưới.
Mục nào đang `CHỜ ...` thì ghi rõ là chưa kiểm được, không ghi là đạt.
Chỉ go-live khi mọi mục đều đạt.

## Nhật ký các lượt chạy

Để trống, điền sau mỗi lượt chạy: ngày, commit, người chạy, mục đỏ (nếu có), kết luận.

| Ngày | Commit | Người chạy | Mục đỏ | Kết luận |
|---|---|---|---|---|
| 2026-09-29 | `1d6bbbb` (load test vòng 2, Next 15.5.26, máy dev, chi tiết `docs/load-test.md` mục 9) | Tester B | QG-13 (chỉ đo QG-13; các mục khác chưa chạy lượt qa-gate đầy đủ) | Mức 30 người dùng ảo: ĐẠT (trang p95 1148 ms, p99 1543 ms, Excel p95 1008 ms, lỗi 0,00%). Mức 50: KHÔNG ĐẠT (trang p95 3891 ms > 3000 ms). Mức 100: KHÔNG ĐẠT (trang p95 7992 ms, p99 17615 ms). Máy dev bão hoà 12 đến 13 yêu cầu mỗi giây, đo lại ở P6 (QG-13 vẫn `CHỜ SERVER (P6)`) |
