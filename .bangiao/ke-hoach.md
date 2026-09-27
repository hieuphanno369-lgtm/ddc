# P3E - Đăng nhập an toàn + gọn app: kế hoạch triển khai

> Dành cho coder: làm lần lượt từng Task, mỗi Task 1 commit, bước dùng checkbox `- [ ]`.
> Chỉ đọc file này. Mọi tên hàm, kiểu, key i18n cần dùng đều có ở đây.

**Mục tiêu:** Bật đăng nhập Google theo danh sách admin, quên mật khẩu qua email, khoá sau 5 lần sai, bỏ tự lấy tỷ giá VCB, bỏ ảnh hiện trường.

**Kiến trúc:** Logic đăng nhập tách khỏi `src/lib/auth.ts` sang các module server thuần có tiêm phụ thuộc (`AuthStore`), test bằng kho bộ nhớ, chạy thật bằng kho Prisma.
Mọi trạng thái bảo mật (bộ đếm sai, khoá, giới hạn theo IP/email, token đặt lại) lưu DB.
Thay đổi schema gom vào đúng 1 Task (Task 5) vì `schema.prisma` đang do tài khoản C giữ.

**Công nghệ:** Next 15.5.26 app router, React 19, next-auth 4.24.15 (JWT), Prisma 6, PostgreSQL localhost:5433, next-intl 4, zod 4, bcryptjs, nodemailer (qua `src/server/notify/email.ts`), Vitest 2, Playwright.

**Nguồn yêu cầu:** `D:\_project\DDC_dieu-phoi\lenh-cho-A-2026-09-27.md` dòng 12-40 và 83-129 (PHẦN 3b, D1-D5).

---

## CÂU HỎI CÒN BỎ NGỎ

**ĐÃ QUYẾT (chủ dự án, 2026-09-27), coder làm theo, không còn bước nào bị chặn vì câu hỏi:**
- Q1 = (a) giữ phiên đang mở, chỉ chặn đăng nhập mới.
- Q2 = (b) đặt lại qua email + admin đặt mật khẩu tạm thì đăng xuất mọi phiên cũ; tự đổi trong Cài đặt thì không.
- Q3 = (a) bỏ hẳn `ALLOWED_EMAIL_DOMAINS`.
- Q4 = (a) giữ như hiện nay, trang quản trị chỉ thêm email + vai trò + quyền xem tiền.
- Q5 = (a) tài khoản bị tắt: "Ngưng sử dụng"; khoá do sai mật khẩu: "Bị khoá (sai mật khẩu)".
- Q6 = (a) kênh email đầu tiên có đủ cấu hình SMTP, kể cả khi đang tắt gửi cảnh báo.
- Q7 = dùng nguyên văn chữ đề xuất (VI và EN).
- L7 (bảo mật, lượt rà trước Task 1-4) = tài khoản chỉ Google không tăng bộ đếm sai, không bị khoá vì sai ở form mật khẩu.
- L2 (bảo mật) = thay K13: IP lấy theo `TRUSTED_PROXY_HOPS` (mặc định 1) tính từ phải của `X-Forwarded-For`, không có IP thì gom khoá `unknown`; dùng chung cho `activity.ts`, `export`, `health`. Chi tiết `.bangiao/bao-mat.md`.

Coder KHÔNG tự chọn các câu dưới đây; bước nào bị chặn thì bỏ qua, làm phần còn lại, ghi vào `thay-doi.md` là đang chờ.

**Q1 - Phiên đang mở khi tài khoản bị khoá do sai 5 lần (chặn Task 6 bước 6.4).**
Ví dụ: chị A đang làm việc, ai đó đoán sai mật khẩu của chị A 5 lần.
- (a) Giữ phiên đang mở của chị A, chỉ chặn đăng nhập mới. **Đề xuất**: người đoán sai là kẻ khác, cắt phiên của người thật không thêm an toàn mà làm gián đoạn công việc.
- (b) Cắt luôn mọi phiên của tài khoản đó trong vòng 5 phút.

**Q2 - Đổi mật khẩu kiểu nào thì đăng xuất mọi phiên cũ (chặn Task 7 bước 7.3 phần "admin đặt mật khẩu", "tự đổi").**
Yêu cầu gốc chỉ nói "đặt lại qua email".
- (a) Chỉ khi đặt lại qua email.
- (b) Đặt lại qua email + admin đặt mật khẩu tạm (nút "Reset mật khẩu" và "Mở khoá + đặt mật khẩu tạm"). **Đề xuất**: admin đặt lại thường là do lộ hoặc quên mật khẩu, nên đá phiên cũ.
- (c) Thêm cả khi người dùng tự đổi mật khẩu trong menu Cài đặt (chính phiên đang dùng cũng bị đăng xuất trong 5 phút, phải đăng nhập lại).

**Q3 - Biến `ALLOWED_EMAIL_DOMAINS` (chặn Task 3 bước 3.6).**
Gmail cá nhân phải vào được, nên biến này không được chặn đăng nhập nữa.
- (a) Bỏ hẳn biến: nguồn quyền duy nhất là danh sách tài khoản admin thêm. **Đề xuất**: ít cấu hình, không còn 2 nơi quyết định ai được vào.
- (b) Giữ biến, chỉ dùng để hiện cảnh báo cho admin khi thêm email ngoài domain công ty, không chặn.

**Q4 - "Dự án phụ trách" trong trang quản trị tài khoản (chặn Task 3 bước 3.7 nếu chọn b/c).**
Hiện gán người phụ trách (PIC/Backup) làm ở trang Hồ sơ dự án.
- (a) Giữ như hiện nay, trang quản trị chỉ thêm email + vai trò + quyền xem tiền. **Đề xuất**: đúng "dùng lại màn hình có sẵn", không thêm màn hình.
- (b) Thêm cột chỉ xem "Dự án phụ trách" vào bảng tài khoản.
- (c) Cho gán dự án ngay trong trang quản trị.

**Q5 - Chữ trạng thái tài khoản (chặn Task 6 bước 6.6 phần nhãn).**
Hiện tài khoản bị admin tắt (`isActive=false`) hiện chữ "Đã khóa", trùng với khoá mới do sai mật khẩu.
- (a) Đổi chữ tài khoản bị tắt thành "Ngưng sử dụng", khoá do sai mật khẩu hiện "Bị khoá (sai mật khẩu)". **Đề xuất**: 2 trạng thái khác nhau, cách mở khác nhau, nên tên phải khác.
- (b) Giữ "Đã khóa" cho tài khoản bị tắt, khoá mới gọi "Tạm khoá đăng nhập".

**Q6 - Email quên mật khẩu gửi qua kênh email nào (chặn Task 7 bước 7.2 dòng chọn kênh).**
Cấu hình SMTP hiện nằm trong kênh thông báo email (trang quản trị, mục Thông báo), có công tắc bật/tắt gửi cảnh báo.
- (a) Kênh email đầu tiên có đủ cấu hình SMTP, kể cả khi kênh đang tắt gửi cảnh báo. **Đề xuất**: tắt cảnh báo không nên làm hỏng quên mật khẩu.
- (b) Chỉ kênh email đang bật.

**Q7 - Chữ hướng dẫn ở mục Tỷ giá (chặn Task 1 bước 1.5 dòng `fxRates.hint`).**
Chữ cũ nói "Tự lấy tỷ giá Vietcombank mỗi tháng", không còn đúng.
- Đề xuất VI: "Nhập tay tỷ giá mua chuyển khoản Vietcombank cho từng tháng."
- Đề xuất EN: "Enter the Vietcombank transfer buying rate manually for each month."
- Chủ dự án duyệt nguyên văn hoặc đưa chữ khác.

---

## Quyết định kỹ thuật (planner tự chọn, có lý do)

- **K1 - Kho trạng thái tiêm được (`AuthStore`)**: logic khoá/giới hạn/token viết 1 lần, test bằng kho bộ nhớ, chạy thật bằng Prisma; tránh sửa file nóng `prisma-repo.ts` cho phần mới.
- **K2 - Token đặt lại**: 32 byte `crypto.randomBytes`, mã `base64url` (43 ký tự); DB chỉ lưu SHA-256 hex; token đủ entropy nên không cần bcrypt.
- **K3 - Xin link mới thì xoá mọi token cũ của email đó** (trong 1 transaction với lệnh tạo token mới).
- **K4 - Dùng token nguyên tử**: `updateMany where tokenHash, usedAt null, expiresAt > now` rồi đổi mật khẩu trong cùng `$transaction`; 2 request đồng thời chỉ 1 cái thắng.
- **K5 - Ngưỡng giới hạn** (hằng số trong `src/lib/login-policy.ts`): khoá tài khoản ở lần sai liên tiếp thứ 5; IP bị chặn khi có 20 lần đăng nhập sai trong 15 phút (chặn 15 phút trượt); xin link đặt lại tối đa 3 lần/giờ/email và 10 lần/giờ/IP.
- **K6 - Không lộ email tồn tại ở màn đăng nhập**: email không có tài khoản vẫn chạy 1 lần bcrypt giả (cân thời gian) và vẫn bị đếm; sai 5 lần trong 24 giờ cũng hiện thông báo "đã bị khoá" như tài khoản thật.
  Giới hạn đã biết: với email không tồn tại, "khoá" tự hết sau 24 giờ; ghi vào `thay-doi.md`.
- **K7 - Tài khoản chỉ Google, tài khoản bị tắt nhập mật khẩu**: trả "sai email hoặc mật khẩu" và vẫn tăng bộ đếm, để không lộ tài khoản nào là chỉ Google.
- **K8 - Thông báo quên mật khẩu luôn giống nhau** kể cả khi bị giới hạn; email gửi nền (xếp hàng, không `await`) để thời gian phản hồi không phụ thuộc email có tồn tại.
- **K9 - Tài khoản bị tắt (`isActive=false`) xin link**: không gửi (giống tài khoản chỉ Google), vì có mật khẩu mới cũng không đăng nhập được.
- **K10 - Đặt lại thành công**: tài khoản chưa khoá thì bộ đếm sai về 0; đang khoá thì giữ nguyên khoá và bộ đếm (đúng yêu cầu "không mở khoá").
- **K11 - Link trong email dựng từ `NEXTAUTH_URL`**, không bao giờ từ header `Host` (chống giả host); thiếu `NEXTAUTH_URL` coi như chưa cấu hình gửi email.
- **K12 - Vô hiệu phiên cũ**: cột `passwordChangedAt`; JWT giữ `pwdAt` (ms) lúc đăng nhập; callback `jwt` so ở nhịp kiểm lại có sẵn `ACCESS_RECHECK_INTERVAL_MS` (5 phút, cơ chế T-5 đã được duyệt); trễ tối đa 5 phút, ghi vào `thay-doi.md`.
- **K13 - IP khách**: `clientIpFrom(headers)` lấy phần tử đầu `x-forwarded-for`, rồi `x-real-ip`, cắt 64 ký tự (cùng quy ước `src/lib/activity.ts`); không lấy được IP thì bỏ qua giới hạn IP (không gộp mọi người vào 1 khoá chung).
  Reverse proxy lúc deploy phải GHI ĐÈ `X-Forwarded-For` bằng IP thật: ghi vào `thay-doi.md` mục "Việc cho tài liệu deploy (C, T17)".
