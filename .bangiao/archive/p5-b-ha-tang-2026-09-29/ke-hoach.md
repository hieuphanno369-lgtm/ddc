# Kế hoạch P5 hạ tầng go-live (P5 mục 1-5 + mục 8 T17)

> Skill đã dùng khi lập: `writing-plans`. Tra docs Next 15 (instrumentation `register`/`onRequestError`, `output: 'standalone'`, Dockerfile mẫu) qua context7.
> Nguồn yêu cầu: `D:\_project\DDC_dieu-phoi\lenh-cho-B-2026-09-29-p5-ha-tang.md`, `lenh-cho-A-2026-09-27.md` PHẦN 5 mục 1-5, 8 và mục 7.4.
> Nhánh: `feature/p5-b-ha-tang` (từ `main` @ `ff28fb4`). Không có migration, không đụng `schema.prisma`, không đụng trang/component UI nào.

---

## Quyết định của chủ dự án (đã chốt, không còn câu hỏi treo)

- **Q1 = (a):** server thật chạy bằng Docker Compose, dùng đúng bộ file của Task 4.
- **Q2:** backup chạy **02:00** mỗi ngày.
- **Q3 = (a):** chỉ log JSON trên server, KHÔNG dùng Sentry hay dịch vụ ngoài. Chống tràn ổ đĩa: MỌI service trong `docker-compose.yml` đều xoay vòng log (`json-file`, `max-size: "10m"`, `max-file: "14"`), dùng chung 1 anchor YAML.
- **Q4 = (a):** thêm lệnh `npm run create-admin -- <email>` (Task 7b), làm xong trước Task 7.
- Q5 (sửa tài liệu IT) không thuộc nhánh này, điều phối viên xử lý riêng sau merge.

Thông tin lấy sẵn từ tài liệu IT: Ubuntu Server 24.04 LTS, PostgreSQL 16 chung máy với app, bắt buộc HTTPS với tên miền cố định (ví dụ `controltower.daidung.vn`), Nginx phía trước, múi giờ Asia/Ho_Chi_Minh, backup giữ tối thiểu 14 ngày và để ngoài máy production (R3).

Thứ tự task: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7b -> 7.

## Quyết định kỹ thuật planner đã chọn (ghi để reviewer biết)

- Health check DB là route MỚI `GET /api/health/db`; giữ nguyên `/api/health` (sống/chết, không chạm DB, test cũ cấm nó import `@/server/`). IT giám sát `/api/health/db`.
- Log: một dòng JSON mỗi sự kiện, ghi ra stdout/stderr qua `console.*`, lọc theo TÊN KHOÁ nhạy cảm; lỗi chỉ ghi tên lỗi, mã lỗi, digest, các dòng `at ...` của stack, KHÔNG BAO GIỜ ghi `message`.
- Kiểm env chạy trong `instrumentation.ts` `register()` (Next 15), chỉ dừng app khi `NODE_ENV=production`; ở dev chỉ cảnh báo.
- Ảnh Docker dựa trên `node:24-bookworm-slim` (máy dev đang chạy Node 24.19.0), PostgreSQL `postgres:16-alpine`.
- Compose local publish app ở `127.0.0.1:3005` (3000-3003, 3010 đã có chủ), đổi được qua `APP_PORT`.
- Không đổi cách Prisma tự ghi log lỗi (`src/server/db.ts`): đổi sang `emit: 'event'` làm thay đổi kiểu generic của `prisma` đang được dùng khắp nơi, rủi ro lớn hơn lợi ích.

## Global Constraints

- Không sửa file trong worktree của A/C. Không push. Không sửa `PROGRESS.md`, `.serena/memories/`.
- File nóng đụng tới: `next.config.mjs` (ghi "Đang giữ" vào `D:\_project\DDC_dieu-phoi\phien-B.md` trước khi sửa, bỏ ra sau commit Task 4). `src/server/actions.ts` chỉ sửa 1 dòng log ở Task 1 NẾU `phien-A.md`/`phien-C.md` không giữ file đó; đang bị giữ thì bỏ qua dòng đó và ghi vào `.bangiao/thay-doi.md`.
- Không thêm dependency npm, không đổi `package-lock.json`. `package.json` chỉ được thêm ĐÚNG 1 dòng script `"create-admin": "tsx scripts/create-admin.ts"` ở Task 7b (ngoại lệ chủ dự án đã duyệt), không đổi gì khác.
- Không dùng dấu gạch dài ở bất kỳ đâu (code, comment, tài liệu, commit).
- Comment/test name theo quy ước repo: tiếng Việt; tên `it(...)` trong test viết không dấu như các test hiện có (xem `src/server/csp-report-route.test.ts`).
- Script shell: POSIX `sh` (chạy được trong `postgres:16-alpine` busybox và trên Ubuntu), kết thúc dòng LF.
- Cổng kiểm sau mỗi task: `npx tsc --noEmit` và `npm test` xanh (chạy qua PowerShell, ổ `D:` hoa).
- Máy dev bị soi SSL: lệnh nào gọi mạng thật (docker build, npm ci, tải font) dùng CA `D:\_project\DDC_dieu-phoi\tools\win-root-ca.pem`, không tắt kiểm TLS.
- Commit message: tiếng Việt không dấu, tiền tố `feat(p5b-ht):`, `test(p5b-ht):`, `docs(p5b-ht):`, giữ dòng `Co-Authored-By` của agent.

---

## Task 0: Chuẩn bị

- [ ] Chạy `docker version` và `docker compose version`. Không có Docker Desktop thì DỪNG Task 4-5 phần chạy thật, báo lại (cài Docker cần quyền admin của chủ dự án); Task 1-3 vẫn làm.
- [ ] Đọc mục "Đang giữ" của `phien-A.md`, `phien-C.md`: ghi lại `next.config.mjs` và `src/server/actions.ts` có ai giữ không.
- [ ] Ghi `next.config.mjs` vào "Đang giữ" của `phien-B.md`.

---

## Task 1: Logger có cấu trúc + chuyển các chỗ log hiện có

**Files:**
- Create: `src/lib/logger.ts`, `src/lib/logger.test.ts`
- Modify (chỉ thay dòng `console.*`): `src/lib/clock.ts:48`, `src/lib/client-ip.ts:39`, `src/lib/auth.ts:121`, `src/lib/auth.ts:303`, `app/api/csp-report/route.ts:42`, `src/server/actions-password-reset.ts:26`, `:43`, `src/server/alert-engine.ts:99`, `src/server/auth-mail.ts:31`, `:34`, `src/server/notify/dispatch.ts:154`, `:172`, `:189`, `src/server/jobs.ts:26`, `:64`, `src/server/password-reset.ts:167`, `src/server/actions.ts:465` (có điều kiện, xem Global Constraints)
- Modify test: `src/server/csp-report-route.test.ts:32`
- KHÔNG đổi: `scripts/*.ts` (lệnh CLI in cho người đọc), `prisma/seed.ts`.

**Interfaces (Produces):**

```ts
// src/lib/logger.ts - KHÔNG import Node API (middleware edge có thể kéo gián tiếp).
export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;
export function redact(fields: LogFields): LogFields;
export function errorFields(e: unknown): { errName: string; errCode?: string; errDigest?: string; errStack?: string[] };
export const logger: {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};
```

**Hành vi bắt buộc:**
- Mỗi lần gọi in ĐÚNG 1 đối số là 1 chuỗi JSON 1 dòng: `{"ts":"<ISO>","level":"warn","event":"<event>", ...redact(fields)}`; `ts`, `level`, `event` luôn đứng đầu và không bị fields ghi đè.
- `info` gọi `console.info`, `warn` gọi `console.warn`, `error` gọi `console.error`.
- `redact`: tách tên khoá thành từ (`key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/)`); khoá có bất kỳ từ nào thuộc tập sau thì giá trị thành `'[redacted]'`: `password, passwd, pass, pwd, secret, token, authorization, cookie, cookies, session, email, mail, smtp, webhook, url, uri, ip, key, hash, otp, phone, header, headers`.
  Đệ quy vào object/mảng tối đa độ sâu 3 (sâu hơn thành `'[depth]'`), mảng giữ tối đa 20 phần tử, chuỗi cắt còn 500 ký tự.
