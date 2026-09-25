PHAN QUYET: CHOT

# P2A — Nhập liệu mới — Đánh giá reviewer (chặng cuối, VÒNG 3)

> Điều phối viên lưu hộ từ báo cáo reviewer (vai chỉ đọc). Vòng 1 xem git `4872877:.bangiao/danh-gia.md`; vòng 2 (CAN SUA) xem
> `b3d1445:.bangiao/danh-gia.md`.

Nhánh `feature/p2a-nhap-lieu`, HEAD `b3d1445`, diff `4872877..HEAD` (`60aedc1` H-1b, `ff8bafe` i18n, `fd3557e` thay-doi,
`b3d1445` test v3). Skill: `ddc-tower:code-review`.

## Tự kiểm lại
- `npx tsc --noEmit` sạch; `npm test` 98/98 file, 1177/1177 xanh (58s).
- Diff `src/` chỉ đụng đúng 2 mục phải sửa (`daily-import.ts`, `vi.json`/`en.json` +14 key) + test. Không đụng `PROGRESS.md`,
  `.serena/memories/`, schema, migration, `package.json`.

## Đối chiếu 2 mục phải sửa vòng 2

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| 1. H-1b đo MỌI entry / cộng dồn / trần entry | ĐÃ SỬA ĐÚNG | `daily-import.ts:75` `filter((f) => !f.dir)`; `:76` trần 200 trước inflate; `:78` `total` ngoài vòng; `:91-95` cộng mọi chunk, vượt → `pause()` + `finish(false)`; `:10-11` `XLSX_MAX_ENTRIES`; JSDoc `:59-66` khớp. 2 đường gọi (`actions.ts:462`, `daily-import.ts:128`) không đổi. |
| 2. 14 key `activity.*` | ĐÃ SỬA ĐÚNG | `vi.json:575-589`, `en.json:575-589`; test quét `messages.test.ts:111-154`. Ngoài `src/server/` chỉ còn `src/lib/auth.ts:126` (`'login'`, có key). |

## Ba câu hỏi
1. Khớp kế hoạch: có, đúng từng gạch đầu dòng vòng 2.
2. Test có giá trị: có — ca (a)–(e) có đối chứng; tester dùng payload khác, red-green 6/9 rớt với code cũ, file `.xlsx` thật qua cả 2
   đường; test i18n bắt ternary + assert quét được ≥1 action. [nit] ngưỡng `< 2000ms` thời gian thực (~600ms đo được), theo dõi nếu CI chậm.
3. Bảo mật/hiệu năng/đúng đắn: H-1b đóng (security v3 DAT); đọc zip 2 lần chấp nhận được với body ≤ 1MB; không lỗi đúng đắn mới.

## Đánh giá N-2 — KHÔNG chặn merge
- Kịch bản: file ≤ 1MB, sheet XML ~20MB (~1 triệu ô) → `wb.xlsx.load` dựng toàn bộ Row/Cell trước khi `readBoundedSheet` chặn.
- Không chặn vì: cần vai `admin`/`data-entry` (`actions.ts:449`); khuếch đại có trần (~20MB XML/request), không lộ/hỏng dữ liệu;
  cần nhiều request đồng thời, để lại dấu phiên; giảm hẳn bậc so với H-1b trước vá; thiếu rate-limit là điểm yếu chung của app.
- Hạ `limitBytes` không chỉ là đổi hằng: 5000 dòng × 64 cột × ~35–40 byte/ô ≈ 11–13MB XML → 5MB có thể chặn nhầm file legacy hợp
  lệ ở mức trần. Phải đo file thật trước hoặc đặt trần riêng theo đường gọi. → Để sau 17.

---