- **K14 - Đóng L-11**: `resolveAccess` bỏ fallback `ROLE_SEED`/`viewer`; không có tài khoản hoặc DB lỗi thì trả `null` và phiên bị vô hiệu (fail-closed); quyền dựng thẳng từ 1 lần đọc tài khoản.
- **K15 - Google chỉ vào khi `profile.email_verified === true`**, email Google (chữ thường) có trong `user_roles`, `isActive`, chưa khoá. Tên hiển thị lấy từ tài khoản DB nếu khác rỗng.
- **K16 - Đăng nhập Google không đụng bộ đếm sai** (không tăng, không về 0).
- **K17 - Quên/đặt lại mật khẩu dùng server action** (file mới, có sẵn chặn khác origin của Next), không thêm `route.ts` nên sổ `api-routes-guard.test.ts` chỉ bớt 2 route ảnh.
- **K18 - Không lộ bcrypt hash xuống trình duyệt**: trang quản trị truyền `AdminUserRow` (không có `passwordHash`, có `hasPassword`) cho `UserEditor` (hiện đang truyền cả hash).
- **K19 - Dọn dữ liệu cũ**: job `alerts_daily` gọi thêm `pruneAuthData` xoá `auth_throttle` và token đặt lại cũ hơn 24 giờ.
- **K20 - Email gửi bằng `sendEmail` có sẵn** (người nhận nằm ở BCC, `To` là địa chỉ gửi); không sửa `email.ts`.

---

## Luật chung (mọi Task đều phải theo)

- Không sửa `prisma/schema.prisma`, `prisma/migrations/` trước Task 5 (C đang giữ khoá, nhánh P7-C2).
- Trước khi sửa file nóng: đọc mục "Đang giữ" trong `D:\_project\DDC_dieu-phoi\phien-B.md` và `phien-C.md`; bên kia giữ thì dừng Task đó, làm Task khác; mình giữ thì ghi vào `phien-A.md`, nhả sau commit.
- `app/[locale]/(app)/admin/page.tsx` KHÔNG phải file nóng nhưng `phien-C.md` đang ghi C giữ: chỉ sửa khi C đã nhả; chưa nhả thì dừng Task đó.
- Không sửa `PROGRESS.md`, `.serena/`, file của B/C, `CHANGELOG.md`, lockfile, migration đã chạy, `docs/DATA_WAREHOUSE_README.md` (sinh bởi `npm run docs:erd`).
- Key i18n mới đặt trong nhóm riêng `authSecurity` (thêm cuối file, cả `vi.json` và `en.json` cùng thứ tự).
  Ngoại lệ bắt buộc: nhãn nhật ký hoạt động phải nằm trong nhóm `activity` vì `ActivityViewer.tsx` đọc `t(\`activity.${action}\`)`; thêm vào CUỐI nhóm `activity`.
- Giữ key `activity.add_photo`, `activity.delete_photo` (nhật ký cũ trong 14 ngày còn các action này, xoá key thì trang /admin lỗi).
- Gọi `logActivity(bien, 'ten_action', ...)` với tham số đầu là TÊN BIẾN (không viết object literal), đặt trong `src/server/`, để `src/i18n/messages.test.ts` quét được action.
- Không log token, link đặt lại, mật khẩu, hash ra console hay `activity_log`.
- Comment trong code theo kiểu file đang sửa; không dùng dấu gạch dài.
- Cổng kiểm cuối mỗi Task (PowerShell, tại `D:\_project\DDC_Control_Tower`):
  - `npx tsc --noEmit`
  - `npm test`
  - `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES='D:\_project\DDC_dieu-phoi\tools\font-mock.js'; npm run build` (chỉ kiểm compile)
  - Task có e2e: `$env:NODE_EXTRA_CA_CERTS='D:\_project\DDC_dieu-phoi\tools\win-root-ca.pem'; npm run test:e2e:a -- <file spec>` (cổng 3010 phải trống, DB tạm `ddc_control_tower_e2e_a`).
- Commit message tiếng Việt không dấu, mẫu `feat(p3e): ...`, giữ dòng `Co-Authored-By`.

## Quy ước copy theo

| Việc | Copy từ file |
|---|---|
| Server action admin, trả `{ ok, error }` | `src/server/actions-master.ts`, `src/server/action-guards.ts` (`requireRoleUser`) |
| Repo tách file theo tính năng (prisma + mock) | `src/server/repo/prisma-repo-notify.ts`, `src/server/repo/mock-repo-notify.ts` |
| Test prisma repo bằng mock `@/server/db` | `src/server/repo/prisma-repo-notify.test.ts` |
| Test callback next-auth | `src/lib/auth-access-recheck.test.ts`, `src/lib/auth-session.test.ts` |
| Test action với session giả + mock repo | `src/server/actions.test.ts` (dòng 13-34) |
| Hàng đợi gửi nền không throw | `src/server/notify/dispatch.ts` (`queueAlertNotifications`, `__notifyQueueIdleForTest`) |
| Trang public cạnh trang đăng nhập (khung, class CSS) | `app/[locale]/login/page.tsx`, `src/components/layout/LoginForm.tsx` |
| Modal đặt mật khẩu trong admin | `src/components/admin/UserEditor.tsx` (khối `resetEmail`) |
| Test middleware | `src/server/middleware-auth.test.ts` |
| e2e đăng nhập, helper `vi()` | `e2e/01-login.spec.ts`, `e2e/helpers/i18n.ts`, `e2e/09-chan-chua-dang-nhap.spec.ts` |
| Script tsx chạy trên server | `scripts/check-read-parity.ts` |
| File rollback migration | `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql` |

## Thứ tự và phụ thuộc

| Task | Nội dung | Cần schema? | File nóng phải giữ | Phụ thuộc |
|---|---|---|---|---|
| 1 | D4 tỷ giá chỉ nhập tay | Không | `vi.json`, `en.json` | Q7 (1 dòng chữ); C nhả `admin/page.tsx` |
| 2 | D5 gỡ code ảnh (giữ bảng) | Không | `actions.ts`, `prisma-repo.ts`, `vi.json`, `en.json` | - |
| 3 | D1 Google theo danh sách admin | Không | `actions.ts`, `vi.json`, `en.json` | Q3, Q4 |
| 4 | Hạ tầng D2/D3: chính sách, token, kho bộ nhớ, dịch vụ, mail | Không | không | - |
| 5 | **CHỜ C NHẢ KHOÁ SCHEMA**: toàn bộ schema + migration + rollback + kho Prisma + seed | Có | `schema.prisma`, `prisma/migrations/`, `prisma-repo.ts` | C merge P7-C2 vào `main` |
| 6 | D3 nối vào đăng nhập + trang quản trị + lệnh mở khoá | Sau Task 5 | `vi.json`, `en.json` | Task 4, 5; Q1, Q5; C nhả `admin/page.tsx` |
| 7 | D2 trang quên/đặt lại + vô hiệu phiên | Sau Task 5 | `actions.ts` (chỉ nếu Q2 = b/c), `vi.json`, `en.json` | Task 4, 5, 6; Q2, Q6 |
| 8 | Kiểm tổng + dọn | - | không | Task 1-7 |

---

### Task 1: D4 - Tỷ giá chỉ nhập tay

**Files:**
- Delete: `src/lib/vcb-rates.ts`, `src/lib/vcb-rates.test.ts`, `src/server/fx-rates.ts`, `src/server/fx-rates.test.ts`
- Modify: `src/lib/fx.ts` (chỉ sửa comment dòng 4: "mã cần nhập tay tỷ giá hằng tháng")
- Modify: `src/lib/job-schedule.ts` (xoá `RATES_RETRY_HOURS`, `isRatesDue`, sửa comment đầu file), `src/lib/job-schedule.test.ts` (xoá test của 2 thứ đó)
- Modify: `src/server/jobs.ts`, `src/server/jobs.test.ts`
- Modify: `src/server/repo/types.ts:489` thành `export type JobName = 'alerts_daily';` (giữ `FxSource = 'vcb' | 'manual'` vì DB còn dòng cũ nguồn VCB)
- Modify: `app/api/cron/[job]/route.ts`, `src/server/cron-route.test.ts`
- Modify: `src/server/actions-master.ts` (xoá `fetchRatesNowAction`, import `runJob`), `src/server/actions-master.test.ts`
- Modify: `src/components/admin/ExchangeRateEditor.tsx` (xoá nút "Lấy ngay", `fetchMsg`, prop `lastRun`, dòng "Lần lấy gần nhất"; giữ badge nguồn)
- Modify: `app/[locale]/(app)/admin/page.tsx:107` (xoá prop `lastRun`)
- Modify: `src/lib/schema-meta/docs.ts` (mô tả cột `job_run.jobName` chỉ còn `alerts_daily`)
- Modify: `src/i18n/messages/vi.json`, `en.json` (nhóm `fxRates`)
- Modify: `.env.example` (xoá 3 dòng 33-35 về `VCB_RATE_URL`)

**Interfaces:**
- Produces: `runJob(name: JobName, trigger: JobTrigger, by?: string): Promise<{ status: 'ok' | 'error'; detail: string }>` (bỏ tham số `deps`).
- Giữ nguyên: `missingRateCurrencies`, `findMonthRate`, `toVndBillion`, `saveExchangeRateAction`, `deleteExchangeRateAction`, banner thiếu tỷ giá trong `app/[locale]/(app)/layout.tsx`.

- [ ] 1.1 Viết test đỏ: `cron-route.test.ts` POST `/api/cron/rates_monthly` (đúng secret) trả 404; `jobs.test.ts` `runDueJobs` khi thiếu tỷ giá tháng này KHÔNG tạo `job_run` tên `rates_monthly` và không gọi `fetch` (spy `globalThis.fetch`).
- [ ] 1.2 Chạy `npx vitest run src/server/cron-route.test.ts src/server/jobs.test.ts`, thấy đỏ.
- [ ] 1.3 Sửa `jobs.ts`: `runJob` chỉ còn nhánh alerts (bỏ `if (name === 'rates_monthly')`, bỏ import `refreshMonthRates`, `missingRateCurrencies`, `isRatesDue`, `currentMonth`); `runDueJobs` chỉ đọc `getRecentJobRuns('alerts_daily', 5)`.
  Route cron: `const JOB_NAMES: JobName[] = ['alerts_daily'];`, comment ví dụ chỉ còn lệnh `alerts_daily` (06:00 mỗi ngày).
- [ ] 1.4 Xoá file VCB, `fetchRatesNowAction`, phần giao diện "Lấy ngay"; xoá test tương ứng trong `actions-master.test.ts`, `job-schedule.test.ts`, `jobs.test.ts`.
- [ ] 1.5 i18n `fxRates`: xoá `fetchNow`, `lastRun`, `never`, `status` (cả object), `fetchOk`, `fetchErr` ở cả 2 file; đổi `fxRates.hint` theo Q7 (chưa có trả lời thì để nguyên, ghi chờ).
- [ ] 1.6 Tìm lại: `rates_monthly|VCB_RATE_URL|fetchVcbRates|refreshMonthRates|isRatesDue|fetchRatesNow` trong `src/`, `app/`, `e2e/`, `.env.example` phải không còn (trừ comment `JobRun` trong `schema.prisma`, sửa ở Task 5).
- [ ] 1.7 Cổng kiểm + `npm run test:e2e:a -- e2e/07-admin.spec.ts`.
- [ ] 1.8 Commit `feat(p3e): D4 ty gia chi nhap tay, bo tu lay VCB`.

