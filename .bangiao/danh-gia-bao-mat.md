PHÁN QUYẾT BẢO MẬT: ĐẠT

# Đánh giá bảo mật P2B (nhánh feature/p2b-bieu-do, diff 10cda5a..HEAD)

> Nội dung do subagent security-reviewer (vai chỉ đọc) trả về; điều phối viên lưu nguyên văn vào file này.

Skill đã dùng: `ddc-tower:security-review`. Chỉ soi tĩnh, không chạy DB. Không có phát hiện mức cao hay trung bình trong phạm vi P2B. Có 3 phát hiện mức thấp, đều ở script dev, và 3 ghi chú về lỗi có từ trước (không tính vào phán quyết).

## 1. SQL thô — ĐẠT
- Mọi `$queryRaw`/`$executeRaw` trong `src/server/repo/read-prisma.ts` và `scripts/perf/seed-perf.ts` đều đi qua `Prisma.sql` dạng tagged template. Không có `$queryRawUnsafe`, `$executeRawUnsafe` hay `Prisma.raw`, không nối chuỗi.
- `readMonthlyEvm` (read-prisma.ts:121-131): mảng truyền qua `ANY(${months}::text[])` / `ANY(${projectIds}::int[])`, là tham số bind. `months` lấy từ `historyMonths()`, không từ URL.
- `readFactSnapshots`/`readFinancialSnapshots`/`readVolumeSnapshots`: nhánh `DISTINCT ON` chỉ chạy khi giá trị đúng bằng `'all'` và không có tham số. Giá trị khác đi vào `findMany({ where: { yearMonth } })`, đã được tham số hoá.
- `readEquipmentUsageDays` (dòng 71-78): `from`/`to` lấy từ plan trong DB, bind rồi ép `::date`.
- `projectId` trang Chi tiết: `Number(params.id)`, rồi `requireProjectRead` (page.tsx:78) chạy trước mọi lệnh đọc.
- `month` trang Chi tiết đã validate bằng `isValidYearMonth`. Riêng `month` ở /overview không validate (xem ghi chú N-2), nhưng vẫn là tham số bind nên không injection được.

## 2. Phân quyền — ĐẠT
- `/data-schema`, `/data-dictionary`, `/admin`, `/audit` vẫn giữ `getCurrentUser()`, redirect login, và kiểm `role !== 'admin'` (data-schema/page.tsx:27-31, data-dictionary/page.tsx:15-20, admin/page.tsx:18-22, audit/page.tsx:16-20).
- `audit-log-page.ts` chuyển sang `repo.readAuditLogPage` chỉ là chuyển nguyên thân hàm. Quyền được kiểm ở trang gọi và không mất. Vẫn kẹp `page` vào [1, totalPages] (read-prisma.ts:156-158).
- Trang Chi tiết: gom vào `Promise.all` không bỏ `requireProjectRead` (vẫn gọi trước, dòng 78). Phần hiển thị tài chính vẫn gated bằng `canViewFinance` (dòng 394, 419).
- Aggregate mới: `readMonthlyEvm` lọc theo `ids` đã scope qua `getScopedProjectIds`, giống logic cũ. S-curve ở /overview vẫn nằm trong khối `canViewFinance &&` (overview/page.tsx:110-119).
- `getShiftChartData`, `getWeeklyChartData`, `getEquipmentGantt` không tự kiểm quyền (có ghi chú trong file), chỉ được gọi từ trang đã `requireProjectRead`.
- Cache: không thêm/sửa `unstable_cache` (`src/server/cache.ts` không đổi). `Object.assign(prismaRepo, readRepoPrisma)` là singleton không chứa trạng thái theo user.

## 3. Script seed/perf — ĐẠT, có 3 phát hiện thấp
- `assertPerfDb(current_database())` gọi ở seed-perf.ts:28, trước mọi DELETE/INSERT, kể cả `--clean-only`. So sánh tên DB tuyệt đối (perf-guard.ts:13-14). DB của A (`ddc_control_tower`) bị chặn.
- Không có credential cứng: `measure-pages.ts` đọc `PERF_EMAIL`/`PERF_PASSWORD` từ env. `.env` nằm trong `.gitignore`.
- `bench-data.ts` và `check-read-parity.ts` chỉ đọc.

