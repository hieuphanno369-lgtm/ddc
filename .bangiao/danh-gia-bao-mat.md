BAO MAT: CAN SUA

# P1A — Đánh giá bảo mật (chặng SECURITY-REVIEWER)

Nhánh `feature/p1a-du-lieu-dung` (HEAD `67201cd`), diff `main...HEAD`. Skill đã dùng: `security-review`,
`security-audit` (guidance mode, soi có trọng tâm, không chạy full 6 pha). DB `ddc_control_tower` chỉ SELECT.
Không chạy app: mọi phát hiện có bằng chứng source và code Next.js đã cài trong node_modules.

## Kết luận ngắn

Các thay đổi P1A tự thân đúng: `/api/export` đã có 401/403 admin/bod; `safeCell` đủ 6 ký tự OWASP;
`NEXTAUTH_SECRET` bắt buộc, hết fallback; `canViewFinance ?? false` ở session/auth/overview/project detail;
upload có same-origin + quyền PIC/Backup; import không lộ projectId ngoài assignment; migration sạch.
Nhưng có 2 lỗ hổng High trong đúng vùng được giao soi (upload ảnh, tài chính "ở mọi nơi"). Gốc rễ có
từ trước, P1A không tạo ra nhưng mở thêm đường vào (route upload mới) hoặc bỏ sót (trang nhập liệu).
Nên vá trước khi merge `main`.

## Bảng phát hiện

| # | Mức | File:dòng | Vấn đề | Mới/Cũ |
|---|---|---|---|---|
| F1 | High | `src/server/validation.ts:164-167`, `src/lib/uploads.ts:19,47`, `app/api/photos/[...path]/route.ts:18-23` | Upload SVG → stored XSS cùng origin | Cũ, route P1A kế thừa |
| F2 | High | `app/[locale]/(app)/nhap-lieu/page.tsx:20-24,38,72`; `package.json:16` (next 14.2.15) | Trang nhập liệu không tự kiểm role/canViewFinance, chỉ dựa middleware bypass được (CVE-2025-29927) → viewer đọc tài chính mọi dự án | Cũ + P1A bỏ sót |
| F3 | Medium | `app/api/photo-upload/route.ts:20` | `req.formData()` đọc toàn bộ body không giới hạn trước khi kiểm quyền/5MB | Mới |
| F4 | Medium | `package.json:22` (`xlsx ^0.18.5`) | SheetJS 0.18.5 có CVE-2023-30533 (prototype pollution) + CVE-2024-22363 (ReDoS) khi parse file người dùng | Cũ |
| F5 | Low | `src/lib/excel-safe.ts:4` + 2 route export | Tiền tố nháy đơn trong .xlsx hiện nguyên văn (hỏng hiển thị); rủi ro công thức trong xlsx vốn thấp vì ExcelJS ghi kiểu chuỗi | Mới |
| F6 | Low | `src/components/form/dataEntryState.ts:212-214`, `DataEntryForm.tsx:152-155` | Bản nháp localStorage chứa cả 5 field tài chính, key không gắn email, tồn tại sau logout | Mới |
| F7 | Low | `src/lib/auth.ts:36,43` | `resolveAccess` suy `canViewFinance` từ role, bỏ qua cột `user_roles.canViewFinance` | Cũ |
| F8 | Low | `src/server/actions.ts:474` | Import: lý do `not_assigned` khác `queued` → data-entry dò được mã SAP nào tồn tại ở dự án không được gán | Mới |
| F9 | Info | `app/api/export/route.ts:13,16`; `src/lib/same-origin.ts:5`; `app/api/photos/[...path]/route.ts:12-16`; `middleware.ts:31` | Phòng thủ chiều sâu (xem cuối) | — |

## Chi tiết

### F1 — High — Upload SVG gây stored XSS