- `JSON.stringify` lỗi (vòng tham chiếu, BigInt) thì in `{"ts","level","event","logError":"unserializable"}`, không throw. Logger không bao giờ throw.
- `errorFields`: `errName` = `e.name` nếu là Error, ngược lại `typeof e`; `errCode` chỉ khi `e.code` là chuỗi khớp `/^[A-Z0-9_]{1,20}$/` (ví dụ `P2002`, `ECONNREFUSED`); `errDigest` khi `e.digest` là chuỗi; `errStack` = các dòng của `e.stack` sau khi `trim()` bắt đầu bằng `at `, tối đa 8 dòng. KHÔNG BAO GIỜ đưa `e.message` vào.

**Bảng chuyển chỗ log (giữ nguyên logic xung quanh):**

| Vị trí | Thay bằng |
|---|---|
| `clock.ts:48` | `logger.warn('clock.fake_today_ignored', { fakeToday: override, hint: 'Xoa DDC_FAKE_TODAY khoi moi truong production' })` |
| `client-ip.ts:39` | `logger.warn('client_ip.unresolved', { hint: 'Kiem tra reverse proxy noi X-Forwarded-For, xem TRUSTED_PROXY_HOPS trong .env.example' })` |
| `auth.ts:121` | `logger.error('auth.authorize_failed', errorFields(e))` |
| `auth.ts:303` | `logger.error('auth.session_cookie_failed', { tag, ...errorFields(e) })` |
| `csp-report/route.ts:42` | `logger.warn('csp_report.violation', { violation: JSON.stringify(v) })` (để dạng chuỗi, vì khoá con `documentURL`/`blockedURL` sẽ bị lọc nếu để object) |
| `actions-password-reset.ts:26` / `:43` | `logger.error('password_reset.request_failed', errorFields(e))` / `logger.error('password_reset.submit_failed', errorFields(e))` |
| `alert-engine.ts:99` | `logger.error('alert_engine.failed', errorFields(e))` (trước đây in nguyên `e`) |
| `auth-mail.ts:31` / `:34` | `logger.error('auth_mail.send_failed', { errCode: String(r.error) })` / `logger.error('auth_mail.unexpected')` |
| `dispatch.ts:154` / `:172` / `:189` | `logger.error('notify.alert_failed', { alertId: alert.id })` / `logger.error('notify.dispatch_failed')` / `logger.error('notify.retry_failed')` |
| `jobs.ts:26` / `:64` | `logger.error('jobs.prune_auth_failed', errorFields(e))` / `logger.error('jobs.run_due_failed', errorFields(e))` |
| `password-reset.ts:167` | `logger.error('password_reset.background_failed', errorFields(e))` |
| `actions.ts:465` (có điều kiện) | `logger.error('auth.change_password_failed', errorFields(e))` |

Xoá các dòng `// eslint-disable-next-line no-console` đi kèm dòng đã thay.

- [ ] **Bước 1: Viết test đỏ `src/lib/logger.test.ts`** (khuôn spy console như `src/lib/client-ip.test.ts:56-78`), tối thiểu các ca:
  - `warn('a.b', { alertId: 5 })` -> `console.warn` gọi 1 lần, 1 đối số, `JSON.parse` ra `level:'warn'`, `event:'a.b'`, `alertId:5`, có `ts` ISO.
  - `info` dùng `console.info`, `error` dùng `console.error`.
  - fields `{ event: 'x', level: 'y' }` không ghi đè được `event`/`level`.
  - Các khoá `password, smtpPass, webhookUrl, clientIp, sessionToken, email, authorization, headers, passwordHash` -> `'[redacted]'`.
  - Các khoá `alertId, jobName, description, recipientCount, routePath, errCode` giữ nguyên.
  - Lọc đệ quy: `{ ctx: { user: { email: 'a@b.c' } } }` -> email bị lọc; độ sâu 4 -> `'[depth]'`; chuỗi 600 ký tự -> dài 500.
  - Object vòng tham chiếu -> in `logError:'unserializable'`, không throw.
  - `errorFields(new Error('password=hunter2'))`: không chuỗi nào chứa `hunter2`, có `errName:'Error'`, `errStack` mọi phần tử bắt đầu `at `.
  - Error có `code='P2002'` -> `errCode:'P2002'`; `code='abc def'` -> không có `errCode`; có `digest:'123'` -> `errDigest:'123'`; `errorFields('chuoi')` -> `errName:'string'`.
- [ ] **Bước 2:** `npx vitest run src/lib/logger.test.ts` -> ĐỎ (chưa có module).
- [ ] **Bước 3:** Viết `src/lib/logger.ts` theo hành vi trên.
- [ ] **Bước 4:** Chạy lại -> XANH.
- [ ] **Bước 5:** Thay từng chỗ log theo bảng. Sửa `src/server/csp-report-route.test.ts:32` thành `expect(JSON.parse(warn.mock.calls[0][0]).event).toBe('csp_report.violation');`. Các test khác (`clock.test.ts`, `client-ip.test.ts`, `auth-mail.test.ts`, `actions-password-reset.test.ts`, `csp-report-route-bien.test.ts`) phải xanh KHÔNG cần sửa; nếu đỏ thì sửa code, không nới test.
- [ ] **Bước 6:** `npx tsc --noEmit`, `npm test` xanh. Commit `feat(p5b-ht): logger JSON co loc khoa nhay cam, chuyen cac cho log server`.

---

## Task 2: Kiểm env khi khởi động + ghi lỗi request chưa bắt

**Files:**
- Create: `src/lib/env-check.ts`, `src/lib/env-check.test.ts`, `instrumentation.ts` (gốc repo, cạnh `middleware.ts`), `src/server/instrumentation.test.ts`
- Modify: `.env.example`
- KHÔNG sửa `src/lib/env.ts` (middleware edge import nó; env-check dùng `Buffer` nên phải là file riêng).

**Interfaces (Produces):**

```ts
// src/lib/env-check.ts (chỉ chạy ở runtime nodejs)
export type EnvProblem = { name: string; reason: 'missing' | 'invalid' };
export const REQUIRED_PROD_ENV = [
  'DATABASE_URL', 'DIRECT_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'NOTIFY_SECRET_KEY', 'CRON_SECRET',
] as const;
export function checkServerEnv(env: Record<string, string | undefined>): EnvProblem[];
export function enforceServerEnv(
  env?: Record<string, string | undefined>,      // mặc định process.env
  exit?: (code: number) => void,                 // mặc định (c) => process.exit(c)
): void;
```

```ts
// instrumentation.ts
import type { Instrumentation } from 'next';
import { errorFields, logger } from './src/lib/logger';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { enforceServerEnv } = await import('./src/lib/env-check');
  enforceServerEnv();
}

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  logger.error('request.unhandled', {
    method: request.method,
    path: request.path.split(/[?#]/)[0],
    routePath: context.routePath,
    routeType: context.routeType,
    ...errorFields(err),
  });
};
```

**Luật `checkServerEnv`** (mọi giá trị `trim()` trước; trả theo thứ tự `REQUIRED_PROD_ENV` rồi tới các biến tuỳ chọn):

| Biến | missing khi | invalid khi |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | rỗng | không khớp `/^postgres(ql)?:\/\//` |
| `NEXTAUTH_SECRET` | rỗng | dài < 32 ký tự |
| `NEXTAUTH_URL` | rỗng | `new URL()` lỗi; hoặc protocol khác `https:` trừ khi `http:` với hostname `localhost`/`127.0.0.1`; hoặc `pathname !== '/'`, có `search`/`hash` |
| `NOTIFY_SECRET_KEY` | rỗng | `Buffer.from(v, 'base64').length !== 32` (cùng luật `hasSecretKey` ở `src/lib/secret-box.ts:26`) |
| `CRON_SECRET` | rỗng | dài < 32 ký tự |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | chỉ 1 trong 2 có giá trị -> biến còn lại `missing` | |
| `TRUSTED_PROXY_HOPS` | (tuỳ chọn) | có giá trị mà không khớp `/^[1-9]\d*$/` |

