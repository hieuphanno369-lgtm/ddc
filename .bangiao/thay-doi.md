# P1A — Thay đổi (chặng CODER)

Nhánh `feature/p1a-du-lieu-dung`, từ `main` @ `01e82cf`. 11/11 Task hoàn thành, không lệch kế hoạch,
không có việc dở. Cổng kiểm cuối (Task 11): `tsc --noEmit` sạch, `npm test` **808/808 xanh** (63 file),
`npm run build` (với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) xanh, `prisma migrate status` → "Database schema
is up to date".

## Danh sách commit theo Task

1. `15cafd4` **Task 1** — migration gộp: `dim_shift`, `dim_date`, `dim_project.factoryId`/`contractValueOriginal`,
   `fact_daily_manpower.shiftCode`, `project_equipment_plan`, index audit_log/alert_log. File: `prisma/schema.prisma`,
   `prisma/migrations/20260924090000_p1a_data_foundation/migration.sql`, `prisma/rollback/*.down.sql`,
   `src/server/repo/types.ts`, `src/lib/shifts.ts` (+test), `src/data/seed/erp.ts`, `src/data/seed/history.ts` (+test),
   `src/server/repo/{prisma-repo,mock-repo}.ts`, `prisma/seed.ts`.
2. `1dd64f2` **Task 2** — seed 6 dòng kế hoạch thiết bị (Gantt T14): `equipmentPlanSeed` trong `erp.ts`,
   `RepoData.equipmentPlans`, `prisma/seed.ts` (createMany + syncSequences), test trong `history.test.ts`.
3. `b0f71b9` **Task 3** — `saveMonthlyFact`/`saveFinancial` (prisma-repo + mock-repo) trả `SaveFactResult`
   (`'created' | 'updated' | 'not_found'`); tháng chưa có dòng → tự tạo carry-forward từ tháng gần nhất trước đó;
   `actions.ts saveMonthlyData` kiểm dự án tồn tại + bắt `'not_found'`. Test: `dim.test.ts`, `actions.test.ts`,
   `prisma-repo-save.test.ts` (mock `@/server/db`).
4. `2594a7d` **Task 4** — import Excel báo lỗi rõ từng dòng thay vì bỏ qua im lặng: `ImportRow` có `rowNo`/`reason`,
   `importExcelAction` phân loại `no_sap`/`no_pct`/`bad_pct`/`not_assigned`; `repo.importMonthlyFacts` trả
   `{ imported, failed[] }`; `commitImportAction` trả `failed[]` thay `skipped`. UI `ImportPanel.tsx` hiện cột "Dòng"
   + badge lỗi + danh sách dòng thất bại. i18n nhóm `dataGuard.import`. Test: `actions-import.test.ts` (mới),
   `valuechain.test.ts` (sửa `n` → `.imported` + thêm case dự án mới).
5. `04f8d6e` **Task 5** — `src/components/form/dataEntryState.ts` (hàm thuần, không React): `buildBaseForm`,
   `stageInputsOf`, `formsEqual`, `buildSavePatch` (chỉ gửi field khác base), bản nháp có dấu phiên bản
   (`draftKey`/`legacyDraftKey`/`makeStamp`/`checkDraft`/`restoreDraft`), `saveErrorKind`. 32 test trong
   `dataEntryState.test.ts`. **Chưa đụng `DataEntryForm.tsx`** ở Task này (đúng bản đồ file).
6. `62ae8ca` **Task 6** — nối `DataEntryForm.tsx` với `dataEntryState`: xoá `loadDraft`/`chainDirty`, banner
   nháp (`Khôi phục`/`Bỏ`, cảnh báo "stale"), lỗi lưu hiện rõ (`sumbar bad` + `dataGuard.save.*`), bước Tài chính
   chỉ xem khi `!canEditFinance`. `nhap-lieu/page.tsx` truyền `canEditFinance`. i18n `dataGuard.draft`/`dataGuard.save`.
   Test thêm 1 case trong `actions-security.test.ts`.
7. `371d056` **Task 7** — `/api/export` bắt đăng nhập (401 chưa login, 403 role sai, chỉ admin/bod) + `safeCell`
   chống chèn công thức Excel (`src/lib/excel-safe.ts`) áp cho cả `/api/export` và `/api/report/export`.
   Test: `excel-safe.test.ts`, `export-route.test.ts` (mới).
8. `5ef40ac` **Task 8** — fail-closed: `src/lib/env.ts` (`requireAuthSecret`, throw rõ khi thiếu/rỗng
   `NEXTAUTH_SECRET`), `auth.ts` secret đổi thành getter (nổ lúc dùng, không nổ lúc import), bỏ hẳn fallback
   `'ddc-local-dev-secret'`; `canViewFinance` mặc định `?? false` ở `auth.ts` + `projects/[id]/page.tsx` dòng 64;
   `middleware.ts` trả 500 rõ khi thiếu secret. Test: `env.test.ts`, `auth-session.test.ts`, `middleware-secret.test.ts`.
9. `08b58ec` **Task 9** — `src/server/authz.ts` thêm `canWriteProject`; `src/server/photo-service.ts` (logic dùng
   chung `addPhotoAction` ⟷ route mới); `app/api/photo-upload/route.ts` (POST, chặn CSRF qua `src/lib/same-origin.ts`,
   401/403 rõ ràng). Test: `same-origin.test.ts`, `photo-upload-route.test.ts` (dùng project id 7/990099 để tránh
   đụng file thật của `actions.test.ts` chạy song song).
