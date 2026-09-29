# P5-B mục 6-7 (phần không phụ thuộc P4): load test, checklist qa-gate, bản nháp CSP Report-Only - Kế hoạch triển khai

> Dành cho agent thực thi: làm lần lượt từng Task, mỗi bước có ô `- [ ]` để đánh dấu.
> Planner đã dùng skill `ddc-tower:writing-plans`; tra tài liệu Next.js 15 (CSP + nonce qua middleware) bằng context7.

**Mục tiêu:** có script load test chạy tải đồng thời thật trên `next start -p 3001`, tài liệu checklist qa-gate trước go-live, và bản nháp CSP + header bảo mật ở chế độ Report-Only (không chặn gì) kèm endpoint nhận báo cáo vi phạm.

**Kiến trúc:** Header bảo mật và CSP gắn trong `middleware.ts` (nonce mới mỗi request, truyền vào render qua header request `content-security-policy-report-only`).
Header áp cho mọi đường dẫn và file tĩnh (HSTS, nosniff cho `/api` và `_next`) để reverse proxy của C làm, ghi trong tài liệu.
Load test là script `tsx` dùng `fetch` có sẵn của Node, logic thuần (thống kê, tham số, chọn kịch bản) nằm ở `src/lib/` để unit test bằng Vitest.

**Tech stack:** Next.js 15.5 app router, React 19, next-intl 4, next-auth 4 (JWT), Prisma 6, Vitest 2, Playwright, tsx.

**Nguồn yêu cầu:** `D:\_project\DDC_dieu-phoi\lenh-cho-B-2026-09-28.md` PHẦN 3; lệnh điều phối viên giao cho planner phiên này.

---

## CÂU HỎI ĐÃ CHỐT (chủ dự án trả lời 2026-09-29)

- **Q1 = (c):** mặc định load test là 100 người dùng ảo cùng lúc trong 5 phút (thử sức chịu). Tiêu chí đạt: trang p95 <= 3 giây, p99 <= 5 giây, xuất Excel p95 <= 8 giây, tỷ lệ lỗi < 1%. Script vẫn nhận tham số để chạy mức 30/50 làm mốc so sánh; báo cáo ghi rõ mức nào bắt đầu vượt tiêu chí. Mọi chỗ bên dưới ghi "Q1 phương án a" hay "chờ Q1" thì hiểu là theo Q1 = (c) này.
- **Q2 = (a):** không cho nhúng iframe: `X-Frame-Options: DENY`, bản cuối thêm `frame-ancestors 'none'`.

Nội dung câu hỏi gốc giữ lại bên dưới để tham khảo.

**Q1. Tải mục tiêu và tiêu chí đạt của load test.**
Tài liệu làm việc với IT ghi "vài chục tới vài trăm người dùng", số người dùng cùng lúc còn để trống.
- (a) ĐỀ XUẤT: 30 người dùng ảo cùng lúc trong 5 phút, mỗi người nghỉ 1-3 giây giữa 2 thao tác; đạt khi trang p95 <= 1,5 giây (khớp tiêu chí T1 cũ), p99 <= 3 giây, xuất Excel p95 <= 5 giây, tỷ lệ lỗi < 1%.
- (b) 50 người dùng cùng lúc, cùng tiêu chí.
- (c) 100 người dùng cùng lúc, chấp nhận p95 <= 3 giây (coi như thử sức chịu).
Máy dev chạy cả DB lẫn app nên số đo chỉ là mốc so sánh; số trên server thật đo lại ở P6.

**Q2. Có cần cho phép nhúng app vào trang khác (iframe, ví dụ cổng nội bộ, SharePoint) không?**
- (a) ĐỀ XUẤT: không cho nhúng, gửi `X-Frame-Options: DENY` ngay từ bản nháp này (chống lừa bấm chuột qua khung ẩn).
- (b) Cho nhúng từ một số tên miền công ty: cần danh sách tên miền, bản nháp sẽ bỏ `X-Frame-Options` và dùng `frame-ancestors <danh sách>` ở bản cuối.

---

## Quyết định kỹ thuật đã tự chọn (kèm lý do)

1. **CSP đặt ở `middleware.ts`, không ở `next.config.mjs`.** Nonce phải sinh mới cho từng request, `headers()` trong `next.config` chỉ cho chuỗi cố định; `next.config.mjs` còn là file dùng chung với C (`output: 'standalone'`). Phase này KHÔNG sửa `next.config.mjs`.
2. **Dùng nonce + `'strict-dynamic'` cho `script-src`.** Next 15 tự đọc nonce từ header request `content-security-policy` hoặc `content-security-policy-report-only` (`node_modules/next/dist/server/app-render/app-render.js:572`) và gắn vào mọi thẻ script của nó. Hệ quả: layout gốc đọc `headers()` nên mọi trang thành render động (trang cần phiên vốn đã động; chỉ các trang đăng nhập/quên mật khẩu đổi từ tĩnh sang động). Load test chạy SAU khi có CSP để đo đúng chi phí này.
3. **`style-src 'self' 'unsafe-inline'`, KHÔNG gắn nonce vào `style-src`.** App dùng thuộc tính `style={...}` khắp nơi, Recharts cũng vậy. Khi `style-src` có nonce thì trình duyệt bỏ qua `'unsafe-inline'` và sẽ báo vi phạm mọi thuộc tính style.
4. **Report-Only không chứa `frame-ancestors` và `upgrade-insecure-requests`.** Hai chỉ thị này bị trình duyệt bỏ qua trong Report-Only và in cảnh báo ra console mỗi trang. Chống nhúng khung đã có `X-Frame-Options`; hai chỉ thị này thêm vào bản cuối (enforce).
5. **Header ngoài CSP (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) được áp thật ngay (không phải report-only)** cho các trang đi qua middleware. Rủi ro thấp: app không dùng camera, micro, vị trí, thanh toán, USB, không bị nhúng khung.
6. **HSTS KHÔNG đặt ở Next, đặt ở reverse proxy của C** (nơi kết thúc HTTPS). Next sau proxy không biết chắc kết nối gốc có phải HTTPS không. Tương tự `X-Content-Type-Options` cho `/api/*` và `/_next/*` (middleware không chạy ở đó) và ẩn `X-Powered-By`.
7. **Endpoint `/api/csp-report` chỉ ghi `console.warn`, không ghi DB.** Endpoint công khai, ghi DB sẽ mở đường làm phình bảng. Giới hạn tần suất in-memory theo IP và toàn cục, giới hạn kích thước body, chỉ ghi các trường đã lọc, bỏ query string (trang đặt lại mật khẩu có token trong URL).
8. **`Reporting-Endpoints` và `report-uri` dùng đường dẫn tương đối `/api/csp-report`.** Tránh dựng URL tuyệt đối từ `Host` (sau proxy có thể sai). Chrome ưu tiên `report-to`, Firefox dùng `report-uri`.
9. **Load test giữ phiên thay vì đăng nhập lặp.** Mỗi người dùng ảo đăng nhập ĐÚNG 1 lần, tuần tự từng người (không song song), rồi dùng lại cookie. Lý do: `reserveAccountGuess` (`src/server/login-guard.ts:143`) từ chối khi số lượt đăng nhập ĐANG chạy đồng thời của 1 tài khoản chạm 5, kể cả khi mật khẩu đúng; giới hạn IP (`IP_FAIL_LIMIT` = 20/15 phút) chỉ đếm lần sai. Lần đăng nhập đầu tiên sai là dừng cả lượt chạy ngay, không thử lại, nên không bao giờ tự khoá tài khoản.
10. **Load test gửi `X-Forwarded-For` riêng cho từng người dùng ảo (mặc định, tắt bằng `--xff=none`).** Trên localhost không có proxy, mọi request rơi vào khoá `'unknown'`, giới hạn `/api/export` 30/phút/IP và `/api/health` 120/phút/IP sẽ bắn 429 giả. `clientIpFrom` (`src/lib/client-ip.ts`) lấy phần tử cuối của XFF (TRUSTED_PROXY_HOPS=1), nên mỗi người dùng ảo được đếm như một IP riêng, đúng như sau reverse proxy thật.
11. **Không thêm dependency.** Load test dùng `fetch` + `tsx` + `zod` (đã có).

---

## Global Constraints

- Tài khoản B, thư mục `D:\_project\DDC_Control_Tower-B`, nhánh `feature/p5-b-bao-mat-qa`, DB `ddc_control_tower_b`, cổng 3001. Không sửa file ở thư mục khác.
- KHÔNG sửa file nóng: `prisma/schema.prisma`, `prisma/migrations/`, `app/globals.css`, `src/i18n/messages/vi.json`, `en.json`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `src/server/queries.ts`, `src/server/project-queries.ts`. Không sửa `next.config.mjs`.
- Không sửa `PROGRESS.md`, `.serena/memories/`. Không thêm dependency vào `package.json` (chỉ thêm 1 dòng script `perf:load`).
- Không dùng dấu gạch dài (em dash, en dash) ở bất kỳ đâu: code, comment, tài liệu, commit.
- Tài liệu Markdown viết mới: tiếng Việt có dấu, mỗi câu một dòng vật lý.
- Comment trong `src/lib/*.ts`, `middleware.ts`, `app/**`: tiếng Việt có dấu (theo `src/lib/perf-guard.ts`). Script trong `scripts/perf/*.ts` và chuỗi log/console: không dấu (theo `scripts/perf/measure-pages.ts`). Tên test: không dấu (theo `src/lib/perf-guard.test.ts`).
- Commit message tiếng Việt không dấu, dạng `feat(p5b): ...`, `test(p5b): ...`, `docs(p5b): ...` (theo `git log`), giữ dòng `Co-Authored-By` của agent.
- Sau mỗi commit điều phối viên cập nhật `D:\_project\DDC_dieu-phoi\phien-B.md` (coder không cần làm).
- Unit test phải nằm trong `src/**/*.test.ts` (vitest chỉ quét `src/**/*.test.ts` và `e2e/**/*.test.ts`, xem `vitest.config.ts`). Playwright spec đặt tên `e2e/NN-ten.spec.ts`.
- Cổng kiểm cuối mỗi Task: `npx tsc --noEmit` sạch và `npm test` xanh (mốc hiện tại trên `main` @ `2171d61`: khoảng 2700 test xanh + 15 skip).
- Mật khẩu không bao giờ ghi vào file trong repo, không in ra log.

