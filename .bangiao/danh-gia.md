PHAN QUYET: CAN SUA

# P2A — Nhập liệu mới — Đánh giá reviewer (chặng cuối, VÒNG 2)

> Điều phối viên lưu hộ từ báo cáo reviewer (vai chỉ đọc). Bản vòng 1 xem git `4872877:.bangiao/danh-gia.md`.

Nhánh `feature/p2a-nhap-lieu`, HEAD `4872877`, diff `e693f8b..HEAD` (`e267569` sửa, `4872877` test v2). Skill: `ddc-tower:code-review`.

## Tự kiểm lại
- `npx tsc --noEmit` sạch; `npm test` 97/97 file, 1157/1157 xanh.
- `package.json`: chỉ thêm `jszip ^3.10.2`. Không đụng `PROGRESS.md`, `.serena/memories/`, schema, migration.
- Đối chiếu `node_modules/exceljs/lib/xlsx/xlsx.js:279-312`: exceljs `entry.async('string'|'nodebuffer')` MỌI entry không phải
  thư mục, bỏ `/` đầu tên → security H-1b-1/2/3 ĐÚNG.

## Đối chiếu 4 mục phải sửa vòng 1

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| 1. H-1a `readBoundedSheet` | ĐÃ SỬA ĐÚNG | `daily-import.ts:40-54`; `readSheet` `:103-116`; `previewDailyImportAction` trả `wb.error` (`actions-entry.ts:191`); `importExcelAction` `actions.ts:473-484` (`IMPORT_LEGACY_MAX_ROWS=5000`). |
| 2. H-1b zip bomb | CHỈ ĐÓNG MỘT PHẦN | Xem mục phải sửa 1. |
| 3. H-1c test | ĐỦ theo đặc tả vòng 1 | Mọi test bom đều nhắm đúng tên entry mà regex lọc → không bắt được H-1b-1/2/3 (lỗi đặc tả vòng 1, không phải lỗi coder). |
| 4. `ExchangeRateEditor` | ĐÃ SỬA ĐÚNG | N-1 security vô hại: `res.error` là union mã cố định (`actions-master.ts:65-79`). |
| L-2 | ĐÃ LÀM | `validation.ts:282-283`. |

## Ba câu hỏi
1. Khớp kế hoạch: có, trừ H-1b.
2. Test có giá trị: có (biên maxRows/maxRows+1, 64/65 cột, thời gian trần, ca âm); thiếu ca bom ngoài tên entry được lọc.
3. Bảo mật/hiệu năng/đúng đắn: H-1b Cao còn mở; thiếu key i18n cho action nhật ký P2A (mục 2); giải nén 2 lần chấp nhận được
   (body ≤ 1MB, trần 20MB).

---

## CÁC MỤC PHẢI SỬA

### 1. [H-1b] Đo MỌI entry, cộng dồn, trần số entry — `src/server/daily-import.ts:56-101`
Giữ chữ ký `assertXlsxInflatedSize(buf: Buffer, limitBytes = 20 * 1024 * 1024): Promise<boolean>`:
- Thêm hằng export `XLSX_MAX_ENTRIES = 200` cạnh `SHEET_MAX_COLS` (`:10`).
- Sau `loadAsync` (`:65-68`): `const entries = Object.values(zip.files).filter((f) => !f.dir);`
  `if (entries.length > XLSX_MAX_ENTRIES) return false;`
- Xoá regex lọc `:70-72`; duyệt mọi `entries` (vấn đề `/` đầu tên tự hết).
- Chuyển `let total = 0` (`:76`) ra NGOÀI vòng `for` → một biến cộng dồn qua mọi entry. `on('data')`:
  `total += chunk.length; if (total > limitBytes) { stream.pause(); finish(false); }` (giữ `settled`, `error`→false, `end`→true).
- Sửa JSDoc `:57-61`: "đo tổng dung lượng sau giải nén của MỌI entry (exceljs giải nén tất cả), cộng dồn, trần số entry".

Test hồi quy trong `describe('assertXlsxInflatedSize (H-1b, chong zip bomb)')` ở `src/server/daily-import.test.ts`, dựng bằng
JSZip tay, `compression: 'DEFLATE'`:
- (a) Entry ngoài regex cũ: file mẫu `buildDailyTemplate` nạp lại bằng JSZip, thêm `xl/styles.xml` = `'A'.repeat(30*1024*1024)`
  (hoặc `docProps/app.xml`) → `assertXlsxInflatedSize` `false`, `readDailyWorkbook` `{ok:false,error:'bad_file'}`, `elapsed < 2000`.
