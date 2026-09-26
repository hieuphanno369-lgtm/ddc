KET LUAN BAO MAT: DAT

# Đánh giá bảo mật P3C-A (nhánh `feature/p3c-a-form-ke-hoach`, diff `bb5d95d...HEAD`) - 2026-09-26

> Security-reviewer (vai chỉ đọc) trả báo cáo; điều phối viên chép vào file này.

Skill đã dùng: `security-review`.
Không gọi `security-audit` và `api-security-testing` vì phạm vi chỉ là rà diff, không pentest động.
Kiểm DB thật qua `mcp__postgres` (chỉ đọc) trên `ddc_control_tower`.

## Đã kiểm và đạt

- **Phân quyền 2 action** (`src/server/actions-entry.ts:258-311`):
  - `saveEquipmentPlansAction` và `saveManpowerPlanAction` gọi `requireWriteProject(projectId)` ngay dòng đầu, trước zod và trước mọi truy cập DB.
  - `canWriteProject` (`src/server/authz.ts`) chỉ cho admin, hoặc data-entry có `projectId` trong `project_assignments`.
  - Viewer, BOD, data-entry không được gán và người chưa đăng nhập đều nhận `Forbidden`.
  - `projectId` truyền dạng chuỗi hoặc NaN đều trượt phép so sánh chặt trong `includes`, hoặc bị zod `int().positive()` chặn.
  - Đã có test `src/server/actions-p3c-a-quyen.qa.test.ts` phủ đủ các vai trên.
- **IDOR:**
  - Mọi ghi và xoá trong `replaceEquipmentPlans`/`replaceManpowerPlan` (`src/server/repo/prisma-repo-form.ts`) đều lọc `where: { projectId }` theo projectId đã qua kiểm quyền.
  - Client không gửi được id dòng nào, nên không sửa được dòng của dự án khác.
  - `equipmentId` phải thuộc thiết bị đang active hoặc đã có quota của chính dự án đó, nếu không bị `validateEquipmentPlan` chặn; nếu lọt vẫn còn FK `RESTRICT` ở DB.
  - `shiftCode` phải khớp đúng tập ca active, không trùng (`sameSet` so cả `size`), và có FK tới `dim_shift`.
- **Zod** (`src/server/validation.ts:368-392`):
  - Giới hạn: tối đa 100 loại thiết bị, 300 đợt (tính tổng qua `refine`), 60 tháng, 10 ô mỗi tháng, 10 tỷ lệ.
  - Khoảng số: SL 1..999, planned 0..99999, pct là số hữu hạn trong 0..1.
  - Định dạng: `isoDate`, `yearMonth`, `shiftCode` được trim và dài tối đa 20.
  - `validateManpowerPlan` phía server kiểm thêm: tháng trùng, tổng tỷ lệ = 1 ± 0,001, và đúng tập ca.
- **Injection:** chỉ dùng Prisma có tham số, không có `$queryRaw` mới; không có `dangerouslySetInnerHTML`, React tự escape.
- **Transaction + audit:**
  - Cả hai hàm replace chạy trong `prisma.$transaction`, audit ghi trong cùng transaction.
  - Validate thất bại thì trả lỗi trước khi ghi, dữ liệu cũ không mất.
  - `readProjectAuditTrail` lọc tiền tố `${projectId}/` cho manpower, nên dự án 1 không kéo nhầm audit của dự án 11.
- **Migration** `20260926100000_p3c_a_plan_tables`:
  - Đối chiếu `pg_constraint` trên DB thật đủ ràng buộc: CHECK `qty>=1`, `totalQty>=1`, `planned>=0`, regex `yearMonth`, pct trong 0..1.
  - FK projectId là `CASCADE`, FK equipment/shift là `RESTRICT`, PK kép chống trùng.
  - Không có unique `(projectId, equipmentId, unitNo)`, nên bước rollback tách một đợt thành n chiếc không vỡ ràng buộc.
- **4 hàm đọc mới:**
  - Không có trường tiền, nên quy tắc N-3 (`canViewFinance`) không áp dụng.
  - `/nhap-lieu` chỉ gọi 4 hàm này với dự án nằm trong danh sách đã lọc theo assignment (admin và data-entry, redirect các vai khác).
- **Lộ lỗi ra UI:**
  - `ProjectForm.tsx`, `EquipmentPlanEditor.tsx`, `ManpowerPlanEditor.tsx` đều có `catch` hiện thông điệp chung (`err.unexpected`).
  - `res.error` chỉ là mã liệt kê cố định hoặc thông điệp zod, không có stack hay lỗi Prisma.
  - Lỗi ngoài dự kiến ném từ server action được Next che thành digest ở bản production.
- **Server action surface:** `actions-entry.ts` có `'use server'`; chỉ 2 export mới, cả hai đều kiểm quyền, không lộ helper nào thành endpoint.

## Phát hiện

### L-1 (Thấp) - zod phân tích tới 30.000 đợt trước khi `refine` chặn tổng

- Vị trí: `src/server/validation.ts:377-381`.
- Kịch bản: mỗi loại `.max(300)` đợt, nhân 100 loại là 30.000 object (khoảng 1,5 MB), dưới `bodySizeLimit: '11mb'`; zod duyệt hết rồi `refine` mới báo lỗi. Chỉ user có quyền ghi làm được, tốn vài chục ms CPU mỗi request.
- Cách sửa: hạ giới hạn mỗi loại (ví dụ `.max(50)`), hoặc chặn tổng sớm bằng `z.preprocess` đếm số đợt trước khi parse sâu.