- Chuỗi: `photoFileSchema` chỉ kiểm `file.type` (client tự khai) khớp `^image\/` và size; không kiểm magic
  bytes. `savePhotoFile` lấy đuôi file từ `file.name` (`uploads.ts:47`), không whitelist. `readPhotoFile` map
  `.svg → image/svg+xml` (`uploads.ts:19`). `/api/photos/...` trả file với Content-Type đó, không có
  `X-Content-Type-Options`, `Content-Security-Policy`, `Content-Disposition` (`route.ts:18-23`); `next.config.mjs`
  cũng không đặt security header.
- Tái hiện (dummy): data-entry được gán dự án 7 gửi `POST /api/photo-upload` (Origin = host app), form
  `projectId=7, yearMonth=2026-09, file=x.svg`, `type=image/svg+xml`, nội dung
  `<svg xmlns="http://www.w3.org/2000/svg"><script>/* gọi server action bằng phiên nạn nhân */</script></svg>`.
  URL `7/2026-09/<ts>-<uuid>-x.svg` hiện trên trang dự án. Gửi link `/api/photos/7/2026-09/...svg` cho admin →
  script chạy trong origin app với phiên admin (gọi server action đổi role/tạo tài khoản). `<img>` trong UI
  không chạy script, nhưng mở trực tiếp URL thì chạy. Đuôi `.html` + `type=image/png` cũng lọt (ra
  `application/octet-stream`, trình duyệt tải về, không XSS, nhưng cho thấy đuôi/nội dung không được ràng buộc).
- DB hiện tại: 4 ảnh, không có file `.svg` (SELECT `project_photos`).
- Cách vá nhỏ nhất:
  1. `photo-service.ts`: đọc 12 byte đầu, nhận diện JPEG `FF D8 FF` / PNG `89 50 4E 47` / GIF `47 49 46 38` /
     WEBP `RIFF....WEBP`; loại khác → 400. Bỏ SVG (và BMP nếu không cần).
  2. `savePhotoFile`: đặt đuôi theo loại đã nhận diện, không lấy từ `file.name`.
  3. `/api/photos`: thêm `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`;
     chỉ trả Content-Type trong whitelist ảnh raster.
  4. Test: SVG với `type=image/svg+xml` → 400; PNG đổi tên `.svg` → lưu `.png`.

### F2 — High — Nhập liệu lộ tài chính cho viewer qua bypass middleware

- `nhap-lieu/page.tsx` không kiểm role: chỉ lọc dự án khi `role === 'data-entry'` (dòng 20-24), viewer/bod rơi vào
  nhánh "thấy hết". Nạp `financial` (dòng 38) và `project` (có `contractValue`) rồi truyền vào client component
  (dòng 72) mà không xét `canViewFinance`. Việc chặn viewer khỏi `/nhap-lieu` chỉ nằm ở `middleware.ts` (DENIED).
- Next đã cài `14.2.15`. `node_modules/next/dist/server/web/sandbox/sandbox.js:78-90` vẫn tin header
  `x-middleware-subrequest` do client gửi: đủ 5 lần tên `middleware` → bỏ qua middleware (CVE-2025-29927,
  vá ở 14.2.25).
- Tái hiện (dummy, local): đăng nhập `viewer@daidung.com.vn` (`canViewFinance=false`), gọi
  `GET /vi/nhap-lieu?project=<id>` kèm header
  `x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware` → trang render, payload RSC
  chứa `revenueCumulative/costActualCumulative/arCollected/arOutstanding/arOverdue` + `contractValue` của bất kỳ
  dự án nào (đổi `?project=`). Ghi vẫn bị `requireProject` chặn. Chưa chạy thật (pentester nên xác nhận), nhưng
  cả 2 đầu đường code đã rõ.
- Cách vá:
  1. `nhap-lieu/page.tsx`: đầu trang `if (!user || !['admin','data-entry'].includes(user.role)) redirect(...)`
     (giống `admin/page.tsx:19`); chỉ truyền `financial` khi `user.canViewFinance`, ngược lại `undefined`.
     Làm tương tự cho `import` và `overview` (data-entry chỉ bị chặn `/overview` ở middleware).
  2. Nâng `next` lên ≥ 14.2.25 (hoặc chặn header `x-middleware-subrequest` ở reverse proxy).
  3. Test: render page với viewer → redirect; data-entry `canViewFinance=false` → prop `financial` undefined.

