# P5-B mục 6-7: thay đổi của coder

Nhánh `feature/p5-b-bao-mat-qa`, 8 commit từ `33aab3c` đến `11caa2d`, chưa push.
Q1 = (c): mặc định 100 người dùng ảo, 5 phút, trang p95 <= 3 giây, p99 <= 5 giây, xuất Excel p95 <= 8 giây, lỗi < 1%.
Q2 = (a): `X-Frame-Options: DENY`.

## Kiểm tra giới hạn đăng nhập (đọc `src/server/login-guard.ts`)

100 lượt đăng nhập tuần tự, mỗi người một lần, KHÔNG cần chia phiên và không cần thêm tài khoản.
Giới hạn theo tài khoản (`reserveAccountGuess`) chỉ từ chối khi 5 lượt đang chạy CHỒNG nhau, đăng nhập tuần tự thì luôn có 1 lượt.
Giới hạn theo IP (`reserveThrottle`, 20 lần trong 15 phút) chỉ tính lần SAI, lần đúng được hoàn lại (`releaseThrottle`), và mỗi người dùng ảo còn có XFF riêng.
Phiên sống 8 giờ nên đủ cho lượt 5 phút.
Kết luận: một tài khoản admin cũng chạy được 100 người dùng ảo, nhưng nên dùng file 3 tài khoản admin, bod, viewer để phủ đủ vai (`creds[i % n]`).
Đã ghi vào `docs/load-test.md` mục 4.

## File đã đổi

| File | Lý do |
|---|---|
| `src/lib/load-stats.ts` + test | percentile nearest-rank, tóm tắt, `evaluateCriteria`; `DEFAULT_LOAD_CRITERIA` = 3000/5000/8000/1% (Q1 = c) |
| `src/lib/load-test.ts` + test | tham số CLI (mặc định `vus` 100), PRNG, chọn kịch bản, XFF theo người dùng ảo, phân loại phản hồi, đọc tài khoản, chặn file mật khẩu trong repo |
| `src/lib/perf-http.ts` + test | cookie jar tách từ `measure-pages.ts` |
| `scripts/perf/http-session.ts` | `login()` dùng chung |
| `scripts/perf/measure-pages.ts` | dùng bản dùng chung, hành vi giữ nguyên |
| `scripts/perf/load-test.ts`, `package.json` (`perf:load`) | script chạy tải, đăng nhập tuần tự, không thử lại, Ctrl+C in kết quả rồi exit 1 |
| `docs/load-test.md` | kế hoạch load test, mục 9 để tester điền |
| `src/lib/security-headers.ts` + test | nonce, CSP Report-Only, 6 header |
| `src/lib/csp-report.ts` + test, `app/api/csp-report/route.ts`, `src/server/csp-report-route.test.ts` | endpoint nhận báo cáo, giới hạn tần suất, trần 16 KB, chỉ `console.warn` |
| `src/server/api-routes-guard.test.ts` | đăng ký route mới kiểu `public-report` |
| `middleware.ts` | tách luật cũ thành `route()`, `middleware` bọc ngoài gắn header lên MỌI response |
| `app/[locale]/layout.tsx` | `nonce` cho script chọn giao diện (đọc `headers()`) |
| `src/server/middleware-csp.test.ts` | test middleware, dùng mock next-intl mô phỏng rewrite |
| `e2e/26-header-bao-mat.spec.ts`, `e2e/27-csp-vi-pham.spec.ts` | e2e header và thu vi phạm CSP |
| `docs/csp-header-bao-mat.md`, `docs/qa-gate-truoc-go-live.md` | tài liệu Task 8 |

## Kết quả kiểm