10. `6b32e9b` **Task 10** — `src/lib/photo-upload.ts` (`precheckPhotos`, `overallPercent`, hàm thuần), icon
    `IconCloudUpload`, `src/components/form/PhotoDropzone.tsx` (kéo-thả + XHR đo tiến trình, thay thế `<label>` +
    `uploadPhotos`/`photoBusy`/`photoErr` cũ trong `DataEntryForm.tsx`). i18n `dataGuard.photo`.
    Test: `photo-upload.test.ts`.
11. Task 11 (chặng này) — chỉ chạy cổng kiểm, không sửa code; commit `.bangiao/` cùng chặng này.

## Migration + hồi phục đã chạy (Task 1, trên DB `ddc_control_tower`, localhost:5433)

- `npx prisma migrate deploy` → áp `20260924090000_p1a_data_foundation` thành công.
- Trước/sau: tổng `SUM(plannedHeadcount)`/`SUM(actualHeadcount)` của `fact_daily_manpower` không đổi
  (3392 / 3168, 42 dòng); mọi dòng cũ có `shiftCode = 'morning'`; `dim_project.factoryId` backfill đủ cho cả
  17 dự án (0 dòng NULL, vì cả 17 dự án đều có `fact_volume`).
- `npx prisma migrate diff` sau deploy → rỗng (không còn dòng `DROP INDEX ux_fact_*_latest` dương tính giả nào).
- Thử hồi phục 1 vòng: `npx prisma db execute --file prisma/rollback/20260924090000_p1a_data_foundation.down.sql`
  → tổng nhân lực vẫn khớp (3392/3168, 42 dòng, gộp lại đúng) → `npx prisma migrate deploy` lại → `npx prisma db seed`
  xanh (6 dòng `project_equipment_plan`, seed lại 17 dự án + shift + factoryId đúng).

## Lệch khỏi kế hoạch

Không có lệch đáng kể. 1 điều chỉnh kỹ thuật trong lúc làm (không đổi hành vi/kế hoạch):
`src/server/photo-upload-route.test.ts` dùng project id **7** (PIC) + **990099** (giả, không ai được gán) thay vì
1/4 như *actions.test.ts* — vì cả 2 file test đều ghi file thật vào `data/uploads/<projectId>/...` và chạy song
song (Vitest nhiều worker); dùng chung id 1/4 gây `afterAll` (rmSync) của file này xoá nhầm thư mục file kia đang
dùng, test flaky ngẫu nhiên khi chạy `npm test` toàn bộ (không xảy ra khi chạy riêng file). Đã xác minh chạy lại
`npm test` toàn bộ 2 lần liên tiếp xanh sau khi đổi id.

## Việc còn dở

Không có. Task 1–11 đã xong, cổng kiểm cuối phase xanh, không còn TODO nào của P1A.

## Tester nên soi kỹ

- **Migration + hồi phục** (Task 1): thử tự chạy lại `migrate deploy` → rollback → `migrate deploy` → `db seed`
  trên bản sao DB riêng nếu muốn, đối chiếu số liệu nhân lực trước/sau như trong `.bangiao` này.
- **Task 3 carry-forward**: lưu 1 tháng hoàn toàn mới (dự án tạo bằng "Tạo dự án mới") và 1 tháng giữa chừng của
  dự án có sẵn (vd `2026-10` — chưa có dòng) để chắc %TT/luỹ kế không tự về 0.
- **Task 4 import**: thử 1 file có dòng thiếu SAP, % chữ, % trống, và 1 dòng dự án data-entry không được gán —
  xem đúng lý do hiện ra, không silent-skip.
- **Task 6 draft**: sửa 1 field không lưu, F5 lại xem banner nháp bật đúng, bấm Khôi phục/Bỏ đúng hành vi; đổi
  liệu ở tab khác (giả lập version khác) rồi F5 xem có cảnh báo "stale" không.
- **Task 7 bảo mật**: gọi `/api/export` không cookie → 401; role sai → 403; tên dự án có ký tự `=`/`+`/`-`/`@`
  ở đầu → mở file Excel xem ô có tiền tố `'` (Excel hiện dạng text, không chạy công thức).
- **Task 8**: xoá tạm `NEXTAUTH_SECRET` trong `.env`, restart dev, xem app trả 500 rõ ràng (không phải RBAC ngầm
  chạy sai) — nhớ set lại secret sau khi test xong.
- **Task 9/10 upload ảnh**: kéo nhiều ảnh + 1 file không phải ảnh vào vùng thả cùng lúc, xem từng dòng lỗi riêng,
  các ảnh hợp lệ vẫn tải xong (không bị chặn bởi file lỗi đứng trước); thử POST thẳng vào `/api/photo-upload`
  bằng công cụ khác origin (Postman/curl có header `Origin` khác) để xác nhận 403 CSRF.
- File `app/[locale]/(app)/projects/[id]/page.tsx` chỉ đổi đúng 1 dòng (`?? true` → `?? false`) — soát diff để
  chắc không đụng chỗ khác (P1B đang sửa file này song song).
