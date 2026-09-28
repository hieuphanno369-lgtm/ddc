# P3E Task 5-8 - kết quả kiểm thử (tester)

**Kết luận: XANH.** Không có test nào rớt. Không sửa code sản phẩm, chỉ thêm/hoàn thiện file test và
dọn 1 ảnh nháp trong `.bangiao/anh-tester/`.

Skill đã dùng: `test-driven-development`, `verification-before-completion`. Không dùng `qa`/`qa-only`
vì việc đụng UI ở đây chỉ cần smoke-test xác nhận không crash (đã có e2e Playwright đầy đủ từ coder),
không cần dây chuyền QA riêng. Không có test nào rớt nên không cần `systematic-debugging`.

---

## 1. Việc kế thừa từ lượt tester trước (bị ngắt giữa chừng)

`src/server/repo/prisma-repo-auth-real-db.test.ts` đã có sẵn 2 test chưa commit (L5 tài khoản
`isActive=false`, K4 race 2 request cùng token). Đã chạy lại trên DB thật `ddc_control_tower_c`:

```
$env:DATABASE_URL='postgresql://postgres:***@localhost:5433/ddc_control_tower_c?schema=public'
npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts
```

Kết quả: **7/7 xanh** (5 test gốc của coder + 2 test tester thêm). Không phải sửa gì - 2 test đúng
ngay từ bản nháp của lượt trước.

Ảnh trong `.bangiao/anh-tester/`: đã xem lại từng ảnh (login, login-locked 1440/390 light/dark,
quên-mk smtpMissing dark, admin-locked-block dark). Card cùng khung với trang đăng nhập gốc, không vỡ
ở 1440 lẫn 390, dark/light đều đọc được chữ, không lệch pixel rõ rệt. Khối "Tài khoản đang bị khoá"
trong ảnh `admin-locked-block-1440-dark.png` hiện đúng 2 dòng (2 email khác nhau, giờ khoá khác nhau,
nút riêng từng dòng) - khớp yêu cầu "Cho Tester nên soi kỹ" mục 4 của kế hoạch.
Đã xoá `_tmp-modal.png` (ảnh nháp, không dùng tới, đúng ghi chú "xoá nếu không dùng").

## 2. Rà lại độ phủ so với kế hoạch - phát hiện 1 khoảng trống

`src/components/admin/UserEditor.tsx` (Task 6, khối "Tài khoản đang bị khoá" + badge "Chỉ Google")
**chưa từng có file test riêng** (không nằm trong danh sách Files bắt buộc của kế hoạch, nhưng mục
"Cho Tester nên soi kỹ #4" yêu cầu kiểm kỹ đúng khối này khi có NHIỀU tài khoản cùng bị khoá). Bản
bàn giao chỉ kiểm bằng ảnh chụp thủ công (1 lần, 2 tài khoản) và e2e (chỉ 1 tài khoản khoá trong spec
21). Đã bổ sung `src/components/admin/UserEditor.test.ts` (file test, không đụng `UserEditor.tsx`):

- Đường chạy thuận lợi: không ai bị khoá thì không hiện khối, bảng vẫn hiện bình thường.
- Biên (đúng tên trong kế hoạch, "Cho Tester #4"): 2 tài khoản cùng bị khoá 1 lúc - khối hiện đúng
  `n=2`, đúng cả 2 email, **mỗi dòng đúng giờ khoá của chính tài khoản đó, không hoán đổi giữa 2
  dòng**.
- Biên: tài khoản chưa khoá không lọt vào khối "Tài khoản đang bị khoá" khi đứng chung danh sách với
  tài khoản đã khoá.
- Biên: badge "Chỉ Google" chỉ hiện đúng 1 dòng tài khoản không có mật khẩu, không lem sang dòng khác.
- Phải thất bại: tài khoản bị khoá hiện badge tĩnh "Bị khoá (sai mật khẩu)" trong bảng, KHÔNG còn là
  nút bấm đổi `isActive` như tài khoản thường (đảm bảo không ai bấm nhầm mở/tắt tài khoản qua đường
  khác trong lúc đang bị khoá do sai mật khẩu).

Quá trình viết: 3/5 test đỏ ở lần chạy đầu (không phải do code sai - do bài test tự viết sai: React
escape `"` thành `&quot;` trong `renderToStaticMarkup`, và `formatDateTime` phụ thuộc múi giờ máy chạy
nên không so khớp chuỗi giờ UTC cứng). Đã sửa lại cách so khớp trong test (không đụng
`UserEditor.tsx`), chạy lại **5/5 xanh**. Output đỏ ban đầu đã xem kỹ để xác nhận đúng là lỗi bài test,
không phải lỗi hành vi component - hành vi thật (khối khoá, badge) đúng như kế hoạch mô tả.

Các mục khác trong "Cho Tester nên soi kỹ" đã có phủ test sẵn từ coder, xác nhận lại:
- #1 Race Postgres thật: `prisma-repo-auth-real-db.test.ts` 7/7 (xem mục 1).
- #2 `consumeResetToken` K4+L5: đã có test gốc (chuyển chỉ-Google) + 2 test tester thêm (tài khoản
  tắt, race 2 request cùng token).
