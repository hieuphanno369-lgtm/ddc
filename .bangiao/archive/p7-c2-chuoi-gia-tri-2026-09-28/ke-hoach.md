# P7-C2 (task 7.5): Chuỗi giá trị quản lý dự án - giai đoạn động, cột trái/phải, thêm "Thanh quyết toán"

> Planner dùng skill `ddc-tower:writing-plans`.
> Coder làm tuần tự Task 1 → Task 9, mỗi Task 1 commit, test đỏ trước rồi mới code.
> Mỗi commit phải để `npx tsc --noEmit` và `npm test` xanh.
> Task 1 và Task 2 KHÔNG phụ thuộc câu hỏi bên dưới, làm được ngay.
> Task 3 trở đi chờ chủ dự án trả lời Q1 → Q5 (mỗi Task ghi rõ phụ thuộc câu nào).

**Mục tiêu:** đổi tên thẻ thành "Chuỗi giá trị quản lý dự án", xếp 2 cột theo yêu cầu, thêm giai đoạn "Thanh quyết toán", và chuyển danh sách giai đoạn từ hằng số trong code sang dữ liệu `dim_stage` để admin tự thêm/sửa giai đoạn (tên vi/en, bên trái/phải, thứ tự, cách tính).

**Kiến trúc:** `dim_stage` thêm cột `side` (trái/phải) và `isActive`; mọi chỗ đang dùng hằng `STAGE_ORDER`/`STAGE_CALC_MODE`/`VALUE_CHAIN_COLUMNS`/`stageKey` chuyển sang đọc `repo.getStages()` và truyền danh sách xuống hàm thuần qua tham số.
Đổi theo kiểu "thêm tham số có mặc định trước, gỡ hằng cũ sau cùng" để commit nào cũng xanh.
Tên giai đoạn hiển thị lấy từ DB (`nameVi`/`nameEn` theo locale), giống cách đã làm với ca (`dim_shift`).

**Tech:** Next.js 14 app router, Prisma 6, PostgreSQL localhost:5433 DB `ddc_control_tower_c`, next-intl vi/en, Vitest, zod, Playwright (cổng 3003).

**Nguồn yêu cầu:**
- `D:\_project\DDC_dieu-phoi\lenh-cho-A-2026-09-27.md` mục 7.5.
- `D:\_project\DDC_dieu-phoi\lenh-cho-C-2026-09-27.md` PHẦN C-2 (câu trả lời của chủ dự án 2026-09-26 ~19:00).

---

## CHỦ DỰ ÁN ĐÃ CHỐT (2026-09-27 ~01:30)

Chủ dự án chọn phương án (a) cho cả Q1 đến Q4, qua câu hỏi lựa chọn của điều phối.
Q5 (tên tiếng Anh) dùng phương án đề xuất (a); điều phối đã báo chủ dự án, chủ dự án không đổi.
- Q1 = (a): không có nút xoá, chỉ "Ngừng dùng" / "Dùng lại"; chỉ ngừng được khi không dự án nào đặt trọng số lớn hơn 0% cho giai đoạn đó.
- Q2 = (a): giữ Thanh quyết toán 2%, Lắp dựng 25; dự án chỉ "Hoàn thành" khi quyết toán xong.
- Q3 = (a): 8 bộ theo loại dự án mỗi bộ thêm Thanh quyết toán 2, lấy 2 từ Lắp dựng.
- Q4 = (a): tìm khâu nghẽn bỏ qua giai đoạn trọng số 0% hoặc tắt "Áp dụng".
- Q5 = (a): "Project Management Value Chain"; giai đoạn "Settlement".
Kế hoạch dưới đây vốn viết theo (a), nên không phải sửa bước nào.

## CÂU HỎI CÒN BỎ NGỎ (điều phối hỏi chủ dự án trước khi coder tới Task 3) - ĐÃ CHỐT, xem mục trên

**Q1. Khi một giai đoạn không dùng nữa thì xử lý thế nào?**
Giai đoạn đã có số liệu (tiến độ các tháng, trọng số của dự án) thì xoá sẽ làm mất lịch sử.
- (a) **Đề xuất:** không có nút xoá, chỉ có "Ngừng dùng" và "Dùng lại". Chỉ cho ngừng dùng khi KHÔNG dự án nào đang đặt trọng số lớn hơn 0% cho giai đoạn đó (nếu có, báo "còn N dự án đang dùng, sửa trọng số về 0% trước"). Giai đoạn ngừng dùng biến mất khỏi chart, form nhập tiến độ, bảng trọng số; số liệu cũ giữ nguyên trong DB. Nhờ luật này %TT của mọi dự án không đổi khi ngừng dùng.
- (b) Cho ngừng dùng bất cứ lúc nào: dự án mới không thấy giai đoạn đó, dự án cũ đang có trọng số vẫn thấy và vẫn tính. Linh hoạt hơn nhưng phức tạp hơn nhiều (mỗi dự án có danh sách giai đoạn riêng).
- (c) Cho xoá hẳn khi giai đoạn chưa có bất kỳ số liệu nào, còn lại như (a).

Kế hoạch viết theo (a).

**Q2. Thanh quyết toán 2% làm dự án mới chỉ đạt 100% khi đã quyết toán xong - có đúng ý không?**
Hiện hệ thống coi dự án "Hoàn thành" khi % Thực tế đạt 100% và có ngày HT thực tế; còn 30 ngày tới Bàn giao cam kết mà % Thực tế dưới 100% thì bật cảnh báo Đỏ "Nguy cơ phạt HĐ".
Với trọng số Thanh quyết toán 2%, dự án đã lắp dựng và nghiệm thu xong nhưng chưa quyết toán sẽ dừng ở 98%: chưa "Hoàn thành" và có thể bị cảnh báo phạt.
- (a) **Đề xuất:** giữ đúng bộ đã chốt (Thanh quyết toán 2%, Lắp dựng 25) và chấp nhận hệ quả trên: dự án chỉ "Hoàn thành" khi quyết toán xong. Người nhập tự đặt 0% cho dự án nào không muốn tính.
- (b) Dự án mới mặc định Thanh quyết toán 0% (Lắp dựng giữ 27), ai muốn tính thì tự nhập trọng số.
- (c) Giữ 2% nhưng loại Thanh quyết toán khỏi luật "Hoàn thành" và luật cảnh báo phạt (thêm logic riêng, không đề xuất).

Kế hoạch viết theo (a).

**Q3. Bộ trọng số điền sẵn theo loại dự án (EPC, Sân bay, Sân vận động, Nhà xưởng, Cầu cảng, Cao tầng, Đóng tàu, Cầu giao thông) xử lý thế nào?**
Khi tạo dự án mới, form tự điền bộ trọng số theo loại; 8 bộ này đang có 7 giai đoạn, Lắp dựng từ 15 đến 30.
- (a) **Đề xuất:** mỗi bộ thêm Thanh quyết toán 2, lấy 2 từ Lắp dựng (giống bộ mặc định). Ví dụ EPC: Lắp dựng 27 → 25, Thanh quyết toán 2.
- (b) Mỗi bộ thêm Thanh quyết toán 0, giữ nguyên các số cũ.
- (c) Chủ dự án gửi bộ số mới cho từng loại.

Nếu Q2 chọn (b) thì Q3 tự động là (b).
Kế hoạch viết theo (a).

**Q4. "Khâu nghẽn" có tính giai đoạn trọng số 0% không?**
Khâu nghẽn = giai đoạn đầu tiên (theo thứ tự) chưa xong 100%. Mọi dự án cũ sẽ có Thanh quyết toán 0% ở cuối chuỗi, nên dự án cũ đã xong 7 giai đoạn, sau lần lưu tiến độ kế tiếp, sẽ hiện "Khâu nghẽn: Thanh quyết toán".
- (a) **Đề xuất:** bỏ qua giai đoạn có trọng số 0% hoặc bị tắt "Áp dụng" ở bảng trọng số khi tìm khâu nghẽn (khớp cách tính %TT: giai đoạn 0% không ảnh hưởng tiến độ thì không coi là nghẽn).
- (b) Vẫn tính mọi giai đoạn áp dụng như hiện nay.

Kế hoạch viết theo (a).

**Q5. Tên tiếng Anh.**
- (a) **Đề xuất:** tiêu đề thẻ "Project Management Value Chain"; giai đoạn Thanh quyết toán "Settlement".
- (b) Chủ dự án đặt tên khác.

Kế hoạch viết theo (a).

**Không còn câu hỏi nghiệp vụ nào khác.**

---

## Quyết định kỹ thuật (planner tự chọn, có lý do)