- (b) Tên `/` đầu: `zip.file('/xl/worksheets/sheet1.xml', 'A'.repeat(30*1024*1024))` → `false`. Assert `Object.keys(zip.files)`
  sau `loadAsync` còn `/` đầu; nếu JSZip tự chuẩn hoá thì ghi chú và bỏ assert đó.
- (c) Cộng dồn: `limitBytes = 64*1024`, 5 entry `xl/worksheets/sheet{1..5}.xml` × `'A'.repeat(20*1024)` → `false` (code cũ trả
  `true` — test phân biệt). Đối chứng: 2 entry × 20KB → `true`.
- (d) Số entry: 201 entry nhỏ (`f${i}.txt` = `'x'`) → `false`; 50 entry → `true`.
- (e) Thời gian: trần mặc định, 3 entry × 15MB → `elapsed < 2000` (xác minh `stream.pause()` dừng thật).
- Tầng action trong `src/server/actions-import.test.ts`: file (a) qua `importExcelAction` → `{ ok:false, error:'Invalid file' }`, `< 2000ms`.
- Test `file mau buildDailyTemplate -> true` và `XLSX.write that -> import dung` (`actions-import-v2.test.ts`) phải vẫn xanh.

### 2. Thiếu key i18n cho action nhật ký hoạt động — `src/i18n/messages/vi.json:555-576`, `en.json:555-576`
`ActivityViewer.tsx:56` render `t(\`activity.${a.action}\`)`. Thiếu key cho action P2A: `save_exchange_rate`, `delete_exchange_rate`,
`save_factory`, `activate_factory`, `deactivate_factory` (`actions-master.ts`), `project_contractor_add`, `project_contractor_remove`,
`save_daily_resources`, `contractor_create`, `commit_daily_import` (`actions-entry.ts`); và 4 action cũ: `create_dim`, `rename_dim`,
`merge_dim`, `save_key_milestones`.
- Thêm vào CUỐI object `activity` (sau `delete_photo`, cả vi/en) — ngoại lệ có lý do với luật nhóm riêng vì viewer tra
  `activity.<action>`. Nhãn vi / en:
  `save_exchange_rate` "Lưu tỷ giá"/"Save exchange rate"; `delete_exchange_rate` "Xoá tỷ giá"/"Delete exchange rate";
  `save_factory` "Lưu khu vực sản xuất"/"Save factory"; `activate_factory` "Bật khu vực sản xuất"/"Activate factory";
  `deactivate_factory` "Tắt khu vực sản xuất"/"Deactivate factory"; `project_contractor_add` "Thêm nhà thầu vào dự án"/"Add contractor to project";
  `project_contractor_remove` "Gỡ nhà thầu khỏi dự án"/"Remove contractor from project"; `save_daily_resources` "Lưu nhân lực/thiết bị ngày"/"Save daily resources";
  `contractor_create` "Tạo nhà thầu"/"Create contractor"; `commit_daily_import` "Import nhân lực/thiết bị ngày"/"Commit daily import";
  `create_dim` "Tạo danh mục"/"Create dimension"; `rename_dim` "Đổi tên danh mục"/"Rename dimension";
  `merge_dim` "Gộp danh mục"/"Merge dimensions"; `save_key_milestones` "Lưu mốc chính"/"Save key milestones".
- Test hồi quy `src/i18n/messages.test.ts`: đọc đệ quy mọi `.ts` dưới `src/server/` (bỏ `*.test.ts`); mỗi match
  `/logActivity\(\s*\w+\s*,\s*([^,)]+)[,)]/g`, lấy mọi literal `/'([a-z_]+)'/g` trong nhóm 1 (bắt cả ternary). Assert mỗi action có
  `activity.<action>` trong CẢ vi và en. Assert tập thu được chứa `save_exchange_rate` và `activate_factory`.
- `admin.delete`: không bắt buộc vòng này (Để sau 14).

