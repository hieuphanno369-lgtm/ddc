KET QUA: XANH

# P1A — Kết quả kiểm (chặng TESTER, vòng 3 — sau vòng sửa 2)

Nhánh `feature/p1a-du-lieu-dung`, HEAD `fdbfbd6` (vòng sửa 2: `d5c933c`, `cd02f41`, `fdbfbd6`). Skill:
`ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`. Kiểm độc lập theo yêu cầu
điều phối; không sửa code sản phẩm (mọi đột biến đều đã hoàn nguyên, `git diff` sạch tại thời điểm ghi hồ sơ).

## 1. Cổng kiểm cơ bản

- `npx tsc --noEmit` → sạch.
- `npm test` → **65 file / 838 test xanh** (khớp coder báo). Không `.only`/`.skip`.
- `npx prisma migrate status` (DB `ddc_control_tower`, localhost:5433) → "Database schema is up to date!" (5 migrations).

## 2. Mục 1 danh-gia.md (F2a) — tự làm lại đột biến, ĐẠT

- Sửa tạm `app/[locale]/(app)/nhap-lieu/page.tsx`: dòng tính `financial` bỏ điều kiện `&& user.canViewFinance`,
  dòng truyền prop đổi `financial={user.canViewFinance ? financial : undefined}` → `financial={financial}`.
- Chạy `npx vitest run src/server/nhap-lieu-page-guard.test.ts` → **1 test ĐỎ đúng như kỳ vọng**
  (`expected "getFinancial" to not be called at all, but actually been called 1 times`), 6 test khác vẫn xanh.
- Hoàn nguyên 2 chỗ sửa → `npx vitest run src/server/nhap-lieu-page-guard.test.ts` → 7/7 xanh.
- `git diff -- "app/[locale]/(app)/nhap-lieu/page.tsx"` sau hoàn nguyên: **rỗng**.

## 3. Mục 3 danh-gia.md (JPEG/GIF/WebP) — kiểm bảng + đột biến route thật, ĐẠT

- `src/lib/uploads.test.ts` `describe('detectImageKind')`: bảng `it.each` có giá trị thật (magic-byte JPEG/PNG/
  GIF/WebP đúng, và các trường hợp `null` hợp lý: SVG, HTML, buffer rỗng, JPEG cắt ngắn, RIFF/WAVE giả WebP).
- `src/server/photo-upload-route.test.ts`: test JPEG thật qua route `POST /api/photo-upload` → 200, url lưu
  (qua `repo.getPhotoById`) kết thúc `.jpg` — test có giá trị thật (không chỉ gọi hàm thuần).
- Đột biến: sửa tạm nhánh JPEG trong `detectImageKind` (`src/lib/uploads.ts`) từ so khớp byte thứ 3 `0xff`
  thành `0xfe` (làm sai magic-byte JPEG chuẩn `FF D8 FF`).
- Chạy `npx vitest run src/lib/uploads.test.ts src/server/photo-upload-route.test.ts` → **2 test ĐỎ đúng như
  kỳ vọng**: bảng `detectImageKind` báo `expected null to be 'jpg'`; test route JPEG báo `expected 400 to be 200`
  (kind không nhận diện được → 400 thay vì 200). 36 test khác trong 2 file vẫn xanh.
- Hoàn nguyên → chạy lại → 38/38 xanh (25 + 13). `git diff -- src/lib/uploads.ts` sau hoàn nguyên: **rỗng**.

## 4. Mục 2 danh-gia.md (F10 dev loopback `-H 127.0.0.1`) — xác nhận coder đã hoàn nguyên đúng, không bắt buộc tái hiện

- `package.json` dòng `"dev"` **vẫn là `"next dev"`** (không có `-H 127.0.0.1`) — khớp báo cáo coder đã hoàn nguyên.
- Lý do coder ghi trong `thay-doi.md` (Next.js 14 dev proxy middleware gọi nội bộ cứng `localhost:3000` bất kể
  `-H` bind ở đâu → `ECONNRESET`/500 khi bind loopback tường minh) hợp lý về mặt kỹ thuật và đã có đối chứng rõ
  ràng (tắt `-H` → 200 ngay). Không tái hiện lại (không bắt buộc theo yêu cầu điều phối) — mục này đã được coder
  chuyển đúng sang "Chủ dự án cần quyết" (`danh-gia.md` mục 6, đề mục 2) kèm phương án dự phòng (Windows Firewall).

## 5. `npm run build` với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`

- Trỏ `D:\_project\DDC_dieu-phoi\tools\font-mock.js` (đã xác nhận file tồn tại).
- `npm run build` → **Compiled successfully**, "Generating static pages (3/3)" xong, sinh đủ 20 route (app +
  api), có `ƒ Middleware`. Compile xanh.

## 6. Bằng chứng động CVE-2025-29927 (Next 14.2.35) — dev server cổng 3000, launch `ddc-control-tower`

- Khởi động `npm run dev` nền, cổng 3000 (không dùng 3001). Xác nhận `netstat` cổng 3000 LISTENING, PID node
  xác định qua PowerShell `Get-Process -Id`.
- Chưa đăng nhập, không header: `/vi/nhap-lieu` → 307 → `/vi/login`; `/vi/overview` → 307 → `/vi/login`.
- Với header `x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware`:
  `/vi/nhap-lieu` → **307 → /vi/login** (không bypass); `/vi/overview` → **307 → /vi/login** (không bypass).
  → CVE-2025-29927 đã được vá bởi Next 14.2.35, khớp đánh giá mục 3 vòng 2 (ĐẠT).
- Tắt dev server: `Stop-Process -Id <PID cụ thể lấy từ netstat/Get-Process>` qua PowerShell — **không dùng
  `taskkill /IM node.exe`** và không kill toàn bộ node. Xác nhận lại `netstat` cổng 3000 không còn LISTENING
  (chỉ còn vài dòng TIME_WAIT của kết nối cũ, sẽ tự dọn).

## 7. Sau khi tắt dev server — chạy lại toàn bộ cổng kiểm lần cuối

- `git status --short` / `git diff --stat`: **rỗng** — không sót thay đổi nào từ các bước đột biến/dev server.
- `npm test` → 65 file / 838 test xanh (lần chạy độc lập thứ hai, cùng kết quả).

## Kết luận

Không phát hiện vấn đề. Mục 1 và mục 3 của `danh-gia.md` (vòng 2) đã được kiểm độc lập bằng đột biến thật và
đều cho kết quả đúng kỳ vọng (đỏ khi có lỗi, xanh sau hoàn nguyên). Mục 2 (F10 dev loopback) đã đúng như coder
báo — không áp dụng được, đã chuyển "Chủ dự án cần quyết", không phải lỗi coder. Build + migrate status + bằng
chứng động CVE-2025-29927 đều đạt. Chuyển sang chặng security-reviewer vòng 3.