**Trường hợp biên:** dòng tỷ giá cũ `source='vcb'` vẫn hiện badge "VCB" và sửa tay được; `job_run` cũ tên `rates_monthly` trong DB không làm lỗi trang nào; cron gọi `rates_monthly` nhận 404, không 500.

---

### Task 2: D5 - Gỡ code ảnh hiện trường (chưa xoá bảng)

**Files:**
- Delete: `app/api/photo-upload/route.ts`, `app/api/photos/[...path]/route.ts`, `src/lib/uploads.ts`, `src/lib/uploads.test.ts`, `src/lib/photo-upload.ts`, `src/lib/photo-upload.test.ts`, `src/server/photo-service.ts`, `src/server/photo-upload-route.test.ts`, `src/server/photo-route.test.ts`, `src/server/repo/photo.test.ts`, `src/components/form/PhotoDropzone.tsx`
- Modify: `src/server/actions.ts` (xoá `addPhotoAction`, `deletePhotoAction`, import `deletePhotoFile`, `addPhotoForUser`, `deletePhotoSchema`)
- Modify: `src/server/actions.test.ts` (xoá 2 khối describe ảnh dòng 46-228 và import ảnh; giữ các describe `saveMonthlyData`)
- Modify: `src/server/validation.ts` (xoá `PHOTO_MAX_BYTES`, `photoFileSchema`, `addPhotoSchema`, `deletePhotoSchema`), `src/server/validation.test.ts` (xoá test tương ứng)
- Modify: `src/server/repo/prisma-repo.ts` (xoá `getPhotos`, `getPhotoById`, `addPhoto`, `deletePhoto`, import `ProjectPhoto`)
- Modify: `src/server/repo/mock-repo.ts` (xoá 4 hàm ảnh, dòng lọc `d.photos` trong xoá dự án)
- Modify: `src/server/repo/types.ts` (xoá `interface ProjectPhoto`)
- Modify: `src/data/seed/history.ts` (xoá `buildPhotos`, field `photos` trong `RepoData` và chỗ gán)
- Modify: `prisma/seed.ts` (xoá `createMany` ảnh dòng 171-173; GIỮ `await prisma.projectPhoto.deleteMany();` và `'project_photos'` trong `syncSequences` tới Task 5)
- Modify: `src/components/form/DataEntryForm.tsx` (xoá bước `extras`, prop `photos`, `removePhoto`, import ảnh; `DataEntryStep = 'progress' | 'finance' | 'profile' | 'resources'`)
- Modify: `app/[locale]/(app)/nhap-lieu/page.tsx` (bỏ `repo.getPhotos`, prop `photos`, `'extras'` trong `STEPS`)
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx` (bỏ `repo.getPhotos(id)` trong `Promise.all`, biến `photos`, thẻ Card "Photos" dòng 541-564)
- Modify: `src/server/api-routes-guard.test.ts` (xoá 2 dòng `photo-upload`, `photos/[...path]`)
- Modify: `e2e/09-chan-chua-dang-nhap.spec.ts` (xoá dòng 98-99), `e2e/04-data-entry.spec.ts` (xoá `vi('form.stepExtras')`)
- Modify: `scripts/perf/bench-data.ts:65` (xoá `repo.getPhotos(projectId)`)
- Modify: `vi.json`, `en.json`: xoá `detail.photos`, `form.tabPhotos`, `form.stepExtras`, `form.photoUploadError`, `form.confirmDeletePhoto`, cả object `dataGuard.photo`; GIỮ `activity.add_photo`, `activity.delete_photo`.
- Giữ nguyên: `next.config.mjs` `bodySizeLimit: '11mb'`, `.gitignore` dòng `data/uploads/`, `IconPhoto`.

**Interfaces:** không có hàm mới.

- [ ] 2.1 Kiểm `phien-B.md`/`phien-C.md` không ai giữ `actions.ts`, `prisma-repo.ts`, `vi.json`, `en.json`, `projects/[id]/page.tsx`; ghi giữ vào `phien-A.md`.
- [ ] 2.2 Test đỏ mới `src/server/no-photo-feature.test.ts`: (1) thư mục `app/api/photo-upload`, `app/api/photos` không tồn tại; (2) `src/server/actions.ts` không chứa `addPhotoAction`/`deletePhotoAction`; (3) không file nào trong `src/`, `app/` chứa chuỗi `/api/photos` hoặc `PhotoDropzone` (walk đệ quy, bỏ qua chính file test).
- [ ] 2.3 Gỡ theo danh sách Files; `tsc` chỉ ra chỗ còn sót thì gỡ tiếp (import `IconProject` thừa thì xoá).
- [ ] 2.4 Nếu thư mục `D:\_project\DDC_Control_Tower\data\uploads` tồn tại thì xoá (không nằm trong git).
- [ ] 2.5 Cổng kiểm + `npm run test:e2e:a -- e2e/03-project-detail.spec.ts e2e/04-data-entry.spec.ts e2e/09-chan-chua-dang-nhap.spec.ts`.
- [ ] 2.6 Commit `feat(p3e): D5 go tinh nang anh hien truong (code)`, nhả khoá trong `phien-A.md`.

**Trường hợp biên:** link cũ `?step=extras` rơi về bước mặc định (đã có kiểm `STEPS.includes`); nhật ký cũ có action ảnh vẫn hiển thị; `GET /api/photos/x` giờ trả 404 (không còn route).

---

### Task 3: D1 - Đăng nhập Google theo danh sách admin (phần không cần cột mới)

**Files:**
- Create: `src/server/google-access.ts`, `src/server/google-access.test.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth-finance-access.test.ts`, `src/lib/auth-access-recheck.test.ts` (cập nhật mock, xem 3.3)
- Create: `src/lib/auth-google.test.ts`
- Modify: `src/server/validation.ts` (`createAccountSchema.password`)
- Modify: `src/server/actions.ts` (`createAccountAction`, `changePasswordAction`)
- Modify: `src/components/admin/UserEditor.tsx` (ô mật khẩu không bắt buộc + gợi ý + lỗi trùng)
- Modify: `app/[locale]/login/page.tsx`, `src/components/layout/LoginForm.tsx` (hiện lỗi Google bị từ chối)
- Modify: `vi.json`, `en.json` (thêm nhóm `authSecurity`, xem bảng key cuối file)
- Modify: `.env.example`, `README.md` dòng 47-52, `docs/DEPLOY.md` dòng 45 và 49 (bỏ `ROLE_SEED`; `ALLOWED_EMAIL_DOMAINS` theo Q3)
- Create: `docs/HUONG_DAN_GOOGLE_OAUTH.md`
- Create: `e2e/20-dang-nhap-google.spec.ts`

**Interfaces:**
- Produces (`src/server/google-access.ts`):
```ts
export type GoogleDecision = 'allow' | 'unverified' | 'not_found' | 'inactive' | 'locked';
export interface GoogleProfileLite { email?: string | null; email_verified?: boolean | null }
export interface GoogleAccountLite { isActive: boolean; lockedAt?: string | null }
export function googleAccessDecision(profile: GoogleProfileLite, account: GoogleAccountLite | null): GoogleDecision;
```
- Produces (`src/lib/auth.ts`):
```ts
export type Access = { role: Role; canViewFinance: boolean };
export function accessFromAccount(a: Pick<UserAccount, 'role' | 'canViewFinance'>): Access; // admin, data-entry luôn true
export async function resolveAccess(email: string): Promise<Access | null>; // null = không có tài khoản hoặc lỗi DB
```
- Produces (action): `createAccountAction(email: string, name: string, role: Role, password: string): Promise<{ ok: true } | { ok: false; error: string }>`; `password === ''` nghĩa là tài khoản chỉ Google (`passwordHash: ''`); lỗi trùng email trả `error: 'duplicate'`.

- [ ] 3.1 Test đỏ `google-access.test.ts` (bảng): chưa xác minh email -> `unverified`; email có, tài khoản null -> `not_found`; `isActive=false` -> `inactive`; `lockedAt` có giá trị -> `locked`; đủ điều kiện -> `allow`; email hoa/thường khác nhau vẫn so theo chữ thường (hàm gọi phía ngoài đã lower, test ghi rõ).
- [ ] 3.2 Test đỏ `auth-google.test.ts` (mock `@/server/db` như `auth-access-recheck.test.ts`): `callbacks.signIn({ user, account: { provider: 'google' }, profile })`:
  email trong danh sách + verified -> `true`; email lạ -> `false`; `email_verified: false` -> `false`; tài khoản tắt -> `false`; gmail cá nhân `x@gmail.com` có trong danh sách -> `true` (kể cả khi đặt env `ALLOWED_EMAIL_DOMAINS=daidung.com.vn`, nếu Q3=a thì biến không còn được đọc).
  `callbacks.jwt({ token: {}, user: { email } })` với email không có trong DB -> `token.invalid === true` (không gán `viewer`); đổi vai trò trong DB rồi gọi jwt với token cũ quá 5 phút -> `token.role` mới.
- [ ] 3.3 Sửa `auth.ts`:
  bỏ `roleSeed`/`ROLE_SEED`; `resolveAccess` trả `null` khi không có dòng hoặc DB lỗi (mock mode: không có trong mock repo -> `null`);
  callback `jwt` lúc đăng nhập: đọc tài khoản 1 lần (`findAccount`), `null` hoặc `!isActive` -> `token.invalid = true`, ngược lại gán quyền bằng `accessFromAccount`, `token.name = account.name || token.name`;
  nhánh kiểm lại định kỳ cũng dùng `accessFromAccount(account)` thay cho gọi `resolveAccess` lần 2 (đóng L-11);
  callback `signIn`: `account?.provider === 'google'` thì `googleAccessDecision(profile, await findAccount(email))`, khác `'allow'` trả `false`; provider credentials giữ như cũ (ghi `login`);
  thêm `pages: { signIn: '/login', error: '/login' }`; xoá TODO dòng 131 (Google).
  Test cũ: `auth-finance-access.test.ts` dòng 42-49 đổi kỳ vọng thành `null`; `auth-access-recheck.test.ts` bỏ `stubEnv('ROLE_SEED')`, mock row lúc đăng nhập thêm `isActive: true, email, name, passwordHash, createdAt, lastLoginAt`.
- [ ] 3.4 `createAccountSchema.password`: `z.union([z.literal(''), z.string().min(8)])`; `createAccountAction` hash chỉ khi khác rỗng, bắt lỗi trùng khoá chính (Prisma `P2002`) trả `duplicate`; `changePasswordAction`: tài khoản có `passwordHash === ''` trả `{ ok: false, error: 'current' }` trước khi gọi `verifyPassword` (tránh bcrypt ném lỗi).
  Test trong file mới `src/server/actions-account-google.test.ts` (mẫu `src/server/actions.test.ts` dòng 13-34): tạo không mật khẩu -> `passwordHash ''`; mật khẩu 1-7 ký tự -> lỗi; trùng email -> `duplicate`; viewer gọi -> Forbidden.
- [ ] 3.5 `UserEditor.tsx`: `add()` cho phép `password === ''`; có nhập mà < 8 ký tự thì hiện `t('auth.passwordTooShort')`; dưới ô mật khẩu hiện `hintline` `t('authSecurity.googleOnlyHint')`; action trả `duplicate` thì hiện `sumbar bad` `t('authSecurity.duplicateAccount')`.
  Trang `login/page.tsx` nhận `searchParams: Promise<{ error?: string }>`, truyền `initialError={sp.error === 'AccessDenied' ? 'googleDenied' : null}`; `LoginForm` hiện `sumbar bad` `t('authSecurity.googleDenied')` khi có.
- [ ] 3.6 (Chờ Q3) Q3=a: xoá `allowedDomains`, `isAllowedDomain`, dòng env trong `.env.example`, README, DEPLOY. Q3=b: làm theo phương án b, không chặn đăng nhập.
  `.env.example`: comment Google ghi "Tạo theo docs/HUONG_DAN_GOOGLE_OAUTH.md; để trống thì ẩn nút Google"; xoá dòng `ROLE_SEED` và comment của nó.
- [ ] 3.7 (Chờ Q4) Q4=a: không làm gì thêm. Q4=b/c: dừng, báo điều phối để bổ sung kế hoạch.
- [ ] 3.8 Viết `docs/HUONG_DAN_GOOGLE_OAUTH.md` (tiếng Việt, mỗi câu 1 dòng): tạo project Google Cloud; màn hình đồng ý loại **External**, trạng thái Publish (để gmail ngoài công ty vào được); scope `email`, `profile` (openid mặc định); tạo OAuth Client ID loại Web application; Authorized redirect URIs `https://<domain>/api/auth/callback/google` và `http://localhost:3000/api/auth/callback/google`; điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`; admin thêm email Google ở trang Quản trị trước khi người dùng đăng nhập; tài khoản chỉ Google thì để trống mật khẩu.
- [ ] 3.9 e2e `20-dang-nhap-google.spec.ts`: (1) mở `/login?error=AccessDenied` -> URL cuối là `/vi/login?error=AccessDenied`, thấy `vi('authSecurity.googleDenied')`; (2) admin (storageState `e2e/.auth/admin.json`) thêm tài khoản `e2e-google-<timestamp>@gmail.com` không mật khẩu, thấy dòng mới; đăng xuất context mới, đăng nhập bằng email đó + mật khẩu bất kỳ -> thấy `vi('auth.invalidCredentials')`.
- [ ] 3.10 Cổng kiểm + e2e `01-login`, `07-admin`, `20-dang-nhap-google`.
- [ ] 3.11 Commit `feat(p3e): D1 dang nhap Google theo danh sach admin`.