**Luật `enforceServerEnv`:**
- `env.NEXT_PHASE === 'phase-production-build'` -> return (không kiểm lúc `next build`).
- Không có problem -> return, không log.
- Có problem và `env.NODE_ENV === 'production'` -> `logger.error('env.invalid', { problems: ['NOTIFY_SECRET_KEY:missing', ...], hint: 'Xem .env.example va docs/DEPLOY.md muc Bien moi truong' })` rồi `exit(1)`.
- Có problem, không phải production -> `logger.warn('env.invalid_dev', { problems, hint })`, không exit.
- Tuyệt đối không in giá trị biến, chỉ tên + lý do.

- [ ] **Bước 1: Test đỏ `src/lib/env-check.test.ts`** (dùng object env truyền vào, không stub process.env). Dựng `VALID` = bộ env hợp lệ đủ 6 biến (`NOTIFY_SECRET_KEY` = `Buffer.alloc(32, 1).toString('base64')`). Ca:
  - `VALID` -> `[]`.
  - Xoá từng biến trong `REQUIRED_PROD_ENV` (dùng `it.each`) -> đúng 1 problem `{name, reason:'missing'}`; chuỗi toàn khoảng trắng cũng là missing.
  - `DATABASE_URL='mysql://x'` invalid; `NEXTAUTH_SECRET` 31 ký tự invalid, 32 ký tự hợp lệ; `CRON_SECRET` tương tự.
  - `NEXTAUTH_URL`: `http://ct.daidung.vn` invalid; `http://localhost:3005` hợp lệ; `https://ct.daidung.vn/app` invalid; `https://ct.daidung.vn/?a=1` invalid; `khong-phai-url` invalid.
  - `NOTIFY_SECRET_KEY` = base64 của 16 byte -> invalid.
  - Chỉ có `GOOGLE_CLIENT_ID` -> `GOOGLE_CLIENT_SECRET:missing`; ngược lại tương tự; cả 2 rỗng -> hợp lệ.
  - `TRUSTED_PROXY_HOPS`: `'0'`, `'abc'`, `'1.5'` invalid; `''`, `'2'` hợp lệ.
  - `enforceServerEnv`: production thiếu 2 biến -> `exit` gọi đúng 1 lần với `1`, `console.error` 1 dòng JSON `event:'env.invalid'`, `problems` có 2 phần tử, chuỗi log KHÔNG chứa giá trị bí mật nào có trong env; `NODE_ENV='development'` -> không exit, `console.warn` `event:'env.invalid_dev'`; `NEXT_PHASE='phase-production-build'` -> không exit, không log; env hợp lệ -> không log.
- [ ] **Bước 2: Test đỏ `src/server/instrumentation.test.ts`** (import `../../instrumentation`):
  - `register()` với `NEXT_RUNTIME='edge'` -> không gọi `process.exit` (spy `process.exit` bằng `vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)`).
  - `register()` với `NEXT_RUNTIME='nodejs'`, `NODE_ENV='production'`, các biến bắt buộc rỗng (`vi.stubEnv`) -> `process.exit(1)`.
  - `onRequestError(new Error('password=hunter2'), { path: '/vi/dat-lai-mat-khau?token=BI_MAT#x', method: 'GET', headers: { cookie: 'next-auth.session-token=SECRET_COOKIE' } }, { routerKind: 'App Router', routePath: '/[locale]/dat-lai-mat-khau', routeType: 'render', renderSource: 'server-rendering', revalidateReason: undefined })` -> 1 dòng `console.error`, `event:'request.unhandled'`, `path:'/vi/dat-lai-mat-khau'`, chuỗi log không chứa `hunter2`, `BI_MAT`, `SECRET_COOKIE`.
  - `afterEach`: `vi.unstubAllEnvs()`, `vi.restoreAllMocks()`.
- [ ] **Bước 3:** Chạy 2 file test -> ĐỎ.
- [ ] **Bước 4:** Viết `src/lib/env-check.ts`, `instrumentation.ts` như trên. Nếu kiểu `Instrumentation.onRequestError` không khớp tham số test thì ép kiểu trong test, không đổi chữ ký hàm.
- [ ] **Bước 5:** Chạy lại -> XANH.
- [ ] **Bước 6: Sửa `.env.example`** (giữ kiểu comment không dấu như các dòng hiện có, giữ thứ tự nhóm):
  - Dòng đầu file thêm: `# Production: app DUNG KHI KHOI DONG neu thieu/sai bien BAT BUOC (instrumentation.ts + src/lib/env-check.ts).`
  - `DATABASE_URL`: bỏ nội dung Supabase và "để trống để chạy mock" (đã sai, runtime luôn dùng Prisma). Ghi: `# BAT BUOC - PostgreSQL 16, dang postgresql://user:pass@host:5432/db`.
  - `DIRECT_URL`: `# BAT BUOC (schema.prisma dung directUrl cho migrate) - khong dung pooler thi dat GIONG DATABASE_URL`.
  - `NEXTAUTH_SECRET`: đổi thành `# BAT BUOC - toi thieu 32 ky tu (openssl rand -base64 32)`.
  - `NEXTAUTH_URL`: thêm `# BAT BUOC - production phai la https://<ten-mien>, khong co duong dan phia sau`.
  - `GOOGLE_*`: thêm `# Dien du CA HAI hoac de trong CA HAI`.
  - `NOTIFY_SECRET_KEY`: thêm chữ `BAT BUOC` vào dòng comment đầu.
  - `CRON_SECRET`: đổi thành `# BAT BUOC - toi thieu 32 ky tu (openssl rand -base64 32); cron ngoai goi /api/cron/alerts_daily.`
  - `TRUSTED_PROXY_HOPS`: thêm `# Neu dat: so nguyen >= 1.`
- [ ] **Bước 7:** `npx tsc --noEmit`, `npm test` xanh. Chạy thử `npm run dev` trên cổng 3001 (`npx next dev -p 3001`), dev server lên bình thường; nếu `.env` local thiếu biến thì chỉ thấy 1 dòng `env.invalid_dev`. Tắt dev server. Commit `feat(p5b-ht): kiem env bat buoc khi khoi dong, ghi loi request chua bat dang JSON`.

---

## Task 3: Health check DB

**Files:**
- Create: `src/lib/health-db.ts`, `src/lib/health-db.test.ts`, `app/api/health/db/route.ts`, `src/server/health-db-route.test.ts`
- Modify: `src/server/api-routes-guard.test.ts`

**Interfaces (Produces):**

```ts
// src/lib/health-db.ts (thuần, không import Prisma)
export const HEALTH_DB_TIMEOUT_MS = 3000;
export type PingResult = { ok: true } | { ok: false; timedOut: boolean; error?: unknown };
export function pingDb(query: () => Promise<unknown>, timeoutMs: number): Promise<PingResult>;
```

`pingDb`: đua `query()` với `setTimeout(timeoutMs)`; `query` throw đồng bộ hay reject -> `{ok:false, timedOut:false, error}`; hết giờ -> `{ok:false, timedOut:true}`; luôn `clearTimeout`; promise của `query` luôn có handler (không để unhandled rejection khi nó reject sau lúc đã hết giờ).

```ts
// app/api/health/db/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/client-ip';
import { HEALTH_DB_TIMEOUT_MS, pingDb } from '@/lib/health-db';
import { errorFields, logger } from '@/lib/logger';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

/** Kiểm DB cho compose/reverse proxy/giám sát IT. Công khai, KHÔNG trả chi tiết lỗi. */
export async function GET(req: NextRequest) {
  const global = rateLimit('health-db:global', 300, 60_000);
  if (!global.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(global.retryAfterSec) } });
  const ip = clientIpFrom(req.headers);
  const perIp = rateLimit(`health-db:${ip}`, 60, 60_000);
  if (!perIp.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(perIp.retryAfterSec) } });
  const r = await pingDb(() => prisma.$queryRaw`SELECT 1`, HEALTH_DB_TIMEOUT_MS);
  if (r.ok) return NextResponse.json({ status: 'ok', db: 'ok' }, { headers: NO_STORE });
  logger.warn('health.db_down', r.timedOut ? { errName: 'Timeout' } : errorFields(r.error));
  return NextResponse.json({ status: 'error', db: 'down' }, { status: 503, headers: NO_STORE });
}
```

