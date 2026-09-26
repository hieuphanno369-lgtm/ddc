PHAN QUYET: CAN SUA

# Đánh giá cuối P3C-A (Task 0-10), nhánh `feature/p3c-a-form-ke-hoach`, diff `bb5d95d...HEAD` - 2026-09-26

> Reviewer (vai chỉ đọc) trả báo cáo; điều phối viên chép vào file này.

Skill đã dùng: `code-review` (chạy nền, chưa có kết quả khi chốt; phần dưới là reviewer tự rà diff).
Task 11 (Bước 11) đang CHỜ, không đánh giá.

## Cổng kiểm (reviewer tự chạy lại)

- `npx tsc --noEmit`: sạch.
- `npm test`: 186 file / 2153 test xanh; mốc đầu phase 177 / 1958, không tụt.
- `npm run check:read`: OK toàn bộ, gồm 4 hàm mới cho dự án 1 và 17.
- `npx prisma migrate status`: 9 migration, up to date trên `ddc_control_tower`.
- File cấm (`prisma-repo.ts`, `mock-repo.ts`, `actions.ts`, `queries.ts`, `project-queries.ts`, `PROGRESS.md`, `.serena/`): không có trong diff.

## 1. Code có khớp kế hoạch và hợp đồng không: CÓ

- 4 interface hợp đồng trong `src/server/repo/types.ts` khớp nguyên văn `hop-dong-du-lieu-P3C.md`.
- 4 hàm đọc đúng tên, chữ ký, thứ tự sắp xếp, có ở cả Prisma lẫn mock; `readShiftRatios` áp mặc định 0.6/0.4.
- Schema và migration khớp Task 2 (PK kép, CHECK đủ, FK dự án Cascade, FK thiết bị/ca Restrict, chuyển dữ liệu cũ bằng `GREATEST(COUNT(DISTINCT unitNo),1)`); rollback tách đợt `qty=n` thành n chiếc, tester đã chạy thật trong transaction tự huỷ.
- T3: `?` nằm trong `.lb`, 5 khối `f4 feven`, `createErrorField`, `code_reserved` bắt ở client, `catch` cho `unexpected`; BUG-01 sửa đúng gốc (`.inline-row`) kèm test guard.
- T4: `findOverloads` đúng (chồng 1 ngày, nhiều khoảng vượt rời nhau, đóng khoảng tại `segFrom-1`); thay toàn bộ trong 1 transaction, 1 dòng audit.
- T5: ca cuối nhận phần dư, giữ ô sửa tay, chỉ ghi và audit tháng có đổi.
- Q1 (a) đã áp và ghi vào mục "Thay đổi hợp đồng".

## 2. Test có giá trị thật không: CÓ, với 1 lỗ hổng

- Test logic thuần có số cụ thể, test action kiểm dữ liệu đọc lại và audit old/new, test quyền đủ vai, test QA độc lập, test guard BUG-01 đỏ trước xanh.
- Lỗ hổng: `manpowerPlanState.test.ts` không có ca `setCell(..., '')` (xoá trắng ô), che lỗi ở mục CẦN SỬA 1.

## 3. Bảo mật, hiệu năng, tính đúng đắn

- Bảo mật: đồng ý `danh-gia-bao-mat.md` (ĐẠT).
- Tính đúng đắn: 1 lỗi UX dẫn tới nhập sai số (mục 1).

## CẦN SỬA

### 1. Ô ca KH nhân lực không xoá trắng được, gõ đè ra số sai

- Vị trí: `src/components/form/manpowerPlanState.ts:74-78` (`setCell` trả nguyên `s` khi input không phải số nguyên, gồm chuỗi rỗng); `src/components/form/ManpowerPlanEditor.tsx:130` (ô controlled `value={String(c.planned)}`).
- Diễn biến: xoá dần "540" thành "54", "5", "" thì React ép ô về "5"; gõ tiếp "600" thành "5600", hợp lệ nên được lưu và tự đánh dấu sửa tay. Playwright `fill()` gán cả giá trị một lần nên tester không bắt được.
- Cách sửa: giữ chuỗi nháp cho từng ô ca như `totalInput`/`pctInputs` (vd `cellInputs: string[]` trong `PlanRowState`); chuỗi rỗng/không hợp lệ chỉ cập nhật nháp, `toPlanInput` trả null nên nút Lưu tắt; `onBlur` trả ô về số đang lưu.
- Test phải có: `setCell(row0, 0, '')` thì ô rỗng, `toPlanInput` = null; tiếp `setCell(row0, 0, '600')` được 600, manual = true.

### 2. L-1 bảo mật: zod duyệt tới 30.000 đợt trước khi `refine` chặn tổng

- Vị trí: `src/server/validation.ts:377`, `:381`.
- Cách sửa ưu tiên: chặn tổng số đợt trước khi parse sâu (`z.preprocess` đếm `groups[*].segments.length`, hoặc kiểm nhanh đầu `saveEquipmentPlansAction`). Hạ `.max` mỗi loại đổi luật nghiệp vụ nên để sau.
- Test: 2 loại x 200 đợt ra `Invalid input`, repo không bị gọi.

Sau khi sửa: chạy lại `tsc`, `npm test`, kiểm trình duyệt gõ và xoá ô ca ở 1440px, rồi gửi lại reviewer.

## Không đưa vào CẦN SỬA (có lý do)

- L-3 (xoá ngầm tháng): chủ đích của kế hoạch (Task 8 "tháng đổi gồm tháng bị bỏ", UI có nút "Xoá tháng", có test và audit). Dòng của ca đã tắt bị xoá là trường hợp biên, hiện không có ca nào bị tắt.
- L-2 (người lưu sau thắng, không rate limit): pattern chung của repo, cần làm ở tầng chung.

## Để sau

- L-2: khoá lạc quan theo `updatedAt` và rate limit cho các action ghi.
- L-3: khi có nghiệp vụ tắt ca, quyết định giữ hay xoá dòng của ca đã tắt; ghi nghiệp vụ "bỏ tháng = xoá tháng" vào tài liệu người dùng.
- `EquipmentPlanEditor.tsx`: `check` giữ theo chỉ số nhóm, xoá 1 nhóm ở giữa thì ô tô đỏ lệch sang nhóm khác tới lần Lưu kế tiếp; nên xoá `check` khi thêm/xoá nhóm và đợt.
- `ManpowerPlanEditor.tsx`: `pctSum` cộng số thực có thể hiện `100.00000000000001%` khi có 3 ca, nên làm tròn; `<td className="inp bad">` dùng class ô nhập cho ô bảng, nên dùng màu chữ danger; `setPct` xoá `error` nhưng giữ `totalInput` khác tổng nên ô Tổng sai mà không tô đỏ.
- `replaceManpowerPlan` (`prisma-repo-form.ts:352-355`): client gửi ô ca khác thứ tự sortOrder thì mọi tháng bị coi là đổi và sinh audit thừa; nên sắp `cells` theo thứ tự ca active trước khi dựng chuỗi audit.
- I-1: Bước 11 phải gọi `requireProjectRead` trước 4 hàm đọc.
- I-2: `pg_dump` 3 bảng mới trước khi rollback trên môi trường thật.
- Nợ trong `thay-doi.md`: key i18n Gantt cũ, `seed-perf.ts`, `.serena/memories/core.md` còn mã ca `afternoon`.
- E2E repo bị bỏ qua vì `e2e/global-setup.ts` chặn DB và cổng của A; chạy e2e sau khi merge `main`.
