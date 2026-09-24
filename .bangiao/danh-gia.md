PHAN QUYET: CAN SUA

# P2A — Nhập liệu mới — Đánh giá reviewer (chặng cuối, vòng 1)

> Điều phối viên lưu hộ từ báo cáo reviewer (vai chỉ đọc).

Nhánh `feature/p2a-nhap-lieu`, diff `10cda5a..HEAD` (HEAD `e693f8b`, 10 commit, 86 file, +6350/−113).
Skill: `ddc-tower:code-review`.

## Tự kiểm lại (độc lập với tester)
- `npx tsc --noEmit`: sạch. `npm test`: 95/95 file · 1134/1134 xanh.
- `PROGRESS.md`, `.serena/memories/`: không đụng. `package.json`: không đổi (exceljs 4.4 có sẵn).
- Migration: đúng 1 migration gộp `20260924150000_p2a_entry_foundation` + `.down.sql`; có CHECK source/rate/status; backfill
  `ruleCode` khớp văn `ruleTriggered` engine sinh.
- i18n: 7 nhóm mới `contractorJoin, dailyEntry, dailyImport, factoryAdmin, volumeEntry, fxRates, alertClose` ở cuối sau
  `logPaging`; không xoá/sửa key cũ; vi/en khớp.

## 1. Khớp kế hoạch — CÓ (trừ các mục phải sửa)
- Task 1–2: schema, type, seed, ca `evening`, bỏ AUD/SAR, `coreRepo` + spread (K3), secret-box AES-256-GCM đúng chữ ký.
- Task 3–5: G-18 (Q5 chặn gỡ nhà thầu đã có số liệu), khung ngày theo role, `needsReason`, `checkDailyPayload` dùng chung;
  commit import kiểm TOÀN BỘ ngày trước khi ghi; file mẫu dùng `safeCell`.
- Task 6: `saveMonthlyData` kiểm `invalid_factory`/`no_factory` trước mọi ghi; `saveVolume` có audit.
- Task 7: VCB timeout, không ghi đè số tay, job_run, cron `timingSafeEqual` + 503 khi thiếu secret, chạy lười 10 phút, dải nhắc.
- Task 8: R1–R7 đúng bảng; chống trùng K6 (dedupeKey + ruleCode còn mở, bắt P2002); `closeAlertAction` có
  `action_short`/`already_closed`; engine gọi sau cả 4 đường lưu.
- Task 9: bỏ `XLSX.read`, `rowNo` đúng số dòng Excel, bỏ `.xls` cả schema lẫn UI.

## 2. Test có giá trị thật — CÓ
Kiểm đúng biên nghiệp vụ (SPI 0.9/0.89; window min/max; `needsReason` 4 ca; commit ngày 2 lỗi thì ngày 1 không ghi; K6 gọi
thẳng `insertEngineAlerts`; import sửa ngày cũ không lý do thì không ghi; ma trận quyền; đóng alert 2 lần).
Khoảng trống: (a) không có test file độc hại (`XFD1`/`A1048576`, zip bomb) — chính là H-1; (b) nhánh P2002 đường Prisma của
`insertEngineAlerts` chưa test; (c) chưa thử `.xlsx` xuất từ Excel thật.

## 3. Bảo mật / hiệu năng / đúng đắn
- H-1 xác nhận. Body server action mặc định 1MB nhưng file < 10KB đủ treo tiến trình; `wb.xlsx.load` giải nén + parse toàn bộ
  trước mọi kiểm dòng → phải chặn cả kích thước sau giải nén.
- `ExchangeRateEditor` lưu/xoá thất bại thì im lặng; key `fxRates.err.invalid` có mà không dùng.
- Hiệu năng: chấp nhận được với quy mô hiện tại.

---

## CÁC MỤC PHẢI SỬA

### 1. [H-1a] Đọc sheet có giới hạn — `src/server/daily-import.ts:6-20` + `src/server/actions.ts:469-483`
Hàm dùng chung trong `src/server/daily-import.ts`:

```ts
export const SHEET_MAX_COLS = 64;
export type BoundedSheet =
  | { ok: true; header: CellValue[]; rows: { rowNo: number; cells: CellValue[] }[] }
  | { ok: false; error: 'too_many_rows' | 'too_many_cols' };
export function readBoundedSheet(ws: ExcelJS.Worksheet | undefined, maxRows: number): BoundedSheet
```