| # | Quyết định | Lý do |
|---|---|---|
| K1 | `StageCode` đổi thành `string` (giữ tên kiểu để ít xáo trộn). Thêm `StageSide = 'left' \| 'right'`. `Stage` thêm `side`, `isActive`. | Giai đoạn giờ do admin thêm, không liệt kê được lúc biên dịch. |
| K2 | Prisma enum mới `StageSide { left right }`, cột `dim_stage.side` NOT NULL, `dim_stage.isActive` NOT NULL mặc định `true`. | Khuôn `StageCalcMode` có sẵn; DB tự chặn giá trị rác. |
| K3 | Một `sortOrder` chung cho cả chuỗi. Cột trái = giai đoạn `side='left'` đang dùng, xếp `sortOrder` tăng dần (trùng thì theo `code`); cột phải tương tự. Thứ tự chuỗi (tính khâu nghẽn, form nhập, timeline) = mọi giai đoạn đang dùng xếp theo `sortOrder`. | Với 1..8 hiện tại cho đúng bố cục yêu cầu (trái: Thiết kế, Shop, Vật tư, Gia công; phải: Vận chuyển, Lắp dựng, Nghiệm thu, Thanh quyết toán) mà không cần thêm cột thứ tự trong cột. Không ép `sortOrder` duy nhất để admin khỏi phải đánh số lại. |
| K4 | Mã giai đoạn admin thêm = `custom_1`, `custom_2`... (tự sinh, không cho sửa). Admin chỉ nhập tên. | Tên tiếng Việt có dấu không làm mã được; mã chỉ dùng nội bộ (khoá, audit). |
| K5 | Tên hiển thị lấy từ DB cho mọi giai đoạn, kể cả 7 mã cũ. Migration sửa 2 tên DB cho khớp chữ đang hiển thị: `handover.nameVi` 'Nghiệm thu & Bàn giao' → 'Nghiệm thu', `procurement.nameEn` 'Materials' → 'Procurement'. Gỡ `stageKey` và nhóm i18n `stage`. | Một nguồn tên duy nhất; admin sửa tên là thấy ngay; giao diện hiện tại không đổi chữ. |
| K6 | Thêm 2 hằng: `LEGACY_STAGE_WEIGHTS` (7 số cũ 5/10/10/40/5/27/3 + Thanh quyết toán 0) và `DEFAULT_STAGE_WEIGHTS` mới (5/10/10/40/5/25/3/2). Seed demo dùng `LEGACY_STAGE_WEIGHTS` (mô phỏng "dự án cũ" giống DB thật sau migration). | Seed không đổi số %TT nên hàng trăm test số liệu không phải sửa; đúng tình trạng DB thật. |
| K7 | Migration điền trọng số cho MỌI dự án: dự án chưa có dòng trọng số nào → chèn 7 dòng `LEGACY` (đúng bộ đang được dùng ngầm qua fallback); mọi dự án → chèn Thanh quyết toán 0%, áp dụng. | Nếu không chèn, dự án chưa từng lưu trọng số sẽ rơi vào `DEFAULT` mới (Lắp dựng 25) và đổi %TT. |
| K8 | Server kiểm danh sách mã gửi lên (chuỗi tiến độ tháng, bảng trọng số) phải ĐÚNG BẰNG tập giai đoạn đang dùng; lệch → lỗi `stages_changed` ("Danh sách giai đoạn vừa thay đổi, tải lại trang"). Kiểm TRƯỚC mọi lệnh ghi. | Form mở từ trước khi admin thêm/ngừng giai đoạn không được lưu thiếu giai đoạn (sẽ tính sai %TT). |
| K9 | Hàm thuần `fillWeightsForStages` điền trọng số cho đủ giai đoạn đang dùng: thiếu dòng → 0%, áp dụng; bỏ mã không còn dùng. | Đúng luật chủ dự án chốt cho Thanh quyết toán, dùng lại cho giai đoạn admin thêm sau này và cho bản nháp cũ trong localStorage. |
| K10 | Admin thêm giai đoạn → cùng transaction chèn trọng số 0%, áp dụng cho mọi dự án (`skipDuplicates`). | Dữ liệu DB đầy đủ, khớp K7; `fillWeightsForStages` chỉ là lưới an toàn. |
| K11 | Sửa luôn lỗi có sẵn: form nhập tiến độ (`DataEntryForm`) xem trước "% tổng thể" bằng trọng số MẶC ĐỊNH thay vì trọng số của dự án. Truyền trọng số dự án xuống. | Khi đổi `DEFAULT_STAGE_WEIGHTS`, số xem trước sẽ lệch số server lưu. |
| K12 | Gỡ `calcStageContributions` (chỉ test dùng, không code nào gọi) cùng test của nó. | Code chết, phụ thuộc hằng sắp gỡ. |
| K13 | Bỏ số "7" trong các chuỗi giao diện ("Timeline của 7 giai đoạn" → "Timeline các giai đoạn"...). | Số giai đoạn giờ thay đổi được. |
| K14 | Tối đa 30 giai đoạn (tính cả ngừng dùng), hằng `STAGE_MAX_COUNT = 30`. | Chặn payload/giao diện vô hạn; 30 dư xa nhu cầu. |
| K15 | `calcMode` của giai đoạn admin thêm chọn được `manual`/`volume` nhưng hiện CHỈ ảnh hưởng thẻ "Biểu đồ so sánh" (hệ thống chưa có màn nhập sản lượng hạng mục; %HT mọi giai đoạn vẫn nhập tay ở form tiến độ). Ghi rõ trong gợi ý màn quản trị. | Đúng yêu cầu "cách tính" mà không mở thêm phạm vi. |

---

## Phạm vi

- Đổi tên `detail.valueChain` (vi + en).
- Thêm giai đoạn `settlement` "Thanh quyết toán" / "Settlement", `sortOrder` 8, `manual`, bên phải.
- `dim_stage` thêm `side`, `isActive`; backfill bên cho 7 giai đoạn cũ; migration + file rollback.
- Trọng số: bộ mặc định mới cho dự án mới; dự án cũ thêm Thanh quyết toán 0% (áp dụng), không đổi 7 giai đoạn cũ; bộ theo loại dự án theo Q3.
- Mọi nơi đang dựa vào danh sách giai đoạn cứng chuyển sang đọc DB (danh sách đầy đủ ở mục "Bản đồ phụ thuộc").
- Màn quản trị giai đoạn trên trang `/admin` (chỉ admin): thêm, sửa tên vi/en, bên, thứ tự, cách tính, ngừng dùng/dùng lại; ghi audit + activity.
- Cập nhật tài liệu sinh tự động (`npm run docs:erd`), `schema-meta/docs.ts`, từ điển dữ liệu.

## Phi phạm vi

- Không đổi bố cục/CSS thẻ Chuỗi giá trị hay trang Chi tiết (B đang redesign P4). Chỉ đổi nguồn dữ liệu trong các file liệt kê ở Task 6.
- Không tính lại % Thực tế các tháng đã lưu (`fact_progress_monthly`).
- Không làm màn nhập sản lượng hạng mục, không nhập mốc giai đoạn qua UI (hiện chỉ có từ seed).
- Không thêm màn quản trị bộ trọng số theo loại dự án (vẫn là hằng trong code).
- Không xoá giai đoạn (theo Q1a).
- Không sửa `PROGRESS.md`, `.serena/memories/`, `app/globals.css`.

---

## Bản đồ phụ thuộc (mọi chỗ đang dựa vào danh sách giai đoạn cứng)

| File | Đang dựa vào | Xử lý ở Task |
|---|---|---|
| `src/server/repo/types.ts:24-31, 191-197` | union `StageCode`, `Stage` 5 trường | 1 |
| `src/lib/stages.ts` | `STAGE_ORDER`, `DEFAULT_STAGE_WEIGHTS`, `STAGE_CALC_MODE`, `findCurrentStage`, `calcStageContributions` | 1, 5, 7 |
| `src/lib/value-chain-view.ts` | `VALUE_CHAIN_COLUMNS`, `chainStageInputs` theo `STAGE_ORDER` | 1, 6, 7 |
| `src/lib/stage-timeline.ts:17-29` | `buildStageTimelineRows` theo `STAGE_ORDER` | 1, 6 |
| `src/lib/evm.ts:147` | `findBottleneck` → `findCurrentStage` | 1, 2 |
| `src/lib/stage-weight-presets.ts` | 8 bộ 7 số theo `STAGE_ORDER` | 5 |
| `src/lib/labels.ts:29-37` | `stageKey` | 7 |
| `src/lib/data-dictionary.ts:61-64` | chữ "7 giai đoạn", bộ mặc định cũ | 5 |
| `src/lib/schema-meta/docs.ts:73-83` | mô tả `dim_stage` | 9 |
| `src/server/validation.ts:54, 61-66, 97-107` | `STAGE_CODES` cứng, `.length(7)` | 3 |
| `src/server/actions.ts:156-164, 219-265` | `findCurrentStage(chain)`, trọng số tạo dự án | 3 |
| `src/server/actions-project.ts:124-144` | `stageWeightRowsSchema` | 3 |
| `src/server/project-queries.ts:150-165` | `STAGE_ORDER` + `STAGE_CALC_MODE` | 3 |
| `src/server/repo/prisma-repo.ts:230-250` | `getStages` map 5 trường, fallback `DEFAULT_STAGE_WEIGHTS` | 2 |
| `src/server/repo/mock-repo.ts:166-176` | như trên (mock) | 2 |
| `src/server/repo/prisma-repo-form.ts:69-77, 157-171` | `stageWeightAuditText` theo `STAGE_ORDER` | 5 |
| `src/server/repo/mock-repo-form.ts:27-35, 89-95` | như trên (mock) | 5 |
| `src/data/seed/erp.ts:5-16, 159` | 7 dòng `stages`, `STAGE_CALC_MODE` | 2 |
| `src/data/seed/history.ts:69-73, 334-416, 638` | `DEFAULT_STAGE_WEIGHTS`, `STAGE_ORDER`, `STAGE_CALC_MODE`, `findBottleneck` | 2 |
| `src/components/form/dataEntryState.ts` | `STAGE_ORDER` ở 5 hàm | 4 |
| `src/components/form/DataEntryForm.tsx:166-186, 365-401` | `STAGE_ORDER`, `stageKey`, trọng số mặc định | 4 |
| `src/components/form/ProjectForm.tsx:61-66, 88, 209, 375` | `STAGE_ORDER`, `DEFAULT_STAGE_WEIGHTS`, `length === 7` | 5 |
| `src/components/form/StageWeightEditor.tsx:39-46` | `STAGE_ORDER`, `stageKey` | 5 |
| `app/[locale]/(app)/projects/[id]/page.tsx:11-19, 146-159, 300-338` | `VALUE_CHAIN_COLUMNS`, `stageKey` | 6 |
| `src/components/project/StageExplorer.tsx:6-9, 24, 39, 60, 64` | `stageKey`, `STAGE_CALC_MODE`, mặc định `'fabrication'` | 6 |
| `src/components/project/StageTimelineChart.tsx:6, 53, 62` | `stageKey` | 6 |
| `src/components/project/ValueChainModeChip.tsx` | chỉ kiểu `Record<StageCode, string>` | không sửa code (K1 làm kiểu thành string) |
| `app/[locale]/(app)/nhap-lieu/page.tsx`, `ho-so-du-an/page.tsx`, `admin/page.tsx` | chưa nạp danh sách giai đoạn | 4, 5, 8 |
| `src/i18n/messages/vi.json`, `en.json` | nhóm `stage`, chữ "7 giai đoạn", `detail.valueChain` | 3, 6, 7, 8 |
| `scripts/perf/seed-perf.ts` | đã đọc `dim_stage` động | không sửa |

