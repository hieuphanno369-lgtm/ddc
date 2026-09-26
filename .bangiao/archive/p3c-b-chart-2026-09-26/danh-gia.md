PHAN QUYET: CHOT (sau vòng sửa ngắn theo điều kiện của reviewer)

# P3C-B - Đánh giá chặng cuối (reviewer)

Skill reviewer dùng: `ddc-tower:code-review`.
Phạm vi: `git diff main...HEAD` trên nhánh `feature/p3c-b-chart` (từ main @ 2034548, HEAD lúc đánh giá @ b06e0e7), Bước 1 đến 10.
Bước 11 đã chuyển sang tài khoản A theo quyết định chủ dự án ngày 2026-09-26, không thuộc phạm vi.
S-1 có sẵn trên main, vá ở phase P3D-B, không chặn P3C-B.

## Kết luận lượt đầu của reviewer: CẦN SỬA

Chỉ vướng luật "không dùng gạch dài" trên giao diện; logic, test, N-3, phạm vi file đều đạt.
Điều kiện CHỐT reviewer đặt ra: sửa mục 1-3 dưới đây, chạy lại `npx tsc --noEmit` và `npm test` không thấp hơn 155 file / 1719 test cộng test mới, không cần qua lại cả dây chuyền.

## Cổng kiểm (reviewer chạy lại)

- `npx tsc --noEmit`: sạch.
- `npm test`: 155 file / 1719 test xanh.
- Không đụng file cấm: không có prisma/, types.ts, mock-repo.ts, prisma-repo.ts, actions.ts, queries.ts, project-queries.ts, globals.css, PROGRESS.md, .serena/.
- Key i18n: 3 nhóm mới ở cuối vi.json và en.json, sau `notifyAdmin`, cùng thứ tự, không có gạch dài.

## Ba câu hỏi

1. Code khớp kế hoạch: có. Cả 4 câu chủ dự án đã chốt làm đúng (T5 chia số ngày có nhập liệu, T4 có Tổng SL chưa có đợt vẫn ra hàng 0/tổng, T2 lọc theo FilterBar, T5 trục tháng liên tục); T1 nhãn số và tooltip dùng actualAvg đúng thiết kế. Component T4/T5 và `p3c-contract.ts` chưa trang nào dùng là chủ ý.
2. Test có giá trị thật: có. Đủ ca biên, đối chiếu số thật DB B, test chống lệch hợp đồng có kiểm chứng phát hiện lệch, N-3 cho cả viewer và admin, không lộ tiền qua JSON.
3. Bảo mật, hiệu năng, đúng đắn: N-3 đạt, S-2 đã sửa, SQL có tham số, không có innerHTML, cache che tiền theo từng request; không thấy lỗi logic.

## Vòng sửa (điều phối B, 2026-09-26)

1. [ĐÃ SỬA] `EquipmentPlanGantt.tsx`: dòng ngày dưới tên thiết bị và ô SL khi chưa có Tổng SL dùng gạch thường "-".
2. [ĐÃ SỬA] Test mới trong `EquipmentPlanGantt.test.ts`: markup không chứa U+2013/U+2014, có "/-" và "01/09/26 - 20/09/26" (test đỏ trước khi sửa).
3. [ĐÃ SỬA] `messages-p3cb-9-10.qa.test.ts`: regex đổi sang dạng thoát `–—`.
4. [ĐÃ SỬA] `WeeklyManpowerStackChart.tsx`: chú thích viết lại có dấu đồng nhất.
5. [ĐÃ SỬA] Hồ sơ `ke-hoach.md`, `thay-doi.md`, `ket-qua-test.md`: thay toàn bộ gạch dài bằng "-".
6. Quét lại mọi file code P3C-B thêm/sửa (trừ json): không còn U+2013/U+2014.

Cổng sau vòng sửa: `npx tsc --noEmit` sạch; `npm test` = **155 file / 1720 test xanh** (thêm 1 test).
Điều kiện CHỐT của reviewer đã đáp ứng.

## Ghi nhận, không chặn

- `CLAUDE.md` được sửa trong nhánh phase (commit 3d7e511, mục 2); báo A khi merge để tránh xung đột.
- `src/server/queries.ts` dòng 145 còn nhắc tên cũ `WatchlistCard` trong chú thích (file cấm của phase này), ghi nợ.
- Chuỗi i18n CŨ (trước P3C-B) trong `vi.json`/`en.json` còn nhiều gạch dài (vd `form.draft.stale`, `dailyResource.locked`, `notifyAdmin.*`): ghi nợ, làm trong lượt i18n kế tiếp (P4) khi giữ khoá file.
- Nợ của coder giữ nguyên: nhãn T1 sát nhau khi KH gần bằng TT; key i18n cũ chưa xoá (dồn vào Bước 11 của A); bề rộng pill "Hôm nay" chỉ ước lượng.
- S-3 cho A ở Bước 11: kiểm projectId và kiểm đăng nhập ngay ở trang khi nối `readManpowerActualByMonth`.