---

## Sơ đồ file

| File | Tạo/Sửa | Trách nhiệm |
|---|---|---|
| `src/lib/load-stats.ts` | Tạo | percentile, tóm tắt mẫu, so tiêu chí |
| `src/lib/load-stats.test.ts` | Tạo | unit test thống kê |
| `src/lib/load-test.ts` | Tạo | tham số CLI, PRNG, chọn kịch bản theo trọng số, XFF theo VU, phân loại phản hồi, đọc file tài khoản, chặn file tài khoản nằm trong repo |
| `src/lib/load-test.test.ts` | Tạo | unit test các hàm trên |
| `src/lib/perf-http.ts` | Tạo | gom cookie từ Set-Cookie, dựng header Cookie (tách từ `measure-pages.ts`) |
| `src/lib/perf-http.test.ts` | Tạo | unit test cookie jar |
| `scripts/perf/http-session.ts` | Tạo | hàm `login()` dùng chung cho `measure-pages.ts` và `load-test.ts` |
| `scripts/perf/measure-pages.ts` | Sửa | dùng `perf-http.ts` + `http-session.ts`, hành vi giữ nguyên |
| `scripts/perf/load-test.ts` | Tạo | script chạy tải |
| `package.json` | Sửa | thêm script `perf:load` |
| `docs/load-test.md` | Tạo | kế hoạch load test: kịch bản, tiêu chí, cách chạy, kết quả |
| `src/lib/security-headers.ts` | Tạo | sinh nonce, dựng CSP, bộ header, gắn header, dựng request mang CSP |
| `src/lib/security-headers.test.ts` | Tạo | unit test |
| `src/lib/csp-report.ts` | Tạo | đọc body có trần, phân tích và lọc báo cáo vi phạm |
| `src/lib/csp-report.test.ts` | Tạo | unit test |
| `app/api/csp-report/route.ts` | Tạo | endpoint nhận báo cáo |
| `src/server/csp-report-route.test.ts` | Tạo | unit test route (giới hạn tần suất, 413, 415, 204) |
| `src/server/api-routes-guard.test.ts` | Sửa | đăng ký route mới, kiểu chặn `public-report` |
| `middleware.ts` | Sửa | gắn nonce + header trên MỌI response trả ra |
| `src/server/middleware-csp.test.ts` | Tạo | unit test middleware + CSP |
| `app/[locale]/layout.tsx` | Sửa | gắn `nonce` cho script chọn giao diện sáng/tối |
| `e2e/26-header-bao-mat.spec.ts` | Tạo | e2e kiểm header có mặt, nonce khớp HTML, endpoint báo cáo |
| `e2e/27-csp-vi-pham.spec.ts` | Tạo | e2e thu danh sách vi phạm CSP trên trình duyệt thật |
| `docs/csp-header-bao-mat.md` | Tạo | bản nháp chính sách, header nào đặt ở đâu, việc bàn giao cho C, việc xem lại khi P4-X vào |
| `docs/qa-gate-truoc-go-live.md` | Tạo | checklist qa-gate |

Thứ tự làm: Task 1 -> 2 -> 3 (load test), Task 4 -> 5 -> 6 -> 7 (CSP), Task 8 (tài liệu CSP + qa-gate).
Tester chạy load test thật SAU Task 7 (để đo cả chi phí render động do nonce).

---

### Task 1: Thư viện thống kê load test

**Files:**
- Create: `src/lib/load-stats.ts`
- Test: `src/lib/load-stats.test.ts`

**Interfaces (Produces):**

```ts
export type LoadErrorKind = 'status' | 'redirect' | 'timeout' | 'network' | 'rate_limited';

export interface LoadSample {
  scenario: string;          // tên kịch bản, vd 'overview_month'
  group: 'page' | 'api';
  ms: number;                // thời gian tới khi đọc xong body
  status: number;            // 0 nếu timeout/lỗi mạng
  errorKind: LoadErrorKind | null; // null = thành công
}

export interface LatencyStats {
  count: number;             // tổng số mẫu (cả lỗi)
  errors: number;            // số mẫu errorKind !== null
  errorRate: number;         // errors / count; count = 0 -> 0
  p50: number | null;        // chỉ tính trên mẫu thành công; không có mẫu thành công -> null
  p95: number | null;
  p99: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  rps: number;               // count / (wallMs / 1000); wallMs <= 0 -> 0
}

export interface LoadCriteria { maxErrorRate: number; pageP95Ms: number; pageP99Ms: number; exportP95Ms: number }
export const DEFAULT_LOAD_CRITERIA: LoadCriteria; // { maxErrorRate: 0.01, pageP95Ms: 1500, pageP99Ms: 3000, exportP95Ms: 5000 }

export function percentile(values: readonly number[], p: number): number | null;
export function summarize(samples: readonly LoadSample[], wallMs: number): LatencyStats;
export function summarizeBy(samples: readonly LoadSample[], wallMs: number, key: (s: LoadSample) => string): Record<string, LatencyStats>;
export function evaluateCriteria(
  input: { overall: LatencyStats; pages: LatencyStats; exportStats: LatencyStats | null },
  c: LoadCriteria,
): { pass: boolean; failures: string[] };
```

Luật bắt buộc:
- `percentile` theo phương pháp nearest-rank: sắp xếp tăng dần bằng so sánh SỐ (`(a, b) => a - b`, không dùng sort mặc định theo chuỗi), `rank = Math.ceil((p / 100) * n)`, trả `sorted[rank - 1]`.
- `percentile`: mảng rỗng -> `null`; `p` không nằm trong `(0, 100]` hoặc không phải số hữu hạn -> ném `RangeError`; có phần tử không hữu hạn (`NaN`, `Infinity`) -> ném `RangeError`; KHÔNG được sửa mảng đầu vào.
- `evaluateCriteria` trả `failures` là câu không dấu dễ đọc, ví dụ `page p95 1620ms > 1500ms`. Các lỗi cần bắt:
  - `overall.count === 0` -> `khong co mau nao`.
  - `overall.errorRate > c.maxErrorRate` -> `ty le loi 2.10% > 1.00%`.
  - `pages.p95 === null` -> `page khong co mau thanh cong`; `pages.p95 > c.pageP95Ms`; `pages.p99 > c.pageP99Ms`.
  - `exportStats !== null && exportStats.count > 0`: `exportStats.p95 === null` hoặc `> c.exportP95Ms` là lỗi. `exportStats === null` hoặc `count === 0` thì bỏ qua tiêu chí xuất Excel.
- `pass = failures.length === 0`.

- [ ] **Bước 1: Viết test đỏ** `src/lib/load-stats.test.ts` với tối thiểu các ca:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOAD_CRITERIA, evaluateCriteria, percentile, summarize, summarizeBy, type LoadSample } from './load-stats';

const ok = (ms: number, scenario = 'a', group: 'page' | 'api' = 'page'): LoadSample => ({ scenario, group, ms, status: 200, errorKind: null });
const bad = (scenario = 'a'): LoadSample => ({ scenario, group: 'page', ms: 5, status: 500, errorKind: 'status' });

describe('percentile (nearest-rank)', () => {
  it('[15,20,35,40,50]: p40=20, p50=35, p100=50', () => {
    const v = [15, 20, 35, 40, 50];
    expect(percentile(v, 40)).toBe(20);
    expect(percentile(v, 50)).toBe(35);
    expect(percentile(v, 100)).toBe(50);
  });
  it('1..100: p1=1, p95=95, p99=99', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 1)).toBe(1);
    expect(percentile(v, 95)).toBe(95);
    expect(percentile(v, 99)).toBe(99);
  });
  it('sap xep theo so, khong theo chuoi: [10, 9, 100] p34=10, p100=100', () => {
    expect(percentile([10, 9, 100], 34)).toBe(10);
    expect(percentile([10, 9, 100], 100)).toBe(100);
  });
  it('1 phan tu -> moi p deu tra phan tu do', () => {
    expect(percentile([7], 1)).toBe(7);
    expect(percentile([7], 99)).toBe(7);
  });
  it('mang rong -> null', () => expect(percentile([], 95)).toBeNull());
  it('khong sua mang dau vao', () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });
  it.each([0, -1, 101, Number.NaN])('p=%s -> RangeError', (p) => {
    expect(() => percentile([1, 2], p)).toThrow(RangeError);
  });
  it('co NaN trong mang -> RangeError', () => expect(() => percentile([1, Number.NaN], 50)).toThrow(RangeError));
});