- `!ws || ws.rowCount === 0` → header và rows rỗng.
- Kiểm TRƯỚC mọi vòng lặp: `ws.rowCount > maxRows + 1` → `too_many_rows`.
- `colCount = ws.getRow(1).cellCount` (KHÔNG `ws.columnCount`, KHÔNG `Math.max`); `colCount > SHEET_MAX_COLS` → `too_many_cols`.
- Duyệt `ws.eachRow({ includeEmpty: false }, (row, rowNumber) => …)`, bỏ `rowNumber === 1`; chỉ `getCell(c)` với `c ≤ colCount`;
  `rowNo = rowNumber`. Bỏ hẳn `for (let r = 2; r <= ws.rowCount; r++)`.

Áp dụng:
- `readSheet` (`daily-import.ts:12-20`) gọi `readBoundedSheet(ws, DAILY_IMPORT_MAX_ROWS)`.
- `readDailyWorkbook` lỗi kiểu `'bad_file' | 'too_many_rows'` (`too_many_cols` → `bad_file`). `previewDailyImportAction`
  (`actions-entry.ts:191-192`) trả đúng mã đó (UI đã có `dailyImport.err.too_many_rows`/`bad_file`).
- `importExcelAction` (`actions.ts:469-483`): thay khối dựng `header`/`raw`/`rowNos` bằng
  `readBoundedSheet(wb.worksheets[0], IMPORT_LEGACY_MAX_ROWS)`; hằng mới `IMPORT_LEGACY_MAX_ROWS = 5000` ở `validation.ts`
  cạnh `IMPORT_MAX_BYTES`. Lỗi → `{ ok: false, error: 'File quá 5000 dòng hoặc quá 64 cột' }`. `rowNos[i]` lấy `row.rowNo`.

### 2. [H-1b] Chống zip bomb trước `wb.xlsx.load` — `src/server/daily-import.ts:30-34` + `src/server/actions.ts:463-464`
`export async function assertXlsxInflatedSize(buf: Buffer, limitBytes = 20 * 1024 * 1024): Promise<boolean>`:
- Thêm `"jszip": "^3.10.2"` vào `dependencies` (đã có trong node_modules do exceljs dùng).
- `const zip = await JSZip.loadAsync(buf)` (chỉ đọc mục lục).
- Mỗi entry khớp `/^xl\/(worksheets\/[^/]+\.xml|sharedStrings\.xml)$/`: giải nén dạng stream `entry.internalStream('uint8array')`,
  cộng `chunk.length` ở `on('data')`; tổng vượt `limitBytes` → `stream.pause()` và trả `false` ngay. KHÔNG `entry.async(...)`;
  KHÔNG tin `_data.uncompressedSize`.
- `loadAsync` lỗi → `false`.
- Gọi ngay trước `wb.xlsx.load` ở `readDailyWorkbook` (`false` → `bad_file`) và `importExcelAction` nhánh `.xlsx`
  (`false` → `'Invalid file'`). CSV không cần; `readBoundedSheet` vẫn áp cho CSV.

### 3. [H-1c] Test hồi quy — `src/server/daily-import.test.ts` + `src/server/actions-import.test.ts`
- Workbook exceljs sheet `NhanLuc`, `XFD1 = 'x'` và `A1048576 = 'x'` → `readDailyWorkbook` ra `{ ok:false }` và
  `expect(elapsed).toBeLessThan(2000)`.
- Chỉ ô `XFD1` → `bad_file`.
- Cùng file qua `importExcelAction` → `ok:false`, không treo.
- `assertXlsxInflatedSize(buf, 64 * 1024)` với 1 ô `'a'.repeat(200_000)` → `false`; file mẫu `buildDailyTemplate` → `true`.
- `previewDailyImportAction` với 5002 dòng dữ liệu → `too_many_rows`.

### 4. `ExchangeRateEditor` lưu/xoá thất bại im lặng — `src/components/admin/ExchangeRateEditor.tsx:47-61`
- State `const [rowErr, setRowErr] = useState<string | null>(null)`.
- `save()`: số ≤ 0/không phải số (dòng 49) hoặc `res.ok === false` →
  `setRowErr(res.error === 'Forbidden' ? t('dailyEntry.err.forbidden') : t('fxRates.err.invalid'))`, không `return` im lặng.