### F3 — Medium — Upload route không giới hạn kích thước body

- `app/api/photo-upload/route.ts:20` gọi `req.formData()`. Route Handler Next 14 không có `bodySizeLimit` như
  server action (1MB). Toàn bộ body được buffer vào RAM trước khi `photoFileSchema` kiểm 5MB và trước cả
  `canWriteProject` (bất kỳ user đã login nào, kể cả viewer, tới được dòng này).
- Tái hiện: viewer đăng nhập, `curl -H "Origin: http://localhost:3000" -b <cookie> -F file=@2GB.bin` nhiều luồng →
  tiến trình Node phình bộ nhớ/OOM. (Không thử trên máy chung.)
- Cách vá: trước `formData()` kiểm `Content-Length` ≤ 5MB + 64KB (thiếu/quá → 413); thêm
  `rateLimit('photo:' + user.email, ...)` (có sẵn `src/lib/rate-limit.ts`).

### F4 — Medium — `xlsx` 0.18.5 có CVE đã biết

- `importExcelAction` (`actions.ts:433`) chạy `XLSX.read` trên file data-entry tải lên. 0.18.5 (bản cuối trên
  npm) dính CVE-2023-30533 (prototype pollution khi đọc file dựng sẵn) và CVE-2024-22363 (ReDoS). P1A không đổi
  thư viện nhưng mở rộng luồng import.
- Cách vá: dùng bản SheetJS chính thức `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` hoặc parse bằng
  `exceljs` (đã có); giữ giới hạn 10MB hiện có.

### F5 — Low — `safeCell` và định dạng xlsx

- Regex `^[=+\-@\t\r]` đủ theo OWASP; số âm kiểu `number` không bị đụng (chỉ xử lý `typeof string`, các cột số
  truyền thẳng). Nhưng file là .xlsx: ExcelJS ghi chuỗi dạng shared string, Excel không tính công thức từ ô
  chuỗi; nháy đơn bị lưu nguyên văn nên tên như `-DA01` hiện thành `'-DA01`. Không phải lỗ hổng, chỉ hỏng hiển
  thị. Nếu sau này có CSV thì `safeCell` là đúng.
- Cách vá (tuỳ chọn): với xlsx giữ giá trị gốc và đặt `cell.style.quotePrefix = true`; dùng `safeCell` cho CSV.

### F6 — Low — Bản nháp giữ số tài chính trong localStorage

- Nháp lưu toàn bộ `form` (gồm 5 field tài chính lấy từ `base`) theo key `ddc_draft_v2_<projectId>_<month>`,
  không gắn email, không xoá khi logout. Máy dùng chung: admin sửa tài chính chưa lưu → người sau (data-entry cùng
  dự án) thấy banner "Khôi phục" và xem được số chưa lưu. Ghi thì server vẫn chặn (`saveMonthlyData` và
  `buildSavePatch` loại field tài chính khi `!canEditFinance`).
- Cách vá: key thêm email; bỏ field tài chính khỏi nháp khi `!canEditFinance`; xoá `ddc_draft_*` khi logout.

### F7 — Low — `canViewFinance` không lấy từ DB

- `resolveAccess` trả `canViewFinance: row.role !== 'viewer'` (auth.ts:36, 43), bỏ qua cột DB. DB hiện nhất quán
  (SELECT `user_roles`: admin/bod/data-entry = true, viewer = false) và `setUserRole` cũng suy từ role
  (`actions.ts:315`) nên chưa khai thác được; nhưng nếu thêm công tắc riêng, cờ sẽ bị lờ (fail-open).
- Cách vá: dùng `row.canViewFinance` (fail-closed `?? false`).

