# P3E Task 5-8 - kết quả kiểm thử (tester)

**Kết luận: XANH.** Không có test nào rớt. Không sửa code sản phẩm, chỉ thêm/hoàn thiện file test và
dọn 1 ảnh nháp trong `.bangiao/anh-tester/`.

**Xem thêm mục "Vòng sau sửa bảo mật (R2-1, R2-2)" ở CUỐI file này** - lượt kiểm độc lập trên
commit `ece0d95`, kết luận R2-1 XANH (đã vá đúng, kiểm bằng e2e thật trên endpoint HTTP), nhưng phát
hiện 1 lỗi giao diện THẬT (không liên quan bảo mật) ở `ChangePasswordModal` - đã ghi rõ, không sửa.

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

---

# Vòng sau sửa bảo mật (R2-1 Cao, R2-2 ghi nhận) - kiểm độc lập trên commit `ece0d95`

Nhánh `feature/p3e-c-task5-8`, commit `ece0d95` (fix vòng 2: R2-1 Cao, R2-2 chỉ ghi nhận). Đọc
`.bangiao/bao-mat.md` (vòng 1 và vòng 2), mục "Vòng sửa bảo mật" + "Vòng sửa bảo mật 2" trong
`.bangiao/thay-doi.md`, `.bangiao/ke-hoach.md`.

**Kết luận: R2-1 XANH (đã vá đúng, kiểm chứng bằng e2e thật trên endpoint HTTP thật, không phải chỉ
đọc code).** Toàn bộ cổng kiểm khác cũng XANH. Phát hiện thêm 1 lỗi giao diện THẬT (không phải bảo
mật, có TRƯỚC vòng sửa này) ở `ChangePasswordModal` - đã viết e2e RED để chứng minh, KHÔNG sửa code
sản phẩm, báo lại cho reviewer/coder.

Skill đã dùng: `test-driven-development`, `verification-before-completion`. Không dùng `qa`/`qa-only`
toàn phần vì việc chính là tái hiện đúng 1 kịch bản khai thác bảo mật cụ thể (đã có e2e Playwright
sẵn từ coder cho các luồng khác); có soi UI theo yêu cầu điều phối nhưng không chạy trọn dây chuyền
QA riêng. Không dùng `systematic-debugging` cho phần bảo mật (không có test đỏ ngoài dự kiến ở đây)
nhưng CÓ áp dụng tinh thần "tái hiện lỗi trước khi kết luận" khi soi ra lỗi giao diện (đọc code CSS
gốc rễ - containing block do `backdrop-filter`, không đoán mò).

## 1. Việc chính: tái hiện kịch bản khai thác R2-1 trên endpoint THẬT

File mới `e2e/24-r2-1-hoi-sinh-phien.spec.ts` (2 test), thêm tài khoản `e2e-r21@daidung.com.vn` vào
`e2e/global-setup.ts` (tách khỏi `e2e-doimk` của spec 23 vì spec 24 đổi mật khẩu nhiều lần trong
cùng file). Đi ĐÚNG đường HTTP thật next-auth dùng (đã đọc `node_modules/next-auth/core/index.js`,
`core/routes/session.js` để xác nhận `POST /api/auth/session` chỉ cần `csrfTokenVerified` - so
`req.body.csrfToken` với cookie CSRF, không cần biết gì thêm về phiên - đúng như `bao-mat.md` mô tả),
KHÔNG gọi thẳng callback `jwt` như unit test đã có sẵn (`auth-access-recheck.test.ts`).