---

## Ràng buộc chung (mọi Task ngầm tuân)

- Viết tiếng Việt; KHÔNG dùng dấu gạch dài (em dash, en dash) ở code, comment, i18n, commit, tài liệu.
- Commit: `feat(p7-c2): ...`, `test(p7-c2): ...`, `docs(p7-c2): ...`, mô tả tiếng Việt KHÔNG dấu, giữ dòng `Co-Authored-By` của agent. Không push.
- Tên test tiếng Việt không dấu. File SQL/rollback: comment KHÔNG dấu (khuôn `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql`).
- Lệnh chạy qua PowerShell, đường dẫn `D:\_project\DDC_Control_Tower-C` chữ hoa: `npx tsc --noEmit`, `npm test`, `npm run check:read`, `npx prisma migrate status`, `npm run test:e2e`.
- **File nóng** (CLAUDE.md mục 3). C đang giữ `prisma/schema.prisma` + `prisma/migrations/` suốt phase. Các file nóng khác: trước khi sửa đọc `phien-A.md` và `phien-B.md`; bên nào đang giữ thì KHÔNG sửa, chuyển Task khác; ghi vào "Đang giữ" của `phien-C.md` trước khi sửa, nhả ngay sau commit của Task đó:
  - `src/i18n/messages/vi.json`, `en.json`: Task 3, 6, 7, 8.
  - `src/server/actions.ts`, `src/server/project-queries.ts`: Task 3.
  - `src/server/repo/prisma-repo.ts`: Task 2.
  - KHÔNG sửa `src/server/queries.ts`, `app/globals.css`.
- **Trang Chi tiết (B đang redesign P4):** chỉ sửa đúng các dòng dữ liệu nêu ở Task 6 trong `app/[locale]/(app)/projects/[id]/page.tsx`, `src/components/project/StageExplorer.tsx`, `src/components/project/StageTimelineChart.tsx`; không đổi class, style, cấu trúc JSX. Trước khi làm Task 6: đọc `phien-B.md`, ghi 3 tên file này vào `phien-C.md`.
- Nếu `phien-A.md` ghi "đang sửa mọi page" (Nâng Next) thì tạm dừng các Task sửa page (4, 5, 6, 8).
- Key i18n: nhóm mới đặt CUỐI `vi.json` và `en.json`; key thêm vào nhóm có sẵn thì nối CUỐI nhóm đó. vi/en đủ cặp (`src/i18n/messages.test.ts`). Mọi `logActivity(user, '<action>', ...)` mới cần `activity.<action>` ở vi + en.
- Mốc test đầu phase (main `bd4205b`): 210 file / 2397 test. Không tụt trừ test gỡ có chủ đích (ghi ở `thay-doi.md`).

## Quy ước copy từ file có sẵn

| Việc | Copy khuôn từ |
|---|---|
| Migration có backfill + comment không dấu | `prisma/migrations/20260922220000_erp_model_v2/migration.sql` dòng 221-239 |
| File rollback | `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql` |
| Action admin (requireRoleUser, zod, logActivity, revalidateTag) | `src/server/actions-master.ts` `saveFactoryAction`, `setFactoryActiveAction` |
| Repo ghi dim có audit (Prisma) | `src/server/repo/prisma-repo-entry.ts` `saveFactory`, `setFactoryActive` |
| Repo ghi dim có audit (mock) | `src/server/repo/mock-repo-entry.ts` `saveFactory`, `setFactoryActive`, `auditMock` |
| Test action admin | `src/server/actions-master.test.ts` khối `saveFactoryAction` |
| Component bảng sửa dim | `src/components/admin/FactoryEditor.tsx` |
| Test render component admin | `src/components/admin/FieldEditor.test.ts` |
| Tên theo locale từ DB | `src/components/form/ManpowerPlanEditor.tsx:93` |
| e2e trang admin | `e2e/07-admin.spec.ts` (khoanh vùng theo `.card` có tiêu đề) |

---

## Task 1: Hàm thuần cho giai đoạn động (thêm mới, chưa gỡ gì)

Không phụ thuộc câu hỏi.

**Files:**
- Modify: `src/server/repo/types.ts` (dòng 23-31, 191-197)
- Modify: `src/lib/stages.ts`
- Modify: `src/lib/value-chain-view.ts`
- Modify: `src/lib/stage-timeline.ts`
- Modify: `src/lib/evm.ts` (dòng 147-149)
- Test: `src/lib/stages.test.ts`, `src/lib/value-chain-view.test.ts`, `src/lib/stage-timeline.test.ts`

**Interfaces (Produces):**

```ts
// types.ts
/** Mã giai đoạn - khoá dim_stage, do admin thêm được (không còn union cố định). */
export type StageCode = string;
export type StageSide = 'left' | 'right';
export interface Stage {
  code: StageCode; nameVi: string; nameEn: string; sortOrder: number;
  calcMode: StageCalcMode; side: StageSide; isActive: boolean;
}

// stages.ts
export const STAGE_MAX_COUNT = 30;
/** 8 mã gốc - CHỈ seed, preset và test được dùng; code chạy thật đọc repo.getStages(). */
export const SEED_STAGE_CODES = ['design','shop','procurement','fabrication','transport','erection','handover','settlement'] as const;
/** Bộ trọng số "dự án cũ": 7 số cũ + Thanh quyết toán 0% áp dụng (khớp migration p7_c2). */
export const LEGACY_STAGE_WEIGHTS: StageWeight[]; // design 5, shop 10, procurement 10, fabrication 40, transport 5, erection 27, handover 3, settlement 0 - tất cả applicable true
export function activeStages(stages: readonly Stage[]): Stage[];           // isActive, sort sortOrder tăng, trùng thì code tăng
export function stageOrder(stages: readonly Stage[]): StageCode[];         // activeStages(...).map(s => s.code)
export function stageName(stage: Pick<Stage, 'nameVi' | 'nameEn'>, locale: string): string; // locale === 'vi' ? nameVi : nameEn
export function stageNameMap(stages: readonly Stage[], locale: string): Record<StageCode, string>; // gồm CẢ giai đoạn ngừng dùng
export function fillWeightsForStages(rows: readonly StageWeightInput[], order: readonly StageCode[]): StageWeightInput[]; // đúng thứ tự order; thiếu -> {weightPct:0, applicable:true}; bỏ mã ngoài order
export function isSameStageSet(codes: readonly string[], order: readonly StageCode[]): boolean; // không trùng, cùng tập
export function nextCustomStageCode(existing: readonly string[]): StageCode; // 'custom_' + (max n của các mã custom_<n> + 1), không có -> 'custom_1'
// Đổi chữ ký (thêm tham số có mặc định, hành vi cũ giữ nguyên khi không truyền):
export function findCurrentStage(stages: StageInput[], order: readonly StageCode[] = STAGE_ORDER, weights?: readonly StageWeight[]): StageCode | null;
// weights có truyền -> bỏ qua giai đoạn có effectiveWeight = 0 (Q4a). Không truyền -> như cũ.

// value-chain-view.ts
export function valueChainColumns(stages: readonly Stage[]): [Stage[], Stage[]]; // [trái, phải], chỉ isActive, mỗi cột xếp như activeStages
export function chainFooterSummary(chain: ChainStageRow[], weights: ProjectStageWeight[], order: readonly StageCode[] = STAGE_ORDER): ChainFooterSummary;

// stage-timeline.ts
export function buildStageTimelineRows(ms: StageMilestoneView[], weights: ProjectStageWeight[], order: readonly StageCode[] = STAGE_ORDER): StageTimelineRow[];
/** Giai đoạn mặc định của "Biểu đồ so sánh": 'fabrication' nếu đang dùng, không thì giai đoạn volume đầu tiên, không thì giai đoạn đầu tiên, rỗng -> null. */
export function defaultCompareStage(stages: readonly Stage[]): StageCode | null;

// evm.ts
export function findBottleneck(chain: ValueChainProgress[], order?: readonly StageCode[], weights?: readonly StageWeight[]): StageCode | null; // chuyển tiếp sang findCurrentStage
```

`STAGE_ORDER`, `STAGE_CALC_MODE`, `DEFAULT_STAGE_WEIGHTS`, `VALUE_CHAIN_COLUMNS` GIỮ NGUYÊN ở Task này.
`STAGE_CALC_MODE` đổi kiểu thành `Record<string, StageCalcMode>` nếu tsc đòi (giá trị không đổi).

