PHAN QUYET: CAN SUA

# P1A — Đánh giá cuối (chặng REVIEWER) — vòng 1

> Reviewer không có công cụ ghi file; chặng điều phối (ship) ghi nguyên văn nội dung reviewer trả về.

Nhánh `feature/p1a-du-lieu-dung` (HEAD `67201cd`, 12 commit, `git diff main...HEAD` 55 file). Skill: `ddc-tower:code-review`.
Tự chạy lại: `npx tsc --noEmit` sạch; `npm test` 64 file / 815 test xanh.

## 1. Code có khớp kế hoạch không? — CÓ

- T2: `dataEntryState.ts` có đủ các hàm; `DataEntryForm` không còn đọc localStorage khi khởi tạo; bản nháp chỉ áp khi người dùng bấm (có cảnh báo stale/foreign); ngày dùng `toDateInput`; patch chỉ gửi field đã đổi; bước Tài chính chỉ xem khi `!canEditFinance`.
- 3 lỗi mất dữ liệu:
  (a) `saveMonthlyFact`/`saveFinancial` tạo version 1 lấy số từ tháng trước; có kiểm dự án tồn tại.
  (b) Data-entry không còn gửi field tài chính nên hết lỗi Forbidden.
  (c) Import báo lỗi từng dòng (`rowNo` + `reason`); `failed[]` thay cho `skipped`.
- Bảo mật theo kế hoạch: `/api/export` trả 401/403 và có `safeCell`; `canViewFinance ?? false` ở auth/session/projects; bỏ secret dự phòng, middleware trả 500.
- T3: có route `/api/photo-upload`, `PhotoDropzone` tải bằng XHR và có thanh tiến trình; lỗi 1 file không dừng cả loạt.
- Migration gộp: đúng thứ tự 1–7 của kế hoạch, CHECK/FK đúng; `dim_date` dùng tuần ISO. Rollback bọc BEGIN/COMMIT, gộp ca giữ nguyên tổng. Seed có đủ ca và 6 dòng Gantt.
- Luật 2 tài khoản: đạt (file nóng A giữ, B không giữ; i18n nhóm `dataGuard` cuối vi/en; không đụng `PROGRESS.md`, `.serena/`, `globals.css`, `queries.ts`, `project-queries.ts`; `projects/[id]/page.tsx` chỉ đổi đúng dòng 64).

## 2. Test có giá trị thật không? — PHẦN LỚN CÓ, còn 1 lỗ

- Tốt: test route thật (export: 401/403/200 và ô B2; upload: 403/401/400/200), test render thật trang dự án khi user thiếu field quyền, test hàm thuần cho bản nháp/patch, test prisma-repo qua mock `@/server/db`.
- Lỗ: nhánh `'created'` của `prisma-repo.saveFinancial` (tính `revenuePeriod`/`costActualPeriod`/`backlog` từ tháng trước) chưa có test ở tầng prisma (xem mục 4.6).

## 3. Quyết định về các phát hiện bảo mật (danh-gia-bao-mat.md = CAN SUA)

Nguyên tắc: phải sửa ở P1A nếu mức High, **hoặc** P1A tạo ra/mở thêm đường vào, **hoặc** nằm trong file/luồng P1A vừa sửa và cách vá nhỏ. Còn lại ghi nợ cho phase sẽ động vào vùng đó.

| # | Quyết định | Lý do |
|---|---|---|
| F1 SVG stored XSS | **SỬA** | Mức High; route upload mới của P1A mở thêm đường vào |
| F2 nhập liệu lộ tài chính + CVE-2025-29927 | **SỬA** | Mức High; P1A đã sửa `nhap-lieu/page.tsx`, mục tiêu "fail-closed tài chính" đang dựa vào middleware có thể bị bỏ qua |
| F3 body upload không giới hạn | **SỬA** | Code mới của P1A; vá vài dòng |
| F4 xlsx CVE | Ghi nợ → P2A | P2A làm lại import Excel + file mẫu; hiện chỉ admin/data-entry đã đăng nhập gọi được, trần 10MB |
| F5–F9 | Ghi nợ | Low/Info (mục 5) |

## 4. Danh sách PHẢI SỬA (đánh số, làm đúng phạm vi)

1. **F1 — chặn SVG/file giả ảnh**
   - `src/server/photo-service.ts:28-29`: sau khi `photoFileSchema` đạt, đọc 12 byte đầu của `file`, nhận diện JPEG `FF D8 FF`, PNG `89 50 4E 47`, GIF `47 49 46 38`, WEBP `RIFF....WEBP`. Loại khác → `{ ok:false, error:'Chỉ chấp nhận ảnh JPG/PNG/GIF/WebP', status:400 }`.
   - `src/lib/uploads.ts:47`: `savePhotoFile` nhận thêm đuôi đã nhận diện (`.jpg/.png/.gif/.webp`), không lấy đuôi từ `file.name`.
   - `src/lib/uploads.ts:11-19`: bỏ `.svg` và `.bmp` khỏi `CONTENT_TYPE_BY_EXT`.
   - `app/api/photos/[...path]/route.ts:18-23`: thêm header `X-Content-Type-Options: nosniff` và `Content-Security-Policy: default-src 'none'; sandbox`.
   - Xong khi: test trong `src/server/photo-upload-route.test.ts` chứng minh (a) SVG có `type=image/svg+xml` → 400; (b) nội dung PNG thật tên `x.svg` → 200, url lưu kết thúc `.png`; (c) nội dung HTML khai `type=image/png` → 400. Có 1 test cho route `/api/photos` kiểm 2 header trên. Test `addPhotoAction` hiện có vẫn xanh.

