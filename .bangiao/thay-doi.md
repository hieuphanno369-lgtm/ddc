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

## Bước 3 - Helper `requireUser`

Tạo `src/lib/require-user.ts` + `src/lib/require-user.test.ts` (7 ca, đỏ khi module chưa tồn tại, xanh sau khi
tạo file). `npx tsc --noEmit` sạch; `npm test` **195 file / 2105 test xanh**.

## Bước 4 - Mọi page `(app)` + layout gọi `requireUser` trước khi đọc dữ liệu

- Test tĩnh `src/server/app-pages-require-user.test.ts` (21 ca: quét layout + 13 page, đòi hỏi `requireUser`
  là lệnh await đầu tiên) và test thật `src/server/app-pages-auth-guard.test.ts` (10 ca: overview, projects,
  projects/[id], import - 4 page vốn KHÔNG tự kiểm gì): viết đỏ trước (21/21 đỏ vì `app-pages-require-user`
  chưa có `requireUser` trong bất kỳ file nào; toàn bộ `app-pages-auth-guard` đỏ vì 4 page đọc dữ liệu trước
  khi biết có phiên). Sau khi sửa layout + 13 page theo đúng bảng kế hoạch: **25/25 xanh** (không cần thêm
  `redirect` vào mock của file test nào, không gặp trường hợp biên nêu ở Bước 4.5).
- Chạy lại 15 file test trang hiện có (`pages-role-guard`, `nhap-lieu-page-guard`, `ho-so-du-an-page-guard`
  (+ `.qa`), `compliance-page`, `admin-notify-page`, `data-pages-render`, `operation-pages-render`,
  `finance-gate-pages`, `projects-detail-page-render`, `projects-detail-page-month-guard`,
  `projects-detail-page-finance-guard`, `projects-detail-finance-gate`, `queries-n1`, `messages`): **143/143
  xanh**, không sửa kỳ vọng nào.
- `npx tsc --noEmit` sạch. `npm test`: **197 file / 2130 test xanh**.
- `npx playwright test` (toàn bộ, sau khi dọn 1 tiến trình `next dev` chiếm nhầm cổng 3001 - xem mục "Sự cố
  môi trường" dưới đây): **60/60 xanh**.

## Sự cố môi trường gặp phải khi kiểm chứng Bước 4 (không liên quan code sửa)

Lần chạy `npx playwright test` đầu tiên sau Bước 4 báo đỏ 2 ca hoàn toàn không liên quan phạm vi P3D-B:
`e2e/07-admin.spec.ts` - "them khu vuc san xuat moi" và "kenh thong bao...". Điều tra cho thấy:
- Máy đang chạy song song 2 tài khoản; lúc đó có 1 tiến trình `next dev` khởi động TỪ thư mục
  `D:\_project\DDC_Control_Tower` (tài khoản A) nhưng lại LẮNG NGHE nhầm cổng **3001** (cổng của B), khiến
  Playwright của B (dùng `reuseExistingServer: true`) vô tình nối vào app của A. Bộ nhớ máy lúc đó chỉ còn
  0.7-0.8GB trống trên tổng 15.5GB.
- Xác nhận rõ đây là do môi trường, không phải do code: chạy lại riêng `auth.setup.ts` (chỉ đăng nhập, không
  đụng gì tới thay đổi của P3D-B) cũng timeout 60s ở bước `waitForURL` - một thao tác đăng nhập bình thường
  không thể tự nhiên chậm vậy nếu không phải do tranh chấp tài nguyên hệ thống.
- Đã dừng ĐÚNG 1 tiến trình đó (PID chiếm nhầm cổng 3001, không đụng tiến trình đang nghe cổng 3000 thật của
  A). Sau đó chạy lại riêng `e2e/07-admin.spec.ts`: **6/6 xanh**. Chạy lại toàn bộ: **60/60 xanh** (log ở
  trên). Kết luận: 2 ca đỏ ban đầu là nhiễu môi trường (cổng bị chiếm nhầm + máy gần hết RAM do 2 phiên chạy
  song song), không phải hồi quy từ thay đổi P3D-B.
- **Ghi chú cho Tester:** nếu gặp e2e đỏ ngẫu nhiên không liên quan vùng sửa, kiểm tra `netstat -ano | findstr :3001`
  xem đúng là tiến trình từ `DDC_Control_Tower-B` không trước khi kết luận có lỗi.

---

## Bước 5 - Rà route API + server action, khoá bằng test

Bảng rà (planner đã đọc từng file, không phát hiện lỗ hổng S-1 ở tầng API - middleware không chạy cho
`/api/*` nhưng mọi route đã tự chặn từ trước):

| Route | Cách chặn | Test khoá |
|---|---|---|
| `app/api/auth/[...nextauth]/route.ts` | next-auth, public theo thiết kế | không cần |
| `app/api/health/route.ts` | không kiểm phiên, chỉ trả `{status, time}` | `health-route.test.ts` (mới) |
| `app/api/cron/[job]/route.ts` | `CRON_SECRET` + `timingSafeEqual`, 503 khi thiếu secret | `cron-route.test.ts` (có sẵn) |
| `app/api/export/route.ts` | `getCurrentUser` -> 401, role admin/bod | `export-route.test.ts` (có sẵn) |
| `app/api/report/export/route.ts` | `getCurrentUser` -> 403, role admin/bod | `report-export-route.test.ts` (có sẵn) |
| `app/api/photo-upload/route.ts` | same-origin + `getCurrentUser` -> 401 | `photo-upload-route.test.ts` (có sẵn) |
| `app/api/photos/[...path]/route.ts` | `getCurrentUser` -> 401 | `photo-route.test.ts` (có sẵn); điểm yếu khác loại (xem Câu hỏi 3 kế hoạch): KHÔNG vá trong P3D-B |
| `app/api/templates/daily-resources/route.ts` | `canWriteProject` -> 403 | `daily-template-route.test.ts` (có sẵn) |

Server action (`'use server'`, `src/server/actions*.ts`): mọi hàm export gọi `getCurrentUser`/`requireRole`/
`requireProject` hoặc `requireRoleUser`/`requireWriteProject` (`action-guards.ts`), trả `Forbidden` khi không
có user. KHÔNG sửa server action trong phase này (`actions.ts` không bị đụng, đúng ràng buộc file nóng).
Ngoại lệ mức thấp `deletePhotoAction` (dò mã ảnh trước khi kiểm phiên): ghi nhận theo Câu hỏi 3, vá ở phase sau.

- Tạo `src/server/api-routes-guard.test.ts` (9 ca: quét toàn bộ `app/api/**/route.ts`, đối chiếu sổ đăng ký
  `GUARDS`) và `src/server/health-route.test.ts` (1 ca). Cả hai **XANH NGAY** (đúng kỳ vọng kế hoạch - không
  có lỗ hổng API cần vá, chỉ khoá hồi quy).
- Kiểm chứng test tĩnh có tác dụng thật: tạm đổi `'export/route.ts'` từ `'session'` sang `'health'` trong
  `GUARDS` -> chạy đỏ đúng như dự đoán (`expect(src).not.toMatch(/@\/server\//)` fail vì route export có
  import `@/server/repo`); hoàn tác lại, chạy xanh lại 9/9.
- `npx tsc --noEmit` sạch. `npm test`: **199 file / 2140 test xanh**.

---

(Còn lại: bảng "Sau khi sửa" đầy đủ theo Bước 6.3, kiểm tay trình duyệt, việc không làm - điền ở Bước 6.)
