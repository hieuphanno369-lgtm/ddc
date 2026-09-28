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
- `src/lib/client-ip.ts` + test: `clientIpFrom(headers)` - phần tử đầu `x-forwarded-for`, rồi `x-real-ip`, cắt 64 ký tự. (Đã thay ở vòng sửa bảo mật 1-2: L2 đổi sang lấy theo `TRUSTED_PROXY_HOPS` tính từ phải, R3 gộp IP rỗng vào khoá `'unknown'` thay vì bỏ giới hạn - xem mục L2/R3 bên dưới.)
- `src/server/repo/mock-repo-auth.ts` + test: `createMemoryAuthStore(source)` - triển khai đủ interface `AuthStore` (đếm sai, khoá/mở khoá, token đặt lại) cho chế độ mock; `failedLoginCount`/`lockedAt`/`passwordChangedAt` lưu tách khỏi `UserAccount` (chưa có cột DB tới Task 5) trong Map khép kín theo từng instance (không dùng `globalThis`, mỗi `createMemoryAuthStore()` độc lập).
- `src/server/login-guard.ts` + test: `checkCredentials(store, input, now?)` - đúng thứ tự luật ở K5-K7 (giới hạn IP trước, tài khoản null vẫn chạy bcrypt giả (K6), tài khoản khoá trả `locked` không tiết lộ mật khẩu đúng/sai, tài khoản chỉ Google/bị tắt luôn `invalid`). (Đã thay ở vòng sửa bảo mật 1-2: L1 nhánh đã khoá cũng chạy bcrypt giả để cân timing, L7/R1 tài khoản chỉ Google không còn luôn `invalid` mà đi chung nhánh email lạ - có thể `locked` từ lần sai thứ 5 - xem mục L1/L7/R1 bên dưới.)
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

---

## Vòng sửa bảo mật 2 (sau security-reviewer KHÔNG ĐẠT lần 2, `.bangiao/bao-mat.md` mục "Vòng 2", R1-R7)

Mỗi mục đều làm test đỏ trước (xác nhận bằng `git stash push` chỉ phần code sửa, giữ nguyên test, chạy đỏ đúng mô tả, rồi `git stash pop` xanh lại) rồi mới sửa code.

### R1 - Bản sửa L7 mở đường lộ email mới: tài khoản chỉ Google không bao giờ báo `locked` (KHẮC PHỤC)

- `src/server/login-guard.ts`: nhánh `isGoogleOnly` giờ đi Y HỆT nhánh "email lạ" - ghi/đếm CHUNG 1 kho theo email (`recordThrottle`/`countThrottle` kind `login_fail_unknown_email`, cửa sổ 24h, ngưỡng `LOGIN_LOCK_THRESHOLD`), trả `locked` từ lần sai thứ 5 giống hệt nhánh email lạ; vẫn KHÔNG gọi `registerFailedLogin`, KHÔNG đặt `lockedAt` (giữ đúng quyết định L7 = (b): không ảnh hưởng đăng nhập Google thật, không khoá tài khoản qua form mật khẩu).
- Sửa docstring `AuthStore`/`ThrottleKind` (`types.ts`) ghi rõ `login_fail_unknown_email` dùng chung cho cả 2 trường hợp.
- Test đỏ trước: sửa lại test cũ đã khoá cứng hành vi sai (`login-guard.test.ts` mục "tai khoan chi Google...") - 10 lần sai giờ kỳ vọng 4 lần đầu `invalid`, từ lần 5 `locked` (trước đây luôn `invalid`); `failedLoginCount` vẫn 0, `lockedAt` vẫn `null`. Thêm test MỚI "bảng so reason" chạy 6 lần sai cho 3 loại email (lạ / chỉ Google / tài khoản thật sai mật khẩu) trên 3 kho riêng, xác nhận dãy `reason` GIỐNG HỆT nhau (`invalid,invalid,invalid,invalid,locked,locked`) - không còn cách nào phân biệt loại email qua `reason`.

### R2 - Giới hạn IP/email "đếm rồi ghi" (không nguyên tử), bắn song song vượt ngưỡng (KHẮC PHỤC)