- [ ] **Bước 1: Viết test đỏ** (thêm `describe` mới, không sửa test cũ):
  - `activeStages`: bỏ `isActive=false`; `sortOrder` 2,1 → thứ tự 1,2; cùng `sortOrder` → theo `code`.
  - `stageName`: 'vi' → nameVi, 'en' → nameEn.
  - `stageNameMap`: có cả giai đoạn ngừng dùng.
  - `fillWeightsForStages`: thiếu `settlement` → thêm `{settlement, 0, true}`; có mã lạ `x` → bị bỏ; đúng thứ tự `order`.
  - `isSameStageSet`: đúng tập khác thứ tự → true; thiếu 1 → false; thừa 1 → false; trùng mã → false.
  - `nextCustomStageCode([])` → `custom_1`; `(['design','custom_2','custom_10'])` → `custom_11`; bỏ qua `custom_abc`.
  - `LEGACY_STAGE_WEIGHTS`: `validateStageWeights(...).ok === true`, tổng 100, `settlement` 0 áp dụng.
  - **0% áp dụng hợp lệ:** `validateStageWeights` với 1 giai đoạn áp dụng 0% và tổng 100 → ok (khoá luật chủ dự án yêu cầu, hiện đã đúng ở `stages.ts:110-124`).
  - **%TT dự án cũ không đổi:** chuỗi 7 dòng bất kỳ, `calcChainPctActual(chain7, LEGACY_STAGE_WEIGHTS)` bằng `calcChainPctActual(chain7, 7 dòng cũ)` (toBeCloseTo 10); thêm dòng `settlement` pct 0.3 cũng không đổi kết quả.
  - `findCurrentStage` có `order` 8 mã + `weights = LEGACY`: 7 giai đoạn xong 100%, settlement 0% → `null` (Q4a); không truyền weights → `'settlement'`.
  - `findCurrentStage` với `order` đảo (`['shop','design']`) → theo thứ tự `order`.
  - `valueChainColumns` với 8 giai đoạn seed mới (Task 2 định nghĩa, test tự dựng mảng): trái `['design','shop','procurement','fabrication']`, phải `['transport','erection','handover','settlement']`; giai đoạn ngừng dùng không xuất hiện; `custom_1` bên trái `sortOrder` 5 → cuối cột trái.
  - `chainFooterSummary(chain7, LEGACY 8 dòng, order 8)` → `weightOk` true, `pctTotal` bằng khi tính với 7 dòng cũ.
  - `buildStageTimelineRows(ms, w, order)` theo `order` truyền vào.
  - `defaultCompareStage`: có fabrication → 'fabrication'; fabrication ngừng dùng → 'shop' (volume đầu tiên); không có volume → giai đoạn đầu; rỗng → null.
- [ ] **Bước 2:** `npx vitest run src/lib/stages.test.ts src/lib/value-chain-view.test.ts src/lib/stage-timeline.test.ts` → ĐỎ.
- [ ] **Bước 3:** Cài đặt đúng interface trên.
- [ ] **Bước 4:** Test trên XANH, `npx tsc --noEmit`, `npm test` XANH.
- [ ] **Bước 5:** Commit `feat(p7-c2): ham thuan cho giai doan dong (them moi, chua go hang cu)`.

---

## Task 2: Schema + migration + rollback + seed + repo đọc giai đoạn

Không phụ thuộc câu hỏi.
File nóng: `schema.prisma` + `migrations/` (đã giữ), `prisma-repo.ts` (giữ trong Task này).

**Files:**
- Modify: `prisma/schema.prisma` (enum mới cạnh `StageCalcMode` dòng 56; model `Stage` dòng 462-480)
- Create: `prisma/migrations/20260927100000_p7_c2_stage_side/migration.sql`
- Create: `prisma/rollback/20260927100000_p7_c2_stage_side.down.sql`
- Modify: `src/data/seed/erp.ts` (dòng 5-16)
- Modify: `src/data/seed/history.ts` (dòng 69-73, 334-416, 638)
- Modify: `src/server/repo/prisma-repo.ts` (dòng 230-236)
- Modify: `src/server/repo/mock-repo.ts` (không đổi logic, chỉ khi tsc đòi)
- Test: `src/data/seed/history.test.ts`, `src/server/repo/read-prisma.test.ts` hoặc `src/server/repo/dim.test.ts` (chỗ đang test `getStages`, nếu chưa có thì thêm vào `dim.test.ts`)

**Schema:**

```prisma
enum StageSide {
  left
  right
}

model Stage {
  code      String        @id
  nameVi    String
  nameEn    String
  sortOrder Int
  calcMode  StageCalcMode @default(manual)
  side      StageSide     @default(left)
  isActive  Boolean       @default(true)
  // quan hệ giữ nguyên
  @@index([sortOrder])
  @@map("dim_stage")
}
```

Sửa comment model thành "Giai đoạn chuỗi giá trị (admin thêm được ở /admin)".

**migration.sql** (comment không dấu, đúng thứ tự):
1. `CREATE TYPE "StageSide" AS ENUM ('left', 'right');`
2. `ALTER TABLE "dim_stage" ADD COLUMN "side" "StageSide" NOT NULL DEFAULT 'left', ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;`
3. `UPDATE "dim_stage" SET "side" = 'right' WHERE "code" IN ('transport', 'erection', 'handover');`
4. `UPDATE "dim_stage" SET "nameVi" = 'Nghiệm thu' WHERE "code" = 'handover';` và `UPDATE "dim_stage" SET "nameEn" = 'Procurement' WHERE "code" = 'procurement';` (K5).
5. `INSERT INTO "dim_stage" ("code","nameVi","nameEn","sortOrder","calcMode","side","isActive") VALUES ('settlement','Thanh quyết toán','Settlement',8,'manual','right',true) ON CONFLICT ("code") DO NOTHING;`
6. Dự án chưa có dòng trọng số nào → chèn 7 dòng cũ:
   ```sql
   INSERT INTO "project_stage_weight" ("projectId","stageCode","weightPct","applicable")
   SELECT p."id", v.code, v.w, true
   FROM "dim_project" p
   CROSS JOIN (VALUES ('design',5),('shop',10),('procurement',10),('fabrication',40),('transport',5),('erection',27),('handover',3)) AS v(code, w)
   WHERE NOT EXISTS (SELECT 1 FROM "project_stage_weight" x WHERE x."projectId" = p."id");
   ```
7. Mọi dự án → Thanh quyết toán 0%, áp dụng:
   ```sql
   INSERT INTO "project_stage_weight" ("projectId","stageCode","weightPct","applicable")
   SELECT p."id", 'settlement', 0, true FROM "dim_project" p
   ON CONFLICT ("projectId","stageCode") DO NOTHING;
   ```
   Chỉ chạy bước 6 TRƯỚC bước 7 (nếu đảo, bước 6 thấy đã có dòng settlement và bỏ qua).

**rollback .down.sql** (đầu file ghi "Revert code truoc, roi moi chay file nay" + lệnh `npx prisma db execute --file ... --schema prisma/schema.prisma`, trong `BEGIN; ... COMMIT;`):
1. Xoá dữ liệu tham chiếu `settlement` và mọi mã `custom\_%` (admin đã thêm) ở `project_stage_weight`, `fact_value_chain_progress`, `fact_stage_work_item`, `fact_stage_milestone`; `UPDATE "fact_progress_monthly" SET "bottleneckStage" = NULL WHERE` mã thuộc nhóm trên.
2. `DELETE FROM "dim_stage" WHERE "code" = 'settlement' OR "code" LIKE 'custom\_%';`
3. Trả 2 tên cũ: `handover.nameVi = 'Nghiệm thu & Bàn giao'`, `procurement.nameEn = 'Materials'`.
4. `ALTER TABLE "dim_stage" DROP COLUMN "side", DROP COLUMN "isActive";` rồi `DROP TYPE "StageSide";`
5. `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260927100000_p7_c2_stage_side';`
Ghi chú trong file: không xoá 7 dòng trọng số đã chèn ở bước 6 (trùng bộ fallback, vô hại); dự án đã đặt Thanh quyết toán lớn hơn 0 sẽ có tổng trọng số dưới 100 sau rollback, phải sửa tay.

**Seed (`src/data/seed/erp.ts`):** mảng `stages` 8 phần tử, thêm `side`, `isActive: true`; tên khớp K5 (`handover` 'Nghiệm thu', `procurement` en 'Procurement'); `settlement` như bước 5; `calcMode` ghi giá trị trực tiếp (`'manual'`/`'volume'`), không đọc `STAGE_CALC_MODE`. Sửa comment "7 giai đoạn".

**Seed (`src/data/seed/history.ts`)**, mục tiêu: dữ liệu demo = "dự án cũ sau migration", số %TT không đổi:
- `buildStageWeights`: dùng `LEGACY_STAGE_WEIGHTS` (8 dòng/dự án).
- `STAGE_WEIGHT_FRACTIONS` (dòng 70), `buildStageMilestones` (dòng 354): dùng `LEGACY_STAGE_WEIGHTS.filter(w => w.weightPct > 0)` (đúng 7 giai đoạn như cũ, không sinh dòng chuỗi/mốc cho settlement).
- `buildWorkItems` (dòng 394-403): giai đoạn volume lấy từ `stages` (erp.ts) lọc `calcMode === 'volume'`; `idx` = vị trí trong `SEED_STAGE_CODES`.
- `findBottleneck(chain)` (dòng 638): truyền `SEED_STAGE_CODES` và `LEGACY_STAGE_WEIGHTS`.

**Repo:** `prisma-repo.ts getStages()` map thêm `side: s.side as StageSide, isActive: s.isActive`. Trả CẢ giai đoạn ngừng dùng (lọc ở hàm thuần). `mock-repo.ts getStages()` giữ nguyên (seed đã có trường mới).