describe('summarize', () => {
  it('tinh loi tren tong, percentile chi tren mau thanh cong, rps theo wall', () => {
    const s = summarize([ok(100), ok(200), ok(300), bad()], 2000);
    expect(s.count).toBe(4);
    expect(s.errors).toBe(1);
    expect(s.errorRate).toBe(0.25);
    expect(s.p50).toBe(200);
    expect(s.min).toBe(100);
    expect(s.max).toBe(300);
    expect(s.mean).toBe(200);
    expect(s.rps).toBe(2);
  });
  it('khong co mau -> count 0, errorRate 0, p null, rps 0', () => {
    const s = summarize([], 1000);
    expect(s).toMatchObject({ count: 0, errors: 0, errorRate: 0, p50: null, p95: null, p99: null, rps: 0 });
  });
  it('toan loi -> p null', () => expect(summarize([bad(), bad()], 1000).p95).toBeNull());
  it('wallMs <= 0 -> rps 0', () => expect(summarize([ok(1)], 0).rps).toBe(0));
});

describe('summarizeBy', () => {
  it('nhom theo scenario', () => {
    const r = summarizeBy([ok(1, 'x'), ok(2, 'y'), ok(3, 'y')], 1000, (s) => s.scenario);
    expect(Object.keys(r).sort()).toEqual(['x', 'y']);
    expect(r.y.count).toBe(2);
  });
});

describe('evaluateCriteria', () => {
  const good = summarize([ok(100), ok(200)], 1000);
  it('dat het -> pass', () => {
    expect(evaluateCriteria({ overall: good, pages: good, exportStats: null }, DEFAULT_LOAD_CRITERIA)).toEqual({ pass: true, failures: [] });
  });
  it('khong co mau -> fail', () => {
    const empty = summarize([], 1000);
    expect(evaluateCriteria({ overall: empty, pages: empty, exportStats: null }, DEFAULT_LOAD_CRITERIA).pass).toBe(false);
  });
  it('ty le loi vuot -> fail', () => {
    const s = summarize([ok(1), bad()], 1000);
    const r = evaluateCriteria({ overall: s, pages: s, exportStats: null }, DEFAULT_LOAD_CRITERIA);
    expect(r.pass).toBe(false);
    expect(r.failures.join(' ')).toMatch(/ty le loi/);
  });
  it('page p95 vuot -> fail', () => {
    const slow = summarize([ok(2000)], 1000);
    expect(evaluateCriteria({ overall: slow, pages: slow, exportStats: null }, DEFAULT_LOAD_CRITERIA).failures.join(' ')).toMatch(/page p95/);
  });
  it('export p95 vuot -> fail; export count 0 -> bo qua', () => {
    const slowExport = summarize([ok(6000, 'api_export', 'api')], 1000);
    expect(evaluateCriteria({ overall: good, pages: good, exportStats: slowExport }, DEFAULT_LOAD_CRITERIA).pass).toBe(false);
    expect(evaluateCriteria({ overall: good, pages: good, exportStats: summarize([], 1000) }, DEFAULT_LOAD_CRITERIA).pass).toBe(true);
  });
});
```

- [ ] **Bước 2:** `npx vitest run src/lib/load-stats.test.ts` phải ĐỎ (chưa có module).
- [ ] **Bước 3:** Viết `src/lib/load-stats.ts` đúng interface và luật ở trên. `mean` = tổng ms mẫu thành công / số mẫu thành công.
- [ ] **Bước 4:** Chạy lại test phải XANH; `npx tsc --noEmit` sạch.
- [ ] **Bước 5:** Commit `feat(p5b): thu vien thong ke load test (percentile, tieu chi)`.

---

### Task 2: Tham số, kịch bản, cookie jar, đăng nhập dùng chung

**Files:**
- Create: `src/lib/load-test.ts`, `src/lib/load-test.test.ts`
- Create: `src/lib/perf-http.ts`, `src/lib/perf-http.test.ts`
- Create: `scripts/perf/http-session.ts`
- Modify: `scripts/perf/measure-pages.ts` (xoá `mergeCookies`, `cookieHeader`, `login` cục bộ ở dòng 28-66, import bản dùng chung; mọi hành vi và chuỗi log còn lại giữ nguyên)

**Interfaces:**
- Consumes: `LoadCriteria`, `DEFAULT_LOAD_CRITERIA`, `LoadErrorKind` từ Task 1.
- Produces:

```ts
// src/lib/perf-http.ts
export type CookieJar = Map<string, string>;
/** Đọc mọi Set-Cookie (ưu tiên headers.getSetCookie()), chỉ giữ name=value; value rỗng thì xoá cookie khỏi jar. */
export function mergeCookies(jar: CookieJar, headers: Headers): void;
export function cookieHeader(jar: CookieJar): string;       // 'a=1; b=2'
export function hasSessionCookie(jar: CookieJar): boolean;  // có 'next-auth.session-token' hoặc '__Secure-next-auth.session-token'

// scripts/perf/http-session.ts
export async function login(opts: {
  base: string; email: string; password: string;
  headers?: Record<string, string>; // vd { 'X-Forwarded-For': '10.77.0.1' }
  tag: string;                      // tiền tố log, vd '[measure-pages]'
}): Promise<CookieJar>;
// Luồng giống hệt measure-pages.ts:45-66 hiện tại: GET /api/auth/csrf -> POST /api/auth/callback/credentials
// (x-www-form-urlencoded, json: 'true', redirect: 'manual'); không có cookie phiên -> throw Error(`${tag} Dang nhap that bai (status N) cho <email>`).
// Mọi request trong login() đều gửi opts.headers. Không in mật khẩu.

