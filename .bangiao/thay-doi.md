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