- [ ] **Bước 1: Test đỏ:** `history.test.ts`: `data.stages` dài 8, `sortOrder` 1..8; bên trái đúng 4 mã, bên phải đúng 4 mã theo `valueChainColumns`; mỗi dự án có 8 dòng trọng số, `settlement` 0 áp dụng, `validateStageWeights` ok; `data.valueChain` không có dòng `settlement`. Test `getStages` mock trả `side`/`isActive`.
- [ ] **Bước 2:** chạy → ĐỎ.
- [ ] **Bước 3:** Sửa schema, viết migration + rollback, `npx prisma generate`, sửa seed + repo. Sửa các test cũ đang khẳng định 7 dòng trọng số/7 stage (`history.test.ts:58-65`, `form.test.ts:119, 250` nếu đỏ) cho khớp 8 dòng.
- [ ] **Bước 4: Kiểm migration trên DB `_c`:**
  1. Trước khi deploy, lưu kết quả `SELECT "projectId", SUM("weightPct") FILTER (WHERE "applicable") AS s, COUNT(*) FROM "project_stage_weight" GROUP BY 1 ORDER BY 1;` và `SELECT COUNT(*) FROM "dim_project";` vào `thay-doi.md`.
  2. `npx prisma migrate deploy` → kiểm: `dim_stage` 8 dòng, `side` đúng 4/4; mọi dự án có dòng `settlement` 0 áp dụng; tổng trọng số áp dụng từng dự án bằng số đã lưu ở bước 1 (dự án chưa từng có dòng thì giờ = 100).
  3. Diễn tập rollback: chạy `.down.sql` → `migrate status` báo migration chưa áp → `migrate deploy` lại → kiểm lại như bước 2.
  4. `npx prisma db seed` trên `_c`, `npm run check:read`.
- [ ] **Bước 5:** `npx tsc --noEmit`, `npm test` XANH.
- [ ] **Bước 6:** Commit `feat(p7-c2): dim_stage them side/isActive, giai doan settlement, trong so 0% cho du an cu`. Nhả `prisma-repo.ts`.

---

## Task 3: Server nhận danh sách giai đoạn động

Phụ thuộc Q4.
File nóng: `actions.ts`, `project-queries.ts`, `vi.json`, `en.json`.

**Files:**
- Modify: `src/server/validation.ts` (dòng 54-66, 97-107)
- Modify: `src/server/actions.ts` (dòng 120-127 khối kiểm trước ghi, 156-164, 219-265)
- Modify: `src/server/actions-project.ts` (dòng 124-144)
- Modify: `src/server/project-queries.ts` (dòng 150-165)
- Modify: `src/i18n/messages/vi.json`, `en.json`
- Test: `src/server/validation.test.ts`, `src/server/actions-valuechain.test.ts`, `src/server/actions-project.test.ts`, `src/server/project-queries.test.ts`

**Interfaces:**

```ts
// validation.ts
export const stageCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{1,31}$/);
// chain: z.array(z.object({ stageCode: stageCodeSchema, pctComplete: pct, applicable: z.boolean() }))
//   .min(1).max(STAGE_MAX_COUNT).refine(mã không trùng, { message: 'stageCode bi trung' }).optional()
// stageWeightRowsSchema: tương tự, .min(1).max(STAGE_MAX_COUNT) + không trùng. Xoá STAGE_CODES.

// actions.ts saveMonthlyData: thêm lỗi 'stages_changed'
// actions.ts createProjectAction + actions-project.ts saveStageWeightsAction: thêm lỗi 'stages_changed'
```

Luật:
- `saveMonthlyData`: nếu có `chain`, trong khối "kiểm TRƯỚC mọi ghi" (cạnh kiểm factory, trước `saveProjectProfile`): `const order = stageOrder(await repo.getStages()); if (!isSameStageSet(chain.map(c => c.stageCode), order)) return { ok: false, error: 'stages_changed' };`. Sau đó `bottleneckStage = findCurrentStage(chain, order, weights)` (Q4a: truyền weights; Q4b: không truyền weights).
- `createProjectAction`: `stageWeights` có gửi → kiểm cùng tập với giai đoạn đang dùng TRƯỚC khi tạo dự án, lệch → `'stages_changed'`.
- `saveStageWeightsAction`: sau zod, kiểm cùng tập → `'stages_changed'`; kiểu trả thêm `'stages_changed'`.
- `getWorkItemComparison`: `const stages = activeStages(await repo.getStages());` duyệt `stages.filter(s => s.calcMode === 'volume')`; bỏ import `STAGE_ORDER`, `STAGE_CALC_MODE`.
- i18n (nối cuối nhóm có sẵn): `projectForm.err.stages_changed` = "Danh sách giai đoạn vừa được quản trị thay đổi - tải lại trang rồi nhập lại trọng số." / "The stage list was just changed by an admin - reload the page and re-enter the weights."; `dataGuard.save.stagesChanged` = "Danh sách giai đoạn vừa được quản trị thay đổi - tải lại trang rồi nhập lại tiến độ." / "The stage list was just changed by an admin - reload the page and re-enter progress.".

- [ ] **Bước 1: Test đỏ:**
  - `validation.test.ts`: chain 8 mã hợp lệ → pass; mã `'Bad Code'` → fail; trùng mã → fail; 31 dòng → fail. Sửa test cũ "đủ 7 giai đoạn".
  - `actions-valuechain.test.ts`: chain 7 mã (thiếu settlement) → `{ ok:false, error:'stages_changed' }` và KHÔNG ghi gì (hồ sơ, chuỗi, fact đều không đổi); chain 8 mã → ok, `pctActual` bằng khi tính 7 mã cũ với LEGACY; 7 giai đoạn 100% + settlement 0% → `bottleneckStage` null (Q4a). Sửa helper `chain()` dùng `SEED_STAGE_CODES`.
  - `actions-project.test.ts`: `saveStageWeightsAction(1, 7 dòng)` → `'stages_changed'`; 8 dòng LEGACY → ok; thêm Thanh quyết toán 2 bớt Lắp dựng 2 → ok.
  - `project-queries.test.ts`: `getWorkItemComparison` không đổi kết quả với seed.
- [ ] **Bước 2:** chạy → ĐỎ.
- [ ] **Bước 3:** Cài đặt.
- [ ] **Bước 4:** tsc + `npm test` XANH.
- [ ] **Bước 5:** Commit `feat(p7-c2): server kiem danh sach giai doan dong, loi stages_changed`. Nhả `actions.ts`, `project-queries.ts`, `vi.json`, `en.json`.

---

## Task 4: Form nhập tiến độ tháng (`/nhap-lieu`)

Phụ thuộc Q4.

**Files:**
- Modify: `app/[locale]/(app)/nhap-lieu/page.tsx` (dòng 43-50, 99-121)
- Modify: `src/components/form/DataEntryForm.tsx` (props dòng 49-97, dòng 103-106, 166-187, 365-401, 488-491)
- Modify: `src/components/form/dataEntryState.ts`
- Test: `src/components/form/dataEntryState.test.ts`, test render `DataEntryForm` nếu có (tìm `DataEntryForm` trong `*.test.ts`)

**Interfaces:**

```ts
// dataEntryState.ts - thêm tham số order (bắt buộc), bỏ import STAGE_ORDER
export function buildBaseForm(project, fact, financial, chain, volumeTonnage: number | null, order: readonly StageCode[]): FormState;
export function stageInputsOf(form: FormState, order: readonly StageCode[]): { stageCode: StageCode; pctComplete: number; applicable: boolean }[];
export function formsEqual(a: FormState, b: FormState, order: readonly StageCode[]): boolean;
export function buildSavePatch(base: FormState, form: FormState, opts: { canEditFinance: boolean; order: readonly StageCode[] }): SaveMonthlyPatch;
export function draftFieldsEqual(a: FormState, b: FormState, order: readonly StageCode[]): boolean;
export type SaveErrorKind = 'forbidden' | 'locked' | 'notFound' | 'stagesChanged' | 'generic'; // 'stages_changed' -> 'stagesChanged'

// DataEntryForm props thêm:
stages: Stage[];                    // repo.getStages() (cả ngừng dùng; component tự lọc activeStages)
stageWeights: ProjectStageWeight[]; // repo.getStageWeights(project.id)
```

Luật trong `DataEntryForm`:
- `const locale = useLocale(); const active = activeStages(stages); const order = active.map(s => s.code);`
- Lưới giai đoạn duyệt `active`, tên = `stageName(s, locale)`.
- `derivedPctActual = calcChainPctActual(stageInputs, stageWeights)` (K11). `currentStage = findCurrentStage(stageInputs, order, stageWeights)`; tên hiện = `stageNameMap(stages, locale)[currentStage]`.
- Bản nháp cũ có mã đã ngừng dùng: bỏ qua (vì mọi hàm chỉ duyệt `order`). Bản nháp thiếu mã mới: lấy giá trị base.
- `nhap-lieu/page.tsx`: nạp `repo.getStages()` và `repo.getStageWeights(project.id)` (chỉ khi có project), truyền xuống.

- [ ] **Bước 1: Test đỏ** (`dataEntryState.test.ts`): order 8 mã → `buildBaseForm` có `stagePct.settlement === ''`, `stageApplicable.settlement === true` khi chain chỉ có 7 dòng; `buildSavePatch` khi đổi settlement → `patch.chain` dài 8; order có `custom_1` → có mặt trong patch; `saveErrorKind('stages_changed') === 'stagesChanged'`; `restoreDraft` với nháp chứa mã lạ `x` + `stageInputsOf(..., order)` không chứa `x`. Sửa các test cũ truyền `SEED_STAGE_CODES` làm order (`toHaveLength(7)` dòng 155 → 8).
- [ ] **Bước 2:** ĐỎ. **Bước 3:** cài đặt. **Bước 4:** tsc + `npm test` XANH.
- [ ] **Bước 5:** Commit `feat(p7-c2): form nhap tien do doc giai doan tu DB, xem truoc %TT theo trong so du an`.

---

## Task 5: Trọng số dự án (`/ho-so-du-an`) + bộ mặc định mới + bộ theo loại

Phụ thuộc Q2, Q3.

**Files:**
- Modify: `src/lib/stages.ts` (`DEFAULT_STAGE_WEIGHTS` dòng 43-51)
- Modify: `src/lib/stage-weight-presets.ts`
- Modify: `src/components/form/StageWeightEditor.tsx`
- Modify: `src/components/form/ProjectForm.tsx` (dòng 61-66, 88, 115, 209, 375-376, 623-626)
- Modify: `app/[locale]/(app)/ho-so-du-an/page.tsx` (dòng 32, 56-75)
- Modify: `src/server/repo/prisma-repo-form.ts` (dòng 69-77, 160-161), `src/server/repo/mock-repo-form.ts` (dòng 27-35, 92)
- Modify: `src/lib/data-dictionary.ts` (dòng 61-64)
- Test: `src/lib/stage-weight-presets.test.ts`, `src/lib/stage-weight-presets.qa.test.ts`, `src/components/form/StageWeightEditor.test.ts`, `src/components/form/ProjectForm.test.ts`, `src/server/repo/form.test.ts`, `src/server/repo/prisma-repo-form.test.ts`, `src/data/seed/history.test.ts:71`

