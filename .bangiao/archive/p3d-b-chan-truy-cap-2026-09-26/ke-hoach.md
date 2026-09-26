# P3D-B - Chặn truy cập khi chưa đăng nhập (vá S-1): kế hoạch triển khai

> Skill đã dùng khi lập: `writing-plans`.
> Coder CHỈ đọc file này.
> Mỗi Bước = 1 commit riêng.
> Checkbox `- [ ]` để đánh dấu tiến độ.

**Mục tiêu:** người chưa đăng nhập không đọc được bất kỳ dữ liệu dự án nào qua page `(app)` (kể cả payload RSC) hay qua `app/api/*`.

**Kiến trúc:** 3 lớp.
Lớp 1: `middleware.ts` không có phiên hợp lệ và không phải route public thì redirect `/{locale}/login`.
Lớp 2: helper server `requireUser(locale, roles?)` ở file mới `src/lib/require-user.ts`, gọi là lệnh `await` ĐẦU TIÊN (sau `getLocale()` nếu cần) của mọi page `(app)` và layout `(app)`, trước mọi lệnh đọc dữ liệu và trước khi trả JSX có `Suspense`.
Lớp 3: test tĩnh quét mọi `app/[locale]/(app)/**/page.tsx` và mọi `app/api/**/route.ts` để page/route mới không quên chặn.

**Tech:** Next.js 14.2.35 app router, next-auth 4.24.7 (JWT, `getToken` trong middleware), next-intl 3.26.3, Vitest 2.1.1, Playwright 1.63.

**Nguồn:** `.bangiao/archive/p3c-b-chart-2026-09-26/bao-mat.md` mục S-1.

---

## ĐÃ CHỐT (chủ dự án trả lời 2026-09-26), coder làm theo đây

1. Sau đăng nhập: giữ như hiện tại, về trang chủ theo vai; KHÔNG làm quay lại trang đang mở (callbackUrl) trong P3D-B.
2. Người chưa đăng nhập gõ đường dẫn không tồn tại: đưa về trang đăng nhập (không lộ trang nào có thật).
3. Hai điểm yếu phần ảnh (`app/api/photos/[...path]` xem chéo dự án, `deletePhotoAction` dò mã ảnh): KHÔNG vá trong P3D-B; A gỡ toàn bộ code ảnh ở P3E (chủ dự án đã chốt bỏ tính năng ảnh). Không giữ `actions.ts`.

## CÂU HỎI CÒN BỎ NGỎ (đã trả lời, xem ĐÃ CHỐT)

Coder làm theo **đề xuất** đã ghi trong từng Bước.
Nếu chủ dự án trả lời khác thì chỉ sửa đúng chỗ ghi trong ngoặc.

1. **Sau khi đăng nhập có quay lại đúng trang đang mở dở không?** (vd mở link `/vi/projects/7` khi chưa đăng nhập, đăng nhập xong vào thẳng dự án 7)
   Hiện app KHÔNG dùng `callbackUrl`: đăng nhập xong luôn về trang chủ theo vai (`LoginForm.tsx` gọi `router.replace('/overview')`).
   *Đề xuất:* (a) giữ như hiện tại, không thêm `callbackUrl` trong phase vá này.
   Lý do: đây là tính năng mới, và tham số quay lại phải chống chuyển hướng ra ngoài (open redirect), nên làm ở phase riêng nếu cần.
   (b) thêm luôn: middleware gắn `?callbackUrl=<đường dẫn gốc>`, `LoginForm` đọc và chỉ nhận đường dẫn nội bộ bắt đầu bằng `/{locale}/`.
   (Chỗ sửa nếu chọn b: Bước 2 hàm redirect trong `middleware.ts` + `src/components/layout/LoginForm.tsx`, thêm test.)
2. **Người chưa đăng nhập gõ đường dẫn không tồn tại** (vd `/vi/abc`): đưa về trang đăng nhập hay hiện trang 404?
   *Đề xuất:* (a) đưa về trang đăng nhập.
   Lý do: middleware không biết route nào tồn tại; trả 404 cho người lạ sẽ giúp họ dò được danh sách trang thật. Người đã đăng nhập vẫn thấy 404 như cũ.
   (b) giữ 404: phải liệt kê cứng mọi route hợp lệ trong middleware, dễ lệch khi thêm trang.
   (Chỗ sửa nếu chọn b: Bước 2, `isPublicPath` trong `middleware.ts`.)
3. **Hai điểm yếu nhỏ tìm thấy khi rà, KHÔNG thuộc S-1 (chỉ ảnh hưởng người ĐÃ đăng nhập hoặc mức rất thấp):**
   - `app/api/photos/[...path]/route.ts`: mọi người đã đăng nhập xem được ảnh của mọi dự án nếu biết đường dẫn file (không kiểm dự án được giao).
   - `deletePhotoAction` trong `src/server/actions.ts` (file nóng): trả `Not found` trước khi kiểm phiên, người lạ dò được mã ảnh nào có tồn tại (không lộ nội dung).
   *Đề xuất:* (a) ghi nhận, vá ở phase sau (P5 hoặc phase bảo mật riêng), không mở rộng P3D-B.
   (b) vá luôn trong P3D-B (thêm 1 Bước, phải giữ `actions.ts`).

---

## Ràng buộc chung (áp cho mọi Bước)

- **Worktree / nhánh:** `D:\_project\DDC_Control_Tower-B`, nhánh `feature/p3d-b-chan-truy-cap`.
  Trước commit đầu tiên chạy `git branch --show-current`, phải ra `feature/p3d-b-chan-truy-cap`; nếu không thì `git switch feature/p3d-b-chan-truy-cap`.