- Thêm 2 hàm mới vào `AuthStore` (`types.ts`, cài ở `mock-repo-auth.ts`): `reserveThrottle(kind, key, nowIso, sinceIso, limit)` - đếm cửa sổ + ghi thêm 1 dòng nếu còn chỗ, TRONG CÙNG 1 lời gọi (không có `await` nào xen giữa đếm và ghi, nên atomic đúng nghĩa JS đơn luồng khi nhiều lời gọi `checkCredentials`/`requestPasswordReset` chạy đồng thời qua `Promise.all` - xem JSDoc trong `types.ts` giải thích vì sao `Array.from(... , () => fn())` rồi `Promise.all` chạy phần đồng bộ của mỗi lời gọi TUẦN TỰ, không interleave); `releaseThrottle(kind, key, nowIso)` - rút lại đúng 1 dòng vừa ghi. (Chữ ký `reserveThrottle`/`releaseThrottle` mô tả ở đây đã thay bởi N2: trả/nhận `id` thay vì `kind/key/nowIso` - xem mục N2 bên dưới.)
- `src/server/login-guard.ts`: `checkCredentials` giờ "đặt chỗ" IP (`reserveThrottle('login_fail_ip', ...)`) NGAY ĐẦU HÀM, TRƯỚC bcrypt và trước khi biết mật khẩu đúng/sai (trước đây đếm trước, ghi SAU khi đã chạy xong toàn bộ nhánh xử lý - N yêu cầu đồng thời đều đọc thấy số đếm cũ). Nếu cuối cùng mật khẩu ĐÚNG thì `releaseIpSlot()` rút lại chỗ đã đặt (không tính lượt đúng vào giới hạn IP).
- `src/server/password-reset.ts`: `requestPasswordReset` thay `countThrottle` + `recordThrottle` tách rời bằng `reserveThrottle` cho CẢ email lẫn IP, cùng nguyên tắc.
- **Bắt buộc cho Task 5:** `ke-hoach.md` mục Task 4 (luật `checkCredentials`) + JSDoc `AuthStore.reserveThrottle` trong `types.ts` đã ghi rõ: Prisma phải cài `reserveThrottle`/`releaseThrottle` THẬT NGUYÊN TỬ (ví dụ 1 câu `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < $limit RETURNING 1`, hoặc transaction có khoá dòng) - không được quay lại kiểu "1 câu SELECT đếm rồi 1 câu INSERT riêng". (Đã thay bởi N2 + `ke-hoach.md` mục Task 5, bước 5.1: bắt buộc dùng `pg_advisory_xact_lock` trong 1 transaction, không chỉ `INSERT ... SELECT ... RETURNING` đơn thuần - xem mục N2 bên dưới.)
- Test đỏ trước: `mock-repo-auth.test.ts` 3 test mới cho `reserveThrottle`/`releaseThrottle`; `login-guard.test.ts` thêm test "R2" (`Promise.all` 30 request sai đồng thời từ 1 IP, xác nhận số lần gọi `verifyPassword` <= `IP_FAIL_LIMIT` và đúng 10 request còn lại là `ip_limited`); `password-reset.test.ts` thêm test "R2" tương tự cho `reset_req_ip` (30 request đồng thời, số thư gửi <= `RESET_IP_LIMIT`).

### R3 - IP rỗng vẫn bỏ giới hạn (KHẮC PHỤC)

- `src/server/login-guard.ts`, `src/server/password-reset.ts`: `ipKey = ip.trim() || 'unknown'`, LUÔN đếm LUÔN ghi qua `ipKey` (không còn `if (ip !== '')` nào bỏ qua giới hạn IP như trước - đây chính là lỗ hổng fail-open cũ).
- Sửa test cũ đã khoá cứng hành vi sai: `login-guard.test.ts:229` ("ip = '' -> khong bao gio ip_limited") đổi thành "R3: ip = '' gom vào khoá 'unknown', VẪN bị giới hạn như 1 IP thật" (20 lần sai từ nhiều email khác nhau với `ip:''` thì lần 21 phải `ip_limited`). Thêm test tương tự cho `password-reset.test.ts`.
- `ke-hoach.md` dòng ~389 (luật `checkCredentials` bước 1) và dòng ~426 (mục 4.4 mô tả test `login-guard.test.ts`) đã sửa lại theo hành vi mới, đánh dấu rõ "[SỬA ở vòng bảo mật 2, R2/R3]".

### R4 - Khoá chung `'unknown'` có thể tự khoá lẫn nhau khi thiếu reverse proxy (quyết định chủ dự án = (a))

- `src/lib/client-ip.ts`: thêm `warnUnknownIpOnce()` - ở `NODE_ENV=production`, gặp `'unknown'` thì `console.warn` TỐI ĐA 1 LẦN mỗi cửa sổ 15 phút (không spam log mỗi request); không cảnh báo ở dev/test.
- `app/api/health/route.ts`: thêm trường `clientIpResolved: boolean` (`ip !== 'unknown'`) vào JSON trả về - KHÔNG lộ IP thật, chỉ 1 cờ đúng/sai để giám sát triển khai phát hiện thiếu cấu hình proxy.
- `.env.example` (mục `TRUSTED_PROXY_HOPS`) và `.bangiao/ke-hoach.md` mục Task 8.4 (checklist bàn giao deploy): ghi rõ reverse proxy BẮT BUỘC tự nối `X-Forwarded-For`, kiểm nhanh sau deploy bằng `GET /api/health` -> `clientIpResolved` phải `true`.
- Ghi quyết định vào `.bangiao/bao-mat.md` mục "Quyết định của chủ dự án": thêm dòng `R4 (vòng 2) = (a)`.
- **Sửa vỡ 1 test đang có sẵn:** `src/server/health-route.test.ts` (P3D-B) trước đây khoá cứng `/api/health` CHỈ có 2 trường `status`/`time` - đã cập nhật lại (đổi tên mô tả, thêm 2 test mới cho `clientIpResolved`); `e2e/09-chan-chua-dang-nhap.spec.ts` dòng 101 cũng khoá cứng y hệt, đã sửa theo (bị đỏ khi chạy e2e bắt buộc, đã tìm ra và sửa trước khi bàn giao).
- Test đỏ trước: `client-ip.test.ts` 2 test mới (production + unknown -> warn đúng 1 lần; không phải production -> không warn).

