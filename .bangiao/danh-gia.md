PHAN QUYET: CHOT

Skill đã dùng: `code-review`.

## (a) Code có khớp ke-hoach.md + quyết định đã chốt không — ĐẠT

- **Q1 (BOD đóng được alert)**: `src/server/actions.ts:329` — `const user = (await requireProject(alert?.projectId ?? -1)) ?? (await requireRole(['bod']))`. Admin + BOD đóng mọi alert; data-entry chỉ alert dự án mình PIC (qua `requireProject`); viewer/anonymous → `{ ok:false, error:'Forbidden' }`. Không đụng `requireProject`/`requireRole` gốc nên quyền ghi số liệu/ảnh không đổi. Đúng chốt (a).
- **Q2 (compliance = `Dang_trien_khai` thiếu fact tháng)**: `app/[locale]/(app)/compliance/page.tsx:26-32` — `getLatestFact(p.id, month)` + `deriveStatus` + `if (status !== 'Dang_trien_khai' || fact) return null`. Chỉ giữ dự án Đang triển khai VÀ không có fact tháng hiện tại. Đúng.
- **Sidebar**: `src/components/layout/AppShell.tsx:43-55` — `OPERATIONS_NAV` (admin+bod: report/alerts/compliance) + `ADMIN_NAV` (admin: audit/import/data-dictionary/data-schema/admin), bỏ `SYSTEM_NAV`; render 2 section chỉ khi mảng không rỗng. Đúng.
- **Quy ước mặc định Q3**: cột Mã DA = `currentAliasCode` (`report/page.tsx:89`); Backlog bảng = `FactFinancial.backlog` (`report.ts:41`); "cập nhật gần nhất" = `getLatestFact(p.id,'all')?.changedAt` (`compliance/page.tsx:34,41`). Đúng cả 3.
- **4 page + guard + i18n + report.ts + export route**: khớp ke-hoach.md từng mục (guard admin+bod; /audit chỉ admin; export route 403 cho sai role; i18n vi+en đủ key `nav.report/alerts/compliance/audit/operations/administration` + section `report/compliance/audit` + `alert.title/owner`).

## (b) Kiểm chứng có giá trị thật không — ĐẠT (đã tự chạy lại, không tin lời)

- `npx tsc --noEmit --incremental false` → **exit 0, 0 lỗi** (tôi tự chạy).
- `npx vitest run` → **237 passed / 20 file** (tôi tự chạy; khớp báo cáo 176 cũ + 61 mới).
- 6 file test mới tồn tại; `close-alert-role.test.ts` assert **side-effect thật** (`alert.closedAt` + audit log `changedBy`), không assert lên mock — có răng. RED evidence ở `ket-qua-test.md` §4 hợp lệ (teeth lần 1 invalid đã ghi rõ, không tính nhầm).
- `next build` EPERM do dev server giữ lock `.next` = lỗi môi trường, không chấm lỗi code.

## (c) Còn vấn đề chặn không — KHÔNG

- 4 LOW trong `danh-gia-bao-mat.md` đều nhỏ, không chặn: LOW-1 (thiếu zod validate `alertId`/`action`), LOW-2 (`alertId` rác → P2025 → 500; hành vi pre-existing cho admin, nay thêm BOD), LOW-3 (thiếu rate-limit, route cũ `/api/export` có), LOW-4 (`getUserRoles` trả `passwordHash` — server-side, không ra client). Đồng ý không chặn.
- HIGH pre-existing `/api/export` không auth: ngoài phạm vi dây chuyền này, đã ghi nhận riêng, không tính vào phán quyết.

## Quan sát không chặn (nit, không phải lỗi)

1. `src/components/alerts/AlertList.tsx:39` header cột loại alert dùng `t('common.status')` = "Trạng thái" trong khi ke-hoach.md §6 gọi cột này là "Loại"; nội dung là Red/Amber (loại, không phải trạng thái). Đã được `thay-doi.md` + `ket-qua-test.md` khai báo để Reviewer xác nhận — chấp nhận, đề xuất sau này thêm key `alert.type`.
2. `src/components/alerts/AlertList.tsx:22` hardcode action `'Đã xử lý'` (khớp kế hoạch §6, chỉ là chưa i18n).
3. N+1 query (`getLatestFact` theo từng dự án trong `report.ts:31` và `compliance/page.tsx:25`) — 17 dự án, không đáng kể; kế hoạch đã chọn pattern này.
4. `thay-doi.md` mô tả `canClose` lệch code (admin-only vs admin+bod) — code đúng Q1, chỉ lệch tài liệu.

Kết luận: không có lỗi chặn về bảo mật, hiệu năng, tính đúng đắn. Dây chuyền đạt.
