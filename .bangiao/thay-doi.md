# P3D-B - Chặn truy cập khi chưa đăng nhập (vá S-1): kết quả

## Mốc đầu phase (Bước 1.1)

- `npm test`: **193 file / 2075 test xanh** (đúng mốc main).
  - Phát hiện phụ, không thuộc phạm vi P3D-B: `src/lib/p3c-contract.qa.test.ts` đỏ trên checkout Windows này do
    file `p3c-contract.ts` lưu CRLF nhưng test hard code chuỗi tìm/thay thế bằng `\n`, khiến `.replace()` không
    khớp và ca "PHAI THAT BAI" không thực sự đổi nội dung (2 chuỗi bằng nhau, assertion `not.toBe` sai).
    Đã vá tối thiểu (chuẩn hoá CRLF -> LF khi đọc file trước khi so sánh), commit riêng trước Bước 1
    (`fix(qa): sua p3c-contract.qa.test khong con lech gia CRLF/LF tren Windows`), không đụng gì khác.
- `npx playwright test` (21 spec cũ, chưa có spec 09): **21/21 xanh.**

## Trước khi sửa (Bước 1.3) - đo bằng `curl.exe` trên dev 3001 (không cookie)

Toàn bộ 18 đường dẫn `(app)` (cả `/vi` gốc), so 2 kiểu request:
- **thường** (không header `RSC`): tải trang đầy đủ.
- **RSC** (`-H "RSC: 1"`): mô phỏng điều hướng phía client (Next.js RSC payload).

| Đường dẫn | Kiểu | Status | Redirect | Lộ `projectName`/`masterCode` trong body |
|---|---|---|---|---|
| `/vi/overview` | thường | 307 | `/vi/login` | CÓ (vd `"id":2,"projectName":"SVĐ..."`) |
| `/vi/overview` | RSC | 200 | (không) | CÓ |
| `/vi/projects` | thường | 307 | `/vi/login` | CÓ |
| `/vi/projects` | RSC | 200 | (không) | CÓ |
| `/vi/projects/1` | thường | 307 | `/vi/login` | CÓ |
| `/vi/projects/1` | RSC | 200 | (không) | CÓ |
| `/vi/report` | thường | 307 | `/vi/login` | CÓ |
| `/vi/report` | RSC | 200 | (không) | CÓ |
| `/vi/alerts` | thường | 307 | `/vi/login` | CÓ |
| `/vi/alerts` | RSC | 200 | (không) | CÓ |
| `/vi/compliance` | thường | 307 | `/vi/login` | CÓ |
| `/vi/compliance` | RSC | 200 | (không) | CÓ |
| `/vi/audit` | thường | 307 | `/vi/login` | CÓ |
| `/vi/audit` | RSC | 200 | (không) | CÓ |
| `/vi/admin` | thường | 307 | `/vi/login` | CÓ |
| `/vi/admin` | RSC | 200 | (không) | CÓ |
| `/vi/import` | thường | 307 | `/vi/login` | CÓ |
| `/vi/import` | RSC | 200 | (không) | CÓ |
| `/vi/data-dictionary` | thường | 307 | `/vi/login` | CÓ |
| `/vi/data-dictionary` | RSC | 200 | (không) | CÓ |
| `/vi/data-schema` | thường | 307 | `/vi/login` | CÓ |
| `/vi/data-schema` | RSC | 200 | (không) | CÓ |
| `/vi/nhap-lieu` | thường | 307 | `/vi/login` | CÓ |
| `/vi/nhap-lieu` | RSC | 200 | (không) | CÓ |
| `/vi/ho-so-du-an` | thường | 307 | `/vi/login` | CÓ |
| `/vi/ho-so-du-an` | RSC | 200 | (không) | CÓ |
| `/vi/nhap-lieu?project=1` | thường | 307 | `/vi/login` | CÓ |
| `/vi/nhap-lieu?project=1` | RSC | 200 | (không) | CÓ |
| `/vi/overview?month=all` | thường | 307 | `/vi/login` | CÓ |
| `/vi/overview?month=all` | RSC | 200 | (không) | CÓ |
| `/en/overview` | thường | 307 | `/en/login` | CÓ |
| `/en/overview` | RSC | 200 | (không) | CÓ |
| `/en/projects/1` | thường | 307 | `/en/login` | CÓ |
| `/en/projects/1` | RSC | 200 | (không) | CÓ |
| `/vi` | thường | 307 | `/vi/login` | CÓ |
| `/vi` | RSC | 200 | (không) | CÓ |