- #3 `token.pwdAt` (S8): `auth-access-recheck.test.ts` đã có case "đăng nhập -> pwdAt đọc tươi ngay
  lúc đăng nhập" (không qua nhánh so sánh cũ) - đúng yêu cầu "không nên vô hiệu nhầm phiên vừa tạo".
- #5 e2e 21 dùng IP giả riêng: đã xác nhận trong lượt chạy toàn bộ suite (mục 4), không chạm giới hạn
  IP `'unknown'` dùng chung.
- #6 Google OAuth thật: xác nhận vẫn là giới hạn đã biết, chưa có môi trường OAuth thật để kiểm - ghi
  nhận, không phải lỗi.

## 3. Cổng kiểm chạy lại (bằng chứng thật)

- `npx tsc --noEmit`: sạch, không lỗi (chạy 2 lần, trước và sau khi thêm `UserEditor.test.ts`).
- `npm test`: **236 file / 2635 test** (2628 xanh + 7 skip khi không có `DATABASE_URL` - đúng bằng 5
  test gốc + 2 test tester thêm của `prisma-repo-auth-real-db.test.ts`). Không tụt so với mốc bàn giao
  (235 file/2628 test trước khi tester thêm `UserEditor.test.ts`).
- Test DB thật (`DATABASE_URL` trỏ `ddc_control_tower_c`): `prisma-repo-auth-real-db.test.ts` 7/7 xanh
  (xem mục 1); không còn dữ liệu test sót lại (`SELECT ... WHERE email LIKE 'test-p3e-real-db-%'` rỗng,
  `auth_throttle` liên quan cũng rỗng - kiểm bằng `mcp__postgres`, chỉ đọc).
- `npm run check:read`: OK (chạy 2 lần, trước và sau khi chạy e2e + đã `tsx prisma/seed.ts` lại DB).
- Lint: repo không có script `npm run lint` và không có cấu hình ESLint (`eslint.config.*`/`.eslintrc*`
  không tồn tại), kế hoạch (`ke-hoach.md` mục "Cổng kiểm cuối mỗi Task") cũng không liệt kê bước lint -
  không có gì để chạy, ghi nhận là không áp dụng cho repo này.
- Build (kiểm compile): `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js
  npm run build` qua sạch, có đủ 2 route mới `/[locale]/quen-mat-khau`, `/[locale]/dat-lai-mat-khau`.
- `npx prisma migrate status`: up to date trên `ddc_control_tower_c` (11 migrations, không có migration
  nào "pending").
- e2e (Playwright, cổng 3003, DB `ddc_control_tower_c`, `NODE_EXTRA_CA_CERTS` trỏ CA nội bộ để tải
  font):
  - Lọc theo spec liên quan Task 5-8 (`21-khoa-tai-khoan`, `22-quen-mat-khau`, `09-chan-chua-dang-nhap`,
    `01-login`, `07-admin`, `20-dang-nhap-google`): **61/61 xanh**.
  - Toàn bộ suite, không lọc spec (1 lần chạy, không phải chạy lại để qua - không chập chờn): **92/92
    xanh**. Không tụt so với mốc bàn giao (92/92).
  - Sau khi chạy xong đã `npx tsx prisma/seed.ts` lại DB `_c` và xác nhận `check:read` OK, không còn
    tài khoản `e2e-*`/`test-*` sót lại trên DB (kiểm bằng `mcp__postgres`).
- Smoke UI thật (không qua Playwright test runner, dùng `mcp__playwright` mở dev server thật cổng
  3003): mở `/vi/quen-mat-khau` (hiện đúng thông báo `smtpMissing`, không lỗi console), mở
  `/vi/dat-lai-mat-khau?token=abc` (không crash, không lỗi console), mở `/vi/admin` (không crash,
  không lỗi console). Đã tắt dev server ngay sau khi kiểm xong.

## 4. Giới hạn của lượt kiểm này

- Không kiểm lại bằng mắt các trạng thái "đã điền form"/"gửi thành công" (`forgotSent`, `resetDone`)
  ở độ phân giải pixel - các trạng thái này đã được xác nhận đúng NỘI DUNG qua e2e (kiểm text hiển
  thị) và đã có ảnh cho trạng thái lỗi/rỗng; không phát hiện thêm lệch giao diện nào khi xem lại ảnh
  cũ và smoke UI thật, nhưng chưa chụp thêm ảnh mới cho 2 trạng thái đó (giữ nguyên giới hạn coder đã
  ghi trong `thay-doi.md`).
- Google OAuth thật: chưa có môi trường (đã ghi ở K6 nhánh #6), để dành UAT/staging - kế thừa nguyên
  văn từ `thay-doi.md`.

## 5. Danh sách thay đổi của tester (chỉ file test + tài liệu)

- `src/server/repo/prisma-repo-auth-real-db.test.ts`: giữ nguyên 2 test đã có từ lượt trước (đã xác
  nhận xanh, không sửa).
- `src/components/admin/UserEditor.test.ts`: file mới, 5 test (xem mục 2).
- `.bangiao/anh-tester/`: xoá `_tmp-modal.png` (ảnh nháp không dùng), giữ 6 ảnh còn lại.
- `.bangiao/ket-qua-test.md`: file này.