// src/lib/load-test.ts
export type LoadRole = 'admin' | 'bod' | 'viewer';
export type Expect = 'html' | 'xlsx' | 'json';
export interface Scenario {
  name: string; group: 'page' | 'api'; weight: number; roles: readonly LoadRole[]; expect: Expect;
  path: (ctx: { projectId: number; month: string }) => string;
}
export const DEFAULT_SCENARIOS: readonly Scenario[];
export interface LoadOptions {
  vus: number; durationSec: number; rampSec: number; thinkMinMs: number; thinkMaxMs: number;
  timeoutMs: number; seed: number; xff: 'per-vu' | 'none'; out: string | null; criteria: LoadCriteria;
}
export function parseLoadArgs(argv: readonly string[]): LoadOptions;
export function mulberry32(seed: number): () => number;          // PRNG xác định, trả [0, 1)
export function pickWeighted<T extends { weight: number }>(items: readonly T[], r: number): T;
export function scenariosForRole(all: readonly Scenario[], role: LoadRole): Scenario[];
export function vuForwardedFor(index: number): string;
export function classifyResponse(status: number, contentType: string | null, expect: Expect): LoadErrorKind | null;
export interface LoadCredential { email: string; password: string }
export function parseCredentials(json: string): LoadCredential[];
export function assertOutsideRepo(filePath: string, repoRoot: string): void;
export function toLoadRole(role: string): LoadRole | null;       // 'admin'|'bod'|'viewer' -> giữ; khác (vd 'data-entry') -> null
```

`DEFAULT_SCENARIOS` chính xác (tổng trọng số 100; `ALL` = `['admin','bod','viewer']`):

| name | group | weight | roles | expect | path |
|---|---|---|---|---|---|
| `overview_month` | page | 25 | ALL | html | `/vi/overview?month=${month}` |
| `overview_all` | page | 10 | ALL | html | `/vi/overview?month=all` |
| `projects_list` | page | 15 | ALL | html | `/vi/projects` |
| `project_detail` | page | 30 | ALL | html | `/vi/projects/${projectId}` |
| `alerts` | page | 5 | ALL | html | `/vi/alerts` |
| `report` | page | 5 | ALL | html | `/vi/report` |
| `api_export` | api | 3 | `['admin','bod']` | xlsx | `/api/export?month=${month}` |
| `api_health` | api | 7 | ALL | json | `/api/health` |

Luật `parseLoadArgs` (khác `parsePerfArgs`: cờ lạ thì ném lỗi, không bỏ qua):
- Mặc định: `vus 30, durationSec 300, rampSec 30, thinkMinMs 1000, thinkMaxMs 3000, timeoutMs 30000, seed 1, xff 'per-vu', out null, criteria DEFAULT_LOAD_CRITERIA`.
- Cờ: `--vus=N` (nguyên 1..200), `--duration=S` (nguyên >= 10), `--ramp=S` (nguyên >= 0 và <= duration), `--think-min=MS`, `--think-max=MS` (nguyên >= 0, min <= max), `--timeout=MS` (nguyên >= 1000), `--seed=N` (nguyên >= 0), `--xff=per-vu|none`, `--out=<đường dẫn>`, `--max-error-rate=X` (số thực 0..1), `--page-p95=MS`, `--page-p99=MS`, `--export-p95=MS` (nguyên dương).
- Sai kiểu, ngoài khoảng, cờ không có `=`, cờ lạ -> `throw new Error('<co> ...')` câu không dấu nêu rõ cờ và giá trị nhận được.

Luật khác:
- `pickWeighted`: `items` rỗng hoặc tổng trọng số <= 0 -> ném `Error`; `r` ngoài `[0, 1)` -> ném `RangeError`; duyệt cộng dồn, trả phần tử đầu tiên có `r * total < cộng dồn`.
- `mulberry32`: cài đặt chuẩn mulberry32 (32-bit), cùng seed cho cùng dãy.
- `vuForwardedFor(i)`: `10.77.${Math.floor(i / 250)}.${(i % 250) + 1}`; `i` không nguyên hoặc `< 0` hoặc `>= 250 * 256` -> `RangeError`.
- `classifyResponse`: `429` -> `'rate_limited'`; `300..399` -> `'redirect'`; khác `200` -> `'status'`; `200` mà content-type không khớp (`html`: chứa `text/html`; `xlsx`: chứa `spreadsheetml`; `json`: chứa `application/json`; `null` coi như không khớp) -> `'status'`; còn lại `null`.
- `parseCredentials`: dùng `zod` (`z.array(z.object({ email: z.string().email(), password: z.string().min(1) })).min(1)`); JSON hỏng hoặc sai dạng -> ném `Error('LOAD_CREDENTIALS_FILE sai dinh dang ...')` KHÔNG chứa mật khẩu; email hạ chữ thường + trim; email trùng -> ném lỗi.
- `assertOutsideRepo`: `path.relative(path.resolve(repoRoot), path.resolve(filePath))`; nếu kết quả rỗng, hoặc không bắt đầu bằng `..` và không phải đường dẫn tuyệt đối (khác ổ đĩa trên Windows) -> ném `Error('LOAD_CREDENTIALS_FILE nam trong repo - dat file o ngoai repo de khong lo commit mat khau')`. So sánh không phân biệt hoa thường khi `process.platform === 'win32'`.

- [ ] **Bước 1: Test đỏ** `src/lib/perf-http.test.ts`:
  - 2 dòng Set-Cookie (`a=1; Path=/; HttpOnly`, `b=2; Max-Age=10`) -> jar `{a:'1', b:'2'}`, `cookieHeader` = `'a=1; b=2'`.
  - Cookie cùng tên sau ghi đè trước.
  - `a=; Max-Age=0` -> xoá `a`.
  - Giá trị chứa `=` (`t=x=y`) -> giữ `x=y`.
  - `hasSessionCookie` true với `next-auth.session-token` và `__Secure-next-auth.session-token`, false khi chỉ có `next-auth.csrf-token`.
  - Tạo `Headers` bằng `new Headers(); h.append('set-cookie', ...)`.
- [ ] **Bước 2: Test đỏ** `src/lib/load-test.test.ts`, tối thiểu:
  - `parseLoadArgs([])` bằng đúng bộ mặc định.
  - Mỗi cờ hợp lệ đọc đúng; `--vus=0`, `--vus=201`, `--vus=1.5`, `--ramp=400 --duration=300`, `--think-min=5 --think-max=1`, `--xff=abc`, `--max-error-rate=2`, `--foo=1`, `--vus` (không `=`) đều ném.
  - `mulberry32(1)` gọi 3 lần cho cùng dãy ở 2 instance; mọi giá trị trong `[0, 1)`.
  - `pickWeighted([{w:1},{w:3}] as weight)`: `r=0` -> phần tử 1, `r=0.24` -> phần tử 1, `r=0.25` -> phần tử 2, `r=0.999` -> phần tử 2; rỗng ném; `r=1` ném `RangeError`.
  - `scenariosForRole(DEFAULT_SCENARIOS, 'viewer')` không có `api_export`; `'admin'` có đủ 8; tổng trọng số `DEFAULT_SCENARIOS` = 100; tên kịch bản không trùng.
  - `DEFAULT_SCENARIOS` dựng path đúng với `{ projectId: 18, month: '2026-09' }` (vd `project_detail` -> `/vi/projects/18`).
  - `vuForwardedFor(0)` = `10.77.0.1`, `(249)` = `10.77.0.250`, `(250)` = `10.77.1.1`; `-1`, `1.5`, `64000` ném.
  - `classifyResponse`: `(200,'text/html; charset=utf-8','html')` null; `(307,null,'html')` redirect; `(429,...)` rate_limited; `(500,...)` status; `(200,'application/json','html')` status; `(200,null,'json')` status; `(200,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx')` null.
  - `parseCredentials`: hợp lệ; JSON hỏng ném và message không chứa chuỗi mật khẩu đã đưa vào; mảng rỗng ném; email sai ném; email trùng (khác hoa thường) ném.
  - `assertOutsideRepo`: file trong repo ném; file ở thư mục cha không ném; đúng thư mục repo ném; trên win32 khác hoa thường vẫn ném (dùng `it.runIf(process.platform === 'win32')`).
  - `toLoadRole('data-entry')` null, `toLoadRole('bod')` 'bod'.
- [ ] **Bước 3:** Chạy 2 file test phải ĐỎ.
- [ ] **Bước 4:** Viết `src/lib/perf-http.ts`, `src/lib/load-test.ts` theo interface; viết `scripts/perf/http-session.ts`; sửa `scripts/perf/measure-pages.ts` dùng `login({ base: BASE, email: EMAIL!, password: PASSWORD!, tag: '[measure-pages]' })`, `cookieHeader` từ `@/lib/perf-http`. Trong `measure()` của `measure-pages.ts` giữ nguyên logic.
- [ ] **Bước 5:** Test XANH; `npx tsc --noEmit` sạch; `npm test` xanh.
- [ ] **Bước 6:** Commit `feat(p5b): tham so, kich ban va cookie jar dung chung cho load test`.

---

### Task 3: Script load test + tài liệu kế hoạch load test

**Files:**
- Create: `scripts/perf/load-test.ts`
- Modify: `package.json` (thêm `"perf:load": "tsx scripts/perf/load-test.ts",` ngay sau dòng `perf:pages`)
- Create: `docs/load-test.md`

**Interfaces (Consumes):** mọi hàm Task 1-2; `assertPerfDb`, `assertPerfHost`, `assertPerfLocalBase`, `PERF_PREFIX`, `PERF_USER` từ `@/lib/perf-guard`; `prisma` từ `@/server/db`; `currentMonth` từ `@/lib/clock`.

Header comment của script (không dấu, theo `measure-pages.ts:1-7`): mô tả, env bắt buộc, env tuỳ chọn, ví dụ lệnh.

Env:
- `LOAD_CREDENTIALS_FILE`: đường dẫn file JSON `[{"email":"...","password":"..."}]` NGOÀI repo (khuyên để ở thư mục tạm của máy).
- Không có `LOAD_CREDENTIALS_FILE` thì dùng `PERF_EMAIL` + `PERF_PASSWORD` (1 tài khoản cho mọi người dùng ảo, tương thích `measure-pages.ts`). Thiếu cả hai -> in lỗi, `exit(1)`.
- `PERF_BASE` (mặc định `http://localhost:3001`), `PERF_ALLOW_REMOTE=1` (như `measure-pages.ts`).

Luồng `main()` đúng thứ tự:
1. `parseLoadArgs(process.argv.slice(2))`; lỗi -> in message, `exit(1)`.
2. `assertPerfLocalBase(BASE, process.env.PERF_ALLOW_REMOTE === '1')`.
3. Đọc tài khoản; nếu dùng file: `assertOutsideRepo(file, process.cwd())` rồi `parseCredentials(readFileSync(file, 'utf8'))`.
4. Kiểm DB y như `scripts/perf/seed-perf.ts:30-35`: `SELECT current_database(), host(inet_server_addr())`, `assertPerfDb`, `assertPerfHost`. KHÔNG cần `PERF_CONFIRM` (script chỉ đọc).
5. Đọc vai trò: `prisma.userRole.findMany({ where: { email: { in: emails } }, select: { email: true, role: true, isActive: true, lockedAt: true } })`. Dừng `exit(1)` (trước khi đăng nhập bất kỳ ai) nếu: có email không tồn tại, `isActive === false`, `lockedAt !== null` (kèm gợi ý `npm run unlock-account`), hoặc `toLoadRole(role) === null` (câu: tài khoản data-entry không vào được Tổng quan, bỏ khỏi danh sách).
6. Đọc dự án: `prisma.project.findMany({ where: { masterCode: { startsWith: PERF_PREFIX }, createdBy: PERF_USER }, select: { id: true }, orderBy: { masterCode: 'asc' }, take: 50 })`; ít hơn 5 -> `exit(1)` với câu `Thieu du an PERF- - chay npm run perf:seed truoc`. Sau đó `prisma.$disconnect()`.
7. Đăng nhập TUẦN TỰ từng người dùng ảo `i = 0..vus-1` (một `await` xong mới tới người sau, không `Promise.all`): tài khoản `creds[i % creds.length]`, header `X-Forwarded-For: vuForwardedFor(i)` khi `xff === 'per-vu'`. Lỗi đăng nhập đầu tiên -> in email + status (không in mật khẩu), `exit(1)` ngay, KHÔNG thử lại.
8. Làm nóng (không tính điểm): người dùng ảo 0 gọi lần lượt mỗi kịch bản của vai trò mình 1 lần; in thời gian từng URL.
9. Chạy tải: `t0 = performance.now()`, `runEnd = t0 + durationSec * 1000`; người dùng ảo `i` bắt đầu sau `rampSec * 1000 * i / vus` ms; mỗi người có PRNG riêng `mulberry32(seed + i)`. Vòng lặp tới khi `performance.now() >= runEnd`:
   - chọn `pickWeighted(scenariosForRole(DEFAULT_SCENARIOS, role), rnd())`, `projectId = ids[Math.floor(rnd() * ids.length)]`, `month = currentMonth()`;
   - `fetch(BASE + path, { headers: { Cookie, X-Forwarded-For? }, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })`, đọc hết body (`arrayBuffer()`), đo `ms` tới khi đọc xong;
   - `mergeCookies(jar, res.headers)` sau mỗi phản hồi (next-auth có thể cấp lại cookie phiên);
   - `errorKind = classifyResponse(res.status, res.headers.get('content-type'), scenario.expect)`; lỗi `AbortError`/`TimeoutError` -> `'timeout'`, `status 0`; lỗi khác -> `'network'`, `status 0`;
   - nghỉ `thinkMin + rnd() * (thinkMax - thinkMin)` ms nhưng không quá `runEnd`.
10. `wallMs = performance.now() - t0`. In bảng Markdown theo kịch bản (`| kich ban | n | loi | loi% | p50 | p95 | p99 | max | rps |`), dòng `page` (gộp group page), dòng `TONG`, số lỗi theo từng `errorKind`.
11. `evaluateCriteria({ overall, pages, exportStats: bySenario['api_export'] ?? null }, opts.criteria)`; in `DAT` hoặc `KHONG DAT` + từng failure.
12. `--out`: ghi JSON `{ startedAt, options (bỏ mật khẩu, bỏ email), overall, pages, byScenario, errorsByKind, pass, failures }`. Nếu `--out` nằm trong repo thì vẫn cho ghi (không có dữ liệu nhạy cảm) nhưng tài liệu khuyên ghi ra ngoài repo.
13. `exit(pass ? 0 : 1)`. Bắt lỗi ngoài cùng `main().catch(...)` như `measure-pages.ts:129-132`.

Trường hợp biên bắt buộc:
- Không bao giờ đăng nhập song song; không bao giờ thử lại đăng nhập sai.
- Phiên bị mất giữa chừng (307 về `/vi/login`) tính là lỗi `redirect`, không tự đăng nhập lại.
- Ctrl+C (`SIGINT`): dừng vòng lặp, vẫn in bảng kết quả với dữ liệu đã có, rồi `exit(1)` (chưa đủ thời lượng nên không coi là đạt).
- Không in cookie, mật khẩu ra log.

`docs/load-test.md` (tiếng Việt có dấu, mỗi câu một dòng) gồm các mục:
1. Mục tiêu và phạm vi (localhost, DB `_b`, mốc so sánh; server thật đo lại ở P6).
2. Môi trường: máy dev, `next build` + `next start -p 3001`, dữ liệu 10 triệu dòng `perf:seed`. Ghi rõ: dừng dev server cổng 3001 trước; `npx playwright test` chạy `prisma db seed` ở global setup, tester phải kiểm xem seed có xoá dữ liệu `PERF-` không, nếu có thì chạy load test TRƯỚC e2e hoặc `perf:seed` lại.
3. Kịch bản: bảng `DEFAULT_SCENARIOS` ở trên, think time, ramp, thời lượng, người dùng ảo trải đều 3 vai admin/bod/viewer.
4. Đăng nhập và cách tránh khoá tài khoản: lý do ở Quyết định kỹ thuật 9 và 10 (viết lại bằng lời nghiệp vụ).
5. Tiêu chí đạt: bảng 4 tiêu chí mặc định, ghi "chờ chủ dự án chốt Q1".
6. Cách chạy (PowerShell và bash), gồm tạo file tài khoản ngoài repo, ví dụ:

```powershell
$env:PERF_CONFIRM='ddc_control_tower_b'; npm run perf:seed
Remove-Item -Recurse -Force .next\cache\fetch-cache -ErrorAction SilentlyContinue
$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES='D:\_project\DDC_dieu-phoi\tools\font-mock.js'; npx next build
npx next start -p 3001
# cua so khac:
$env:LOAD_CREDENTIALS_FILE="$env:TEMP\ddc-load-users.json"; npm run perf:load -- --vus=30 --duration=300 --out="$env:TEMP\ddc-load.json"
```

7. Đọc kết quả (ý nghĩa p50/p95/p99, rps, từng loại lỗi, 429 nghĩa là gì).
8. Dọn dẹp: `perf:clean`, `npx prisma db seed`.
9. Mục "Kết quả đo" để trống, tester điền sau (ngày, commit, tham số, bảng, kết luận).

- [ ] **Bước 1:** Viết script + dòng `package.json`.
- [ ] **Bước 2:** `npx tsc --noEmit` sạch.
- [ ] **Bước 3:** Chạy khói ngắn trên dev hoặc start 3001 với dữ liệu hiện có: `npm run perf:load -- --vus=3 --duration=15 --ramp=3` phải chạy hết, in bảng, không 429 do đăng nhập. Nếu thiếu dữ liệu PERF thì ghi rõ trong `thay-doi.md` là chưa chạy khói được, không bịa kết quả.
- [ ] **Bước 4:** Viết `docs/load-test.md`.
- [ ] **Bước 5:** Commit `feat(p5b): script load test dong thoi + tai lieu ke hoach load test`.

---

### Task 4: Thư viện header bảo mật và CSP

**Files:**
- Create: `src/lib/security-headers.ts`, `src/lib/security-headers.test.ts`

**Interfaces (Produces):**

```ts
import { NextRequest } from 'next/server';

export const CSP_REPORT_PATH = '/api/csp-report';
export const CSP_REPORT_GROUP = 'csp-endpoint';
export const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';
export const NONCE_HEADER = 'x-nonce';

/** 16 byte ngẫu nhiên (crypto.getRandomValues, chạy được ở edge runtime), mã base64 bằng btoa: 24 ký tự. */
export function generateNonce(): string;

/** Ném Error nếu nonce không khớp /^[A-Za-z0-9+/]{22}==$/ (không bao giờ ghép chuỗi lạ vào header). */
export function buildCsp(opts: { nonce: string; dev: boolean }): string;

/** Bộ header gắn trên MỌI response của middleware. */
export function securityHeaders(opts: { nonce: string; dev: boolean }): Record<string, string>;

/** Gán từng header (set, ghi đè nếu đã có) rồi trả lại chính response đó. */
export function applySecurityHeaders<T extends Response>(res: T, headers: Record<string, string>): T;

/** Request mới (GET, cùng URL, KHÔNG mang body) có thêm header `content-security-policy-report-only` = csp và `x-nonce` = nonce,
 *  ghi đè giá trị client tự gửi. Chỉ dùng làm đầu vào cho next-intl middleware (nó sao chép request.headers vào rewrite). */
export function withCspRequestHeaders(request: NextRequest, nonce: string, csp: string): NextRequest;
```

`buildCsp({ nonce: N, dev: false })` phải trả CHÍNH XÁC chuỗi (các chỉ thị nối bằng `'; '`):

```
default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report; report-to csp-endpoint
```

`dev: true` chỉ khác ở `script-src 'self' 'nonce-N' 'strict-dynamic' 'unsafe-eval'` (Next dev dùng eval cho React Refresh).

`securityHeaders` trả đúng 6 khoá:

| Header | Giá trị |
|---|---|
| `Content-Security-Policy-Report-Only` | `buildCsp(opts)` |
| `Reporting-Endpoints` | `csp-endpoint="/api/csp-report"` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (theo Q2 phương án a) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |

`withCspRequestHeaders`: `const h = new Headers(request.headers); h.set('content-security-policy-report-only', csp); h.set('x-nonce', nonce); return new NextRequest(request.url, { headers: h });`.
KHÔNG dùng `new NextRequest(request, ...)` (sẽ chiếm body của request gốc, hỏng server action POST).

- [ ] **Bước 1: Test đỏ** `src/lib/security-headers.test.ts`:
  - `generateNonce()` khớp `/^[A-Za-z0-9+/]{22}==$/`; 200 lần gọi cho 200 giá trị khác nhau.
  - `buildCsp` prod bằng đúng chuỗi trên (so `toBe`); dev chứa `'unsafe-eval'`; prod không chứa `'unsafe-eval'`.
  - `script-src` (tách theo `'; '`) không chứa `'unsafe-inline'`; toàn chuỗi không chứa `frame-ancestors`, `upgrade-insecure-requests`.
  - `buildCsp` với nonce `abc"; script-src *`, `''`, `x`.repeat(24) ném.
  - `securityHeaders` đúng 6 khoá và giá trị như bảng.
  - `applySecurityHeaders(new Response('x'), {...})` ghi đè header có sẵn.
  - `withCspRequestHeaders`: request gốc có `x-nonce: evil` và `content-security-policy-report-only: evil` -> request mới mang giá trị mới; giữ nguyên cookie và `accept-language` gốc; `url` giống hệt.
- [ ] **Bước 2:** Chạy phải ĐỎ.
- [ ] **Bước 3:** Viết `src/lib/security-headers.ts`. Comment đầu file nêu: đây là BẢN NHÁP Report-Only (P5-B), lý do quyết định 2-5, danh sách xem lại khi P4-X vào `main` (xem Task 8).
- [ ] **Bước 4:** XANH; `npx tsc --noEmit` sạch.
- [ ] **Bước 5:** Commit `feat(p5b): thu vien header bao mat va CSP report-only (ban nhap)`.

---

### Task 5: Endpoint nhận báo cáo vi phạm `/api/csp-report`

**Files:**
- Create: `src/lib/csp-report.ts`, `src/lib/csp-report.test.ts`
- Create: `app/api/csp-report/route.ts`
- Create: `src/server/csp-report-route.test.ts`
- Modify: `src/server/api-routes-guard.test.ts`

**Interfaces (Produces):**

```ts
// src/lib/csp-report.ts
export const CSP_REPORT_MAX_BYTES = 16_384;
export const CSP_REPORT_MAX_ITEMS = 10;
export const CSP_REPORT_CONTENT_TYPES: ReadonlySet<string>; // 'application/csp-report', 'application/reports+json', 'application/json'

export interface CspViolation {
  documentPath: string;           // chỉ pathname, tối đa 200 ký tự
  blocked: string;                // xem sanitizeReportUrl
  directive: string;              // effective-directive, không có thì violated-directive; tối đa 100
  disposition: 'report' | 'enforce' | 'unknown';
  source: string | null;          // sanitizeReportUrl(source-file)
  line: number | null;
  column: number | null;
  sample: string | null;          // tối đa 80 ký tự
}

/** Đọc body tối đa maxBytes; vượt -> huỷ stream và trả null; body null -> ''. Giải mã UTF-8. */
export async function readBodyCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string | null>;

/** Bỏ query + hash. Từ khoá CSP ('inline','eval','wasm-eval','self','data','blob','trusted-types-policy', rỗng) giữ nguyên;
 *  'data:...' -> 'data'; 'blob:...' -> 'blob'; http(s) -> `${protocol}//${host}${pathname}`; chuỗi khác -> cắt 200 ký tự.
 *  Mọi ký tự điều khiển (\u0000-\u001f, \u007f) thay bằng khoảng trắng. */
export function sanitizeReportUrl(raw: unknown): string;

/** Không bao giờ ném. JSON hỏng, sai dạng -> []. Tối đa CSP_REPORT_MAX_ITEMS phần tử. */
export function parseCspReports(contentType: string, text: string): CspViolation[];
```

Dạng dữ liệu `parseCspReports` phải hiểu:
- `report-uri` (Firefox, Safari): `{"csp-report": {"document-uri", "blocked-uri", "effective-directive", "violated-directive", "disposition", "source-file", "line-number", "column-number", "script-sample"}}`.
- Reporting API (Chrome, `application/reports+json`): mảng `[{ "type": "csp-violation", "body": { "documentURL", "blockedURL", "effectiveDirective", "disposition", "sourceFile", "lineNumber", "columnNumber", "sample" } }]`; phần tử `type` khác bỏ qua.
- `application/json`: chấp nhận cả 2 dạng trên.
- `line`/`column`: chỉ nhận số nguyên không âm, khác -> `null`. `disposition` khác `report`/`enforce` -> `unknown`.
- `documentPath`: parse URL lấy `pathname`; không parse được -> `sanitizeReportUrl` rồi cắt tại `?`/`#`.

Route `app/api/csp-report/route.ts` (theo mẫu `app/api/health/route.ts`), chỉ export `POST` (GET và method khác Next tự trả 405), `export const dynamic = 'force-dynamic'`, không import `@/server/`, không gọi `getCurrentUser`:

```ts
export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const perIp = rateLimit(`csp-report:${ip}`, 30, 60_000);
  if (!perIp.ok) return tooMany(perIp.retryAfterSec);
  const global = rateLimit('csp-report:global', 300, 60_000);
  if (!global.ok) return tooMany(global.retryAfterSec);
  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!CSP_REPORT_CONTENT_TYPES.has(contentType)) return empty(415);
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > CSP_REPORT_MAX_BYTES) return empty(413);
  const text = await readBodyCapped(req.body, CSP_REPORT_MAX_BYTES);
  if (text === null) return empty(413);
  for (const v of parseCspReports(contentType, text)) console.warn('[csp-report]', JSON.stringify(v));
  return empty(204);
}
// empty(status): new Response(null, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
// tooMany(sec): như empty(429) + 'Retry-After': String(sec)
```

Log KHÔNG chứa IP, cookie, query string, user.

`src/server/api-routes-guard.test.ts`:
- `type Guard = 'next-auth' | 'health' | 'cron-secret' | 'session' | 'public-report';`
- Thêm `'csp-report/route.ts': 'public-report',` vào `GUARDS`.
- Thêm nhánh: `if (guard === 'public-report') { expect(src).toMatch(/rateLimit\(/); expect(src).toContain('clientIpFrom'); expect(src).toContain('CSP_REPORT_MAX_BYTES'); expect(src).not.toMatch(/@\/server\//); }`.

- [ ] **Bước 1: Test đỏ** `src/lib/csp-report.test.ts`:
  - Dạng `report-uri` đầy đủ -> 1 violation đúng trường.
  - Dạng Reporting API 2 phần tử (1 `csp-violation`, 1 `deprecation`) -> 1 violation.
  - `document-uri` = `http://localhost:3001/vi/dat-lai-mat-khau?token=SECRET#x` -> `documentPath` `/vi/dat-lai-mat-khau`, toàn JSON kết quả không chứa `SECRET`.
  - `blocked-uri` `https://evil.test/a.js?k=SECRET` -> `https://evil.test/a.js`; `data:image/png;base64,...` -> `data`; `inline` giữ.
  - Chuỗi có `\r\n` không còn ký tự xuống dòng.
  - `script-sample` dài 500 -> 80 ký tự; `line-number` `-1`, `"12"`, `1.5` -> `null`.
  - 50 phần tử -> đúng 10.
  - JSON hỏng, `null`, `42`, `{}` -> `[]` và không ném.
  - `readBodyCapped`: stream 3 chunk tổng dưới trần -> đủ chuỗi; tổng vượt trần -> `null`; `null` -> `''`; chuỗi UTF-8 tiếng Việt bị cắt giữa chunk vẫn giải mã đúng (dùng `TextDecoder` với `stream: true`).
- [ ] **Bước 2: Test đỏ** `src/server/csp-report-route.test.ts` (theo mẫu `src/server/health-route.test.ts`; mỗi ca dùng `x-forwarded-for` IP riêng để không dính giới hạn của ca khác):
  - POST `application/csp-report` hợp lệ -> 204, `console.warn` được gọi đúng 1 lần với tiền tố `[csp-report]` (dùng `vi.spyOn(console, 'warn')`).
  - POST `application/reports+json` hợp lệ -> 204.
  - `text/plain` -> 415, không log.
  - `content-length: 999999` -> 413; body thật 20 000 byte không có content-length -> 413.
  - Cùng 1 IP gọi 30 lần 204, lần 31 -> 429 có `Retry-After`.
  - Giới hạn toàn cục: trong ca này gọi `vi.resetModules()` rồi `await import('../../app/api/csp-report/route')` để có bộ đếm `rateLimit` mới (bộ đếm là `Map` cấp module trong `src/lib/rate-limit.ts`); 300 lần với 300 IP khác nhau đều 204, lần 301 với IP mới -> 429. Đặt ca này cuối file.
  - Body JSON hỏng -> 204, không log.
- [ ] **Bước 3:** Chạy ĐỎ; sửa `api-routes-guard.test.ts` và chạy, phải ĐỎ (route chưa có).
- [ ] **Bước 4:** Viết `src/lib/csp-report.ts` và route.
- [ ] **Bước 5:** 3 file test XANH; `npx tsc --noEmit` sạch; `npm test` xanh.
- [ ] **Bước 6:** Commit `feat(p5b): endpoint nhan bao cao vi pham CSP co gioi han tan suat va kich thuoc`.

---

### Task 6: Gắn CSP + header vào middleware và layout

**Files:**
- Modify: `middleware.ts`
- Modify: `app/[locale]/layout.tsx:36-40`
- Create: `src/server/middleware-csp.test.ts`

**Interfaces (Consumes):** `generateNonce`, `buildCsp`, `securityHeaders`, `applySecurityHeaders`, `withCspRequestHeaders`, `NONCE_HEADER` từ Task 4.

Sửa `middleware.ts` (giữ nguyên toàn bộ luật RBAC, PUBLIC_PATHS, matcher hiện có):
- Đầu hàm: `const dev = process.env.NODE_ENV === 'development'; const nonce = generateNonce(); const csp = buildCsp({ nonce, dev }); const secHeaders = securityHeaders({ nonce, dev });`.
- `const intlResp = intlMiddleware(withCspRequestHeaders(request, nonce, csp));` (thay cho `intlMiddleware(request)`).
- `getToken({ req: request, secret })` vẫn dùng `request` GỐC.
- MỌI nhánh `return` (5 chỗ: `!hasLocale`, 500 thiếu secret, redirect login, redirect RBAC, trả `intlResp`, cộng nhánh public trả `intlResp`) phải bọc `applySecurityHeaders(<response>, secHeaders)`. Cách gọn: đổi thân hàm hiện tại thành `async function route(request, intlResp): Promise<Response>` nội bộ, hàm `middleware` export mặc định gọi nó rồi `applySecurityHeaders` 1 lần.
- `dev` so `=== 'development'` (Vitest chạy với `NODE_ENV=test` nên được CSP bản production).
- Không đổi `config.matcher`. Ghi comment: `/api`, `_next`, file tĩnh không qua middleware, header cho các đường này do reverse proxy của C đặt (xem `docs/csp-header-bao-mat.md`).

Sửa `app/[locale]/layout.tsx`:
- `import { headers } from 'next/headers';`, `import { NONCE_HEADER } from '@/lib/security-headers';`.
- Trong `LocaleLayout`: `const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;` và `<script nonce={nonce} dangerouslySetInnerHTML={...} />` (nội dung script giữ nguyên từng ký tự).
- Nếu trình duyệt báo cảnh báo hydration về `nonce` (trình duyệt ẩn giá trị nonce khỏi DOM) thì thêm `suppressHydrationWarning` vào thẻ `<script>` đó, ghi lý do trong comment.

`src/server/middleware-csp.test.ts`:
- Mock `next-auth/jwt` như `src/server/middleware-auth.test.ts:8-9`. KHÔNG mock `next-intl/middleware` (dùng bản thật để chứng minh header đi vào rewrite).
- Nếu next-intl thật không nạp được trong Vitest, thay bằng mock mô phỏng đúng hành vi rewrite của next-intl (`node_modules/next-intl/dist/development/middleware/middleware.js:45-56`) và ghi lý do trong comment:

```ts
vi.mock('next-intl/middleware', () => ({
  default: () => (req: NextRequest) => NextResponse.rewrite(new URL(req.url), { request: { headers: new Headers(req.headers) } }),
}));
```

- Hàm trợ giúp `nonceOf(res)`: tách `'nonce-(...)'` từ header `content-security-policy-report-only` của response.
- Ca bắt buộc:
  1. Không phiên `/vi/login` -> response có đủ 6 header; `x-middleware-request-content-security-policy-report-only` bằng đúng CSP của response; `x-middleware-request-x-nonce` bằng `nonceOf(res)`; `x-middleware-override-headers` chứa cả 2 tên.
  2. Không phiên `/vi/overview` -> 307 về `/vi/login` VẪN có đủ 6 header.
  3. `/overview` (không locale) -> response của next-intl có đủ 6 header.
  4. data-entry vào `/vi/overview` -> redirect `/vi/nhap-lieu` có đủ 6 header.
  5. `vi.stubEnv('NEXTAUTH_SECRET', '')` -> 500 có đủ 6 header (theo mẫu `src/server/middleware-secret.test.ts`).
  6. 2 request liên tiếp -> 2 nonce khác nhau.
  7. Client gửi `x-nonce: evil` và `content-security-policy-report-only: evil` -> header chuyển tiếp mang giá trị mới, không còn `evil`.
  8. CSP trong test không chứa `'unsafe-eval'` (NODE_ENV test).
- Các test cũ `middleware-auth.test.ts`, `middleware-auth.qa.test.ts`, `middleware-secret.test.ts` phải xanh KHÔNG sửa.

- [ ] **Bước 1:** Viết `src/server/middleware-csp.test.ts`, chạy phải ĐỎ.
- [ ] **Bước 2:** Sửa `middleware.ts`, `layout.tsx`.
- [ ] **Bước 3:** Test mới + 3 file test middleware cũ XANH; `npx tsc --noEmit` sạch; `npm test` xanh.
- [ ] **Bước 4:** Kiểm tay bằng dev server 3001: mở `/vi/login`, xem DevTools, response có header `Content-Security-Policy-Report-Only`, thẻ `<script>` của Next có thuộc tính `nonce`, console không có lỗi hydration. Ghi kết quả vào `thay-doi.md`.
- [ ] **Bước 5:** Commit `feat(p5b): gan nonce + header bao mat o middleware (CSP report-only, ca redirect va intl)`.

---

### Task 7: e2e header bảo mật và thu vi phạm CSP trên trình duyệt thật

**Files:**
- Create: `e2e/26-header-bao-mat.spec.ts`, `e2e/27-csp-vi-pham.spec.ts`

Quy ước copy từ: `e2e/09-chan-chua-dang-nhap.spec.ts` (APIRequestContext không cookie, `maxRedirects: 0`), `e2e/auth.setup.ts` (storageState `e2e/.auth/admin.json`), `e2e/helpers/i18n.ts` (lấy chữ qua `vi()`, không gõ cứng tiếng Việt).

`e2e/26-header-bao-mat.spec.ts`:
- `const HEADERS = ['content-security-policy-report-only', 'reporting-endpoints', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy'];`
- Không cookie: `/vi/login` (200), `/vi/quen-mat-khau` (200), `/vi/dat-lai-mat-khau?token=x` (200), `/vi/overview` (307, `maxRedirects: 0`), `/overview` (redirect) -> đủ 6 header.
- Có phiên admin (`pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' })`): `/vi/overview`, `/vi/projects/1` -> 200, đủ 6 header.
- `/vi/login` gọi 2 lần -> nonce khác nhau; HTML trả về chứa `nonce="<nonce của chính response đó>"` ít nhất 1 lần.
- `/api/csp-report`: POST `application/csp-report` hợp lệ -> 204; POST `application/reports+json` hợp lệ -> 204; POST `text/plain` -> 415; POST body 20 000 byte -> 413; GET -> 405.
- Mỗi request POST tới `/api/csp-report` gửi `X-Forwarded-For` riêng của spec (vd `198.51.100.26`) để không ăn vào giới hạn chung.

`e2e/27-csp-vi-pham.spec.ts` (đo, KHÔNG đỏ vì có vi phạm, trừ khi có thứ bị CHẶN thật):
- `page.addInitScript` gắn listener `securitypolicyviolation` đẩy `{ directive: e.effectiveDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber, sample: e.sample, disposition: e.disposition, page: location.pathname }` vào `window.__csp`.
- Thu thêm `page.on('console')` các dòng chứa `Content Security Policy` hoặc `Content-Security-Policy`.
- Trang không phiên: `/vi/login` (kiểm nút đăng nhập Google hiển thị; `page.route('https://accounts.google.com/**', r => r.abort())`, bấm nút Google, `page.waitForRequest` tới `/api/auth/signin/google` thành công; cách định vị nút và điều kiện env Google copy từ `e2e/20-dang-nhap-google.spec.ts`, nếu spec 20 bỏ qua khi thiếu env thì spec 27 bỏ qua đúng bước bấm nút theo cùng điều kiện), `/vi/quen-mat-khau` (form hiển thị), `/vi/dat-lai-mat-khau?token=x`.
- Trang có phiên admin: `/vi/overview` (đợi `.recharts-surface` hiển thị), `/vi/overview?month=all`, `/vi/projects`, `/vi/projects/1` (đợi `.recharts-surface`), `/vi/report`, `/vi/alerts`, `/vi/admin`, `/vi/nhap-lieu`.
- Mỗi trang: đợi `networkidle`, cuộn tới cuối trang, đợi 500 ms, đọc `window.__csp`.
- Cuối spec: `testInfo.attach('csp-vi-pham.json', { body: JSON.stringify(all, null, 2), contentType: 'application/json' })` và `console.log` bảng tóm tắt.
- Assert DUY NHẤT: mọi vi phạm có `disposition === 'report'` (Report-Only không được chặn gì), và các kiểm chức năng ở trên (nút Google, chart, form) qua.

- [ ] **Bước 1:** Viết 2 spec.
- [ ] **Bước 2:** Chạy trên dev 3001: `npx playwright test e2e/26-header-bao-mat.spec.ts e2e/27-csp-vi-pham.spec.ts` phải xanh.
- [ ] **Bước 3:** Chạy toàn bộ e2e `npm run test:e2e` phải xanh (không phá spec cũ, đặc biệt 01, 02, 03, 20, 22).
- [ ] **Bước 4:** Commit `test(p5b): e2e header bao mat va thu vi pham CSP tren trinh duyet that`.

---

### Task 8: Tài liệu CSP/header và checklist qa-gate

**Files:**
- Create: `docs/csp-header-bao-mat.md`
- Create: `docs/qa-gate-truoc-go-live.md`

`docs/csp-header-bao-mat.md` (tiếng Việt có dấu, mỗi câu một dòng) gồm:
1. Trạng thái: BẢN NHÁP Report-Only, chưa chặn gì; điều kiện chuyển sang enforce.
2. Chuỗi CSP bản production và điểm khác của bản dev, giải thích từng chỉ thị bằng 1 câu.
3. Bảng "header nào đặt ở đâu":

| Header | Nơi đặt | Phạm vi | Ghi chú |
|---|---|---|---|
| CSP Report-Only + Reporting-Endpoints | Next `middleware.ts` | Trang (không gồm `/api`, `_next`, file tĩnh) | cần nonce theo request |
| X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy | Next `middleware.ts` | Trang | |
| X-Content-Type-Options: nosniff | Reverse proxy (C) | Mọi đường dẫn, `always` | phủ `/api`, `_next` |
| Strict-Transport-Security `max-age=31536000` (không `includeSubDomains`, không `preload`) | Reverse proxy (C) | Chỉ server block HTTPS | Next không biết chắc kết nối gốc là HTTPS |
| Ẩn X-Powered-By | Reverse proxy (C) hoặc `poweredByHeader: false` trong `next.config.mjs` (C đang dùng file này) | Mọi đường dẫn | |

4. Việc bàn giao cho C (reverse proxy): KHÔNG thêm hay ghi đè header CSP ở proxy (tránh 2 chính sách chồng nhau); thêm HSTS, nosniff, ẩn X-Powered-By như bảng; nhắc lại 2 mục đã chốt trong `.bangiao/archive/p3e-phan1-2026-09-28/bao-mat.md`: proxy phải đặt `X-Forwarded-For` đáng tin (nối thêm IP thật vào cuối, hoặc ghi đè bằng `$remote_addr` như mục R7 của `D:\_project\DDC_dieu-phoi\deploy-chuan-bi-lam-viec-voi-IT.md`, cả hai đều đúng với `TRUSTED_PROXY_HOPS=1`), và giới hạn tần suất `POST` quên mật khẩu ở proxy (quyết định L1 = b); cho phép `POST /api/csp-report` đi qua.
5. Cách đọc báo cáo vi phạm: log `[csp-report]` của app, danh sách từ e2e 27 (file đính kèm `csp-vi-pham.json` trong `e2e/.report`).
6. Việc phải xem lại khi P4-X (xuất PDF/JPG của C) vào `main`: thư viện chụp ảnh có dùng `eval`/`new Function` không (cần `'unsafe-eval'` là điểm trừ, ưu tiên thư viện không cần); ảnh `blob:`/`data:` (đã có trong `img-src`); worker (`worker-src`); nhúng font dạng `data:` hoặc tải CSS font (`font-src`, `style-src`); iframe tạm (html2canvas tạo iframe clone, kiểm `frame-src`/`child-src`); tải file bằng `blob:` URL. Nguồn: C ghi thư viện dùng gì trong `thay-doi.md` của P4-X (`lenh-cho-C-2026-09-28-p4.md` dòng 78).
7. Việc cho bản cuối (enforce): đổi tên header sang `Content-Security-Policy`; thêm `frame-ancestors 'none'` (hoặc theo Q2) và `upgrade-insecure-requests` (chỉ khi chạy HTTPS); bỏ các nguồn không có vi phạm thật; chạy lại e2e 27 phải 0 vi phạm.
8. Danh sách vi phạm đã đo: để trống, tester điền (bảng trang, chỉ thị, nguồn bị chặn, đề xuất xử lý).

`docs/qa-gate-truoc-go-live.md` (tiếng Việt có dấu, mỗi câu một dòng):
- Đầu file: mục đích, cách dùng (chạy từ trên xuống, mục nào đỏ thì dừng go-live), cột trạng thái dùng đúng 1 trong các nhãn: `SẴN SÀNG`, `CHỜ P4`, `CHỜ P4-X`, `CHỜ HẠ TẦNG C`, `CHỜ SERVER (P6)`, `CHỜ CHỦ DỰ ÁN`.
- Bảng cổng kiểm (cột: Mã, Cổng, Cách kiểm (lệnh hoặc spec), Tiêu chí đạt, Nguồn/người giữ, Trạng thái):

| Mã | Cổng | Cách kiểm | Tiêu chí | Trạng thái |
|---|---|---|---|---|
| QG-01 | Kiểu TypeScript | `npx tsc --noEmit` | 0 lỗi | SẴN SÀNG |
| QG-02 | Unit test | `npm test` | 0 đỏ, không test chập chờn | SẴN SÀNG |
| QG-03 | e2e toàn bộ | `npm run test:e2e` trên cặp cổng/DB đã đăng ký | 0 đỏ | SẴN SÀNG |
| QG-04 | Build production | `next build` (font mock trên máy dev) | build qua | SẴN SÀNG |
| QG-05 | Đối chiếu đọc DB | `npm run check:read` | OK | SẴN SÀNG |
| QG-06 | Header bảo mật có mặt | e2e 26 | đủ 6 header trên trang, redirect, intl | SẴN SÀNG |
| QG-07 | CSP chuyển enforce | e2e 27 trên `next start` | 0 vi phạm, chart, nút Google, quên mật khẩu, xuất PDF/JPG chạy | CHỜ P4-X |
| QG-08 | Chặn người chưa đăng nhập, lớp 1 (middleware) và lớp 2 (page/route tự kiểm) | e2e 09 + `src/server/api-routes-guard.test.ts` + tấn công thật bằng curl không cookie, có header `RSC: 1` | mọi trang redirect login, mọi API 401/403, không lộ dữ liệu | SẴN SÀNG |
| QG-09 | Khoá sau 5 lần sai | e2e 21 + tấn công thật: 5 lần sai tuần tự và 10 lần song song | lần 5 khoá, song song không lọt quá 5 lượt bcrypt, email lạ và tài khoản chỉ Google trả cùng thông báo | SẴN SÀNG |
| QG-10 | Giới hạn theo IP | tấn công thật đổi phần tử đầu `X-Forwarded-For` | 20 lần sai/15 phút/IP vẫn chặn; sau proxy thật kiểm lại | SẴN SÀNG (máy dev), CHỜ HẠ TẦNG C (sau proxy) |
| QG-11 | Quên mật khẩu, đặt lại mật khẩu | e2e 22 + tấn công thật | 3 lần/giờ/email, 10 lần/giờ/IP, không lộ email tồn tại, token 30 phút dùng 1 lần, giới hạn gửi đặt lại theo IP | SẴN SÀNG |
| QG-12 | Giới hạn `POST` quên mật khẩu ở proxy (L1 = b) | gửi dồn qua proxy | proxy trả 429 | CHỜ HẠ TẦNG C |
| QG-13 | Load test | `docs/load-test.md` | đạt 4 tiêu chí (chờ Q1) | SẴN SÀNG (máy dev), CHỜ SERVER (P6) |
| QG-14 | Hiệu năng trang đơn lẻ T1 | `npm run perf:pages` | mọi request <= 1500 ms | SẴN SÀNG |
| QG-15 | Health check có kiểm DB | route mới của C | DB tắt thì báo lỗi | CHỜ HẠ TẦNG C |
| QG-16 | Backup hằng ngày + thử khôi phục thật | script của C | khôi phục ra DB tạm, số dòng khớp | CHỜ HẠ TẦNG C |
| QG-17 | Kiểm env khi khởi động, log có cấu trúc không lộ dữ liệu nhạy cảm | của C | thiếu biến bắt buộc thì dừng rõ ràng | CHỜ HẠ TẦNG C |
| QG-18 | Reverse proxy: `X-Forwarded-For`, HSTS, nosniff mọi đường dẫn, upload 12 MB, chờ 120 giây | `curl -I` qua proxy, `/api/health` trả `clientIpResolved: true` | đúng `docs/csp-header-bao-mat.md` mục 3-4 | CHỜ HẠ TẦNG C |
| QG-19 | Giao diện P4 soi pixel 1440 px và 390 px, sáng và tối | e2e + soi tay | không lệch | CHỜ P4 |
| QG-20 | Xuất PDF/JPG đúng quyền xem tiền | e2e của P4-X | viewer không thấy số tiền | CHỜ P4-X |
| QG-21 | Repo GitHub chuyển Private, đổi `NEXTAUTH_SECRET` và mật khẩu tài khoản seed trên server thật | kiểm tay | xong | CHỜ CHỦ DỰ ÁN |
| QG-22 | Pentest tổng trên bản sẽ deploy | `/ddc-tower:pentest` | 0 lỗi mức cao, trung | CHỜ P4-X và HẠ TẦNG C |

- Thêm 1 dòng vào cột "Nguồn/người giữ" cho từng mục: B (QG-01..14, 22), C (QG-15..20), chủ dự án (QG-21).
- Dưới bảng: mục "Cách chạy một lượt qa-gate" (dùng skill `/ddc-tower:golive` chặng qa-gate), mục "Nhật ký các lượt chạy" để trống.

- [ ] **Bước 1:** Viết 2 tài liệu.
- [ ] **Bước 2:** Rà: không có dấu gạch dài (tìm ký tự U+2014 và U+2013 trong cả 2 file và mọi file đã tạo ở phase này, phải 0 kết quả), mỗi câu một dòng.
- [ ] **Bước 3:** Commit `docs(p5b): tai lieu CSP/header bao mat va checklist qa-gate truoc go-live`.

---

## Việc của tester (sau Task 8)

1. `npx tsc --noEmit`, `npm test`, toàn bộ e2e trên dev 3001.
2. `next build` (font mock) + `next start -p 3001`, chạy `npx playwright test e2e/26-header-bao-mat.spec.ts e2e/27-csp-vi-pham.spec.ts` bám server đang chạy; chép danh sách vi phạm vào `docs/csp-header-bao-mat.md` mục 8 và `.bangiao/ket-qua-test.md`.
3. Soi tay trên Chrome thật: login, nút Google, quên mật khẩu, đặt lại mật khẩu, Tổng quan, Chi tiết (chart Recharts hiển thị đủ), đổi sáng/tối không nháy sai giao diện lúc tải (script chọn giao diện có nonce chạy được), console không có lỗi hydration.
4. Load test trên `next start -p 3001` với dữ liệu `perf:seed`: lượt chính theo tham số mặc định (Q1 phương án a); điền mục "Kết quả đo" của `docs/load-test.md`; kiểm sau lượt chạy không tài khoản nào bị khoá (`lockedAt` null, `failedLoginCount` 0).
5. Test hỏng thì báo đỏ kèm output, không sửa code sản phẩm.

## Tự rà kế hoạch

- Phủ yêu cầu: (1) load test = Task 1-3 + tester bước 4; (2) qa-gate = Task 8; (3) CSP Report-Only + header + endpoint + đăng ký guard + e2e = Task 4-7, tài liệu Task 8.
- Tên hàm dùng thống nhất: `generateNonce`, `buildCsp`, `securityHeaders`, `applySecurityHeaders`, `withCspRequestHeaders`, `NONCE_HEADER`, `CSP_REPORT_MAX_BYTES`, `parseCspReports`, `readBodyCapped`, `sanitizeReportUrl`, `percentile`, `summarize`, `summarizeBy`, `evaluateCriteria`, `parseLoadArgs`, `pickWeighted`, `mulberry32`, `scenariosForRole`, `vuForwardedFor`, `classifyResponse`, `parseCredentials`, `assertOutsideRepo`, `toLoadRole`, `mergeCookies`, `cookieHeader`, `hasSessionCookie`, `login`.
- Không đụng file nóng, không đụng `next.config.mjs`, không thêm dependency.
