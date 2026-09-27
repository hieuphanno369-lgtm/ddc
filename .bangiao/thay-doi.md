# P3E - Đăng nhập an toàn + gọn app: tóm tắt thay đổi

> Ghi theo Task, coder cập nhật sau mỗi commit. Tester/reviewer/security-reviewer đọc file này trước khi soi code.

## Task 1: D4 - Tỷ giá chỉ nhập tay (`6139f72`)

Xem chi tiết đầy đủ trong nội dung commit `6139f72` (không có mục riêng trong file này lúc commit).
Tóm tắt: xoá `src/lib/vcb-rates.ts(.test)`, `src/server/fx-rates.ts(.test)`, nút "Lấy ngay"; `runJob` chỉ còn nhánh `alerts_daily`; cron `rates_monthly` trả 404; i18n `fxRates.hint` đổi theo Q7.

**Lệch kế hoạch:** `app/[locale]/(app)/admin/page.tsx` do tài khoản C giữ (Task 9 của C) nên CHƯA thu hẹp `JobName` xuống chỉ `'alerts_daily'` tại nơi gọi từ trang admin, và `ExchangeRateEditorProps.lastRun` còn giữ (tuỳ chọn, không dùng ở UI) để tương thích cho tới khi C nhả khoá. Sẽ dọn khi C nhả.

---

## Task 2: D5 - Gỡ code ảnh hiện trường (giữ bảng) (`b6056a0`)

**File đã xoá:** `app/api/photo-upload/route.ts`, `app/api/photos/[...path]/route.ts`, `src/lib/uploads.ts(.test)`, `src/lib/photo-upload.ts(.test)`, `src/server/photo-service.ts`, `src/server/photo-upload-route.test.ts`, `src/server/photo-route.test.ts`, `src/server/repo/photo.test.ts`, `src/components/form/PhotoDropzone.tsx`.

**File đã sửa (gỡ phần liên quan ảnh, giữ phần khác nguyên vẹn):**
- `src/server/actions.ts`: xoá `addPhotoAction`, `deletePhotoAction` + import liên quan.
- `src/server/actions.test.ts`: xoá 2 describe test ảnh, giữ describe `saveMonthlyData`.
- `src/server/validation.ts`/`validation.test.ts`: xoá `PHOTO_MAX_BYTES`, `photoFileSchema`, `addPhotoSchema`, `deletePhotoSchema` và test tương ứng.
- `src/server/repo/prisma-repo.ts`, `src/server/repo/mock-repo.ts`: xoá `getPhotos`, `getPhotoById`, `addPhoto`, `deletePhoto`; `mock-repo.ts` bỏ luôn dòng lọc `d.photos` khi xoá dự án.
- `src/server/repo/types.ts`: xoá `interface ProjectPhoto`.
- `src/data/seed/history.ts`: xoá `buildPhotos`, field `photos` khỏi `RepoData` và chỗ gán.
- `prisma/seed.ts`: xoá đoạn `createMany` ảnh; GIỮ `await prisma.projectPhoto.deleteMany();` và `'project_photos'` trong `syncSequences` (bảng DB còn tới Task 5, đúng kế hoạch).
- `src/components/form/DataEntryForm.tsx`: bỏ bước wizard `'extras'` (`DataEntryStep` chỉ còn `'progress' | 'finance' | 'profile' | 'resources'`), bỏ prop `photos`, hàm `removePhoto`, import `PhotoDropzone`/`ProjectPhoto`/`deletePhotoAction`/`IconProject` (không còn nơi dùng trong file này).
- `app/[locale]/(app)/nhap-lieu/page.tsx`: bỏ `repo.getPhotos`, prop `photos`, `'extras'` khỏi `STEPS`.
- `app/[locale]/(app)/projects/[id]/page.tsx`: bỏ `repo.getPhotos(id)` trong `Promise.all`, biến `photos`, thẻ Card "Photos"; `IconProject` vẫn còn dùng ở 2 chỗ khác trong file nên giữ import.
- `src/server/api-routes-guard.test.ts`: bỏ 2 dòng đăng ký `photo-upload/route.ts`, `photos/[...path]/route.ts`.
- `e2e/09-chan-chua-dang-nhap.spec.ts`: bỏ 2 dòng kiểm `/api/photos`, `/api/photo-upload`.
- `e2e/04-data-entry.spec.ts`: bỏ `vi('form.stepExtras')` khỏi mảng nhãn bước wizard.
- `scripts/perf/bench-data.ts`: bỏ `repo.getPhotos(projectId)` khỏi benchmark.
- `src/i18n/messages/vi.json`, `en.json`: xoá `detail.photos`, `form.tabPhotos`, `form.stepExtras`, `form.photoUploadError`, `form.confirmDeletePhoto`, cả object `dataGuard.photo`. GIỮ `activity.add_photo`, `activity.delete_photo` (nhật ký cũ 14 ngày còn 2 action này).
- Đã xoá thư mục `data/uploads` (không nằm trong git, chỉ dọn máy cục bộ).

