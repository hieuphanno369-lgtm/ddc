# P2A — Nhập liệu mới — Tóm tắt thay đổi (Task 7–9, coder resume)

> Task 1–6 đã commit ở phiên trước (`4101723`…`4b891f9`), không nhắc lại ở đây. File này ghi phần
> Task 7 (T6 tỷ giá), Task 8 (T11 engine cảnh báo), Task 9 (nợ F4 exceljs) — 3 commit cuối:
> `aed5ce5`, `a9f69b8`, `69af164`.

## Task 7 — T6: tỷ giá tháng tự lấy VCB + sửa tay + nhắc + hạ tầng job (`aed5ce5`)

- **Mới:** `src/lib/fx.ts`, `src/lib/vcb-rates.ts`, `src/lib/job-schedule.ts` (+ test) — hàm thuần:
  danh sách tiền tệ tự động (`FX_CURRENCIES = ['USD','EUR']`), parse XML VCB, lịch chạy job (throttle
  "lười" + retry lỗi mạng sau 6 giờ).
- **Mới:** `src/server/fx-rates.ts` (fetch VCB thật + `refreshMonthRates` không ghi đè số đã sửa tay),
  `src/server/jobs.ts` (`runJob`/`runDueJobs`, ghi `job_run`), `app/api/cron/[job]/route.ts` (cron ngoài
  gọi, cần `CRON_SECRET`, so sánh bằng `timingSafeEqual`).
