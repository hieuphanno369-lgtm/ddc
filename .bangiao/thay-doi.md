# Thay đổi: 4 trang nghiệp vụ mới + sidebar

Skill đã dùng: `coding-standards` (không đụng Prisma/DB, không thêm UI framework nên không gọi thêm skill khác).

Verify: `npx tsc --noEmit` → 0 lỗi. `npx vitest run` → 176 passed (không regression, không có test mới vì test suite chỉ gom `src/**/*.test.ts`).

## File TẠO MỚI

- `src/server/report.ts` — `getReportData(month)` dùng chung cho trang /report + export. Trả `{ kpis, p0Red, rows }`. `spi/cpi` làm tròn 2 số; `pctActual`/`backlog` fallback 0 khi thiếu fact/financial.
- `src/components/alerts/AlertList.tsx` — client, bảng alert đang mở + nút "Đóng" (busy state + `router.refresh()`), copy UX từ `AlertTab` trong `DataEntryForm.tsx`. Cột: Dự án | Loại | Quy tắc | Nội dung | Người phụ trách | Hạn xử lý | (Đóng). Rỗng → `overview.noAlerts`.
- `app/[locale]/(app)/report/page.tsx` — guard admin+bod. KPI grid 6 card + card P0-Red + bảng dự án (Mã DA | Tên | SPI | CPI | % TT | Backlog) + nút Xuất Excel trỏ `/api/report/export`.
- `app/[locale]/(app)/alerts/page.tsx` — guard admin+bod. `repo.getAlerts()` lọc `!closedAt`, nối `projectName` qua `listProjects()`.
- `app/[locale]/(app)/compliance/page.tsx` — guard admin+bod. Chỉ liệt kê dự án `Dang_trien_khai` VÀ thiếu fact `currentMonth` (khớp `getMissingMonth`). Cột: Dự án | Mã DA | PM (PIC) | Trạng thái | Cập nhật gần nhất.
- `app/[locale]/(app)/audit/page.tsx` — guard CHỈ admin. `repo.getAuditLog()`, cột Cũ → Mới, rỗng → `common.noData`.
- `app/api/report/export/route.ts` — ExcelJS 3 sheet (KPI / P0-Red / DanhSachDuAn), auth admin+bod (403 nếu sai), header fill `FF0A1F3D`.

## File SỬA

- `src/server/actions.ts` (Q1) — `closeAlertAction`: `requireProject(...) ?? requireRole(['bod'])`. Admin+bod đóng mọi alert; data-entry chỉ alert dự án mình PIC. KHÔNG đụng `requireProject`/`requireRole` gốc nên quyền ghi số liệu/ảnh không đổi.
- `src/components/icons/index.tsx` — thêm `IconReport`, `IconBell`, `IconChecklist`, `IconHistory` (section `// ---- Operations ----`, đúng style IconBase).
- `src/components/layout/AppShell.tsx` — bỏ `SYSTEM_NAV`; thêm `OPERATIONS_NAV` (admin+bod: report/alerts/compliance) + `ADMIN_NAV` (admin: audit/import/data-dictionary/data-schema/admin). Render 2 section "Vận hành"/"Quản trị"; bỏ section "Hệ thống".
- `src/i18n/messages/vi.json` + `en.json` — thêm nav `report/alerts/compliance/audit/operations/administration` (giữ `nav.system`), 2 key `alert.title`/`alert.owner`, 3 section mới `report`/`compliance`/`audit`.

## Chỗ Tester nên soi kỹ

1. **Q1 `closeAlertAction` trên 4 vai trò**: admin đóng được (giữ nguyên); BOD đóng được (MỚI); data-entry PIC dự án đóng được; data-entry KHÔNG phải PIC → Forbidden; viewer → Forbidden. Alert không tồn tại (`alertId` rác): admin/bod vẫn đóng được (không có guard alert tồn tại — giữ nguyên hành vi cũ), data-entry → Forbidden vì projectId -1.
2. **Sidebar theo role**: bod chỉ thấy nhóm Vận hành, KHÔNG thấy nhóm Quản trị; viewer/data-entry không thấy cả 2 nhóm (nhóm ẩn khi mảng rỗng); admin thấy cả 2. Nhóm "Hệ thống" cũ đã biến mất.
3. **Guard 4 trang**: chưa login → `/login`; sai role → `homeForRole`; /audit chỉ admin (bod bị đá về /overview). Export route trả 403 với viewer/data-entry/chưa login.
4. **i18n**: mọi key mới có ở cả vi+en (đã validate JSON). Cột "Loại" ở AlertList dùng lại `common.status` (kế hoạch không cấp key riêng `alert.type`) — xác nhận wording chấp nhận được.
5. **Biên dữ liệu**: dự án không có fact tháng này (report: pctActual 0, SPI/CPI '-'; compliance: xuất hiện trong danh sách); P0-Red rỗng; alert rỗng; audit rỗng (seed `auditLog: []`); compliance rỗng → `compliance.empty`.
6. **Excel export**: mở file kiểm 3 sheet + header đậm nền navy; `spi/cpi` null ra ô rỗng.
7. **Bảng có `min-w-[980px]` + `table-zebra`**, card frosted, `formatPct/formatTyd/formatDate/formatDateTime` truyền `locale` — khớp brand redesign.

## Không đụng (đúng phạm vi)

`middleware`, `queries.ts`, `cache.ts`, `prisma-repo.ts`, `app/api/export/route.ts`, UI brand sidebar. TODO backlog 2 định nghĩa ở queries.ts:177 giữ nguyên.