- `npm test`: 2811 xanh, 15 skip (245 file xanh, 1 skip).
- `npx tsc --noEmit`: sạch với mã nguồn; chỉ còn lỗi cũ trong `.next/types/app/api/photo-upload` và `photos` (file build cũ, không phải do phase này).
- e2e 26 + 27 trên dev 3001: 16 + 13 xanh; e2e 27 đo 0 vi phạm CSP trên dev (có `'unsafe-eval'`), chưa đo trên `next start`.
- `npm run test:e2e` toàn bộ: 119 xanh, 2 đỏ ở `10-ten-app` (en, chữ sidebar xuống 2 dòng). Nguyên nhân: dev server tôi tự bật với font mock nên font khác. Chạy lại spec 10 bằng server của Playwright: 11 xanh. Không liên quan CSP.
- Kiểm tay bằng curl trên dev: `/vi/login` có đủ 6 header, 16 thẻ script mang `nonce` khớp header. `/api/csp-report` POST 204, GET 405. Chưa mở Chrome thật để soi console hydration (e2e 27 chạy Chromium thật không báo lỗi, nhưng tester nên soi tay).
- Chạy khói `perf:load` đầy đủ CHƯA làm được: DB `_b` chưa có dự án `PERF-` (0 dòng) và không có `next start`. Đã kiểm các nhánh dừng: cờ sai, thiếu env, thiếu dự án PERF đều thoát đúng với câu rõ ràng. Không bịa số đo.
- Không có dấu gạch dài trong file đã tạo hay sửa.

## Chỗ tester nên soi kỹ

1. Chạy load test thật SAU khi có nonce, trên `next start -p 3001` với `perf:seed`, tham số mặc định (100 người dùng ảo). `perf:seed` phải chạy trước vì e2e global setup chạy `prisma db seed` (có thể xoá dữ liệu `PERF-`).
2. `middleware-csp.test.ts` dùng MOCK next-intl (next-intl thật không nạp được trong Vitest, lỗi `default is not a function`). Việc Next thật đọc nonce từ header request được kiểm bằng e2e 26 (HTML chứa `nonce` khớp header).
3. `e2e/27`: trang quên mật khẩu chỉ kiểm tiêu đề (không có SMTP thì không có form). Nút Google chỉ bấm khi `.env` có `GOOGLE_CLIENT_ID`; `.env` của B đang để trống nên bước đó bị bỏ qua (ghi annotation `bo-qua`).
4. Chạy e2e 27 trên `next start` (không có `'unsafe-eval'`) rồi chép danh sách vào `docs/csp-header-bao-mat.md` mục 8.
5. Middleware: mọi nhánh (redirect, 500, intl, public) đều có 6 header. Ba test middleware cũ vẫn xanh không sửa.
6. `X-Powered-By`, HSTS, nosniff cho `/api` và `_next` chưa đặt ở Next (để proxy của C, ghi ở `docs/csp-header-bao-mat.md`).
7. Sau load test kiểm không tài khoản nào bị khoá (`lockedAt` rỗng, `failedLoginCount` 0).
8. Việc chạy `npm run test:e2e` đã chạy `prisma db seed` trên DB `ddc_control_tower_b`, đây là hành vi sẵn có của global setup.

## Commit

- `33aab3c` thống kê load test
- `8262db0` tham số, kịch bản, cookie jar, login dùng chung
- `5153248` script load test + docs/load-test.md
- `216aaea` thư viện header bảo mật và CSP
- `c591341` endpoint `/api/csp-report`
- `b475d7a` middleware + layout
- `a273995` e2e 26, 27
- `11caa2d` docs CSP và qa-gate

## Debugger vòng 1

Skill dùng: `systematic-debugging`, `investigate-first`. Bằng chứng lấy từ mã, `node_modules`, đo trên trình duyệt thật (Playwright) và `next start` cổng 3001 (DB `ddc_control_tower_b`).

### Phát hiện gốc quan trọng: `node_modules` của B lỗi thời so với lockfile

`package.json` và `package-lock.json` (đã có từ commit `c539542` trên main) khai báo next 15.5.26, react 19.3.0, next-intl 4.14.7, recharts 2.15.4, next-auth 4.24.15, kèm `sharp` 0.35.4 (optional dependency của next 15).
Nhưng `node_modules` của B còn ở next 14.2.35, react 18.3.1, next-intl 3.26.3, recharts 2.12.7, next-auth 4.24.7 và KHÔNG có `sharp`.
Nghĩa là toàn bộ vòng test trước (build, e2e, load test) chạy trên bộ thư viện cũ, không phải bộ thật của nhánh.
Đã sửa môi trường bằng `npm ci` trong thư mục B (đồng bộ đúng lockfile, KHÔNG thêm hay đổi dependency, `package.json` và lockfile không đổi) rồi `npx prisma generate`.
Hệ quả cần tester nhớ: mọi số đo trước đó (đặc biệt độ trễ E-3) phải đo lại trên bản build mới.
Máy nào cũng cần `npm ci` sau khi merge main có nâng bậc thư viện.

