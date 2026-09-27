# P3E - Kết quả kiểm (tester, lượt kiểm trước một phần: chỉ Task 1-4)

> Phạm vi: CHỈ Task 1-4 (commit `6139f72`, `b6056a0`, `c2ffe96`, `3414fff` + docs đi kèm).
> Task 5-8 CHƯA làm (C đang giữ khoá `schema.prisma`) - không kiểm, không tính là thiếu.
> Kiểm độc lập: chạy lại toàn bộ cổng kiểm từ đầu (không tin số coder báo), đọc code từng dòng
> đối chiếu `ke-hoach.md`, viết thêm 4 file test mới (18 test) không dùng lại test của coder.

## KET QUA: DAT

---

## 1. Cổng kiểm chạy độc lập (kết quả tự chạy, không copy từ `thay-doi.md`)

- `npx tsc --noEmit`: sạch, không lỗi (chạy 2 lần, trước và sau khi thêm test mới).
- `npm test`: **217 file / 2385 test xanh** (213/2367 của coder + 4 file/18 test tôi viết thêm).
  Không có test nào đỏ, không warning lạ.
- `npm run build` (font mock `D:\_project\DDC_dieu-phoi\tools\font-mock.js`): qua, danh sách route
  không còn `photo-upload`, `photos/[...path]`, `rates_monthly`.
- `npm run test:e2e:a` (cổng 3010, DB tạm `ddc_control_tower_e2e_a`):
  - Lượt 1 - `e2e/01-login.spec.ts e2e/07-admin.spec.ts e2e/20-dang-nhap-google.spec.ts e2e/03-project-detail.spec.ts e2e/04-data-entry.spec.ts e2e/09-chan-chua-dang-nhap.spec.ts`: **56/56 xanh**.
  - Lượt 2 (xác nhận lại sau khi thêm 4 file test mới, không đụng code sản phẩm) - `01-login`,
    `07-admin`, `20-dang-nhap-google`: **13/13 xanh**.
  - Có 1 lượt chạy TRUNG GIAN bị lỗi `ERR_CONNECTION_REFUSED` do CHÍNH TÔI gây ra: lúc đó tôi đang
    dựng tay 1 `next dev -p 3010` khác (để soi UI bằng Playwright MCP) song song với lượt e2e này,
    2 tiến trình giành cổng 3010, tôi tắt nhầm server của lượt e2e đang chạy dở. Không phải lỗi sản
    phẩm - đã tắt hết server thừa, chạy lại sạch (Lượt 2) và xanh 100%. Ghi lại đúng để trung thực,
    không giấu lượt đỏ nào dù do lỗi thao tác của tôi.

## 2. Test độc lập tôi viết thêm (file mới, KHÔNG sửa test có sẵn của coder)

| File | Số test | Mục đích |
|---|---|---|
| `src/lib/auth-credentials-google-only.test.ts` | 5 | Gọi thẳng `authorize()` thật của `CredentialsProvider` (không qua mock lại logic) - phát hiện next-auth v4 đặt hàm `authorize` thật ở `provider.options.authorize`, không phải `provider.authorize` cấp cao nhất (dễ viết sai, đã tự sửa lại test cho đúng). Xác nhận: mật khẩu rỗng chặn trước khi đọc DB; tài khoản chỉ Google + mật khẩu bất kỳ khác rỗng vẫn `null`; tài khoản tắt + mật khẩu đúng vẫn `null`; mật khẩu sai `null`; mật khẩu đúng trả đúng user. |
| `src/server/actions-account-duplicate-email.test.ts` | 4 | `createAccountAction` chặn trùng email viết HOA toàn bộ và Hoa/thường xen kẽ; xác nhận email có khoảng trắng đầu/cuối bị `zod .email()` từ chối thẳng (không tạo được tài khoản, không có đường lách qua kiểm trùng bằng biến thể khoảng trắng). |
| `src/server/login-reset-integration.test.ts` | 5 | Tích hợp CHÉO `checkCredentials` (login-guard) + `requestPasswordReset`/`resetPasswordWithToken` (password-reset) trên cùng 1 `AuthStore` - việc mà 2 file test riêng của coder không kiểm chéo: mật khẩu mới đăng nhập được, mật khẩu cũ bị từ chối; token dùng 1 lần; token hết hạn; tài khoản đang khoá thì đặt lại xong vẫn khoá (K10, `checkCredentials` vẫn trả `locked` dù mật khẩu mới đúng); token bịa đặt (đúng định dạng, không có trong kho) trả `invalid_token`. |
| `src/components/admin/ExchangeRateEditor.test.ts` | 4 | Component này CHƯA từng có file test (kể cả trước Task 1). Kiểm đúng "Trường hợp biên" ghi trong `ke-hoach.md` Task 1: dòng tỷ giá cũ `source='vcb'` vẫn hiện badge và có nút Sửa; không còn `fxRates.fetchNow`/`lastRun`/`never`; tháng chưa có tỷ giá hiện dấu "-". |

