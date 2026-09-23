# Đánh giá bảo mật — Đợt 2 (khớp mock-up 100%)

Phạm vi: `git diff main...HEAD` trên `feature/apple-glass-mock-parity` (10 commit `feat(parity):` 8438794→719b6bd + `fix(parity):` 8da0486).
Skill: `ddc-tower:security-review`. Soi white-box + `mcp__postgres` chỉ đọc (schema `project_key_milestone`, `audit_log`).

**PHAN QUYET BAO MAT: DAT** (PASS — không có CRITICAL/HIGH/MEDIUM)

## Đã kiểm, không có lỗ hổng
- **Quyền ghi mốc chính:** `saveKeyMilestonesAction` (`src/server/actions.ts:222-231`) gọi `requireProject(projectId)` (admin mọi dự án; data-entry chỉ dự án trong `project_assignments`; viewer/BOD bị chặn), giống `saveMonthlyData`. Kiểm quyền trước zod; zod bắt số nguyên dương; action kiểm dự án tồn tại. Không IDOR.
- **Tạo dự án kèm mốc:** `createProjectAction` yêu cầu admin/data-entry; mốc gắn vào `p.id` do server tạo.
- **Xoá/thay mốc:** `deleteMany({ where: { projectId } })` + `createMany` cùng `$transaction` (`src/server/repo/prisma-repo.ts:949-967`).
- **Mass assignment:** chỉ ánh xạ `name`, `plannedDate`, `actualDate`; `sortOrder` theo thứ tự mảng; `id`/`projectId` do server gán.
- **Validate:** tên trim, 1–160 ký tự; ngày YYYY-MM-DD + round-trip `isValidIsoDate`; tối đa 50 dòng.
- **Rò dữ liệu chéo dự án:** `getResourceBreakdown`, `getWeeklyTracking`, `getWorkItemComparison`, `getStageMilestones` đều lọc `projectId`; `getContractors()`/`getEquipments()` là danh mục chung chỉ tra tên. Trang chi tiết gọi `requireProjectRead` trước mọi lần đọc; `/nhap-lieu` lọc theo assignment, middleware chặn viewer/BOD.
- **SQL injection:** không có `$queryRaw`/`$executeRaw` mới.
- **XSS:** không có `dangerouslySetInnerHTML` mới; `ChartTip.tsx` render JSX text qua `createPortal`; tên mốc/nhà thầu trong `<text>` SVG được React escape; màu từ hằng/biến CSS; `searchParams.step` so whitelist `STEPS`.
- **`clockOffsetMs` / `DDC_FAKE_TODAY`:** client chỉ nhận `appToday` đã tính; không gửi ngày lên server; `clock.ts:38-49` bỏ override khi `NODE_ENV=production`.
- **CSRF:** server action Next có kiểm Origin sẵn.

## Phát hiện

### L-1 (LOW) — nút "Sửa mốc" hiện cho người không có quyền ghi
`app/[locale]/(app)/projects/[id]/page.tsx` — `const canEditMs = user?.role === 'admin' || user?.role === 'data-entry';` không kiểm assignment. Hiện chỉ lệch UI (server vẫn chặn). Vá: tính theo cùng logic `requireProject`.

### L-2 (LOW) — tạo dự án và ghi mốc không cùng transaction
`src/server/actions.ts`, `createProjectAction`: `if (keyMilestones?.length) await repo.replaceKeyMilestones(...)`. Nếu ghi mốc lỗi, dự án đã tạo nhưng không có mốc; bấm lại có thể sinh dự án trùng. Vá: gộp `prisma.$transaction`, hoặc trả `{ ok: false }` kèm `id` đã tạo.

### L-3 (LOW) — audit log mốc có thể nhập nhằng
`src/lib/key-milestones.ts:9-11` (`keyMsAuditText`) nối bằng `|` và `; ` trong khi tên mốc được chứa các ký tự này → dòng audit đọc sai. Vá: `JSON.stringify(rows)` hoặc escape.

### I-1 (INFO) — `before` đọc ngoài transaction
`src/server/repo/prisma-repo.ts:950`: khi lưu đồng thời, `oldValue` trong audit có thể lệch. Không mất dữ liệu.

### I-2 (INFO) — không rate-limit `saveKeyMilestonesAction`
Khoảng trống chung của mọi server action, có từ trước.

### I-3 (INFO) — mọi assignment đều ghi được, không chỉ PIC
`requireProject` (`src/server/actions.ts:27-33`) cho cả vai trò Backup ghi, trong khi comment ghi "data-entry là PIC". Giống `saveMonthlyData`, không phải hồi quy. Chủ dự án cần xác nhận Backup có được ghi hay không.

## Kết luận
PASS. 3 LOW + 3 INFO, vá sau được, không chặn merge.

*(Agent security-reviewer không có công cụ ghi file; điều phối viên chép lại nguyên văn nội dung báo cáo.)*


**Cập nhật 2026-09-23 — I-3 đã chốt:** chủ dự án chọn (a) — Backup ĐƯỢC ghi (giữ logic `requireProject` theo assignment). Chỉ sửa comment trong `src/server/actions.ts` cho khớp.