**File mới:** `src/server/no-photo-feature.test.ts` (test khoá hồi quy) - viết SAU khi một phần việc gỡ code đã làm dở từ phiên trước (đã đối chiếu phần gỡ dở đó khớp đúng danh sách kế hoạch trước khi viết test và làm tiếp), nên không phải RED-GREEN thuần theo đúng trình tự chuẩn; đã xác nhận test đỏ đúng 2/3 case trước khi gỡ nốt phần còn lại, rồi xanh cả 3 sau khi gỡ xong.

**Cổng kiểm:**
- `npx tsc --noEmit`: sạch (phải xoá `.next/` cũ trước vì file type sinh tự động còn trỏ tới 2 route API đã xoá).
- `npm test`: 204 file / 2293 test xanh (mốc trước Task 1 = 208/2388; giảm đúng 4: xoá 5 file test ảnh, thêm 1 file `no-photo-feature.test.ts`).
- `npm run build` (font mock): qua, danh sách route không còn `photo-upload`/`photos/[...path]`.
- `npm run test:e2e:a -- e2e/03-project-detail.spec.ts e2e/04-data-entry.spec.ts e2e/09-chan-chua-dang-nhap.spec.ts`: 46/46 xanh.

**Chỗ Tester/Reviewer nên soi kỹ:**
- `DataEntryForm.tsx` xoá 1 bước wizard (`extras`) - kiểm điều hướng Tiếp/Lùi giữa các bước còn lại không lệch, link cũ `?step=extras` phải rơi về bước mặc định (STEPS.includes đã lọc ở `nhap-lieu/page.tsx`).
- `GET /api/photos/x` giờ phải trả 404 (route không còn tồn tại) thay vì hành vi cũ; đã có test e2e 09 xác nhận không còn 2 route này trong danh sách API tự chặn.
- Bảng `project_photos` trong DB VẪN CÒN (không đụng schema), chỉ gỡ code truy cập - dữ liệu ảnh cũ (nếu có) không hiển thị ở đâu nữa nhưng chưa mất, dự kiến xoá bảng ở Task 5.
- Nhật ký hoạt động cũ (trong 14 ngày) có thể còn dòng action `add_photo`/`delete_photo` - key i18n 2 dòng này vẫn giữ nguyên, không lỗi hiển thị.

---

## Task 3: D1 - Đăng nhập Google theo danh sách admin (`c2ffe96`)

**File mới:**
- `src/server/google-access.ts` + test: hàm thuần `googleAccessDecision(profile, account)` quyết ai được vào bằng Google (chưa xác minh -> `unverified`; không có tài khoản -> `not_found`; tắt -> `inactive`; đang khoá -> `locked`; đủ điều kiện -> `allow`). Tách khỏi callback next-auth để test không cần dựng session/DB thật.
- `src/lib/auth-google.test.ts`: test callback `signIn`/`jwt` thật của next-auth (mock `@/server/db`), gồm cả trường hợp Gmail cá nhân có trong danh sách vẫn vào được kể cả khi đặt `ALLOWED_EMAIL_DOMAINS` (biến không còn được đọc).
- `src/server/actions-account-google.test.ts`: test `createAccountAction` (tạo không mật khẩu, mật khẩu ngắn, trùng email, viewer gọi bị Forbidden).
- `docs/HUONG_DAN_GOOGLE_OAUTH.md`: hướng dẫn tạo OAuth Client trên Google Cloud (loại External, Publish Production để Gmail ngoài công ty vào được, redirect URI, điền env, admin thêm email trước khi người dùng đăng nhập).
- `e2e/20-dang-nhap-google.spec.ts`: (1) mở `/login?error=AccessDenied` thấy đúng thông báo; (2) admin thêm tài khoản Gmail không mật khẩu, đăng nhập bằng mật khẩu bất kỳ vẫn báo sai (không đăng nhập được qua Credentials).

