KET LUAN: CHOT

# P7-C2 - Review cuối (reviewer)

Skill đã dùng: `ddc-tower:code-review`.
Phạm vi: `git diff main...HEAD` tại `7569a05`, nhánh `feature/p7-c2-chuoi-gia-tri`.

## Cổng kiểm reviewer tự chạy lại

- `npx tsc --noEmit`: sạch (exit 0).
- `npm test`: 215 file / 2503 test xanh, khớp tester vòng 2.
- e2e không chạy lại, dựa vào tester vòng 2 (83/83 trên 3003).

## 1. Khớp kế hoạch và quyết định nghiệp vụ

- Q1a: không có nút xoá, chỉ Ngừng dùng/Dùng lại, chặn khi còn dự án đặt trọng số lớn hơn 0% (`prisma-repo-entry.ts`, `setStageActive`), chặn ngừng giai đoạn đang dùng cuối cùng.
- Q2a/Q3a: `DEFAULT_STAGE_WEIGHTS` Lắp dựng 25 + Thanh quyết toán 2; bộ theo loại dự án điều chỉnh theo cùng luật; dự án cũ giữ bộ cũ + Thanh quyết toán 0% (`LEGACY_STAGE_WEIGHTS`, migration bước 6-7).
- Q4a: `findCurrentStage` bỏ qua giai đoạn trọng số 0% hoặc tắt áp dụng (`src/lib/stages.ts`, gọi ở `src/server/actions.ts` và `DataEntryForm`).
- Q5a: "Project Management Value Chain" / "Settlement".
- K8: server kiểm `isSameStageSet` trước mọi lệnh ghi ở `saveMonthlyData`, `saveStageWeightsAction`, `createProjectAction`, trả `stages_changed`.
- K11: form nhập tiến độ xem trước %TT bằng trọng số của dự án.
- T-1..T-3: gộp đọc/kiểm/ghi/audit vào 1 transaction có `pg_advisory_xact_lock(hashtext('dim_stage'))`, đúng khuôn khoá mã dự án có sẵn.
- T-4 (chủ dự án chốt): `replaceStageWeights` chỉ xoá mã có trong payload; Dùng lại chèn 0% cho dự án đã có dòng mà thiếu dòng, `skipDuplicates` giữ dòng cũ.
- Lệch kế hoạch có ghi rõ, chấp nhận:
  - chèn 0% chỉ cho dự án đã có dòng trọng số (tránh làm mất bộ mặc định);
  - `setStageActive` trả kèm số dự án;
  - sửa 1 luật `.stage .stagesub` ở `app/globals.css` (kế hoạch ghi phi phạm vi, nhưng là lỗi hiển thị có sẵn ở 390px, đã giữ và nhả file nóng đúng luật).

## 2. Test có giá trị thật không

- Có. Test repo Prisma kiểm khoá advisory chạy trước khi đọc, và mọi lệnh đọc/ghi/audit đi qua `tx` (`prisma-repo-entry.test.ts` dòng 130-262). Coder xác nhận ĐỎ trước khi vá 11 test.
- Tester kiểm thêm trên Postgres thật: 2 `saveStage` đồng thời cùng tên chỉ 1 thành công; chuỗi ngừng dùng, lưu trọng số, dùng lại vẫn giữ dòng cũ.
- `stages-nguon-dong.test.ts` chặn tái xuất hiện hằng giai đoạn cứng; test tester bổ sung biên `createProjectAction`/`stageWeights`.
- Điểm yếu nhỏ: test Prisma dựa trên mock `tx` nên không chứng minh được khoá thật. Phần này đã được bù bằng kiểm tay trên DB `_c`.

## 3. Migration và rollback

- `20260927100000_p7_c2_stage_side`: thêm enum + 2 cột có mặc định, backfill bên phải, `ON CONFLICT DO NOTHING` cho settlement, điền trọng số đúng thứ tự (bước 6 trước bước 7).
- Không tính lại `fact_progress_monthly`, %TT dự án cũ giữ nguyên.
- File rollback có `BEGIN/COMMIT`, xoá đúng phạm vi `settlement` và `custom\_%`, trả lại tên cũ, gỡ cột/enum, xoá dấu vết `_prisma_migrations`. Có ghi chú hạn chế (dự án đã tự đặt Thanh quyết toán lớn hơn 0 phải sửa tay).
- Vòng sửa bảo mật không thêm migration.

## 4. Bảo mật, hiệu năng, i18n, giao diện

- Bảo mật: 2 action mới kiểm `requireRoleUser(['admin'])` trước parse; `stageSchema` là `z.object` nên bỏ khoá lạ; mã giai đoạn do server sinh; tên chỉ render qua JSX.
- Hiệu năng: `getStages` thêm 1 truy vấn nhỏ ở mỗi trang/action, bảng tối đa 30 dòng, chấp nhận được.
- i18n: vi/en đủ cặp, nhóm `stageAdmin` đặt cuối file; không thấy em dash hay en dash trong chuỗi mới.
- Giao diện: bảng quản trị cuộn ngang ở 390px, có ảnh 1440/390 trong `.bangiao/anh-task9/`.

## Bắt buộc sửa

Không có.

## Nên làm (không chặn merge)

**Chủ dự án chốt (2026-09-27): làm cả 4 mục trước khi merge main. Đã làm xong, xem `.bangiao/thay-doi.md` mục "Vòng sửa theo reviewer (4 mục Nên làm)".**

1. **XONG.** `src/server/repo/types.ts:195,197`: đổi `side?`/`isActive?` thành bắt buộc. Hiện 3 chỗ hiểu thiếu giá trị theo 2 kiểu ngược nhau:
   - `src/lib/stages.ts:148` (`filter((s) => s.isActive)`: thiếu thì coi là ngừng dùng);
   - `src/components/admin/StageEditor.tsx:64,129` (`=== false` / `!== false`: thiếu thì coi là đang dùng);
   - `src/lib/value-chain-view.ts:27` (thiếu `side` thì rơi khỏi cả 2 cột).
2. **XONG (làm cả (a) và (b)).** Khe hở T-3 phía người nhập: `src/server/actions-project.ts:136-141` kiểm tập giai đoạn ngoài transaction; bước ghi `src/server/repo/prisma-repo-form.ts:161` không lấy khoá `dim_stage`.
   - Admin ngừng dùng đúng lúc đó thì có thể sót dòng trọng số lớn hơn 0% của giai đoạn đã ngừng dùng.
   - Ô Σ trọng số ở thẻ Chuỗi giá trị (`src/lib/value-chain-view.ts:53`) sẽ cộng cả dòng đó và báo lệch 100.
   - Cách vá: lấy khoá `hashtext('dim_stage')` và kiểm lại tập giai đoạn trong transaction của `replaceStageWeights`, hoặc cho `chainFooterSummary` chỉ cộng mã có trong `order`.
3. **XONG.** `src/server/actions.ts:241`: `stageWeights` tuỳ chọn khi tạo dự án.
   - Dự án không có dòng nào sẽ dùng ngầm bộ mặc định có Thanh quyết toán 2%, luật Q1a không đếm được nên vẫn ngừng dùng được và %TT đổi.
   - Hiện form luôn gửi, DB `_c` 17/17 dự án có dòng, rủi ro thấp. Nên bắt buộc khi tạo.
4. **XONG.** `src/i18n/messages/vi.json` và `en.json`, khoá `stageAdmin.hint`: câu "thêm 0% vào trọng số mọi dự án" chưa khớp code (chỉ dự án đã có dòng trọng số). Nên sửa chữ.

## Câu hỏi nghiệp vụ

Không có.
