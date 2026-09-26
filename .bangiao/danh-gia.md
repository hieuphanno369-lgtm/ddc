PHAN QUYET: CHOT

# Đánh giá vòng 2 P3C-A (Task 0-10), nhánh `feature/p3c-a-form-ke-hoach`, commit sửa `cec9ab0` - 2026-09-26

> Reviewer (vai chỉ đọc) trả báo cáo; điều phối viên chép vào file này.
> Vòng 1 (CAN SUA) lưu ở `danh-gia-vong1.md`.
> Task 11 (Bước 11) vẫn CHỜ, không đánh giá.

## Cổng kiểm (reviewer tự chạy lại)

- `npx tsc --noEmit`: sạch.
- `npm test`: 186 file / 2159 test xanh (vòng 1 là 2153, thêm 6 test).
- `npm run check:read`: không chạy trên DB A vì C đã xoá dữ liệu (0 dự án); coder đã chạy trên DB tạm có seed và OK, reviewer chưa tự kiểm chứng.

## Đối chiếu CẦN SỬA vòng 1

1. Ô ca KH nhân lực không xoá trắng được: ĐẠT.
   Mọi hàm tạo dòng đồng bộ `cellInputs`, nhánh không hợp lệ dùng spread giữ nháp, onBlur ô Tổng giữ `cellInputs`.
   `toPlanInput` trả null khi ô sai, `revertCell` đúng ô, test tái hiện đúng chuỗi xoá dần rồi gõ 600.
2. L-1 zod duyệt tới 30.000 đợt: ĐẠT.
   Zod 4.6.5 không chạy vế phải của `pipe` khi vế trái có issue; test 100 x 300 đợt rác ra đúng 1 issue.
   Kiểu `parsed.data.groups` giữ nguyên, có test biên 300 đợt vẫn qua, luật nghiệp vụ không đổi.

## Các sửa thêm: không thấy hồi quy

- Gap 8px giữa 2 nút, làm tròn `pctSum`, chữ đỏ ô tổng %, viền đỏ ô Tổng lệch.

## Phát hiện mới (không chặn) và xử lý của điều phối viên

- [nit] `totalOk` so chuỗi chặt, "0780" bị tô đỏ mà Lưu vẫn bật: ĐÃ SỬA, so bằng số sau khi kiểm số nguyên (kiểm trình duyệt: "0780" không đỏ, Lưu bật).
- [nit] Ảnh ô rỗng chụp trước khi sửa gap, viền đỏ khó thấy: ĐÃ CHỤP LẠI.
  Khi chụp lại phát hiện gốc: ô sửa tay có `borderColor` inline màu accent đè viền đỏ `.bad`; đã bỏ viền accent khi ô đang nhập sai (kiểm: viền `rgb(255,105,97)`).
  Ô đang rỗng chỉ tồn tại khi focus vì rời ô sẽ trả về số đang lưu, nên ảnh chụp lúc focus.

## Để sau

- L-2: khoá lạc quan theo `updatedAt` và rate limit cho các action ghi (tầng chung).
- L-3: xoá ngầm tháng là chủ đích kế hoạch; khi có nghiệp vụ tắt ca thì quyết giữ hay xoá dòng của ca đã tắt.
- Các mục "Để sau" khác của vòng 1 còn nguyên (xem `danh-gia-vong1.md`), trừ `pctSum`, class ô tổng %, ô Tổng không tô đỏ đã làm.
- Ghi nhận thêm (điều phối viên): khi xoá dần một ô, các giá trị trung gian hợp lệ ("27", "2") được ghi ngay vào ô; xoá trắng rồi rời ô sẽ trả về giá trị trung gian cuối (vd "3") chứ không về giá trị trước khi sửa. Không mất dữ liệu (phải bấm Lưu), có thể cải tiến bằng chụp dòng lúc focus.