### R5 - Proxy chỉ đặt `X-Real-IP` thì XFF do client gửi vẫn thắng (đã sửa chú thích, KHÔNG thêm `CLIENT_IP_HEADER`)

- `src/lib/client-ip.ts`: sửa docstring nói rõ proxy PHẢI tự NỐI THÊM (`proxy_add_x_forwarded_for`), không phải GHI ĐÈ (`proxy_set_header ... $remote_addr`) vào `X-Forwarded-For`; chỉ đặt `X-Real-Ip` là KHÔNG ĐỦ vì hàm ưu tiên đọc XFF trước.
- **Đã cân nhắc và CHỌN KHÔNG thêm** biến `CLIENT_IP_HEADER` (chọn hẳn 1 trong 2 header): rủi ro mức Thấp, chỉ xảy ra khi proxy hoàn toàn không xử lý XFF; thêm 1 biến cấu hình mới cho 1 rủi ro hiếm làm phình bề mặt cấu hình không cần thiết. Ghi rõ yêu cầu triển khai (Task 8 checklist + `.env.example`) là đủ giảm rủi ro thực tế.
- Không cần test riêng (chỉ đổi chú thích/tài liệu).

### R6 - Hàng đợi nền quên mật khẩu bị TREO thì chặn việc sau (KHẮC PHỤC)

- `src/server/password-reset.ts`: thêm `withTimeout()` (30 giây) bọc quanh `finishPasswordResetRequest` trong chuỗi `resetRequestQueueTail`. Việc NÉM LỖI (throw) đã được `.catch()` xử lý đúng từ vòng 1 (chuỗi vẫn tiếp tục); lỗ hổng CÒN LẠI là việc bị TREO (không bao giờ resolve/reject, ví dụ SMTP treo mạng) - khi đó `.then()` của việc sau chờ mãi mãi vì Promise không có cơ chế huỷ. `withTimeout` ép việc quá 30 giây bị coi là lỗi để hàng đợi không treo theo.
- Test đỏ trước: `password-reset.test.ts` thêm 2 test "R6" - (1) việc đầu NÉM LỖI (xác nhận hành vi đã đúng từ vòng 1, không log token/email); (2) việc đầu bị TREO (`vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(30_000)`) - việc sau vẫn được gửi.

### R7 - Log Google chưa xác minh: `name` tuỳ ý, không giới hạn độ dài (KHẮC PHỤC PHẦN 1+2, PHẦN 3 để Task 5)

- `src/lib/activity.ts`: `logActivity` giờ CẮT ĐỘ DÀI trước khi ghi (`userEmail` <= 254, `userName` <= 100, `userAgent` <= 256, `detail` <= 500) - áp dụng cho MỌI lời gọi, không chỉ nhánh Google (dữ liệu đầu vào không đáng tin tuyệt đối, cắt ở 1 chỗ chung thay vì từng nơi gọi tự kiểm). File test mới `activity.test.ts` (5 test, file `activity.ts` trước đây chưa có test riêng).
- `src/lib/auth.ts`: callback `signIn` nhánh `decision === 'unverified'` (Google CHƯA xác minh email, nên `profile`/`user.name` KHÔNG đáng tin) giờ ghi `name` CỐ ĐỊNH (`'(email chua xac minh)'`) thay vì `user.name` tuỳ ý; 3 nhánh còn lại (`not_found`/`inactive`/`locked`, email ĐÃ được Google xác minh) vẫn dùng tên thật.
- **Phần 3 (chưa làm, để Task 5):** giới hạn tần suất ghi `login_google_denied` - đã ghi rõ lý do trong comment `auth.ts`: callback này không có `AuthStore`/bảng đếm nào để tiêm vào (khác `checkCredentials`), và không được đụng `schema.prisma` ở vòng sửa này; Task 5 nối bảng `auth_throttle` vào đây (ví dụ gọi `reserveThrottle('login_fail_unknown_email', email, ...)` trước khi ghi log) thay vì tự chế 1 bộ đếm trong tiến trình (không sống sót qua restart, sai khi chạy nhiều instance).
- Test đỏ trước: `activity.test.ts` (4 test cắt độ dài); `auth-google.test.ts` thêm 2 test "R7" - nhánh `unverified` với `name` tuỳ ý bị kẻ tấn công khai vẫn ghi tên cố định; nhánh `not_found` (email thật) vẫn ghi đúng tên thật.

### Ghi chú nhỏ đính kèm theo yêu cầu

- `src/server/actions.ts:351`: bỏ `.toLowerCase()` thừa trong `createAccountAction` - `createAccountSchema.email` đã `.trim().toLowerCase()` lúc `safeParse`, gọi lại là thừa (không phải lỗi, chỉ dọn).
- `src/server/validation.ts`: `resetPasswordSchema.email` thêm `.trim()` (trước đây khoảng trắng đầu/cuối làm báo lỗi định dạng thay vì lỗi đúng nguyên nhân). Test mới trong `validation.test.ts`.

### Cổng kiểm cuối vòng sửa bảo mật 2