- **Mới:** `src/components/admin/ExchangeRateEditor.tsx` (bảng tỷ giá theo tháng × USD/EUR, nút "Lấy
  ngay", sửa tay, xoá), `src/components/layout/RateReminder.tsx` (dải nhắc thiếu tỷ giá cho admin).
- **Sửa:** `app/[locale]/(app)/admin/page.tsx` — bỏ card `admin.currencies` cũ (chỉ đọc, không sửa
  được), thay bằng card `ExchangeRateEditor`; `app/[locale]/(app)/layout.tsx` — gọi `runDueJobs('lazy')`
  (không await) + hiện `RateReminder` cho admin khi thiếu tỷ giá tháng hiện tại.
- **Sửa:** `src/server/actions-master.ts` (đã có sẵn từ phiên trước, resume hoàn thiện), `src/server/
  validation.ts` (`saveExchangeRateSchema`, `deleteExchangeRateSchema`), `src/server/repo/{prisma,mock}
  -repo-entry.ts` (`getExchangeRates`, `upsertExchangeRate`, `deleteExchangeRate`, `startJobRun`,
  `finishJobRun`, `getRecentJobRuns`), `.env.example` (`CRON_SECRET`, `VCB_RATE_URL`).
- **Bổ sung khi resume (phần dở dang chưa xong ở phiên trước):**
  - Nhóm i18n `fxRates` **thiếu hoàn toàn** trong `vi.json`/`en.json` — đã thêm (nhóm mới, cuối file,
    không chèn giữa key cũ).
  - `RateReminder.tsx` **chưa tồn tại** — đã viết mới (link dùng thẻ `<a>` thường, không dùng `Link` của
    next-intl vì component đã tự ghép tiền tố `/${locale}` theo đúng chữ ký kế hoạch — dùng `Link` sẽ bị
    chèn locale 2 lần vì `routing.ts` mặc định `localePrefix: 'always'`).
  - `app/[locale]/(app)/layout.tsx` và `admin/page.tsx` **chưa được nối dây** — đã sửa.
  - Test `actions-master.test.ts` cho `saveExchangeRateAction`/`deleteExchangeRateAction`/
    `fetchRatesNowAction` **chưa có** — đã thêm 9 ca theo đúng bảng Test trong kế hoạch.

**Tester nên soi:** `ExchangeRateEditor` chỉ gọi `router.refresh()` sau khi lưu/xoá thành công, không tự
hiện lỗi validate (server trả `Invalid input` chưa có message riêng trên UI — chỉ ẩn form sửa nếu lỗi;
đây là điểm kế hoạch không yêu cầu rõ UI báo lỗi save/delete, chỉ có báo lỗi cho "Lấy ngay"). Dev thật
không gọi được VCB (mạng chặn TLS) nên chỉ xác nhận qua test có mock `fetch`.

## Task 8 — T11: engine cảnh báo chạy thật + đóng alert có hành động/ghi chú (`a9f69b8`)

- **Mới:** `src/lib/alert-rules.ts` (+ test) — R1–R7 (SPI/CPI thấp, nguy cơ/đã phạt HĐ, công nợ quá
  hạn, huy động nhân lực/thiết bị thấp), bỏ qua khi dự án "Hoàn thành", `ALERT_DEADLINE_DAYS` (Đỏ +7 /
  Vàng +14).
- **Mới:** `src/server/alert-engine.ts` (+ test) — `runAlertEngine({projectIds?})` gom dữ liệu tháng/7
  ngày gần nhất rồi gọi `evaluateProjectAlerts`, `runAlertEngineSafe` (không bao giờ throw).
- **Mới:** `src/server/repo/types.ts` thêm `NewEngineAlert`; `prisma-repo-entry.ts`/`mock-repo-entry.ts`
  thêm `insertEngineAlerts` (chống trùng theo `dedupeKey` VÀ theo `ruleCode` còn mở — K6).
- **Mới:** `src/components/alerts/CloseAlertForm.tsx` — khung nhập "Hành động đã xử lý" (bắt buộc) +
  "Ghi chú" (tuỳ chọn) khi đóng alert.
- **Sửa:** `src/server/actions.ts` — `closeAlertAction` nhận thêm `note`, validate `closeAlertSchema`,
  chặn đóng 2 lần (`already_closed`); `saveMonthlyData`/`commitImportAction` gọi
  `runAlertEngineSafe(projectId).catch(() => {})` trước `logActivity`. `src/server/actions-entry.ts` —
  `saveDailyResourcesAction`/`commitDailyImportAction` gọi tương tự. `src/server/jobs.ts` —
  `alerts_daily` chạy `runAlertEngine` thật (trước đây trả `unknown_job`), `runDueJobs` thêm kiểm
  `isAlertsDailyDue`. `src/components/alerts/AlertList.tsx` — dùng `CloseAlertForm` thay nút đóng cũ.
  `src/server/validation.ts` thêm `closeAlertSchema`.
- **i18n:** nhóm `alertClose` mới trong `vi.json`/`en.json`.

**Tester nên soi:**
- Chỗ gọi `await runAlertEngineSafe(projectId).catch(() => {})` ở 4 nơi (`actions.ts` ×2,
  `actions-entry.ts` ×2) — dù bản thân hàm đã tự bắt lỗi (không throw), chỗ gọi vẫn `.catch()` thêm một
  lớp phòng thủ (test `saveMonthlyData` với `runAlertEngineSafe` bị spy throw vẫn phải trả `{ ok: true
  }` — xem `actions.test.ts` mục "T11 (Task 8, P2A): engine canh bao").
- `evaluateProjectAlerts` dùng `fact?.pctActual` theo thang **phân số 0–1** (không phải %) — khớp quy
  ước `THRESHOLDS.completionPct = 1.0` và `pct = z.number().min(0).max(1.5)` trong `validation.ts`.
- `insertEngineAlerts` chỉ chặn trùng khi có alert MỞ cùng `ruleCode`; alert đã đóng cùng `ruleCode`
  nhưng khác kỳ (dedupeKey khác) vẫn tạo được — đúng Q10 (engine không tự đóng, không tự mở lại điều
  kiện cũ đã đóng).
- `closeAlertAction`: hành vi cũ "alertId không tồn tại → admin vẫn `{ ok: true }`" (không có bước
  kiểm tồn tại alert) được **giữ nguyên** vì `close-alert-role.test.ts` đã chốt hành vi này từ trước; chỉ
  thêm bước `action_short`/`already_closed`.

## Task 9 — Nợ F4: import % tiến độ cũ đọc bằng exceljs, bỏ `.xls` (`69af164`)

- **Sửa:** `src/server/actions.ts` `importExcelAction` — bỏ `XLSX.read`/`sheet_to_json`, đọc bằng
  `exceljs` (`.xlsx` → `wb.xlsx.load`, `.csv` → `wb.csv.read(Readable.from(buf))`), dựng
  `Record<string,unknown>` mỗi dòng qua `cellText` (`src/lib/daily-import.ts`), `rowNo` = số dòng Excel
  thật (không còn dựa vào `__rowNum__` của thư viện `xlsx`). Lỗi đọc file → `{ ok: false, error:
  'Invalid file' }`. Bỏ `import * as XLSX` khỏi file.
- **Sửa:** `src/server/validation.ts` `importFileSchema` — regex chỉ còn `.xlsx`/`.csv` (bỏ `.xls`).
- **Sửa:** `src/components/form/ImportPanel.tsx` — `accept=".xlsx,.csv"` (bỏ `.xls`) để khớp validation
  mới.
- **KHÔNG gỡ** package `xlsx` (test cũ + `actions-import.test.ts` vẫn dùng `XLSX.write` để DỰNG file test
  — chỉ ghi, không parse file người dùng tải lên, nên không còn bề mặt lỗ hổng). Nợ này để reviewer ghi
  nhận cho phase sau nếu muốn gỡ hẳn.
- **Test mới** trong `actions-import.test.ts`: file `.xls` → lỗi schema đúng câu `'Chỉ chấp nhận file
  .xlsx/.csv'`; file CSV 2 dòng (header + 1 dòng dữ liệu) → preview đúng `rowNo: 2`.

**Tester nên soi:** file `.xlsx` do Excel thật xuất ra (không phải do `XLSX.write` dựng) — test tự động
mới chỉ phủ file dựng bằng thư viện `xlsx`/CSV thuần; nên thử tay 1 file `.xlsx` thật từ Excel/LibreOffice
để chắc `exceljs` đọc đúng tiêu đề cột có dấu tiếng Việt.

## Cổng kiểm (toàn bộ P2A, sau Task 9)

- `npx tsc --noEmit`: sạch.
- `npm test`: **95/95 file · 1127/1127 test** xanh (bao gồm `src/i18n/messages.test.ts` xác nhận
  `vi.json`/`en.json` khớp key).
- Build kiểm compile: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=".../tools/font-mock.js" npm run build` →
  `Compiled successfully`, mọi route lên trang (bao gồm `/api/cron/[job]`, `/[locale]/admin`,
  `/[locale]/nhap-lieu`).

## Điểm treo / chưa làm (ghi cho reviewer, không phải lỗi coder)

- Không thử được "Lấy ngay" tỷ giá thật trên máy dev (mạng chặn TLS ra ngoài) — chỉ xác nhận qua test có
  mock `fetch`. Theo đúng ghi chú K4/Q7 trong kế hoạch, đây là hành vi dự kiến.
- `xlsx` package vẫn còn trong `package.json` (chỉ dùng để ghi file test) — nợ kỹ thuật đã ghi rõ trong
  kế hoạch Task 9, không gỡ ở P2A.

## Vòng sửa 1 (sau reviewer v1)

> Sửa đúng 4 mục "CÁC MỤC PHẢI SỬA" trong `danh-gia.md` (H-1a, H-1b, H-1c, `ExchangeRateEditor`) + mục 1
> "ĐỂ SAU" (L-2). Không đụng gì khác.

### 1. [H-1a] Đọc sheet có giới hạn — `readBoundedSheet` dùng chung

- **Mới** `src/server/daily-import.ts:7-54` — hằng `SHEET_MAX_COLS = 64`, kiểu `BoundedSheet`, hàm
  `readBoundedSheet(ws, maxRows)`: kiểm `ws.rowCount > maxRows + 1` **trước** mọi vòng lặp (`too_many_rows`),
  rồi `colCount = ws.getRow(1).cellCount` (không `ws.columnCount`, không `Math.max`) > 64 → `too_many_cols`;
  chỉ sau đó mới `ws.eachRow({ includeEmpty: false }, ...)` và `getCell(c)` với `c ≤ colCount` đã chặn. Bỏ
  hẳn kiểu vòng lặp `for (let r = 2; r <= ws.rowCount; r++)` (chỗ cũ tạo hàng tỷ `Cell` khi file có ô ở
  `XFD1`/`A1048576`).
- **Sửa** `src/server/daily-import.ts:103-115` (`readSheet`, dùng bởi `readDailyWorkbook`) — gọi
  `readBoundedSheet(ws, DAILY_IMPORT_MAX_ROWS)` rồi dựng lại `CellValue[][]` đúng vị trí `rowNo - 2` (mảng
  bị chặn theo `maxRows` nên an toàn bộ nhớ) — giữ nguyên kiểu trả về cũ để **không phải sửa**
  `src/lib/daily-import.ts` (`parseManpowerSheet`/`parseEquipmentSheet` + test của chúng vẫn nguyên).
- **Sửa** `readDailyWorkbook` (`daily-import.ts:118-139`) — lỗi trả `'bad_file' | 'too_many_rows'`
  (`too_many_cols` map về `'bad_file'`).
- **Sửa** `src/server/actions-entry.ts:190-191` (`previewDailyImportAction`) — trả thẳng `wb.error` thay vì
  luôn cứng `'bad_file'` (UI `DailyImportBlock.tsx` đã có sẵn `dailyImport.err.too_many_rows`/`bad_file`).
- **Sửa** `src/server/actions.ts:447-487` (`importExcelAction`) — thay khối dựng `header`/`raw`/`rowNos`
  thủ công bằng `readBoundedSheet(wb.worksheets[0], IMPORT_LEGACY_MAX_ROWS)`; lỗi bound → `{ ok: false,
  error: 'File quá 5000 dòng hoặc quá 64 cột' }`; sheet rỗng (`bounded.header.length === 0`) → `'Invalid
  file'` (giữ hành vi cũ). `rowNos[i]` lấy từ `row.rowNo` (số dòng Excel thật, không còn suy từ index vòng
  lặp cũ).