**Trường hợp biên:** email Google có chữ hoa; Google trả `email_verified` thiếu hoặc `false`; admin xoá tài khoản khi người đó đang đăng nhập (phiên vô hiệu trong 5 phút, đã có); đổi vai trò có hiệu lực trong 5 phút; nút Google ẩn khi thiếu biến env (đã có).

---

### Task 4: Hạ tầng D2/D3 không cần DB mới

**Files:**
- Create: `src/lib/login-policy.ts`
- Create: `src/lib/reset-token.ts`, `src/lib/reset-token.test.ts`
- Create: `src/lib/client-ip.ts`, `src/lib/client-ip.test.ts`
- Modify: `src/server/repo/types.ts` (thêm kiểu ở mục Interfaces)
- Create: `src/server/repo/mock-repo-auth.ts`, `src/server/repo/mock-repo-auth.test.ts`
- Create: `src/server/login-guard.ts`, `src/server/login-guard.test.ts`
- Create: `src/server/password-reset.ts`, `src/server/password-reset.test.ts`
- Modify: `src/server/notify/dispatch.ts` (tách `smtpConfigFromChannel`, `sendToChannel` dùng lại), `src/server/notify/dispatch.test.ts` (test hàm mới)
- Create: `src/server/auth-mail.ts`, `src/server/auth-mail.test.ts`

**Interfaces (Produces, các Task 5-7 dùng đúng tên này):**
```ts
// src/lib/login-policy.ts
export const LOGIN_LOCK_THRESHOLD = 5;
export const IP_FAIL_LIMIT = 20;
export const IP_FAIL_WINDOW_MS = 15 * 60_000;
export const UNKNOWN_EMAIL_WINDOW_MS = 24 * 3_600_000;
export const RESET_EMAIL_LIMIT = 3;
export const RESET_IP_LIMIT = 10;
export const RESET_WINDOW_MS = 3_600_000;
export const RESET_TOKEN_TTL_MS = 30 * 60_000;
export const AUTH_DATA_RETENTION_MS = 24 * 3_600_000;
export const EMAIL_MAX_LENGTH = 254;
export function normalizeEmail(raw: unknown): string | null; // trim + lowercase; rỗng, dài hơn 254, không có đúng 1 '@' -> null

// src/lib/reset-token.ts (dùng node:crypto)
export function generateResetToken(): { token: string; tokenHash: string }; // randomBytes(32).toString('base64url'), sha256 hex
export function hashResetToken(token: string): string;
export function isWellFormedResetToken(token: unknown): token is string; // /^[A-Za-z0-9_-]{43}$/

// src/lib/client-ip.ts
export function clientIpFrom(h: Pick<Headers, 'get'>): string; // '' khi không có

// src/server/repo/types.ts
export type ThrottleKind = 'login_fail_ip' | 'login_fail_unknown_email' | 'reset_req_email' | 'reset_req_ip';
export interface AuthAccountState {
  email: string; name: string; passwordHash: string; role: Role; canViewFinance: boolean;
  isActive: boolean; failedLoginCount: number; lockedAt: string | null; passwordChangedAt: string | null;
}
export interface AuthStore {
  getAccountState(email: string): Promise<AuthAccountState | null>;
  /** +1 bộ đếm sai; đạt threshold và chưa khoá thì khoá; null nếu không có tài khoản. */
  registerFailedLogin(email: string, threshold: number, nowIso: string): Promise<{ count: number; locked: boolean; justLocked: boolean } | null>;
  resetFailedLogin(email: string): Promise<void>;
  /** Xoá khoá + bộ đếm; false nếu không có tài khoản. */
  unlockAccount(email: string): Promise<boolean>;
  /** Đổi mật khẩu; bumpChangedAt = true thì passwordChangedAt = now. */
  setPassword(email: string, passwordHash: string, bumpChangedAt: boolean, nowIso: string): Promise<boolean>;
  recordThrottle(kind: ThrottleKind, key: string, nowIso: string): Promise<void>;
  countThrottle(kind: ThrottleKind, key: string, sinceIso: string): Promise<number>;
  /** Xoá mọi token cũ của email rồi tạo token mới (1 transaction). */
  replaceResetToken(email: string, tokenHash: string, expiresAtIso: string, requestIp: string): Promise<void>;
  /** Token còn dùng được (chưa dùng, chưa hết hạn, tài khoản còn, có mật khẩu, isActive)? */
  peekResetToken(tokenHash: string, nowIso: string): Promise<boolean>;
  /** Nguyên tử: đánh dấu token đã dùng + đặt mật khẩu + passwordChangedAt = now + bộ đếm về 0 nếu chưa khoá + vô hiệu token khác của email. */
  consumeResetToken(tokenHash: string, passwordHash: string, nowIso: string): Promise<{ ok: true; email: string; name: string; locked: boolean } | { ok: false }>;
  pruneAuthData(beforeIso: string): Promise<void>;
}

// src/server/repo/mock-repo-auth.ts
export interface MemoryAccountSource {
  findAccount(email: string): UserAccount | undefined;
  changePassword(email: string, passwordHash: string): void;
}
export function createMemoryAuthStore(source: MemoryAccountSource): AuthStore;

// src/server/login-guard.ts
export type CredentialResult =
  | { ok: true; account: AuthAccountState }
  | { ok: false; reason: 'invalid' | 'locked' | 'ip_limited' };
export async function checkCredentials(
  store: AuthStore,
  input: { email: string; password: string; ip: string },
  now?: Date,
): Promise<CredentialResult>;

// src/server/password-reset.ts
export interface ResetMailer {
  getSmtp(): Promise<SmtpConfig | null>;
  compose(locale: Locale, email: string, link: string): Promise<{ subject: string; text: string }>;
  queue(cfg: SmtpConfig, to: string, subject: string, text: string): void; // không throw, không await
}
export async function requestPasswordReset(
  store: AuthStore, mailer: ResetMailer,
  input: { email: unknown; ip: string; locale: Locale; baseUrl: string | undefined },
  now?: Date,
): Promise<{ status: 'accepted' | 'smtp_missing' }>;
export async function resetPasswordWithToken(
  store: AuthStore,
  input: { token: unknown; newPassword: string },
  now?: Date,
): Promise<{ ok: true; locked: boolean } | { ok: false; error: 'invalid_token' | 'too_short' }>;
export async function isResetTokenUsable(store: AuthStore, token: unknown, now?: Date): Promise<boolean>;

// src/server/notify/dispatch.ts
export function smtpConfigFromChannel(ch: NotifyChannelForSend):
  | { ok: true; cfg: SmtpConfig }
  | { ok: false; error: 'bad_config' | 'secret_key_missing' | 'secret_decrypt_failed' };

// src/server/auth-mail.ts
export async function getAuthSmtpConfig(): Promise<SmtpConfig | null>; // theo Q6, kênh id nhỏ nhất
export function queueAuthEmail(cfg: SmtpConfig, to: string, subject: string, text: string): void;
export function __authMailQueueIdleForTest(): Promise<void>;
export const resetMailer: ResetMailer; // compose dùng getTranslations({ locale, namespace: 'authSecurity' }) key mailSubject, mailBody
```
`Locale` import từ `@/i18n/routing`; `SmtpConfig` từ `@/server/notify/email`.

**Luật `checkCredentials` (đúng thứ tự):**
1. [SỬA ở vòng bảo mật 2, R2+R3 - `.bangiao/bao-mat.md`] `ipKey = ip.trim() || 'unknown'` (không còn IP
   rỗng nào bỏ qua giới hạn); `reserveThrottle('login_fail_ip', ipKey, now, now - IP_FAIL_WINDOW_MS, IP_FAIL_LIMIT)`
   NGUYÊN TỬ (đếm + ghi trong CÙNG 1 lượt, không còn "đếm rồi ghi" tách rời - đóng race TOCTOU khi
   nhiều yêu cầu chạy đồng thời); hết chỗ -> `ip_limited` (không kiểm mật khẩu). Đúng mật khẩu thì
   `releaseThrottle` rút lại chỗ đã đặt (không tính lượt đúng vào giới hạn IP). **Task 5 (Prisma) bắt
   buộc làm `reserveThrottle`/`releaseThrottle` thật NGUYÊN TỬ** (ví dụ 1 câu `INSERT INTO
   auth_throttle ... SELECT ... WHERE (SELECT count(*) ...) < $limit RETURNING 1`, hoặc transaction có
   khoá dòng) - không được cài lại kiểu "đếm 1 câu SELECT rồi ghi 1 câu INSERT riêng" vì mất đúng tính
   nguyên tử đã sửa ở vòng 2, xem JSDoc `AuthStore.reserveThrottle` trong `types.ts`.