- `npx tsc --noEmit`: sạch.
- `npm test`: **218 file / 2429 test xanh** (mốc trước vòng sửa: 217/2408; +1 file mới `src/lib/activity.test.ts`, +21 test, không xoá/skip test nào).
- `npm run build` (font mock): qua sạch, không cảnh báo mới.
- `npm run test:e2e:a -- e2e/01-login.spec.ts e2e/07-admin.spec.ts e2e/20-dang-nhap-google.spec.ts e2e/09-chan-chua-dang-nhap.spec.ts`: **54/54 xanh** (phát hiện + sửa 1 chỗ vỡ do R4: `e2e/09-chan-chua-dang-nhap.spec.ts` dòng 101 khoá cứng shape `/api/health`).

### File nóng đụng tới trong vòng sửa bảo mật 2

- `src/server/actions.ts`: chỉ 2 dòng (bỏ `.toLowerCase()` thừa) - đã kiểm `phien-B.md`/`phien-C.md` trước khi sửa (không ai giữ), ghi giữ vào `phien-A.md`, nhả ngay sau commit.
- Không đụng `prisma-repo.ts`, `vi.json`, `en.json`, `queries.ts`, `project-queries.ts`, `schema.prisma`, `prisma/migrations/`, `globals.css` (không cần cho vòng sửa này - phần cắt độ dài R7 đặt ở `logActivity` chung theo đúng yêu cầu, không đụng repo).

### Việc còn lại (để Task 5, khi C nhả khoá schema)

- `reserveThrottle`/`releaseThrottle` (Prisma) - PHẢI nguyên tử thật (xem ghi chú R2 ở trên + JSDoc `types.ts`).
- R7 phần 3: giới hạn tần suất ghi `login_google_denied` bằng bảng `auth_throttle`.
- (Kế thừa từ vòng 1) `resetFailedLogin`, `consumeResetToken` Prisma nguyên tử; kiểm concurrency THẬT trên Postgres.

---

## Vòng sửa bảo mật 3 (sau security-reviewer KHÔNG ĐẠT lần 3, `.bangiao/bao-mat.md` mục "Vòng 3", N1-N4, G1-G2)

Mỗi lỗi có sửa code đều làm test đỏ trước (xác nhận bằng `git stash push` CHỈ 4 file mã nguồn đã sửa
`types.ts`/`mock-repo-auth.ts`/`login-guard.ts`/`password-reset.ts`, giữ nguyên mọi file test, chạy
đỏ đúng mô tả, rồi `git stash pop` khôi phục lại xanh) rồi mới sửa. N3 (tài liệu), N4 và G1 (chỉ thêm
test/ghi chú, không có lỗi code nào để sửa) không cần bước này.

### N1 - Đặt chỗ throttle theo EMAIL trước IP ở `requestPasswordReset` (KHẮC PHỤC)

- `src/server/password-reset.ts`: đảo lại thứ tự "đặt chỗ" - `reserveThrottle('reset_req_ip', ...)` chạy TRƯỚC, chỉ khi IP còn chỗ mới `reserveThrottle('reset_req_email', ...)`; email hết chỗ thì `releaseThrottle(ipReserved)` nhả lại ĐÚNG chỗ IP vừa đặt (giống cách `checkCredentials` nhả chỗ IP khi mật khẩu đúng) rồi mới trả `accepted`.
- Trước đây đặt chỗ email TRƯỚC IP nên 1 IP gửi rác đủ 10 yêu cầu (đã hết `RESET_IP_LIMIT`) vẫn kịp ghi 1 dòng `reset_req_email` cho nạn nhân TRƯỚC KHI biết IP đã hết lượt - 1 IP khoá được lượt xin link của bất kỳ email nào, kể cả email chưa từng bị đụng tới.
- Test đỏ trước: `password-reset.test.ts` mục "N1" - IP X gửi đủ `RESET_IP_LIMIT` yêu cầu cho các email rác, yêu cầu tiếp theo từ IP X cho email V bị chặn và `countThrottle('reset_req_email', V)` vẫn `0`; từ 1 IP khác (chưa bị giới hạn), V vẫn nhận đủ `RESET_EMAIL_LIMIT` mail. Chạy trên code cũ: đỏ (`countThrottle` trả `1` thay vì `0`).

### N2 - Hợp đồng `reserveThrottle`/`releaseThrottle` đổi sang trả/nhận `id` (KHẮC PHỤC HỢP ĐỒNG + BẢN BỘ NHỚ; PHẦN PRISMA ĐỂ TASK 5)