- **Cổng dev 3001, DB `ddc_control_tower_b`.** Không chạm thư mục `D:\_project\DDC_Control_Tower` (tài khoản A).
- **Không file nóng.** Phase này KHÔNG sửa: `prisma/**`, `app/globals.css`, `src/i18n/messages/*.json`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `src/server/queries.ts`, `src/server/project-queries.ts`.
  Nếu thấy cần sửa file nóng: DỪNG, ghi vào `thay-doi.md`, báo lại, không tự sửa.
- **Không làm:** CSP, rate limit (P5 của A), nâng Next, `callbackUrl` (xem Câu hỏi 1), vá ảnh/xoá ảnh (xem Câu hỏi 3), không thêm key i18n.
- **Không đổi hành vi người đã đăng nhập.** Bảng `DENIED` trong `middleware.ts` giữ nguyên từng ký tự. Trang chủ theo vai giữ `homeForRole` (`src/lib/session.ts`).
- **Không sửa `PROGRESS.md`, `.serena/memories/`.**
- **Sau mỗi commit:** cập nhật `D:\_project\DDC_dieu-phoi\phien-B.md` (bước vừa xong, commit cuối, bước kế, giờ). Mỗi ý 1 dòng `- **Tiêu đề:** ...`.
- **Cổng mỗi Bước** (PowerShell, ổ `D:` viết hoa; Git Bash làm Vitest báo giả "No test suite found"):
  ```powershell
  Set-Location D:\_project\DDC_Control_Tower-B
  npx tsc --noEmit
  npx vitest run <file test của bước>
  npm test
  ```
  `tsc` 0 lỗi; `npm test` xanh hết, số test không thấp hơn mốc ghi ở Bước 1.
- **Commit:** `test(p3d-b): ...` / `fix(p3d-b): ...` / `docs(p3d-b): ...`, mô tả tiếng Việt KHÔNG dấu, dòng cuối:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
  Không push.
- **Không dùng dấu gạch dài** (em dash, en dash) ở code, comment, commit, tài liệu.
- **Quy ước copy từ:**
  - Test middleware (mock `next-intl/middleware`, gọi `middleware(new NextRequest(...))`): `src/server/middleware-secret.test.ts`.
  - Test page server (mock `next/navigation` ném `REDIRECT:<url>`, mock `@/lib/session`, `@/server/repo` -> mock-repo, shim `globalThis.React`, hàm `visit`): `src/server/pages-role-guard.test.ts`.
  - Boilerplate mock trang Chi tiết dự án: `src/server/projects-detail-page-finance-guard.test.ts` dòng 17-38.
  - Test route API (gọi thẳng `GET`/`POST`): `src/server/export-route.test.ts`.
  - E2E: `e2e/01-login.spec.ts`, `e2e/08-finance-gate.spec.ts`; cấu hình `playwright.config.ts` (baseURL `http://localhost:3001`, tự bật `npx next dev -p 3001` nếu chưa chạy).
  - Tên test: tiếng Việt không dấu. Chú thích code: tiếng Việt.

---

## Bản đồ file

| File | Việc | Bước |
|---|---|---|
| `e2e/09-chan-chua-dang-nhap.spec.ts` | TẠO: e2e không cookie, tái hiện S-1 | 1 |
| `.bangiao/thay-doi.md` | TẠO: mốc test, bảng kết quả trước/sau sửa | 1, 6 |
| `src/server/middleware-auth.test.ts` | TẠO: unit test middleware | 2 |
| `middleware.ts` | SỬA: chặn không phiên, `token.invalid`, role mặc định | 2 |
| `src/lib/require-user.ts` | TẠO: `requireUser` | 3 |
| `src/lib/require-user.test.ts` | TẠO | 3 |
| `app/[locale]/(app)/layout.tsx` + 13 file `page.tsx` (liệt kê ở Bước 4) | SỬA: gọi `requireUser` đầu tiên | 4 |
| `src/server/app-pages-require-user.test.ts` | TẠO: test tĩnh page `(app)` | 4 |
| `src/server/app-pages-auth-guard.test.ts` | TẠO: test chạy thật 4 page chưa có guard | 4 |
| `src/server/api-routes-guard.test.ts` | TẠO: test tĩnh sổ đăng ký route API | 5 |
| `src/server/health-route.test.ts` | TẠO: health chỉ trả trạng thái | 5 |

---

## Bước 1: E2E tái hiện S-1 (đỏ) + ghi mốc

**Files:** tạo `e2e/09-chan-chua-dang-nhap.spec.ts`, tạo `.bangiao/thay-doi.md`.

- [ ] **1.1 Ghi mốc.** Chạy `npm test`, ghi số test xanh vào `.bangiao/thay-doi.md` mục "Mốc đầu phase". Chạy `npx playwright test`, ghi kết quả (kỳ vọng 21/21 xanh). Nếu e2e cũ không 21/21 xanh: dừng, ghi output, báo lại.
- [ ] **1.2 Viết spec** (nội dung đầy đủ):