2. **F2a — trang nhập liệu tự kiểm quyền**
   - `app/[locale]/(app)/nhap-lieu/page.tsx:16-17`: ngay sau `getCurrentUser()`: `if (!user) redirect('/<locale>/login')`; role ∉ `['admin','data-entry']` → `redirect('/<locale>' + homeForRole(user.role))`, theo mẫu `admin/page.tsx:16-19`.
   - Dòng 40 và 70: chỉ nạp/truyền `financial` khi `user.canViewFinance`, ngược lại `undefined`.
   - Xong khi: có test render trang (mẫu `projects-detail-page-finance-guard.test.ts`): viewer → redirect; bod → redirect; data-entry `canViewFinance:false` → prop `financial` của `DataEntryForm` là `undefined`; admin → vẫn có `financial`.

3. **F2b — nâng Next.js lên bản đã vá CVE-2025-29927**
   - `package.json:16`: `"next": "14.2.15"` → bản 14.2.x mới nhất (tối thiểu `14.2.25`); cập nhật `package-lock.json`.
   - Xong khi: `node_modules/next/package.json` version ≥ 14.2.25; `tsc` + `npm test` xanh; build compile (font-mock) xanh; smoke dev 3000: đăng nhập admin, mở `/vi/overview` và `/vi/nhap-lieu` bình thường.
   - Ghi vào `phien-A.md` mục "Lưu ý cho B": sau khi kéo `main` phải chạy `npm install`.

4. **F3 — giới hạn body upload trước khi đọc**
   - `app/api/photo-upload/route.ts:19-20`: trước `req.formData()`, đọc `content-length`; thiếu/không phải số/ > `PHOTO_MAX_BYTES + 64*1024` → `413 { ok:false, error:'Payload too large' }`. Đặt sau kiểm Origin và đăng nhập, trước `formData()`.
   - Xong khi: test route "Content-Length 6MB → 413" và "không có Content-Length → 413"; PNG hợp lệ vẫn 200. (Rate-limit ghi nợ P5B.)

5. **Lỗi server phải luôn hiện chữ (T2, "không im lặng")**
   - `src/components/form/DataEntryForm.tsx:212-243` (`submit()`): chỉ có `try/finally`. Nếu `saveMonthlyData` ném lỗi (vd hai người cùng lưu lần đầu một tháng → partial unique index `ux_fact_progress_latest` từ chối bản thứ hai) thì người dùng không thấy gì.
   - Thêm `catch (e) { setSaveErr(e instanceof Error ? e.message : 'Lỗi không xác định'); }` — hiện qua nhánh `dataGuard.save.generic` sẵn có.
   - Xong khi: code có `catch` gọi `setSaveErr`. Không cần test React.

6. **Test nhánh tạo mới của `prisma-repo.saveFinancial`**
   - `src/server/repo/prisma-repo-save.test.ts:89-98`: thêm 1 case. Tháng hiện tại `factFinancial.findFirst` trả null, tháng trước trả baseline `{ revenueCumulative: 10, costActualCumulative: 6, backlog: 3, ... }`; gọi `saveFinancial(1, CURRENT_YM, { revenueCumulative: 15 })`.
   - Xong khi: kết quả `'created'` và `factFinancial.create` được gọi với `version: 1`, `revenuePeriod: 5`, `costActualPeriod: 0`, `backlog: 3`, `revenueCumulative: 15`.

Sau khi sửa: `tsc` + `npm test` xanh; security-reviewer soát lại F1–F3; rồi quay lại reviewer.

## 5. Ghi nợ (không sửa ở P1A)

- **F4** `xlsx 0.18.5` (CVE-2023-30533, CVE-2024-22363) → **P2A**: đổi sang SheetJS 0.20.3 (CDN chính thức) hoặc `exceljs` khi làm import/file mẫu.
- **F5** tiền tố `'` hiện nguyên văn trong .xlsx (`src/lib/excel-safe.ts:4`) → P5B/báo cáo: xlsx dùng `cell.style.quotePrefix = true`, `safeCell` cho CSV.
- **F6** bản nháp chứa số tài chính, key không gắn email, không xoá khi logout (`dataEntryState.ts:212-214`) → **P3A**.
- **F7** `resolveAccess` suy `canViewFinance` từ role (`src/lib/auth.ts:36,43`) → P5B hoặc khi thêm công tắc quyền ở Quản trị.
- **F8** import lộ mã SAP có tồn tại hay không (`actions.ts:474`) → **chủ dự án quyết**.
- **F9** → **P5B**: `/api/export` bỏ cột tài chính khi `!canViewFinance`; rate-limit theo email; `/api/photos` kiểm quyền đọc dự án (BOLA); proxy ghi đè `x-forwarded-host`; gom `canWriteProject` với `requireProject`; CSP/header toàn app.
- `/overview`, `/import` chưa tự kiểm role ở page (chỉ middleware) → P5B.
- [nit] `formsEqual` so chuỗi thô (`12.50` vs `12.5`) → P3A.

## 6. Nhận xét tích cực

Tách `dataEntryState` ra hàm thuần giúp logic khó test được. Migration viết tay cẩn thận (default rồi drop default, backfill từ dữ liệu thật). Rollback đã chạy thử một vòng, tổng nhân lực khớp. Đổi id dự án trong test để hết flaky là xử lý đúng gốc.