- `src/server/repo/types.ts`: `reserveThrottle(...)` đổi kiểu trả về từ `Promise<boolean>` sang `Promise<number | null>` (trả `id` - khoá chính của dòng vừa ghi khi còn chỗ, `null` khi hết chỗ); `releaseThrottle(kind, key, nowIso)` đổi thành `releaseThrottle(id: number)` - xoá theo khoá chính, không còn suy luận lại từ `kind/key/createdAt`.
- JSDoc ghi rõ cho Task 5: bản Prisma **bắt buộc** chạy `reserveThrottle` trong 1 transaction có `pg_advisory_xact_lock(hashtext(kind || ':' || key))` rồi mới đếm cửa sổ + ghi dòng mới - 1 câu `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < $limit` đơn thuần ở READ COMMITTED là KHÔNG ĐỦ (nhiều giao dịch song song vẫn cùng thấy số đếm cũ trước khi bên kia COMMIT); `releaseThrottle(id)` xoá theo khoá chính, **CẤM** cài bằng `deleteMany` lọc theo `kind/key/createdAt` (2 dòng ghi trùng mili giây sẽ bị xoá nhầm cả 2).
- `src/server/repo/mock-repo-auth.ts`: thêm `id: number` vào `ThrottleRow` (bộ đếm `nextThrottleId` riêng mỗi `createMemoryAuthStore()`); `reserveThrottle` trả `id` vừa cấp hoặc `null`; `releaseThrottle(id)` xoá theo `id`.
- `src/server/login-guard.ts`, `src/server/password-reset.ts`: cập nhật theo chữ ký mới (giữ nguyên hành vi nghiệp vụ, chỉ đổi cách truyền/nhận `id` thay vì `kind/key/nowIso`).
- Chưa có bản Prisma nào của `AuthStore` ở thời điểm này (Task 5 chưa bắt đầu, không có `prisma-repo-auth.ts`) nên không có gì để sửa theo hợp đồng mới ngoài kho bộ nhớ + 2 nơi gọi - đã ghi rõ hợp đồng bắt buộc trong `types.ts` + `ke-hoach.md` mục Task 5, cho tài khoản A làm ở Task 5 sau khi C nhả khoá schema (không phải C tự làm - Task 5 vẫn do tài khoản A này thực hiện, chỉ chờ C nhả khoá `schema.prisma`/`prisma/migrations/`/`prisma-repo.ts`).
- Test: `mock-repo-auth.test.ts` mục "reserveThrottle / releaseThrottle" cập nhật lại theo `id`/`null`; thêm test mới "N2" - 2 lời gọi `reserveThrottle` cùng `kind/key/createdAt` (cố tình trùng mili giây) trả 2 `id` khác nhau, `releaseThrottle(id1)` chỉ xoá đúng 1 dòng, dòng còn lại (`id2`) vẫn còn (`countThrottle` vẫn đếm được 1). Test đỏ trước trên chữ ký cũ (kiểu trả về sai, không có `id`).

### N3 - Kế hoạch còn luật cũ mâu thuẫn code (SỬA TÀI LIỆU, không đổi code)

- `.bangiao/ke-hoach.md`: viết lại mục "Luật `checkCredentials`" và "Luật `requestPasswordReset`" cho khớp code hiện tại (thứ tự IP-trước-email của N1, hợp đồng `id` của N2, nhánh chỉ-Google chung kho với email lạ của R1, không còn `rate_limited` sau L4, `no_account` ghi tên cố định); sửa dòng test-plan 4.4 (mục Google-only/`isActive=false`) cho đúng hành vi hiện tại; thêm ghi chú test mới N4/G2 (4.4) và N1 (4.5) vào danh sách.

### N4 - Thêm test tầng `checkCredentials`: đăng nhập đúng xen kẽ không làm giảm số lần sai theo IP (CHỈ THÊM TEST, hành vi đã đúng từ vòng 2/R2)

- `src/server/login-guard.test.ts`: 19 lần sai từ IP X, xen 5 lần đăng nhập ĐÚNG từ CÙNG IP X (mỗi lần đúng reserve rồi release ngay, không tính vào giới hạn), lần sai thứ 20 vẫn `invalid`, lần kế tiếp mới `ip_limited`; `countThrottle('login_fail_ip', X)` đúng bằng `20`.
- Không cần red-before-fix vì không có lỗi code: cơ chế reserve-trước/release-khi-đúng đã có sẵn từ R2 (vòng 2), test này chỉ bổ sung bằng chứng cho trường hợp cụ thể mà bao-mat.md yêu cầu.

### G2 - `checkCredentials` chưa chuẩn hoá email trước khi làm khoá throttle (KHẮC PHỤC)

- `src/server/login-guard.ts`: thêm `const email = input.email.trim().toLowerCase();` ngay đầu hàm (trước khi dùng làm khoá `login_fail_unknown_email` hay gọi `getAccountState`) - trước đây dùng thẳng chuỗi thô người gọi gõ, nên `"A@Foo.com"`, `" a@foo.com "` và `"a@foo.com"` bị đếm thành 3 khoá throttle khác nhau (bộ đếm/khoá email lạ có thể bị lách qua bằng biến thể hoa/thường hoặc khoảng trắng).
- Test đỏ trước: `login-guard.test.ts` mục "G2" - gọi `checkCredentials` 3 lần với 3 biến thể casing/khoảng trắng của cùng 1 email lạ, `countThrottle('login_fail_unknown_email', 'la@daidung.com.vn')` phải bằng `3`. Chạy trên code cũ: đỏ (chỉ đếm được `1`, vì chỉ lời gọi thứ 2 dùng đúng chuỗi đã chuẩn hoá).

### Ghi chú (không phải lỗi code, đính kèm theo yêu cầu)