### E-1. Kịch bản load test (mã phase này)

Root cause: `DEFAULT_SCENARIOS` gán sai vai và sai URL.
- `/vi/projects` không phải trang, chỉ `redirect` 307 sang dự án đầu tiên (`app/[locale]/(app)/projects/page.tsx`).
- `/vi/alerts`, `/vi/report` gọi `requireUser(locale, ['admin', 'bod'])` nên viewer bị chuyển 307 (không phải do `DENIED` trong `middleware.ts`, luật nằm ở trang).
- Viewer chỉ thấy dự án được phân quyền nên dự án PERF trả 404.
Sửa: bỏ `projects_list`, `project_detail` (đổi trọng số 30 thành 45), `alerts`, `report` chỉ gán `admin, bod` (hằng `OPS`); viewer còn `overview_month`, `overview_all`, `api_health`. Tổng trọng số vẫn 100.
`classifyResponse` GIỮ NGHIÊM (3xx hay khác 200 vẫn là lỗi), không nới.
File: `src/lib/load-test.ts`, `src/lib/load-test.test.ts` (kiểm đúng danh sách kịch bản từng vai), `docs/load-test.md` mục 3 và ghi chú ở mục 9.3 (số đo cũ dùng bộ kịch bản cũ, phải đo lại).
Kết quả: `e2e/28` xanh.

### E-2. `/_next/image?w=48` treo

Điều tra: chỉ w=48 (Accept webp hoặc avif) treo, các w khác 200; `sharp` gọi trực tiếp resize logo ra w=48 chỉ mất 3 ms nên không phải lỗi ảnh hay sharp. Log báo thiếu `sharp` vì `node_modules` lỗi thời (xem trên), không phải thiếu dependency trong repo.
Sau `npm ci` (có sharp) và build lại vẫn treo lần đầu, vì thư mục `.next/cache/images` còn bản cache do next 14 ghi. Xoá `.next/cache/images` (chỉ là cache build) và khởi động lại thì w=48 trả 200 trong 0,38 giây rồi 11 ms, `e2e/29` 4/4 xanh, và `e2e/27` chạy 36 giây thay vì 2,5 phút (không còn `khong-idle`).
Kết luận có mức tin cậy vừa: nguyên nhân là môi trường (bộ next 14 không sharp dùng squoosh, cộng cache ảnh định dạng cũ), không phải mã ứng dụng; nhánh không đổi gì ở đường ảnh so với main (`git diff main` chỉ có layout nonce, route csp-report, package.json script). Chưa tái hiện được cơ chế treo chính xác của bản cũ vì đã nâng bậc.
Không thêm dependency: `sharp` đã nằm sẵn trong lockfile (optional của next 15), không cần đề xuất cài. Docker standalone sau này dùng `npm ci` từ lockfile nên có sharp. Khuyến nghị cho P6: `npm ci` (không dùng `npm install`) trong image, và không mang `.next/cache` cũ vào image.
Không dùng `unoptimized`.

### E-4. spec `10-ten-app` bản en đỏ 2 ca

Kết luận: do font giả, không sửa app. Bằng chứng: font stack của app là `-apple-system, ..., Inter, "Inter Fallback", system-ui, ...`; mock trỏ `Inter` tới URL không tồn tại nên trình duyệt dùng "Inter Fallback" (Arial co giãn). Đo cùng chuỗi "MANAGEMENT REPORTS" 12px, weight 650: Inter Fallback 156,0 px, Inter thật (file woff2 Latin của Inter lấy từ gói prisma trên máy, nạp vào trang) 145,4 px, chỗ chứa 150 px. Font thật vừa một dòng, font giả tràn nên xuống 2 dòng. Ghi chú: chỉ có bản Inter 400 và 600 nên weight 650 là ngoại suy, biên khá hẹp (khoảng 4,6 px), nên chỉ tin hoàn toàn khi chạy được với Google Font thật. Sau khi đổi sang next 15 vẫn đỏ đúng 2 ca này, các spec còn lại xanh.

### Test chập chờn `login-guard.test.ts` (ca N4)

