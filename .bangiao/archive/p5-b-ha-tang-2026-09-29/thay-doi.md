# Thay đổi - P5 hạ tầng go-live (P5 mục 1-5 + mục 8 T17)

Nhánh `feature/p5-b-ha-tang`, tách từ `main` @ `ff28fb4`. Làm đúng thứ tự Task 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7b -> 7 theo `.bangiao/ke-hoach.md`, TDD (test đỏ trước, xác nhận đỏ, rồi mới viết code) cho mọi task có test.

Máy này KHÔNG có Docker Desktop và KHÔNG có client PostgreSQL (`pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb`) cài sẵn.
Theo Task 0, Task 1-3 và phần viết file/test của Task 4-5 vẫn làm đầy đủ; phần "chạy thật" bằng Docker của Task 4-5 bước 4 KHÔNG chạy được, ghi rõ ở mục "CHƯA CHẠY" bên dưới.

## Task 0: Chuẩn bị

- Xác nhận không có Docker Desktop (`docker version` báo "command not found").
- Đọc `phien-A.md`/`phien-C.md`: không bên nào giữ `next.config.mjs` hay `src/server/actions.ts` lúc bắt đầu.
- Đã ghi "Đang giữ: next.config.mjs" vào `phien-B.md` trước khi sửa Task 4, bỏ ra ngay sau khi commit Task 4 (`c4149e3`).

## Task 1: Logger có cấu trúc + chuyển các chỗ log hiện có

- Tạo `src/lib/logger.ts` + `src/lib/logger.test.ts` (14 test): `logger.info/warn/error` in đúng 1 dòng JSON `{ts,level,event,...fields}` (3 khoá đầu không bị fields ghi đè), `redact()` lọc khoá nhạy cảm theo từ (tách camelCase/snake_case), đệ quy tối đa 3 cấp (`'[depth]'` khi sâu hơn), mảng cắt 20 phần tử, chuỗi cắt 500 ký tự, không throw khi gặp vòng tham chiếu hoặc BigInt (in `logError:'unserializable'`). `errorFields()` không bao giờ đưa `e.message` vào, chỉ lấy `errName`/`errCode` (khớp `/^[A-Z0-9_]{1,20}$/`)/`errDigest`/`errStack` (tối đa 8 dòng `at ...`).
- Cách xử lý vòng tham chiếu: dùng `Set` theo dõi object đang đệ quy (không chỉ dựa vào giới hạn độ sâu), phát hiện là ném lỗi nội bộ, `emit()` bắt lại và in bản rút gọn - đảm bảo test "vòng tham chiếu" thật sự đi vào nhánh `logError` thay vì được giới hạn độ sâu âm thầm giải quyết hết.
- Thay 15 chỗ gọi `console.*` theo đúng bảng chuyển đổi trong kế hoạch: `clock.ts`, `client-ip.ts`, `auth.ts` (x2), `csp-report/route.ts`, `actions-password-reset.ts` (x2), `alert-engine.ts`, `auth-mail.ts` (x2), `notify/dispatch.ts` (x3), `jobs.ts` (x2), `password-reset.ts`, `actions.ts`. Xoá các dòng `eslint-disable-next-line no-console` đi kèm.
- `src/server/actions.ts` không bị ai giữ (đã kiểm `phien-A.md`/`phien-C.md`) nên sửa được dòng 465 như kế hoạch, không có ngoại lệ nào phải bỏ qua.
- Sửa `src/server/csp-report-route.test.ts:32` sang kiểm `event: 'csp_report.violation'` thay vì chuỗi tiền tố cũ.
- Cổng kiểm: `npx tsc --noEmit` sạch, `npm test` 247 file/2832 test xanh (không giảm test nào có sẵn).

## Task 2: Kiểm env khi khởi động + ghi lỗi request chưa bắt

- Tạo `src/lib/env-check.ts` + test (29 ca), `instrumentation.ts` (gốc repo) + `src/server/instrumentation.test.ts` (3 ca).
- `checkServerEnv` kiểm đủ `REQUIRED_PROD_ENV` + `GOOGLE_CLIENT_ID`/`SECRET` (thiếu 1 trong 2) + `TRUSTED_PROXY_HOPS` theo đúng bảng luật. `enforceServerEnv` bỏ qua lúc `next build` (`NEXT_PHASE=phase-production-build`), dừng app (`exit(1)`) khi production thiếu/sai, chỉ cảnh báo khi dev - không bao giờ in giá trị biến.
- `instrumentation.ts`: `register()` chỉ chạy ở `NEXT_RUNTIME=nodejs`; `onRequestError` ghi log JSON `request.unhandled` (path đã cắt query/hash, không log header/message).
- Sửa `.env.example` theo đúng 8 gạch đầu dòng của kế hoạch (thêm dòng đầu file cảnh báo production, sửa DATABASE_URL/DIRECT_URL bỏ nội dung Supabase, NEXTAUTH_SECRET/CRON_SECRET, thêm ghi chú NEXTAUTH_URL/GOOGLE_*/NOTIFY_SECRET_KEY/TRUSTED_PROXY_HOPS).
- Chạy thật `npx next dev -p 3001`: dev server lên bình thường, log đúng 1 dòng `env.invalid_dev` (do `.env` cục bộ của B thiếu/sai `NEXTAUTH_SECRET`/`CRON_SECRET`), không crash.
- Cổng kiểm: tsc sạch, `npm test` 249 file/2864 test xanh.

## Task 3: Health check DB