- G1: tài khoản chỉ Google thừa hưởng NGUYÊN giới hạn đã biết K6 của nhánh "email không tồn tại" (đã có từ R1 vòng 2) - phân biệt được với tài khoản thật bằng cách nhánh Google-only không bao giờ tăng `failedLoginCount` thật/đặt `lockedAt`, và cửa sổ đếm là 24 giờ (giống email lạ) thay vì khoá vĩnh viễn như tài khoản thật; đây là giới hạn đã biết, chấp nhận được (không phải lỗ hổng cần vá thêm ở vòng này).

### Cổng kiểm cuối vòng sửa bảo mật 3

- `npx tsc --noEmit`: sạch.
- `npm test`: **218 file / 2433 test xanh** (mốc trước vòng sửa: 218/2429; +4 test mới: N1, N2, N4, G2 - không xoá/skip test nào).
- Không chạy lại e2e (vòng sửa này không đụng route/UI nào, chỉ đổi logic nội bộ `login-guard.ts`/`password-reset.ts`/`repo/types.ts`/`repo/mock-repo-auth.ts` và tài liệu).

### File nóng đụng tới trong vòng sửa bảo mật 3

- Không đụng file nóng nào (`prisma-repo.ts`, `actions.ts`, `vi.json`, `en.json`, `queries.ts`, `project-queries.ts`, `schema.prisma`, `prisma/migrations/`, `globals.css`) - chưa có bản Prisma của `AuthStore` nên không có gì để sửa trong `prisma-repo.ts` ở vòng này.

### Việc còn lại (để Task 5, khi C nhả khoá schema)

- Cài `prisma-repo-auth.ts` (`reserveThrottle`/`releaseThrottle`) đúng hợp đồng `id`-based mới, dùng `pg_advisory_xact_lock` - xem JSDoc `types.ts` + mục Task 5 `ke-hoach.md`.
- R7 phần 3, `resetFailedLogin`/`consumeResetToken` Prisma nguyên tử, kiểm concurrency THẬT trên Postgres (kế thừa từ vòng 1-2, chưa đổi).

---

## Vòng sửa bảo mật 4 (security-reviewer ĐẠT, `.bangiao/bao-mat.md` mục "Vòng 4", `ece9028`)

Kết luận security-reviewer: **ĐẠT** (`ece9028`) - N1, N2 (phần hợp đồng và kho bộ nhớ), N3, N4, G2 đã đóng ở vòng 3; còn lại L1, L2 ở mức Thấp, không chặn ĐẠT (G3-G7 chỉ là ghi chú giới hạn đã biết, không phải lỗi cần vá thêm).

### L1 - Nhả chỗ IP khi email hết lượt có làm mất 1 phần giới hạn IP không (quyết định chủ dự án 2026-09-28, phương án b)

- Câu hỏi: ở N1 (vòng 3), khi IP còn chỗ nhưng email đã hết lượt, `requestPasswordReset` gọi `releaseThrottle(ipReserved)` nhả lại đúng chỗ IP vừa đặt rồi mới trả `accepted` - vậy 1 IP có thể "xả" nhiều lượt bấm dư của CÙNG 1 email mà không bị tính vào hạn mức IP của chính nó không?
- Chủ dự án chọn phương án (b): **không** tính lượt bấm dư của 1 email vào hạn mức IP - giữ nguyên hành vi nhả chỗ hiện tại của `password-reset.ts`. Lý do nghiệp vụ: 1 người bấm quá tay xin link nhiều lần không nên làm đồng nghiệp dùng chung mạng văn phòng (cùng IP) bị mất lượt xin link của họ.
- Đã chọn KHÔNG vá thêm bằng code: chặn spam theo IP là việc của tầng reverse proxy (giới hạn tần suất `POST` quên mật khẩu theo IP), đã ghi vào checklist bàn giao deploy Task 8.4 trong `ke-hoach.md`.

### L2 - Chốt hành vi nhả chỗ IP bằng test (KHÔNG PHẢI lỗi code, chỉ thêm test xác nhận quyết định L1)

- `src/server/password-reset.test.ts` (`c1a6c48`): thêm test "L2 (bao mat vong 4)" xác nhận `releaseThrottle(ipReserved)` được gọi đúng khi email hết lượt (IP còn chỗ) - đã tự kiểm bằng cách tạm bỏ dòng gọi `releaseThrottle` đó thì test đỏ đúng mô tả (`expected 10 to be 3` - IP không được nhả lại nên hạn mức IP giảm sai), khôi phục lại thì xanh.

### Cổng kiểm cuối vòng sửa bảo mật 4

- `npx tsc --noEmit`: sạch.
- `npm test`: **218 file / 2434 test xanh** (mốc trước vòng 4: 218/2433; +1 test mới "L2").
- Không chạy lại e2e (vòng sửa này chỉ thêm 1 test đơn vị + ghi quyết định vào `bao-mat.md`/`ke-hoach.md`, không đổi hành vi route/UI nào).

### File nóng đụng tới trong vòng sửa bảo mật 4

- Không đụng file nóng nào.

---

## Vòng sửa hồ sơ bàn giao (sau reviewer CHƯA CHỐT, `.bangiao/danh-gia.md` mục 5.1-5.7)