```ts
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';

/**
 * P3D-B (S-1, bao-mat.md P3C-B): nguoi CHUA dang nhap khong duoc doc du lieu du an.
 * Dung APIRequestContext moi (khong cookie) de chac chan khong dinh storageState cua spec khac.
 */
const BASE = 'http://localhost:3001';

// Moi page thuc co trong app/[locale]/(app) (khop test tinh src/server/app-pages-require-user.test.ts).
const APP_PATHS = [
  '/vi/overview',
  '/vi/projects',
  '/vi/projects/1',
  '/vi/report',
  '/vi/alerts',
  '/vi/compliance',
  '/vi/audit',
  '/vi/admin',
  '/vi/import',
  '/vi/data-dictionary',
  '/vi/data-schema',
  '/vi/nhap-lieu',
  '/vi/ho-so-du-an',
  '/vi/nhap-lieu?project=1',
  '/vi/overview?month=all',
  '/en/overview',
  '/en/projects/1',
  '/vi',
];

const REDIRECT_CODES = [302, 303, 307, 308];

let api: APIRequestContext;
test.beforeAll(async () => {
  api = await pwRequest.newContext({ baseURL: BASE });
});
test.afterAll(async () => {
  await api.dispose();
});

function loginPathFor(p: string): string {
  return p.startsWith('/en') ? '/en/login' : '/vi/login';
}

test.describe('09 - chan truy cap khi chua dang nhap (S-1)', () => {
  for (const p of APP_PATHS) {
    for (const rsc of [false, true]) {
      test(`${p}${rsc ? ' [RSC: 1]' : ''} -> redirect login, khong lo du lieu`, async () => {
        const res = await api.get(p, { maxRedirects: 0, headers: rsc ? { RSC: '1' } : {} });
        const body = await res.text();
        expect(body).not.toContain('projectName');
        expect(body).not.toContain('masterCode');
        expect(REDIRECT_CODES).toContain(res.status());
        const location = res.headers()['location'] ?? '';
        expect(new URL(location, BASE).pathname).toBe(loginPathFor(p));
      });
    }
  }

  test('trinh duyet khong cookie mo /vi/overview va /vi/projects/1 -> ve /vi/login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const p of ['/vi/overview', '/vi/projects/1']) {
      await page.goto(BASE + p);
      await page.waitForURL('**/vi/login');
      // KHONG kiem page.content() chua 'projectName': trang login nhung catalog i18n (vi.json co key
      // projectName/masterCode) nen se bao gia. Viec khong lo du lieu da kiem o cac test api.get phia tren.
    }
    await ctx.close();
  });

  test('trang login van mo duoc khi chua dang nhap (200)', async () => {
    const res = await api.get('/vi/login', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  // Khoa hoi quy: cac route API da tu chan (ky vong XANH ngay tu truoc khi sua).
  test('API khong cookie: khong tra du lieu', async () => {
    expect((await api.get('/api/export', { maxRedirects: 0 })).status()).toBe(401);
    expect((await api.get('/api/report/export', { maxRedirects: 0 })).status()).toBe(403);
    expect((await api.get('/api/templates/daily-resources?project=1', { maxRedirects: 0 })).status()).toBe(403);
    expect((await api.get('/api/photos/2026-09/x.png', { maxRedirects: 0 })).status()).toBe(401);
    expect([401, 403]).toContain((await api.post('/api/photo-upload', { maxRedirects: 0 })).status());
    expect([401, 503]).toContain((await api.post('/api/cron/alerts_daily', { maxRedirects: 0 })).status());
    const health = await api.get('/api/health');
    expect(health.status()).toBe(200);
    expect(Object.keys(await health.json()).sort()).toEqual(['status', 'time']);
  });
});
```

- [ ] **1.3 Chạy đỏ:** `npx playwright test e2e/09-chan-chua-dang-nhap.spec.ts`.
  Kỳ vọng: ít nhất `/vi/overview` (cả RSC), `/vi/projects`, `/vi/projects/1` ĐỎ; test API và test login XANH.
  Ghi vào `thay-doi.md` bảng "Trước khi sửa": từng đường dẫn x (thường/RSC) -> status, có chứa `projectName`/`masterCode` không.
  Nếu `/vi/overview` KHÔNG đỏ: dừng, ghi output, báo lại (chưa tái hiện được thì chưa sửa).
  Test nào đã xanh sẵn (vd `/vi/admin` do page tự redirect) thì ghi rõ "xanh sẵn trước sửa", không sửa test cho đỏ.
- [ ] **1.4 Commit** (e2e không nằm trong `npm test` nên commit test đỏ không làm đỏ cổng):
  `test(p3d-b): e2e tai hien S-1 - nguoi chua dang nhap doc duoc du lieu du an`
  gồm `e2e/09-chan-chua-dang-nhap.spec.ts`, `.bangiao/thay-doi.md`.

---

## Bước 2: Middleware chặn khi không có phiên

**Files:** tạo `src/server/middleware-auth.test.ts`, sửa `middleware.ts`.

**Hành vi mới (thay dòng 34-42 hiện tại):**
- Tính `locale = pathname.split('/')[1]` và `subpath = '/' + pathname.split('/').slice(2).join('/')` TRƯỚC khi kiểm phiên (dời lên từ dòng 44-45). `/vi` và `/vi/` cho `subpath = '/'`.
- `getToken` ném lỗi -> coi như không phiên (như hiện hành).
- Có phiên khi và chỉ khi `token !== null && token.invalid !== true`.
  `token.invalid` do callback `jwt` trong `src/lib/auth.ts` đặt khi tài khoản bị khoá hoặc bị xoá (T-5); kiểu đã khai báo ở `src/types/next-auth.d.ts`.
  Token hết hạn: `getToken` trả `null` -> không phiên.
- Không phiên:
  - `isPublicPath(subpath)` -> `return intlResp` (giữ nguyên hành vi next-intl).
  - Ngược lại -> `NextResponse.redirect(new URL(`/${locale}/login`, request.url))` (307). Không gắn `callbackUrl` (Câu hỏi 1).
- Có phiên: `role = (token.role as Role | undefined) ?? 'viewer'` (khớp mặc định `getCurrentUser` ở `src/lib/session.ts` dòng 22).
  BẮT BUỘC mặc định `'viewer'`, KHÔNG được coi token thiếu `role` là "không phiên": nếu làm vậy, `/vi/login` thấy có user sẽ đẩy về `/overview`, middleware lại đẩy về `/login`, thành vòng lặp redirect.
  Sau đó chạy khối `DENIED` y như cũ (dòng 46-51 hiện tại, không đổi).
