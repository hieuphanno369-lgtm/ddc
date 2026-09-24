PHAN QUYET: CHOT

# P1A — Đánh giá cuối (chặng REVIEWER) — vòng 3

> Reviewer không có công cụ ghi file; chặng điều phối (ship) ghi nguyên văn nội dung reviewer trả về. Bản vòng 1 ở commit `02b77c7`, bản vòng 2 ở commit `cd5d32b`.

Nhánh `feature/p1a-du-lieu-dung`, HEAD `17faf49`. Vòng sửa 2: `d5c933c`, `cd02f41`, `fdbfbd6` (hồ sơ: `8cdbef6`, `17faf49`). Toàn phase: `git diff main...HEAD` (merge-base `01e82cf`). Skill: `ddc-tower:code-review`.

- Tự chạy lại: `npx tsc --noEmit` sạch; `npm test` 65 file / 838 test xanh; không có `.only`/`.skip` trong `src`/`app`; `git status` sạch.
- `git diff cd5d32b..HEAD -- src package.json`: chỉ đổi 3 file test (`src/server/nhap-lieu-page-guard.test.ts`, `src/lib/uploads.test.ts`, `src/server/photo-upload-route.test.ts`). **Không đổi code sản xuất**, `package.json` giữ nguyên.
- Đã đọc `.bangiao/danh-gia-bao-mat.md` vòng 3: **BAO MAT: DAT** → không có mục vá bắt buộc.

## 1. Ba mục PHẢI SỬA của vòng 2 — đều ĐẠT "Xong khi"

| # | Mục | Bằng chứng | Kết luận |
|---|---|---|---|
| 1 | Test F2a giả xanh | Helper `user()` có tham số `email`; hai test data-entry dùng `pm@daidung.com.vn` (có dự án thật); thêm `toHaveLength(1)`; `vi.spyOn(mockRepo,'getFinancial')` trước `visit()` (spy ghi nhận được vì `vi.mock('@/server/repo')` trả đúng object `mockRepo.repo`); kiểm tiền đề tài chính `2026-09` tồn tại; kiểm `formProps[0].financial` undefined. Đột biến `page.tsx:48` và `:79` → đỏ (coder và tester mỗi bên tự làm); hoàn nguyên → xanh | ĐẠT |
| 2 | F10 dev chỉ nghe loopback | Coder thử `-H 127.0.0.1`: bind đúng nhưng mọi request 500 (proxy middleware nội bộ Next 14 gọi `localhost` → `::1` trên Windows). Đối chứng bỏ `-H` → 200. Đã hoàn nguyên, `package.json` sạch. Security vòng 3 xác nhận nguyên nhân bằng source (`resolve-routes.js`, `proxy-request.js`) | ĐẠT theo nhánh dự phòng → chuyển sang mục 5 |
| 3 | Test JPEG/GIF/WebP | Bảng `detectImageKind` đủ 4 loại đúng + 5 ca `null`. Test route JPEG thật → 200, `.jpg` qua `getPhotoById(body.id)`; dòng 167 cũ đổi sang `getPhotoById`. Đột biến magic JPEG → 2 test đỏ | ĐẠT |

Hồ sơ: mục "Vòng sửa 2" của `thay-doi.md` ghi đủ commit, kết quả đột biến, lý do hoàn nguyên mục 2.

## 2. Test có giá trị thật không? — CÓ

- Test F2a không còn giả xanh: phân biệt "không nạp" và "nạp rồi ẩn" (spy), chứng minh tiền đề dữ liệu không rỗng.
- Test ảnh kiểm cả hàm thuần lẫn route thật; đột biến chứng minh bắt được lỗi nhánh JPEG.
- Tester vòng 3 kiểm độc lập: build xanh (font mock), `migrate status` cập nhật, payload CVE-2025-29927 5 lần → 307 `/vi/login`.
- [nit, không chặn] `nhap-lieu-page-guard.test.ts`: `spy.mockRestore()` nằm cuối test, không trong `finally`/`afterEach` → test fail giữa chừng thì spy rò sang test sau. Chỉ ảnh hưởng thông báo lỗi.