**Sửa `src/server/api-routes-guard.test.ts`:**
- `type Guard` thêm `'health-db'`; `GUARDS` thêm `'health/db/route.ts': 'health-db'`.
- Nhánh kiểm mới:
  ```ts
  if (guard === 'health-db') {
    expect(src).toMatch(/rateLimit\(/);
    expect(src).toContain('clientIpFrom');
    expect(src).not.toMatch(/getCurrentUser\(/);
    const serverImports = src.match(/['"]@\/server\/[^'"]+['"]/g) ?? [];
    expect(serverImports.map((s) => s.slice(1, -1))).toEqual(['@/server/db']);
  }
  ```

- [ ] **Bước 1: Test đỏ `src/lib/health-db.test.ts`:** query resolve -> `{ok:true}`; reject -> `ok:false, timedOut:false`, `error` là lỗi gốc; throw đồng bộ -> như reject; query treo, `timeoutMs=20` -> `timedOut:true` trong < 200ms; query reject SAU khi đã hết giờ -> không có unhandled rejection (đăng ký `process.on('unhandledRejection')` trong test, đợi 50ms, không được gọi).
- [ ] **Bước 2: Test đỏ `src/server/health-db-route.test.ts`** (`vi.mock('@/server/db', () => ({ prisma: { $queryRaw: vi.fn() } }))`, mỗi ca dùng `x-forwarded-for` riêng như `csp-report-route.test.ts:10-11`):
  - `$queryRaw` resolve -> 200, body đúng khoá `['db','status']`, `status:'ok'`, header `cache-control: no-store`.
  - `$queryRaw` reject `new Error('connect ECONNREFUSED 10.0.0.5:5432 password=x')` -> 503, body đúng `{status:'error', db:'down'}`, body không chứa `10.0.0.5`, `password`; `console.warn` 1 dòng `event:'health.db_down'` không chứa `password=x`.
  - Cùng 1 IP: 60 lần không 429, lần 61 -> 429 có `Retry-After`.
- [ ] **Bước 3:** Chạy -> ĐỎ. Sửa guard test -> đỏ vì chưa có route.
- [ ] **Bước 4:** Viết `src/lib/health-db.ts`, `app/api/health/db/route.ts`.
- [ ] **Bước 5:** `npx tsc --noEmit`, `npm test` xanh. Chạy `npx next dev -p 3001`, `curl http://localhost:3001/api/health/db` -> 200 `{"status":"ok","db":"ok"}` với DB B. Commit `feat(p5b-ht): route /api/health/db kiem DB co gioi han tan suat`.

---

## Task 4: Đóng gói Docker + compose chạy local

**Files:**
- Modify: `next.config.mjs` (file nóng), `.gitignore`
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.docker.example`, `docker/extra-ca/empty.pem` (file rỗng 0 byte), `.gitattributes`, `src/server/deploy-files.test.ts`

**`next.config.mjs`:** thêm vào `nextConfig`, giữ nguyên phần còn lại:
```js
  // P5 hạ tầng: Dockerfile chạy bản standalone (node server.js).
  output: 'standalone',
  // docs/csp-header-bao-mat.md mục 3: ẩn X-Powered-By.
  poweredByHeader: false,
```
Sau khi sửa, kiểm `npm run build` rồi `npx next start -p 3001` (quy trình load test đang dùng, `scripts/perf/load-test.ts:2`). Nếu `next start` chỉ cảnh báo mà vẫn phục vụ trang -> giữ nguyên. Nếu `next start` từ chối chạy -> đổi thành `output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,` và thêm `ENV NEXT_OUTPUT_STANDALONE=1` vào stage `builder` của Dockerfile, ghi lý do vào `.bangiao/thay-doi.md`.
`npm run build` trên máy dev: đặt `NODE_EXTRA_CA_CERTS=D:\_project\DDC_dieu-phoi\tools\win-root-ca.pem` (hoặc `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` theo CLAUDE.md mục 7).

**`.gitattributes`** (mới):
```
*.sh text eol=lf
Dockerfile text eol=lf
docker-compose.yml text eol=lf
```

**`.gitignore`:** thêm cuối file 2 dòng `.env.docker` và `.backups/`.

**`.dockerignore`:**
```
node_modules
.next
.git
.env
.env.*
!.env.example
.backups
.bangiao
.claude
.serena
.playwright-mcp
.obsidian
e2e
test-results
playwright-report
docs
*.md
*.html
.dev.log
```

**`Dockerfile`:**
```dockerfile
# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 TZ=Asia/Ho_Chi_Minh

# CA công ty chỉ cần ở máy bị soi SSL; file rỗng thì bỏ qua (xem .env.docker.example EXTRA_CA_FILE).
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL giả CHỈ để import module lúc build, không bao giờ vào ảnh chạy.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npx prisma generate \
 && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build \
    npm run build

# Ảnh công cụ: migrate, seed (chỉ local), unlock-account. Không publish cổng nào.
FROM builder AS tools
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

**`docker-compose.yml`:**
```yaml
# Chạy: docker compose --env-file .env.docker up -d --build
# Công cụ: docker compose --env-file .env.docker run --rm tools <lệnh>
x-db-url: &db-url postgresql://ddc:${POSTGRES_PASSWORD:?}@db:5432/ddc_control_tower
# Mọi service xoay vòng log, không để file log container phình vô hạn làm đầy ổ.
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "14"

services:
  db:
    image: postgres:${PG_MAJOR:-16}-alpine
    environment:
      POSTGRES_USER: ddc
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
      POSTGRES_DB: ddc_control_tower
      TZ: Asia/Ho_Chi_Minh
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ddc -d ddc_control_tower"]
      interval: 10s
      timeout: 5s
      retries: 10
    logging: *default-logging
    restart: unless-stopped

  migrate:
    image: ddc-control-tower-tools:${APP_IMAGE_TAG:-local}
    build: &tools-build
      context: .
      target: tools
      secrets: [extra_ca]
    environment:
      DATABASE_URL: *db-url
      DIRECT_URL: *db-url
    depends_on:
      db: { condition: service_healthy }
    logging: *default-logging
    restart: "no"

  app:
    image: ddc-control-tower:${APP_IMAGE_TAG:-local}
    build:
      context: .
      target: runner
      secrets: [extra_ca]
    environment:
      DATABASE_URL: *db-url
      DIRECT_URL: *db-url
      NEXTAUTH_URL: ${NEXTAUTH_URL:?}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?}
      NOTIFY_SECRET_KEY: ${NOTIFY_SECRET_KEY:?}
      CRON_SECRET: ${CRON_SECRET:?}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      TRUSTED_PROXY_HOPS: ${TRUSTED_PROXY_HOPS:-1}
    ports:
      - "127.0.0.1:${APP_PORT:-3005}:3000"
    depends_on:
      migrate: { condition: service_completed_successfully }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health/db',{headers:{'x-forwarded-for':'127.0.0.1'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging: *default-logging
    restart: unless-stopped

  tools:
    image: ddc-control-tower-tools:${APP_IMAGE_TAG:-local}
    build: *tools-build
    profiles: ["tools"]
    environment:
      DATABASE_URL: *db-url
      DIRECT_URL: *db-url
    depends_on:
      db: { condition: service_healthy }
    logging: *default-logging

volumes:
  pgdata:

secrets:
  extra_ca:
    file: ${EXTRA_CA_FILE:-./docker/extra-ca/empty.pem}
```
Service `backup` thêm ở Task 5.
Tên project compose lấy theo tên thư mục (`ddc_control_tower-b`), nên volume/container không đụng của A/C.

**`.env.docker.example`:**
```
# Copy thanh .env.docker (KHONG commit). Dung: docker compose --env-file .env.docker ...
# Chi dung chu va so (openssl rand -hex 24) vi mat khau nam trong URL ket noi.
POSTGRES_PASSWORD=
PG_MAJOR=16
APP_PORT=3005
APP_IMAGE_TAG=local
# Local: http://localhost:<APP_PORT>. Server: https://<ten-mien>.
NEXTAUTH_URL=http://localhost:3005
# openssl rand -base64 32 (ca 3 bien duoi)
NEXTAUTH_SECRET=
NOTIFY_SECRET_KEY=
CRON_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TRUSTED_PROXY_HOPS=1
# May bi soi SSL: tro toi CA goc (vd D:/_project/DDC_dieu-phoi/tools/win-root-ca.pem). Server that: bo trong.
EXTRA_CA_FILE=./docker/extra-ca/empty.pem
# Backup (Task 5)
BACKUP_DIR=./.backups
BACKUP_KEEP_DAYS=14
```