2. `account = getAccountState(email)`.
3. `account === null`: gọi `verifyPassword(password, DUMMY_HASH)` (hằng bcrypt cost 10 sinh sẵn 1 lần ở module), `recordThrottle('login_fail_unknown_email', email)`, ghi IP sai (nếu có IP); nếu `countThrottle('login_fail_unknown_email', email, now - UNKNOWN_EMAIL_WINDOW_MS) >= LOGIN_LOCK_THRESHOLD` -> `locked`, ngược lại `invalid`.
4. `account.lockedAt !== null` -> ghi IP sai, trả `locked` (không nói mật khẩu đúng hay sai).
5. Mật khẩu sai hoặc `passwordHash === ''` hoặc `!isActive`: `registerFailedLogin`, ghi IP sai; `justLocked` thì `logActivity(who, 'login_locked', \`${count}\`)` với `who = { name: account.name || email, email }`; `locked` -> `locked`, ngược lại `invalid`.
   `passwordHash === ''` thì vẫn chạy `verifyPassword` với `DUMMY_HASH` (cân thời gian), không gọi với hash rỗng.
6. Đúng: `failedLoginCount > 0` thì `resetFailedLogin`; trả `ok: true`.

**Luật `requestPasswordReset`:**
1. `smtp = await mailer.getSmtp()`; `!smtp || !baseUrl` -> `smtp_missing` (trước mọi xử lý theo email).
2. `email = normalizeEmail(input.email)`; null -> `accepted`.
3. `ip` khác rỗng và `countThrottle('reset_req_ip', ip, now-1h) >= 10`, hoặc `countThrottle('reset_req_email', email, now-1h) >= 3` -> log `rate_limited`, `accepted`; ngược lại `recordThrottle` cả 2 (IP chỉ khi khác rỗng).
4. Tài khoản null -> log `no_account`; `passwordHash === ''` -> log `google_only`; `!isActive` -> log `inactive`; cả 3 trả `accepted`, không tạo token.
5. `generateResetToken()`, `replaceResetToken(email, tokenHash, now + 30 phút, ip)`, link = `${baseUrl.replace(/\/$/, '')}/${locale}/dat-lai-mat-khau?token=${token}`, `compose` rồi `queue`; log `sent` (tài khoản đang khoá vẫn gửi).
Log: `logActivity(who, 'password_reset_request', detail)` với `who = { name: email, email }`, `detail` chỉ là 1 trong `sent|no_account|google_only|inactive|rate_limited`.

**Luật `resetPasswordWithToken`:** token sai định dạng -> `invalid_token`; `newPassword.length < 8` -> `too_short` (kiểm TRƯỚC khi đụng token để không đốt token); `consumeResetToken(hashResetToken(token), hashPassword(newPassword), now)` `ok: false` -> `invalid_token`; ok -> `logActivity(who, 'password_reset_done')`, trả `{ ok: true, locked }`.

- [ ] 4.1 Test đỏ `reset-token.test.ts`: token 43 ký tự base64url; hash 64 ký tự hex; `hashResetToken(token) === tokenHash`; hash khác token; 100 lần sinh không trùng; `isWellFormedResetToken` từ chối `''`, 42/44 ký tự, ký tự `+ / =`, không phải string.
- [ ] 4.2 Test đỏ `client-ip.test.ts`: `'1.2.3.4, 10.0.0.1'` -> `1.2.3.4`; chỉ `x-real-ip` -> giá trị đó; không có -> `''`; chuỗi 200 ký tự -> cắt 64.
- [ ] 4.3 Test đỏ `mock-repo-auth.test.ts` cho từng hàm `AuthStore` (khoá ở đúng lần thứ 5, `justLocked` chỉ 1 lần, `countThrottle` theo cửa sổ, `replaceResetToken` xoá token cũ, `consumeResetToken` lần 2 trả `ok: false`, hết hạn trả `ok: false`, khoá giữ nguyên sau consume, bộ đếm về 0 nếu chưa khoá, `pruneAuthData`).
- [ ] 4.4 Test đỏ `login-guard.test.ts` (mock `@/lib/activity`, kho bộ nhớ, `now` truyền vào):
  4 lần sai -> `invalid`, lần 5 -> `locked`, `logActivity` gọi đúng 1 lần với `'login_locked'`;
  đã khoá + mật khẩu đúng -> `locked`;
  đúng sau 3 lần sai -> `ok` và `failedLoginCount` về 0;
  tạo guard mới trên CÙNG kho (giả lập khởi động lại) -> bộ đếm còn nguyên;
  email lạ: spy `verifyPassword` được gọi; 5 lần -> `locked`; sau 24 giờ + 1ms -> `invalid`;
  tài khoản chỉ Google hoặc `isActive=false` nhập mật khẩu -> `invalid` và bộ đếm tăng;
  20 lần sai từ 1 IP (nhiều email khác nhau) -> lần 21 `ip_limited` kể cả mật khẩu đúng của tài khoản khác; sau 15 phút + 1ms -> kiểm bình thường;
  [SỬA ở vòng bảo mật 2, R3] `ip = ''` gom vào khoá `'unknown'` - VẪN bị giới hạn như 1 IP thật (KHÔNG
  còn "không bao giờ `ip_limited`" như bản đầu, đó chính là lỗ hổng fail-open R3 mô tả trong
  `bao-mat.md`); thêm test R2: `Promise.all` 30 request sai đồng thời từ 1 IP -> số lần gọi bcrypt
  (`verifyPassword`) phải `<= IP_FAIL_LIMIT`.
- [ ] 4.5 Test đỏ `password-reset.test.ts` (mailer giả ghi lại lệnh gửi, mock `@/lib/activity`):
  kết quả trả về của email có tài khoản, email lạ, chỉ Google, bị tắt, bị giới hạn là `toEqual` nhau (`{ status: 'accepted' }`);
  thiếu SMTP hoặc thiếu `baseUrl` -> `smtp_missing` với mọi email và không ghi throttle;
  kho chỉ chứa hash (không phần tử nào trong kho chứa chuỗi token thô, lấy token từ link trong mailer giả);
  `expiresAt` = now + 30 phút đúng từng ms;
  xin 2 lần -> token lần 1 `invalid_token`, token lần 2 dùng được;
  dùng 2 lần -> lần 2 `invalid_token`;
  now + 30 phút + 1ms -> `invalid_token`;
  mật khẩu 7 ký tự -> `too_short` và token vẫn dùng được sau đó;
  tài khoản đang khoá: đặt lại `ok`, `locked: true`, vẫn khoá, bộ đếm giữ nguyên;
  chưa khoá: bộ đếm về 0, `passwordChangedAt` được đặt;
  lần xin thứ 4 trong 1 giờ cùng email -> không gửi; lần thứ 11 cùng IP -> không gửi; email lạ cũng bị đếm;
  link bắt đầu bằng `baseUrl` truyền vào, có `/vi/dat-lai-mat-khau?token=`;
  không lời gọi `logActivity` nào có tham số chứa token.
- [ ] 4.6 Test đỏ `dispatch.test.ts` cho `smtpConfigFromChannel` (thiếu host/from -> `bad_config`; secret lỗi -> mã tương ứng; đủ -> cfg đúng port mặc định 587, `secure` mặc định false); test cũ của `sendToChannel` phải còn xanh.
  `auth-mail.test.ts`: `getAuthSmtpConfig` chọn kênh email id nhỏ nhất có cấu hình hợp lệ (mock `@/server/repo`), không có -> `null`; `queueAuthEmail` khi `sendEmail` ném hoặc trả lỗi thì không throw, `console.error` không chứa địa chỉ nhận hay nội dung.
  Chỗ phụ thuộc Q6 (`onlyEnabled`) viết theo đề xuất (a) sau khi có trả lời; chưa có thì để test đó `it.todo` và ghi chờ.
- [ ] 4.7 Cài đặt tối thiểu cho xanh; `npm test`, `npx tsc --noEmit`, build.
- [ ] 4.8 Commit `feat(p3e): ha tang khoa dang nhap va dat lai mat khau (chua noi vao auth)`.

---

### Task 5: CHỜ C NHẢ KHOÁ SCHEMA - schema, migration, rollback, kho Prisma, seed

**Điều kiện bắt đầu:** `phien-C.md` ghi P7-C2 đã merge `main` và đã nhả `prisma/schema.prisma` + `prisma/migrations/`.
Trước khi sửa: `git merge main`, `npx prisma migrate deploy` (DB `ddc_control_tower`), `npm test` xanh; ghi "Đang giữ: schema.prisma, prisma/migrations/, prisma-repo.ts" vào `phien-A.md`.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_p3e_dang_nhap_bo_anh/migration.sql` (timestamp lớn hơn mọi migration trên `main` lúc đó)
- Create: `prisma/rollback/<cùng tên>.down.sql`
- Create: `src/server/repo/prisma-repo-auth.ts`, `src/server/repo/prisma-repo-auth.test.ts`
- Create: `src/server/auth-store.ts`
- Modify: `src/server/repo/types.ts` (`UserAccount` thêm `lockedAt: string | null`; thêm `AdminUserRow`)
- Modify: `src/server/repo/prisma-repo.ts` (`getUserRoles`, `findAccount` map `lockedAt`)
- Modify: `src/server/repo/mock-repo.ts`, `src/data/seed/history.ts` (`lockedAt: null` cho tài khoản mẫu)
- Modify: `prisma/seed.ts` (xoá `projectPhoto.deleteMany`, `'project_photos'` trong `syncSequences`; thêm `await prisma.authThrottle.deleteMany(); await prisma.passwordResetToken.deleteMany();` TRƯỚC `userRole.deleteMany`; thêm `'password_reset_token'`, `'auth_throttle'` vào `syncSequences`; câu log cuối không đổi)
- Modify: `prisma/rls.sql` (xoá dòng `project_photos`, thêm 2 dòng `enable row level security` cho `password_reset_token`, `auth_throttle` cùng kiểu dòng 36)
- Modify: `src/lib/schema-meta/docs.ts` (xoá `project_photos` ở 2 chỗ dòng 215, 608; thêm mô tả + vị trí ERD cho 2 bảng mới theo mẫu các entry có sẵn; mô tả 3 cột mới của `user_roles`)
- Modify: `src/server/jobs.ts` (nhánh alerts gọi `await getAuthStore().pruneAuthData(new Date(Date.now() - AUTH_DATA_RETENTION_MS).toISOString())` bọc try/catch không làm hỏng job), `src/server/jobs.test.ts`
- Chạy: `npm run docs:erd` (sinh lại `docs/DATA_WAREHOUSE_README.md`, không sửa tay)

**Schema (thêm vào `schema.prisma`):**
```prisma
model UserRole {
  // ... giữ nguyên các cột cũ
  failedLoginCount  Int       @default(0)
  lockedAt          DateTime?
  passwordChangedAt DateTime?
  resetTokens       PasswordResetToken[]
}

/** P3E: token đặt lại mật khẩu - chỉ lưu SHA-256, hết hạn 30 phút, dùng 1 lần. */
model PasswordResetToken {
  id        Int       @id @default(autoincrement())
  email     String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  requestIp String    @default("")
  user      UserRole  @relation(fields: [email], references: [email], onDelete: Cascade)

  @@index([email])
  @@map("password_reset_token")
}