- **Mới** `src/server/validation.ts` — hằng `IMPORT_LEGACY_MAX_ROWS = 5000` cạnh `IMPORT_MAX_BYTES`.

### 2. [H-1b] Chống zip bomb — `assertXlsxInflatedSize`

- **Mới** `src/server/daily-import.ts:56-101` — `assertXlsxInflatedSize(buf, limitBytes = 20MB)`:
  `JSZip.loadAsync(buf)` (chỉ đọc mục lục, không giải nén), lọc entry khớp
  `/^xl\/(worksheets\/[^/]+\.xml|sharedStrings\.xml)$/`, mỗi entry dùng `entry.internalStream('uint8array')`
  (KHÔNG `entry.async(...)` — hàm đó dồn hết dữ liệu vào bộ nhớ trước khi trả, ngược đúng thứ cần chặn),
  cộng `chunk.length` ở sự kiện `'data'`; vượt `limitBytes` → gọi `stream.pause()` rồi trả `false` ngay
  (dừng sớm, không đợi giải nén hết). `loadAsync` lỗi hoặc entry lỗi → `false`.
  - `internalStream` không có trong `@types/jszip` (bản cài là jszip 3.10.2 — file JS thật có hàm này ở
    `lib/zipObject.js`, chỉ thiếu khai kiểu) — khai 1 interface tối thiểu `JSZipInternalStream`
    (`on`/`resume`/`pause`) + ép kiểu tại chỗ gọi, thay vì tắt kiểm kiểu (`any`) cho cả file.