- Đường dẫn không có locale (vd `/overview`): giữ `if (!hasLocale) return intlResp;` như cũ (next-intl tự chuyển sang `/vi/overview`, request sau sẽ bị kiểm).
- Thiếu `NEXTAUTH_SECRET` vẫn trả 500 như cũ (test `middleware-secret.test.ts` phải còn xanh).
- `matcher` giữ nguyên (không đưa `/api` vào middleware; route API tự chặn, xem Bước 5).

**Chữ ký thêm vào `middleware.ts` (KHÔNG export, Next chỉ nên thấy `default` và `config`):**

```ts
/** Trang không cần đăng nhập, tính theo subpath sau /{locale}. */
const PUBLIC_PATHS = ['/login'];

function isPublicPath(subpath: string): boolean {
  return PUBLIC_PATHS.some((p) => subpath === p || subpath.startsWith(p + '/'));
}
```

Ghi chú quyết định: trang gốc `/{locale}` KHÔNG public (trang đó chỉ redirect, người chưa đăng nhập cũng bị đưa về login như hiện nay). `not-found` không cần public: người chưa đăng nhập gõ đường dẫn lạ thì về login (Câu hỏi 2, đề xuất a).

- [ ] **2.1 Viết test đỏ** `src/server/middleware-auth.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * P3D-B (S-1): middleware phai redirect /{locale}/login khi khong co phien hop le,
 * tru route public. RBAC DENIED cho nguoi da dang nhap giu nguyen.
 */
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: getTokenMock }));
vi.mock('next-intl/middleware', () => ({
  default: () => () => {
    const r = NextResponse.next();
    r.headers.set('x-test-intl', '1');
    return r;
  },
}));

import middleware from '../../middleware';

async function hit(path: string, headers: Record<string, string> = {}) {
  return middleware(new NextRequest(`http://localhost${path}`, { headers }));
}
function redirectedTo(res: Response): string | null {
  const l = res.headers.get('location');
  return l ? new URL(l).pathname : null;
}
function passedThrough(res: Response): boolean {
  return res.headers.get('x-test-intl') === '1' && !res.headers.get('location');
}

afterEach(() => getTokenMock.mockReset());

describe('middleware - khong co phien', () => {
  it.each(['/vi/overview', '/vi/projects', '/vi/projects/1', '/vi/import', '/vi/nhap-lieu', '/vi/admin', '/vi', '/vi/', '/vi/khong-ton-tai', '/vi/loginx'])(
    'khong token %s -> /vi/login',
    async (p) => {
      getTokenMock.mockResolvedValue(null);
      const res = await hit(p);
      expect(res.status).toBe(307);
      expect(redirectedTo(res)).toBe('/vi/login');
    },
  );

  it('khong token /en/projects/1 -> /en/login', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/en/projects/1'))).toBe('/en/login');
  });

  it('khong token + header RSC: 1 -> van redirect /vi/login', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/vi/overview', { RSC: '1' }))).toBe('/vi/login');
  });

  it('khong token /vi/login -> cho qua (next-intl)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/vi/login'))).toBe(true);
  });

  it('getToken nem loi -> coi nhu khong phien -> /vi/login', async () => {
    getTokenMock.mockRejectedValue(new Error('bad jwt'));
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/login');
  });

  it('token.invalid = true (tai khoan bi khoa) -> /vi/login', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn', role: 'admin', invalid: true });
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/login');
  });

  it('token.invalid = true vao /vi/login -> cho qua (khong vong lap)', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn', role: 'admin', invalid: true });
    expect(passedThrough(await hit('/vi/login'))).toBe(true);
  });

  it('duong dan khong locale /overview -> de next-intl xu ly', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/overview'))).toBe(true);
  });
});

describe('middleware - da dang nhap (RBAC giu nguyen)', () => {
  it('admin /vi/admin -> cho qua', async () => {
    getTokenMock.mockResolvedValue({ email: 'a@daidung.com.vn', role: 'admin' });
    expect(passedThrough(await hit('/vi/admin'))).toBe(true);
  });

  it('data-entry /vi/overview -> /vi/nhap-lieu', async () => {
    getTokenMock.mockResolvedValue({ email: 'pm@daidung.com.vn', role: 'data-entry' });
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/nhap-lieu');
  });

  it('viewer /vi/import -> /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'v@daidung.com.vn', role: 'viewer' });
    expect(redirectedTo(await hit('/vi/import'))).toBe('/vi/overview');
  });

  it('bod /vi/ho-so-du-an -> /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'b@daidung.com.vn', role: 'bod' });
    expect(redirectedTo(await hit('/vi/ho-so-du-an'))).toBe('/vi/overview');
  });

  it('token thieu role -> coi la viewer: /vi/overview cho qua, /vi/admin -> /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn' });
    expect(passedThrough(await hit('/vi/overview'))).toBe(true);
    expect(redirectedTo(await hit('/vi/admin'))).toBe('/vi/overview');
  });

  it('da dang nhap vao /vi/login -> cho qua (trang login tu day ve trang chu)', async () => {
    getTokenMock.mockResolvedValue({ email: 'a@daidung.com.vn', role: 'admin' });
    expect(passedThrough(await hit('/vi/login'))).toBe(true);
  });
});
```

- [ ] **2.2 Chạy đỏ:** `npx vitest run src/server/middleware-auth.test.ts`. Kỳ vọng: các ca "khong co phien" (trừ `/vi/login` và `/overview`), `token.invalid`, `token thieu role` ĐỎ. Các ca RBAC đã đăng nhập (trừ "thieu role") xanh sẵn.
- [ ] **2.3 Sửa `middleware.ts`** theo "Hành vi mới" ở trên. Import kiểu `JWT` từ `next-auth/jwt` nếu cần khai báo biến token.
- [ ] **2.4 Chạy xanh:** `npx vitest run src/server/middleware-auth.test.ts src/server/middleware-secret.test.ts`, rồi cổng chung.
- [ ] **2.5 Chạy e2e:** `npx playwright test e2e/09-chan-chua-dang-nhap.spec.ts` (kỳ vọng xanh hết) và `npx playwright test` (21 cũ + mới xanh). Ghi kết quả vào `thay-doi.md`.
- [ ] **2.6 Commit:** `fix(p3d-b): middleware redirect ve login khi chua dang nhap hoac tai khoan bi khoa (S-1)` gồm `middleware.ts`, `src/server/middleware-auth.test.ts`, `.bangiao/thay-doi.md`.

---

## Bước 3: Helper `requireUser`

**Files:** tạo `src/lib/require-user.ts`, tạo `src/lib/require-user.test.ts`.

Đặt ở FILE MỚI (không thêm vào `src/lib/session.ts`): nhiều test hiện có mock cả module `@/lib/session` chỉ với `getCurrentUser` + `homeForRole`; helper ở file riêng sẽ dùng chính các mock đó nên test cũ không phải sửa.

**Nội dung đầy đủ `src/lib/require-user.ts`:**

```ts
import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole, type CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';