**File đã sửa:**
- `src/lib/auth.ts`: bỏ hẳn `allowedDomains`/`isAllowedDomain`/`roleSeed`/`ROLE_SEED` (Q3=a). Thêm `Access` type + `accessFromAccount()` (đọc `canViewFinance` theo cột DB, admin/data-entry luôn `true`). `resolveAccess()` đổi kiểu trả về thành `Access | null` - không có tài khoản hoặc DB lỗi trả `null` thay vì fallback `viewer` (K14, đóng L-11). Callback `jwt`: cả nhánh đăng nhập lẫn nhánh kiểm lại định kỳ giờ dùng chung hàm `applyAccountToToken()` (1 lần `findAccount` + `accessFromAccount`, không gọi `resolveAccess` thêm lần nữa như code cũ - trước đây đọc DB 2 lần mỗi lượt). Callback `signIn`: nhánh Google gọi `googleAccessDecision`; khác `'allow'` thì từ chối; nhánh credentials giữ nguyên hành vi ghi `logActivity('login')`. Thêm `pages.error: '/login'` để next-auth redirect lỗi Google về đúng trang có xử lý hiển thị.
- `src/server/validation.ts`: `createAccountSchema.password` nhận thêm `''` (tài khoản chỉ Google).
- `src/server/actions.ts`: `createAccountAction` cho `password === ''` (không hash), chặn trùng email (`findAccount` trước khi tạo + bắt `Prisma.PrismaClientKnownRequestError('P2002')` làm lớp phòng thủ cho race hiếm khi 2 request cùng tạo 1 email - `user_roles.email` là khoá chính). `changePasswordAction`: tài khoản `passwordHash === ''` trả lỗi `current` TRƯỚC khi gọi `verifyPassword` (tránh bcrypt ném lỗi với hash rỗng).
- `src/components/admin/UserEditor.tsx`: ô mật khẩu ban đầu không bắt buộc (để trống = chỉ Google), có nhập mà < 8 ký tự báo `auth.passwordTooShort`, dưới ô mật khẩu thêm gợi ý `authSecurity.googleOnlyHint`, action trả `duplicate` hiện `authSecurity.duplicateAccount`.
- `app/[locale]/login/page.tsx`, `src/components/layout/LoginForm.tsx`: trang login nhận `searchParams.error`, truyền `initialError` xuống form; form hiện `authSecurity.googleDenied` khi Google từ chối.
- `.env.example`, `README.md`, `docs/DEPLOY.md`: bỏ dòng `ALLOWED_EMAIL_DOMAINS`/`ROLE_SEED`, comment Google trỏ sang `docs/HUONG_DAN_GOOGLE_OAUTH.md`.
- `src/lib/auth-finance-access.test.ts`, `src/lib/auth-access-recheck.test.ts`: cập nhật theo kiểu trả về mới của `resolveAccess`/hành vi mới của `jwt`.

**Lệch/giới hạn đã biết:**
- `lockedAt` trong `googleAccessDecision` hiện luôn truyền `null` từ callback `signIn` vì cột `lockedAt` chưa tồn tại trong DB (chờ Task 5 - C đang giữ khoá `schema.prisma`). Sẽ nối giá trị thật ở Task 6 (`getAuthStore().getAccountState(email)`), đúng như kế hoạch.
- `createAccountAction` chặn trùng email chủ yếu bằng pre-check `findAccount` (không khoá), nhánh bắt `P2002` chỉ là phòng thủ cho race hiếm - đủ dùng vì đây là thao tác admin, tần suất tạo tài khoản trùng lúc rất thấp.

**Cổng kiểm:**
- `npx tsc --noEmit`: sạch.
- `npm test`: 207 file / 2310 test xanh (mốc trước Task 2 = 204/2293).
- `npm run build` (font mock): qua.
- `npm run test:e2e:a -- e2e/01-login.spec.ts e2e/07-admin.spec.ts e2e/20-dang-nhap-google.spec.ts`: 13/13 xanh.

**Chỗ Tester/Reviewer/Security-reviewer nên soi kỹ:**
- `resolveAccess` đổi hẳn sang fail-closed (`null` khi không có tài khoản hoặc DB lỗi) - soi kỹ mọi nơi còn gọi hàm này (hiện chỉ dùng trong test, không còn được gọi từ `jwt` callback) để chắc không có chỗ nào còn giả định nó trả object mặc định `viewer`.
- Google chỉ vào khi `email_verified === true` VÀ có trong `user_roles` VÀ `isActive` - test `auth-google.test.ts` đã phủ nhưng đáng chạy tay 1 lần với tài khoản Google thật khi có OAuth Client (chưa test được trong CI vì không có Google thật).
- Tài khoản chỉ Google đăng nhập bằng Credentials phải luôn thấy "sai email hoặc mật khẩu" (không phân biệt được tài khoản nào chỉ dùng Google) - đã kiểm ở e2e 20 lẫn `authorize()` (K7, không đổi trong Task 3, giữ hành vi cũ).
- `createAccountAction` giờ import `Prisma` từ `@prisma/client` trực tiếp trong `actions.ts` (trước đây tầng action không đụng Prisma trực tiếp, chỉ qua `repo`) - xem có muốn dọn lại theo mẫu `ProjectCodeTakenError` (lỗi tuỳ biến ném từ repo) ở đợt sau không, hiện tại chọn cách này vì Task 3 không được sửa `prisma-repo.ts`/`mock-repo.ts` (file nóng khác giữ, không nằm trong danh sách File của Task 3).