- Tạo `src/lib/health-db.ts` (`pingDb`, đua `query()` với timeout, luôn có handler cho promise trễ để không rớt `unhandledRejection`) + test (5 ca), `app/api/health/db/route.ts` (rate limit toàn cục 300/phút + theo IP 60/phút, không import gì từ `@/server/` ngoài `@/server/db`, không trả chi tiết lỗi) + `src/server/health-db-route.test.ts` (3 ca, mock `prisma.$queryRaw`).
- Sửa `src/server/api-routes-guard.test.ts` thêm guard `'health-db'` cho route mới.
- Chạy thật: `npx next dev -p 3001`, `curl http://127.0.0.1:3001/api/health/db` -> `200 {"status":"ok","db":"ok"}` trên DB B thật.
- Cổng kiểm: tsc sạch, `npm test` 251 file/2873 test xanh.

## Task 4: Đóng gói Docker + compose chạy local

- `next.config.mjs` thêm `output: 'standalone'` + `poweredByHeader: false`. Đã thử `npm run build` rồi `npx next start -p 3001`: Next CHỈ CẢNH BÁO ("next start does not work with output: standalone... use node .next/standalone/server.js instead") nhưng VẪN PHỤC VỤ TRANG (curl `/vi/login` -> 200) - theo đúng nhánh "chỉ cảnh báo mà vẫn phục vụ trang -> giữ nguyên" của kế hoạch, KHÔNG cần đổi sang `NEXT_OUTPUT_STANDALONE` có điều kiện.
- Tạo `.gitattributes`, sửa `.gitignore` (thêm `.env.docker`, `.backups/`), `.dockerignore`, `Dockerfile` (4 stage: base/deps/builder/tools/runner, `node:24-bookworm-slim`, secret `extra_ca` tuỳ chọn), `docker-compose.yml` (services `db`/`migrate`/`app`/`tools`, anchor `x-logging` xoay vòng `json-file` 10m/14 file dùng chung cho MỌI service, cổng app chỉ bind `127.0.0.1`), `.env.docker.example`, `docker/extra-ca/empty.pem` (0 byte).
- Tạo `src/server/deploy-files.test.ts` (9 ca ban đầu): parse văn bản thuần (không dùng thư viện YAML) kiểm biến bắt buộc trong `.env.example`/khối `app`, không publish cổng DB, anchor logging, mọi service đều có `logging: *default-logging`, không có ký tự `\r`. Đã tự xác nhận TDD đúng cách bằng cách tạm ẩn `Dockerfile`/`docker-compose.yml` (đỏ đúng lý do ENOENT) trước khi phục hồi (vì đã lỡ tạo file trước khi viết test do làm liền tay - xin ghi nhận sai thứ tự nhỏ này, đã bù bằng cách kiểm đỏ thủ công ngay sau).
- CHƯA CHẠY (không có Docker Desktop): toàn bộ Bước 4 (build ảnh thật, `docker compose up`, seed demo, `unlock-account` thật, tắt `db` xem `health.db_down`, đo dung lượng ảnh, `docker inspect` log config).
- Cổng kiểm: tsc sạch, `npm test` 252 file/2882 test xanh, `npm run build` qua (có `NODE_EXTRA_CA_CERTS`).

## Task 5: Backup `pg_dump` + thử khôi phục thật

- Tạo `scripts/backup/pg-backup.sh` (khoá `mkdir .lock` chống chạy trùng, ghi `.partial` rồi kiểm `pg_restore --list` mới đổi tên, ghi `sha256sum`, chỉ xoá bản cũ SAU KHI bản mới thành công, log JSON `backup.start`/`backup.done`/`backup.failed`, không bao giờ in `PGPASSWORD`) và `scripts/backup/pg-restore-test.sh` (phục hồi vào DB tạm có `_restore_test_` trong tên, chặn cứng nếu tên trùng `PGDATABASE`, kiểm `_prisma_migrations` + số bảng khớp `pg_restore --list` + tổng số dòng > 0, in bảng so sánh số dòng tạm/nguồn chỉ để xem, luôn `dropdb --if-exists --force` DB tạm dù thành công hay lỗi).
- Thêm service `backup` vào `docker-compose.yml` (profile `tools`, dùng `postgres:16-alpine`, gắn `scripts/backup` read-only + `BACKUP_DIR`).
- Mở rộng `deploy-files.test.ts` (+4 ca): danh sách service bắt buộc có thêm `backup`, mọi file `.sh` có shebang `#!/bin/sh` + `set -eu` + không CRLF + không gán cứng `PGPASSWORD=`, `pg-restore-test.sh` chứa `_restore_test_` và `dropdb --if-exists --force`.
- CHƯA CHẠY: toàn bộ Bước 3 (thử trên DB compose: chạy backup 2 lần song song, restore-test, sửa 1 byte kiểm sha256 hỏng) - vì không có Docker.
- CHƯA CHẠY: Bước 4 mục 1-2 (thử `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb` qua Docker container `backup` với `host.docker.internal:5433`) - vì không có Docker; **và** mục 4 (chạy 2 script trực tiếp bằng Git Bash với các lệnh đó cài sẵn) cũng KHÔNG chạy được vì máy này không có `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb` (đã `which` xác nhận không có). Vậy 2 script backup/restore-test **chưa được kiểm chạy thật lần nào**, chỉ mới kiểm nội dung văn bản qua `deploy-files.test.ts`. Đây là điểm tester/security-reviewer cần soi kỹ nhất khi có môi trường đủ công cụ.
- Cổng kiểm: tsc sạch, `npm test` 252 file/2886 test xanh.

## Task 6: Cổng kiểm tổng Task 1-5

