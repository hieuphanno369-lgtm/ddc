# Hướng dẫn cấu hình đăng nhập Google

Tài liệu này hướng dẫn tạo OAuth Client trên Google Cloud để bật nút "Đăng nhập bằng Google".
Ai được đăng nhập do admin quyết định ở trang Quản trị, không phụ thuộc domain email.

## 1. Tạo project Google Cloud

Vào [Google Cloud Console](https://console.cloud.google.com/), tạo một project mới hoặc dùng project sẵn có.

## 2. Cấu hình màn hình đồng ý (OAuth consent screen)

Chọn loại **External** (không phải Internal), vì người dùng có thể dùng Gmail cá nhân.
Đặt trạng thái Publish là **Production** (không để ở Testing), để email Gmail ngoài công ty vào được, không chỉ vài tài khoản thử nghiệm.
Ở mục Scopes, chỉ cần `email` và `profile` (scope `openid` next-auth tự thêm mặc định).

## 3. Tạo OAuth Client ID

Vào mục Credentials, tạo OAuth Client ID loại **Web application**.
Ở Authorized redirect URIs, thêm cả hai dòng sau:
- `https://<domain-that>/api/auth/callback/google` (domain thật khi deploy)
- `http://localhost:3000/api/auth/callback/google` (chạy máy cục bộ)

## 4. Điền biến môi trường

Sau khi tạo xong, Google cho một Client ID và Client Secret.
Điền vào `.env` (xem `.env.example`):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` (đúng domain thật khi deploy, ví dụ `https://<domain-that>`)

Để trống `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` thì nút "Đăng nhập bằng Google" tự ẩn.

## 5. Admin thêm email trước khi người dùng đăng nhập

Đăng nhập Google chỉ thành công khi email đó đã được admin thêm ở trang Quản trị (mục Tài khoản), trước khi người dùng bấm đăng nhập lần đầu.
Email lạ (chưa được thêm) sẽ bị từ chối, kể cả khi xác thực Google thành công.
Với tài khoản chỉ đăng nhập bằng Google (không dùng mật khẩu), để trống ô Mật khẩu ban đầu khi tạo tài khoản.
