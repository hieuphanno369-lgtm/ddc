PHAN QUYET BAO MAT: DAT

# Hồ sơ bảo mật - nhánh `feature/p3f-t1` @ `13a7beb` (so với `main` `bdc0bbd`)

Skill: `ddc-tower:security-review`.
Không thêm endpoint mới, chỉ đổi logic kho token và giao diện.

## Đã kiểm chứng

- `npx tsc --noEmit`: sạch.
- Vitest password-reset, mock-repo-auth, prisma-repo-auth, PriorityBadge, dashboard/TopPriorityList: 154 test đạt.
- `prisma-repo-auth-real-db.test.ts` trên DB `ddc_control_tower_c`: 16/16 đạt.
- Không chạy lại toàn bộ `npm test` và e2e (số xanh do coder báo).

## 1. `bf7b23d` - vá T1

- Không tạo được token "invite" giả: loại token suy từ `expiresAt - createdAt` (`src/lib/login-policy.ts:93-95`), cả hai do server tính; lời mời chỉ sinh sau `requireRoleUser(['admin'])`.
- Tối đa 1 lời mời + 1 link quên mật khẩu sống cho một email; nhánh quên mật khẩu khoá `pg_advisory_xact_lock(hashtext('reset_token:'+email))`.
- Đặt mật khẩu xong không còn link nào dùng được: `consumeResetToken` đánh `usedAt` mọi token còn lại trong cùng transaction (cả kho bộ nhớ).
- Giới hạn tần suất P3E, luật L5 và việc không lộ trạng thái tài khoản không đổi.
- 3 nit đã dọn, không thấy hồi quy.

## 2. `93cd961` - màu Priority và thẻ Top

Chỉ đổi giao diện, không đụng server/query/`maskProjectSummaries`, không hiện thêm dữ liệu.

## Phát hiện

### TT-1 (thấp, tính sẵn sàng): race admin bật và Quên mật khẩu có thể xoá lời mời vừa tạo

- `src/server/repo/prisma-repo-auth.ts:197-217`: nhánh lời mời `deleteMany({ where: { email } })` không lấy khoá; nhánh quên mật khẩu xoá bằng `id: { notIn: liveInviteIds }` đọc từ trước, nên có thể xoá lời mời do transaction khác vừa commit.
- Tác động: link mời chết, người dùng tự lấy lại qua Quên mật khẩu; không leo quyền.
- Vá: (a) lấy khoá tư vấn trước nhánh `if` cho cả lời mời; (b) nhánh quên mật khẩu xoá theo `id: { in: idsToDelete }` đã đọc. Thêm test real-db chạy song song invite và reset.

### TT-2 (thông tin): tiêu đồng thời 2 token cùng email có thể deadlock

- `consumeResetToken` (`prisma-repo-auth.ts:229-263`): 2 token sống có thể khoá chéo; Postgres huỷ một bên, bên kia đốt hết token (an toàn khi lỗi), nhưng lỗi ném lên `actions-password-reset.ts:41`.
- Gợi ý: khoá tư vấn theo email ở đầu `consumeResetToken` để trả `invalid_token` gọn.

### TT-3 (thông tin, đúng thiết kế): Quên mật khẩu không còn thu hồi link mời

Thu hồi còn lại: đặt mật khẩu bằng link bất kỳ, admin bật lại, hoặc tắt tài khoản.

## Kết luận

Không có lỗ hổng mức cao hay trung; TT-1 thấp, nên vá (không chặn merge).