Cổng kiểm: `npx tsc --noEmit` sạch; `npm test` xanh (≥ 1157 + mới); build compile với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`.
Sau đó chạy lại security-reviewer (bắt buộc cho H-1b) rồi reviewer vòng 3.

---

## ĐỂ SAU (không chặn merge)
1. ~~L-2~~ đã làm.
2. L-3: `app/api/cron/[job]/route.ts:25`: `!secret || secret.length < 32` → 503; ghi `.env.example`.
3. L-5: `app/api/templates/daily-resources/route.ts:35`: làm sạch `masterCode` `/[^A-Za-z0-9._-]/g → '_'`.
4. L-1: `src/server/fx-rates.ts:21,63`: body ≤ 256KB; `1_000 < rate ≤ 1_000_000`; `redirect: 'error'`.
5. Hiệu năng: `runAlertEngineSafe(projectId)` gọi `listProjects()`/`getAssignments()` toàn bảng (`alert-engine.ts:33-35`).
6. `saveDailyResources` (`prisma-repo-entry.ts:108-190`): 2 ô trùng khoá → P2002 → 500; chặn ở `checkDailyPayload`.
7. `closeAlertAction` alertId không tồn tại → P2025 (có từ trước P2A); thêm `Not found` + test.
8. Test Prisma `insertEngineAlerts` nhánh P2002.
9. L-7: `xlsx` sang `devDependencies` (chỉ còn `actions-import-v2.test.ts` dùng).
10. L-6: KHÔNG sửa `migration.sql`. Trước deploy DB thật: `SELECT COUNT(*) FROM dim_project WHERE "currencyCode" IN ('AUD','SAR')` = 0.
11. `IMPORT_MAX_BYTES = 10MB` (`validation.ts:157`) lệch body 1MB thực tế; nếu nâng body thì xem lại trần H-1b.
12. L-4 (P3B): `secretHint` URL chỉ hiện host; `setAAD` theo id kênh.
13. Thử tay `.xlsx` xuất từ Excel/LibreOffice thật, tiêu đề tiếng Việt.
14. `admin.delete` (`DeleteProject.tsx:50`) thiếu từ trước P2A: bên merge sau thêm vào nhóm `admin`.
15. `ExchangeRateEditor.save/del` (`:48-73`): action throw → UI im lặng; bọc `try/catch` → `setRowErr(t('fxRates.err.invalid'))`.
16. `actions-entry.ts:230` `too_many_days` trùng `.max()` schema; giữ làm phòng thủ kép.

## Checklist merge P2A↔P2B (bên merge sau làm)
- `.bangiao/`: trước merge `main`, chuyển TOÀN BỘ file gốc `.bangiao/` (kể cả `ket-qua-test.md`, `test-screens/*.png` gồm `v2-*`)
  vào `.bangiao/archive/p2a-nhap-lieu-2026-09-24/`.
- `src/server/repo/mock-repo.ts` (cuối): giữ `export const repo = { ...coreRepo, ...makeEntryMockRepo(...) };` của A, RỒI
  `Object.assign(repo, createReadMock(getData));` của B.
- `src/server/audit-log-page.ts`: nhận bản B, bỏ `note: a.note` của A, thêm `note: a.note` vào mapper `readAuditLogPage` ở
  `read-prisma.ts` và `read-mock.ts`.
- `app/[locale]/(app)/admin/page.tsx`: gộp 2 hunk (B `readActivitySince`; A thay card factories/currencies).
- `vi.json`/`en.json`: giữ đủ nhóm cả hai sau `logPaging`. MỚI: A nối 14 key vào cuối object `activity`; nếu B cũng nối thì giữ cả
  hai; chạy `messages.test.ts` sau merge.
- Seed: lấy seed của A (`erp.ts`, `dims.ts`, `history.ts`).
- `schema-meta/docs.ts` (B): thêm `job_run`, `notify_channel`, `notify_recipient` + cột mới P2A, `npm run docs:erd`.
- `package.json`/`package-lock.json`: A thêm `jszip`; gộp tay nếu B đổi dependency, rồi `npm install --offline`.
- Sau merge: `npx prisma migrate deploy` trên DB B, `npx prisma generate`, tsc + `npm test`.
- Merge xong + CHỐT → A nhả khoá `schema.prisma`/`migrations` cho B làm Bước 11.

## CÂU HỎI CHO CHỦ DỰ ÁN
1. Form nhập `project_equipment_plan` (phien-B Q6): (a) mở Task 10 trong P2A, hay (b) để phase sau? Không chặn merge.
2. `jszip` đã thêm làm dependency trực tiếp (3.10.2 có sẵn qua exceljs). Xác nhận đồng ý?
3. Trần file Excel import: tổng sau giải nén 20MB, tối đa 200 entry. File có ảnh chèn nặng có thể bị từ chối. Đồng ý, hay hạ 10MB?
