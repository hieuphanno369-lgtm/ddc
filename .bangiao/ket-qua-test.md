# Kết quả kiểm thử P3F (tester, lần 3)

Nhánh `feature/p3f-dang-nhap-moi`. Skill đã dùng: `test-driven-development`, `verification-before-completion`.
Kết luận: XANH. Không tìm thấy lỗi code sản phẩm. Không sửa code sản phẩm.

## Cổng kiểm (số liệu thật)

- `npx tsc --noEmit`: sạch.
- `npm test`: 254 file đạt, 2 file skip; 2951 test đạt, 26 skip (cần DB thật).
- `npx playwright test` (cổng 3003, DB `ddc_control_tower_c`): lần cuối 175 đạt, 1 skip, 0 rớt (14.9 phút).
- e2e 23/27/28/29 chạy riêng: 62/62 đạt.
- `next build` với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`: exit 0.
- DB sau test: `dim_department` và `signup_request` đều 0 dòng (dọn sạch).

## Rà chất lượng file WIP

- Đã đọc diff `72bae8b` và `63905fa`. Test có khẳng định hành vi thật (không chống xanh giả): tài khoản chờ bật bị từ chối cả mật khẩu và Google, không tự tạo tài khoản; 2 admin bật cùng lúc; trùng email; email biên; phòng ban đổi giữa chừng; mật khẩu không lọt log/URL/storage; trang công khai không gọi API dữ liệu.
- Sửa lỗi định dạng (thụt dòng, `=await`) ở e2e 23 và 28.

## Đối chiếu "Trường hợp biên bắt buộc"

Bao bởi `src/server/signup-qa.test.ts`, `actions-signup*.test.ts`, `src/lib/auth-google-cho-bat.test.ts`, e2e 27/28/29: hoa thường và khoảng trắng, tên miền con, đuôi kéo dài, nhiều `@`, trùng và đồng thời, hết lượt (e2e 29 bước 7), tài khoản chờ đăng nhập mật khẩu và Google, bật khi đã có tài khoản, phòng ban ẩn hoặc trống giữa chừng, đổi ngôn ngữ giữ `?token=`, không lộ dữ liệu dự án ở trang công khai, lỗi hạ tầng chỉ log tên lỗi, mật khẩu không rò rỉ.
Giao diện: 390/1280/1440, sáng/tối, vi/en, không cuộn ngang, vùng bấm 44px, focus 2px, reduced-motion, CLS.

## Chập chờn đã xử lý (chỉ file test và cấu hình e2e)

Máy đang chạy nhiều dev server nên các bước đăng nhập và `goto` có lúc chậm quá 5s hoặc 60s. Mỗi lần chạy toàn bộ rớt 2 test khác nhau (07 và 22, rồi 12 và 20, rồi 21 và 28 bước 10), chạy riêng đều xanh. Đã sửa:
- `playwright.config.ts`: `expect.timeout` 15s.
- e2e 12, 23, 28 bước 10: `test.setTimeout` 120s hoặc 180s.
- e2e 20: chờ tới 20s.
- e2e 27/28/29 và `helpers/login.ts`: chờ `networkidle` trước khi bấm form (tránh submit gốc trước khi hydrate); `global-setup.ts` xoá `authThrottle` đầu mỗi lần chạy.

## Lưu ý

- e2e 28 bước 11 (danh mục phòng ban trống) bị skip có chủ đích ở lần chạy cuối (DB lúc đó còn phòng ban khác); chạy 23/27/28/29 riêng thì bước này chạy và đạt.
- Máy còn giữ dev server cũ trên cổng 3003 (PID 22492); `next build` chạy tại chỗ làm nó trả 500. Cần khởi động lại dev server trước khi chạy e2e tiếp (Playwright sẽ tự dựng nếu cổng trống).
- `/dieu-khoan` còn `[LIÊN HỆ]` chờ chủ dự án điền.