Tất cả 18 test trên đều XANH ngay từ lần chạy hợp lệ đầu tiên (1 test `authorize()` ban đầu đỏ vì
tôi tự viết sai cách lấy hàm từ provider next-auth - đã tự sửa lại test, không phải lỗi code sản
phẩm; nêu rõ ở đây theo yêu cầu báo trung thực).

## 3. Kiểm tay bằng trình duyệt thật (Playwright MCP) - server dev thật trên DB tạm e2e, KHÔNG đụng DB A

Dựng `next dev -p 3010` trỏ `ddc_control_tower_e2e_a` (đã seed qua Playwright global-setup), đăng
nhập admin thật, thao tác tay:

- `/vi/login` và `/vi/login?error=AccessDenied`: hiện đúng `authSecurity.googleDenied`, layout không
  vỡ ở 1280px và 390px (ảnh đã xoá sau khi xem xong, không phải artifact cần giữ).
- `/vi/admin`: tạo tài khoản trùng email (nguyên văn và VIẾT HOA) -> cả 2 lần đều hiện đúng
  "Email này đã có tài khoản" (`authSecurity.duplicateAccount`), không tạo bản ghi mới. Gợi ý
  "Để trống nếu người này chỉ đăng nhập bằng Google" hiện đúng dưới ô mật khẩu. Không thấy tab/nút
  liên quan ảnh hiện trường, không thấy nút "Lấy ngay" tỷ giá. Layout ổn ở 1280px và 390px.
- `/vi/nhap-lieu?project=1&step=extras`: rơi về đúng bước mặc định "1. Tiến độ tháng", chỉ còn 4
  bước (không còn "Ảnh hiện trường").
- `/vi/projects/1`: không còn card/tab Photos (tìm theo regex `Photo|Ảnh` chỉ khớp chữ "Cảnh báo"
  trong menu, không phải tính năng ảnh).
- `curl` trực tiếp trên server dev thật: `POST /api/photo-upload` -> 404; `GET /api/photos/x` -> 404
  (route không còn tồn tại, không phải do bị chặn quyền).

Dọn dẹp: đã tắt server dev tạm (port 3010), xoá ảnh chụp màn hình tạm và thư mục `.playwright-mcp`
khỏi thư mục làm việc trước khi commit; không sửa DB A (chỉ dùng DB tạm e2e đúng quy ước).

## 4. Đối chiếu kế hoạch <-> code (đọc tay, không chỉ chạy test)

- **Task 1 (D4):** `runJob` chỉ còn nhánh `alerts_daily`; cron `POST /api/cron/rates_monthly` trả
  404 (đọc `app/api/cron/[job]/route.ts`); `fxRates.hint` đúng NGUYÊN VĂN đề xuất Q7 cả VI/EN; dòng
  tỷ giá cũ `source='vcb'` vẫn sửa được (đọc `ExchangeRateEditor.tsx`, xác nhận bằng test mới).
  Lệch đã biết và hợp lý: `admin/page.tsx` chưa gỡ được prop `lastRun` vì C đang giữ khoá - đúng như
  `thay-doi.md` ghi, không phải lỗi.