## 3. Bảo mật, hiệu năng, tính đúng đắn

- Vòng sửa 2 không sinh lỗ hổng mới, không đổi hành vi. Đồng ý security vòng 3: F1, F2a, F2b, F3 đã đóng.
- **F10 không chặn merge P1A.** `main` đang `next 14.2.15`, dính F10 và thêm CVE-2025-29927; merge P1A làm `main` an toàn hơn. F10 **chặn go-live** (P5/P6) và chặn mở cổng dev ra mạng không tin cậy.
- Không hồi quy: 838/838 xanh; không có file ngoài phạm vi.
- Luật 2 tài khoản: ĐẠT. Vòng 2 không đụng file nóng; file nóng cả phase khớp "Đang giữ" `phien-A.md`; B không giữ file nào; không đụng `PROGRESS.md`, `.serena/`, `globals.css`, `queries.ts`, `project-queries.ts`; `phien-A.md` cập nhật tới `17faf49`.

## 4. Ghi nợ (gộp vòng 1–3, không sửa ở P1A)

**Task nâng nền tảng** (đề xuất ngay sau merge P1A, trước tách P2A/P2B; hạn chót cứng trước go-live P5/P6):
- F10: `next` ≥ 15.5.24 (hoặc 16.x) + `react`/`react-dom` 19; `params`/`searchParams`/`cookies()`/`headers()` async; chạy lại `npm audit --omit=dev`.
- F12: `next-intl` ≥ 4.9.1. F11: `next-auth` 4.24.15.
- Nếu tới P5A (Docker) còn Next 14: đánh giá GHSA-2xp9-vwfh-vxw4 (`next/image` ở `app/[locale]/login/page.tsx`, `src/components/layout/AppShell.tsx`).
- F10 giảm thiểu tạm máy dev: thử `"dev": "next dev -H localhost"` (`package.json:6`) theo tiêu chí mục 3.2 `danh-gia-bao-mat.md`, nhánh nhỏ riêng sau merge; được thì thêm "Lưu ý cho B".

**P2A:** F4 `xlsx 0.18.5` → SheetJS 0.20.3 (CDN chính thức) hoặc `exceljs`.

**P3A:**
- F6: bản nháp chứa số tài chính, key không gắn email, không xoá khi logout (`dataEntryState.ts:212-214`).
- Hai người cùng lưu lần đầu một tháng: bắt P2002 ở `saveMonthlyFact`/`saveFinancial` → `'conflict'` → UI báo "tải lại trang".
- [nit] `formsEqual` so chuỗi thô (`12.50` ≠ `12.5`).
- [nit] `dataGuard.save.financeReadonly` ghi "Chỉ Admin/BOD...", giờ chỉ admin sửa tài chính.
- [nit] `precheckPhotos` (`src/lib/photo-upload.ts:17`) nhận mọi `image/*` → thu hẹp JPG/PNG/GIF/WebP.
- [nit] `nhap-lieu-page-guard.test.ts`: đưa `mockRestore()` vào `afterEach`.

**P5B:**
- F5: xlsx dùng `quotePrefix`; `safeCell` chỉ CSV (`src/lib/excel-safe.ts:4`).
- F7: `resolveAccess` suy `canViewFinance` từ role (`src/lib/auth.ts:36,43`).
- F9: `/api/export` bỏ cột tài chính khi `!canViewFinance`; rate-limit upload theo email `rateLimit('photo:' + user.email)` trong `app/api/photo-upload/route.ts` (Low còn lại F3); `/api/photos` kiểm quyền đọc dự án (BOLA); proxy ghi đè `x-forwarded-host`; gom `canWriteProject` với `requireProject`; CSP/header toàn app.
- `/overview`, `/import` chưa tự kiểm role ở page.
- [nit] `addPhotoAction` (`src/server/actions.ts:369`) không còn UI gọi → gỡ hoặc ghi chú giữ có chủ đích.
- T17/P6: reverse proxy cho body ≥ 6MB ở `/api/photo-upload` (Nginx mặc định `client_max_body_size 1m`).