> Phạm vi: reviewer (skill `ddc-tower:code-review`) đối chiếu Task 1-4 thấy code đúng kế hoạch, test có giá trị thật, bảo mật vòng 4 ĐẠT, nhưng CHƯA CHỐT vì hồ sơ bàn giao cho Task 5-8 (`ke-hoach.md`) còn thiếu G3-G7/R6/R7 phần 3 và còn vài chỗ mâu thuẫn với code hiện tại - dễ làm người làm Task 5 ở phiên sau bỏ sót. Vòng này CHỈ sửa tài liệu/JSDoc/comment theo đúng danh sách 5.1-5.7 của `danh-gia.md`, không đổi chữ ký hay logic nghiệp vụ nào của Task 1-4.

**`.bangiao/ke-hoach.md` (5.1-5.6):**
- Task 5 Interfaces: thêm hợp đồng đầy đủ cho `reserveThrottle`/`releaseThrottle` bản Prisma (transaction + `pg_advisory_xact_lock` + đếm/ghi qua `tx`, `releaseThrottle` dùng `deleteMany({ where: { id } })` không dùng `delete`); bước 5.5 thêm mô tả test DB THẬT (30 lời gọi song song, 2 dòng trùng `createdAt`, `consumeResetToken`/`resetFailedLogin` khi tài khoản đã đổi trạng thái, `registerFailedLogin` song song) - phần này CHƯA chạy được (chưa tới Task 5), chỉ là kế hoạch cho người làm sau (5.1).
- Thêm `ThrottleKind` mới `'google_denied'` + hằng `GOOGLE_DENIED_LIMIT`/`GOOGLE_DENIED_WINDOW_MS` (đề xuất, xem lý do chọn số bên dưới) vào K5, Files Task 5, và bước 6.3 (`reserveThrottle('google_denied', ...)` trước `logActivity`, hết chỗ vẫn từ chối nhưng không ghi log) (5.2).
- Bước 6.2 (`authorize`) và Task 7 (`requestPasswordResetAction`/`submitPasswordResetAction`) thêm yêu cầu bọc lỗi hạ tầng thành phản hồi chung, `console.error` chỉ `e.name` không `e.message`, kèm mô tả test tương ứng; Files Task 5 thêm `src/server/password-reset.ts` (R6, đổi dòng ghi lỗi hàng đợi nền từ `e.message` sang `e.name`) (5.3).
- Khối Interfaces `types.ts` lỗi thời trong Task 4 (ghi `resetFailedLogin: Promise<void>`, thiếu `reserveThrottle`/`releaseThrottle`) thay bằng 1 đoạn trỏ thẳng tới `src/server/repo/types.ts` làm nguồn sự thật duy nhất - tránh lệch lần nữa vì qua 3 vòng bảo mật chữ ký đã đổi nhiều lần (5.4).
- Sửa 4 chỗ chữ cũ mâu thuẫn: nhãn K13 ghi "(ĐÃ THAY bởi L2)"; bước 4.2 viết lại theo hành vi `TRUSTED_PROXY_HOPS` hiện tại; bước 6.10 đổi kiểm `activity_log.ip` sang "khác `'unknown'`" + thêm kiểm `GET /api/health` -> `clientIpResolved: true`; bước 8.4 đổi danh sách giới hạn đã biết thành (K6, K12, G1, khoá chung `'unknown'` của R4, L1 phương án b) (5.6).

**Ngưỡng `GOOGLE_DENIED_LIMIT`/`GOOGLE_DENIED_WINDOW_MS` (5.2, đề xuất - chủ dự án có thể đổi):** chọn `GOOGLE_DENIED_LIMIT = 5`, `GOOGLE_DENIED_WINDOW_MS = 24 * 3_600_000` (bằng `UNKNOWN_EMAIL_WINDOW_MS`). Lý do: mục đích của `'google_denied'` chỉ là chặn `activity_log` bị spam bởi các lần Google từ chối lặp lại của CÙNG 1 email (R7 phần 3), không phải khoá đăng nhập - Google không đi qua form mật khẩu nên không dùng `LOGIN_LOCK_THRESHOLD`/`IP_FAIL_LIMIT`; tái dùng đúng ngưỡng/cửa sổ đã có của `login_fail_unknown_email` (cùng mục đích "hạn chế ghi log theo email", đã qua nhiều vòng bảo mật duyệt) an toàn hơn bịa 1 cặp số mới không có cơ sở đối chứng.

**`src/server/repo/types.ts` (5.5, chỉ JSDoc, không đổi chữ ký):**
- `registerFailedLogin`: ghi rõ phải nguyên tử (`increment` + khoá bằng điều kiện `lockedAt IS NULL` tại thời điểm ghi), `justLocked` chỉ đúng ở 1 lời gọi dù chạy song song, các lời gọi khác (kể cả sau khi đã khoá) vẫn tăng bộ đếm nhưng `justLocked: false`.
- `reserveThrottle`: thêm câu "cửa sổ đếm là `createdAt >= sinceIso`, TÍNH CẢ BIÊN".
- `pruneAuthData`: thêm JSDoc (trước đây không có) - xoá throttle và token có `createdAt < beforeIso`, token bị xoá theo tuổi bất kể đã dùng hay chưa.
- Thêm 1 đoạn JSDoc chung ngay trên `AuthStore`: mọi `email` truyền vào đã được BÊN GỌI chuẩn hoá (`normalizeEmail()`/`trim().toLowerCase()`) trước, implementation không tự chuẩn hoá lại.
- Chuyển khối JSDoc R1 (mô tả `login_fail_unknown_email` dùng chung cho email lạ và tài khoản chỉ Google) từ vị trí lơ lửng giữa `ThrottleKind` và `AuthAccountState` lên đúng phía trên `export type ThrottleKind`.