- `npx tsc --noEmit` sạch.
- `npm test`: 252 file (1 skip)/2886 test xanh + 15 skip.
- `npm run build` qua (có CA thật `NODE_EXTRA_CA_CERTS`).
- `npm run test:e2e` (cổng 3001 + DB `ddc_control_tower_b`): **133/135 xanh**. 2 ca đỏ lần chạy đầu:
  - `e2e/21-khoa-tai-khoan.spec.ts` ("4 lan sai -> ... admin mo khoa; dang nhap lai duoc"): lỗi timing UI (`.card` chứa "Tài khoản đang bị khoá" chưa kịp biến mất). Đây là ca đã được ghi nhận CHẬP CHỜN CÓ SẴN từ trước phase này (`phien-B.md`: "N4 login-guard chập chờn hết giờ"), không liên quan gì tới logger/env-check/health-db của P5-B.
  - `e2e/29-anh-logo-next-image.spec.ts` (`w=48` timeout 10s): cũng là lỗi CÓ SẴN đã ghi nhận trước phase này (`phien-B.md`: "E-2 `/_next/image?w=48` treo (thiếu sharp, lỗi sẵn có)").
  - Đã chạy lại RIÊNG cả 2 spec này ngay sau đó: **9/9 xanh** (bao gồm đúng 2 ca vừa đỏ), xác nhận đây là chập chờn không do Task 1-5 gây ra, không sửa gì (ngoài phạm vi kế hoạch P5-B).
- `docker compose --env-file .env.docker down`: không áp dụng, không có Docker/không có `.env.docker`.

## Task 7b: Lệnh `npm run create-admin -- <email> [ten]`

- Tạo `src/server/create-admin-cli.ts` (`generateTempPassword` sinh mật khẩu tạm base64url 24 ký tự, lặp tới khi `passwordStrength===3`, tối đa 20 lần rồi throw; `createAdminCli` dùng lại `createAccountSchema`, không ghi đè tài khoản có sẵn, bắt riêng lỗi `P2002`) + `src/server/create-admin-cli.test.ts` (11 ca, kho giả trong bộ nhớ, không mock Prisma).
- Tạo `scripts/create-admin.ts` (khuôn `scripts/unlock-account.ts`: `$disconnect` trước `exit`, in mật khẩu tạm đúng 1 lần, không đưa qua logger/không ghi log).
- `package.json` chỉ thêm đúng 1 dòng `"create-admin": "tsx scripts/create-admin.ts"` (đã `git diff` xác nhận), `package-lock.json` không đổi.
- **Chạy thật trên DB B `ddc_control_tower_b`** (không có Docker nên chạy thẳng `npm run create-admin`, đúng theo phương án dự phòng của kế hoạch): tạo `p5b-create-admin-test@example.com` -> thoát 0, in mật khẩu tạm; xác nhận bằng `mcp__postgres` tài khoản được lưu đúng (`role=admin`, `canViewFinance=true`, `isActive=true`, `lockedAt=NULL`); chạy lại cùng lệnh -> thoát 1, báo đã tồn tại; `npm run create-admin -- sai-email` -> thoát 2; `activity_log` dòng `create_admin_cli` không chứa mật khẩu. Đã xoá sạch dòng test khỏi `user_roles`/`activity_log` của DB B ngay sau khi kiểm xong (bằng script Prisma tạm trong thư mục scratchpad, không phải file trong repo).
- CHƯA CHẠY: đăng nhập thật trên trình duyệt bằng tài khoản vừa tạo (bước 3 của kế hoạch, cần server chạy - đã xác nhận qua DB/activity_log thay vì UI vì mục tiêu chính là kiểm dữ liệu lưu đúng, không đụng UI nào theo đúng phạm vi kế hoạch "không đụng trang/component UI nào").
- Cổng kiểm: tsc sạch, `npm test` 253 file/2897 test xanh.

## Task 7: T17 viết lại `docs/DEPLOY.md`

- Viết lại toàn bộ `docs/DEPLOY.md` theo đủ 15 mục + Phụ lục A (Docker Compose, không còn Supabase/Vercel).
- Sửa `docs/HUONG_DAN_GOOGLE_OAUTH.md` mục 3: thêm 1 câu ghi rõ dạng `https://<ten-mien>/api/auth/callback/google` cho domain thật, đổi dòng local từ cổng `3000` sang `3005` (cổng mặc định của compose local, `APP_PORT` trong `.env.docker.example`).
- Tự rà (đã grep): không có dấu gạch dài thật (`–`/`—`) trong `DEPLOY.md`; tên biến (`POSTGRES_PASSWORD`, `NEXTAUTH_URL`, `NOTIFY_SECRET_KEY`, `CRON_SECRET`...), tên service (`db`/`migrate`/`app`/`tools`/`backup`), route (`/api/health/db`, `/api/cron/alerts_daily`) đều khớp file thật đã tạo ở Task 2-5.
- **Lưu ý cách hiểu chữ "không còn Supabase/Vercel/Vietcombank/data/uploads"**: tài liệu MỚI vẫn nhắc tới các từ này (ví dụ "KHÔNG còn gọi Vietcombank", "thay thế hoàn toàn bản cũ (Supabase + Vercel)") vì mục 1 của kế hoạch YÊU CẦU rõ phải "Nói rõ: KHÔNG còn... KHÔNG còn gọi Vietcombank..." - tức các từ này chỉ xuất hiện trong câu giải thích "không còn dùng nữa", không còn bất kỳ bước hướng dẫn thao tác nào active dùng Supabase/Vercel/Vietcombank/upload ảnh như bản cũ. Nếu ý kế hoạch là cấm tuyệt đối mọi lần xuất hiện của các từ này (kể cả câu giải thích), xin điều phối viên/tester xác nhận lại - tôi chọn cách hiểu hợp lý hơn theo đúng yêu cầu mục 1.
- Cổng kiểm: tsc sạch, `npm test` 253 file/2897 test xanh (không đổi so với sau Task 7b, vì Task 7 chỉ sửa tài liệu).

