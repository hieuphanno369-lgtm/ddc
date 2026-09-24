KET LUAN BAO MAT: KHONG DAT

# Đánh giá bảo mật — P2A Nhập liệu mới (`feature/p2a-nhap-lieu`, `git diff 10cda5a..HEAD`, HEAD `e693f8b`)

> Điều phối viên lưu hộ từ báo cáo của security-reviewer (vai chỉ đọc).

Skill: `ddc-tower:security-review` + `ddc-tower:security-audit`. Diff P2A không có SQL thô (`$queryRaw`/`$executeRaw`);
mọi truy vấn mới qua Prisma có tham số. `$executeRawUnsafe` chỉ ở `prisma/seed.ts` (có từ trước). `npm audit --omit=dev`
không chạy được (không ra mạng — ENOTFOUND registry.npmjs.org).

---

## High

### H-1. Import Excel: một file .xlsx vài KB có thể làm OOM cả tiến trình Node — giới hạn dòng/kích thước hiện có không chặn được

- **Vị trí:**
  - `src/server/daily-import.ts:15-18` (`readSheet`) và `:31` (`wb.xlsx.load`).
  - `src/server/actions.ts:464`, `:471`, `:476-483` (`importExcelAction`, viết lại bằng exceljs ở Task 9).
  - Giới hạn chỉ kiểm SAU khi đã dựng toàn bộ dữ liệu: `src/server/actions-entry.ts:206` (`rows.length > DAILY_IMPORT_MAX_ROWS`).
    `importExcelAction` không có giới hạn dòng nào.
- **Nguyên nhân (exceljs 4.4.0, `lib/doc/worksheet.js`, `lib/doc/row.js`):**
  - `ws.rowCount` = số thứ tự dòng cuối có trong file, không phải số dòng có dữ liệu.
  - `ws.getRow(r)` / `row.getCell(c)` tạo mới đối tượng nếu chưa có.
  - `colCount = max(columnCount, getRow(1).cellCount)` theo ô xa nhất.
  - 1 ô ở `XFD1` + 1 ô ở `A1048576` → vòng lặp tạo ≈ 1.048.575 × 16.384 ≈ 1,7·10^10 Cell.
  - Chặn 10MB chỉ đo file đã nén; body server action mặc định 1MB, nhưng 1MB XML deflate có thể bung ~1GB (zip bomb),
    exceljs/JSZip giải nén toàn bộ vào RAM.
- **Khai thác:** tài khoản `admin`/`data-entry` bất kỳ (`importExcelAction` chỉ cần role; `previewDailyImportAction` cần
  được gán 1 dự án) tải file `.xlsx` < 10KB có ô `XFD1` và `A1048576` → event loop bị chặn, OOM, tiến trình chết, mọi
  người mất dịch vụ; không rate-limit, lặp lại ngay được.
- **Mức:** Cao.
- **Cách vá:**
  1. Sau `wb.xlsx.load`, trước mọi vòng lặp: `ws.rowCount > DAILY_IMPORT_MAX_ROWS + 1` (import tháng cũ: hằng riêng, vd 5000)
     → `too_many_rows`; `colCount > 64` → `bad_file`; tính `colCount` bằng `ws.getRow(1).cellCount` sau khi chặn.
  2. Duyệt bằng `ws.eachRow({ includeEmpty: false }, ...)`, `getCell(c)` với `c ≤ colCount` đã chặn — không `for r ≤ rowCount`.
  3. Chống zip bomb: trước `wb.xlsx.load`, mở buffer bằng JSZip, cộng kích thước giải nén các entry `xl/worksheets/*.xml`
     + `xl/sharedStrings.xml`, vượt ~20MB thì từ chối (hoặc dùng `ExcelJS.stream.xlsx.WorkbookReader`, dừng sớm).
  4. Áp cho cả `readDailyWorkbook` và `importExcelAction` — nên gom thành 1 hàm `readBoundedSheet` dùng chung.
  5. Test hồi quy: file có ô `XFD1` và `A1048576` → `too_many_rows`/`bad_file` trong < 1 giây.

---

## Medium

Không có.

---

## Low

### L-1. Fetch Vietcombank không giới hạn kích thước phản hồi, không kiểm khoảng hợp lý của tỷ giá
- `src/server/fx-rates.ts:21` (`await res.text()`), `:63` (lưu `rate` không qua `saveExchangeRateSchema`).
- `VCB_RATE_URL` do vận hành đặt → không SSRF từ người dùng; timeout 8s qua `AbortController`; parse regex → không XXE.
  Nhưng nguồn đổi/nhầm URL có thể đẩy hàng trăm MB vào RAM hoặc ghi tỷ giá vô lý (1, 1e9).
- **Vá:** đọc stream có ngưỡng (> 256KB huỷ); chỉ nhận `1_000 < rate ≤ 1_000_000`; `redirect: 'error'` hoặc chỉ cho host
  `portal.vietcombank.com.vn`.