/**
 * P3D-B (S-1): chot chan dang nhap o tang page, khong pho mac middleware/layout.
 * Layout va page render song song nen redirect o layout KHONG chan duoc page stream du lieu;
 * moi page (app) phai goi ham nay la lenh await dau tien (sau getLocale neu can),
 * truoc moi lenh doc du lieu va truoc khi tra JSX co Suspense.
 * - Chua dang nhap (hoac phien bi vo hieu) -> /{locale}/login.
 * - Co `roles` ma vai khong nam trong do -> trang chu theo vai (homeForRole).
 * Khong goi trong try/catch: redirect() nem NEXT_REDIRECT.
 */
export async function requireUser(locale: string, roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (roles && !roles.includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
  return user;
}
```

- [ ] **3.1 Viết test** `src/lib/require-user.test.ts` (mock `next/navigation` ném `REDIRECT:<url>`, mock `@/lib/session` với `getCurrentUser: vi.fn()` và `homeForRole` thật theo mẫu `src/server/pages-role-guard.test.ts` dòng 10-25). Các ca:
  - `getCurrentUser` -> `null`, `requireUser('vi')` ném `REDIRECT:/vi/login`.
  - `null`, `requireUser('en')` ném `REDIRECT:/en/login`.
  - user admin, không `roles` -> trả đúng object user.
  - user viewer, `roles = ['admin']` -> `REDIRECT:/vi/overview`.
  - user data-entry, `roles = ['admin', 'bod']` -> `REDIRECT:/vi/nhap-lieu`.
  - user bod, `roles = ['admin', 'bod']` -> trả user.
  - `roles = []` với admin -> `REDIRECT:/vi/overview` (mảng rỗng nghĩa là không ai được vào; ghi chú trong test).
- [ ] **3.2 Chạy đỏ** (module chưa tồn tại): `npx vitest run src/lib/require-user.test.ts`.
- [ ] **3.3 Tạo `src/lib/require-user.ts`** như trên.
- [ ] **3.4 Chạy xanh** + cổng chung.
- [ ] **3.5 Commit:** `feat(p3d-b): them requireUser chan dang nhap o tang page` gồm 2 file.

---

## Bước 4: Mọi page `(app)` + layout gọi `requireUser` trước khi đọc dữ liệu

**Files sửa (đủ 13 page + layout, đã quét `app/[locale]/(app)/**/page.tsx` ngày 2026-09-26):**

| File | Lệnh đầu tiên sau khi sửa | `roles` | Ghi chú |
|---|---|---|---|
| `app/[locale]/(app)/layout.tsx` | `const user = await requireUser(locale);` | không | bỏ `getCurrentUser` + `if (!user) redirect(...)`, bỏ import `redirect` nếu không còn dùng |
| `overview/page.tsx` | `const locale = await getLocale(); const user = await requireUser(locale, ['admin', 'bod', 'viewer']);` | MỚI | trùng `DENIED['data-entry']` của middleware; hiện page không kiểm gì. Dời `getLocale` lên trước `getTranslations` |
| `projects/page.tsx` | `await requireUser(params.locale);` | không | hiện page không kiểm gì, đọc `repo.listProjects()` |
| `projects/[id]/page.tsx` | `const locale = await getLocale(); const user = await requireUser(locale);` | không | đặt TRƯỚC `getTranslations`; giữ `requireProjectRead(user, id)`; giữ `const canViewFinance = user.canViewFinance ?? false` (fail-closed, test `projects-detail-page-finance-guard.test.ts` dùng user thiếu field) |
| `import/page.tsx` | `const locale = await getLocale(); await requireUser(locale, ['admin', 'data-entry']);` | MỚI | trùng `DENIED` viewer/bod; thêm import `getLocale` từ `next-intl/server` |
| `report/page.tsx` | `getLocale` rồi `requireUser(locale, ['admin', 'bod'])` | có sẵn | thay 2 dòng `if` |
| `alerts/page.tsx` | như trên, `['admin', 'bod']` | có sẵn | |
| `compliance/page.tsx` | như trên, `['admin', 'bod']` | có sẵn | |
| `audit/page.tsx` | như trên, `['admin']` | có sẵn | |
| `admin/page.tsx` | như trên, `['admin']` | có sẵn | |
| `data-dictionary/page.tsx` | như trên, `['admin']` | có sẵn | |
| `data-schema/page.tsx` | như trên, `['admin']` | có sẵn | |
| `nhap-lieu/page.tsx` | như trên, `['admin', 'data-entry']` | có sẵn | |
| `ho-so-du-an/page.tsx` | như trên, `['admin', 'data-entry']` | có sẵn | |

Quy tắc chung khi sửa từng page:
- Import `import { requireUser } from '@/lib/require-user';`.
- Page KHÔNG còn import/gọi `getCurrentUser` (lấy user từ giá trị trả về của `requireUser`). Bỏ import `redirect`/`homeForRole` nếu không còn dùng (giữ `notFound`, `redirect` nếu page còn dùng việc khác, vd `projects/page.tsx` vẫn redirect sang dự án đầu).
- Chỗ nào đang dùng `user?.x` có thể giữ nguyên hoặc đổi thành `user.x`; không đổi logic khác.
- Không bọc `requireUser` trong `try/catch`.
- Page nhận `locale` từ `params` (projects, layout) thì dùng `params.locale`, không gọi thêm `getLocale()`.

- [ ] **4.1 Viết test tĩnh đỏ** `src/server/app-pages-require-user.test.ts` (nội dung đầy đủ):

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * P3D-B (S-1): moi page trong app/[locale]/(app) (va layout) phai goi requireUser la lenh await
 * dau tien (cho phep dung truoc no dung 1 lenh `await getLocale()`), truoc moi lenh doc du lieu.
 * Test nay chan page MOI quen chot dang nhap.
 */
const APP_DIR = path.resolve(__dirname, '../../app/[locale]/(app)');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

const rel = (f: string) => path.relative(APP_DIR, f).split(path.sep).join('/');
const PAGES = walk(APP_DIR);
const FILES = [...PAGES, path.join(APP_DIR, 'layout.tsx')];

const EXPECTED = [
  'overview/page.tsx', 'projects/page.tsx', 'projects/[id]/page.tsx', 'report/page.tsx', 'alerts/page.tsx',
  'compliance/page.tsx', 'audit/page.tsx', 'admin/page.tsx', 'import/page.tsx', 'data-dictionary/page.tsx',
  'data-schema/page.tsx', 'nhap-lieu/page.tsx', 'ho-so-du-an/page.tsx',
];

/** Ten ham duoc await theo thu tu xuat hien trong than ham export default. */
function awaitedCallees(src: string): string[] {
  const start = src.indexOf('export default async function');
  expect(start, 'phai co export default async function').toBeGreaterThanOrEqual(0);
  return [...src.slice(start).matchAll(/await\s+([A-Za-z_$][\w$.]*)\s*\(/g)].map((m) => m[1]);
}

describe('page (app) deu chot dang nhap bang requireUser', () => {
  it('quet ra du cac page da biet (walk khong rong)', () => {
    expect(PAGES.map(rel).sort()).toEqual(expect.arrayContaining(EXPECTED));
  });

  it.each(FILES.map((f) => [rel(f), f]))('%s goi requireUser truoc moi await khac', (_name, file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain("from '@/lib/require-user'");
    expect(src).not.toMatch(/getCurrentUser/);
    const calls = awaitedCallees(src);
    const ok = calls[0] === 'requireUser' || (calls[0] === 'getLocale' && calls[1] === 'requireUser');
    expect(ok, `thu tu await: ${calls.slice(0, 3).join(', ')}`).toBe(true);
  });
});
```

- [ ] **4.2 Viết test chạy thật đỏ** `src/server/app-pages-auth-guard.test.ts` cho 4 page hiện chưa tự kiểm: overview, projects, projects/[id], import.
  Mock (copy mẫu `pages-role-guard.test.ts` dòng 10-29 + `projects-detail-page-finance-guard.test.ts` dòng 27-38):
  - `next/navigation`: `redirect` ném `REDIRECT:<url>`, `notFound` ném `NOT_FOUND`.
  - `next-intl/server`: `getLocale` -> `'vi'`, `getTranslations` -> `(k) => k`.
  - `@/lib/session`: `getCurrentUser: vi.fn()`, `homeForRole` thật (`data-entry` -> `/nhap-lieu`, còn lại `/overview`).
  - `@/server/repo` -> mock-repo.
  - Stub trả `null` cho: `@/components/dashboard/OverviewWidgets` (các export `AlertBanner, BacklogOverdueCard, CapacityCard, GroupBarCard, KpiGrid, ProjectListCard, SCurveCard, SpiCpiCard, StatusDonutCard, TopPriorityCard`), `@/components/dashboard/FilterBar` (`FilterBar`), `@/components/ui/Skeleton` (`CardSkeleton`), `@/components/form/ImportPanel` (`ImportPanel`), cùng các mock trang Chi tiết ở dòng 27-38 file finance-guard.
  - Dùng `vi.spyOn(repo, ...)` trên mock-repo để khẳng định KHÔNG đọc dữ liệu trước khi redirect.
  Các ca (gọi hàm page, không cần render):
  - chưa đăng nhập `OverviewPage({ searchParams: {} })` -> `REDIRECT:/vi/login`; `readLastAuditAt`, `getDims` không được gọi.
  - chưa đăng nhập `ProjectsPage({ params: { locale: 'vi' } })` -> `REDIRECT:/vi/login`; `listProjects` không được gọi.
  - chưa đăng nhập `ProjectDetailPage({ params: { id: '1', locale: 'vi' }, searchParams: {} })` -> `REDIRECT:/vi/login` (trước đây là `NOT_FOUND`); `getProject` không được gọi.
  - chưa đăng nhập `ImportPage()` -> `REDIRECT:/vi/login`; `listProjects`, `getSapQueue` không được gọi.
  - `ProjectsPage` với `params: { locale: 'en' }` chưa đăng nhập -> `REDIRECT:/en/login`.
  - data-entry vào overview -> `REDIRECT:/vi/nhap-lieu`.
  - viewer vào import -> `REDIRECT:/vi/overview`; bod vào import -> `REDIRECT:/vi/overview`.
  - admin vào import -> không ném (trả element); data-entry vào import -> không ném.
  - viewer vào `ProjectsPage` -> redirect bắt đầu bằng `/vi/projects/` (hành vi cũ giữ nguyên).
  - admin, viewer, bod vào overview -> không ném.
- [ ] **4.3 Chạy đỏ:** `npx vitest run src/server/app-pages-require-user.test.ts src/server/app-pages-auth-guard.test.ts`. Ghi số ca đỏ vào `thay-doi.md`.
- [ ] **4.4 Sửa layout + 13 page** theo bảng trên.
- [ ] **4.5 Chạy xanh** 2 file mới, rồi các test page hiện có phải còn xanh, không sửa kỳ vọng của chúng:
  `npx vitest run src/server/pages-role-guard.test.ts src/server/nhap-lieu-page-guard.test.ts src/server/ho-so-du-an-page-guard.test.ts src/server/ho-so-du-an-page-guard.qa.test.ts src/server/compliance-page.test.ts src/server/admin-notify-page.test.ts src/server/data-pages-render.test.ts src/server/operation-pages-render.test.ts src/server/finance-gate-pages.test.ts src/server/projects-detail-page-render.test.ts src/server/projects-detail-page-month-guard.test.ts src/server/projects-detail-page-finance-guard.test.ts src/server/projects-detail-finance-gate.test.ts src/server/queries-n1.test.ts src/i18n/messages.test.ts`
  Trường hợp biên: 5 file test trang Chi tiết (`projects-detail-*`, `queries-n1`) mock `next/navigation` CHỈ có `notFound`. Chúng không dùng user `null` nên `redirect` không bị gọi và không lỗi.
  Nếu vẫn lỗi `No "redirect" export is defined on the mock`: chỉ thêm `redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }` vào mock của đúng file đó, không đổi kỳ vọng; ghi vào `thay-doi.md`.
  Rồi chạy cổng chung.
- [ ] **4.6 Chạy e2e toàn bộ:** `npx playwright test` (21 cũ + spec 09 xanh).
- [ ] **4.7 Commit:** `fix(p3d-b): moi page (app) goi requireUser truoc khi doc du lieu + test tinh chan page moi` gồm layout, 13 page, 2 file test (và file test nào phải thêm `redirect` vào mock, nếu có).

---

## Bước 5: Rà route API + server action, khoá bằng test

**Kết quả rà (planner đã đọc từng file, 2026-09-26):**

| Route | Chặn hiện có | Test đã có | Kết luận |
|---|---|---|---|
| `app/api/auth/[...nextauth]/route.ts` | next-auth, public theo thiết kế | không cần | giữ |
| `app/api/health/route.ts` | không kiểm phiên, chỉ trả `{ status, time }` | CHƯA có | thêm test khoá hình dạng body |
| `app/api/cron/[job]/route.ts` | `CRON_SECRET` + `timingSafeEqual`, 503 khi thiếu secret | `src/server/cron-route.test.ts` | giữ |
| `app/api/export/route.ts` | `getCurrentUser` -> 401, role admin/bod | `src/server/export-route.test.ts` | giữ |
| `app/api/report/export/route.ts` | `getCurrentUser` -> 403, role admin/bod | `src/server/report-export-route.test.ts` | giữ |
| `app/api/photo-upload/route.ts` | same-origin + `getCurrentUser` -> 401 | `src/server/photo-upload-route.test.ts` | giữ |
| `app/api/photos/[...path]/route.ts` | `getCurrentUser` -> 401 | `src/server/photo-route.test.ts` | giữ (điểm yếu khác loại: Câu hỏi 3) |
| `app/api/templates/daily-resources/route.ts` | `canWriteProject` -> 403 (400 nếu `project` sai định dạng, không lộ dữ liệu) | `src/server/daily-template-route.test.ts` | giữ |

Server action (`'use server'`): `src/server/actions.ts`, `actions-project.ts`, `actions-entry.ts`, `actions-master.ts`, `actions-notify.ts`, `actions-user-finance.ts`.
Mọi hàm export đều gọi `getCurrentUser` / `requireRole` / `requireProject` (trong `actions.ts`) hoặc `requireRoleUser` / `requireWriteProject` (`src/server/action-guards.ts`) và trả `Forbidden` khi không có user.
Kết luận: KHÔNG sửa server action trong phase này, `actions.ts` không bị đụng. Ngoại lệ mức thấp `deletePhotoAction`: Câu hỏi 3.

**Files:** tạo `src/server/api-routes-guard.test.ts`, tạo `src/server/health-route.test.ts`.

- [ ] **5.1 Viết** `src/server/api-routes-guard.test.ts` (nội dung đầy đủ):

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * P3D-B: middleware KHONG chay cho /api/* (matcher loai api) nen moi route phai tu chan.
 * So dang ky duoi day liet ke cach chan cua tung route; them route moi ma khong dang ky -> test do.
 */
const API_DIR = path.resolve(__dirname, '../../app/api');

type Guard = 'next-auth' | 'health' | 'cron-secret' | 'session';
const GUARDS: Record<string, Guard> = {
  'auth/[...nextauth]/route.ts': 'next-auth',
  'health/route.ts': 'health',
  'cron/[job]/route.ts': 'cron-secret',
  'export/route.ts': 'session',
  'report/export/route.ts': 'session',
  'photo-upload/route.ts': 'session',
  'photos/[...path]/route.ts': 'session',
  'templates/daily-resources/route.ts': 'session',
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name === 'route.ts' ? [full] : [];
  });
}
const rel = (f: string) => path.relative(API_DIR, f).split(path.sep).join('/');
const ROUTES = walk(API_DIR);