**`src/server/deploy-files.test.ts`** (đọc file bằng `readFileSync`, đường dẫn từ `path.resolve(__dirname, '../..')`, khuôn như `api-routes-guard.test.ts`), các ca:
- Mọi biến trong `REQUIRED_PROD_ENV` (import từ `@/lib/env-check`) đều có dòng `^NAME=` trong `.env.example`.
- `docker-compose.yml` không chứa `5432:` (không publish cổng DB) và dòng cổng app bắt đầu bằng `"127.0.0.1:`.
- `docker-compose.yml` có đủ các biến `REQUIRED_PROD_ENV` trong khối `app`: kiểm bằng `toContain(\`${name}:\`)` cho từng tên.
- Xoay vòng log (Q3), kiểm bằng văn bản, không thêm thư viện YAML:
  - Khối anchor: file chứa `x-logging: &default-logging`, và đoạn từ dòng đó tới dòng trống kế tiếp chứa `driver: json-file`, `max-size: "10m"`, `max-file: "14"`.
  - Tách phần `services:` (từ dòng `services:` tới dòng top-level kế tiếp khớp `/^\S/`), cắt thành từng service theo dòng khớp `/^  ([a-z][\w-]*):\s*$/`. Có ít nhất 4 service (`db`, `migrate`, `app`, `tools`; sau Task 5 thêm `backup`), và MỖI service đều chứa dòng `logging: *default-logging`. Service mới thêm sau này mà quên khối logging thì test đỏ.
- `next.config.mjs` chứa `standalone`.
- `Dockerfile`, `docker-compose.yml` không chứa ký tự `\r`.

- [ ] **Bước 1:** Viết `deploy-files.test.ts` -> ĐỎ.
- [ ] **Bước 2:** Tạo/sửa đủ file của Task 4. Nếu Git đã checkout file với CRLF thì sau khi thêm `.gitattributes` chạy `git add --renormalize .` trước commit.
- [ ] **Bước 3:** `npx tsc --noEmit`, `npm test` xanh.
- [ ] **Bước 4: Chạy thật** (thiếu Docker thì bỏ qua, ghi "CHƯA CHẠY" vào `.bangiao/thay-doi.md`):
  1. `copy .env.docker.example .env.docker`, điền giá trị sinh ngẫu nhiên, `EXTRA_CA_FILE=D:/_project/DDC_dieu-phoi/tools/win-root-ca.pem`.
  2. `docker compose --env-file .env.docker up -d --build`. Kỳ vọng: `migrate` thoát 0, `app` lên `healthy` trong 2 phút (`docker compose ps`).
  3. `curl http://127.0.0.1:3005/api/health/db` -> 200; `curl -I http://127.0.0.1:3005/vi/login` -> 200, có header CSP Report-Only, KHÔNG có `X-Powered-By`.
  4. Nạp dữ liệu demo CHỈ ở local: `docker compose --env-file .env.docker run --rm tools npx prisma db seed`; đăng nhập bằng tài khoản seed trên trình duyệt, mở Tổng quan và 1 trang Chi tiết dự án, không lỗi.
  5. `docker compose --env-file .env.docker run --rm tools npm run unlock-account -- khong-ton-tai@x.vn` -> in thông báo không tìm thấy, thoát khác 0.
  6. Kiểm dừng khi thiếu env: `docker run --rm -e NODE_ENV=production ddc-control-tower:local` -> thoát mã 1, 1 dòng JSON `event:"env.invalid"` liệt kê 6 biến, không in giá trị nào.
  7. `docker compose --env-file .env.docker stop db`, đợi 60 giây: `/api/health/db` -> 503 `{"status":"error","db":"down"}`, `docker compose logs app` có dòng `health.db_down` dạng JSON; `start db` lại -> 200.
  8. `docker images ddc-control-tower:local` ghi dung lượng ảnh vào `.bangiao/thay-doi.md`.
  9. Với container `app` và `db`: `docker inspect --format "{{json .HostConfig.LogConfig}}" <ten-container>` phải ra `json-file` với `max-size` `10m`, `max-file` `14`.
- [ ] **Bước 5:** Commit `feat(p5b-ht): Dockerfile standalone, docker-compose local (app + PostgreSQL 16 + migrate + tools)`. Bỏ `next.config.mjs` khỏi "Đang giữ" trong `phien-B.md`.

**Trường hợp biên phải xử lý ở Task 4:**
- Không có `.env.docker`/thiếu biến: compose báo lỗi ngay nhờ `:?`, không chạy app với env rỗng.
- Mật khẩu DB có ký tự đặc biệt làm hỏng URL: đã ràng buộc hex trong `.env.docker.example`.
- `prisma generate` trong ảnh phải ra engine Linux (`debian-openssl-3.0.x`); nếu app báo thiếu engine khi chạy thì thêm `binaryTargets` KHÔNG được (đụng `schema.prisma`), phải báo lại planner.
- Build không có mạng tới Google Font: dùng secret `extra_ca`; không tắt kiểm TLS.
- Trang nào trong lúc `next build` truy vấn DB thật (DB giả không kết nối được) thì build đỏ: báo lại, không sửa trang UI.

---

## Task 5: Backup `pg_dump` 1 lần/ngày + thử khôi phục thật

**Files:**
- Create: `scripts/backup/pg-backup.sh`, `scripts/backup/pg-restore-test.sh`
- Modify: `docker-compose.yml` (thêm service `backup`), `src/server/deploy-files.test.ts` (thêm ca)

**Service `backup`** (thêm vào `services:` của `docker-compose.yml`):
```yaml
  backup:
    image: postgres:${PG_MAJOR:-16}-alpine
    profiles: ["tools"]
    environment:
      PGHOST: db
      PGPORT: "5432"
      PGUSER: ddc
      PGPASSWORD: ${POSTGRES_PASSWORD:?}
      PGDATABASE: ddc_control_tower
      BACKUP_DIR: /backups
      BACKUP_KEEP_DAYS: ${BACKUP_KEEP_DAYS:-14}
      TZ: Asia/Ho_Chi_Minh
    volumes:
      - ./scripts/backup:/scripts:ro
      - ${BACKUP_DIR:-./.backups}:/backups
    entrypoint: ["sh"]
    command: ["/scripts/pg-backup.sh"]
    depends_on:
      db: { condition: service_healthy }
    logging: *default-logging
```

**`scripts/backup/pg-backup.sh`** (hành vi bắt buộc, coder viết đủ):
- `#!/bin/sh`, `set -eu`, `umask 077`. Đọc `PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE` (chuẩn libpq, KHÔNG nhận mật khẩu qua đối số), `BACKUP_DIR` (mặc định `/backups`), `BACKUP_KEEP_DAYS` (mặc định 14, phải là số nguyên >= 1, sai thì thoát 2).
- Khoá chạy trùng: `mkdir "$BACKUP_DIR/.lock"` thất bại -> in lỗi, thoát 3. `trap` EXIT luôn xoá `.lock` và file `.partial`.
- Tên file: `${PGDATABASE}_$(date -u +%Y%m%dT%H%M%SZ).dump`. Ghi ra `<tên>.partial` bằng `pg_dump --format=custom --no-owner --no-privileges --file=...`.
- Kiểm file đọc được: `pg_restore --list <partial> > /dev/null`; lỗi -> thoát khác 0, không đổi tên.
- `mv` sang tên cuối, ghi `sha256sum` ra `<tên>.dump.sha256` (định dạng chuẩn của `sha256sum`, chỉ tên file không kèm đường dẫn, để `cd "$BACKUP_DIR" && sha256sum -c` chạy được).
- Chỉ SAU KHI bản mới thành công mới xoá bản cũ: `find "$BACKUP_DIR" -maxdepth 1 -name "${PGDATABASE}_*.dump*" -mtime +"$BACKUP_KEEP_DAYS" -delete`.
- Mỗi bước in 1 dòng JSON ra stdout, ví dụ `{"ts":"...","event":"backup.done","file":"ddc_control_tower_20261001T190000Z.dump","bytes":12345}`; lỗi in `backup.failed` ra stderr. Không bao giờ in `PGPASSWORD` hay URL kết nối.