---

## Task 4: Hạ tầng D2/D3 không cần DB mới (`3414fff`)

Toàn bộ module ở Task này CHƯA được nối vào luồng đăng nhập/trang thật (đó là Task 6/7, sau khi Task 5 xong). Task 4 chỉ dựng hạ tầng, tự kiểm bằng test đơn vị với kho bộ nhớ.

**File mới:**
- `src/lib/login-policy.ts`: hằng số K5 (ngưỡng khoá 5 lần, giới hạn IP 20/15 phút, cửa sổ email lạ 24h, giới hạn xin link 3/giờ/email + 10/giờ/IP, TTL token 30 phút, retention 24h) + `normalizeEmail()`.
- `src/lib/reset-token.ts` + test: `generateResetToken()` (32 byte `crypto.randomBytes` -> base64url 43 ký tự, SHA-256 hex 64 ký tự), `hashResetToken()`, `isWellFormedResetToken()`.
- `src/lib/client-ip.ts` + test: `clientIpFrom(headers)` - phần tử đầu `x-forwarded-for`, rồi `x-real-ip`, cắt 64 ký tự.
- `src/server/repo/mock-repo-auth.ts` + test: `createMemoryAuthStore(source)` - triển khai đủ interface `AuthStore` (đếm sai, khoá/mở khoá, token đặt lại) cho chế độ mock; `failedLoginCount`/`lockedAt`/`passwordChangedAt` lưu tách khỏi `UserAccount` (chưa có cột DB tới Task 5) trong Map khép kín theo từng instance (không dùng `globalThis`, mỗi `createMemoryAuthStore()` độc lập).
- `src/server/login-guard.ts` + test: `checkCredentials(store, input, now?)` - đúng thứ tự luật ở K5-K7 (giới hạn IP trước, tài khoản null vẫn chạy bcrypt giả (K6), tài khoản khoá trả `locked` không tiết lộ mật khẩu đúng/sai, tài khoản chỉ Google/bị tắt luôn `invalid`).
- `src/server/password-reset.ts` + test: `requestPasswordReset`, `resetPasswordWithToken`, `isResetTokenUsable` - mọi nhánh (có tài khoản/email lạ/chỉ Google/bị tắt/bị giới hạn) đều trả `{ status: 'accepted' }` giống hệt nhau (S3); token dùng 1 lần, hết hạn 30 phút; đặt lại xong tài khoản đang khoá vẫn giữ khoá (K10).
- `src/server/auth-mail.ts` + test: `getAuthSmtpConfig()` (kênh email id nhỏ nhất có cấu hình hợp lệ, kể cả đang tắt cảnh báo - Q6=a), `queueAuthEmail()` (gửi nền, không throw, không log địa chỉ/nội dung), `resetMailer` (implement `ResetMailer`, `compose()` dùng `getTranslations({ locale, namespace: 'authSecurity' })` key `mailSubject`/`mailBody` - 2 key này CHƯA có trong `vi.json`/`en.json`, Task 7 mới thêm; `compose()` chưa được gọi thật ở đâu trong Task 4-6 nên chưa lộ lỗi thiếu key).

**File đã sửa:**
- `src/server/repo/types.ts`: thêm `ThrottleKind`, `AuthAccountState`, `AuthStore` (cuối file, không đụng phần khác).
- `src/server/notify/dispatch.ts`: tách hàm `smtpConfigFromChannel()` khỏi `sendToChannel()` (logic y hệt, chỉ đổi chỗ - không đổi hành vi); `sendToChannel` gọi lại hàm này. `dispatch.test.ts` thêm 4 test cho hàm mới, test cũ giữ nguyên.

**Lệch/giới hạn đã biết:**
- `mock-repo-auth.ts` không strict TDD (viết cùng lúc/trước test thay vì test đỏ trước) vì đây là module hoàn toàn mới, không có hành vi cũ cần bảo toàn - rủi ro thấp hơn sửa code có sẵn. Test vẫn phủ đủ 12 case theo kế hoạch, đã xanh.
- `getAuthSmtpConfig`/`resetMailer` chưa được gọi ở bất kỳ action/trang thật nào (chờ Task 7 nối `requestPasswordResetAction`) - test hiện tại chỉ kiểm đơn vị với mock repo/mailer giả, CHƯA kiểm tích hợp với DB thật hay next-intl thật.

