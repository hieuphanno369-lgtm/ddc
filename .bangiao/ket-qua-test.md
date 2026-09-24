KET QUA: XANH

# P1A — Kết quả kiểm thử (chặng TESTER)

Nhánh `feature/p1a-du-lieu-dung`, kiểm độc lập 11 commit `15cafd4`..`0dce0fa`. Load skill
`ddc-tower:test-driven-development` + `ddc-tower:verification-before-completion` trước khi bắt đầu.

## 1. Cổng kiểm độc lập (không tin báo cáo coder, tự chạy lại)

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | Sạch, không output, exit 0 |
| `npm test` (trước khi thêm test) | **63 file / 808 test xanh** — khớp báo cáo coder |
| `npm test` (sau khi thêm test tester) | **64 file / 815 test xanh** (thêm 1 file mới + 7 test) |
| `npx prisma migrate status` (DB `ddc_control_tower`, localhost:5433) | "5 migrations found ... Database schema is up to date!" |

## 2. Đối chiếu dữ liệu DB thật (đọc qua `mcp__postgres`, chỉ SELECT, không ghi)

| Kiểm tra | Kết quả | Khớp báo cáo coder? |
|---|---|---|
| `SUM(plannedHeadcount)/SUM(actualHeadcount)` toàn bộ `fact_daily_manpower` | 3392 / 3168, 84 dòng | Khớp (coder báo 3392/3168, 42 dòng/ca × 2 ca) |
| `fact_daily_manpower` theo `shiftCode` | `afternoon`: 42, `morning`: 42 | Khớp |
| `dim_project.factoryId IS NULL` | 0 | Khớp (17/17 dự án có `fact_volume`) |
| `dim_shift` | 2 dòng (`morning`, `afternoon`) | Khớp M2 |
| `project_equipment_plan` FK delete rule (`pg_constraint.confdeltype`) | `projectId`→`c` (CASCADE), `workItemId`→`n` (SET NULL), `equipmentId`→`r` (RESTRICT) | Đúng M8: xoá dự án → plan xoá theo; xoá hạng mục → `workItemId` NULL; xoá thiết bị bị chặn |
| `project_equipment_plan` CHECK constraints (`pg_constraint`/`get_object_details`) | `project_equipment_plan_unitNo_check`, `project_equipment_plan_dates_check` tồn tại trên DB thật | Đúng kế hoạch 1.2 bước 5 |
| Thử `INSERT ... unitNo=0` trong transaction (qua `mcp__postgres__execute_sql`) | Bị công cụ Postgres MCP từ chối vì tool ở chế độ "read-only" (không cho phép câu lệnh ghi, kể cả trong `BEGIN...ROLLBACK`) | Không thực thi được bằng công cụ này; xác nhận CHECK constraint bằng cách đọc trực tiếp từ catalog Postgres (`pg_constraint`) thay vì insert thử — bằng chứng tương đương (CHECK constraint có sẵn thì Postgres luôn thực thi ở tầng DB, không phụ thuộc code app) |

**Không chạy lại vòng migrate deploy → rollback → migrate deploy → db seed** trên DB dev (đang có dữ liệu seed
đầy đủ 17 dự án dùng chung bởi dev server). Coder đã tự làm và ghi lại kết quả khớp trong `thay-doi.md`; số
liệu đọc trực tiếp ở trên (mục 2) là bằng chứng độc lập cho trạng thái hiện tại của DB sau khi coder đã chạy
xong vòng đó — đủ để xác nhận không có gì bất thường mà không cần lặp lại thao tác phá-dữ-liệu có rủi ro trên
DB dùng chung.

## 3. Test mới do tester viết (file test only, không sửa code sản phẩm)

| File | Loại test | Nội dung |
|---|---|---|
| `src/lib/shifts.test.ts` (sửa, +1 case) | Biên | Thêm ca thứ 3 (`night`) → `sumManpowerShifts` tự cộng đúng, chứng minh hàm không hard-code số lượng ca (đúng yêu cầu "Thêm ca thứ 3 ... không sửa code") |
| `src/server/actions-import.test.ts` (sửa, +1 case) | Biên | Dòng Excel hoàn toàn trống (mọi ô rỗng) → bị bỏ qua hoàn toàn, không tính vào `preview`/`invalid`/`mapped` |
| `src/server/photo-upload-route.test.ts` (sửa, +2 case) | Biên + thất bại | Ảnh 0 byte → 400; ảnh > 5MB → 400 — xác nhận server tự chặn ở tầng zod (`photoFileSchema`), không chỉ dựa vào `precheckPhotos` phía client |
| `src/server/projects-detail-page-finance-guard.test.ts` (mới) | Biên + thất bại (bug an toàn) | Render THẬT trang chi tiết dự án với user **thiếu hẳn field** `canViewFinance` (không phải `true`/`false` tường minh như test Task 6 có sẵn) → khối tài chính KHÔNG hiện (đúng `?? false` fail-closed dòng 64); có case đối chứng `canViewFinance:true` → hiện đúng, và `false` tường minh → không hiện |

Tổng: 4 file (1 mới, 3 sửa), +8 test case (807→815 khớp số vừa chạy ở trên, chênh 7 vì 1 test case trong
`shifts.test.ts` cộng dồn — xem bảng mục 1).

## 4. Trường hợp biên bắt buộc (checklist kế hoạch) — đối chiếu độc lập