**Chờ chủ dự án:** F8 (mục 5).

## 5. Chủ dự án cần quyết (gộp reviewer vòng 2 + security vòng 3)

1. **Task nâng nền tảng F10/F11/F12** (`next` ≥ 15.5.24 + React 19 + `next-intl` ≥ 4.9.1 + `next-auth` 4.24.15): lúc nào, ai làm. Đề xuất ngay sau merge P1A, trước tách P2A/P2B; B rảnh có thể nhận, A lập kế hoạch P2A trong lúc chờ. Hạn chót cứng trước go-live. Chọn xong cập nhật `lo-trinh.md`.
2. **Tường lửa Windows** (thay `-H 127.0.0.1` không dùng được): chủ dự án tự tạo rule chặn inbound TCP 3000/3001 (máy này và máy B nếu khác). PowerShell (Admin): `New-NetFirewallRule -DisplayName "DDC dev block 3000-3001" -Direction Inbound -Protocol TCP -LocalPort 3000,3001 -Action Block`. Kiểm rule Allow còn sót cho `node.exe`: `Get-NetFirewallRule -Direction Inbound | ? DisplayName -match node`.
3. **Cho phép thử `-H localhost`** như task nhỏ sau merge P1A — có/không.
4. **Hệ điều hành VPS ở P6:** Windows → F10 áp thẳng production; Linux vẫn phải nâng Next trước go-live.
5. **F8:** import lộ việc mã SAP tồn tại hay không (`src/server/actions.ts:474`). Treo từ vòng 1.
6. **Ghi chú vận hành:** ~12:04 ngày 2026-09-24 coder đã chạy `taskkill /F /IM node.exe` — có thể đã tắt dev 3001 hoặc MCP server của B nếu đang chạy → báo B kiểm lại.

## 6. Ghi chú merge (chủ dự án quyết thời điểm; chưa làm)

- `main` hiện ở `bc052f9` (đã có P1B, chưa push). Merge-base nhánh là `01e82cf`.
- Trước merge: chuyển `.bangiao/*.md` (và `test-screens/`) vào `.bangiao/archive/p1a-du-lieu-dung-2026-09-24/` để gốc `.bangiao/` trống.
- `git merge main` vào nhánh: xung đột dự kiến chỉ cuối `src/i18n/messages/vi.json`/`en.json` — giữ cả `dataGuard` (A) lẫn `resourceKpi`/`valueChainAbs`/`logPaging` (B); `projects/[id]/page.tsx` tự gộp; sau đó `npx tsc --noEmit` + `npm test` trên kết quả gộp.
- `npx prisma migrate deploy` trên `ddc_control_tower`. Cập nhật `PROGRESS.md` + `.serena/memories/` **trong lượt merge**. Bỏ file nóng khỏi "Đang giữ" `phien-A.md`, cập nhật `lo-trinh.md`.
- Báo B: `git merge main` → `npm install` (Next 14.2.35) → `npx prisma migrate deploy` + seed trên `ddc_control_tower_b` → `tsc` + `npm test`. Dev vẫn nghe mọi interface.
- Chỉ push khi chủ dự án bảo; không `--force`.

## 7. Nhận xét tích cực

Vòng sửa 2 gọn đúng phạm vi: 0 dòng code sản xuất, chỉ 3 file test. Test F2a có spy kèm kiểm tiền đề — mẫu tốt chống test giả xanh. Coder xử lý mục 2 đúng tinh thần: có đối chứng, không ép, hoàn nguyên sạch, tự khai lệnh `taskkill` rộng. Tester đột biến độc lập cả hai mục và gửi đúng payload 14.x.