**Cổng kiểm:**
- `npx tsc --noEmit`: sạch.
- `npm test`: 213 file / 2367 test xanh (mốc trước Task 3 = 207/2310).
- `npm run build` (font mock): qua.
- Không chạy e2e (kế hoạch không yêu cầu cho Task 4 - hạ tầng chưa nối vào trang/API thật nào).

**Chỗ Tester/Reviewer/Security-reviewer nên soi kỹ:**
- `checkCredentials` là nơi tập trung nhiều luật bảo mật nhất Task này (K5-K7, S3, S5, S6) - soi kỹ thứ tự kiểm tra (giới hạn IP trước, ghi throttle IP ở MỌI nhánh thất bại kể cả tài khoản đã khoá) khớp đúng bảng "Luật checkCredentials" trong `ke-hoach.md`.
- `requestPasswordReset` ghi throttle (`recordThrottle`) TRƯỚC KHI biết tài khoản có tồn tại hay không (để lần xin thứ N+1 vẫn bị đếm ngay cả với email lạ) - nhưng SAU bước kiểm tra giới hạn hiện tại (không tự đếm chồng lên chính nó ở lần bị chặn) - xem lại đúng ý "S4 - giới hạn xin link theo email và IP" chưa bị đếm 2 lần hay thiếu 1 lần ở biên.
- `mock-repo-auth.ts` dùng ISO string so sánh trực tiếp cho hạn token/cửa sổ throttle (không parse `Date`) - đúng vì mọi giá trị đều cùng định dạng cố định (`toISOString()`), nhưng nếu sau này có chỗ nào truyền ISO khác định dạng (thiếu mili giây, timezone khác) sẽ so sai - chưa có kiểm tra dạng cho các tham số `nowIso`/`sinceIso`.
- `queueAuthEmail`/`getAuthSmtpConfig` trùng tên/hành vi khá giống `queueAlertNotifications`/`dispatchAlertNotifications` (2 hàng đợi nền riêng biệt, không dùng chung) - có chủ đích (email quên mật khẩu không nên chờ hàng đợi cảnh báo), ghi rõ ở đây để Reviewer không nhầm là trùng lặp code thừa.

---

## Vòng sửa bảo mật 1 (sau security-reviewer, `.bangiao/bao-mat.md` L1-L8)

> Phạm vi: chỉ phần KHÔNG cần đổi schema (C vẫn đang giữ `schema.prisma`/`prisma/migrations/`/`prisma-repo.ts`).
> Mỗi lỗi có test đỏ (đã tự xác nhận bằng `git stash` chỉ phần code sửa, giữ nguyên test, chạy đỏ đúng lỗi mô tả, `git stash pop` khôi phục rồi xanh lại) rồi mới sửa. Không đụng `schema.prisma`/`prisma/migrations/`.

### L1 - Timing oracle ở nhánh "đã khoá" (KHẮC PHỤC)

- `src/server/login-guard.ts`: nhánh `account.lockedAt !== null` giờ gọi `verifyPassword(password, DUMMY_HASH)` TRƯỚC khi trả `locked`, giống hệt nhánh email lạ - không còn tốn ít thời gian hơn để lộ "email này có tồn tại và đã khoá".
- Test đỏ trước: `login-guard.test.ts` mục "L1" so số lần gọi `verifyPassword` giữa nhánh đã khoá và nhánh email lạ hoàn toàn xa lạ, phải bằng nhau và > 0.

### L2 - `X-Forwarded-For` tin phần tử đầu, fail-open khi thiếu IP (KHẮC PHỤC theo quyết định chủ dự án)