/** P3E: nhật ký đếm lần thử (đăng nhập sai theo IP, xin link theo email/IP) - dọn sau 24 giờ. */
model AuthThrottle {
  id        Int      @id @default(autoincrement())
  kind      String   // ThrottleKind trong src/server/repo/types.ts
  key       String
  createdAt DateTime @default(now())

  @@index([kind, key, createdAt])
  @@index([createdAt])
  @@map("auth_throttle")
}
```
Xoá `model ProjectPhoto` và field quan hệ `photos ProjectPhoto[]` trong `model Project`.
Sửa comment `JobRun.jobName` thành `// 'alerts_daily'` và comment đầu model bỏ chữ "tỷ giá".

**Interfaces:**
- Produces: `export const prismaAuthStore: AuthStore` (`prisma-repo-auth.ts`); `export function getAuthStore(): AuthStore` (`auth-store.ts`: có `DATABASE_URL` -> `prismaAuthStore`, không có -> 1 thể hiện `createMemoryAuthStore` dựng trên `repo` của `mock-repo`, giữ trong `globalThis`).
- Produces: `export type AdminUserRow = Omit<UserAccount, 'passwordHash'> & { hasPassword: boolean };`
- `prismaAuthStore.getAccountState` PHẢI dùng `prisma.userRole.findUnique({ where: { email } })` (test cũ mock đúng hàm này); trường mới thiếu thì coi `failedLoginCount ?? 0`, `lockedAt ?? null`, `passwordChangedAt ?? null`.
- `registerFailedLogin`: `prisma.userRole.update({ data: { failedLoginCount: { increment: 1 } } })` (không có dòng -> bắt `P2025` trả null), rồi nếu `count >= threshold`: `updateMany({ where: { email, lockedAt: null }, data: { lockedAt: now } })`, `justLocked = count === 1`.
- **`resetFailedLogin` (L3, vòng sửa bảo mật 1 - `.bangiao/bao-mat.md`)**: interface đổi từ `Promise<void>` sang `Promise<boolean>` - PHẢI nguyên tử, ví dụ `updateMany({ where: { email, lockedAt: null }, data: { failedLoginCount: 0 } })`, trả `false` khi `count === 0` (đã bị khoá bởi request khác); đọc kỹ JSDoc trong `types.ts`.
- `consumeResetToken`, `replaceResetToken`: dùng `prisma.$transaction(async (tx) => ...)`, luật ở Task 4 mục Interfaces. **L5**: `consumeResetToken` phải kiểm `isActive`/`passwordHash !== ''` NGAY TRONG câu `UPDATE`/điều kiện của transaction (không chỉ tin token còn hạn), giống `peekResetToken`; FK cascade `PasswordResetToken.user` (đã có trong schema dưới) đảm bảo xoá tài khoản thì token cũ mất theo.

- [ ] 5.1 Sửa `schema.prisma` như trên; `npx prisma format`.
- [ ] 5.2 Tạo migration: `npx prisma migrate dev --create-only --name p3e_dang_nhap_bo_anh` trên DB `ddc_control_tower` (DB đã deploy tới mới nhất); đổi tên thư mục theo mẫu timestamp của repo nếu cần; đọc lại SQL: chỉ có ADD COLUMN x3 (có DEFAULT cho `failedLoginCount`), CREATE TABLE x2 + index + FK cascade, DROP TABLE `project_photos`.
  Prisma đòi reset DB thì DỪNG, không reset, báo điều phối.
- [ ] 5.3 Viết rollback theo mẫu file rollback P3C-A (comment không dấu, `BEGIN/COMMIT`): DROP 2 bảng mới, DROP 3 cột, tạo lại `project_photos` đúng DDL gốc (copy khối CREATE TABLE + INDEX + FK của `project_photos` từ migration đã tạo nó, tìm bằng `project_photos` trong `prisma/migrations/`), xoá dòng `_prisma_migrations` của migration này; ghi chú "ảnh cũ không khôi phục được".
- [ ] 5.4 Diễn tập trên DB tạm e2e (KHÔNG trên DB của B/C): đặt `$env:DATABASE_URL` và `$env:DIRECT_URL` trỏ `ddc_control_tower_e2e_a`, chạy `npx prisma migrate deploy`, `npx prisma db execute --file prisma/rollback/<tên>.down.sql --schema prisma/schema.prisma`, rồi `npx prisma migrate deploy` lại; ghi kết quả vào `thay-doi.md`. Sau đó `npx prisma migrate deploy` trên DB `ddc_control_tower`.
- [ ] 5.5 Test đỏ `prisma-repo-auth.test.ts` (mock `@/server/db`, mẫu `prisma-repo-notify.test.ts`): `registerFailedLogin` gọi `update` với `increment: 1`, lần đạt ngưỡng gọi `updateMany` có `lockedAt: null` trong `where`; không có tài khoản trả null; `consumeResetToken` khi `updateMany` token trả `count: 0` thì không gọi update mật khẩu; `replaceResetToken` gọi `deleteMany({ where: { email } })` trước `create`; `peekResetToken` lọc `usedAt: null`, `expiresAt: { gt }`.
- [ ] 5.6 Cài đặt `prisma-repo-auth.ts`, `auth-store.ts`, mapping `lockedAt`, seed, rls, docs, prune; `npx prisma generate`.
- [ ] 5.7 Cổng kiểm + `npm run check:read` + `npm run test:e2e:a` (toàn bộ, xác nhận seed chạy được trên schema mới).
- [ ] 5.8 Commit `feat(p3e): schema dang nhap an toan + xoa bang anh (migration + rollback)`, nhả khoá schema/migrations/prisma-repo.ts trong `phien-A.md`.

**Trường hợp biên:** DB có dòng `user_roles` cũ -> cột mới lấy mặc định (0, null, null); xoá tài khoản -> token của nó tự xoá (cascade); `auth_throttle` không có FK (đếm cả email không tồn tại).

---

### Task 6: D3 - Nối khoá tài khoản vào đăng nhập, trang quản trị, lệnh mở khoá

**Điều kiện:** Task 4, 5 xong; `admin/page.tsx` đã được C nhả.

**Files:**
- Modify: `src/lib/auth.ts` (`authorize`, `signIn` Google, `jwt`)
- Create: `src/lib/auth-authorize.test.ts`
- Modify: `src/components/layout/LoginForm.tsx` (map mã lỗi)
- Create: `src/server/actions-account-lock.ts`, `src/server/actions-account-lock.test.ts`
- Create: `src/lib/admin-user-row.ts`, `src/lib/admin-user-row.test.ts`
- Modify: `app/[locale]/(app)/admin/page.tsx` (truyền `users.map(toAdminUserRow)`)
- Modify: `src/components/admin/UserEditor.tsx`
- Create: `scripts/unlock-account.ts`; Modify: `package.json` (script `"unlock-account": "tsx scripts/unlock-account.ts"`)
- Create: `src/server/unlock-account-cli.ts`, `src/server/unlock-account-cli.test.ts`
- Modify: `vi.json`, `en.json`
- Modify: `e2e/global-setup.ts` (tạo tài khoản e2e riêng)
- Create: `e2e/21-khoa-tai-khoan.spec.ts`

**Interfaces:**
- Consumes: `checkCredentials`, `getAuthStore`, `clientIpFrom`, `normalizeEmail`, `googleAccessDecision`, `AdminUserRow`.
- Produces:
```ts
// src/server/actions-account-lock.ts ('use server')
export async function unlockAccountAction(email: string, tempPassword?: string):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'too_short' | 'Not found' }>;
// src/lib/admin-user-row.ts
export function toAdminUserRow(u: UserAccount): AdminUserRow;
// src/server/unlock-account-cli.ts
export async function unlockAccountCli(store: AuthStore, rawEmail: string, log: (email: string) => Promise<void>):
  Promise<{ code: 0 | 1 | 2; message: string }>; // 0 ok, 1 không có tài khoản, 2 email sai định dạng
```
- Mã lỗi next-auth: `authorize` ném `new Error('locked')` hoặc `new Error('ip_limited')`; `signIn('credentials', { redirect: false })` trả `res.error` đúng chuỗi đó; sai thường trả `null` (next-auth ra `CredentialsSignin`).

- [ ] 6.1 Test đỏ `auth-authorize.test.ts` (mock `next/headers` trả `x-forwarded-for`, mock `@/server/auth-store` trả kho bộ nhớ, mock `@/lib/activity`): gọi `authorize` của CredentialsProvider (lấy từ `authOptions.providers`, gọi `options.authorize`) 5 lần sai -> 4 lần `null`, lần 5 ném `locked`; IP bị giới hạn -> ném `ip_limited`; email > 254 ký tự -> `null`; đúng -> object `{ id, email, name }`.
- [ ] 6.2 Sửa `authorize`: `normalizeEmail`, thiếu mật khẩu -> `null`; `ip = clientIpFrom(await headers())`; `checkCredentials(getAuthStore(), ...)`; `invalid` -> `null`; `locked`/`ip_limited` -> `throw new Error(reason)`; `ok` -> `touchLastLogin`, trả user. Xoá TODO dòng 118 (rate-limit).
- [ ] 6.3 `signIn` Google: truyền `lockedAt` thật từ `getAuthStore().getAccountState(email)` vào `googleAccessDecision`; test thêm vào `auth-google.test.ts`: tài khoản đang khoá -> `false`; Google thành công không đổi `failedLoginCount`.
- [ ] 6.4 (Chờ Q1) Q1=b: nhánh kiểm lại định kỳ của `jwt` coi `lockedAt !== null` là `token.invalid = true`, thêm test. Q1=a: không đổi, thêm test khẳng định phiên đang mở vẫn hợp lệ khi tài khoản bị khoá.
- [ ] 6.5 `LoginForm.tsx`: `res.error === 'locked'` -> `t('authSecurity.locked')`; `'ip_limited'` -> `t('authSecurity.ipLimited')`; còn lại -> `t('auth.invalidCredentials')`.
- [ ] 6.6 Test đỏ `actions-account-lock.test.ts` (mẫu `actions.test.ts` 13-34, mock `@/server/auth-store`): viewer/bod/data-entry -> Forbidden; email sai -> `Invalid input`; không có -> `Not found`; admin mở -> `lockedAt null`, bộ đếm 0, `logActivity` action `account_unlock`; `tempPassword` 1-7 ký tự -> `too_short`, không mở khoá; `tempPassword` hợp lệ -> mở khoá + đặt mật khẩu (`bumpChangedAt` theo Q2: b/c -> true, a -> false).
  Cài đặt: dùng `requireRoleUser(['admin'])`, zod `{ email: z.string().email(), tempPassword: z.string().min(8).optional() }`, `revalidateTag(profileTag)`.
  `toAdminUserRow` bỏ `passwordHash`, `hasPassword = passwordHash !== ''`; test khẳng định object trả về không có khoá `passwordHash`.