### L-2. `commitDailyImportSchema.days` không có `.max()`
- `src/server/validation.ts`; giới hạn 62 ngày chỉ kiểm sau parse ở `src/server/actions-entry.ts:248`.
- **Vá:** `.min(1).max(DAILY_IMPORT_MAX_DAYS)` trong schema.

### L-3. `CRON_SECRET` không yêu cầu độ dài tối thiểu
- `app/api/cron/[job]/route.ts:25-31`. Đã đạt: `timingSafeEqual`, thiếu secret → 503 (fail-closed), whitelist `JOB_NAMES`.
- Thiếu: secret yếu (vd `"1"`) vẫn nhận; không rate-limit.
- **Vá:** `if (!secret || secret.length < 32) return 503`; ghi yêu cầu vào `.env.example`.

### L-4. secret-box (nền P3B): hint lộ 4 ký tự cuối, không ràng AAD
- `src/lib/secret-box.ts:77-80` (`secretHint`), `:38`/`:67` (không `setAAD`). Đã đạt: AES-256-GCM, IV 12 byte ngẫu nhiên,
  tag 16 byte, khoá env `NOTIFY_SECRET_KEY` bắt buộc 32 byte (fail-closed), không log secret.
- **Vá:** với URL, hint chỉ hiện host; `cipher.setAAD(Buffer.from(\`notify_channel:${id}\`))` khi P3B dùng.

### L-5. `Content-Disposition` ghép thẳng `project.masterCode`
- `app/api/templates/daily-resources/route.ts:35`. Ký tự ngoài ASCII/`"` → Node throw → 500 (không chèn header được).
- **Vá:** `masterCode.replace(/[^A-Za-z0-9._-]/g, '_')`, nếu cần có dấu thì thêm `filename*=UTF-8''...`.

### L-6 (dữ liệu). Migration xoá tỷ giá AUD/SAR vô điều kiện
- `prisma/migrations/20260924150000_p2a_entry_foundation/migration.sql`, khối 5b:
  `DELETE FROM dim_exchange_rate WHERE currencyCode IN ('AUD','SAR')` không có `NOT EXISTS` như câu `dim_currency`;
  enum `CURRENCY` trong `validation.ts` cũng đã bỏ AUD/SAR.
- **Vá:** thêm điều kiện `NOT EXISTS`, hoặc xác nhận trên DB thật không có dự án dùng AUD/SAR trước deploy.

### L-7 (nợ đã biết). `xlsx` 0.18.5 vẫn trong `dependencies`
- `package.json:22`. Không còn code production import `xlsx` (chỉ test).
- **Vá:** chuyển sang `devDependencies`.

---

## Đã rà và đạt

- **RBAC/IDOR:** các action nhà thầu/nhập ngày/import gọi `requireWriteProject(projectId)`; so danh sách gán bằng so sánh
  chặt. `checkDailyPayload` kiểm lại server (nhà thầu thuộc dự án, ca/thiết bị tồn tại, khung ngày theo role, tháng khoá,
  thực tế không ở tương lai, sửa ngày cũ phải có lý do). Commit import kiểm lại toàn bộ, không tin preview từ client.
  `actions-master` chỉ admin. `closeAlertAction` lấy `projectId` từ alert trong DB; data-entry chỉ đóng alert dự án mình,
  BOD đóng mọi alert; có `closeAlertSchema` + chặn đóng 2 lần. `saveMonthlyData`: `factoryId` phải đang hoạt động, khoá
  tháng kiểm trước khi ghi. Route file mẫu kiểm `canWriteProject`, chỉ trả nhà thầu của dự án.
- **Chèn công thức:** file mẫu dùng `safeCell`; tiêu đề bắt đầu "KH "/"TT ".
- **XSS:** `audit_log.note`, `closeNote`, `job_run.detail`, tên trong preview đều qua React; không `dangerouslySetInnerHTML`;
  `RateReminder` href tiền tố cố định.
- **`runDueJobs('lazy')`:** tối đa 1 lần/10 phút/tiến trình, cờ busy, `void` không chặn render; lỗi tỷ giá thử lại sau 6 giờ;
  chạy trùng nhiều tiến trình chặn bằng unique `(projectId, dedupeKey)` + điều kiện `ruleCode` còn mở.
- **XML VCB:** regex không lồng, không DTD/entity; exceljs dùng saxes không mở entity ngoài.
- **Secret:** không hard-code; `.env.example` để trống; không log `CRON_SECRET`/`NOTIFY_SECRET_KEY`.

## Kết luận

KHONG DAT do H-1. Vá H-1 (chặn `rowCount`/`colCount` trước khi lặp, `eachRow`, kiểm kích thước sau giải nén) + test hồi quy
là đủ chuyển DAT. L-1…L-7 nên vá nhưng không chặn merge.
