KET QUA: DAT

# P7-C2 - Rà soát bảo mật

Phạm vi: diff `main...HEAD` tại `2c7322f` (nhánh `feature/p7-c2-chuoi-gia-tri`).
Skill: `ddc-tower:security-review`.
Kiểm bằng đọc code và diff, không truy vấn DB thật (security-reviewer không có công cụ postgres).
Không có lỗ hổng mức cao hay trung, chỉ có 4 phát hiện mức thấp, không chặn merge.

## Đã kiểm, đạt

- **Chỉ admin gọi được 2 action mới:** `src/server/actions-master.ts` dòng 65 và 84 kiểm `requireRoleUser(['admin'])`, trả `Forbidden` trước khi parse; dòng 67 validate `stageSchema`, dòng 86 kiểm `stageCodeSchema` và kiểu boolean.
- **Không gán lén trường:** `stageSchema` là `z.object` nên bỏ khoá lạ, client không gửi được `isActive`.
- Mã giai đoạn mới do server sinh (`nextCustomStageCode`), client không chọn hay đè được; sửa mã không tồn tại trả `not_found`.
- Tên 1 đến 60 ký tự, thứ tự 1 đến 999, `side` và `calcMode` chỉ nhận giá trị trong enum.
- **Không có SQL injection:** mọi truy vấn qua Prisma có tham số; migration `20260927100000_p7_c2_stage_side` chỉ dùng hằng; rollback xoá `custom\_%` đúng phạm vi.
- **Không có XSS:** tên giai đoạn chỉ render qua JSX hoặc `<text>` SVG (`StageTimelineChart.tsx:53,62`, `DataEntryForm.tsx:381,412`, `StageWeightEditor.tsx:48`); diff không thêm `dangerouslySetInnerHTML`.
- **Không có formula injection:** `app/api/export` và `app/api/report/export` không xuất tên giai đoạn, vẫn dùng `safeCell`.
- **Không lộ dữ liệu:** `/admin` gọi `requireUser(locale, ['admin'])` và middleware chặn vai trò khác; `/nhap-lieu` đọc `getStageWeights` sau bộ lọc RBAC theo phân công; `getStages` không cache.
- **Kiểm tập giai đoạn phía server:** `saveStageWeightsAction`, `createProjectAction`, `saveMonthlyData` kiểm `isSameStageSet` với tập đang dùng và trả `stages_changed` sau bước kiểm quyền; schema có `max(30)` và chặn mã trùng.
- **Audit, nhật ký, cache:** tạo/sửa/bật/tắt đều ghi `audit_log` (`dim_stage`) và activity `save_stage`/`activate_stage`/`deactivate_stage`, làm mới `profileTag` cùng `overviewTag`/`listTag` mọi tháng lịch sử.
- Không có secret mới trong diff.

## Phát hiện mức thấp (đều cần tài khoản admin, không leo quyền được)

### T-1. Tạo giai đoạn đồng thời có thể vượt giới hạn 30 hoặc trùng mã

- Vị trí: `src/server/repo/prisma-repo-entry.ts` dòng 247, 262, 263: kiểm trùng tên, kiểm giới hạn 30 và sinh mã `custom_<n>` chạy ngoài transaction.
- Kịch bản: 2 admin, hoặc 1 người bấm Thêm 2 lần liên tiếp, có thể tạo 2 tên trùng, vượt 30 một chút, hoặc cùng mã `custom_n` gây P2002 và lỗi 500 chung chung.
- Đề xuất: gộp `findMany`, kiểm và `create` vào 1 `$transaction` Serializable (hoặc advisory lock); bắt P2002 trả `duplicate_name` hoặc thử lại; cân nhắc unique index trên `lower(trim("nameVi"))`.

### T-2. Sửa giai đoạn và ghi audit không cùng transaction

- Vị trí: `src/server/repo/prisma-repo-entry.ts` dòng 254, `stage.update` rồi mới `audit(prisma, ...)`.
- Hậu quả: audit lỗi thì dữ liệu đã đổi mà không có dấu vết kiểm toán.
- Đề xuất: bọc cả hai trong `prisma.$transaction` như nhánh tạo mới.

### T-3. Ngừng dùng giai đoạn có khe TOCTOU và audit ngoài transaction

- Vị trí: `src/server/repo/prisma-repo-entry.ts` dòng 285 đến 290: đếm dự án đang dùng, đếm giai đoạn cuối cùng, rồi `update` và `audit` là các lệnh rời nhau.
- Kịch bản: 2 admin ngừng dùng 2 giai đoạn cuối cùng một lúc thì không còn giai đoạn nào đang dùng; hoặc có người đặt trọng số > 0 đúng lúc giai đoạn bị ngừng.
- Đề xuất: gộp kiểm, cập nhật và audit vào 1 transaction Serializable.

### T-4. Lưu trọng số xoá cả dòng của giai đoạn đã ngừng dùng (toàn vẹn dữ liệu, cần chủ dự án quyết)

- Vị trí: `replaceStageWeights` (`src/server/repo/prisma-repo-form.ts` dòng 158) xoá mọi dòng trọng số của dự án, form chỉ gửi giai đoạn đang dùng.
- Hậu quả: khi admin dùng lại giai đoạn đó, dự án thiếu dòng trọng số cho nó.
- Câu hỏi nghiệp vụ: giữ dòng trọng số của giai đoạn đã ngừng khi lưu, hay khi dùng lại thì chèn lại dòng 0%.
