# Nhập bù lịch sử

Tài liệu này dành cho admin (người bật và tắt nhập bù) và cho người nhập số liệu của dự án (PIC, vai trò data-entry).

## Nhập bù để làm gì

Người nhập số liệu chỉ được nhập trong một khoảng gần hiện tại.
Số theo tháng: chỉ tháng hiện tại và tháng trước.
Số nhân lực và thiết bị theo ngày: từ 7 ngày trước tới 30 ngày sau hôm nay.
Khi cần bổ sung số của giai đoạn cũ hơn, admin bật một khoảng nhập bù cho đúng dự án đó.
Trong khoảng đã bật, người nhập được nhập thêm các ngày và các tháng nằm trong khoảng.
Admin không bị giới hạn này nên không cần nhập bù.

## Quy tắc cần nhớ

- Chỉ admin bật hoặc tắt nhập bù. Các vai trò khác gọi sẽ bị từ chối.
- Nhập bù bật theo từng dự án, mỗi khoảng có ngày bắt đầu, ngày kết thúc và ghi chú lý do.
- Ngày kết thúc không được sau hôm nay, vì nhập bù chỉ dành cho quá khứ.
- Một khoảng dài tối đa 24 tháng (tính theo tháng lịch mà khoảng chạm tới).
- Khoảng tự hết hiệu lực sau 30 ngày kể từ lúc bật, kể cả khi admin quên tắt.
- Hai khoảng đang hiệu lực của cùng một dự án không được chồng lên nhau.
- Người nhập vẫn phải được gán vào dự án (PIC hoặc người dự phòng). Nhập bù không mở quyền cho dự án khác.
- Tháng đã khoá sổ vẫn bị chặn. Muốn nhập bù vào tháng đó, admin mở khoá tháng trước, rồi mới bật nhập bù.
- Không có bước duyệt. Số lưu xong vào báo cáo ngay, nhưng mọi lần lưu đều để lại nhật ký.

## Admin bật và tắt nhập bù

1. Mở trang Hồ sơ dự án và chọn dự án cần nhập bù. Thẻ "Nhập bù lịch sử" chỉ hiện với admin.
2. Chọn "Từ ngày" và "Đến ngày" (định dạng dd/mm/yyyy, gõ tay hoặc bấm biểu tượng lịch).
3. Ghi chú lý do, từ 5 đến 500 ký tự.
4. Bấm "Bật nhập bù". Khoảng vừa bật hiện trong danh sách đang bật, kèm ngày tự tắt.
5. Khi PIC nhập xong, bấm "Tắt" cạnh khoảng đó. Khoảng đã tắt không bị xoá, nó chuyển xuống mục "Lịch sử nhập bù".

Nếu hệ thống báo "Trùng với khoảng đang bật", hãy tắt khoảng cũ hoặc chọn khoảng không chồng lên.
Nếu báo "Khoảng nhập bù tối đa 24 tháng", hãy chia thành nhiều lần bật, mỗi lần một khoảng ngắn hơn.

## PIC nhập bù

1. Mở trang Nhập liệu và chọn dự án. Khi dự án có khoảng nhập bù đang bật, cạnh tên dự án hiện nhãn vàng "Đang nhập bù dd/mm/yyyy - dd/mm/yyyy".
2. Số theo tháng: danh sách tháng có thêm các tháng nằm trong khoảng. Chọn tháng cần bù, nhập số và lưu như bình thường.
3. Nhân lực và thiết bị theo ngày: ở bước "Nhân lực & Thiết bị", chọn ngày cũ trong khoảng ở ô ngày (dd/mm/yyyy). Ngày nằm ngoài khoảng bị báo lỗi và không chọn được.
4. Sửa lại số đã có của một ngày cũ vẫn phải điền lý do sửa, như luật hiện có.
5. Sau khi admin tắt hoặc khoảng hết hạn, các ngày và tháng cũ bị khoá lại, danh sách tháng và ô ngày trở về mức thông thường.

### Nhập bù bằng Excel

Số theo ngày: tải file mẫu ở bước "Nhân lực & Thiết bị" (đường dẫn mẫu là `/api/templates/daily-resources`), điền các ngày cũ trong khoảng rồi tải lên.
Dòng có ngày nằm ngoài khoảng bị đánh dấu "Ngày ngoài khoảng được phép" ở bước xem trước, các dòng khác vẫn xem trước và lưu được.
Số theo tháng: dùng trang Import dữ liệu với đúng tháng cần bù.
Tháng cũ hơn tháng trước chỉ ghi được cho dự án có khoảng nhập bù chạm tháng đó. Dự án khác trong cùng file bị báo "Tháng đã quá hạn nhập, cần admin bật nhập bù".

## Nhật ký

- Mỗi lần bật hoặc tắt ghi vào Nhật ký thay đổi (bảng `audit_log`) và Nhật ký hoạt động (bảng `activity_log`), có người thực hiện, khoảng ngày và ghi chú.
- Mỗi lần PIC lưu số chỉ hợp lệ nhờ nhập bù, hoạt động được ghi với nhãn "(nhập bù)", ví dụ "Lưu nhân lực/thiết bị ngày (nhập bù)".
- Cùng lúc đó `audit_log` có thêm dòng nhãn `backfill` cho dự án và ngày (hoặc tháng) tương ứng. Số cũ và số mới nằm ở dòng nhật ký của chính lần lưu.

## Dành cho người vận hành

- Bảng lưu khoảng: `project_backfill_window` (xem `docs/DATA_WAREHOUSE_README.md`). Tắt là điền `disabledAt`, không xoá dòng.
- Hết hạn là điều kiện đọc: khoảng có `expiresAt` đã qua thì không còn được tính, không cần job dọn.
- Mã nguồn: luật ngày ở `src/lib/daily-entry.ts`, luật tháng ở `src/lib/monthly-entry.ts`, luật khoảng ở `src/lib/backfill.ts`, thao tác admin ở `src/server/actions-backfill.ts`.