- **Sửa** `readDailyWorkbook` — gọi `assertXlsxInflatedSize(buf)` ngay **trước** `wb.xlsx.load`; `false` →
  `{ ok: false, error: 'bad_file' }`.
- **Sửa** `importExcelAction` — gọi `assertXlsxInflatedSize(buf)` trước `wb.xlsx.load` cho nhánh `.xlsx`
  (không gọi cho `.csv` — không phải zip); `false` → `{ ok: false, error: 'Invalid file' }`.
- **`package.json`/`package-lock.json`** — thêm `"jszip": "^3.10.2"` vào `dependencies` (trước đó chỉ là
  dependency gián tiếp của `exceljs`, đã có sẵn trong `node_modules`/lock; `npm install --offline` xác
  nhận khớp, không tải mạng).

### 3. [H-1c] Test hồi quy

- **`src/server/daily-import.test.ts`** — 4 test mới:
  - Sheet `NhanLuc` có `XFD1='x'` + `A1048576='x'` → `readDailyWorkbook` trả `ok:false`, đo thời gian
    `expect(elapsed).toBeLessThan(2000)`.
  - Chỉ `XFD1='x'` (rowCount trong hạn, `colCount` 16384 > 64) → đúng `{ ok: false, error: 'bad_file' }`.
  - `assertXlsxInflatedSize(buf, 64*1024)` với 1 ô `'a'.repeat(200_000)` → `false`.
  - `assertXlsxInflatedSize(buf)` (không truyền limit) với file mẫu `buildDailyTemplate` (nhỏ) → `true`.
  - Dựng file test trực tiếp bằng `ExcelJS` (`ws.getCell('XFD1').value = 'x'`) — không cần dựng bằng JSZip
    tay: đo thử ngoài test, `wb.xlsx.writeBuffer()` cho case XFD1+A1048576 chỉ mất ~100ms (exceljs lưu
    sparse khi ghi), không phải điểm chậm — điểm chậm là ĐỌC theo kiểu vòng lặp cũ, đã bị loại bỏ ở mục 1.
