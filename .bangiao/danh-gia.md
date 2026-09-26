PHAN QUYET: CAN SUA

# Đánh giá cuối P7-C1 (nhánh feature/p7-c-task-bo-sung, diff 984b509..HEAD)

> Ghi chú điều phối: reviewer không có công cụ ghi file; bên điều phối lưu nguyên văn báo cáo vào file này.

Skill đã dùng: `ddc-tower:code-review`.
Nguồn đối chiếu: `D:\_project\DDC_dieu-phoi\lenh-cho-C-2026-09-27.md` PHẦN C-0 và C-1, các chốt của chủ dự án (7.1, 7.3, 7.6), và `.bangiao/ke-hoach.md`, `thay-doi.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md`.

## Tự kiểm (reviewer tự chạy lại, qua PowerShell tại D:\_project\DDC_Control_Tower-C)

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test`: 203 file / 2193 test passed, exit 0.
- Không chạy lại e2e.
  Kết quả e2e dựa trên hồ sơ: coder 70/70, tester 3 lần 70/70.
- Tìm em dash và en dash trong mọi dòng thêm của diff và trong message của 7 commit: không có.
- File nóng không được giữ: `git diff --name-only 984b509..HEAD` với `prisma/`, `app/globals.css`, `app/tokens.css`, `src/server/queries.ts`, `src/server/project-queries.ts`, `PROGRESS.md`, `.serena/`, `CLAUDE.md` ra rỗng, tức là không đụng.
  File nóng có đụng (`vi.json`, `en.json`, `actions.ts`, `prisma-repo.ts`) đều nằm trong danh sách C được giữ theo kế hoạch.

## 1. Code có khớp kế hoạch không? Có.

- **C-0.**
  `E2E_TARGETS` chỉ có 2 cặp `_b`+3001 và `_c`+3003.
  `isExpectedDbUrl` so khớp chính xác hostname, port và pathname, không dùng `includes()`.
  Cùng một hàm `resolveE2eTarget` được gọi ở cả `playwright.config.ts` (trước khi webServer khởi động) và `global-setup.ts` (trước khi seed).
  `webServer.env` truyền `DATABASE_URL` đã kiểm, spec 09 hết gõ cứng 3001, thông báo lỗi không lộ mật khẩu.
  Có test đỏ trước (6 fail rồi 19 pass).
- **7.1.**
  Đã xoá hẳn component, khối trên `/admin`, `resetDataAction`, `resetAllData` ở cả prisma-repo lẫn mock-repo, 2 key i18n, và test cũ.
  Giữ `activity.reset_data` để nhật ký cũ vẫn hiển thị (K7), lý do đúng.
  `git grep` không còn tham chiếu nào trong code sản phẩm.
- **7.3.**
  vi: dòng đậm "BÁO CÁO QUẢN TRỊ", dòng mờ "Danh Mục Dự Án".
  en: "MANAGEMENT REPORTS" / "Project Portfolio".
  Tiêu đề tab theo locale qua `generateMetadata`, h1 trang đăng nhập dùng key, `testNotice` đổi theo K6.
  Đổi giá trị, không đổi tên key (K1), hợp lý.
- **7.6.** `detail.tl.gap` vi = "Chênh lệch KH vs TT", en = "Plan vs Actual variance". Đúng.
- **7.2 và 7.4** đúng là không làm, theo lệnh.

## 2. Test có giá trị thật không? Có, đa số là test hành vi thật.

- `e2e/helpers/env.test.ts`: phủ đủ các biên quan trọng (DB A với mọi cổng, cặp lệch, tên gần giống, host/port khác, URL hỏng, lộ mật khẩu).
- `ActivityViewer-legacy-action.test.ts` của tester: render thật với bản dịch thật.
  Có case tự kiểm chứng (bỏ key thì thấy chuỗi thô), không phải test chạy suông.
- `e2e/10-ten-app.spec.ts`: đo thật scrollWidth, chiều cao 1 dòng, vị trí dòng đậm/mờ, thu gọn, drawer mobile, title theo locale.
  Chính test này đã bắt được lỗi EN xuống 2 dòng ở 13px, chứng minh nó có giá trị.
- `reset-data-removed.test.ts` và `messages-p7-c1.test.ts` là test tĩnh (đọc file, so chuỗi).
  Chúng chấp nhận được vì mục đích là khoá hồi quy "đã gỡ" và "đúng chữ chủ dự án chốt".
- Điểm trừ nhỏ: selector `header.topbar button` với `.first()` trong spec 10 hơi giòn, nếu thêm nút trước nút menu thì sai.
  Không bắt sửa.

## 3. Bảo mật, hiệu năng, tính đúng đắn

- **L-1 (bắt buộc vá, xem mục CẦN SỬA #1).**
  `isExpectedDbUrl` bỏ qua query string, nên `?host=<máy khác>` lọt qua guard.
  Tầng kết nối của Prisma cho tham số `host` trong query ưu tiên hơn host trong URL, nên kết nối thực đi nơi khác trong khi guard vẫn thấy `localhost`.
  Rủi ro thực tế thấp (tên DB vẫn bị khoá, không trỏ được vào `ddc_control_tower`).
  Nhưng đây là tuyến chặn duy nhất giữa e2e (seed, xoá dữ liệu) và các DB cùng server, cách sửa chỉ 1-2 dòng, nằm trong đúng file của phạm vi C-0, và chủ dự án ưu tiên độ bền.
  Vì vậy vá ngay trong nhánh, không đẩy sang nợ.
  Đã kiểm `.env` của cả B lẫn C chỉ có `?schema=public`, nên allowlist chặt không làm vỡ e2e của B.
- **L-2 (không vá trong nhánh này, ghi nợ).**
  `reuseExistingServer: true` ở `playwright.config.ts` dòng 32 không kiểm server đang chạy dùng DB nào.
  Rủi ro này có từ trước diff, và mặc định an toàn vì `launch.json` không đặt `DATABASE_URL`.
  Cách vá đúng (endpoint dev trả `current_database()`, hoặc chỉ tái dùng server khi đặt biến `E2E_REUSE`) thay đổi luồng làm việc của cả B và C.
  Nên làm ở phase riêng, có hỏi chủ dự án (P5 hạ tầng hoặc qa-gate).
- **Fallback 12px dòng đậm sidebar: chấp nhận được.**
  Vùng chữ rộng khoảng 151px: 236 trừ padding 20, trừ brand padding 16, trừ logo 38, trừ gap 11.
  "MANAGEMENT REPORTS" in hoa, đậm 650, ở 13px rộng hơn vùng này nên xuống dòng; ở 12px còn dư khoảng 6%.
  Phân cấp vẫn rõ: 12px đậm 650 so với 11px nặng 500 màu `label3`.
  Áp cho cả 2 locale để nhất quán là đúng.
  Hai điểm cần ghi nợ:
  (a) Style đang viết inline trong `AppShell.tsx` dòng 111, chỉ vì `globals.css` là file nóng không giữ.
  Chỗ đúng là `.brand .nm b` trong `app/globals.css` dòng 56.
  Khi merge xong nên chuyển vào CSS và bỏ inline.
  (b) Biên 6% khá mỏng: font dự phòng lúc chưa tải xong Inter (display: swap), hay cách render chữ trên máy khác, có thể làm xuống dòng lại.
  Nên thêm `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` cho `.brand .nm b` cùng lượt chuyển vào CSS.
  Không chặn nhánh này, vì e2e đo thật đang xanh ở cả vi lẫn en.
- **Test chập chờn 02-overview: chưa tìm ra gốc, không chặn, nhưng phải ghi nợ kèm giả thuyết cụ thể.**
  Giả thuyết reviewer thấy mạnh nhất (chưa chứng minh): cache dữ liệu `unstable_cache` của Next (`src/server/cache.ts`, TTL 1800s) được lưu trên đĩa trong `.next/cache`, và còn nguyên qua các lần dev server khởi động lại.
  `global-setup.ts` seed lại DB nhưng không làm mất hiệu lực cache đó.
  Nếu trước lần chạy e2e đầu tiên có người mở `/vi/overview` trên 3003 lúc DB `_c` đang trống hoặc đang seed (ví dụ giữa lúc migrate và seed ngày 2026-09-26), danh sách rỗng bị giữ tới 30 phút.
  Điều này khớp với việc chỉ lần đầu đỏ, các lần sau xanh, và xanh khi xoá `.next`.
  Cách xác nhận khi tái diễn: xem `.next/cache/fetch-cache` trước khi chạy.
  Cách vá tiềm năng: e2e dùng `distDir` riêng, hoặc xoá Data Cache trước khi webServer chạy.
  Cần kiểm thứ tự webServer và globalSetup của Playwright 1.63; mục 5 của `ket-qua-test.md` giả định seed chạy trước webServer mà chưa kiểm.
  Việc này đụng `cache.ts`/`queries.ts` hoặc cấu hình e2e, nên làm ở lượt riêng.
- **Hiệu năng.**
  `generateMetadata` gọi `getTranslations` mỗi request, rẻ, không có vấn đề.
  Xoá hàm hàng loạt chỉ làm giảm bề mặt tấn công.
- **Tính đúng đắn.**
  `AppShell.tsx` dòng 79 giữ `t('app.headerTitle')` làm fallback tiêu đề trang (K5), hợp lý.
  Không còn chỗ nào dùng `app.name` hay `headerTitle` với nghĩa cũ.
  Comment "DDC Control Tower" ở `src/components/icons/index.tsx` dòng 4 được giữ theo kế hoạch.

## CẦN SỬA (bắt buộc trước CHỐT)

1. **Vá L-1 ở `e2e/helpers/env.ts`, hàm `isExpectedDbUrl` (dòng 65-74).**
   Sau dòng 72 (`if (u.hostname !== 'localhost' || u.port !== '5433') return false;`), thêm điều kiện: query chỉ được chứa đúng key `schema`, và nếu có thì phải bằng `public`.
   Nếu thiếu hoặc có key khác thì trả `false`.
   Ví dụ:
   `if (![...u.searchParams.keys()].every((k) => k === 'schema') || (u.searchParams.get('schema') ?? 'public') !== 'public') return false;`
   Cập nhật JSDoc của hàm (dòng 60-64) cho nói rõ quy tắc query.
   Thêm test vào `describe('isExpectedDbUrl')` trong `e2e/helpers/env.test.ts`, tất cả với cổng `'3003'` và DB `_c`:
   - `?host=db.example.com` ra false;
   - `?schema=public&host=db.example.com` ra false;
   - `?options=-c%20search_path%3Dx` ra false;
   - `?schema=khac` ra false;
   - không có query (`.../ddc_control_tower_c`) ra true;
   - `?schema=public` ra true (đã có qua hằng `C`).
   Viết test đỏ trước, chạy thấy FAIL, rồi mới sửa.
   Cổng kiểm: `npx vitest run e2e/helpers/env.test.ts`, `npx tsc --noEmit`, `npm test`.
   Chạy lại ít nhất `npx playwright test e2e/09-chan-chua-dang-nhap.spec.ts` để chắc guard vẫn nhận `.env` thật của C.
   Commit: `fix(p7-c1): guard e2e chi cho query schema=public trong DATABASE_URL (L-1)`.
   Ghi kết quả vào `.bangiao/thay-doi.md` (mục mới "Vòng CAN SUA #1").
   Không sửa file nào khác ngoài 2 file trên và hồ sơ.

## NÊN SỬA (không chặn, làm cùng vòng nếu tiện)

2. `.bangiao/ket-qua-test.md`: sửa lại số liệu tự mâu thuẫn.
   - Mục 1 dòng 19 ghi "0/79 lần chạy 02-overview" trong khi mục 5 ghi 9 lần.
   - Mục 5 dòng 113 ghi "3/64 (~4.7%)" trong khi thực tế là 1 lần đỏ trên 62 test ở lần chạy đầu.
   Hồ sơ phải trung thực về số.

## SỔ NỢ KỸ THUẬT (ghi vào phien-C.md hoặc lo-trinh khi merge, không làm trong nhánh này)

- N-P7-1 (L-2): `reuseExistingServer` không kiểm DB của server đang chạy (`playwright.config.ts` dòng 32).
  Hỏi chủ dự án chọn cách vá (endpoint dev trả `current_database()`, hay biến `E2E_REUSE`).
- N-P7-2: chuyển `fontSize: var(--t-caption1)` từ inline `src/components/layout/AppShell.tsx` dòng 111 vào `.brand .nm b` trong `app/globals.css` dòng 56.
  Thêm `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
  Chỉ làm khi C giữ được khoá `globals.css`.
- N-P7-3: test chập chờn `e2e/02-overview.spec.ts`, với giả thuyết cache `unstable_cache` trên đĩa không bị làm mất hiệu lực sau khi global-setup seed lại (xem mục 3).
  Kiểm thứ tự webServer và globalSetup của Playwright 1.63 trước khi chọn cách vá.
- N-P7-4 (I-1): guard chưa gắn cặp DB/cổng với tên thư mục worktree.
  Tuỳ chọn.

## Kết luận

Chất lượng tốt, đúng yêu cầu và đúng các chốt của chủ dự án, test có giá trị thật, không đụng file nóng không được giữ, không có dấu gạch dài.
Chỉ còn mục 1 (L-1) là bắt buộc.
Vá xong và cổng kiểm xanh thì reviewer CHỐT mà không cần rà lại toàn bộ.