**Nội dung:**
- `DEFAULT_STAGE_WEIGHTS` (Q2a): design 5, shop 10, procurement 10, fabrication 40, transport 5, erection 25, handover 3, settlement 2, đều áp dụng. (Q2b: erection 27, settlement 0.)
- `STAGE_WEIGHT_PRESETS` (Q3a): `build()` duyệt `SEED_STAGE_CODES`, mỗi mảng 8 số, Lắp dựng trừ 2, cuối thêm 2:
  - EPC `[8,10,15,32,5,25,3,2]`, San_bay `[4,8,8,42,5,28,3,2]`, San_van_dong `[5,10,8,38,6,28,3,2]`, Nha_xuong `[3,7,20,38,5,22,3,2]`, Cau_cang `[5,10,10,38,10,22,3,2]`, Cao_tang `[5,12,10,35,5,28,3,2]`, Dong_tau `[8,12,15,45,2,13,3,2]`, Cau_giao_thong `[6,10,10,37,8,24,3,2]`, Khac = `DEFAULT_STAGE_WEIGHTS`.
  - (Q3b: giữ số cũ, thêm 0 ở cuối.)
- `presetWeightsFor(type: ProjectType | '', order?: readonly StageCode[]): StageWeightInput[]` → có `order` thì qua `fillWeightsForStages`.
- `StageWeightEditor` props thêm `stages: Stage[]` (danh sách đang dùng, đã xếp); duyệt `stages`, tên `stageName(s, useLocale())`; bỏ `STAGE_ORDER`, `stageKey`.
- `ProjectForm` props thêm `stages: Stage[]` (page truyền `repo.getStages()`); `const order = stageOrder(stages)`; `weightsFromProps(rows)` → `fillWeightsForStages(rows, order)`; tạo mới → `fillWeightsForStages(DEFAULT_STAGE_WEIGHTS, order)`; đổi loại/áp bộ → `presetWeightsFor(type, order)`; khôi phục nháp (dòng 375): bỏ điều kiện `length === 7`, luôn `setWeights(fillWeightsForStages(draft.stageWeights, order))`; truyền `stages={activeStages(stages)}` cho `StageWeightEditor`.
- `stageWeightAuditText` (2 file repo form): duyệt `rows` theo thứ tự nhận vào, bỏ `STAGE_ORDER`. `beforeRows` fallback giữ `DEFAULT_STAGE_WEIGHTS`.
- `data-dictionary.ts`: câu mặc định đổi theo bộ mới (thêm "Thanh quyết toán 2", Lắp dựng 25, tên "Nghiệm thu"); "7 giai đoạn" → "các giai đoạn áp dụng"; "Cộng cả 7 dòng" → "Cộng tất cả các dòng". Bản en tương ứng.

- [ ] **Bước 1: Test đỏ:** `DEFAULT_STAGE_WEIGHTS` = `[5,10,10,40,5,25,3,2]` và hợp lệ; mọi preset dài 8, đúng thứ tự `SEED_STAGE_CODES`, hợp lệ, đúng số từng loại; `presetWeightsFor('EPC', [...8 mã, 'custom_1'])` có `custom_1` 0 áp dụng và vẫn hợp lệ; `StageWeightEditor` render với 8 stage → có "Thanh quyết toán" và dòng 0% áp dụng vẫn báo `projectForm.weights.ok`; `ProjectForm` chế độ tạo mới render có đủ 8 dòng; audit text `replaceStageWeights` chứa `settlement:0`.
- [ ] **Bước 2:** ĐỎ. **Bước 3:** cài đặt. **Bước 4:** tsc + `npm test` XANH.
- [ ] **Bước 5:** Commit `feat(p7-c2): trong so mac dinh 8 giai doan, bo theo loai, bang trong so doc giai doan tu DB`.

---

## Task 6: Trang Chi tiết - thẻ "Chuỗi giá trị quản lý dự án" đọc cột từ DB

Phụ thuộc Q5.
File nóng: `vi.json`, `en.json`. File B đang redesign: 3 file dưới, chỉ sửa dòng dữ liệu.