- `del()`: `res.ok === false` → `setRowErr(t('dailyEntry.err.generic', { msg: res.error }))` (hoặc `forbidden`).
- Render `{rowErr && <p className="sumbar bad">{rowErr}</p>}` dưới dòng `fetchMsg` (dòng 76). Xoá lỗi khi mở ô sửa mới hoặc lưu OK.

Cổng kiểm sau sửa: `npx tsc --noEmit` sạch; `npm test` xanh (≥ 1134 + test mới); build kiểm compile với
`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`. Sau đó chạy lại security-reviewer.

---

## ĐỂ SAU (không chặn merge)
1. L-2 — `commitDailyImportSchema.days` thêm `.max(DAILY_IMPORT_MAX_DAYS)` (1 dòng, nên làm luôn).
2. L-3 — `app/api/cron/[job]/route.ts:25`: `!secret || secret.length < 32` → 503; ghi vào `.env.example`.
3. L-5 — `app/api/templates/daily-resources/route.ts:35`: làm sạch `masterCode` `/[^A-Za-z0-9._-]/g → '_'`.
4. L-1 — `src/server/fx-rates.ts:21,63`: body tối đa 256KB; `1_000 < rate ≤ 1_000_000`; `redirect: 'error'`.
5. Hiệu năng — `runAlertEngineSafe(projectId)` vẫn gọi `listProjects()`/`getAssignments()` toàn bảng (`alert-engine.ts:33-35`).
6. `saveDailyResources` (`prisma-repo-entry.ts:108-190`): 2 ô trùng khoá → P2002 → 500; nên chặn ở `checkDailyPayload`.
7. `closeAlertAction` alertId không tồn tại → P2025 (có từ trước P2A); thêm `Not found` + test.
8. Test Prisma cho `insertEngineAlerts` nhánh P2002.
9. L-7 — `xlsx` sang `devDependencies`.
10. L-6 — KHÔNG sửa `migration.sql` (đã deploy DB A). Trước deploy DB thật: `SELECT COUNT(*) FROM dim_project WHERE "currencyCode" IN ('AUD','SAR')` = 0.
11. `IMPORT_MAX_BYTES = 10MB` lệch body 1MB thực tế — đặt `serverActions.bodySizeLimit` rõ hoặc hạ hằng về 1MB.
12. L-4 (P3B): `secretHint` URL chỉ hiện host; `setAAD` theo id kênh.
13. Thử tay `.xlsx` xuất từ Excel/LibreOffice thật, tiêu đề tiếng Việt.

## Checklist merge P2A↔P2B (bên merge sau làm)
- `.bangiao/`: trước merge `main`, chuyển TOÀN BỘ file gốc `.bangiao/` (kể cả `ket-qua-test.md`, `test-screens/*.png`) vào
  `.bangiao/archive/p2a-nhap-lieu-2026-09-24/`.
- `src/server/repo/mock-repo.ts` (cuối): giữ `export const repo = { ...coreRepo, ...makeEntryMockRepo(...) };` của A, RỒI
  `Object.assign(repo, createReadMock(getData));` của B.
- `src/server/audit-log-page.ts`: nhận bản B (`repo.readAuditLogPage`), bỏ `note: a.note` của A, thêm `note: a.note` vào mapper
  `readAuditLogPage` ở `src/server/repo/read-prisma.ts` và `read-mock.ts`.
- `app/[locale]/(app)/admin/page.tsx`: gộp 2 hunk (B `readActivitySince`; A thay card factories/currencies).
- `vi.json`/`en.json`: giữ đủ nhóm của cả hai sau `logPaging`.
- Seed: lấy seed của A (`erp.ts`, `dims.ts`, `history.ts`); `manpower-charts.test.ts` của B dùng fixture riêng.
- `schema-meta/docs.ts` (B): thêm `job_run`, `notify_channel`, `notify_recipient` + cột mới P2A, chạy `npm run docs:erd`.
- Sau merge: `npx prisma migrate deploy` trên DB B, `npx prisma generate`, tsc + `npm test`.
- Merge xong + CHỐT → A nhả khoá `schema.prisma`/`migrations` cho B làm Bước 11.

## CÂU HỎI CHO CHỦ DỰ ÁN
1. Form nhập `project_equipment_plan` (B đề nghị A làm): không có trong kế hoạch P2A. (a) mở Task 10 trong P2A, hay (b) để phase sau? Không chặn merge.
2. H-1b thêm `jszip` làm dependency trực tiếp (đã có trong node_modules). Đồng ý?