describe('route API deu co cach chan da dang ky', () => {
  it('moi route.ts deu nam trong so dang ky va nguoc lai', () => {
    expect(ROUTES.map(rel).sort()).toEqual(Object.keys(GUARDS).sort());
  });

  it.each(ROUTES.map((f) => [rel(f), f]))('%s dung cach chan da khai', (name, file) => {
    const src = readFileSync(file, 'utf8');
    const guard = GUARDS[name];
    if (guard === 'session') expect(src).toMatch(/getCurrentUser\(/);
    if (guard === 'cron-secret') {
      expect(src).toContain('CRON_SECRET');
      expect(src).toContain('timingSafeEqual');
    }
    if (guard === 'health') expect(src).not.toMatch(/@\/server\//);
  });
});
```

- [ ] **5.2 Viết** `src/server/health-route.test.ts`: gọi `GET(new NextRequest('http://localhost/api/health'))`; kỳ vọng status 200 và `Object.keys(await res.json()).sort()` bằng `['status', 'time']`, `status === 'ok'`.
- [ ] **5.3 Chạy:** `npx vitest run src/server/api-routes-guard.test.ts src/server/health-route.test.ts`. Hai test này là test khoá hồi quy, kỳ vọng XANH ngay (không có lỗ hổng API cần vá). Kiểm chứng test tĩnh có tác dụng: tạm đổi 1 key trong `GUARDS` cho sai, chạy phải đỏ, rồi hoàn tác (không commit phần tạm). Ghi vào `thay-doi.md`.
- [ ] **5.4 Cổng chung.**
- [ ] **5.5 Commit:** `test(p3d-b): khoa route API phai tu chan + health chi tra trang thai` gồm 2 file test, `.bangiao/thay-doi.md`.

---

## Bước 6: Kiểm chứng cuối + hồ sơ

- [ ] **6.1** `npx tsc --noEmit` 0 lỗi; `npm test` xanh, số test >= mốc Bước 1 + số test mới.
- [ ] **6.2** `npx playwright test`: 21 test cũ + spec 09 xanh hết. Dán dòng tổng kết vào `thay-doi.md`.
- [ ] **6.3** Tái hiện lại đúng lệnh trong báo cáo S-1 trên dev 3001 (PowerShell, dùng `curl.exe`):
  ```powershell
  curl.exe -s -o NUL -w "%{http_code} %{size_download} %{redirect_url}`n" -H "RSC: 1" http://localhost:3001/vi/overview
  curl.exe -s -o NUL -w "%{http_code} %{size_download} %{redirect_url}`n" -H "RSC: 1" http://localhost:3001/vi/projects/1
  curl.exe -s -o NUL -w "%{http_code} %{size_download} %{redirect_url}`n" -H "RSC: 1" http://localhost:3001/vi/projects
  curl.exe -s -H "RSC: 1" http://localhost:3001/vi/overview | Select-String -Pattern "projectName|masterCode" -AllMatches
  ```
  Kỳ vọng: `307`, kích thước nhỏ, `redirect_url` là `http://localhost:3001/vi/login`; lệnh cuối không in dòng nào.
  Dán output thật vào `thay-doi.md` bảng "Sau khi sửa" cạnh bảng "Trước khi sửa" của Bước 1.
- [ ] **6.4** Kiểm tay trên trình duyệt (cổng 3001): đăng nhập admin -> vào `/vi/overview`, `/vi/projects/1`, `/vi/admin` bình thường; đăng xuất -> mở `/vi/overview` về login; đăng nhập pm -> về `/vi/nhap-lieu`, mở `/vi/overview` bị đưa về `/vi/nhap-lieu`. Ghi kết quả.
- [ ] **6.5** Hoàn tất `thay-doi.md`: danh sách file đổi, bảng trước/sau, kết quả rà API + server action (copy bảng Bước 5), các điểm ghi nhận của Câu hỏi 3, việc không làm (CSP, rate limit, callbackUrl).
- [ ] **6.6 Commit:** `docs(p3d-b): thay-doi - ket qua kiem chung chan truy cap chua dang nhap`.

---

## Trường hợp biên bắt buộc (tổng hợp, đã gắn vào từng Bước)

1. Không cookie, có header `RSC: 1` -> vẫn 307 về login, thân không có `projectName`/`masterCode` (Bước 1, 2).
2. Token hết hạn -> `getToken` trả `null` -> về login (Bước 2).
3. `getToken` ném lỗi (cookie hỏng, sai secret) -> về login (Bước 2).
4. Tài khoản bị khoá/xoá (`token.invalid === true`) -> về login; vào `/login` vẫn được, không vòng lặp (Bước 2).
5. Token có phiên nhưng thiếu `role` -> coi là `viewer`, KHÔNG coi là chưa đăng nhập (tránh vòng lặp login <-> overview) (Bước 2).
6. `/vi`, `/vi/`, `/vi/loginx`, `/vi/khong-ton-tai` chưa đăng nhập -> về login; `/vi/login` cho qua (Bước 2).
7. Locale `en` -> về `/en/login` (Bước 1, 2, 3, 4).
8. Đường dẫn không locale -> để next-intl xử lý như cũ (Bước 2).
9. Thiếu `NEXTAUTH_SECRET` -> vẫn 500 (test cũ `middleware-secret.test.ts`).
10. Page `(app)` phải chặn TRƯỚC `getTranslations`, trước mọi `repo.*` và trước JSX có `Suspense` (Bước 4, test tĩnh kiểm thứ tự `await`).
11. Page mới thêm vào `(app)` quên `requireUser` -> test tĩnh đỏ (Bước 4). Route API mới quên đăng ký -> test tĩnh đỏ (Bước 5).
12. `/vi/projects/1` chưa đăng nhập: trước là 404 ở page, nay là về login (middleware chặn trước); người đã đăng nhập không có quyền dự án vẫn 404 như cũ (`requireProjectRead`).
13. Người đã đăng nhập: `DENIED` và trang chủ theo vai không đổi; page overview/import thêm kiểm vai ở tầng page nhưng cho cùng kết quả redirect như middleware.