- **`src/server/actions-entry.test.ts`** — 1 test mới trong nhóm `previewDailyImportAction`: 5002 dòng dữ
  liệu hợp lệ (dùng lại helper `buildFile` sẵn có) → `{ ok: false, error: 'too_many_rows' }` (chặn ngay ở
  `readDailyWorkbook`, không cần chạy hết `parseManpowerSheet`).
- **`src/server/actions-import.test.ts`** — 1 test mới `describe('importExcelAction - chan file doc hai
  (H-1c)')`: cùng file `XFD1`+`A1048576` (dựng bằng `ExcelJS`, sheet tên bất kỳ vì `importExcelAction` chỉ
  đọc `worksheets[0]`) → `ok:false`, `elapsed < 2000`.

### 4. `ExchangeRateEditor` báo lỗi lưu/xoá

- **Sửa** `src/components/admin/ExchangeRateEditor.tsx`:
  - Thêm state `rowErr` (dòng 26).
  - `save()` (dòng 48-62): số không hợp lệ (≤0/NaN) hoặc `res.ok===false` → `setRowErr(...)` thay vì
    `return` im lặng; message `dailyEntry.err.forbidden` nếu `res.error==='Forbidden'`, còn lại
    `fxRates.err.invalid` (cả 2 key đã có sẵn trong `vi.json`/`en.json` — **không cần thêm i18n**). Lưu
    thành công thì xoá `rowErr`.
  - `del()` (dòng 64-73): `res.ok===false` → `forbidden` hoặc `dailyEntry.err.generic` (đã có sẵn, nhận
    `{msg}`).
  - Render `{rowErr && <p className="sumbar bad">{rowErr}</p>}` ngay dưới dòng `fetchMsg` (dòng 89).
  - Bấm "Sửa" mở ô mới → `setRowErr(null)` (dòng 134) để lỗi cũ không dính sang ô khác.
  - Không có test tự động cho component này (dự án dùng `vitest environment: 'node'`, không có hạ tầng
    `render()`/jsdom cho component `'use client'` có state tương tác — khớp quy ước hiện có của repo).
    **Tester nên soi bằng tay:** mở `/admin`, bấm "Sửa" 1 ô tỷ giá, nhập số 0 → thấy dòng lỗi đỏ; sửa lại
    số hợp lệ → lỗi biến mất, lưu OK.