**`scripts/backup/pg-restore-test.sh`** (hành vi bắt buộc):
- Đối số 1 tuỳ chọn: file `.dump`; không có thì lấy file `${PGDATABASE}_*.dump` mới nhất trong `BACKUP_DIR`; không có file nào -> thoát 2.
- Có file `.sha256` thì `sha256sum -c` phải qua, sai -> thoát 4.
- DB tạm: `RESTORE_DB="${PGDATABASE}_restore_test_$(date -u +%Y%m%d%H%M%S)"`. Bảo vệ: nếu `RESTORE_DB` = `PGDATABASE` hoặc không chứa `_restore_test_` -> thoát 5. `trap` EXIT luôn chạy `dropdb --if-exists --force "$RESTORE_DB"` trừ khi `KEEP_RESTORE_DB=1`. Script KHÔNG BAO GIỜ chạy lệnh ghi/xoá nào trên `PGDATABASE`.
- `createdb "$RESTORE_DB"` rồi `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -d "$RESTORE_DB" <file>`.
- Kiểm (lỗi bất kỳ -> in `restore_test.failed` kèm lý do, thoát 1):
  1. `_prisma_migrations` có >= 1 dòng `finished_at IS NOT NULL AND rolled_back_at IS NULL`, và 0 dòng `finished_at IS NULL AND rolled_back_at IS NULL`.
  2. Số bảng `information_schema.tables` (`table_schema='public' AND table_type='BASE TABLE'`) của DB tạm bằng số dòng `pg_restore --list <file>` khớp `^[0-9]+; [0-9]+ [0-9]+ TABLE public `.
  3. Tổng số dòng mọi bảng public của DB tạm > 0, trừ khi `ALLOW_EMPTY=1`.
- In bảng so sánh số dòng từng bảng: DB tạm và DB nguồn hiện tại (chỉ ĐỌC `SELECT count(*)` trên `PGDATABASE`), dạng `bang  so_dong_tam  so_dong_nguon`. Chỉ để người xem, không dùng làm điều kiện đỏ (DB nguồn có thể đã đổi sau lúc backup).
- Cuối cùng in `{"event":"restore_test.ok","file":"...","tables":N,"rows":M}`.
- Cần quyền `CREATEDB` với `PGUSER` (user `ddc` của compose là superuser; trên server ghi trong T17).

**Thêm vào `deploy-files.test.ts`:** ca xoay vòng log của Task 4 phải tự phủ luôn service `backup` (thêm `'backup'` vào danh sách tên service bắt buộc phải có). Với mỗi file trong `scripts/backup/*.sh`: dòng đầu là `#!/bin/sh`, có `set -eu`, không chứa `\r`, không chứa chuỗi `PGPASSWORD=` (không gán cứng mật khẩu); `pg-restore-test.sh` chứa `_restore_test_` và `dropdb --if-exists --force`.

- [ ] **Bước 1:** Thêm ca vào `deploy-files.test.ts` -> ĐỎ.
- [ ] **Bước 2:** Viết 2 script + service `backup`. `npm test` xanh.
- [ ] **Bước 3: Thử thật trên DB compose** (đã seed ở Task 4):
  1. `docker compose --env-file .env.docker run --rm backup` -> thoát 0, có `.dump` + `.sha256` trong `.backups/`.
  2. Chạy ngay lần 2 song song với lần 1 (2 cửa sổ) -> 1 lần thoát 3 vì khoá.
  3. `docker compose --env-file .env.docker run --rm backup /scripts/pg-restore-test.sh` -> `restore_test.ok`; sau đó `docker compose exec db psql -U ddc -l` không còn DB `_restore_test_`.
  4. Sửa 1 byte trong bản `.dump` sao chép -> restore-test thoát 4.
- [ ] **Bước 4: Thử thật trên DB B thật `ddc_control_tower_b`** (localhost:5433 là PostgreSQL dùng chung A/B/C: CHỈ tạo/xoá DB có `_restore_test_`, không chạm DB nào khác):
  1. `psql` hỏi `SHOW server_version;` trên 5433; đặt `PG_MAJOR` bằng bản chính của server (pg_dump phải cùng hoặc mới hơn server).
  2. Lấy user/mật khẩu từ `DATABASE_URL` trong `.env` của B (không in ra màn hình, không ghi vào file commit). Chạy `docker compose --env-file .env.docker run --rm -e PGHOST=host.docker.internal -e PGPORT=5433 -e PGUSER=<user> -e PGPASSWORD=<mk> -e PGDATABASE=ddc_control_tower_b backup`, rồi cùng các `-e` đó với `/scripts/pg-restore-test.sh`.
  3. User không có quyền `CREATEDB` -> dừng, báo lại, không tự cấp quyền.
  4. Không có Docker: chạy 2 script bằng Git Bash với `pg_dump`/`pg_restore`/`psql` cài sẵn trên máy (cùng biến môi trường), ghi rõ đã chạy cách nào.
- [ ] **Bước 5:** Chép nguyên output của 2 lần restore-test (đã che mật khẩu) vào `.bangiao/thay-doi.md` mục "Bằng chứng khôi phục thật". Commit `feat(p5b-ht): script pg_dump hang ngay va thu khoi phuc ra DB tam`.

---

## Task 6: Cổng kiểm tổng Task 1-5

- [ ] `npx tsc --noEmit`, `npm test` (ghi số test pass), `npm run build` (có CA hoặc mock font) xanh.
- [ ] `npm run test:e2e` trên B (3001 + `ddc_control_tower_b`) xanh, để chắc logger/instrumentation không làm hỏng luồng thật.
- [ ] `docker compose --env-file .env.docker down` (giữ volume). Không commit `.env.docker`, `.backups/`.

---

## Task 7b: Lệnh `npm run create-admin -- <email> [ten]` tạo admin đầu tiên

Dùng khi DB production mới tinh chưa có admin nào (không dùng được `createAccountAction` trong `actions.ts` vì nó bắt `requireRole(['admin'])`).
Khuôn mẫu: `scripts/unlock-account.ts` (phần I/O) + `src/server/unlock-account-cli.ts` (hàm thuần) + `src/server/unlock-account-cli.test.ts` (test hàm thuần bằng kho giả trong bộ nhớ).

**Files:**
- Create: `src/server/create-admin-cli.ts`, `src/server/create-admin-cli.test.ts`, `scripts/create-admin.ts`
- Modify: `package.json` (thêm đúng 1 dòng ngay sau dòng `"unlock-account": ...`, nhớ thêm dấu phẩy cuối dòng `unlock-account`): `"create-admin": "tsx scripts/create-admin.ts"`

**Interfaces (Produces):**

```ts
// src/server/create-admin-cli.ts - thuần, KHÔNG import prisma/repo (để test không cần DB).
import type { UserAccount } from './repo/types';

export const TEMP_PASSWORD_BYTES = 18;          // base64url -> 24 ký tự
export const DEFAULT_ADMIN_NAME = 'Admin';

/** Sinh mật khẩu tạm base64url từ `random(TEMP_PASSWORD_BYTES)`, lặp tới khi `passwordStrength(p) === 3`
 *  (src/lib/password.ts:22), tối đa 20 lần rồi throw Error('temp_password_weak'). */
export function generateTempPassword(random?: (n: number) => Buffer): string;   // mặc định crypto.randomBytes

export type CreateAdminStore = {
  findAccount(email: string): Promise<UserAccount | undefined>;
  createAccount(account: UserAccount): Promise<void>;
};
export type CreateAdminDeps = {
  hash: (plain: string) => Promise<string>;      // script truyền hashPassword (src/lib/password.ts:8)
  genPassword: () => string;                     // script truyền generateTempPassword
  now: () => Date;
  log: (email: string) => Promise<void>;         // ghi activityLog, KHÔNG nhận mật khẩu
};
export async function createAdminCli(
  store: CreateAdminStore,
  rawEmail: string,
  rawName: string | undefined,
  deps: CreateAdminDeps,
): Promise<{ code: 0 | 1 | 2; message: string; tempPassword?: string }>;
```