- [ ] 6.7 `UserEditor.tsx` nhận `users: AdminUserRow[]`:
  khối trên bảng khi có tài khoản khoá: tiêu đề `t('authSecurity.lockedList', { n })`, mỗi dòng email (`mono`), `formatDateTime(lockedAt)`, nút `t('authSecurity.unlock')`, nút `t('authSecurity.unlockWithTemp')` mở modal (copy khối modal `resetEmail`, có `PasswordInput showStrength` + nhập lại, kiểm 8 ký tự và khớp như `doReset`);
  cột trạng thái: `lockedAt` có giá trị -> `Badge tone="danger"` `t('authSecurity.lockedBadge')` (không bấm được), ngược lại badge `isActive` như cũ; nhãn theo Q5 (Q5=a đổi value của `admin.locked` thành "Ngưng sử dụng"/"Inactive", chưa có trả lời thì giữ);
  cột email thêm `Badge tone="info"` `t('authSecurity.googleOnly')` khi `!hasPassword`.
  Thay `import type { UserAccount }` bằng `AdminUserRow`.
- [ ] 6.8 `unlockAccountCli`: `normalizeEmail` null -> code 2; `store.unlockAccount` false -> code 1; ok -> gọi `log(email)`, code 0; test bằng kho bộ nhớ.
  `scripts/unlock-account.ts`: đọc `process.argv[2]`, dùng `prismaAuthStore`, `log` ghi thẳng `prisma.activityLog.create({ data: { userEmail: email, userName: 'server-cli', action: 'account_unlock_cli', detail: '', ip: '', userAgent: 'cli' } })`, in `message`, `process.exit(code)`, luôn `$disconnect`.
  Chạy thử `npm run unlock-account -- khong-co@x.com` (mong exit 1) trên DB `ddc_control_tower`.
- [ ] 6.9 i18n: thêm các key `authSecurity` của Task 6 và cuối nhóm `activity`: `login_locked`, `account_unlock`, `account_unlock_cli` (xem bảng key). Thêm vào `messages.test.ts` mảng `required` 3 key `activity.account_unlock_cli`, `authSecurity.locked`, `authSecurity.unlock` và thêm `'LoginForm': 'src/components/layout/LoginForm.tsx'`, `'UserEditor': 'src/components/admin/UserEditor.tsx'` vào `CHANGED_SOURCES`.
- [ ] 6.10 `e2e/global-setup.ts`: sau seed, `prisma.userRole.upsert` 2 tài khoản viewer `e2e-khoa@daidung.com.vn` và `e2e-quenmk@daidung.com.vn`, mật khẩu hash bằng `hashPassword` (import `../src/lib/password`) từ hằng `E2E_LOCK_PASSWORD = 'E2e-Khoa-2026!'` đặt trong `e2e/helpers/env.ts` (DB tạm, không phải mật khẩu thật).
  e2e `21-khoa-tai-khoan.spec.ts`: 4 lần sai -> `auth.invalidCredentials`; lần 5 -> `authSecurity.locked`; mật khẩu đúng -> vẫn `authSecurity.locked`; context admin mở `/vi/admin` thấy email trong khối khoá, bấm `authSecurity.unlock`; context mới đăng nhập đúng -> về `/vi/overview`.
  Kiểm thêm (ghi kết quả vào `thay-doi.md`): sau khi chạy spec, `activity_log.ip` của dòng `login` có giá trị hay rỗng (xác minh `x-forwarded-for` có trên dev server; rỗng thì giới hạn IP bị bỏ qua theo K13).
- [ ] 6.11 Cổng kiểm + e2e `01-login`, `07-admin`, `20-dang-nhap-google`, `21-khoa-tai-khoan`.
- [ ] 6.12 Commit `feat(p3e): D3 khoa tai khoan sau 5 lan sai, mo khoa admin + lenh server`.

**Trường hợp biên:** admin cũng bị khoá (không có ngoại lệ vai trò); admin khoá không tự vào được thì dùng lệnh `unlock-account`; 2 request sai đồng thời vẫn khoá đúng 1 lần; `isActive` bật/tắt không đụng khoá; xoá rồi tạo lại tài khoản thì trạng thái khoá mất (dòng mới).

---

### Task 7: D2 - Trang quên mật khẩu, trang đặt lại, vô hiệu phiên cũ

**Điều kiện:** Task 4, 5, 6 xong.

**Files:**
- Create: `app/[locale]/quen-mat-khau/page.tsx`, `app/[locale]/dat-lai-mat-khau/page.tsx`
- Create: `src/components/layout/ForgotPasswordForm.tsx`, `src/components/layout/ResetPasswordForm.tsx`
- Create: `src/server/actions-password-reset.ts`, `src/server/actions-password-reset.test.ts`
- Modify: `src/components/layout/LoginForm.tsx` (link "Quên mật khẩu?")
- Modify: `middleware.ts` (`PUBLIC_PATHS = ['/login', '/quen-mat-khau', '/dat-lai-mat-khau']`), `src/server/middleware-auth.test.ts`
- Modify: `src/lib/auth.ts` (`jwt`: `pwdAt`)
- Modify: `src/lib/auth-access-recheck.test.ts`
- Modify: `src/server/actions.ts` chỉ khi Q2 = b hoặc c (`resetPasswordAction`, `changePasswordAction` gọi `getAuthStore().setPassword(email, hash, true, now)` thay cho `repo.changePassword`)
- Modify: `vi.json`, `en.json`
- Modify: `e2e/09-chan-chua-dang-nhap.spec.ts` (2 trang mới vào được khi chưa đăng nhập)
- Create: `e2e/22-quen-mat-khau.spec.ts`

**Interfaces:**
```ts
// src/server/actions-password-reset.ts ('use server')
export async function requestPasswordResetAction(email: string, locale: string): Promise<{ status: 'accepted' | 'smtp_missing' }>;
export async function submitPasswordResetAction(token: string, newPassword: string, confirm: string):
  Promise<{ ok: true; locked: boolean } | { ok: false; error: 'invalid_token' | 'too_short' | 'mismatch' }>;
```
Không đặt tên `resetPasswordAction` (đã có hàm admin trùng tên trong `actions.ts`).
- `requestPasswordResetAction`: `locale` không thuộc `routing.locales` thì dùng `'vi'`; `ip = clientIpFrom(await headers())`; gọi `requestPasswordReset(getAuthStore(), resetMailer, { email, ip, locale, baseUrl: process.env.NEXTAUTH_URL })`.
- `submitPasswordResetAction`: `newPassword !== confirm` -> `mismatch` (trước mọi thứ); rồi `resetPasswordWithToken`.
- JWT: lúc đăng nhập `token.pwdAt = passwordChangedAt ? Date.parse(passwordChangedAt) : 0`; nhánh kiểm lại: `Date.parse(account.passwordChangedAt ?? '') > (token.pwdAt ?? 0)` -> `token.invalid = true`.
  Bổ sung kiểu `pwdAt?: number` vào khai báo JWT hiện có (`src/types/next-auth.d.ts`, khối `declare module 'next-auth/jwt'`).

- [ ] 7.1 Test đỏ `middleware-auth.test.ts`: chưa đăng nhập mở `/vi/quen-mat-khau`, `/en/dat-lai-mat-khau?token=x` -> không redirect `/login`; `/vi/quen-mat-khau-gia` -> redirect (so khớp đúng đường dẫn, dùng `isPublicPath` có sẵn).
- [ ] 7.2 Test đỏ `actions-password-reset.test.ts` (mock `next/headers`, `@/server/auth-store`, `@/server/auth-mail` trả `resetMailer` giả có `getSmtp` trả cfg giả, `compose` trả chuỗi chứa link, `queue` là spy, `@/lib/activity`): `locale: 'fr'` -> link chứa `/vi/`; `mismatch`; `NEXTAUTH_URL` rỗng -> `smtp_missing`; luồng đủ: xin link -> lấy token từ link trong lời gọi `queue` giả -> `submitPasswordResetAction` ok -> đăng nhập (`checkCredentials`) bằng mật khẩu mới ok, mật khẩu cũ `invalid`.
  Chốt Q6 ở `getAuthSmtpConfig` trong bước này.
- [ ] 7.3 Test đỏ `auth-access-recheck.test.ts`: token `pwdAt` cũ hơn `passwordChangedAt` -> `invalid`; bằng nhau -> hợp lệ; token không có `pwdAt` + `passwordChangedAt null` -> hợp lệ.
  (Chờ Q2 phần b/c) Q2=b: test `resetPasswordAction` (admin) đặt `passwordChangedAt`; Q2=c: thêm `changePasswordAction`.
- [ ] 7.4 Trang `quen-mat-khau/page.tsx` (server, KHÔNG gọi `requireUser`, khung copy `login/page.tsx`): `const smtpReady = Boolean(process.env.NEXTAUTH_URL) && (await getAuthSmtpConfig()) !== null`; chưa sẵn sàng -> hiện `sumbar bad` `t('authSecurity.smtpMissing')` + link về đăng nhập, không hiện form; sẵn sàng -> `ForgotPasswordForm`.
  `ForgotPasswordForm` (client): ô email, nút `t('authSecurity.forgotSubmit')`, sau khi gửi luôn thay form bằng `sumbar good` `t('authSecurity.forgotSent')` (kể cả khi action trả `accepted` cho email lạ); action trả `smtp_missing` -> `sumbar bad` `smtpMissing`; link `t('authSecurity.backToLogin')` về `/login` (dùng `Link` của `@/i18n/navigation`).
- [ ] 7.5 Trang `dat-lai-mat-khau/page.tsx`: `export const metadata = { referrer: 'no-referrer', robots: { index: false } }`; đọc `searchParams.token`; `await isResetTokenUsable(getAuthStore(), token)` false -> `sumbar bad` `t('authSecurity.resetInvalid')` + link sang `/quen-mat-khau`; true -> `ResetPasswordForm token={token}` (KHÔNG dùng token ở GET).
  `ResetPasswordForm`: 2 ô `PasswordInput` (mới có `showStrength`, nhập lại), nút `t('authSecurity.resetSubmit')`; lỗi `too_short` -> `auth.passwordTooShort`, `mismatch` -> `auth.mismatch`, `invalid_token` -> `authSecurity.resetInvalid`; ok -> `locked` ? `authSecurity.resetDoneLocked` : `authSecurity.resetDone`, kèm link về đăng nhập; token không đưa vào URL khác, không lưu localStorage.
- [ ] 7.6 `LoginForm.tsx`: dưới ô mật khẩu, căn phải, link `t('authSecurity.forgotLink')` tới `/quen-mat-khau` (class `hintline`).
- [ ] 7.7 Xoá TODO dòng 125 trong `auth.ts` (quên mật khẩu). Tìm lại `TODO` trong `src/lib/auth.ts`: không còn TODO về rate-limit, quên mật khẩu, Google.
- [ ] 7.8 i18n: thêm các key `authSecurity` còn lại (forgot*, reset*, smtpMissing, backToLogin, mailSubject, mailBody) và cuối nhóm `activity`: `password_reset_request`, `password_reset_done`. Thêm 2 trang mới + 2 form vào `CHANGED_SOURCES` của `messages.test.ts`.
- [ ] 7.9 e2e:
  `09-chan-chua-dang-nhap.spec.ts`: chưa đăng nhập mở `/vi/quen-mat-khau` và `/vi/dat-lai-mat-khau?token=x` -> ở lại đúng URL (không về `/login`).
  `22-quen-mat-khau.spec.ts` (tài khoản `e2e-quenmk@daidung.com.vn` từ Task 6):
  (1) không có kênh email -> trang quên mật khẩu hiện `authSecurity.smtpMissing`;
  (2) `beforeAll` tạo kênh email `E2E reset smtp` (kind `email`, `smtpHost: 'smtp.invalid'`, `fromAddress: 'noreply@daidung.com.vn'`, bật hay tắt theo Q6) bằng Prisma, `afterAll` xoá; gửi email có tài khoản và email lạ -> cả 2 thấy đúng `authSecurity.forgotSent`;
  (3) spec tự sinh token bằng `generateResetToken()` (import `../src/lib/reset-token`), insert `passwordResetToken` (hash, `expiresAt = now + 30 phút`) bằng Prisma; mở link, đặt `E2e-Moi-2026!` -> `authSecurity.resetDone`; đăng nhập mật khẩu mới -> vào app; mở lại cùng link -> `authSecurity.resetInvalid`;
  (4) token `expiresAt` đã qua -> `authSecurity.resetInvalid`;
  (5) mở link từ login: bấm `authSecurity.forgotLink` -> URL `/vi/quen-mat-khau`.
  Kiểm giao diện 1440px và 390px cho 2 trang mới (chụp màn hình, không vỡ khung, cùng kích thước thẻ với trang đăng nhập).
