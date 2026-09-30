# Thiết kế Đăng nhập / Đăng ký (P3F) - bản chốt 2026-09-29

Chủ dự án chốt thiết kế này ngày 2026-09-29.
Bản xem trực tiếp: https://claude.ai/artifact/MJTtRgDqWbNY7dbSX1uzp1 (chỉ tài khoản chủ dự án mở được).

## Các file

- `Main.dc.html`: Đăng nhập, chế độ sáng, gồm màn Quên mật khẩu và Kiểm tra hộp thư.
- `Dark.dc.html`: Đăng nhập, chế độ tối.
- `DangKy.dc.html`: Đăng ký, chế độ sáng.
- `Mobile.dc.html`: Đăng nhập trên điện thoại 390px.
- `goc-2026-09-28/`: mock-up gốc đã duyệt ngày 2026-09-28 (bố cục, nội dung, animation cẩu tháp, bộ icon `Icons.dc.html`).

## Quy tắc

- Bố cục, chữ, animation cẩu tháp và bộ icon lấy theo `goc-2026-09-28/`.
- Màu, chữ, bề mặt lấy theo bản chốt 2026-09-29, tức là style kính mờ của app: token `app/tokens.css`, nền mesh `.wall` trong `app/globals.css`, navy `#1d5a9e` + vàng `#f5b301`, font Inter.
- Không dùng nền xanh đêm `#0B1220`, cam thép `#C2410C`, font Be Vietnam Pro / IBM Plex Mono của bản gốc.
- Ảnh logo trong các file `.dc.html` trỏ tới `/_blob/...` của canvas; trong app dùng `public/logo.png`.