- **Task 2 (D5):** không còn thư mục `app/api/photo-upload`, `app/api/photos`; không còn chuỗi
  `/api/photos`, `PhotoDropzone` trong `src/`, `app/` (test `no-photo-feature.test.ts` + xác nhận
  tay); `?step=extras` rơi về mặc định (đọc `nhap-lieu/page.tsx` dòng 55-56, `STEPS.includes` lọc
  đúng); bảng `project_photos` vẫn còn trong DB (không đụng schema, đúng kế hoạch, để Task 5 xoá).
- **Task 3 (D1):** `googleAccessDecision` đúng thứ tự ưu tiên (`unverified` > `not_found` >
  `inactive` > `locked` > `allow`); callback `signIn` Google gọi đúng hàm này; `resolveAccess`
  fail-closed (test có sẵn của coder + đọc code xác nhận `null` khi không có tài khoản HOẶC Prisma
  ném lỗi, không còn fallback `ROLE_SEED`/viewer); tài khoản chỉ Google không đăng nhập được bằng
  Credentials dù mật khẩu rỗng hay bất kỳ (xác nhận độc lập bằng test mới gọi thẳng `authorize()`
  thật); chặn trùng email kể cả khác hoa/thường (xác nhận độc lập); email có khoảng trắng bị zod từ
  chối trước khi tới bước kiểm trùng (không phải lỗ hổng, ghi lại để rõ ràng).
- **Task 4 (hạ tầng D2/D3):** hằng số `login-policy.ts` đúng khớp K5 (ngưỡng 5, IP 20/15 phút, email
  lạ 24h, xin link 3/giờ/email + 10/giờ/IP, TTL token 30 phút, retention 24h - đọc từng dòng, không
  chỉ tin tên biến); `reset-token.ts` sinh 43 ký tự base64url + hash SHA-256 64 ký tự; `client-ip.ts`
  đúng thứ tự `x-forwarded-for` -> `x-real-ip` -> cắt 64 ký tự; `checkCredentials` đúng thứ tự luật
  (giới hạn IP trước, email lạ vẫn chạy bcrypt giả, tài khoản khoá không lộ đúng/sai mật khẩu, tài
  khoản chỉ Google/tắt luôn `invalid`); `requestPasswordReset`/`resetPasswordWithToken` không lộ
  email tồn tại (mọi nhánh trả `accepted` giống nhau), token dùng 1 lần, hết hạn 30 phút, tài khoản
  đang khoá đặt lại xong vẫn khoá (K10) - xác nhận CHÉO qua module khác (login-guard) trong test mới,
  không chỉ tự test module với chính nó như coder.
  Module này CHƯA nối vào `authorize()`/trang thật nào (đúng kế hoạch, chờ Task 6/7) - không kiểm
  e2e cho Task 4 vì chưa có gì để bấm.

## 5. Việc cần Reviewer/coder lưu ý (không phải lỗi phải sửa ngay, chỉ để không ai bỏ sót)

- `createAccountSchema.email` (Task 3 không sửa dòng này, có từ trước) không có `.trim()`; đã kiểm
  chứng đây KHÔNG phải lỗ hổng (zod `.email()` từ chối thẳng email có khoảng trắng đầu/cuối, không
  lách qua được), nhưng thông báo lỗi trả về cho người dùng lúc đó là message mặc định của zod
  ("Invalid email address" kiểu tiếng Anh) chứ không phải câu tiếng Việt thân thiện - trải nghiệm
  hơi lệch tông với phần còn lại của form, có thể cân nhắc `.trim()` + thông báo riêng ở đợt sau
  (không chặn Task 3, không phải lỗi bảo mật).
- `.bangiao/ke-hoach.md` bị security-reviewer chạy song song chỉnh sửa (thêm L7, L2) trong lúc tôi
  đang kiểm - tôi không đụng vào, không liên quan tới phạm vi Task 1-4 đang kiểm ở lượt này.

## 6. Không có việc nào phải dừng dây chuyền

Không có test nào đỏ ở lượt kiểm này. Không sửa file nóng (`schema.prisma`, migrations, `globals.css`,
`vi.json`, `en.json`, `actions.ts`, `prisma-repo.ts`, `queries.ts`, `project-queries.ts`) - chỉ tạo
4 file test mới, không sửa file test hay file sản phẩm nào đã có.