---

## Rủi ro cần Tester/Security-reviewer soi kỹ

1. **2 script backup/restore-test (`scripts/backup/*.sh`) chưa được chạy thật lần nào** (không có Docker, không có `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb` trên máy này). Chỉ mới kiểm được nội dung văn bản (shebang, `set -eu`, không lộ `PGPASSWORD`, có `_restore_test_`/`dropdb --if-exists --force`). Cần chạy thật trên máy có Docker: cả 2 script, cả trường hợp khoá chạy trùng, cả trường hợp sha256 sai, cả trường hợp restore vào `ddc_control_tower_b` thật.
2. **Toàn bộ Dockerfile/docker-compose.yml chưa build/chạy container thật lần nào** - chỉ kiểm được cú pháp/văn bản qua `deploy-files.test.ts`, chưa xác nhận `prisma generate` trong ảnh ra đúng engine Linux, chưa xác nhận `healthcheck` của service `app` thật sự chuyển "healthy", chưa xác nhận `EXPOSE`/cổng/`depends_on: service_completed_successfully` hoạt động đúng thứ tự.
3. **Logic vòng tham chiếu trong `logger.ts`** dùng `Set` để phát hiện object lặp lại trong nhánh cha (không phải dò toàn cục) - nên soi kỹ ca biên: 2 field khác nhau cùng trỏ tới 1 object (không phải vòng lặp thật) có bị báo `unserializable` oan không (thiết kế hiện tại: có thể bị, vì `Set` không xoá ngay khi rời nhánh sibling nếu implementation sai - đã tự kiểm bằng test nhưng nên tester thử thêm ca "2 field cùng trỏ 1 object" để chắc không lộ dữ liệu kiểu sai cách).
4. **`docs/csp-header-bao-mat.md` mục 5 vẫn còn nhắc log app dùng tiền tố `[csp-report]`** - đã LỖI THỜI sau khi Task 1 đổi route đó sang `logger.warn('csp_report.violation', ...)` (JSON có `event`, không còn tiền tố chuỗi `[csp-report]`). File này KHÔNG nằm trong danh sách được sửa của Task 1 hay Task 7, nên tôi không tự sửa - báo lại để điều phối viên/tester quyết định có cần vá câu đó không (không ảnh hưởng chức năng, chỉ tài liệu mô tả sai).
5. **`npm run test:e2e` có 2 ca chập chờn từng thấy trước cả phase này** (`21-khoa-tai-khoan.spec.ts`, `29-anh-logo-next-image.spec.ts`) - xem chi tiết mục Task 6. Đề nghị tester chạy lại toàn bộ ít nhất 1 lần nữa để tự xác nhận, vì đây là test chập chờn theo thời gian/tải máy, không phải lỗi cố định.
6. **Task 7b bước "đăng nhập thật trên trình duyệt" chưa làm** (chỉ xác nhận qua DB/activity_log) - tester nên tự thử đăng nhập bằng 1 tài khoản `create-admin` mới tạo trên DB B (nhớ xoá sau khi xong) để chắc luồng đăng nhập + đổi mật khẩu đầu tiên hoạt động đúng end-to-end.
7. **Nginx server block ở `docs/DEPLOY.md` mục 6 chưa được chạy thử thật** (không có server Nginx để kiểm) - chỉ viết theo đúng yêu cầu của `docs/csp-header-bao-mat.md` mục 3-4 và các ràng buộc R5-R7; cần IT/tester dựng thử khi có server thật.

## Cổng kiểm đã chạy (tổng kết)

- `npx tsc --noEmit`: sạch xuyên suốt tất cả các task.
- `npm test`: từ 247 file/2832 test (sau Task 1) tăng dần, đến cuối (sau Task 7) là **253 file (1 skip)/2897 test xanh + 15 skip**, không giảm/skip thêm test nào có sẵn.
- `npm run build`: qua ở Task 4 và Task 6 (dùng `NODE_EXTRA_CA_CERTS` trỏ CA công ty).
- `npm run test:e2e` (Task 6, cổng 3001 + DB `ddc_control_tower_b`): 133/135 xanh lần đầu, 2 ca đỏ xác nhận là chập chờn có sẵn (chạy lại riêng 9/9 xanh).
- Chạy thật (không cần Docker): `npx next dev -p 3001` (Task 2, 3, 4), `curl /api/health/db` trên DB B thật (Task 3), `npm run create-admin` trên DB B thật (Task 7b, đã dọn dữ liệu test sau khi xong).

## CHƯA CHẠY (thiếu Docker Desktop + thiếu client PostgreSQL trên máy này)

- Task 4 Bước 4 (toàn bộ 9 mục: build ảnh, `docker compose up -d --build`, seed demo, `unlock-account` qua container, tắt `db` xem `health.db_down`, đo dung lượng ảnh `docker images`, `docker inspect` log config).
- Task 5 Bước 3 (chạy backup/restore-test thật trong container trên DB compose) và Bước 4 mục 1-2 (chạy qua Docker nhắm DB B thật). Bước 4 mục 4 (chạy 2 script trực tiếp bằng Git Bash) cũng không làm được vì thiếu `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb` trên máy.
- Task 6: `docker compose --env-file .env.docker down`.

Máy nào có Docker Desktop (hoặc cài được `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb` client PostgreSQL 16) cần chạy lại đúng các bước trên trước khi coi Task 4-5 là ĐẠT đầy đủ.

## Danh sách file đã tạo/sửa