### L-2 (ĐỂ SAU, làm luôn — 1 dòng)

- **Sửa** `src/server/validation.ts` — `commitDailyImportSchema.days` thêm `.max(DAILY_IMPORT_MAX_DAYS)`
  sau `.min(1)`. Import `DAILY_IMPORT_MAX_DAYS` từ `@/lib/daily-import`. Dòng `too_many_days` cũ ở
  `actions-entry.ts:230` (kiểm sau khi parse) giờ thành phòng thủ kép/không bao giờ chạm tới với input hợp
  lệ qua schema — giữ nguyên, không xoá (không nằm trong phạm vi vòng sửa 1).

## Cổng kiểm vòng sửa 1

- `npx tsc --noEmit`: sạch.
- `npm test`: **95/95 file · 1140/1140 test** xanh (1134 cũ + 6 test mới ở mục H-1c).
- Build kiểm compile: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=".../tools/font-mock.js" npx next build` →
  `Compiled successfully`, mọi route lên trang.

## Vòng sửa 2 (sau reviewer v2)

> Sửa đúng 2 mục "CÁC MỤC PHẢI SỬA" trong `danh-gia.md` vòng 2 ([H-1b] chưa đóng hết,
> thiếu key i18n `activity.*`). Không đụng gì khác. Commit `60aedc1` (mục 1) rồi `ff8bafe` (mục 2).

### 1. [H-1b] `assertXlsxInflatedSize` — đo MỌI entry, cộng dồn, trần số entry (`60aedc1`)

- **Sửa** `src/server/daily-import.ts`:
  - Thêm hằng export `XLSX_MAX_ENTRIES = 200` cạnh `SHEET_MAX_COLS`.
  - Bỏ hẳn regex lọc tên entry (`/^xl\/(worksheets\/[^/]+\.xml|sharedStrings\.xml)$/`) — lỗ hổng cũ:
    exceljs (`entry.async(...)`) giải nén MỌI entry không phải thư mục bất kể tên, kể cả tên có `/`
    đầu; regex cũ chỉ đo 1 phần nên file gài bom ở `xl/styles.xml`/`docProps/*` lọt qua.
  - Sau `JSZip.loadAsync`: `entries = Object.values(zip.files).filter((f) => !f.dir)`; vượt
    `XLSX_MAX_ENTRIES` → trả `false` ngay (chặn số entry, chưa giải nén byte nào).
  - `let total = 0` chuyển ra NGOÀI vòng `for` — một biến cộng dồn dung lượng sau giải nén qua **mọi**
    entry (bug cũ: biến nằm trong từng promise, mỗi entry tính riêng, không cộng dồn — file 5 entry ×
    20KB dưới trần 64KB mỗi entry vẫn lọt dù tổng 100KB vượt trần).
  - Giữ nguyên cơ chế stream có thể dừng sớm (`internalStream`, `stream.pause()` khi vượt `limitBytes`,
    không dùng `entry.async(...)`) — chỉ sửa vùng đo/lọc, không đổi cách dừng.
  - Sửa JSDoc cho khớp code mới (đo mọi entry, cộng dồn, trần entry).
- **Test mới** `src/server/daily-import.test.ts` (7 ca, `describe('assertXlsxInflatedSize (H-1b,
  chong zip bomb)')`):
  - (a) Entry ngoài regex cũ (`xl/styles.xml` nạp lại bằng JSZip vào file mẫu `buildDailyTemplate`) →
    `assertXlsxInflatedSize` `false`, `readDailyWorkbook` `{ok:false,error:'bad_file'}`, < 2000ms.
  - (b) Tên entry có `/` đầu (`/xl/worksheets/sheet1.xml`) → `false`; xác nhận
    `JSZip.loadAsync` giữ nguyên tên có `/` đầu (không tự chuẩn hoá — đã đối chiếu
    `jszip/lib/utils.js` `exports.resolve`, phần tử rỗng đầu tiên được giữ lại).
  - (c) Cộng dồn: `limitBytes=64KB`, 5 entry × 20KB → `false`; đối chứng 2 entry × 20KB → `true`.
  - (d) Số entry: 201 entry nhỏ → `false`; đối chứng 50 entry → `true`.
  - (e) Thời gian: 3 entry × 15MB (trần mặc định 20MB) → `false`, đo thực tế elapsed ~600ms (< 2000ms)
    — xác minh `stream.pause()` dừng giải nén THẬT (đã đối chiếu `jszip/lib/stream/DataWorker.js`:
    `_tickAndRepeat` kiểm `isPaused` trước mỗi block 16KB, lịch qua `utils.delay` — pause dừng vòng lặp
    giữa các block chứ không đợi xong 1 entry).
- **Test mới** `src/server/actions-import.test.ts` — 1 ca tầng action trong `describe('importExcelAction
  - chan file doc hai (H-1c)')`: file có `xl/styles.xml` bom (như ca (a)) qua `importExcelAction` →
  `{ ok:false, error:'Invalid file' }`, < 2000ms.
- Test cũ `'file mau buildDailyTemplate (nho) -> true'` (`daily-import.test.ts`) và 2 ca trong
  `actions-import-v2.test.ts` (`XLSX.write` thật) vẫn xanh, không sửa.

**Tester nên soi:** ca (e) đo thời gian thực (không mock timer) — nếu môi trường CI/máy khác chậm hơn máy
dev (đo được ~600ms), ngưỡng `< 2000ms` vẫn còn biên khá rộng nhưng nên theo dõi nếu flakey.

### 2. Thêm 14 key i18n `activity.*` còn thiếu (`ff8bafe`)

- **Sửa** `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` — nối 14 key vào **CUỐI** object
  `activity` (sau `delete_photo`, ngoại lệ có lý do vì `ActivityViewer.tsx` tra `activity.<action>`
  theo đúng chuỗi action lưu trong `logActivity`, không nhóm theo tính năng): `save_exchange_rate`,
  `delete_exchange_rate`, `save_factory`, `activate_factory`, `deactivate_factory`,
  `project_contractor_add`, `project_contractor_remove`, `save_daily_resources`, `contractor_create`,
  `commit_daily_import` (action P2A) và `create_dim`, `rename_dim`, `merge_dim`, `save_key_milestones`
  (action cũ trước P2A, bỏ sót từ trước).
- **Test mới** `src/i18n/messages.test.ts` — `describe('i18n: moi action logActivity duoi src/server/
  co key activity.<action>')`: đọc đệ quy mọi `.ts` dưới `src/server/` (bỏ `*.test.ts`), quét
  `logActivity(user, ...)` bằng regex, trích literal action (bắt cả dạng ternary
  `isActive ? 'a' : 'b'`), đối chiếu mỗi action phải có `activity.<action>` ở CẢ vi và en. Chạy thực tế:
  không phát hiện action nào khác còn thiếu key ngoài 14 key đã thêm.

## Cổng kiểm vòng sửa 2

- `npx tsc --noEmit`: sạch.
- `npm test`: **97/97 file · 1168/1168 test** xanh (1157 cũ + 8 test H-1b + 3 test i18n).
- Build kiểm compile: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=".../tools/font-mock.js" npx next build` →
  `Compiled successfully`, mọi route lên trang.