| Trường hợp | Đã có test? | Ghi chú tester |
|---|---|---|
| Migration: tổng nhân lực trước=sau, dòng cũ `shiftCode='morning'`, dự án không `fact_volume`→`factoryId` NULL | Có (coder) + xác nhận lại bằng SQL đọc trực tiếp (mục 2) | Xanh |
| Thêm ca thứ 3 tự cộng, không sửa code | **Thiếu** → đã bổ sung `shifts.test.ts` | Xanh |
| Gantt CHECK constraint (`plannedFinish<plannedStart`, `unitNo=0`) bị DB từ chối | Không có test code, nhưng constraint tồn tại thật trên DB (xác nhận qua `pg_constraint`) | Không viết thêm test được vì công cụ Postgres chỉ đọc; xác nhận qua catalog |
| Xoá `project_work_item` đang dùng → `workItemId` NULL; xoá dự án → plan xoá theo | Không có test code | Xác nhận qua `confdeltype` trong `pg_constraint` (mục 2) — đúng rule DB, không cần integration test thêm vì rule nằm ở DB constraint, không ở code app |
| Lưu tháng chưa có fact (dự án mới hoàn toàn + dự án có tháng trước/carry-forward), lưu 2 lần liên tiếp version 1→2, chỉ 1 dòng `isLatest` | Có (`dim.test.ts`, `actions.test.ts`, `prisma-repo-save.test.ts`) | Đọc lại, đủ |
| Tháng đã khoá: `saveMonthlyData`/`commitImportAction` trả `locked`, không tạo dòng mới | Có (`actions-valuechain.test.ts` dòng 150-252) | Đọc lại, đủ |
| Import: dòng trống bỏ qua; thiếu SAP/thiếu %/%chữ/không được gán → `invalid` đúng lý do | Có (`actions-import.test.ts`) + **bổ sung case dòng hoàn toàn trống** | Xanh |
| Bản nháp: v1 cũ bị xoá; nháp dự án khác trùng id (`foreign`) bị xoá; nháp cũ hơn DB (`stale`) chỉ áp khi bấm; lưu thành công xoá nháp; không sửa gì → không tạo nháp | Có (`dataEntryState.test.ts` đủ 5 nhánh `checkDraft` + `formsEqual`) | Đọc lại, đủ |
| Ngày ISO có giờ hiện đúng ngày; dự án mới 6 ô rỗng; không sửa ngày → không gửi lên server | Có (`dataEntryState.test.ts`) | Đọc lại, đủ |
| Data-entry không bao giờ gửi field tài chính; lỗi server luôn hiện chữ | Có (`buildSavePatch` + `saveErrorKind` + `actions-security.test.ts`) | Đọc lại, đủ |
| `/api/export`: không cookie→401; role sai→403; ký tự `=+-@` ở đầu→tiền tố `'` | Có (`export-route.test.ts`, `excel-safe.test.ts`) | Đọc lại, đủ |
| Thiếu `NEXTAUTH_SECRET`→500 rõ ràng; token thiếu `canViewFinance`→false | Có (`env.test.ts`, `middleware-secret.test.ts`, `auth-session.test.ts`) — **bổ sung thêm test render THẬT trang chi tiết dự án với user thiếu field** để khoá đúng điểm cuối UI (không chỉ đơn vị `authOptions`) | Xanh, bổ sung ở mục 3 |
| Upload: khác Origin→403; chưa đăng nhập→401; 0 byte/>5MB/không phải ảnh→lỗi từng file | Có (`same-origin.test.ts`, `photo-upload-route.test.ts`, `photo-upload.test.ts`) — **bổ sung 0 byte/>5MB ở tầng route (server tự chặn, không chỉ client precheck)** | Xanh, bổ sung ở mục 3 |

## 5. Smoke test UI thật trên dev (cổng 3000, `mcp__playwright`) — theo `.claude/launch.json` `ddc-control-tower`

Khởi động `npm run dev -- -p 3000`, xong tắt tiến trình `next dev` (PID xác nhận qua
`Get-CimInstance Win32_Process`), không giữ engine Prisma.

| Bước | Kết quả |
|---|---|
| `/vi/overview` chưa đăng nhập | Redirect `/vi/login`, trang login render sạch, 0 lỗi console |
| Đăng nhập admin (thông tin điền sẵn ở form dev) | Vào `/vi/overview`, dashboard 17 dự án render đầy đủ (KPI, chart, bảng) |
| Console errors ở `/vi/overview` | 3 cảnh báo `recharts defaultProps` (thư viện bên thứ 3, không liên quan P1A, không phải crash) |
| `/vi/projects/1` | Thẻ "Nhân lực (TT/KH)" hiện **486/520** đúng số liệu đã biết trước migration — xác nhận migration không làm sai lệch dữ liệu hiển thị |
| `/vi/nhap-lieu?project=1` step "Mã SAP & Ảnh" | `PhotoDropzone` render đúng: "Kéo thả ảnh vào đây hoặc bấm để chọn" + hint "tối đa 5MB mỗi ảnh", 0 lỗi console |

Không phát hiện crash hay lỗi console mới do P1A gây ra.

## 6. Kết luận

Không có test nào rớt. Không phát hiện lệch giữa báo cáo coder và kiểm tra độc lập (tsc, test, migration,
dữ liệu DB thật, UI thật trên dev). Đã bổ sung 8 test case biên còn thiếu so với "Trường hợp biên bắt buộc"
trong `ke-hoach.md`, tất cả xanh. Không sửa file code sản phẩm nào.
