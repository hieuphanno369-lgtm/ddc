PHAN QUYET: CHOT

# Đánh giá nhánh `feature/p3f-t1` @ `13a7beb` (T1 + rule Priority)

Skill: `ddc-tower:code-review`.
Phạm vi: `git diff main HEAD` (22 file, +463/-94); đã xem ảnh `test-results/anh-priority/`.

## Cổng kiểm reviewer tự chạy

- `npx tsc --noEmit`: sạch.
- `npm test`: 277 file pass, 2 skip; 3224 test pass, 29 skip.
- Không chạy e2e và real-db (chỉ đọc code).

## 1. Khớp kế hoạch và quyết định chủ dự án

Có.

- T1 (`bf7b23d`): nhánh lời mời xoá hết token cũ; nhánh quên mật khẩu khoá tư vấn theo email, giữ lời mời còn hạn chưa dùng. Kho bộ nhớ cùng luật. `consumeResetToken` giữ nguyên nên đặt mật khẩu bằng 1 link thì link còn lại hỏng. 3 nit vòng 2 đã dọn, `isResetTokenUsable` không còn tham chiếu.
- Priority (`93cd961`): P0 gold (`c-gold` có sẵn, có biến thể tối), P1 info, P2/P3 neutral; thẻ Top bỏ nhãn trễ/đúng và chấm đỏ/xanh, chấm `var(--gold)`; thứ tự trễ xếp trước giữ ở `src/lib/top-priority.ts:18-19`. i18n bỏ 2 key, test số lượng key đã sửa. Không lan phạm vi.

## 2. Test có giá trị thật

Có: test đơn vị Prisma bày 4 loại dòng, real-db kiểm race 2 yêu cầu đồng thời, test tích hợp theo luồng người dùng; `PriorityBadge.test.ts` cấm `c-dan`/`c-warn`; e2e 30 kiểm class thật ở sáng/tối.

## 3. Bảo mật, hiệu năng, đúng đắn

Không lỗi chặn.

- [important, không chặn] `prisma-repo-auth.ts:199-201`: nhánh lời mời không lấy khoá tư vấn, race hẹp với Quên mật khẩu có thể xoá lời mời vừa tạo; 2 lời mời đồng thời có thể để lại 2 token lời mời. Vá: đưa khoá lên đầu transaction cho cả 2 nhánh (trùng TT-1 của security).
- [nit] `app/globals.css:531` chú thích `c-gold` lỗi thời (file nóng).
- [nit] `password-reset.test.ts` describe `getResetTokenKind`: tên test còn ghi "true/false".
- [nit] en `topPriority.subtitle` "tap for details" nên là "click for details".
- [nit, quy trình] `ke-hoach.md` chỉ có T1; thêm mục Priority khi archive.
- Bảo mật: khoá tư vấn tham số hoá, phản hồi `requestPasswordReset` không đổi, loại token do server suy.
- Hiệu năng: thêm 1 `findMany` theo email, không đáng kể.

## Câu hỏi nghiệp vụ

1. Cột "Đúng tiến độ" (và SPI cam/xanh) trong bảng dự án ở Tổng quan: (a) giữ nguyên, đề xuất; (b) đổi trung tính.
2. Thẻ Top xếp trễ lên trước nhưng không còn nhãn/subtitle nói điều này: (a) giữ ngầm, đề xuất (chủ dự án đã chốt giữ thứ tự); (b) thứ tự trung tính; (c) ghi vào subtitle.