- `src/lib/client-ip.ts`: viết lại `clientIpFrom` - đọc `TRUSTED_PROXY_HOPS` (mặc định 1, giá trị không hợp lệ coi như 1), lấy phần tử tính từ PHẢI của `X-Forwarded-For` (mặc định = phần tử cuối); không có `X-Forwarded-For` hợp lệ thì rơi về `x-real-ip`; không có gì thì trả `'unknown'` (KHÔNG còn trả `''`/bỏ giới hạn).
- Dùng chung 1 hàm cho `src/lib/activity.ts` (log hoạt động), `app/api/export/route.ts`, `app/api/health/route.ts` (rate limit) - trước đây mỗi nơi tự viết lại logic lấy phần tử đầu.
- Thêm biến `TRUSTED_PROXY_HOPS` vào `.env.example` kèm chú thích (số tầng reverse proxy tin cậy phía trước app; mặc định 1).
- Đóng luôn 1 lỗ hổng cũ đã ghi nợ ở `PROGRESS.md` (P3D-B, "L-3 rate-limit /api/health né được qua X-Forwarded-For") - trước đây đổi phần tử đầu mỗi request là né được giới hạn `/api/health`, `/api/export` vô hạn lần; nay không còn né được vì khoá theo phần tử cuối (do proxy tin cậy ghi, client không sửa được).
- Test đỏ trước: `client-ip.test.ts` viết lại toàn bộ (lấy phần tử cuối thay vì đầu, `TRUSTED_PROXY_HOPS=2`, giá trị không hợp lệ coi như 1, không có IP nào trả `'unknown'`); thêm describe "L2" trong `export-route.test.ts`/`health-route.test.ts`: đổi phần tử ĐẦU của XFF liên tục 30/120 lần (giữ nguyên phần tử cuối) vẫn bị chặn 429 đúng hạn mức (trước đây sẽ KHÔNG BAO GIỜ bị chặn).
- **Việc cho tài liệu deploy (C, T17), bổ sung:** reverse proxy lúc deploy phải cấu hình đúng số tầng khớp `TRUSTED_PROXY_HOPS` (mặc định 1 = 1 reverse proxy trực tiếp trước app, vd Nginx/Caddy nối thêm IP client vào cuối `X-Forwarded-For`); nếu có thêm 1 tầng LB phía trước nữa thì đặt `TRUSTED_PROXY_HOPS=2`.

### L3 - Race TOCTOU trong `checkCredentials` (KHẮC PHỤC phần hợp đồng interface + mock; PHẦN PRISMA ĐỂ TASK 5)

- `src/server/repo/types.ts`: đổi `resetFailedLogin(email): Promise<void>` thành `Promise<boolean>` - phải NGUYÊN TỬ, tự kiểm `locked_at IS NULL` tại thời điểm ghi (không dựa vào bất kỳ giá trị đọc trước đó); `false` = đã bị khoá bởi 1 yêu cầu sai khác, bên gọi phải coi là "locked", KHÔNG được coi là đăng nhập thành công. JSDoc trong `types.ts` ghi rõ ví dụ câu SQL Prisma cho Task 5.
- `src/server/repo/mock-repo-auth.ts`: `resetFailedLogin` kiểm `lockedAt !== null` trước khi reset, trả `false` nếu đã khoá.
- `src/server/login-guard.ts`: nhánh mật khẩu đúng giờ LUÔN gọi `resetFailedLogin` (kể cả `failedLoginCount === 0` - trước đây bỏ qua hẳn bước này khi bộ đếm đang là 0, tức là dùng thẳng bản chụp `account` cũ để trả `ok:true` mà không xác nhận lại gì); `false` -> trả `{ ok:false, reason:'locked' }`.
- `.bangiao/ke-hoach.md` mục Task 5: thêm ghi chú cho C biết `resetFailedLogin` đổi kiểu trả về, phải cài atomic (`updateMany` có điều kiện `lockedAt: null`) khi làm `prisma-repo-auth.ts`.
- Test đỏ trước: `mock-repo-auth.test.ts` ("L3") - tài khoản đã khoá thì `resetFailedLogin` trả `false`, không đụng bộ đếm; `login-guard.test.ts` ("L3") gồm (1) test dùng `AuthStore` giả lập đúng kịch bản race (đọc thấy `lockedAt:null` nhưng `resetFailedLogin` trả `false` - mô phỏng có kiểm soát, không dựa vào suy đoán thứ tự `Promise.all` của JS vì không đáng tin cậy để làm test ổn định) - xác nhận `checkCredentials` LUÔN gọi `resetFailedLogin` và trả `locked` chứ không phải `ok:true`; (2) 1 test `Promise.all` thật với 10 yêu cầu sai đồng thời trên kho bộ nhớ, xác nhận không mất lần tăng bộ đếm nào (bất biến chung, không phụ thuộc thứ tự).
  **Còn để Task 5:** xác nhận bằng concurrency THẬT (nhiều kết nối Postgres song song) chỉ làm được khi có `prisma-repo-auth.ts` + `$transaction`/`updateMany` thật; phần này thuộc `prisma-repo-auth.test.ts` ở Task 5.

### L4 - Log tràn lan ở nhánh `rate_limited`, lưu email thô ở nhánh `no_account` (KHẮC PHỤC)