**`src/lib/auth.ts` (5.2, chỉ comment):** sửa đoạn "R7 (chưa làm, để Task 5)" - bỏ gợi ý dùng chung `reserveThrottle('login_fail_unknown_email', ...)`, thay bằng đúng kế hoạch mới: Task 5 thêm `ThrottleKind` riêng `'google_denied'`, Task 6 bước 6.3 gọi `reserveThrottle('google_denied', ...)` trước khi ghi log.

**`.bangiao/thay-doi.md` (5.7):**
- Thêm ghi chú "đã thay ở vòng sửa bảo mật 1-2" vào 2 dòng mô tả hành vi gốc của `client-ip.ts` (Task 4) và `login-guard.ts` (Task 4) đã bị L1/L2/L7/R1/R3 thay đổi sau đó, để người đọc không hiểu nhầm đó là hành vi hiện tại.
- Thêm ghi chú "đã thay bởi N2" vào 2 chỗ ở mục R2 (vòng 2) mô tả chữ ký `reserveThrottle`/`releaseThrottle` kiểu cũ (`kind/key/nowIso`, chưa có `id`) và cách cài bằng `INSERT ... SELECT ... RETURNING` đơn thuần - N2 (vòng 3) đã đổi sang chữ ký trả/nhận `id` và bắt buộc `pg_advisory_xact_lock`.
- Mục N2: sửa câu "đã ghi rõ hợp đồng bắt buộc... cho C làm sau" thành "cho tài khoản A làm ở Task 5 sau khi C nhả khoá schema" (Task 5 do chính tài khoản A này làm tiếp, không phải C làm hộ - C chỉ đang giữ khoá `schema.prisma`).
- Thêm mục "Vòng sửa bảo mật 4" (phía trên): security-reviewer ĐẠT (`ece9028`), quyết định L1 = phương án (b), test L2 chốt hành vi (`c1a6c48`), cổng kiểm 218/2434.
- Thêm mục này (vòng sửa hồ sơ bàn giao) mô tả chính vòng sửa đang làm.

**Không đổi logic/chữ ký, chỉ 2 chỗ dọn code KHÔNG đổi hành vi (được reviewer cho phép ở mục 4 "Gọn code"):**
- `src/server/login-guard.ts`: bỏ cờ `ipSlotReleased` và closure `releaseIpSlot` (dòng cũ 70-75) - `store.releaseThrottle(ipReserved)` chỉ được gọi đúng 1 lần duy nhất trong toàn hàm (nhánh mật khẩu đúng), nên cờ chống gọi trùng là thừa; thay lời gọi `releaseIpSlot()` bằng thẳng `store.releaseThrottle(ipReserved)`, sửa lại 1 câu comment nhắc tên hàm cũ theo tên gọi mới. Hành vi không đổi, `login-guard.test.ts` vẫn xanh.

### Cổng kiểm cuối vòng sửa hồ sơ bàn giao

- `npx tsc --noEmit`: sạch.
- `npm test`: **218 file / 2434 test xanh** (không đổi so với mốc trước vòng này - vòng này chỉ sửa tài liệu/JSDoc/comment + 1 chỗ dọn code không đổi hành vi, không thêm/bớt test nào).

### File nóng đụng tới trong vòng sửa hồ sơ bàn giao

- Không đụng file nóng nào (`prisma-repo.ts`, `actions.ts`, `vi.json`, `en.json`, `queries.ts`, `project-queries.ts`, `schema.prisma`, `prisma/migrations/`, `globals.css`).

### Chỗ Reviewer nên soi lại

- Đối chiếu từng mục 5.1-5.7 của `danh-gia.md` với các đoạn sửa liệt kê ở trên (đường dẫn/dòng đã ghi trong báo cáo bàn giao gửi kèm) - vòng này không tự thêm việc ngoài danh sách reviewer đã liệt kê.
- Ngưỡng `GOOGLE_DENIED_LIMIT`/`GOOGLE_DENIED_WINDOW_MS` là ĐỀ XUẤT của phiên làm việc này (không phải quyết định chủ dự án), đánh dấu rõ trong `ke-hoach.md` mục K5 - cần chủ dự án duyệt hoặc đổi trước khi cài ở Task 5.
- 2 chỗ dọn code (`ipSlotReleased`) không nằm trong danh sách 5.1-5.7 nhưng nằm trong mục 4 "Gọn code (không chặn)" của `danh-gia.md` - nếu Reviewer muốn giữ nguyên bản cũ (không dọn) thì đây là chỗ duy nhất ngoài phạm vi tài liệu thuần tuý, dễ hoàn tác.