### L-2 (Thấp) - Không có rate limit và khoá lạc quan, người lưu sau thắng

- Vị trí: `src/server/actions-entry.ts:282`, `:307`.
- Kịch bản: hai PIC/Backup cùng mở form, người lưu sau thay toàn bộ kế hoạch của người trước mà không cảnh báo; user có quyền gửi liên tục làm phình `audit_log` (tối đa khoảng 61 dòng mỗi lần lưu nhân lực).
- Pattern có sẵn từ trước trong repo, không phải lỗi mới của P3C-A.
- Cách sửa: gửi kèm `updatedAt` lớn nhất lúc tải form, server so trong transaction, lệch thì trả `stale`; rate limit theo user cho các action ghi (việc chung, phase sau).

### L-3 (Thấp) - Lưu nhân lực xoá ngầm dữ liệu của tháng hoặc ca không gửi lên

- Vị trí: `src/server/repo/prisma-repo-form.ts:352-363`.
- Kịch bản: tháng có trong DB nhưng thiếu trong payload bị tính là "changed" và bị xoá; payload lỗi phía client có thể xoá lịch sử kế hoạch. Dòng của ca đã tắt `isActive` cũng bị xoá khi lưu lại tháng đó (khớp rủi ro số 6 trong `thay-doi.md`). Có audit before/after nên truy vết được, nhưng không tự khôi phục.
- Cách sửa: nếu là chủ đích thì giữ, ghi rõ nghiệp vụ; hoặc chỉ xoá tháng khi client gửi cờ `deleted: true` rõ ràng.

### I-1 (Thông tin) - 4 hàm đọc không tự kiểm quyền

- `readEquipmentPlanSegments`, `readEquipmentQuotas`, `readManpowerPlanMonths`, `readShiftRatios` (`prisma-repo-form.ts`) nhận projectId tuỳ ý, đúng pattern repo hiện có.
- Bước 11 (gắn chart vào trang Chi tiết) bắt buộc gọi `requireProjectRead(user, projectId)` trước; không gọi từ route/action công khai mà không có guard.

### I-2 (Thông tin) - Rollback làm mất dữ liệu

- `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql` `DROP` 3 bảng quota, KH nhân lực và tỷ lệ ca; các đợt tách thành chiếc `unitNo` 1..n nhưng mất tổng SL.
- Trước khi rollback trên môi trường thật, nên `pg_dump` 3 bảng này.

### I-3 (Thông tin) - Không có ràng buộc DB bảo đảm mỗi đợt có quota tương ứng

- Không có FK `(projectId, equipmentId)` từ `project_equipment_plan` sang `project_equipment_quota`; hiện chỉ code bảo đảm. DB thật có 0 đợt mồ côi (đã query).
- Toàn vẹn dữ liệu, không phải lỗ hổng.

## Kết luận

Không có lỗ hổng Cao hoặc Trung.
Phân quyền, IDOR, validate, transaction và audit của 2 action mới đều đạt.
Các mục Thấp đưa vào nợ kỹ thuật, không chặn CHỐT.

---

# Buoc 11 (diff `3181315..HEAD`) - DANH GIA BAO MAT: DAT

> Security-reviewer (vai chi doc) tra bao cao ngay 2026-09-26; dieu phoi vien chep vao day.
> Ket luan chung cua file: Task 0-10 DAT (o tren) va Buoc 11 DAT (muc nay).

- Kiem soat truy cap: DAT. `page.tsx:76` `requireUser`, `:79` kiem `params.id` `/^[1-9]\d*$/`, `:86` `requireProjectRead` truoc `repo.getProject` va truoc `Promise.all` chua `getManpowerMonthChartData` / `getEquipmentPlanGantt`.
  `requireProjectRead` chi cho admin/bod qua thang, vai khac phai co trong `project_assignments`, khong thi 404.
  2 query moi chi duoc goi tu `page.tsx` va `scripts/perf/bench-data.ts` (CLI); moi ham repo ben duoi loc theo `projectId`.
- Ro ri du lieu: DAT. `PlanGanttModel`, `ManpowerMonthModel` khong co truong tai chinh; model moi gon hon (khong con gui danh sach nha thau, `note`, `updatedBy`).
- XSS/tiem: DAT. Ten thiet bi/ca/`<title>` la text child JSX; khong co `dangerouslySetInnerHTML`; khong co SQL ghep chuoi moi.
- Xoa ham doc cu: DAT. Khong con tham chieu, `check-read-parity.ts` va `bench-data.ts` da cap nhat, `tsc` xanh.
- Cau hinh: DAT. Khong doi `next.config`, `middleware.ts`, `.env`, `package*.json`, `prisma/`, `app/api`, `actions.ts`.

## Phat hien

- THAP-1: query moi khong tu kiem quyen, chi dua vao comment (`equipment-plan-gantt-queries.ts:8`, `getManpowerMonthChartData`).
  Hien khong khai thac duoc; rui ro khi sau nay co route/action goi thang (BOLA/IDOR). Co san tu truoc, giong query cu.
  De xuat: `import 'server-only'` cho `src/server/*-queries.ts`, hoac ham nhan `user` va tu goi `requireProjectRead`.
- THONG TIN-1: `src/server` chua dung goi `server-only`; nen lam trong task ha tang chung.
- THONG TIN-2: commit `a524407` chi o client, khong doi payload hay server.
- THONG TIN-3: `scripts/perf/bench-data.ts` chay Prisma khong qua auth, dung thiet ke cho script chay tay.

Khong chan merge.
