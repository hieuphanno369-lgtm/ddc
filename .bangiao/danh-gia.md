PHAN QUYET: CHOT

# Đánh giá vòng 2 P3C-A (Task 0-10), nhánh `feature/p3c-a-form-ke-hoach`, commit sửa `cec9ab0` - 2026-09-26

> Reviewer (vai chỉ đọc) trả báo cáo; điều phối viên chép vào file này.
> Vòng 1 (CAN SUA) lưu ở `danh-gia-vong1.md`.
> Task 11 (Bước 11) vẫn CHỜ, không đánh giá.

## Cổng kiểm (reviewer tự chạy lại)

- `npx tsc --noEmit`: sạch.
- `npm test`: 186 file / 2159 test xanh (vòng 1 là 2153, thêm 6 test).
- `npm run check:read`: không chạy trên DB A vì C đã xoá dữ liệu (0 dự án); coder đã chạy trên DB tạm có seed và OK, reviewer chưa tự kiểm chứng.

## Đối chiếu CẦN SỬA vòng 1

1. Ô ca KH nhân lực không xoá trắng được: ĐẠT.
   Mọi hàm tạo dòng đồng bộ `cellInputs`, nhánh không hợp lệ dùng spread giữ nháp, onBlur ô Tổng giữ `cellInputs`.
   `toPlanInput` trả null khi ô sai, `revertCell` đúng ô, test tái hiện đúng chuỗi xoá dần rồi gõ 600.
2. L-1 zod duyệt tới 30.000 đợt: ĐẠT.
   Zod 4.6.5 không chạy vế phải của `pipe` khi vế trái có issue; test 100 x 300 đợt rác ra đúng 1 issue.
   Kiểu `parsed.data.groups` giữ nguyên, có test biên 300 đợt vẫn qua, luật nghiệp vụ không đổi.

## Các sửa thêm: không thấy hồi quy

- Gap 8px giữa 2 nút, làm tròn `pctSum`, chữ đỏ ô tổng %, viền đỏ ô Tổng lệch.

## Phát hiện mới (không chặn) và xử lý của điều phối viên

- [nit] `totalOk` so chuỗi chặt, "0780" bị tô đỏ mà Lưu vẫn bật: ĐÃ SỬA, so bằng số sau khi kiểm số nguyên (kiểm trình duyệt: "0780" không đỏ, Lưu bật).
- [nit] Ảnh ô rỗng chụp trước khi sửa gap, viền đỏ khó thấy: ĐÃ CHỤP LẠI.
  Khi chụp lại phát hiện gốc: ô sửa tay có `borderColor` inline màu accent đè viền đỏ `.bad`; đã bỏ viền accent khi ô đang nhập sai (kiểm: viền `rgb(255,105,97)`).
  Ô đang rỗng chỉ tồn tại khi focus vì rời ô sẽ trả về số đang lưu, nên ảnh chụp lúc focus.

## Để sau

- L-2: khoá lạc quan theo `updatedAt` và rate limit cho các action ghi (tầng chung).
- L-3: xoá ngầm tháng là chủ đích kế hoạch; khi có nghiệp vụ tắt ca thì quyết giữ hay xoá dòng của ca đã tắt.
- Các mục "Để sau" khác của vòng 1 còn nguyên (xem `danh-gia-vong1.md`), trừ `pctSum`, class ô tổng %, ô Tổng không tô đỏ đã làm.
- ĐÃ SỬA (chủ dự án yêu cầu, sau vòng 2): xoá dần một ô rồi rời ô khi ô đang trống/sai thì trả CẢ dòng về trạng thái lúc bấm vào ô (số, cờ sửa tay, Tổng), không giữ số trung gian. `revertCell(s,row,shift,before)` + `focusRow` ở Editor; 2 test mới; kiểm trình duyệt: xoá "270" rồi Tab → 270, không sửa tay, Tổng 450; gõ 300 rồi Tab → giữ 300.

---

# Buoc 11 - reviewer vong 1: CAN SUA (diff `3181315..HEAD`, 2026-09-26)

> Reviewer (vai chi doc) tra bao cao; dieu phoi vien chep tom tat. Task 0-10 van CHOT (o tren).