**Nhận xét quan trọng:** ngay cả yêu cầu "thường" (không phải RSC) hiện đã có status 307 về `/vi/login`
(layout `(app)` hiện tại đã có `getCurrentUser()` + `redirect()`), NHƯNG body của response 307 đó vẫn chứa dữ liệu
dự án thật (vd `projectName: "SVĐ..."`) do Next.js App Router render layout và page SONG SONG (streaming): page
đã kịp phát dữ liệu ra trước khi layout hoàn tất redirect. Đây đúng là cơ chế lỗ hổng S-1 mà kế hoạch mô tả.
Yêu cầu có header `RSC: 1` (mô phỏng điều hướng phía client) không bị redirect luôn (status 200), lộ rõ hơn.

## Chạy e2e đỏ (Bước 1.3)

`npx playwright test e2e/09-chan-chua-dang-nhap.spec.ts`: **3 xanh / 39 đỏ / 42 tổng** (dev server sạch, port 3001).
- 3 xanh: 3 ca `[setup]` đăng nhập admin/pm/viewer (không thuộc spec 09, chạy trước do phụ thuộc `dependencies`).
- Đỏ đúng như kỳ vọng kế hoạch: `/vi/overview` (cả thường lẫn RSC), `/vi/projects`, `/vi/projects/1` và toàn bộ
  16 đường dẫn còn lại - đỏ vì body chứa `projectName`/`masterCode` (xem bảng trên) dù status có thể đã là 307.
- 2 ca cuối (`trang login van mo duoc`, `API khong cookie: khong tra du lieu`) báo đỏ do `ECONNREFUSED`: dev
  server tự tắt (Playwright tự quản lý webServer nó khởi động) đúng lúc 2 test cuối chạy, không phải lỗi logic.
  Xác nhận lại độc lập bằng `curl.exe` (dev server bật riêng): `/vi/login` -> 200; `/api/export` -> 401;
  `/api/report/export` -> 403; `/api/templates/daily-resources?project=1` -> 403; `/api/photos/...` -> 401;
  `/api/photo-upload` (POST) -> 401/403; `/api/health` -> 200 `{status,time}` - tất cả đúng như test kỳ vọng
  (các route API đã tự chặn từ trước, không phải phạm vi S-1).

Kết luận Bước 1: đã tái hiện đỏ đúng yêu cầu (`/vi/overview` đỏ cả 2 kiểu request, `/vi/projects`,
`/vi/projects/1` đỏ). Tiếp tục sang Bước 2.

---

## Bước 2 - Middleware chặn khi không có phiên

- `src/server/middleware-auth.test.ts` (23 ca mới): viết đỏ trước (15/23 đỏ đúng kỳ vọng kế hoạch), sau khi sửa
  `middleware.ts` theo đúng "Hành vi mới" trong kế hoạch (tính `locale`/`subpath` trước khi kiểm phiên,
  `hasSession = token !== null && token.invalid !== true`, mặc định `role = 'viewer'` khi token thiếu `role`,
  redirect `/{locale}/login` khi không phiên và không phải `isPublicPath`) thì **23/23 xanh**.
  `middleware-secret.test.ts` (test cũ, thiếu `NEXTAUTH_SECRET` -> 500) vẫn xanh.
- `npx tsc --noEmit`: sạch.
- `npm test`: **194 file / 2098 test xanh** (2075 + 23 test middleware mới).
- `npx playwright test e2e/09-chan-chua-dang-nhap.spec.ts`: **42/42 xanh** (dev server sạch).
- `npx playwright test` (toàn bộ): **60/60 xanh** (21 spec cũ + 39 ca spec 09, 3 ca `[setup]` dùng chung không đếm
  lại theo từng spec).

## Ghi chú kỹ thuật phát hiện khi làm Bước 1 (giải thích tại sao S-1 xảy ra)

Ngay cả trước khi sửa middleware, layout `(app)` hiện tại đã có `getCurrentUser()` + `redirect()` nên yêu cầu
tải trang đầy đủ (không header `RSC`) đã trả 307 về `/vi/login`. Nhưng do Next.js App Router render layout và
page SONG SONG (streaming), phần page vẫn kịp phát dữ liệu dự án thật ra response TRƯỚC KHI layout hoàn tất
redirect - nên response 307 đó vẫn có body chứa dữ liệu (xem bảng "Trước khi sửa"). Middleware chặn Ở TẦNG
NETWORK (trước khi Next.js dựng cây layout/page) nên không còn kẽ hở này: response redirect không kèm bất kỳ
phần nào của cây trang.

---

(Các mục còn lại - kết quả Bước 3 trở đi, bảng "Sau khi sửa" đầy đủ theo Bước 6.3, rà API/server action, việc
không làm - sẽ điền tiếp trong các bước kế, xem lịch sử commit `test(p3d-b)/fix(p3d-b)`.)