**Hành vi `createAdminCli`:**
1. `password = deps.genPassword()`. Kiểm đầu vào bằng schema có sẵn `createAccountSchema.safeParse({ email: rawEmail, name: rawName?.trim() || DEFAULT_ADMIN_NAME, role: 'admin', password })` (`src/server/validation.ts:202`, không viết luật email riêng; schema tự trim + hạ chữ thường email). Không qua -> `{ code: 2, message: 'Email khong hop le: "<rawEmail>"' }` (hoặc thông báo lỗi tên nếu lỗi ở trường `name`), không gọi store.
2. `store.findAccount(email)` có kết quả -> `{ code: 1, message: 'Tai khoan da ton tai: <email>. Khong ghi de. Neu bi khoa dung: npm run unlock-account -- <email>' }`, KHÔNG gọi `createAccount`.
3. `createAccount({ email, name, passwordHash: await deps.hash(password), role: 'admin', canViewFinance: true, isActive: true, createdAt: deps.now().toISOString(), lastLoginAt: null, lockedAt: null })`.
   `createAccount` throw lỗi có `code === 'P2002'` (2 lệnh chạy cùng lúc) -> trả như bước 2 (code 1). Lỗi khác -> ném lại.
4. `await deps.log(email)`, trả `{ code: 0, message: 'Da tao admin: <email>', tempPassword: password }`.
5. `message` KHÔNG BAO GIỜ chứa mật khẩu; mật khẩu chỉ nằm ở `tempPassword`.

**`scripts/create-admin.ts`** (giống hệt khuôn `scripts/unlock-account.ts`):
- Import `{ prisma } from '@/server/db'`, `{ repo } from '@/server/repo/prisma-repo'` (object `repo` xuất ở `prisma-repo.ts:1140`, có `findAccount`/`createAccount`). KHÔNG import `@/server/repo` hay lớp tự chọn mock/thật, để lệnh luôn chạy trên DB thật.
- `log(email)` = `prisma.activityLog.create({ data: { userEmail: email, userName: 'server-cli', action: 'create_admin_cli', detail: '', ip: '', userAgent: 'cli' } })`.
- `main()`: `createAdminCli(repo, process.argv[2] ?? '', process.argv[3], { hash: hashPassword, genPassword: () => generateTempPassword(), now: () => new Date(), log })`.
  In `message` bằng `console.log`. Nếu có `tempPassword`: in thêm đúng 1 lần bằng `console.log`:
  `Mat khau tam (chi hien 1 lan, hay chep lai ngay): <tempPassword>` và dòng `Dang nhap roi DOI MAT KHAU NGAY (menu tai khoan > Doi mat khau).`
  Không đưa mật khẩu qua `logger` của Task 1, không ghi file, không ghi vào `activityLog`.
- `await prisma.$disconnect()` TRƯỚC `process.exit(code)`; nhánh `.catch` in `console.error(e instanceof Error ? e.name : String(e))` (không in message, có thể chứa dữ liệu), `$disconnect`, `process.exit(1)`.

- [ ] **Bước 1: Test đỏ `src/server/create-admin-cli.test.ts`** (kho giả trong bộ nhớ: `Map<string, UserAccount>` bọc thành `CreateAdminStore`, KHÔNG mock Prisma), ca:
  - `generateTempPassword()` thật: dài 24, khớp `/^[A-Za-z0-9_-]+$/`, `passwordStrength` = 3; gọi 50 lần không trùng nhau.
  - `generateTempPassword(random)` với `random` luôn trả `Buffer.alloc(n, 0)` (ra toàn chữ `A`) -> throw `temp_password_weak`.
  - `'  Admin@DaiDung.VN '` -> code 0, tài khoản lưu với email `admin@daidung.vn`, `role:'admin'`, `canViewFinance:true`, `isActive:true`, `lockedAt:null`, `lastLoginAt:null`, `name:'Admin'`; `passwordHash` bằng đúng kết quả `deps.hash(tempPassword)` (hash giả `(p) => Promise.resolve('h:' + p)`); `log` gọi đúng 1 lần với email chuẩn hoá; `message` không chứa `tempPassword`.
  - Có tên `'Nguyen Van A'` -> lưu đúng tên.
  - `'khong-phai-email'`, `''` -> code 2, store không bị gọi, `log` không gọi.
  - Email đã có -> code 1, tài khoản cũ giữ nguyên (so `passwordHash` trước/sau), `log` không gọi.
  - `createAccount` throw `Object.assign(new Error('x'), { code: 'P2002' })` -> code 1; throw `new Error('db down')` -> promise reject.
- [ ] **Bước 2:** `npx vitest run src/server/create-admin-cli.test.ts` -> ĐỎ.
- [ ] **Bước 3:** Viết `create-admin-cli.ts`, `scripts/create-admin.ts`, thêm dòng `package.json`. Kiểm `git diff package.json` chỉ có đúng 1 dòng thêm + 1 dấu phẩy; `package-lock.json` không đổi.
- [ ] **Bước 4:** `npx tsc --noEmit`, `npm test` xanh.
- [ ] **Bước 5: Chạy thật trên DB compose** (Docker không có thì chạy `npm run create-admin` trên DB B `ddc_control_tower_b`, email thử `p5b-create-admin-test@example.com`, xong xoá đúng dòng đó bằng trang Quản trị hoặc SQL xoá đúng email đó):
  1. `docker compose --env-file .env.docker build tools` (ảnh tools phải có script mới).
  2. `docker compose --env-file .env.docker run --rm tools npm run create-admin -- admin-moi@example.com` -> thoát 0, in mật khẩu tạm 1 lần.
  3. Đăng nhập trên trình duyệt `http://localhost:3005/vi/login` bằng email + mật khẩu tạm -> vào được trang Tổng quan với quyền admin; đổi mật khẩu thành công.
  4. Chạy lại lệnh bước 2 -> thoát 1, báo đã tồn tại, mật khẩu mới đổi ở bước 3 vẫn đăng nhập được.
  5. `npm run create-admin -- sai-email` -> thoát 2.
  6. `docker compose logs app` và bảng `activity_log` (dòng `create_admin_cli`) không chứa mật khẩu tạm.
- [ ] **Bước 6:** Commit `feat(p5b-ht): lenh create-admin tao admin dau tien tren DB moi`.

---

## Task 7: T17 viết lại `docs/DEPLOY.md` cho server công ty

**Làm sau Task 7b** (mục 7 phải trỏ đúng lệnh thật). Viết theo Docker Compose (Q1 = a).

**Files:**
- Modify (viết lại toàn bộ, bỏ hết nội dung Supabase/Vercel): `docs/DEPLOY.md`
- Modify: `docs/HUONG_DAN_GOOGLE_OAUTH.md` mục 3, chỉ thêm 1 câu: redirect URI domain thật dạng `https://<ten-mien>/api/auth/callback/google`, và dòng local đổi thành cổng thật đang dùng.

**Quy ước viết:** tiếng Việt có dấu, mỗi câu một dòng vật lý, không dấu gạch dài, mọi lệnh để trong khối code chạy được nguyên văn (chỗ phải thay ghi `<ten-mien>`, `<email>`, `<NAS_PATH>`). Giọng văn và cách chia bảng theo `D:\_project\DDC_dieu-phoi\deploy-chuan-bi-lam-viec-voi-IT.md`.