**L-1 (thấp): chốt chặn chỉ kiểm tên DB, không kiểm host.** `src/lib/perf-guard.ts:13-20`, `scripts/perf/seed-perf.ts:24-28`.
- Nếu `DATABASE_URL` trỏ tới server khác có DB cùng tên `ddc_control_tower_b`, script vẫn DELETE/INSERT 10 triệu dòng + `ANALYZE` (dòng 259).
- Vá: kiểm thêm `inet_server_addr()` loopback hoặc host `localhost`/`127.0.0.1`, và bắt buộc env `PERF_CONFIRM=ddc_control_tower_b`.

**L-2 (thấp): lệnh dọn xoá theo tiền tố `masterCode` và cascade.** `scripts/perf/seed-perf.ts:32-33`.
- `DELETE FROM dim_project WHERE masterCode LIKE 'PERF-%'`, fact đều cascade. Dự án thật có mã bắt đầu `PERF-` sẽ bị xoá. Dòng 33 xoá audit_log `changedBy='perf-seed'` (sửa dấu vết kiểm toán). Hiện chỉ ảnh hưởng DB dev của B.
- Vá: thêm điều kiện `AND "createdBy" = ${PERF_USER}`; cân nhắc chặn tiền tố `PERF-` trong form tạo dự án.

**L-3 (thấp): `PERF_BASE` gửi mật khẩu admin tới bất kỳ URL nào.** `scripts/perf/measure-pages.ts:12, 41-52`.
- Vá: chỉ cho phép host `localhost`/`127.0.0.1` trừ khi có cờ cho phép rõ ràng.

## 4. T4 schema-meta/ERD — ĐẠT
- `buildSchemaMeta(Prisma.dmmf.datamodel)` chỉ lộ tên bảng/cột/kiểu. Cột `passwordHash` (docs.ts:450) xuất hiện trên /data-schema, /data-dictionary nhưng 2 trang chỉ dành cho admin (bản cũ `SCHEMA_ENTITIES` cũng có).
- `scripts/gen-erd-doc.ts:20,32`: đường dẫn ghi cố định, chỉ thay đoạn giữa 2 dấu mốc.

## 5. XSS chart/Gantt — ĐẠT
- Diff P2B không thêm `dangerouslySetInnerHTML`.
- `EquipmentGantt.tsx`: nhãn render dạng text node React trong SVG `<text>`; màu từ palette/biến CSS cố định (equipment-gantt.ts:94,115-117).
- `WeeklyManpowerStackChart.tsx`, `ShiftManpowerChart.tsx`: tên nhà thầu/ca qua prop Recharts + tooltip JSX, được escape.

## 6. Ghi chú có từ trước (không tính vào phán quyết P2B)
- **N-1 (cao, đã biết từ P1A):** `next@14.2.35` dính RCE khi host Windows — chờ chủ dự án quyết nâng cấp.
- **N-2 (thấp):** `app/[locale]/(app)/overview/page.tsx:50` — `month` không qua `isValidYearMonth`; giá trị rác tạo thêm key `unstable_cache` (phình cache). Vá: validate như trang Chi tiết.
- **N-3 (trung bình, thiết kế cũ):** "Lượng & Trị" (`revenuePeriod`, queries.ts:254) và S-curve/WhatIf trang Chi tiết (pv/ev/ac/bac, page.tsx:127, 341) vẫn hiện cho người không có `canViewFinance`. Chủ dự án cần quyết pv/ev/ac và doanh thu có tính là "tài chính" không.
- `getProjectSummary` (queries.ts) vẫn còn TODO BOLA, hiện được che vì trang gọi `requireProjectRead` trước.

## Kết luận
ĐẠT. Nên vá L-1 và L-2 trước lần chạy `perf:seed` tiếp theo; L-3 tuỳ chọn. Không có mục nào chặn merge.