- `src/server/password-reset.ts`: nhánh bị giới hạn (`rate_limited`) KHÔNG còn gọi `logActivity` (trước đây ghi 1 dòng mỗi lần bị chặn, spam được `activity_log` vô hạn).
- Nhánh `no_account`: không còn lưu chuỗi email do người gọi tự nhập (có thể là bất kỳ chuỗi nào miễn đúng khuôn `normalizeEmail` - tối đa 254 ký tự, đúng 1 `@`) - đổi thành ghi cố định `{ name: 'khong-ton-tai', email: 'khong-ton-tai' }`, `detail` vẫn là `'no_account'` để phân biệt loại.
- Kiểu `RequestLogDetail` bỏ `'rate_limited'` (không còn nhánh nào ghi giá trị này).
- Test đỏ trước: `password-reset.test.ts` 2 test mới ("L4") - vượt hạn mức nhiều lần liên tục không ghi `logActivity` lần nào; nhánh no_account với email tuỳ ý không xuất hiện trong bất kỳ lời gọi `logActivity` nào.

### L5 - `consumeResetToken` (mock) không kiểm lại `isActive`/`passwordHash` (KHẮC PHỤC)

- `src/server/repo/mock-repo-auth.ts`: `consumeResetToken` giờ kiểm CÙNG điều kiện với `peekResetToken` (`account.passwordHash !== ''` và `account.isActive`) NGAY TẠI THỜI ĐIỂM TIÊU token, không chỉ tin token còn hạn - đóng kịch bản "cấp token rồi admin tắt tài khoản/chuyển tài khoản sang chỉ-Google trước khi người cầm link kịp dùng".
- Hợp đồng ghi trong JSDoc `AuthStore.consumeResetToken` (`types.ts`) để Task 5 cài Prisma giống hệt (kiểm trong transaction, không tách rời 2 bước).
- `.bangiao/ke-hoach.md` mục Task 5 đã có sẵn FK cascade (`PasswordResetToken.user onDelete: Cascade` - xoá tài khoản thì token tự mất); bổ sung thêm 1 dòng nhắc `consumeResetToken` Prisma phải kiểm `isActive`/`passwordHash` trong cùng transaction.
- Test đỏ trước: `mock-repo-auth.test.ts` 2 test mới ("L5") - tài khoản bị tắt / chuyển sang chỉ-Google SAU khi token đã cấp -> `consumeResetToken` phải trả `{ ok:false }` giống `peekResetToken`.

### L6 - Timing ở `requestPasswordReset` (KHẮC PHỤC)

- `src/server/password-reset.ts`: sau khi ghi throttle (`recordThrottle`), hàm trả `{ status: 'accepted' }` NGAY LẬP TỨC; toàn bộ phần còn lại (đọc tài khoản, sinh token, `replaceResetToken`, soạn mail, `mailer.queue`, ghi `logActivity`) chuyển vào hàm nền `finishPasswordResetRequest`, chạy qua 1 chuỗi Promise nối tiếp `resetRequestQueueTail` (cùng khuôn `queueAuthEmail`/`queueAlertNotifications`) - không `await` từ `requestPasswordReset`.
- Thêm `__resetRequestQueueIdleForTest()` (chỉ dùng trong test) để chờ hàng đợi nền chạy xong trước khi kiểm side-effect (giống `__authMailQueueIdleForTest`).
- **Cập nhật toàn bộ test cũ** (`password-reset.test.ts`, `login-reset-integration.test.ts`) thêm `await __resetRequestQueueIdleForTest()` ở đúng chỗ cần lấy token/kiểm mail đã gửi - hành vi cũ (đồng bộ) không còn đúng nữa, đây là thay đổi hành vi có chủ đích chứ không phải hồi quy.
- Test đỏ trước (test MỚI, không phải test cũ bị sửa): "L6" - ép 1 "thao tác chậm" bằng deferred promise (`gate`) trong `store.getAccountState`, xác nhận `requestPasswordReset()` trả `accepted` xong XONG mà thao tác chậm vẫn chưa hoàn tất (`composed` rỗng), chỉ sau khi mở `gate` + drain hàng đợi thì `mailer.compose` mới chạy - chứng minh phản hồi không còn chờ việc đọc tài khoản/soạn+gửi mail.

### L7 - Tài khoản chỉ Google bị khoá qua form mật khẩu (KHẮC PHỤC theo quyết định chủ dự án 2026-09-27, phương án b)

- `src/server/login-guard.ts`: tách nhánh `isGoogleOnly` (passwordHash rỗng) ra riêng, TRƯỚC nhánh mật khẩu sai/tài khoản tắt - vẫn chạy `verifyPassword(password, DUMMY_HASH)` (không lộ timing tài khoản nào là chỉ-Google), vẫn ghi IP sai (không đụng tới bảo vệ theo IP), nhưng KHÔNG gọi `registerFailedLogin` -> không tăng bộ đếm, không bao giờ bị khoá vì sai ở form mật khẩu.
- Test đỏ trước: sửa lại test cũ (đã sai theo quyết định mới) trong `login-guard.test.ts` - gọi 10 lần sai liên tiếp (vượt xa ngưỡng 5), xác nhận `failedLoginCount` vẫn là 0 và `lockedAt` vẫn `null`, đồng thời `verifyPassword` vẫn được gọi (không lộ timing).

