PHAN QUYET: CHOT

# Đánh giá P3F vòng 2 (reviewer, diff `9195b03..683a5a2`)

Skill đã dùng: `ddc-tower:code-review`.
Phạm vi: `b6c6ecc`, `d7ed919`, `a600dfb`, `54d43e1`, `31ab066` (merge P5-B), `dec6df8`, `683a5a2`.
Reviewer chỉ đọc bằng `git diff`/`git show`, không checkout, không sửa file.
Phần P5-B vào qua merge đã có reviewer riêng chốt, chỉ soát chỗ ghép với P3F.

## Cổng kiểm

Reviewer KHÔNG tự chạy `npx tsc --noEmit` và `npm test`, vì cây làm việc lúc đó có thay đổi chưa commit của coder T1 ở đúng các file auth.
Dùng số C báo trên bản gộp: tsc sạch, `npm test` 266 file / 3111 xanh + 27 skip, e2e 214 đạt, CSP 13/13 (0 vi phạm).

## 1. Khớp kế hoạch và quyết định chủ dự án

Có. 3 mục cần sửa vòng 1 và 4 quyết định đều đã xử lý đúng.

- Cần sửa 1: `ket-qua-test.md` đã có mục "Vòng sửa bảo mật và sau reviewer".
- Cần sửa 2: `src/lib/schema-meta/docs.ts:507-515` ghi 30 phút / 72 giờ, `requestIp` rỗng với lời mời, job dọn theo `expiresAt`/`usedAt`.
- Cần sửa 3: comment `src/server/signup.ts:32` đã sửa.
- Quyết định (1): `/dieu-khoan` ghi `hieupt1@daidung.vn` ở vi và en, không còn chỗ trống.
- Quyết định (2): không thêm nhãn.
- Quyết định (3): trang Đăng ký bỏ nút Google (`SignupForm` bỏ `googleEnabled`, `signIn`, `GoogleButton`, `AuthDivider`); trang Đăng nhập giữ.
- Quyết định (4): `ResetPasswordForm` nhận `kind` do trang server truyền, đổi chữ cho link lời mời.
- Merge `middleware.ts` (`31ab066`) giữ đủ `PUBLIC_PATHS` của P3F và header bảo mật + CSP nonce của P5-B trên mọi nhánh.
- i18n: 6 key `signup.invite*` ở cuối nhóm `signup`, đủ vi/en; bỏ Google ở Đăng ký không làm thừa key.

## 2. Test có giá trị thật

Có: `login-policy-kind.test.ts` (ranh giới 30 phút ± 5 giây, 72 giờ), `prisma-repo-auth.test.ts` (`peekResetTokenKind` trả `null` đủ 4 trường hợp), `signup-moi-dat-mat-khau.test.ts` (luồng thật), e2e 28 (thêm `&kind=reset` vào URL vẫn ra chữ lời mời), e2e 22, e2e 27 CSP thêm `/dang-ky`, `/dieu-khoan`.

## 3. Bảo mật, hiệu năng, đúng đắn

- Ngưỡng `resetTokenKindOf` (`expiresAt - createdAt > 60 phút`) đúng và an toàn; loại link chỉ quyết định chữ hiển thị, đường tiêu token không đổi.
- Điều kiện `null` của `peekResetTokenKind` trùng `peekResetToken` ở cả Prisma lẫn memory.
- Trang đặt mật khẩu vẫn chỉ đọc 1 lần theo khoá unique.

## Cần sửa

Không có mục chặn.

## Nit (không chặn)

1. `src/lib/login-policy.ts:91`: comment "`createdAt` do DB đặt" chưa đúng, `@default(now())` do Prisma gán.
2. `src/server/repo/prisma-repo-auth.ts:195-213`: `peekResetToken` và `peekResetTokenKind` lặp điều kiện; `isResetTokenUsable` (`src/server/password-reset.ts:215`) chỉ còn test gọi.
3. `src/server/repo/mock-repo-auth.ts:210`: gọi qua `this.peekResetToken` dễ hỏng khi tách hàm.
4. `PROGRESS.md`: mục P3F nên thêm số e2e sau khi gộp P5-B (214, CSP 13/13) và cập nhật "reviewer vòng 2 CHỐT"; vài dòng cũ có dấu gạch dài (không phải của P3F).

Nit 1-3 chuyển cho coder T1 (nhánh `feature/p3f-t1`), nit 4 làm ở lượt merge T1.

## Câu hỏi nghiệp vụ

Không có câu mới.