Root cause: bcrypt thật (cost 10) chạy khoảng 25 lần trong N4, khi cả bộ chạy song song CPU bị chia nên vượt trần 5 giây mặc định. Sửa: `vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })` ở đầu file, không đổi hành vi sản phẩm.

### Sửa phụ do nâng đúng bộ thư viện

`src/server/csp-report-route.test.ts`: bỏ dòng `// @ts-expect-error` cho `duplex: 'half'`, vì kiểu của next 15 và Node 20 đã có `duplex` nên `tsc` báo "Unused @ts-expect-error" (chỉ lộ ra sau `npm ci`).

### E-3

Không sửa. Ghi nhận: số đo cũ chạy trên next 14 và react 18, không đại diện. Chưa tách được chi phí nonce. Cần đo lại sau bản build mới.

### Kết quả kiểm sau sửa

- `npx tsc --noEmit`: sạch.
- `npm test`: 246 file xanh (1 skip), 2815 test xanh, 15 skip.
- `npm run build` (font mock) xong, `next start -p 3001`: `e2e` đầy đủ 133 xanh, 2 đỏ (spec 10 en, do font giả, xem E-4). `e2e/26`, `27`, `28`, `29` xanh.

## Sửa theo danh-gia vòng 1

Commit `006c549` (chưa push). Kiểm: `npx tsc --noEmit` sạch; `npm test` 246 file xanh (1 skip), 2818 test xanh; build production với font mock, `next start -p 3001`, `e2e/26` và `e2e/27` 26/26 xanh, đã tắt server.

| Mục | File | Test |
|---|---|---|
| 1 (M1) đổi thứ tự: trần toàn hệ thống trước, khoá theo IP sau | `app/api/csp-report/route.ts` | `src/server/csp-report-route.test.ts` ca M1: chạm trần rồi 1000 IP giả đều 429, không sinh khoá `csp-report:<ip>` mới |
| 2 (L1) `h.delete('content-security-policy')` trong `withCspRequestHeaders` | `src/lib/security-headers.ts` | `security-headers.test.ts`, `middleware-csp.test.ts` ca 7 gửi thêm header `evil` |
| 3 (L2a) `stripControl` lọc C1, U+2028/2029, bidi (viết bằng mã escape) | `src/lib/csp-report.ts` | `csp-report.test.ts` ca U+2028, U+0085, U+202E |
| 4 (L2b) hằng `CSP_REPORT_GLOBAL_PER_MIN = 60` | `src/lib/csp-report.ts`, route | ca "gioi han toan cuc" và ca M1 dùng hằng |
| 5 (QG-10) ghi rõ giới hạn của kiểm tra trên máy dev | `docs/qa-gate-truoc-go-live.md` | không |
| 6 tách mỗi câu một dòng | `docs/load-test.md`, `docs/csp-header-bao-mat.md` | không |
| 7 (L4) 6 ý bàn giao proxy, thêm vào QG-18 | `docs/csp-header-bao-mat.md` mục 4, qa-gate | không |
| 8 (L3) `--xff=per-vu` chỉ có tác dụng khi không có proxy | `docs/load-test.md` mục 4 | không |
| 9 làm nóng có `AbortSignal.timeout`, bọc try/catch, in timeout/network | `scripts/perf/load-test.ts` | không (script chạy thật) |
| 10 (I1) `realpathSync` cho file và gốc repo, gốc lấy từ `__dirname` | `src/lib/load-test.ts`, `scripts/perf/load-test.ts` | `load-test.test.ts` ca junction/symlink trỏ vào repo |
| Nhật ký qa-gate: lượt load test vòng 2 (30 ĐẠT, 50 và 100 KHÔNG ĐẠT) | `docs/qa-gate-truoc-go-live.md` | không |

Tester nên soi: (a) mục 10 ca test symlink tự bỏ qua nếu máy không cho tạo junction; test "repoRoot là thư mục con" theo danh-gia không viết được vì logic đúng là file ngoài thư mục con thì hợp lệ, nên phần đó được bảo đảm bằng việc script lấy gốc từ `__dirname` thay `process.cwd()`; (b) global 60/phút dùng chung một bộ đếm trong file test route, tổng request các ca trước còn dưới 60; (c) mục 9 chưa chạy lại load test thật.