### L8 - Đăng nhập Google bị từ chối không để lại dấu vết (KHẮC PHỤC)

- `src/lib/auth.ts`: callback `signIn` nhánh Google, khi `googleAccessDecision(...) !== 'allow'`, ghi `logActivity({ name: user.name ?? email, email }, 'login_google_denied', decision)` trước khi trả `false` (decision là 1 trong `unverified|not_found|inactive|locked`, không phải token/link).
- Thêm key i18n `activity.login_google_denied` vào CUỐI nhóm `activity` trong `vi.json`/`en.json` (đã kiểm `phien-B.md`/`phien-C.md` không ai giữ 2 file này trước khi sửa, đã ghi giữ vào `phien-A.md`, nhả ngay sau khi commit xong vòng sửa này).
- Test đỏ trước: `auth-google.test.ts` thêm describe "L8" - 3 nhánh từ chối (`unverified`/`not_found`/`inactive`) đều ghi đúng `login_google_denied` kèm decision; nhánh được chấp nhận KHÔNG ghi; không log nào chứa chuỗi `token`/`http`.

### Ghi chú của tester (không phải L1-L8, việc phụ đính kèm theo yêu cầu)

- `src/server/validation.ts`: `createAccountSchema.email` thêm `.trim().toLowerCase()` trước `.email()`, kèm thông báo lỗi tiếng Việt cố định `'Email không hợp lệ'` (trước đây dùng message mặc định tiếng Anh của zod, hiện xuống thẳng UI qua `UserEditor.tsx` vì không map riêng).
  **Đổi hành vi có chủ đích:** email có khoảng trắng đầu/cuối giờ được TRIM rồi chấp nhận (trước đây bị từ chối thẳng) - đã cập nhật lại test cũ `actions-account-duplicate-email.test.ts` (không còn kỳ vọng từ chối, mà kỳ vọng email khoảng trắng trùng với email đã có bị chặn `duplicate`, giữ đúng tinh thần "không lách qua kiểm trùng bằng biến thể khoảng trắng").
  Test đỏ trước: `validation.test.ts` mục "createAccountSchema - email trim + thong bao tieng Viet".

### Cổng kiểm cuối vòng sửa

- `npx tsc --noEmit`: sạch.
- `npm test`: **217 file / 2408 test xanh** (mốc trước vòng sửa: 217/2385; +23 test mới, không xoá/skip test nào).
- Đã tự kiểm TDD bằng `git stash push` CHỈ 10 file mã nguồn đã sửa (giữ nguyên mọi file test) rồi chạy lại các test liên quan: toàn bộ đúng như mô tả từng lỗi ở trên đều ĐỎ (L1: so lệch số lần gọi bcrypt; L2: 8 test client-ip đỏ + export/health "không bao giờ 429"; L3: đúng 5 test mock/guard đỏ; L7: sai kỳ vọng cũ; L8: 3 test đỏ vì không gọi `logActivity`) rồi `git stash pop` khôi phục, chạy lại xanh 100%.
- `npm run build` (font mock): qua.
- `npm run test:e2e:a -- e2e/01-login.spec.ts e2e/07-admin.spec.ts e2e/20-dang-nhap-google.spec.ts` (cổng 3010, DB tạm `ddc_control_tower_e2e_a`): **13/13 xanh**.

### File nóng đụng tới trong vòng sửa này

- `vi.json`, `en.json`: chỉ thêm 1 key `activity.login_google_denied` ở cuối nhóm `activity`, không đổi/xoá key nào khác - đã kiểm `phien-B.md`/`phien-C.md` trước khi sửa (không ai giữ), ghi giữ vào `phien-A.md`, nhả ngay sau commit.
- Không đụng `actions.ts`, `prisma-repo.ts`, `queries.ts`, `project-queries.ts`, `schema.prisma`, `prisma/migrations/`, `globals.css`.

### Việc còn lại (để Task 5, khi C nhả khoá schema)

- `prisma-repo-auth.ts`: cài `resetFailedLogin` nguyên tử (`updateMany` với `where: { email, lockedAt: null }`), `consumeResetToken` kiểm `isActive`/`passwordHash` trong cùng transaction - đã ghi rõ hợp đồng trong `types.ts` + ghi chú thêm trong `ke-hoach.md` mục Task 5.
- Kiểm concurrency THẬT (nhiều kết nối Postgres song song) cho L3 - phần mock chỉ mô phỏng có kiểm soát, chưa phải bằng chứng cho database thật.