**Mục lục bắt buộc (đủ cả 15 mục):**
1. **Tổng quan:** sơ đồ chữ Nginx (máy chủ, cổng 443) -> `127.0.0.1:3000` container `app` -> container `db` (volume `pgdata`), thư mục backup trên ổ dữ liệu. Nhắc R1: chỉ 1 bản app. Nói rõ: KHÔNG còn thư mục ảnh hiện trường, KHÔNG còn gọi Vietcombank, không còn volume upload.
2. **Chuẩn bị server:** Ubuntu 24.04, múi giờ (`timedatectl set-timezone Asia/Ho_Chi_Minh`, NTP), swap 4 GB, tường lửa theo R9 (`ufw`), cài Docker Engine + compose plugin theo kho chính thức Docker cho Ubuntu, kiểm mạng ra ngoài theo R4 (bỏ `vietcombank.com.vn`).
3. **Lấy code:** `git clone` vào `/opt/ddc-control-tower`, checkout tag/commit phát hành.
4. **Biến môi trường:** bảng mọi biến của `.env.docker.example` (bắt buộc/tuỳ chọn, cách sinh, ví dụ), nói rõ app dừng khi thiếu (log `env.invalid`), cất 3 khoá `NEXTAUTH_SECRET`, `NOTIFY_SECRET_KEY`, `CRON_SECRET` + `POSTGRES_PASSWORD` ngoài máy (R13), `chmod 600 .env.docker`, `EXTRA_CA_FILE` để trống trên server.
5. **Build, migrate, chạy:** `APP_IMAGE_TAG=$(git rev-parse --short HEAD) docker compose --env-file .env.docker up -d --build`; migrate tự chạy qua service `migrate`; kiểm `docker compose ps`, `curl http://127.0.0.1:3000/api/health/db`.
6. **Nginx + HTTPS:** file server block đầy đủ, gồm: chuyển 80 sang 443; chứng chỉ (IT cấp hoặc certbot); `client_max_body_size 12m`, `proxy_read_timeout 120s` (R6); `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` hoặc `$remote_addr` với `TRUSTED_PROXY_HOPS=1`; `proxy_set_header x-middleware-subrequest ""`; HSTS `max-age=31536000 always` + `nosniff always` lặp lại trong từng `location` có `add_header`; không cache HTML/RSC, chỉ cache `/_next/static`; `location /api/csp-report` với `client_max_body_size 32k` + `limit_req`; `limit_req` cho `POST` quên mật khẩu; không thêm header CSP ở proxy. Nguồn: `docs/csp-header-bao-mat.md` mục 3-4. Kiểm sau cùng: `curl -I` cho `/`, `/api/health`, `/_next/static/...` đủ header; `/api/health` trả `clientIpResolved: true`.
7. **Tài khoản admin đầu tiên:** `docker compose --env-file .env.docker run --rm tools npm run create-admin -- <email>` (tuỳ chọn thêm tên sau email). Lệnh in mật khẩu tạm đúng 1 lần, chép lại ngay, đăng nhập rồi đổi mật khẩu ngay. Email đã tồn tại thì lệnh báo lỗi, không ghi đè; admin bị khoá thì dùng mục 14. Các tài khoản còn lại do admin tạo ở trang Quản trị. Cảnh báo in đậm: KHÔNG chạy `prisma db seed` trên production (nó xoá sạch dữ liệu rồi nạp dữ liệu giả).
8. **Google OAuth cho domain thật:** tạo OAuth Client theo `docs/HUONG_DAN_GOOGLE_OAUTH.md`, redirect URI `https://<ten-mien>/api/auth/callback/google`, điền `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` đủ cả hai, admin thêm email trước khi người dùng đăng nhập.
9. **SMTP bắt buộc:** cấu hình kênh email ở trang Quản trị > Thông báo (quên mật khẩu dùng kênh email hợp lệ đầu tiên, kể cả khi kênh tắt gửi cảnh báo); thử bằng chức năng quên mật khẩu với 1 tài khoản thật; lỗi gửi xem log `auth_mail.send_failed`.
10. **Cron:** chỉ còn `alerts_daily` lúc 06:00 (`curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<ten-mien>/api/cron/alerts_daily`, đọc secret từ file quyền 600, không ghi thẳng vào crontab) + dòng backup lúc 02:00 mỗi ngày: `0 2 * * * cd /opt/ddc-control-tower && docker compose --env-file .env.docker run --rm backup >> /var/log/ddc-backup.log 2>&1` (server đã đặt múi giờ Asia/Ho_Chi_Minh ở mục 2 nên 02:00 là giờ Việt Nam); dòng 06:00 viết cùng khuôn `cd ... &&`. Ghi rõ app vẫn tự chạy `alerts_daily` "lười" khi có người mở app (`src/server/jobs.ts`), cron là để chắc chắn đúng giờ.
11. **Backup và khôi phục:** lệnh backup chạy tự động lúc 02:00 mỗi ngày qua cron ở mục 10 (`docker compose --env-file .env.docker run --rm backup`, chạy tay được bất cứ lúc nào), `/var/log/ddc-backup.log` cần `logrotate` (khối `weekly`, `rotate 8`, `compress`, `missingok`, file `/etc/logrotate.d/ddc-backup`), `BACKUP_DIR` trỏ ổ dữ liệu, giữ 14 ngày, chép sang NAS (`rsync -a --delete-after` tới `<NAS_PATH>` do IT cấp), thử khôi phục mỗi tháng bằng `pg-restore-test.sh` (lý tưởng trên staging), quy trình khôi phục khi sự cố từng lệnh: dừng `app`, backup bản hiện tại, `dropdb --force` + `createdb` + `pg_restore --no-owner --no-privileges --exit-on-error`, bật lại `app`, kiểm `/api/health/db`. Nhắc: khôi phục DB xong vẫn cần đúng `NOTIFY_SECRET_KEY` cũ, không thì phải nhập lại bí mật thông báo.
12. **Cập nhật phiên bản:** thông báo trước (R12), backup trước khi migrate, `git fetch && git checkout <tag>`, build với `APP_IMAGE_TAG` mới, `up -d`, kiểm health.
13. **Rollback:** chưa có migration mới thì `APP_IMAGE_TAG=<tag-cu> docker compose --env-file .env.docker up -d --no-build`; bản mới đã chạy migration thì phải khôi phục DB từ bản backup ngay trước lúc cập nhật rồi mới chạy ảnh cũ (migration chỉ tiến, không lùi). Giữ ít nhất 2 ảnh gần nhất (`docker image prune` không xoá ảnh có tag).
14. **Mở khoá tài khoản:** `docker compose --env-file .env.docker run --rm tools npm run unlock-account -- <email>`, dùng khi chính admin bị khoá sau 5 lần sai.
15. **Theo dõi sau deploy:** `docker compose logs -f app` (log JSON, lọc bằng `jq 'select(.level=="error")'`); danh sách event cần để ý: `env.invalid`, `request.unhandled`, `health.db_down`, `auth_mail.send_failed`, `notify.*`, `jobs.*`, `alert_engine.failed`, `client_ip.unresolved`, `csp_report.violation`; IT giám sát `https://<ten-mien>/api/health/db` mỗi phút (200 = ổn, 503 = mất DB), ổ đĩa 80%; log của MỌI container (app, db, migrate, tools, backup) xoay vòng TỰ ĐỘNG bởi Docker (`json-file`, 10 MB x 14 file mỗi container, tối đa khoảng 140 MB/container), KHÔNG cần cron dọn log tay, chỉ log backup ở mục 11 dùng `logrotate`; kiểm cấu hình bằng `docker inspect --format "{{json .HostConfig.LogConfig}}" <container>`; checklist 1-2 tuần đầu (đăng nhập 3 vai trò, nhập liệu, import Excel, email quên mật khẩu, cảnh báo 06:00 có chạy, backup có file mới mỗi ngày).
Phụ lục A: chạy compose trên máy dev Windows (`EXTRA_CA_FILE`, cổng 3005, seed dữ liệu demo chỉ ở local).

- [ ] **Bước 1:** Viết `docs/DEPLOY.md` theo đủ 15 mục + phụ lục.
- [ ] **Bước 2:** Tự rà: mọi tên biến, tên service, tên script, đường dẫn trong tài liệu khớp đúng file đã tạo ở Task 2-5 (grep từng tên); không còn chữ Supabase, Vercel, Vietcombank, `data/uploads`; không có dấu gạch dài (`grep -n "[\u2013\u2014]"` ra rỗng).
- [ ] **Bước 3:** Commit `docs(p5b-ht): T17 viet lai DEPLOY.md cho server cong ty (Docker Compose)`.

---

## Ngoài phạm vi (không làm trong nhánh này)

- Pentest thật, chuyển CSP sang enforce (chờ P4/P4-X của C).
- Gửi lỗi ra dịch vụ ngoài (Q3 đã chốt chỉ log JSON), sửa tài liệu IT `deploy-chuan-bi-lam-viec-voi-IT.md` (Q5, điều phối viên xử lý riêng sau merge).
- Tính năng bắt đổi mật khẩu ở lần đăng nhập đầu (create-admin chỉ nhắc bằng chữ).
- Đổi cách Prisma tự log, thêm `binaryTargets`, mọi sửa đổi `schema.prisma`, mọi trang/component UI.
- Cập nhật `phien-B.md`/`lo-trinh.md` sau commit và việc archive `.bangiao/` trước merge: do điều phối viên làm theo CLAUDE.md, coder không làm.
