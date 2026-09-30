PHAN QUYET: CAN SUA (reviewer, 899a852) -> da xu ly trong vong sua cuoi, xem muc "Xu ly"

# Đánh giá cuối P3E Task 5-8 (nhánh `feature/p3e-c-task5-8`, `9c74809..899a852`)

Reviewer chỉ có quyền đọc; phiên điều phối C ghi lại từ báo cáo của reviewer.
Reviewer tự chạy `npx tsc --noEmit` (sạch) và `npm test` (2699 xanh + 15 skip).
Không chạy e2e, build, real-db theo lệnh giao việc (phiên C chạy, xem `thay-doi.md`).

## Chặn

1. Q5 = (a) chưa làm: tài khoản bị tắt vẫn hiện "Khóa"/"Locked" (`admin.locked`, `UserEditor.tsx:243`), dễ lẫn với "Bị khoá (sai mật khẩu)".

## Nên sửa

2. Comment/JSDoc lệch code sau các vòng vá: `types.ts` và `prisma-repo-auth.ts` còn ghi khoá theo `kind:email`; docstring "Luật đăng nhập" ở `login-guard.ts` thiếu bước `reserveAccountGuess` và nhánh hết chỗ; `auth.ts` câu "ĐÃ BỎ nhánh update" nằm ngay trên nhánh update; JSDoc `reissueSessionCookie` gán sai R3-1/R4-3 và lặp 3 lần; nhãn "bao-mat.md vòng 4" cho S-1..S-3 lệch số vòng; 2 đoạn comment không dấu trong file có dấu.
3. Chữ `authSecurity.changePasswordDone` hứa "đã bị đăng xuất" trong khi các phiên khác bị vô hiệu chậm tối đa 5 phút.
4. Hồ sơ `.bangiao` chưa khớp trạng thái cuối: dòng 1 `bao-mat.md` còn "LO HONG"; thiếu kết quả real-db, e2e toàn bộ và build trên commit cuối; checklist deploy mục 10 thiếu `change_pwd_fail_ip`.
5. Pixel chưa soi hết các trạng thái sau khi gửi thành công (`forgotSent`, `resetDone`, `resetDoneLocked`, modal "Mở khoá + đặt mật khẩu tạm", `changePasswordDone`) ở 1440/390.
6. `phien-C.md` chưa cập nhật checkpoint sau mỗi commit.

## Gợi ý

7. `login-guard.ts`: nhánh email lạ và nhánh chỉ-Google giống hệt nhau, có thể gom 1 hàm.
8. Test R6-1 dùng `setTimeout(r, 50)`, máy chậm có thể xanh giả.
9. Comment giữ quá nhiều lịch sử vá theo vòng.
10. `ChangePasswordModal` nhánh `locked` không gọi `clearDraftsOnLogout`.

## Xác nhận của reviewer

- Kế hoạch Task 5-8 gần đủ; Task 5, 7, 8 đạt; Task 6 đạt trừ Q5.
- Các chốt của chủ dự án trong `bao-mat.md` đều đúng.
- Luật repo: file nóng đúng khoá, key i18n trong nhóm riêng, không sửa `PROGRESS.md`/`.serena`/lockfile, không có dấu gạch dài trong dòng mới.
- Việc trước merge: archive `.bangiao/` vào `.bangiao/archive/p3e-task5-8-<ngày>/`; chuyển checklist deploy (`thay-doi.md` mục "Việc cho tài liệu deploy" 1-10) sang tài liệu deploy T17 của C; `PROGRESS.md`/`.serena` chỉ cập nhật trong lượt merge; ghi `ĐANG MERGE main` và chỉ merge khi chủ dự án đồng ý.

## Xử lý (phiên điều phối C, 2026-09-28)

1. Q5: đổi giá trị `admin.locked` thành "Ngưng sử dụng"/"Inactive" (đúng kế hoạch bước 6.7); thêm test trong `UserEditor.test.ts` (đỏ trước khi sửa).
2. Đã viết lại các comment lỗi thời nêu trên theo hành vi hiện tại; bỏ số vòng khỏi nhãn S-1..S-3 (giữ mã mục, tra được trong hồ sơ archive); viết lại có dấu 2 đoạn không dấu.
3. Chủ dự án duyệt chữ mới: "Đã đổi mật khẩu. Các phiên đăng nhập khác (nếu có) sẽ bị đăng xuất trong vài phút." / "Password changed. Other sign-in sessions (if any) will be signed out within a few minutes."
4. Đã sửa dòng 1 `bao-mat.md`, thêm `change_pwd_fail_ip` vào checklist deploy, ghi kết quả cổng kiểm trên commit cuối vào `thay-doi.md`.
5. Chụp ảnh các trạng thái: xem `thay-doi.md` mục "Vòng sửa sau reviewer".
6. Không đúng: `phien-C.md` đã có dòng "Cập nhật lúc" cho từng commit (61805e8, 9f937b5, d467732, 899a852); reviewer đọc nhầm dòng cũ.
7. Không sửa: nhánh email lạ và chỉ-Google là code cân thời gian đã qua nhiều vòng bảo mật, gom lại không đổi hành vi nhưng mở lại rủi ro, để sau.
8. Đã thay bằng `vi.waitFor` chờ `reserveAccountGuess` của màn Đổi mật khẩu có kết quả.
9. Đã rút gọn các đoạn bị lệch ở mục 2; các đoạn lịch sử khác giữ nguyên (không sai, chỉ dài).
10. Đã thêm `clearDraftsOnLogout` ở nhánh `locked`.