- Cong kiem: `tsc` sach; `npm test` 210 file / 2393 xanh; file cam khong bi dung; `check:read`/e2e khong chay duoc tren A.
- 11.2 den 11.6: dat (11.6 dat o muc unit, e2e chua ai chay duoc). `a524407` dung yeu cau. Bien T4/T5 co test.
- Vong sua `a1fbaa6`: logic nhan TT, o cot theo ten ca, style inline svg, `HEAD_Y`/`MIN_SVG_W` dung muc tieu.

## CAN SUA

- CS-1: tick dau neo trai de nhan tick 2 voi ke hoach 12 thang / truc tuan (loi moi do vong sua gay ra); tick dau lech khoi vach luoi.
  -> DA SUA `7a9ff2a`: moi tick `textAnchor=middle`, `QTY_W` 140; test QA moi cap tick lien ke >= 4px voi 12 thang, 24 thang, tuan 92 ngay (do truoc, xanh sau); giu test header vi/en >= 6px.

## De sau (reviewer) va xu ly

- Nhan TT fallback mac dinh +16 -> DA SUA: chon vi tri phat it nhat.
- Du an 1 ca: nhan cot trung nhan Tong KH -> DA SUA: 1 ca bo so tren cot (test do truoc/xanh sau).
- `readManpowerByShiftMonth`/`ShiftMonthRow` code chet -> DA XOA (read-types/prisma/mock, check-read-parity, test).
- Comment cu nhac `readEquipmentPlans` -> DA SUA.
- THAP-1 bao mat: de task `server-only` chung.
- `ManpowerPlanEditor` onFocus/onBlur chua co test component: them vao e2e khi co DB B/C.
- e2e `03-project-detail` + `check:read` can chay tren B/C truoc khi merge `main`.

---

# Buoc 11 - reviewer vong 2: CHOT (diff `bfcfd7d..HEAD`: `7a9ff2a`, `113491d`, `78363fe`, 2026-09-27)

PHAN QUYET BUOC 11: CHOT

- Cong kiem (reviewer tu chay): `tsc` sach; `npm test` 210 file / 2397 xanh; file cam khong bi dung; e2e/`check:read` khong chay tren DB A.
- CS-1: DAT. Moi tick `textAnchor=middle`, `QTY_W` 140; test QA bat dung loi; tester doc lap do that (12/24 thang, tuan 75 ngay, vi/en, 1440/390) khoang ho nho nhat 16,66px, tick lech vach < 0,2px.
- Muc De sau da lam: nhan TT vi tri phat it nhat, 1 ca bo so tren cot, xoa code doc chet, sua comment: DAT.
- Hoi quy o ca (`a524407`): tester kiem lai trinh duyet, dung.

## Phat hien nho va xu ly (dieu phoi vien)

- Comment sot `read-types.ts:3` (cua `ShiftMonthRow` da xoa): DA XOA.
- `ket-qua-test.md` ghi nham commit `a1fbaa6` cho "1 ca bo so tren cot": DA SUA thanh `7a9ff2a`.
- Mat khau tai khoan seed dev trong ho so ban giao: DA BO khoi `ket-qua-test.md`, `ke-hoach.md`, `thay-doi.md` (van la tai khoan seed co san trong `src/data/seed/history.ts`).
- Chua co anh Gantt 12/24 thang (chap nhan bang do `getBoundingClientRect`): bo sung khi chay e2e tren B/C.
- Anh 1 ca hien font co chan: do dev server A khong tai duoc Google Font (SELF_SIGNED_CERT, CLAUDE.md muc 7); kiem lai font tren B/C.

## De sau

- 2 ca nhung chi 1 ca co so: nhan cot va nhan Tong KH cung gia tri dat canh nhau (chua de, doc de trung).
- THAP-1 bao mat: task `server-only` chung.
- Test component cho onFocus/onBlur o ca: dua vao e2e khi co DB B/C.
- Chay `npm run test:e2e` + `check:read` tren B/C truoc hoac ngay sau merge `main`.
- Truoc merge: chuyen `.bangiao/` vao `archive/` (CLAUDE.md muc 4).