**Test 1** - A và B cùng đăng nhập 1 tài khoản (2 phiên khác nhau, mô phỏng kẻ giữ cookie cũ hoặc
người dùng 2 thiết bị). A tự đổi mật khẩu qua `ChangePasswordModal` (giao diện thật, không gọi action
trực tiếp). B (cookie TỪ TRƯỚC khi A đổi) tự gọi `GET /api/auth/csrf` rồi `POST /api/auth/session`
`{csrfToken, data:{}}` bằng `page.request` (dùng chung cookie jar với `BrowserContext` của B - đúng
API thật, không giả lập). Khẳng định: response 200 bình thường (endpoint không bị tắt) NHƯNG B mở
`/vi/overview` vẫn bị đẩy về `/vi/login` NGAY (không cần chờ 5 phút - đúng vì nhánh `trigger==='update'`
so `changedAtMs > token.pwdAt` tức thì, không qua điều kiện `ACCESS_RECHECK_INTERVAL_MS`); A vẫn vào
được `/vi/overview` ngay sau khi đổi; xác nhận lại bằng cách đăng nhập mới với mật khẩu MỚI (chứng
minh đã đổi thật ở DB).

**Test 2** (biến thể yêu cầu riêng) - B tự gọi `GET /api/auth/csrf` + `POST /api/auth/session` 3 lần
liên tiếp TRƯỚC khi A đổi mật khẩu (mô phỏng `update()` định kỳ, kiểu 1 tab luôn mở). Khẳng định việc
gọi trước KHÔNG tạo "miễn dịch": ngay sau khi A đổi mật khẩu, B gọi lại 1 lần nữa vẫn KHÔNG hồi sinh
được, vẫn bị đẩy về `/login`.

**Kết quả:** chạy riêng spec 24 lẫn trong suite đầy đủ - **2/2 xanh** cả 2 lần.

**Kiểm không vô ích (xác nhận test không "xanh giả"):** đọc `git diff e6aeb96 ece0d95 --
src/lib/auth.ts` - ở `e6aeb96` (TRƯỚC khi vá R2-1), nhánh `trigger === 'update'` gọi thẳng
`applyAccountToToken(token, account)` (có thể hạ `invalid` từ `true` về `false`) + ghi đè
`token.pwdAt` bằng mốc mới nhất, đúng logic mà 2 test trên sẽ bắt được (B sẽ hồi sinh, assertion `B
bị đẩy về /login` sẽ FAIL) nếu chạy trên code cũ. Không checkout code cũ để chạy thật (tránh thao tác
git rủi ro trên nhánh đang có việc dở), nhưng đối chiếu diff xác nhận chắc chắn test phân biệt được
đúng/sai.

## 2. Cổng kiểm chạy lại (bằng chứng thật, tất cả trên nhánh `feature/p3e-c-task5-8`, commit `ece0d95`)

- `npx tsc --noEmit`: sạch (chạy 2 lần - sau khi thêm spec 24, sau khi thêm spec 25).
- `npm test`: **237 file / 2653 test** (2646 xanh + 7 skip khi không có `DATABASE_URL`) - đúng bằng
  mốc bàn giao của coder, không tụt (`.spec.ts` không khớp `include` của `vitest.config.ts` nên
  không bị ảnh hưởng bởi spec e2e mới).
- Test DB thật (`DATABASE_URL` trỏ `ddc_control_tower_c`):
  `npx vitest run src/server/repo/prisma-repo-auth-real-db.test.ts` → **7/7 xanh**. Kiểm bằng
  `mcp__postgres` (chỉ đọc): không còn dòng nào `email LIKE 'test-p3e-real-db-%'` hay
  `auth_throttle.key` cùng tiền tố sau khi chạy.