- [ ] 7.10 Cổng kiểm + e2e `01-login`, `09-chan-chua-dang-nhap`, `21-khoa-tai-khoan`, `22-quen-mat-khau`.
- [ ] 7.11 Commit `feat(p3e): D2 quen mat khau dat lai qua email, vo hieu phien cu`.

**Trường hợp biên:** xin link cho tài khoản đang khoá (gửi, đặt lại xong vẫn khoá, trang báo `resetDoneLocked`); tài khoản chỉ Google hoặc bị tắt (không gửi, cùng thông báo); SMTP lỗi khi gửi (người dùng vẫn thấy cùng thông báo, lỗi chỉ ở console không có địa chỉ); `NOTIFY_SECRET_KEY` mất nên không giải mã được mật khẩu SMTP (coi như chưa cấu hình); token có ký tự lạ hoặc thiếu (trang báo không hợp lệ, không lỗi 500); bấm gửi 2 lần liền (lần 2 làm token lần 1 mất hiệu lực).

---

### Task 8: Kiểm tổng + dọn

- [ ] 8.1 Tìm lại trong `src/`, `app/`, `scripts/`, `e2e/`: `ROLE_SEED`, `isAllowedDomain` (nếu Q3=a), `projectPhoto`, `ProjectPhoto`, `photo-upload`, `/api/photos`, `rates_monthly`, `VCB_RATE_URL`: không còn.
- [ ] 8.2 `src/server/api-routes-guard.test.ts`: danh sách route khớp đúng 6 route còn lại (`auth/[...nextauth]`, `health`, `cron/[job]`, `export`, `report/export`, `templates/daily-resources`).
- [ ] 8.3 `.env.example` cuối cùng: không có `VCB_RATE_URL`, `ROLE_SEED` (và `ALLOWED_EMAIL_DOMAINS` nếu Q3=a); comment `NEXTAUTH_URL` ghi "dùng để dựng link đặt lại mật khẩu, phải là URL thật khi deploy".
- [ ] 8.4 Viết `.bangiao/thay-doi.md`: danh sách file, kết quả cổng kiểm (dán output), kết quả diễn tập rollback, giới hạn đã biết (K6, K12, K13), câu hỏi còn chờ, mục "Việc cho tài liệu deploy (C, T17)": Google OAuth Client theo `docs/HUONG_DAN_GOOGLE_OAUTH.md`, SMTP bắt buộc, `NEXTAUTH_URL` đúng domain, **reverse proxy BẮT BUỘC tự NỐI THÊM (append, không ghi đè) IP khách vào `X-Forwarded-For` đúng `TRUSTED_PROXY_HOPS` tầng khai trong `.env.example` (R4/R5, `.bangiao/bao-mat.md` vòng 2) - thiếu bước này thì mọi người dùng rơi vào khoá `'unknown'` dùng chung, có thể tự khoá lẫn nhau; kiểm nhanh sau deploy bằng `GET /api/health` -> `clientIpResolved` phải là `true`, `false` thì soi lại cấu hình proxy**, lệnh `npm run unlock-account -- <email>`, cron chỉ `alerts_daily`, không còn thư mục ảnh cần backup.
- [ ] 8.5 Cổng kiểm đầy đủ + `npm run test:e2e:a` toàn bộ (không lọc spec); đỏ thì sửa, chập chờn thì tìm gốc.
- [ ] 8.6 Commit `chore(p3e): kiem tong, cap nhat ho so ban giao`.

---

## Bảng key i18n mới (nhóm `authSecurity`, cả 2 file, thứ tự như dưới)

| Key | vi | en |
|---|---|---|
| `googleDenied` | Tài khoản Google này chưa được quản trị cấp quyền hoặc đang bị khoá. Liên hệ quản trị. | This Google account has not been granted access or is locked. Contact an administrator. |
| `googleOnlyHint` | Để trống nếu người này chỉ đăng nhập bằng Google | Leave blank if this person signs in with Google only |
| `duplicateAccount` | Email này đã có tài khoản | An account with this email already exists |
| `googleOnly` | Chỉ Google | Google only |
| `locked` | Tài khoản đã bị khoá do nhập sai mật khẩu nhiều lần. Liên hệ quản trị để mở khoá. | This account is locked after too many failed sign-in attempts. Contact an administrator to unlock it. |
| `ipLimited` | Máy này đã thử đăng nhập sai quá nhiều lần. Thử lại sau 15 phút. | Too many failed sign-in attempts from this device. Try again in 15 minutes. |
| `lockedList` | Tài khoản đang bị khoá ({n}) | Locked accounts ({n}) |
| `lockedBadge` | Bị khoá (sai mật khẩu) | Locked (failed sign-ins) |
| `unlock` | Mở khoá | Unlock |
| `unlockWithTemp` | Mở khoá + đặt mật khẩu tạm | Unlock + set temporary password |
| `forgotLink` | Quên mật khẩu? | Forgot password? |
| `forgotTitle` | Quên mật khẩu | Forgot password |
| `forgotIntro` | Nhập email đăng nhập, hệ thống sẽ gửi link đặt lại mật khẩu (hiệu lực 30 phút). | Enter your sign-in email and we will send a password reset link (valid for 30 minutes). |
| `forgotSubmit` | Gửi link đặt lại | Send reset link |
| `forgotSent` | Nếu email có trong hệ thống, link đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư, kể cả thư rác. | If the email exists in the system, a reset link has been sent. Check your inbox, including spam. |
| `smtpMissing` | Hệ thống chưa cấu hình gửi email. Liên hệ quản trị để được đặt lại mật khẩu. | Email sending is not configured. Contact an administrator to reset your password. |
| `backToLogin` | Quay lại đăng nhập | Back to sign in |
| `resetTitle` | Đặt lại mật khẩu | Reset password |
| `resetSubmit` | Lưu mật khẩu mới | Save new password |
| `resetDone` | Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới. | Your password has been reset. Sign in with the new password. |
| `resetDoneLocked` | Đã đặt lại mật khẩu, nhưng tài khoản đang bị khoá. Liên hệ quản trị để mở khoá. | Your password has been reset, but the account is locked. Contact an administrator to unlock it. |
| `resetInvalid` | Link đặt lại mật khẩu không hợp lệ, đã dùng hoặc đã hết hạn. Hãy xin link mới. | This reset link is invalid, already used or expired. Please request a new one. |
| `mailSubject` | Đặt lại mật khẩu | Password reset |
| `mailBody` | Có yêu cầu đặt lại mật khẩu cho tài khoản {email}.\n\nMở link sau trong vòng 30 phút để đặt mật khẩu mới (chỉ dùng được 1 lần):\n{link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại không đổi. | A password reset was requested for {email}.\n\nOpen this link within 30 minutes to set a new password (single use):\n{link}\n\nIf you did not request this, ignore this email; your current password stays the same. |

Thêm cuối nhóm `activity`:

| Key | vi | en |
|---|---|---|
| `login_locked` | Khoá tài khoản do sai mật khẩu 5 lần | Account locked after 5 failed sign-ins |
| `account_unlock` | Mở khoá đăng nhập | Unlocked sign-in |
| `account_unlock_cli` | Mở khoá bằng lệnh trên server | Unlocked via server command |
| `password_reset_request` | Xin link đặt lại mật khẩu | Requested password reset link |
| `password_reset_done` | Đặt lại mật khẩu qua email | Reset password via email |

Key Task 3 thêm: `googleDenied`, `googleOnlyHint`, `duplicateAccount`.
Key Task 6 thêm: `googleOnly`, `locked`, `ipLimited`, `lockedList`, `lockedBadge`, `unlock`, `unlockWithTemp` + 3 key `activity` đầu.
Key Task 7 thêm: phần còn lại.

## Yêu cầu bảo mật phải kiểm được (security-reviewer đối chiếu)

| # | Yêu cầu | Kiểm bằng |
|---|---|---|
| S1 | Token 256 bit, DB chỉ có SHA-256 | `reset-token.test.ts`, `password-reset.test.ts` (kho không chứa token thô), đọc schema |
| S2 | Hết hạn 30 phút, dùng 1 lần, xin mới thì cũ mất | `password-reset.test.ts`, `mock-repo-auth.test.ts`, e2e 22 |
| S3 | Không lộ email tồn tại (quên mật khẩu, đăng nhập) | `password-reset.test.ts` (kết quả `toEqual`), `login-guard.test.ts` (email lạ cũng "khoá"), gửi nền K8 |
| S4 | Giới hạn xin link theo email và IP, lưu DB | `password-reset.test.ts`, bảng `auth_throttle` |
| S5 | Khoá sau 5 lần sai liên tiếp, lưu DB, qua khởi động lại | `login-guard.test.ts` (kho dùng lại), `prisma-repo-auth.test.ts`, e2e 21 |
| S6 | Giới hạn đăng nhập sai theo IP, lưu DB | `login-guard.test.ts`, `auth-authorize.test.ts` |
| S7 | Đặt lại mật khẩu không mở khoá | `password-reset.test.ts` |
| S8 | Vô hiệu phiên cũ sau đặt lại (trễ tối đa 5 phút) | `auth-access-recheck.test.ts` |
| S9 | Google chỉ vào khi email đã xác minh, có trong danh sách, đang hoạt động, không khoá; không tự tạo viewer | `google-access.test.ts`, `auth-google.test.ts` |
| S10 | `ALLOWED_EMAIL_DOMAINS` không chặn gmail | `auth-google.test.ts` |
| S11 | Link dựng từ `NEXTAUTH_URL`, không từ `Host` | `password-reset.test.ts`, đọc code |
| S12 | Trang đặt lại không lộ token qua Referer, GET không tiêu token | metadata `referrer`, `isResetTokenUsable` chỉ đọc |
| S13 | Không log token/link/mật khẩu | `password-reset.test.ts`, `auth-mail.test.ts` |
| S14 | Không còn route/action ảnh | `no-photo-feature.test.ts`, `api-routes-guard.test.ts` |
| S15 | Hash mật khẩu không xuống trình duyệt | `admin-user-row.test.ts` |
| S16 | `resolveAccess` fail-closed (L-11) | `auth-finance-access.test.ts`, `auth-google.test.ts` |