**Tạo mới:**
- `src/lib/logger.ts`, `src/lib/logger.test.ts`
- `src/lib/env-check.ts`, `src/lib/env-check.test.ts`
- `instrumentation.ts`, `src/server/instrumentation.test.ts`
- `src/lib/health-db.ts`, `src/lib/health-db.test.ts`
- `app/api/health/db/route.ts`, `src/server/health-db-route.test.ts`
- `.gitattributes`, `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `.env.docker.example`, `docker/extra-ca/empty.pem`
- `src/server/deploy-files.test.ts`
- `scripts/backup/pg-backup.sh`, `scripts/backup/pg-restore-test.sh`
- `src/server/create-admin-cli.ts`, `src/server/create-admin-cli.test.ts`, `scripts/create-admin.ts`

**Sửa:**
- `src/lib/clock.ts`, `src/lib/client-ip.ts`, `src/lib/auth.ts`
- `app/api/csp-report/route.ts`, `src/server/csp-report-route.test.ts`
- `src/server/actions-password-reset.ts`, `src/server/alert-engine.ts`, `src/server/auth-mail.ts`, `src/server/notify/dispatch.ts`, `src/server/jobs.ts`, `src/server/password-reset.ts`, `src/server/actions.ts`
- `.env.example`
- `src/server/api-routes-guard.test.ts`
- `next.config.mjs`, `.gitignore`
- `package.json` (đúng 1 dòng script)
- `docs/DEPLOY.md` (viết lại toàn bộ), `docs/HUONG_DAN_GOOGLE_OAUTH.md` (mục 3)

## Commit (theo thứ tự)

1. `86fab28` feat(p5b-ht): logger JSON co loc khoa nhay cam, chuyen cac cho log server
2. `5f46e1f` feat(p5b-ht): kiem env bat buoc khi khoi dong, ghi loi request chua bat dang JSON
3. `d99cb15` feat(p5b-ht): route /api/health/db kiem DB co gioi han tan suat
4. `c4149e3` feat(p5b-ht): Dockerfile standalone, docker-compose local (app + PostgreSQL 16 + migrate + tools)
5. `d88cfa7` feat(p5b-ht): script pg_dump hang ngay va thu khoi phuc ra DB tam
6. `de7bb09` feat(p5b-ht): lenh create-admin tao admin dau tien tren DB moi
7. `8894b19` docs(p5b-ht): T17 viet lai DEPLOY.md cho server cong ty (Docker Compose)

Không có migration Prisma, không đụng `schema.prisma`, không đụng trang/component UI nào, không thêm dependency npm, không đổi `package-lock.json`, không push remote.

---

## Vá lỗi debugger: race condition khoá `pg-backup.sh` (theo test đỏ của tester)

**Root cause:** trong `scripts/backup/pg-backup.sh`, `trap cleanup EXIT` được đăng ký NGAY TỪ ĐẦU script,
TRƯỚC khi thử giành khoá bằng `mkdir "$LOCK_DIR"`. Khi một tiến trình thua cuộc giành khoá (`mkdir` thất
bại vì tiến trình khác đang giữ) thoát mã 3, `cleanup()` vẫn chạy do trap đã đăng ký từ đầu, và `cleanup()`
gọi `rmdir "$LOCK_DIR"` **vô điều kiện** - tự tay xoá khoá của tiến trình đang thắng (đang chạy `pg_dump`
dở dang). Hệ quả: một tiến trình thứ 3 khởi động ngay sau đó `mkdir` thành công (khoá đã bị xoá hộ) và
chạy `pg_dump` song song thật sự với tiến trình đầu - vô hiệu hoá hoàn toàn cơ chế khoá chống chạy trùng
ngay từ lần trùng đầu tiên. Tester đã viết test tự động (`src/server/backup-scripts-lock.test.ts`) chạy
thật script qua `sh` với binary `pg_dump`/`pg_restore` giả lập, tái hiện đúng lỗi (đỏ trước khi vá).

**Cách sửa (tối thiểu, đúng đề xuất của tester):** di chuyển dòng `trap cleanup EXIT` xuống SAU khối
`if ! mkdir "$LOCK_DIR" ...; then ... exit 3; fi`. Nhờ vậy tiến trình thua khoá thoát mã 3 mà KHÔNG đăng
ký trap nào - không có gì để nó tự dọn (nó chưa từng tạo `.lock` hay `.partial`). Chỉ tiến trình THẬT SỰ
giành được khoá mới đăng ký trap, nên khi nó thoát (thành công hay lỗi) mới tự xoá `.partial` dở dang của
chính nó và mở khoá `.lock` của chính nó. Hàm `cleanup()` giữ nguyên không đổi (`rm -f "$PARTIAL"` +
`rmdir "$LOCK_DIR"`) vì cả hai phần dọn đó chỉ cần chạy cho tiến trình đã giữ khoá.

**Đã kiểm không có chỗ khác cùng lỗi:** đọc lại toàn bộ `scripts/backup/pg-restore-test.sh` - script này
đăng ký `trap cleanup EXIT` (dòng 66) ĐÚNG chỗ, tức là SAU tất cả các gate thoát sớm (kiểm file backup tồn
tại - exit 2, kiểm sha256 - exit 4, kiểm tên DB tạm hợp lệ/khác `PGDATABASE` - exit 5) và TRƯỚC `createdb`.
Không có tiến trình nào thoát sớm qua các gate đó mà vẫn kích hoạt cleanup oan - không cần sửa gì ở file
này.

**Kiểm chứng:**
- `npx vitest run src/server/backup-scripts-lock.test.ts`: từ ĐỎ (tester) sang XANH (1/1 pass) sau khi vá.
- `npx tsc --noEmit`: sạch.
- `npm test`: 255 file/1 skip (256) - 2903 test/15 skip (2918) xanh, không giảm/skip thêm test nào so
  với mốc 253 file/2897 test + 15 skip trước đó (tăng thêm đúng 2 file test mới tester bổ sung:
  `logger-bien.test.ts`, `backup-scripts-lock.test.ts`).

**File sửa:** `scripts/backup/pg-backup.sh` (chỉ di chuyển 1 dòng `trap cleanup EXIT` + thêm 1 dòng
comment giải thích, không sửa gì khác).

---

## Vá 4 mục BẮT BUỘC theo `.bangiao/danh-gia.md` (PHÁN QUYẾT: CẦN SỬA, B-1..B-4)

Làm TDD từng mục: viết ca test đỏ trước, chạy xác nhận đỏ đúng mô tả lỗi, rồi mới sửa code, chạy lại
xác nhận xanh. Chỉ sửa đúng phạm vi B-1..B-4, không đụng N-1..N-10.

### B-1: Đảo thứ tự rate limit ở `/api/health/db`

- **Lỗi:** `app/api/health/db/route.ts` kiểm bộ đếm TOÀN CỤC (`health-db:global`, 300/phút) TRƯỚC
  bộ đếm theo IP (`health-db:${ip}`, 60/phút) - một IP gửi nhiều request vẫn tăng bộ đếm toàn cục dù
  bị chặn ở mức IP, nên có thể tự làm tràn bộ đếm chung và khoá luôn healthcheck của giám sát IT.
- **Sửa:** đảo thứ tự - kiểm per-IP TRƯỚC, chỉ request qua được per-IP mới tính vào bộ đếm toàn cục.
- **Test đỏ trước:** thêm ca "IP A gửi 400 lần (bị 429 từ lần 61) khong duoc tinh vao bo dem toan
  cuc, IP B van nhan 200" vào `src/server/health-db-route.test.ts`. Đã chạy xác nhận ĐỎ trên code cũ
  (IP B nhận 429 vì IP A làm tràn bộ đếm chung), rồi XANH sau khi đảo thứ tự.
- **Tài liệu:** `docs/DEPLOY.md` mục 6 thêm khối `location = /api/health/db { allow <IP giám sát
  IT>; allow 127.0.0.1; deny all; proxy_pass ...; }` để endpoint không công khai ra Internet; ghi
  chú rõ healthcheck bên trong container gọi thẳng `127.0.0.1:3000` (nội bộ container) nên không bị
  chặn bởi khối này. Mục 15 (Theo dõi sau deploy) cập nhật câu "IT giám sát ... từ đúng IP đã khai
  `allow`" + ý nghĩa mã 403.

### B-2: `pg-restore-test.sh` ghép tên bảng thô vào SQL (SQL injection qua nội dung file dump)

- **Lỗi:** tên bảng đọc từ DB tạm (`TABLE_NAMES`, nội dung do file dump quyết định) được ghép thẳng
  vào chuỗi SQL (`select count(*) from "$t"`) không kiểm định dạng, có thể chạy lệnh SQL tuỳ ý bằng
  quyền superuser `ddc`. Dòng cũ còn có truy vấn thứ hai chạy trên chính `PGDATABASE` (DB thật) để in
  cột "so_dong_nguon" (chỉ để xem), tăng thêm bề mặt tấn công và còn nuốt lỗi im lặng (`|| echo "?"`).
- **Quyết định đã chọn (giữa 2 phương án đề bài đưa ra):** chọn phương án MẠNH hơn - **bỏ hẳn** cột
  "so_dong_nguon" và toàn bộ truy vấn nhắm vào `$PGDATABASE`, thay vì chỉ thêm `PGOPTIONS=-c
  default_transaction_read_only=on`. Lý do: đơn giản hơn, và loại bỏ HẲN khả năng script kết nối tới
  DB thật trong mọi trường hợp (thay vì chỉ giảm nhẹ rủi ro bằng cờ chỉ-đọc) - khớp đúng cam kết ở
  dòng 2 của script "khong bao gio dung/xoa DB nguon PGDATABASE", giờ đúng theo nghĩa đen kể cả đọc.
  Vì đã bỏ truy vấn nguồn, yêu cầu (3) "không nuốt lỗi im lặng" cũng tự động không còn áp dụng.
- **Sửa (3 ý):**
  1. Trước khi dùng `$t` trong SQL (áp dụng cho cả truy vấn DB tạm còn lại), kiểm khớp
     `^[A-Za-z_][A-Za-z0-9_]*$` bằng `case "$t" in *[!A-Za-z0-9_]*|[0-9]*) fail "bad_table_name";; esac`.
  2. Bỏ hẳn truy vấn `PGDATABASE` + cột "so_dong_nguon" (xem quyết định ở trên).
  3. Không áp dụng (đã bỏ truy vấn nguồn).
- **Gộp T-1 (rẻ, cùng file):** thêm `[ ${#RESTORE_DB} -le 63 ] || exit 5` (giới hạn 63 ký tự của
  Postgres); thêm `_$$` (PID) vào tên DB tạm để 2 lần chạy cùng giây không trùng tên; dời
  `trap cleanup EXIT` xuống SAU `createdb` thành công (trước đó là ngay sau khai `cleanup()`), để lỗi
  "already exists" không dẫn tới `dropdb --force` nhầm DB của lần chạy khác.
- **Test đỏ trước:** file mới `src/server/backup-restore-test-script.test.ts` (cùng khuôn
  `backup-scripts-lock.test.ts`), dùng `createdb`/`dropdb`/`pg_restore`/`psql` giả; `psql` giả đọc
  biến `FAKE_TABLE_NAMES` để trả tên bảng tuỳ chỉnh và ghi mọi lệnh nhận được ra `PSQL_LOG`.
  - Ca 1 (đỏ trước khi sửa): tên bảng `x"; DROP TABLE "user_roles"; --` -> script PHẢI thoát 1 với
    `reason:"bad_table_name"`, và `PSQL_LOG` không được chứa chuỗi độc hại. Đã chạy xác nhận ĐỎ trên
    script cũ (thoát 0, chạy trót lọt), XANH sau khi thêm kiểm `case`.
  - Ca 2 (đường thành công): tên bảng hợp lệ (`orders`) -> script chạy hết, in đúng dòng tổng kết
    `restore_test.ok`. Ca này đã xanh ngay từ đầu (không phá luồng bình thường).

### B-3: Khoá `.lock` của `pg-backup.sh` có thể kẹt vĩnh viễn (không bắt tín hiệu, không tự dọn khoá cũ)

- **Lỗi:** script chỉ `trap cleanup EXIT`; khi bị SIGTERM/SIGINT/SIGHUP (`docker stop`, `docker
  compose down`, Ctrl+C) trap EXIT của `sh` không chạy, khoá `.lock` (nằm trên bind-mount host) tồn
  tại mãi sau khi container `--rm` biến mất, làm mọi lần backup 02:00 sau đó đều thoát 3 `lock_busy`.
- **Sửa:**
  1. Thêm `trap 'exit 130' INT TERM HUP` (đăng ký cùng lúc với `trap cleanup EXIT`, SAU khi giành
     được khoá) - gọi `exit` bên trong handler tín hiệu kích hoạt lại trap EXIT để chạy `cleanup()`.
  2. Thêm dọn khoá cũ (stale lock): trước khi `mkdir`, nếu `.lock` đã tồn tại và cũ hơn ngưỡng
     `STALE_LOCK_MIN=360` (6 giờ - lớn hơn nhiều so với thời gian `pg_dump` tối đa hợp lý của DB này,
     nhưng vẫn đủ nhỏ để phát hiện trước khi tới giờ backup kế tiếp 24h sau), log JSON
     `backup.stale_lock_removed` rồi `rmdir`, sau đó tiếp tục giành khoá lại bình thường (không
     `exit 3` trong nhánh này).
- **Test đỏ trước (3 ca) vào `src/server/backup-scripts-lock.test.ts`:**
  1. `.lock` cũ hơn ngưỡng (mtime chỉnh về 7 giờ trước) -> script chạy thành công, log có
     `backup.stale_lock_removed`. Đã chạy xác nhận ĐỎ trên code cũ (thoát 3 `lock_busy` vì không tự
     dọn), XANH sau khi thêm cơ chế stale lock.
  2. `.lock` mới (mtime = bây giờ) -> vẫn thoát 3 như cũ (không phá hành vi hiện có - xanh ngay từ đầu).
  3. Gửi SIGTERM giữa lúc `pg_dump` giả "ngủ" -> `.lock`/`.partial` phải được dọn sau khi tiến trình
     chết. **Ghi chú môi trường (đọc kỹ):** đã tự thăm dò (`probeSignalDelivery()`, tự viết, chạy 1
     lần lúc nạp file test) xem môi trường hiện tại có thật sự chuyển được tín hiệu SIGTERM tới tiến
     trình `sh` hay không - kể cả tự kiểm tay bằng `kill -TERM` ngay trong Git Bash trên máy Windows
     này, tiến trình `sh` con vẫn KHÔNG nhận được tín hiệu (đặc thù giả lập POSIX của MSYS trên
     Windows, không phải lỗi của bản vá). Vì vậy ca này tự `it.skipIf` khi thăm dò thất bại, GIỐNG hệt
     cách `describe.skipIf(!shAvailable)` đã làm ở vòng trước cho việc thiếu `sh`. Trên Linux thật
     (container `postgres:16-alpine`, CI) ca này sẽ chạy đầy đủ. Đây là 1 trong 16 ca skip của
     `npm test` (tăng 1 so với mốc 15 skip cũ) - không phải giảm/bỏ ca đã có sẵn, mà là ca MỚI tự
     phát hiện giới hạn hệ điều hành và skip có chủ đích, cần được ghi nhận rõ khi merge/chạy CI.
- **Tài liệu:** `docs/DEPLOY.md` mục 11 thêm đoạn giải thích cơ chế stale lock, cách nhận biết
  `lock_busy` lặp lại bất thường và lệnh gỡ khoá tay (`--entrypoint sh backup -c 'rmdir
  /backups/.lock'`); mục 15 thêm mục giám sát thường trực "file `.dump` mới nhất trong `BACKUP_DIR`
  không được cũ hơn 26 giờ" (không chỉ trong checklist 1-2 tuần đầu).

### B-4: `docs/DEPLOY.md` sai cổng và sai thư mục khôi phục

- **(a) Mâu thuẫn cổng:** nhiều chỗ hard-code `127.0.0.1:3000` (mục 1, 5, Nginx, `curl` kiểm) trong
  khi `docker-compose.yml` publish `127.0.0.1:${APP_PORT:-3005}` và `.env.docker.example` đặt
  `APP_PORT=3005` - lệch chỗ này đã tự phát hiện thêm 1 chỗ nữa ngoài danh sách đánh giá liệt kê
  (dòng 105, bảng biến mục 4, cũng viết `$APP_PORT` không nhất quán với chỗ khác).
  **Cách trình bày đã chọn:** dùng placeholder `<APP_PORT>` xuyên suốt (khớp phong cách `<ten-mien>`
  sẵn có của tài liệu) cho MỌI lệnh Nginx/`curl` chạy trên host, thay vì hard-code 1 con số cố định -
  vì `APP_PORT` vốn có thể đổi theo `.env.docker`. Thêm đoạn quy ước ngay đầu mục 1 giải thích rõ
  `<APP_PORT>` là cổng HOST (mặc định 3005), còn `3000` bên trong container là cổng nội bộ CỐ ĐỊNH
  không đổi - chỉ còn đúng 1 chỗ hợp lệ nhắc `127.0.0.1:3000` (healthcheck nội bộ container ở mục 6,
  có chú thích rõ), đã rà TOÀN VĂN xác nhận không còn chỗ nào khác. Thêm câu cảnh báo "không bao giờ
  bỏ tiền tố `127.0.0.1:` trong `ports` của `docker-compose.yml`". Phụ lục A (dev Windows) giữ
  nguyên số `3005` vì đúng là default không đổi trong ngữ cảnh đó, không gây mâu thuẫn.
  Thêm 3 ca test vào `src/server/deploy-files.test.ts` (describe `docs/DEPLOY.md (B-4)`): đếm đúng 1
  chỗ còn `127.0.0.1:3000` (case nội bộ hợp lệ) và >=7 chỗ dùng `127.0.0.1:<APP_PORT>`; kiểm sha256
  đứng trước `dropdb --force`; kiểm không còn cú pháp mount cứng `-v "$(pwd)/.backups`. Đã xác nhận
  ĐỎ trên bản `docs/DEPLOY.md` cũ (qua `git show HEAD:docs/DEPLOY.md`, không sửa file thật để test đỏ)
  trước khi sửa tài liệu, rồi XANH sau khi sửa.
- **(b) Sai thư mục khôi phục:** quy trình cũ mount cứng `"$(pwd)/.backups:/backups:ro"` trong khi
  `BACKUP_DIR` thật trỏ ổ dữ liệu bền (không phải `./.backups`), và chạy trên service `db` (không có
  sẵn `PGPASSWORD` nên sẽ hỏi mật khẩu). Đã đổi sang dùng đúng service `backup` (đã mount đúng
  `${BACKUP_DIR}` + có sẵn `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`):
  `docker compose --env-file .env.docker run --rm --entrypoint pg_restore backup --no-owner
  --no-privileges --exit-on-error -d ddc_control_tower /backups/<ten-file>.dump`.
  **Lưu ý kỹ thuật đã tự tra `mcp__context7` (docs PostgreSQL 16) trước khi viết:** `pg_restore`
  KHÔNG tự đọc biến môi trường `PGDATABASE` khi không truyền `-d` (khác `psql`) - nên vẫn phải giữ
  `-d ddc_control_tower` tường minh dù các biến kết nối khác (`PGHOST`/`PGUSER`/`PGPASSWORD`) đã có
  sẵn trong service `backup`; ban đầu suýt bỏ sót điểm này.
  Thêm bước bắt buộc `(cd "<BACKUP_DIR>" && sha256sum -c <ten-file>.dump.sha256)` TRƯỚC
  `dropdb --force`, vì quy trình cũ xoá DB thật trước khi biết bản dump có hỏng hay không.

### Cổng kiểm sau khi vá cả 4 mục

- `npx tsc --noEmit`: sạch.
- `npm test`: **257 file (1 skip)/2929 - 2913 test xanh + 16 skip** (tăng đúng 8 test xanh so với
  mốc 255 file/2905 xanh + 15 skip yêu cầu tối thiểu: B-1 +1, B-2 +2 (file mới), B-3 +2 xanh + 1 skip
  có chủ đích (xem giải thích ở B-3), B-4 +3; không giảm/skip thêm bất kỳ test nào có sẵn trước đó).
- `npm run build`: qua (dùng `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ
  `D:\_project\DDC_dieu-phoi\tools\font-mock.js` theo đúng hướng dẫn máy này bị chặn SSL khi tải
  Google Font).
- Không chạy được "chạy thật" bằng Docker/client PostgreSQL cho B-2/B-3 (máy này vẫn không có Docker
  Desktop và không có `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb`) - giữ nguyên hạn chế đã ghi
  nhận từ các vòng trước; toàn bộ 2 test mới (B-2) và 3 ca mới (B-3, trừ SIGTERM) đều đã CHẠY THẬT
  qua `sh` + binary giả, không phải mock JS thuần.

### Danh sách file đã sửa ở vòng vá B-1..B-4

- `app/api/health/db/route.ts` (đảo thứ tự rate limit)
- `src/server/health-db-route.test.ts` (+1 ca)
- `scripts/backup/pg-restore-test.sh` (kiểm tên bảng, bỏ truy vấn PGDATABASE/cột so_dong_nguon, giới
  hạn độ dài RESTORE_DB, thêm `_$$`, dời `trap cleanup EXIT`)
- `src/server/backup-restore-test-script.test.ts` (file mới, 2 ca)
- `scripts/backup/pg-backup.sh` (thêm trap tín hiệu INT/TERM/HUP, thêm dọn khoá cũ stale lock)
- `src/server/backup-scripts-lock.test.ts` (+3 ca, 1 tự skip có điều kiện theo môi trường)
- `docs/DEPLOY.md` (quy ước cổng `<APP_PORT>` xuyên suốt, khối Nginx chặn IP cho `/api/health/db`,
  hướng dẫn stale lock/gỡ khoá tay, giám sát tuổi file `.dump`, sửa quy trình khôi phục dùng đúng
  `BACKUP_DIR`/service `backup` + kiểm sha256 trước `dropdb --force`)
- `src/server/deploy-files.test.ts` (+3 ca kiểm nhất quán cổng và quy trình khôi phục trong DEPLOY.md)

Không đụng bất kỳ mục N-1..N-10 nào (để lại sổ nợ hardening như đánh giá yêu cầu).
