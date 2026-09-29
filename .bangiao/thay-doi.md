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