**Files:**
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx`
- Modify: `src/components/project/StageExplorer.tsx`
- Modify: `src/components/project/StageTimelineChart.tsx`
- Modify: `src/i18n/messages/vi.json`, `en.json`
- Test: `src/server/projects-detail-page-render.test.ts`, `src/components/project/StageExplorer.test.ts`
- Create: `e2e/12-chuoi-gia-tri.spec.ts` (kịch bản 1 và 4 ở Task 9), chạy ĐỎ trước khi code.

**page.tsx (chỉ các dòng này):**
- Thêm `repo.getStages()` vào cuối mảng `Promise.all` (dòng 95-121) và biến `stages` cuối destructuring.
- Sau dòng 146: `const order = stageOrder(stages); const stageNames = stageNameMap(stages, locale); const chainColumns = valueChainColumns(stages);`
- Dòng 146: `buildStageTimelineRows(stageMilestones, stageWeights, order)`. Dòng 154: `chainFooterSummary(chain, stageWeights, order)`.
- Dòng 157-159: `const stageLabels = stageNames;` (xoá khối `Object.fromEntries`). Sửa comment "7 giai doan".
- Dòng 309: `{stageNames[bottleneck.stageCode] ?? bottleneck.stageCode}`.
- Dòng 317-335: `chainColumns.map((column, i) => ...)`, `column.map((s) => { const stage = s.code; ...`, `name={stageNames[stage]}`; giữ nguyên toàn bộ JSX/class/style khác.
- Dòng 350: thêm prop `stages={stages}` cho `StageExplorer`.
- Bỏ import `stageKey`, `VALUE_CHAIN_COLUMNS`, `StageCode` nếu không còn dùng.

**StageExplorer.tsx:** prop mới `stages: Stage[]`; `const names = stageNameMap(stages, locale)`; `cmpStage = selected ?? defaultCompareStage(stages)`; `cmpStage` null → hiện `detail.cmp.empty`; `calcMode` tra từ `stages.find(s => s.code === cmpStage)`; truyền `stageNames={names}` cho `StageTimelineChart`; bỏ `stageKey`, `STAGE_CALC_MODE`. Sửa comment "7 giai đoạn".

**StageTimelineChart.tsx:** prop mới `stageNames: Record<StageCode, string>`; dòng 53 và 62 dùng `stageNames[r.stageCode] ?? r.stageCode`; bỏ `stageKey`.

**i18n:** `detail.valueChain` "Chuỗi giá trị quản lý dự án" / "Project Management Value Chain"; `detail.stageMs.title` "Timeline các giai đoạn" / "Stage timeline"; `valueChainCard.allStages` "Toàn bộ giai đoạn" / "All stages".

- [ ] **Bước 1: Test đỏ** (`projects-detail-page-render.test.ts`, sửa khối dòng 168-190): tiêu đề thẻ = `detail.valueChain`; thứ tự xuất hiện trong HTML: cột trái "Thiết kế" < "Shop Drawing" < "Vật tư" < "Gia công", tất cả trước cột phải "Vận chuyển" < "Lắp dựng" < "Nghiệm thu" < "Thanh quyết toán" (so bằng tên từ seed, không còn `>stage.xxx<`); giai đoạn `isActive=false` không xuất hiện (mock repo đặt tạm 1 giai đoạn ngừng dùng); `custom_1` bên trái xuất hiện ngay sau "Gia công". `StageExplorer.test.ts`: tên giai đoạn lấy từ `stages` (dòng 26 đổi sang tên seed).
- [ ] **Bước 2:** ĐỎ. **Bước 3:** cài đặt. **Bước 4:** tsc + `npm test` XANH; chạy dev cổng 3003, mở `/vi/projects/1` ở 1440 và 390, chụp thẻ Chuỗi giá trị (2 cột 4+4, không vỡ bố cục).
- [ ] **Bước 5:** Commit `feat(p7-c2): the chuoi gia tri quan ly du an doc cot trai/phai tu dim_stage`. Nhả `vi.json`, `en.json`.

---

## Task 7: Gỡ hằng cứng + chữ "7 giai đoạn"

File nóng: `vi.json`, `en.json`.

**Files:**
- Modify: `src/lib/stages.ts` (xoá `STAGE_ORDER`, `STAGE_CALC_MODE`, `calcStageContributions`, interface `StageContribution`; `findCurrentStage` bỏ giá trị mặc định của `order`; `calcChainPctActual` bỏ giá trị mặc định của `weights`)
- Modify: `src/lib/value-chain-view.ts` (xoá `VALUE_CHAIN_COLUMNS`; `order` bắt buộc), `src/lib/stage-timeline.ts` (`order` bắt buộc), `src/lib/evm.ts` (`order` bắt buộc)
- Modify: `src/lib/labels.ts` (xoá `stageKey`, bỏ import `StageCode`)
- Modify: `src/data/seed/erp.ts` dòng 159 (bỏ re-export `STAGE_ORDER`)
- Modify: `src/i18n/messages/vi.json`, `en.json`: xoá nhóm `stage`; `form.stageSection` "Tiến độ theo giai đoạn" / "Progress by stage"; `projectForm.steps.s5` "Trọng số các giai đoạn" / en bỏ số 7 tương ứng; `projectForm.sec.weights.title` "Chuỗi giá trị - trọng số các giai đoạn" / en bỏ số 7; `projectForm.help.projectType` "bộ trọng số 7 giai đoạn" → "bộ trọng số các giai đoạn" (en tương ứng). Coder mở đúng key ở `en.json` và chỉ bỏ số "7"/"seven", giữ phần còn lại.
- Modify comment có chữ "7 giai đoạn": `ValueChainModeChip.tsx`, `StageSelectionContext.tsx`, `StageWeightEditor.tsx`, `dataEntryState.ts:94`, `validation.ts:97`, `mock-repo.ts:688`, `thresholds.ts:25`, `value-chain-view.ts:35`.
- Test: mọi test còn import `STAGE_ORDER`/`STAGE_CALC_MODE`/`VALUE_CHAIN_COLUMNS`/`stageKey`/`calcStageContributions` (danh sách từ grep ở "Bản đồ phụ thuộc": `stages.test.ts`, `value-chain-view.test.ts`, `stage-timeline.test.ts`, `stage-weight-presets.qa.test.ts`, `actions-project.qa.test.ts`, `actions-valuechain.test.ts`, `validation.test.ts`, `valuechain.test.ts`, `dataEntryState.test.ts`, `evm.test.ts`, `ValueChainModeChip.test.ts`) chuyển sang `SEED_STAGE_CODES` hoặc mảng tự dựng.
- Create: `src/lib/stages-nguon-dong.test.ts` - test tĩnh: đọc mọi file `.ts/.tsx` (không phải `*.test.ts`) dưới `app/` và `src/`, trừ `src/lib/stages.ts`, `src/lib/stage-weight-presets.ts`, `src/data/seed/`; khẳng định không file nào chứa `SEED_STAGE_CODES` hoặc `LEGACY_STAGE_WEIGHTS`, và không file nào còn chứa `STAGE_ORDER`, `STAGE_CALC_MODE`, `VALUE_CHAIN_COLUMNS`, `stageKey`.

- [ ] **Bước 1:** Viết `stages-nguon-dong.test.ts` → ĐỎ (hằng cũ còn).
- [ ] **Bước 2:** Gỡ hằng, sửa test, sửa i18n + comment.
- [ ] **Bước 3:** `grep` lại `STAGE_ORDER|STAGE_CALC_MODE|VALUE_CHAIN_COLUMNS|stageKey|calcStageContributions|'stage\.` trong `src/`, `app/`, `e2e/` → chỉ còn trong test tĩnh.
- [ ] **Bước 4:** tsc + `npm test` XANH (ghi số test gỡ theo `calcStageContributions` vào `thay-doi.md`).
- [ ] **Bước 5:** Commit `refactor(p7-c2): go hang giai doan cung, bo chu 7 giai doan`. Nhả `vi.json`, `en.json`.

---

## Task 8: Màn quản trị giai đoạn trên `/admin`

Phụ thuộc Q1.
File nóng: `vi.json`, `en.json`.

**Files:**
- Modify: `src/server/validation.ts` (thêm `stageSchema` cạnh `factorySchema` dòng 325)
- Modify: `src/server/repo/prisma-repo-entry.ts` (thêm sau `setFactoryActive`)
- Modify: `src/server/repo/mock-repo-entry.ts` (thêm sau `setFactoryActive`)
- Modify: `src/server/actions-master.ts` (thêm sau `setFactoryActiveAction`)
- Create: `src/components/admin/StageEditor.tsx`
- Modify: `app/[locale]/(app)/admin/page.tsx` (thêm Card ngay sau Card `factoryAdmin` dòng 94-99)
- Modify: `src/i18n/messages/vi.json`, `en.json` (nhóm mới `stageAdmin` cuối file; 3 key `activity.*` cuối nhóm `activity`)
- Modify: `src/i18n/messages.test.ts` (thêm `'StageEditor': 'src/components/admin/StageEditor.tsx'` cuối `CHANGED_SOURCES`)
- Test: `src/server/actions-master.test.ts`, `src/server/repo/entry.test.ts`, `src/server/repo/prisma-repo-entry.test.ts`, Create `src/components/admin/StageEditor.test.ts`
- Modify: `e2e/12-chuoi-gia-tri.spec.ts` (nối kịch bản 2 và 3 ở Task 9), chạy ĐỎ trước khi code.

**Interfaces:**

```ts
// validation.ts
export const stageSchema = z.object({
  code: stageCodeSchema.optional(),                 // không có = tạo mới
  nameVi: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  side: z.enum(['left', 'right']),
  sortOrder: z.number().int().min(1).max(999),
  calcMode: z.enum(['manual', 'volume']),
});
export type StageInputAdmin = z.infer<typeof stageSchema>;

// repo (prisma + mock cùng chữ ký; mock trả đồng bộ)
saveStage(input: StageInputAdmin, by: string): Promise<Stage | 'duplicate_name' | 'not_found' | 'too_many'>;
setStageActive(code: StageCode, isActive: boolean, by: string): Promise<'ok' | 'not_found' | 'in_use' | 'last_active'>;

// actions-master.ts
export async function saveStageAction(input: StageInputAdmin):
  Promise<{ ok: true; code: StageCode } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'duplicate_name' | 'Not found' | 'too_many' }>;
export async function setStageActiveAction(code: StageCode, isActive: boolean):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'in_use' | 'last_active'; count?: number }>;
```

Luật repo:
- `saveStage` tạo mới: trùng `nameVi` (không phân biệt hoa thường, `trim`) với giai đoạn khác → `'duplicate_name'`; tổng số giai đoạn ≥ `STAGE_MAX_COUNT` → `'too_many'`; `code = nextCustomStageCode(mã hiện có)`; trong 1 transaction: tạo `dim_stage` (`isActive: true`), `projectStageWeight.createMany` 0% áp dụng cho mọi `dim_project` (`skipDuplicates: true`) (K10), `audit(tx, 'dim_stage', code, 'create', '', 'nameVi/nameEn/side/sortOrder/calcMode', by)`.
- `saveStage` sửa: `code` không có → `'not_found'`; cập nhật 5 trường, KHÔNG đổi `code`, `isActive`; audit `field = 'nameVi,nameEn,side,sortOrder,calcMode'`, cũ/mới nối bằng `/` (khuôn `saveFactory`).
- `setStageActive(code, false)` (Q1a): đếm dự án có dòng trọng số của `code` với `applicable = true AND weightPct > 0`; > 0 → `'in_use'` (action trả kèm `count`); nếu sau khi tắt không còn giai đoạn nào đang dùng → `'last_active'`; hợp lệ → cập nhật + audit `'isActive'`.
- `setStageActive(code, true)`: cập nhật + audit; không đổi trọng số (dự án thiếu dòng được `fillWeightsForStages` coi là 0%).
- Action: `requireRoleUser(['admin'])` → không phải admin trả `'Forbidden'` TRƯỚC khi parse; `code` ở `setStageActiveAction` kiểm bằng `stageCodeSchema`; thành công → `logActivity(user, 'save_stage', nameVi)` / `'activate_stage'` / `'deactivate_stage'` với `code`; `revalidateTag(profileTag)` + `overviewTag(m)` và `listTag(m)` cho mọi `historyMonths()`.

**StageEditor.tsx** (khuôn `FactoryEditor.tsx`, cùng class `tbl sticky`, `inp`, `btn ghost`, `sumbar bad`, không thêm CSS):
- Props `{ stages: Stage[] }` (mọi giai đoạn, page truyền `await repo.getStages()`), hiển thị xếp theo `sortOrder` rồi `code`.
- Cột: Thứ tự (`input number`, step 1) · Tên (VI) · Tên (EN) · Bên (`select` Trái/Phải) · Cách tính (`select` Nhập tay/Theo sản lượng) · Trạng thái (Đang dùng/Ngừng dùng) · nút Lưu + Ngừng dùng/Dùng lại.
- Dòng cuối để thêm mới: các ô trống, Bên mặc định Trái, Cách tính mặc định Nhập tay, nút Thêm.
- Kiểm phía client trước khi gọi: tên vi/en không rỗng, thứ tự nguyên 1..999 → sai hiện `stageAdmin.err.invalid`.
- Lỗi server → `stageAdmin.err.<error>`; `in_use` hiện kèm số dự án.
- Dưới bảng: `stageAdmin.hint` (giải thích Bên, Thứ tự, Cách tính theo K15, luật ngừng dùng theo Q1).

**i18n nhóm `stageAdmin`** (vi / en):
`title` "Giai đoạn chuỗi giá trị" / "Value chain stages"; `order` "Thứ tự" / "Order"; `nameVi` "Tên (VI)" / "Name (VI)"; `nameEn` "Tên (EN)" / "Name (EN)"; `side` "Bên" / "Side"; `left` "Trái" / "Left"; `right` "Phải" / "Right"; `calcMode` "Cách tính" / "Calc mode"; `manual` "Nhập tay" / "Manual"; `volume` "Theo sản lượng" / "By volume"; `status` "Trạng thái" / "Status"; `active` "Đang dùng" / "Active"; `inactive` "Ngừng dùng" / "Inactive"; `save` "Lưu" / "Save"; `add` "Thêm" / "Add"; `deactivate` "Ngừng dùng" / "Deactivate"; `activate` "Dùng lại" / "Reactivate"; `hint` "Bên: cột hiển thị ở thẻ Chuỗi giá trị quản lý dự án. Thứ tự: xếp trong cột và trong chuỗi (số nhỏ đứng trước). Cách tính Theo sản lượng chỉ dùng cho thẻ Biểu đồ so sánh; %HT vẫn nhập tay ở Nhập liệu. Giai đoạn mới được thêm 0% vào trọng số mọi dự án. Chỉ ngừng dùng được khi không dự án nào đặt trọng số lớn hơn 0%." / bản en tương ứng; `err.invalid` "Tên không được trống, thứ tự là số nguyên 1-999" / en; `err.duplicate_name` "Đã có giai đoạn trùng tên" / en; `err.too_many` "Tối đa 30 giai đoạn" / en; `err.in_use` "Còn {n} dự án đang đặt trọng số lớn hơn 0% cho giai đoạn này - sửa về 0% trước" / en; `err.last_active` "Phải còn ít nhất 1 giai đoạn đang dùng" / en; `err.generic` "Lưu thất bại" / "Save failed".
`activity.save_stage` "Lưu giai đoạn chuỗi giá trị" / "Save value chain stage"; `activity.activate_stage` "Dùng lại giai đoạn" / "Reactivate stage"; `activity.deactivate_stage` "Ngừng dùng giai đoạn" / "Deactivate stage".

- [ ] **Bước 1: Test đỏ:**
  - `actions-master.test.ts`: viewer, bod, data-entry gọi `saveStageAction`/`setStageActiveAction` → `'Forbidden'` và không đổi dữ liệu; admin tạo "Bảo hành" bên trái thứ tự 5 → `code === 'custom_1'`, `getStages()` có nó, MỌI dự án có dòng trọng số `custom_1` 0 áp dụng, audit `dim_stage` có dòng `create`; tạo trùng tên "thanh quyết toán" → `'duplicate_name'`; sửa `settlement` sang bên trái → `valueChainColumns` đưa nó sang cột trái; ngừng dùng `fabrication` (seed có 40%) → `{ ok:false, error:'in_use', count: <số dự án> }`; ngừng dùng `custom_1` (0% mọi dự án) → ok, `stageOrder` không còn `custom_1`; dùng lại → có lại; tắt tới giai đoạn cuối → `'last_active'`; `nameVi` rỗng → `'Invalid input'`; `code` `'Bad Code'` → `'Invalid input'`.
  - `entry.test.ts` (mock) + `prisma-repo-entry.test.ts` (Prisma, khuôn test có sẵn trong file): `saveStage` `not_found`, `too_many` (dựng 30 giai đoạn), transaction chèn trọng số.
  - `StageEditor.test.ts`: render 8 giai đoạn seed có đủ tên, có dòng thêm mới, giai đoạn ngừng dùng hiện nút `stageAdmin.activate`.
  - `messages.test.ts` tự bắt key thiếu khi thêm `StageEditor` vào `CHANGED_SOURCES`.
- [ ] **Bước 2:** ĐỎ. **Bước 3:** cài đặt. **Bước 4:** tsc + `npm test` XANH.
- [ ] **Bước 5:** Commit `feat(p7-c2): man quan tri giai doan (them, sua ben/thu tu/ten, ngung dung)`. Nhả `vi.json`, `en.json`.

---

## Task 9: Tài liệu dữ liệu + e2e + kiểm toàn bộ

**Files:**
- Modify: `src/lib/schema-meta/docs.ts` (dòng 73-83): `desc` "Giai đoạn chuỗi giá trị - admin thêm/sửa ở /admin; không xoá, chỉ ngừng dùng."; `code` "khoá chính ('design'…'settlement', giai đoạn admin thêm là 'custom_<n>')"; thêm `side` "bên hiển thị ở thẻ Chuỗi giá trị quản lý dự án: left | right"; `isActive` "false = ngừng dùng (ẩn khỏi chart, form; giữ số liệu cũ)".
- Regenerate: `docs/DATA_WAREHOUSE_README.md` bằng `npm run docs:erd` (KHÔNG sửa tay).
- Kiểm: `e2e/12-chuoi-gia-tri.spec.ts` (đã tạo ở Task 6, nối ở Task 8; nội dung 4 kịch bản dưới đây)

**e2e (`storageState: 'e2e/.auth/admin.json'`, chữ lấy qua `vi()` của `e2e/helpers/i18n.ts`):**
1. `/vi/projects/1`: thẻ `.valueChainCard` có tiêu đề `vi('detail.valueChain')`; `.stagecol` thứ 0 các `.stage .nm` = ["Thiết kế","Shop Drawing","Vật tư","Gia công"]; `.stagecol` thứ 1 = ["Vận chuyển","Lắp dựng","Nghiệm thu","Thanh quyết toán"]; chân thẻ Σ trọng số "100%".
2. `/vi/admin`: trong `.card` có `vi('stageAdmin.title')`, dòng thêm mới nhập "E2E GĐ <Date.now()>" / "E2E stage", Bên Trái, Thứ tự 5, bấm `vi('stageAdmin.add')` → dòng mới xuất hiện; mở `/vi/projects/1` → tên mới là phần tử cuối của cột trái; mở `/vi/ho-so-du-an?project=1` → bảng trọng số có dòng tên mới với 0; quay `/vi/admin` bấm Ngừng dùng dòng đó → trạng thái `vi('stageAdmin.inactive')`; `/vi/projects/1` không còn tên đó.
3. `/vi/admin` bấm Ngừng dùng dòng "Gia công" → thấy thông báo `in_use` (chuỗi chứa "dự án đang đặt trọng số").
4. `/vi/nhap-lieu?project=1`: lưới tiến độ có ô "Thanh quyết toán".

Thời điểm viết (để có e2e đỏ trước khi code):
- Kịch bản 1 và 4: viết ở Bước 1 của Task 6, chạy `npx playwright test e2e/12-chuoi-gia-tri.spec.ts` → ĐỎ (cột cũ 4+3, chưa có Thanh quyết toán), rồi mới code Task 6.
- Kịch bản 2 và 3: viết ở Bước 1 của Task 8, chạy → ĐỎ (chưa có thẻ quản trị), rồi mới code Task 8.
- File spec tạo ở Task 6, Task 8 nối thêm; commit cùng Task tương ứng.

- [ ] **Bước 1:** Kiểm spec đã đủ 4 kịch bản.
- [ ] **Bước 2:** `npm run docs:erd`; `npx tsc --noEmit`; `npm test`; `npm run check:read`; `npm run test:e2e` toàn bộ trên 3003 + DB `_c` (guard env của P7-C1).
- [ ] **Bước 3:** Chụp `/vi/projects/1` (1440, 390) và `/vi/admin` thẻ giai đoạn, lưu vào `.bangiao/`.
- [ ] **Bước 4:** Commit `docs(p7-c2): mo ta dim_stage, ERD, e2e chuoi gia tri`.

---

## Trường hợp biên bắt buộc xử lý (tổng hợp)

- Dự án chưa từng có dòng trọng số: migration chèn bộ cũ trước khi thêm settlement (Task 2 bước 6-7), %TT không đổi.
- Tháng cũ không có dòng chuỗi cho settlement: coi như áp dụng, 0% (hàm có sẵn), trọng số 0 nên không ảnh hưởng %TT.
- Form mở từ trước khi admin thêm/ngừng giai đoạn: server trả `stages_changed`, không ghi gì (Task 3).
- Bản nháp localStorage của form nhập tiến độ và form hồ sơ chứa mã cũ/thiếu mã mới (Task 4, Task 5).
- Giai đoạn ngừng dùng vẫn là khâu nghẽn ở tháng cũ: tên hiện từ `stageNameMap` (gồm cả ngừng dùng), không lỗi (Task 6).
- Không còn giai đoạn volume nào / `fabrication` ngừng dùng: "Biểu đồ so sánh" dùng `defaultCompareStage`, rỗng thì hiện `detail.cmp.empty` (Task 6).
- Ngừng dùng giai đoạn đang có trọng số > 0 hoặc giai đoạn cuối cùng: chặn (Task 8).
- Trùng `sortOrder`: xếp tiếp theo `code`, không lỗi (Task 1).
- Tổng số giai đoạn chạm 30: chặn thêm (Task 8).
- Bộ theo loại dự án khi một giai đoạn gốc bị ngừng dùng: `fillWeightsForStages` bỏ giai đoạn đó, tổng có thể lệch 100, form báo đỏ, người dùng tự chia lại (chấp nhận, không tự chia).
- Người không phải admin gọi thẳng server action quản trị: `Forbidden`, không ghi (Task 8).

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi `StageCode` sang `string` làm mất kiểm tra lúc biên dịch với mã gõ sai | Server kiểm tập mã với DB (K8); test tĩnh Task 7 chặn hằng cũ quay lại. |
| %TT dự án cũ đổi ngoài ý muốn | K6, K7, test "%TT dự án cũ không đổi" (Task 1), đối chiếu tổng trọng số trước/sau migration (Task 2). |
| Xung đột với B ở trang Chi tiết (P4) | Chỉ sửa dòng dữ liệu, liệt kê đúng 3 file, ghi `phien-C.md`, đọc `phien-B.md` trước Task 6; làm Task 6 gọn trong 1 commit. |
| Thay đổi chạm nhiều test cũ (khoảng 20 file test) | Làm theo kiểu thêm tham số có mặc định (Task 1) rồi gỡ ở Task 7, mỗi commit xanh. |
| Giữ khoá schema lâu làm A chờ (P3E) | Task 2 là task duy nhất sửa schema; nếu A cần gấp, có thể nhả khoá sau Task 2 (ghi `phien-C.md`), migration không đổi nữa. |
| Rollback sau khi người dùng đã nhập trọng số cho Thanh quyết toán | Ghi rõ trong file rollback: tổng trọng số sẽ dưới 100, phải sửa tay. |

## Ước lượng

- 9 task, 9 commit.
- Tạo mới 6 file (migration, rollback, `StageEditor.tsx`, `StageEditor.test.ts`, `stages-nguon-dong.test.ts`, `e2e/12-chuoi-gia-tri.spec.ts`).
- Sửa khoảng 35 file nguồn (trong đó 6 file nóng: `schema.prisma`, `vi.json`, `en.json`, `actions.ts`, `prisma-repo.ts`, `project-queries.ts`) và khoảng 20 file test.
- Coder khoảng 1,5 đến 2 ngày làm việc; cả dây chuyền (tester, security, reviewer) khoảng 3 ngày.