### F8 — Low — Oracle mã SAP qua import

- Dòng khớp SAP của dự án không được gán trả `invalid/not_assigned` (actions.ts:474), mã không tồn tại trả
  `queued` → data-entry biết mã nào có thật. Không lộ projectId (đã `null`), tốt.
- Cách vá: gộp thành 1 lý do chung và không đẩy vào hàng đợi SAP, hoặc chấp nhận rủi ro (chủ dự án quyết).

### F9 — Info (không chặn)

- `/api/export` chỉ kiểm role, không kiểm `canViewFinance` dù xuất CPI/EAC/giá trị HĐ; hiện admin/bod luôn true
  (F7). Nên bỏ cột tài chính khi `!user.canViewFinance`. Rate-limit theo `x-forwarded-for` giả mạo được (đã nằm
  sau auth nên tác động nhỏ; đổi key theo email).
- `isSameOrigin` tin `x-forwarded-host`: trình duyệt cross-site không đặt được header này nếu không qua preflight,
  và cookie next-auth `SameSite=Lax`, nên CSRF đã chặn. Nếu deploy sau proxy, proxy phải ghi đè header này.
- `/api/photos/*` chỉ kiểm đăng nhập, không kiểm quyền đọc dự án (BOLA); đường dẫn có uuid nên khó đoán. Nên tra
  `project_photos` theo url rồi gọi `requireProjectRead`.
- Middleware trả `Server misconfigured: NEXTAUTH_SECRET`: lộ tên biến, chấp nhận được.
- `canWriteProject` (authz.ts) lặp logic `requireProject` (actions.ts:28); nên dùng chung 1 hàm để khỏi lệch.

## Đã kiểm, đạt

- `/api/export`: 401 khi chưa login, 403 khi role khác admin/bod, auth trước rate-limit. `/api/report/export`: 403.
- `NEXTAUTH_SECRET`: không còn `ddc-local-dev-secret`/fallback nào trong `app/`, `src/`, `middleware.ts`;
  `authOptions.secret` là getter throw; middleware 500; `getCurrentUser` không nuốt lỗi thành user giả.
- `canViewFinance ?? false` ở `auth.ts:144`, `session.ts:23`, `overview/page.tsx:65`, `projects/[id]/page.tsx:64`;
  không còn `?? true` liên quan quyền (3 chỗ còn lại là `stageApplicable`).
- Upload: same-origin (thiếu Origin → 403), 401, 403 cho người không phải admin/PIC/Backup; tên file qua
  `sanitizePhotoName` + uuid, `yearMonth` qua `isValidYearMonth`, `projectId` int dương → không path traversal;
  lưu ở `data/uploads/` ngoài `public/`.
- `saveMonthlyData`: `requireProject` (IDOR) trước, guard field tài chính theo role, kiểm dự án tồn tại; lỗi trả mã
  chuẩn (`Forbidden`/`locked`/`Not found`), không lộ stack. `commitImportAction` lọc theo assignment.
- Không SQL raw mới (template string chỉ dùng cho note audit, ghi qua Prisma tham số hoá).
- Migration: chỉ DDL, backfill từ dữ liệu có sẵn, seed tĩnh `dim_shift`/`dim_date`; không dữ liệu nhạy cảm.
  Rollback bọc `BEGIN/COMMIT`, gộp ca giữ nguyên tổng nhân lực (bảng không có cột nào khác bị mất); mất dữ liệu
  `project_equipment_plan`/`factoryId`/`contractValueOriginal` khi rollback là chủ ý.

## Việc cần làm trước khi merge

1. Vá F1: kiểm magic bytes, bỏ SVG, thêm header an toàn ở `/api/photos`.
2. Vá F2: guard role + ẩn `financial` theo `canViewFinance` ở `nhap-lieu`; nâng Next ≥ 14.2.25.
3. F3 nên vá cùng (kiểm Content-Length + rate-limit). F4–F8 có thể mở ticket.