- `npm run check:read`: OK (chạy trước và sau e2e, sau khi seed lại).
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=... npm run build`: qua sạch, đủ 23 route kể cả
  `/[locale]/quen-mat-khau`, `/[locale]/dat-lai-mat-khau`.
- `npx prisma migrate status`: up to date trên `ddc_control_tower_c`.
- `npm run test:e2e` (toàn bộ, không lọc spec, `NODE_EXTRA_CA_CERTS` trỏ CA nội bộ, cổng 3003, DB
  `ddc_control_tower_c`): **95 xanh, 2 đỏ (chủ đích, xem mục 4) / 97 tổng** (3 test `setup` đăng nhập
  sẵn 3 vai + 92 test cũ của coder/tester trước + 2 test mới spec 24, tất cả xanh; 2 đỏ đều ở spec 25
  mới, KHÔNG liên quan bảo mật). Chạy 1 lần, không lặp lại để "qua" - không có test chập chờn ngoài
  dự kiến. Sau khi chạy đã `npx tsx prisma/seed.ts` lại DB `_c`, xác nhận `check:read` OK và không
  còn tài khoản `e2e-*`/`test-*` sót lại (kiểm bằng `mcp__postgres`).

## 3. Soi log `[WebServer] Error: aborted` / `ECONNRESET` - KHÔNG phải lỗi thật, không chập chờn

Dòng log xuất hiện ỔN ĐỊNH (không ngẫu nhiên) ngay sau test `05-import.spec.ts` mục "05b - Trang
/import (admin) - file rác không làm vỡ trang" ở CẢ 2 lần chạy toàn bộ suite trong lượt kiểm này
(giống mô tả của coder). Test đó cố ý tải lên 1 file `.txt` (không phải Excel) vào input chỉ nhận
`.xlsx,.csv` để kiểm trang không vỡ - trình duyệt/thư viện parse phía client huỷ giữa chừng 1 kết nối
đang stream (rất có thể là RSC streaming của Next dev), khiến Node http server ném `uncaughtException`
`aborted`/`ECONNRESET`. Bằng chứng đây KHÔNG phải lỗi thật ảnh hưởng người dùng:
- Test 13 (05b) và mọi test SAU nó (14-95 lần này) đều XANH cả 2 lần chạy - dòng log không làm hỏng
  bất kỳ assertion nào, không liên quan tính năng P3E (import Excel, không đụng auth/mật khẩu).
- Xuất hiện đúng 1 vị trí cố định (không rải rác ngẫu nhiên ở nhiều test khác nhau) - đặc điểm của 1
  nguyên nhân xác định (client huỷ kết nối do file rác), không phải flaky do timing/race.
- Không liên quan đến vòng sửa bảo mật R2-1/R2-2 (file/tính năng khác hẳn).
Kết luận: an toàn để bỏ qua, không cần sửa. Nếu muốn dọn triệt để (không bắt buộc), có thể xem lại
`05b` dùng `page.waitForTimeout` ngắn sau upload hoặc bắt sự kiện `pageerror` thay vì để Next dev tự
log ra console - đây là việc của coder/reviewer, không thuộc phạm vi Tester.

## 4. Lỗi giao diện THẬT phát hiện thêm (KHÔNG phải bảo mật, có TRƯỚC vòng sửa này) - ĐỎ có chủ đích

Theo yêu cầu điều phối "soi `ChangePasswordModal` ở giao diện (1440/390, light/dark, pixel-perfect)
sau khi bỏ `SessionProvider`" - dùng `mcp__playwright` mở dev server thật cổng 3003, phát hiện:
**`ChangePasswordModal` KHÔNG phủ toàn màn hình như CSS `.modal-scrim` mô tả (`position: fixed; inset:
0`), mà bị "nhốt" gọn trong khung ~236px của thanh sidebar.**

**Gốc rễ (đã đọc code, không đoán):** `SettingsMenu.tsx` render `ChangePasswordModal` làm CON của
chính `<aside class="side">` (thay vì ở gốc layout/`document.body`). `.side` có `backdrop-filter`
(kính mờ Apple Glass, `app/globals.css`) - theo đặc tả CSS Filter Effects, `backdrop-filter != none`
tạo containing block MỚI cho hậu duệ `position: fixed`, y hệt `filter`. Đã xác nhận bằng
`getComputedStyle` + `getBoundingClientRect()` qua `mcp__playwright__browser_evaluate`: `.modal-scrim`
có `position: fixed; inset: 0` ĐÚNG trong CSS nhưng `getBoundingClientRect()` trả `width: 235px,
height: 900px` (đúng bằng kích thước `.side`) thay vì phủ viewport 1440×900. Xảy ra ở CẢ 1440px lẫn
390px, CẢ light lẫn dark (không liên quan theme) - ảnh chụp qua `mcp__playwright` đã xem trực tiếp
rồi xoá (không phải ảnh chính thức bàn giao, chỉ dùng để xác nhận lúc kiểm).

**Không liên quan R2-1/S-2:** đây là bug bố cục CSS tồn tại từ trước (do cách `SettingsMenu.tsx`
render modal bên trong sidebar), không phải do việc bỏ `SessionProvider`/`update()` ở vòng sửa này
gây ra hay làm lộ thêm.

**Đã viết e2e RED để chứng minh** (`e2e/25-pixel-modal-doi-mat-khau.spec.ts`, 2 test, dùng
`storageState: 'e2e/.auth/admin.json'`):
- 1440px: `.modal-scrim` phải phủ ≥90% chiều rộng viewport → **ĐỎ thật**: `received 235, expected >
  1296`.
- 390px (mở qua drawer mobile - đường DUY NHẤT chạm được nút "Cài đặt" trên mobile, vì nút này nằm
  trong `.side` vốn off-canvas khi drawer đóng): `.modal-scrim` phải nằm trong viewport (`x >= 0`,
  qua) VÀ phủ ≥90% chiều rộng 390px → **ĐỎ thật**: `received 235, expected > 351` (236px chiếm >60%
  màn hình 390px nhưng vẫn KHÔNG phải "phủ toàn màn hình" như CSS mô tả).
- Biến thể nặng hơn đã tự tay xác nhận qua `mcp__playwright` (không đưa vào test tự động vì cần
  resize viewport SAU khi mở modal, ít gặp hơn đường mở qua drawer): nếu modal đang mở lúc `.side`
  chuyển từ có `.is-open` (drawer mở) sang không có (ví dụ resize cửa sổ/xoay màn hình), `.modal-scrim`
  bị kéo hẳn `x = -236px`, RA NGOÀI viewport hoàn toàn, modal biến mất dù `showPw` React vẫn `true`.

**KHÔNG sửa** `SettingsMenu.tsx`/`ChangePasswordModal.tsx`/`app/globals.css` (đúng phạm vi Tester -
chỉ file test). Gợi ý cho coder/reviewer (không bắt buộc theo): render `ChangePasswordModal` qua
`createPortal(document.body)`, hoặc chuyển vị trí render ra ngoài `.side` ở gốc `AppShell.tsx` - cả 2
cách đều không đổi hành vi S-2/R2-1 (logic đổi mật khẩu, `reissueSessionCookie` không đụng tới).
Đây là bug UX có thật, đáng sửa, nhưng KHÔNG phải lỗ hổng bảo mật và KHÔNG chặn merge P3E theo yêu
cầu ban đầu (kịch bản khai thác R2-1 đã đóng đúng) - để chủ dự án/reviewer quyết định có sửa ngay hay
ghi nợ kỹ thuật.

## 5. Danh sách thay đổi của Tester (vòng này, chỉ file test)

- `e2e/global-setup.ts`: thêm tài khoản `e2e-r21@daidung.com.vn` (upsert, cùng mật khẩu
  `E2E_LOCK_PASSWORD` như các tài khoản e2e khác).
- `e2e/24-r2-1-hoi-sinh-phien.spec.ts`: file mới, 2 test (mục 1).
- `e2e/25-pixel-modal-doi-mat-khau.spec.ts`: file mới, 2 test - CẢ 2 ĐỎ CHỦ ĐÍCH, chứng minh bug
  giao diện thật (mục 4). KHÔNG làm yếu test cho xanh.
- `.bangiao/ket-qua-test.md`: mục này.

## Kiểm cuối sau reviewer (2026-09-28)

Xem `thay-doi.md` mục "Vòng sửa sau reviewer (kiểm cuối)": e2e 98/98, `npm test` 2700 xanh + 15 skip, real-db 15/15, build qua; ảnh pixel 1440/390 trong `.bangiao/anh-tester/`.