## ĐỂ SAU (không chặn merge)
1. ~~L-2~~ đã làm.
2. L-3: `app/api/cron/[job]/route.ts:25`: `!secret || secret.length < 32` → 503; ghi `.env.example`.
3. L-5: `app/api/templates/daily-resources/route.ts:35`: làm sạch `masterCode` `/[^A-Za-z0-9._-]/g → '_'`.
4. L-1: `src/server/fx-rates.ts:21,63`: body ≤ 256KB; `1_000 < rate ≤ 1_000_000`; `redirect: 'error'`.
5. Hiệu năng: `runAlertEngineSafe(projectId)` gọi `listProjects()`/`getAssignments()` toàn bảng (`alert-engine.ts:33-35`).
6. `saveDailyResources` (`prisma-repo-entry.ts:108-190`): 2 ô trùng khoá → P2002 → 500; chặn ở `checkDailyPayload`.
7. `closeAlertAction` alertId không tồn tại → P2025 (có từ trước P2A); thêm `Not found` + test.
8. Test Prisma nhánh P2002 của `insertEngineAlerts`.
9. L-7: `xlsx` sang `devDependencies` (chỉ `actions-import-v2.test.ts` dùng).
10. L-6: KHÔNG sửa `migration.sql`. Trước deploy DB thật: `SELECT COUNT(*) FROM dim_project WHERE "currencyCode" IN ('AUD','SAR')` = 0.
11. `IMPORT_MAX_BYTES = 10MB` (`validation.ts:157`) lệch body 1MB thực tế; nếu nâng `serverActions.bodySizeLimit` xem lại H-1b và N-2.
12. L-4 (P3B): `secretHint` URL chỉ hiện host; `setAAD` theo id kênh.
13. Thử tay `.xlsx` xuất từ Excel/LibreOffice thật, tiêu đề tiếng Việt.
14. `admin.delete` (`DeleteProject.tsx:50`) thiếu từ trước P2A (MISSING_MESSAGE trên `/vi/admin`, `/en/admin`): bên merge sau thêm vào nhóm `admin`.
15. `ExchangeRateEditor.save/del` (`:48-73`): action throw → UI im lặng; `try/catch` → `setRowErr(t('fxRates.err.invalid'))`.
16. `actions-entry.ts:230` `too_many_days` trùng `.max()` schema; giữ làm phòng thủ kép.
17. **MỚI — N-2** (`src/server/daily-import.ts:67`, `limitBytes = 20MB`): (a) đo XML sau giải nén của file legacy lớn nhất hợp lệ và
    file mẫu nhập ngày 5000 dòng; (b) trần riêng theo đường: `readDailyWorkbook` (`:128`) ~5MB nếu số đo cho phép, `importExcelAction`
    (`actions.ts:462`) theo số đo, ≤ 20MB; (c) lâu dài `ExcelJS.stream.xlsx.WorkbookReader` dừng ở dòng 5001; (d) cân nhắc giới hạn
    đồng thời / rate-limit cho action import.
18. MỚI (nit): `messages.test.ts:111` chỉ quét `src/server/`; mở rộng nếu sau này gọi `logActivity` ở `src/lib/` hoặc `app/`.

## Checklist merge P2A↔P2B (bên merge sau làm)
- `.bangiao/`: trước merge `main`, chuyển TOÀN BỘ file gốc `.bangiao/` (`ke-hoach.md`, `thay-doi.md`, `ket-qua-test.md`,
  `danh-gia-bao-mat.md`, `danh-gia.md`, `test-screens/*.png` kể cả `v2-*`, `v3-*`) vào `.bangiao/archive/p2a-nhap-lieu-2026-09-24/`.
- `src/server/repo/mock-repo.ts` (cuối): giữ `export const repo = { ...coreRepo, ...makeEntryMockRepo(...) };` của A, RỒI
  `Object.assign(repo, createReadMock(getData));` của B.
- `src/server/audit-log-page.ts`: nhận bản B, bỏ `note: a.note` của A; thêm `note: a.note` vào mapper `readAuditLogPage` ở
  `read-prisma.ts` và `read-mock.ts`.
- `app/[locale]/(app)/admin/page.tsx`: gộp 2 hunk (B `readActivitySince`; A thay card factories/currencies).
- `vi.json`/`en.json`: giữ đủ nhóm cả hai sau `logPaging`; A nối 14 key cuối object `activity`, nếu B cũng nối thì giữ cả hai, không
  trùng key. Chạy `messages.test.ts` sau merge (bắt action mới của B nếu thiếu key).
- Seed: lấy seed của A (`erp.ts`, `dims.ts`, `history.ts`).
- `schema-meta/docs.ts` (B): thêm `job_run`, `notify_channel`, `notify_recipient` + cột mới P2A, `npm run docs:erd`.
- `package.json`/`package-lock.json`: A thêm `jszip`; gộp tay nếu B đổi dependency, rồi `npm install --offline`.
- Sau merge: `npx prisma migrate deploy` trên DB B, `npx prisma generate`, tsc + `npm test`.
- Merge xong + CHỐT → A nhả khoá `schema.prisma`/`migrations` cho B làm Bước 11.

## CÂU HỎI CHO CHỦ DỰ ÁN
1. Form nhập `project_equipment_plan` (phien-B Q6): (a) mở Task 10 trong P2A, hay (b) để phase sau? Không chặn merge.
2. `jszip` đã thêm làm dependency trực tiếp (3.10.2 có sẵn qua exceljs). Đồng ý?
3. Trần import: tổng sau giải nén 20MB, tối đa 200 entry. Giữ, hay hạ (N-2 đề xuất ~5MB cho file nhập ngày sau khi đo)? Làm ở phase sau.
4. MỚI: P2A đã CHỐT. Đồng ý merge `feature/p2a-nhap-lieu` vào `main` (CLAUDE.md mục 5)? Push chỉ khi được bảo.

## Kết luận
**CHỐT (vòng 3).** H-1b vá đúng cả 3 điểm, test có giá trị thật; 14 key `activity.*` đủ vi/en, có test hồi quy, đã kiểm UI thật;
tsc sạch, 1177/1177 xanh; security v3 DAT. N-2 không đủ nặng để chặn → Để sau 17. Trước merge chờ chủ dự án đồng ý (câu hỏi 4).
