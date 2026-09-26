# P7-C1 - e2e theo worktree + task nhỏ đợt 2 (7.1, 7.3, 7.6): kế hoạch triển khai

> Skill đã dùng khi lập: `writing-plans` (tra thêm docs next-intl qua context7 cho `generateMetadata`).
> Coder CHỈ đọc file này.
> Mỗi Bước = 1 commit riêng, làm đúng thứ tự Bước 1 → 5.
> Checkbox `- [ ]` để đánh dấu tiến độ.

**Mục tiêu:** (C-0) bộ e2e chạy được trên worktree nào có cặp DB + cổng đã đăng ký, không bao giờ trên DB của A; (7.1) gỡ hẳn chức năng "xoá toàn bộ dữ liệu"; (7.3) đổi tên app hiển thị; (7.6) đổi chữ `detail.tl.gap`.

**Tech:** Next.js 14 app router, next-intl 3 (`getTranslations`), Vitest, Playwright 1.63, Tailwind.

**Nguồn yêu cầu:** `D:\_project\DDC_dieu-phoi\lenh-cho-C-2026-09-27.md` PHẦN C-0, C-1; `lenh-cho-A-2026-09-27.md` PHẦN 7 (7.1, 7.3, 7.6); chủ dự án đã chốt 2026-09-26.

---

## CÂU HỎI CÒN BỎ NGỎ

Không có câu nghiệp vụ mới.
Mọi câu nghiệp vụ đã được chủ dự án chốt (xem mục ĐÃ CHỐT).
Các chỗ chữ phụ không được cho sẵn (tiêu đề tab, tin nhắn thử) planner tự chọn theo đúng chữ chủ dự án đã cho, ghi ở mục QUYẾT ĐỊNH KỸ THUẬT; chủ dự án muốn khác thì chỉ sửa đúng chuỗi đó.

## ĐÃ CHỐT (chủ dự án, 2026-09-26)

1. e2e: cổng lấy từ `NEXTAUTH_URL`; chỉ 2 cặp hợp lệ `ddc_control_tower_b` + 3001, `ddc_control_tower_c` + 3003; không bao giờ chạy trên `ddc_control_tower`.
2. 7.1: xoá hẳn, không giữ đường vòng nào.
3. 7.3: dòng đậm sidebar = "BÁO CÁO QUẢN TRỊ", dòng mờ bên dưới = "Danh Mục Dự Án"; tiếng Anh "MANAGEMENT REPORTS" / "Project Portfolio".
4. 7.6: `detail.tl.gap` vi = "Chênh lệch KH vs TT", en = "Plan vs Actual variance".
5. `defaultLocale` đã là `'vi'` (`src/i18n/routing.ts` dòng 5), không sửa.

## QUYẾT ĐỊNH KỸ THUẬT (planner tự chọn, có lý do)

- **K1. Đổi giá trị, không đổi tên key.** `app.headerTitle` giữ vai trò dòng đậm, `app.name` giữ vai trò dòng mờ; chỉ đổi giá trị trong `vi.json`/`en.json`. Lý do: `AppShell.tsx` đã render đúng thứ tự này, đổi tên key làm diff to hơn mà không thêm giá trị.
- **K2. Chữ in hoa lưu nguyên trong JSON** ("BÁO CÁO QUẢN TRỊ"), không dùng CSS `uppercase`. Lý do: đúng từng ký tự chủ dự án cho, không phụ thuộc cách trình duyệt viết hoa tiếng Việt.
- **K3. Tiêu đề tab trình duyệt** = `` `${t('app.headerTitle')} - ${t('app.name')}` `` theo locale, qua `generateMetadata` ở `app/[locale]/layout.tsx`. vi: "BÁO CÁO QUẢN TRỊ - Danh Mục Dự Án"; en: "MANAGEMENT REPORTS - Project Portfolio".
- **K4. h1 trang đăng nhập** = `t('app.headerTitle')`; dòng phụ `<p>{t('app.subtitle')}</p>` giữ nguyên. Lý do: chỉ thay chỗ gõ cứng, không đổi bố cục thẻ đăng nhập.
- **K5. `pageTitle` fallback ở `AppShell.tsx` dòng 79 giữ `t('app.headerTitle')`.** Lý do: mọi page trong `app/[locale]/(app)` (13 page) đều khớp một mục NAV, fallback chỉ gặp ở đường dẫn lạ; hiện tên app ở đó là hợp lý. Không sửa dòng 79.
- **K6. Tin nhắn thử (`src/lib/notify-message.ts` `testNotice`)**: `projectName: 'BÁO CÁO QUẢN TRỊ'`, `message: 'Tin nhắn thử từ BÁO CÁO QUẢN TRỊ'`. Lý do: thông báo gửi đi hiện chỉ tiếng Việt và gõ cứng; giữ gõ cứng, chỉ thay chữ.
- **K7. Nhãn nhật ký `activity.reset_data` GIỮ LẠI** trong `vi.json`/`en.json`. Lý do: `ActivityViewer.tsx` render `t(\`activity.${a.action}\`)` cho dòng nhật ký cũ trong DB; xoá key sẽ làm trang /admin lỗi khi còn dòng `reset_data` cũ (cùng lý do các key như `activity.add_photo` vẫn còn).
- **K8. Chỉ xoá key `admin.resetData`, `admin.resetConfirm`** (không còn nơi dùng sau 7.1).
- **K9. C-0: kiểm tra ở cả `playwright.config.ts` lẫn `global-setup.ts`.** Kiểm ở config để `webServer` không bao giờ khởi động theo cặp sai; kiểm lại ở global-setup (lớp thứ 2, ngay trước lệnh seed). Cả hai dùng chung 1 hàm `resolveE2eTarget`.
- **K10. Ưu tiên `.env` hơn biến shell** (giống `global-setup.ts` hiện tại: `Object.assign(process.env, loadDotEnv())`), và truyền `DATABASE_URL` đã kiểm vào `webServer.env` để server dev không lấy nhầm biến shell.
- **K11. Thông báo lỗi e2e không in `DATABASE_URL`** (chứa mật khẩu), chỉ in tên DB/cổng hợp lệ.

---

## Ràng buộc chung (áp cho mọi Bước)

- **Worktree / nhánh:** `D:\_project\DDC_Control_Tower-C`, nhánh `feature/p7-c-task-bo-sung`.
  Trước commit đầu tiên chạy `git branch --show-current`, phải ra `feature/p7-c-task-bo-sung`.
- **Cổng dev 3003, DB `ddc_control_tower_c`.** Không chạm thư mục `D:\_project\DDC_Control_Tower` (A) và `D:\_project\DDC_Control_Tower-B` (B).
- **File nóng C đang giữ và được sửa:** `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`.
- **KHÔNG sửa:** `prisma/**` (A giữ `schema.prisma`), `app/globals.css`, `app/tokens.css`, `src/server/queries.ts`, `src/server/project-queries.ts`, `PROGRESS.md`, `.serena/memories/`, `README.md`, `CLAUDE.md`, comment trong code có chữ "DDC Control Tower".
  Nếu thấy buộc phải sửa file trong danh sách này: DỪNG, ghi vào `.bangiao/thay-doi.md`, báo lại.
- **Không thêm key i18n mới.** Chỉ đổi giá trị key có sẵn và xoá 2 key ở K8. Không đổi thứ tự key.
- **Không dùng dấu gạch dài (em/en dash)** ở bất kỳ đâu: code, chuỗi, comment, commit, tài liệu.
- **Quy ước e2e:** comment + chuỗi lỗi trong `e2e/**` viết tiếng Việt KHÔNG dấu (theo `e2e/global-setup.ts`, `e2e/helpers/env.test.ts`); chữ giao diện lấy qua helper `vi()`/`en()` của `e2e/helpers/i18n.ts`, không gõ cứng.
- **Quy ước test vitest:** mẫu `describe/it` + `readFileSync` như `src/i18n/messages-p3cb-9-10.qa.test.ts`.
- **Cổng kiểm mỗi Bước (PowerShell):**
  `Set-Location 'D:\_project\DDC_Control_Tower-C'; npx tsc --noEmit` phải sạch;
  `Set-Location 'D:\_project\DDC_Control_Tower-C'; npm test` phải xanh toàn bộ.
- **Sau MỖI commit:** cập nhật `D:\_project\DDC_dieu-phoi\phien-C.md` (task, nhánh, commit cuối, bước kế, file nóng đang giữ, giờ). Nhả khoá file nóng nào đã xong ở commit cuối cùng đụng tới nó.
- **Commit message:** tiếng Việt không dấu, dạng `feat(p7-c1): ...` / `test(p7-c1): ...` / `chore(p7-c1): ...`, giữ dòng `Co-Authored-By` của agent.
- **Không push.**

---

## Bước 1 - C-0: e2e tham số hoá theo `.env` của worktree

**Files:**
- Sửa: `e2e/helpers/env.ts`
- Sửa: `e2e/helpers/env.test.ts`
- Sửa: `e2e/global-setup.ts`
- Sửa: `playwright.config.ts`
- Sửa: `e2e/09-chan-chua-dang-nhap.spec.ts` (dòng 7 `const BASE = 'http://localhost:3001'`)

**Interface mới trong `e2e/helpers/env.ts`** (giữ nguyên `loadDotEnv`, `need`):

```ts
/** Cặp DB + cổng dev đã đăng ký cho e2e. KHÔNG BAO GIỜ thêm 'ddc_control_tower' (DB của A, dữ liệu thật). */
export const E2E_TARGETS: ReadonlyArray<{ dbName: string; port: string }> = [
  { dbName: 'ddc_control_tower_b', port: '3001' },
  { dbName: 'ddc_control_tower_c', port: '3003' },
];

/** NEXTAUTH_URL phải đúng dạng http://localhost:<cổng> (pathname '/', không query/hash/user). Sai -> null. */
export function parseE2eBaseUrl(nextAuthUrl: string): { baseURL: string; port: string } | null;

/** L-5: so khớp CHÍNH XÁC hostname 'localhost', port '5433', pathname '/<dbName>' với cặp có port trùng tham số. */
export function isExpectedDbUrl(dbUrl: string, port: string): boolean;

/** Gộp 2 hàm trên. Hợp lệ -> trả target; sai -> throw Error (thông điệp KHÔNG chứa DATABASE_URL). */
export function resolveE2eTarget(env: Record<string, string | undefined>): {
  baseURL: string;
  port: string;
  databaseUrl: string;
};
```

Quy tắc chi tiết:
- `parseE2eBaseUrl`: `new URL()` trong try/catch; hợp lệ khi `protocol === 'http:'`, `hostname === 'localhost'`, `port !== ''`, `pathname === '/'`, `search === ''`, `hash === ''`, `username === ''`, `password === ''`. Trả `baseURL = \`http://localhost:${port}\`` (không có `/` cuối).
- `isExpectedDbUrl`: `new URL()` trong try/catch (lỗi -> false); true khi và chỉ khi `hostname === 'localhost' && port === '5433'` và tồn tại phần tử `E2E_TARGETS` có `t.port === port && u.pathname === '/' + t.dbName`. Không dùng `includes()`/`startsWith()` trên chuỗi URL. Query `?schema=public` được phép.
- `resolveE2eTarget`: đọc `env.NEXTAUTH_URL ?? ''`, `env.DATABASE_URL ?? ''`.
  NEXTAUTH_URL sai -> `throw new Error('NEXTAUTH_URL phai co dang http://localhost:<cong> (vd http://localhost:3003) - sua .env')`.
  Cặp sai -> `throw new Error('DATABASE_URL + NEXTAUTH_URL khong khop cap da dang ky (ddc_control_tower_b + 3001, ddc_control_tower_c + 3003) - dung chay e2e (co the dinh DB cua A). Kiem tra .env.')`.
  Chuỗi cặp trong thông điệp dựng từ `E2E_TARGETS`, không gõ lặp.
- Sửa JSDoc của `isExpectedDbUrl` cho khớp (bỏ chữ "worktree B").

- [ ] **1.1 Viết test đỏ** trong `e2e/helpers/env.test.ts` (thay toàn bộ file, giữ tinh thần 6 case cũ, đổi sang chữ ký 2 tham số). Hằng dùng trong test:

```ts
const A = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower?schema=public';
const B = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower_b?schema=public';
const C = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public';
```

Case bắt buộc:
- `describe('isExpectedDbUrl')`:
  - `(B, '3001')` true; `(C, '3003')` true.
  - DB A false với mọi cổng `'3000'`, `'3001'`, `'3002'`, `'3003'`.
  - cặp lệch: `(C, '3001')` false; `(B, '3003')` false.
  - cổng chưa đăng ký: `(C, '3002')` false.
  - tên gần giống: `..._b2` với `'3001'` false, `..._c2` với `'3003'` false.
  - port Postgres khác (`localhost:5432/ddc_control_tower_c`, `'3003'`) false; host khác (`db.example.com:5433/ddc_control_tower_c`, `'3003'`) false.
  - `('', '3003')` và `('khong-phai-url', '3003')` false, không throw.
- `describe('parseE2eBaseUrl')`:
  - `'http://localhost:3003'` và `'http://localhost:3003/'` -> `{ baseURL: 'http://localhost:3003', port: '3003' }`.
  - null với: `'https://localhost:3003'`, `'http://127.0.0.1:3003'`, `'http://localhost'`, `'http://localhost:3003/vi'`, `'http://localhost:3003?x=1'`, `'http://evil.com:3003'`, `''`.
- `describe('resolveE2eTarget')`:
  - `{ NEXTAUTH_URL: 'http://localhost:3003', DATABASE_URL: C }` -> `{ baseURL: 'http://localhost:3003', port: '3003', databaseUrl: C }`.
  - `{ NEXTAUTH_URL: 'http://localhost:3000', DATABASE_URL: A }` throw.
  - `{ NEXTAUTH_URL: 'http://localhost:3001', DATABASE_URL: C }` throw.
  - thiếu `NEXTAUTH_URL` throw.
  - thông điệp lỗi không chứa `'pass@'` (bắt lỗi, kiểm `message`).
  - `E2E_TARGETS` không có phần tử nào `dbName === 'ddc_control_tower'`.

- [ ] **1.2 Chạy thấy đỏ:** `Set-Location 'D:\_project\DDC_Control_Tower-C'; npx vitest run e2e/helpers/env.test.ts` -> FAIL (hàm chưa có / sai chữ ký). Ghi output ngắn vào `.bangiao/thay-doi.md`.

- [ ] **1.3 Cài đặt `e2e/helpers/env.ts`** theo interface trên.

- [ ] **1.4 Sửa `e2e/global-setup.ts`:**
  - Giữ `const env = loadDotEnv(); Object.assign(process.env, env);`.
  - Thay khối kiểm `isExpectedDbUrl` + khối kiểm `NEXTAUTH_URL !== 'http://localhost:3001'` bằng `const { databaseUrl } = resolveE2eTarget(process.env);` (throw tự nổi lên).
  - Giữ kiểm `NOTIFY_SECRET_KEY`.
  - Lệnh seed + PrismaClient dùng `databaseUrl` (thay `dbUrl`).
  - Sửa JSDoc đầu hàm: bỏ "cua B", ghi "cap DB + cong da dang ky trong E2E_TARGETS, KHONG BAO GIO DB cua A".

- [ ] **1.5 Sửa `playwright.config.ts`:**

```ts
import { defineConfig, devices } from '@playwright/test';
import { loadDotEnv, resolveE2eTarget } from './e2e/helpers/env';

// .env thang bien shell (giong global-setup.ts). Sai cap DB + cong -> throw ngay, webServer khong khoi dong.
const target = resolveE2eTarget({ ...process.env, ...loadDotEnv() });
```

  - `use.baseURL: target.baseURL`.
  - `webServer.command: \`npx next dev -p ${target.port}\``, `webServer.url: \`${target.baseURL}/vi/login\``, `webServer.env: { NEXTAUTH_URL: target.baseURL, DATABASE_URL: target.databaseUrl }`.
  - Giữ nguyên mọi option khác (`testMatch`, `workers: 1`, `reuseExistingServer: true`, `projects`...).
  - Sửa comment đầu file: bỏ "cong 3001 + DB ddc_control_tower_b", ghi "cong + DB lay tu .env, chi cap trong E2E_TARGETS (e2e/helpers/env.ts)".

- [ ] **1.6 Sửa `e2e/09-chan-chua-dang-nhap.spec.ts` dòng 7:**

```ts
import { loadDotEnv, resolveE2eTarget } from './helpers/env';
const BASE = resolveE2eTarget({ ...process.env, ...loadDotEnv() }).baseURL;
```

- [ ] **1.7 Rà sót cổng/DB gõ cứng:** Grep `3001|ddc_control_tower_b` trong `e2e/` và `playwright.config.ts`; chỉ được còn trong `E2E_TARGETS` và `e2e/helpers/env.test.ts`.
  Riêng `src/lib/notify-message.test.ts` dòng 107 (`'http://localhost:3001/'`) là dữ liệu test thuần, KHÔNG sửa.

- [ ] **1.8 Cổng kiểm:** vitest file env xanh; `npx tsc --noEmit` sạch; `npm test` xanh.

- [ ] **1.9 Chạy e2e nền (trước khi sửa tính năng):**
  - Nếu chưa có Chromium: `Set-Location 'D:\_project\DDC_Control_Tower-C'; npx playwright install chromium`.
  - `Set-Location 'D:\_project\DDC_Control_Tower-C'; npx playwright test` (global-setup sẽ seed lại DB `ddc_control_tower_c`, đây là DB riêng của C, được phép).
  - Kiểm thêm lớp chặn: tạm đặt biến shell sai KHÔNG được vì `.env` thắng; thay vào đó chạy `npx vitest run e2e/helpers/env.test.ts` là đủ chứng minh. KHÔNG sửa `.env` sang DB A để thử.
  - Ghi vào `.bangiao/thay-doi.md` mục "Kết quả e2e nền (Bước 1)": số test pass/fail/skip, tên test đỏ + dòng lỗi chính. Test đỏ có sẵn không do Bước 1 gây ra: ghi rõ, vẫn điều tra gốc; sửa được trong phạm vi file cho phép thì sửa ở commit riêng `fix(e2e): ...`, không thì ghi lại và báo.

- [ ] **1.10 Commit:** `feat(p7-c1): e2e chay theo cap DB + cong trong .env, chan DB cua A (C-0)`.

---

## Bước 2 - 7.1: gỡ hẳn "xoá toàn bộ dữ liệu"

**Files:**
- Tạo: `src/server/reset-data-removed.test.ts`
- Xoá: `src/components/admin/ResetDataButton.tsx`
- Sửa: `app/[locale]/(app)/admin/page.tsx` (dòng 7 import, dòng 37-39 khối `<div className="flex justify-end"><ResetDataButton /></div>`)
- Sửa: `src/server/actions.ts` (xoá JSDoc dòng 290 + hàm `resetDataAction` dòng 291-303)
- Sửa: `src/server/repo/prisma-repo.ts` (xoá hàm `resetAllData` dòng 1180-1190, kể cả comment bên trong; giữ dấu `},` / `};` đóng object đúng cú pháp)
- Sửa: `src/server/repo/mock-repo.ts` (xoá JSDoc dòng 586 + hàm `resetAllData` dòng 587-612). KHÔNG đụng hàm `reset()` của mock-repo (test dùng).
- Đổi tên + sửa: `src/server/repo/prisma-repo-reset.test.ts` -> `src/server/repo/prisma-repo-remove-project.test.ts` (dùng `git mv`)
- Sửa: `src/server/admin-notify-page.test.ts` (xoá dòng 37 `vi.mock('@/components/admin/ResetDataButton', ...)`)
- Sửa: `src/i18n/messages/vi.json`, `en.json` (xoá `admin.resetData`, `admin.resetConfirm` dòng 429-430; GIỮ `activity.reset_data`, xem K7)

- [ ] **2.1 Viết test đỏ** `src/server/reset-data-removed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P7-C1 7.1: chuc nang "xoa toan bo du lieu" da go han (chu du an chot 2026-09-26),
 * khong con nut, action, ham repo hay key i18n nao dan toi hanh vi nay.
 */
const ROOT = process.cwd();
const src = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

describe('7.1 - khong con duong nao xoa toan bo du lieu', () => {
  it('khong con component ResetDataButton', () => {
    expect(existsSync(join(ROOT, 'src/components/admin/ResetDataButton.tsx'))).toBe(false);
  });
  it('trang /admin khong import/render ResetDataButton', () => {
    expect(src('app/[locale]/(app)/admin/page.tsx')).not.toMatch(/ResetDataButton/);
  });
  it('actions.ts khong con resetDataAction', () => {
    expect(src('src/server/actions.ts')).not.toMatch(/resetDataAction|resetAllData/);
  });
  it('prisma-repo va mock-repo khong con resetAllData', () => {
    expect(src('src/server/repo/prisma-repo.ts')).not.toMatch(/resetAllData/);
    expect(src('src/server/repo/mock-repo.ts')).not.toMatch(/resetAllData/);
  });
  it('vi/en khong con admin.resetData, admin.resetConfirm; van giu activity.reset_data cho nhat ky cu', () => {
    for (const f of ['src/i18n/messages/vi.json', 'src/i18n/messages/en.json']) {
      const m = JSON.parse(src(f)) as { admin: Record<string, unknown>; activity: Record<string, unknown> };
      expect(m.admin).not.toHaveProperty('resetData');
      expect(m.admin).not.toHaveProperty('resetConfirm');
      expect(m.activity).toHaveProperty('reset_data');
    }
  });
});
```

- [ ] **2.2 Chạy thấy đỏ:** `npx vitest run src/server/reset-data-removed.test.ts` -> FAIL (4 case đầu + phần admin của case 5).

- [ ] **2.3 Xoá/sửa code** theo danh sách Files.
  - `admin/page.tsx`: sau khi xoá khối `<div className="flex justify-end">`, fragment `<>` bắt đầu thẳng bằng `<Card className="overflow-visible">` (phân quyền người dùng). Không thêm phần tử thay thế.
  - `prisma-repo-remove-project.test.ts`: xoá JSDoc đầu file dòng 3-14 (nói về resetAllData) và cả `describe('prisma-repo.resetAllData ...')` dòng 60-81; xoá mock không còn dùng (`projectDeleteMany`, `auditLogDeleteMany`, khoá `project.deleteMany`, `auditLog`); GIỮ nguyên `describe('prisma-repo.removeProject - N-2 ...')` và JSDoc của nó.
    Nếu `import { beforeEach, describe, expect, it, vi }` còn thừa thì bỏ phần thừa.

- [ ] **2.4 Rà toàn repo:** Grep `resetDataAction|resetAllData|ResetDataButton|admin\.resetData|resetConfirm` (bỏ qua `node_modules`, `.next`, `.bangiao/archive`, `.claude`, `PROGRESS.md`).
  Chỉ được còn: test mới ở 2.1, và biến cục bộ `resetConfirm` trong `src/components/admin/UserEditor.tsx` (xác nhận mật khẩu, KHÔNG liên quan, không sửa).
  Không còn route API nào gọi tới reset (đã rà: không có).

- [ ] **2.5 Cổng kiểm:** test 2.1 xanh; `npx tsc --noEmit` sạch; `npm test` xanh (lưu ý `src/i18n/messages.test.ts` phải vẫn xanh: vi/en phủ key như nhau, action `reset_data` không còn trong `logActivity` nên không bị đòi key).

- [ ] **2.6 Commit:** `feat(p7-c1): go han chuc nang xoa toan bo du lieu o trang quan tri (7.1)`.
  Sau commit: nhả khoá `src/server/actions.ts`, `src/server/repo/prisma-repo.ts` trong `phien-C.md`.

---

## Bước 3 - 7.3: đổi tên app hiển thị

**Files:**
- Tạo: `src/i18n/messages-p7-c1.test.ts`
- Sửa: `src/i18n/messages/vi.json` dòng 3-4, `src/i18n/messages/en.json` dòng 3-4
- Sửa: `app/[locale]/layout.tsx` (thay `export const metadata` dòng 12-15)
- Sửa: `app/[locale]/login/page.tsx` dòng 22
- Sửa: `src/lib/notify-message.ts` dòng 65, 69; `src/lib/notify-message.test.ts` dòng 98, 101
- Sửa: `src/i18n/messages.test.ts` (thêm 2 dòng vào `CHANGED_SOURCES`)
- KHÔNG sửa: `src/components/layout/AppShell.tsx` (dòng 109-110 đã đúng thứ tự, dòng 79 giữ theo K5), trừ trường hợp fallback ở Bước 5.

Giá trị mới:

| Key | vi.json | en.json |
|---|---|---|
| `app.headerTitle` | `BÁO CÁO QUẢN TRỊ` | `MANAGEMENT REPORTS` |
| `app.name` | `Danh Mục Dự Án` | `Project Portfolio` |

`app.subtitle`, `app.builtBy` giữ nguyên.

- [ ] **3.1 Viết test đỏ** `src/i18n/messages-p7-c1.test.ts` (khuôn `src/i18n/messages-p3cb-9-10.qa.test.ts`):
  - vi: `app.headerTitle === 'BÁO CÁO QUẢN TRỊ'`, `app.name === 'Danh Mục Dự Án'`.
  - en: `app.headerTitle === 'MANAGEMENT REPORTS'`, `app.name === 'Project Portfolio'`.
  - Không file nào trong `app/[locale]/layout.tsx`, `app/[locale]/login/page.tsx`, `src/lib/notify-message.ts`, `src/components/layout/AppShell.tsx` còn chuỗi `'DDC Control Tower'` ngoài comment: đọc file, bỏ các dòng mà phần trim bắt đầu bằng `*`, `//`, `/*`, `{/*`, rồi `expect(...).not.toContain('DDC Control Tower')`.
  - Không chuỗi `'Performance Hub'` trong `vi.json`, `en.json`.
  - (Case 7.6 thêm ở Bước 4, cùng file.)

- [ ] **3.2 Chạy thấy đỏ:** `npx vitest run src/i18n/messages-p7-c1.test.ts` -> FAIL.

- [ ] **3.3 Sửa `vi.json`/`en.json`** 2 giá trị trên, giữ nguyên thứ tự key.

- [ ] **3.4 Sửa `app/[locale]/layout.tsx`:** thêm `getTranslations` vào import `next-intl/server` (đang có `getMessages`), thay `export const metadata` bằng:

```ts
export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale });
  return {
    title: `${t('app.headerTitle')} - ${t('app.name')}`,
    icons: { icon: '/favicon.svg' },
  };
}
```

  Locale lạ (vd `/xx`): `src/i18n/request.ts` đã rơi về `defaultLocale`, còn layout vẫn `notFound()` như cũ; không thêm xử lý.
  Dùng `t('app.xxx')` đầy đủ (KHÔNG dùng `namespace: 'app'`) để regex của `src/i18n/messages.test.ts` bắt được key.

- [ ] **3.5 Sửa `app/[locale]/login/page.tsx` dòng 22:** `<h1>{t('app.headerTitle')}</h1>` (biến `t` đã có ở dòng 12).

- [ ] **3.6 Sửa `src/lib/notify-message.ts`** theo K6 và cập nhật kỳ vọng tương ứng ở `src/lib/notify-message.test.ts` dòng 98, 101. Không đổi trường nào khác.

- [ ] **3.7 Thêm vào `CHANGED_SOURCES` trong `src/i18n/messages.test.ts`** (thêm ở cuối object, sau dòng `'TopPriorityList'`):

```ts
  'layout [locale] (metadata)': 'app/[locale]/layout.tsx',
  'trang /login': 'app/[locale]/login/page.tsx',
```

- [ ] **3.8 Rà test/e2e khẳng định chữ cũ:** Grep `DDC Control Tower|Performance Hub|headerTitle` trong `src`, `app`, `e2e` (file `.ts`/`.tsx`).
  Chỉ được còn: comment `src/components/icons/index.tsx` dòng 4 (không sửa), `AppShell.tsx` dòng 79 và 109 (dùng key), `layout.tsx`, `login/page.tsx` (dùng key), test mới.
  Đã rà sẵn: không spec e2e nào khẳng định chữ cũ.

- [ ] **3.9 Cổng kiểm:** test 3.1 xanh; `npx tsc --noEmit` sạch; `npm test` xanh.

- [ ] **3.10 Commit:** `feat(p7-c1): doi ten app thanh BAO CAO QUAN TRI / Danh Muc Du An, tieu de tab theo locale (7.3)`.

---

## Bước 4 - 7.6: đổi chữ `detail.tl.gap`

**Files:**
- Sửa: `src/i18n/messages/vi.json` dòng 201: `"gap": "Chênh lệch KH vs TT"`.
- Sửa: `src/i18n/messages/en.json` dòng 201: `"gap": "Plan vs Actual variance"`.
- Sửa: `src/i18n/messages-p7-c1.test.ts` (thêm case).
- KHÔNG sửa `app/[locale]/(app)/projects/[id]/page.tsx` (dòng 264 tự thêm `: ` sau nhãn), KHÔNG sửa `src/server/projects-detail-page-render.test.ts` (kiểm theo key, vẫn đúng).

- [ ] **4.1 Test đỏ:** thêm vào `src/i18n/messages-p7-c1.test.ts`: vi `detail.tl.gap === 'Chênh lệch KH vs TT'`, en `detail.tl.gap === 'Plan vs Actual variance'`. Chạy thấy FAIL.
- [ ] **4.2 Sửa 2 giá trị.** Chạy lại thấy PASS.
- [ ] **4.3 Cổng kiểm:** `npx tsc --noEmit`, `npm test`.
- [ ] **4.4 Commit:** `feat(p7-c1): doi nhan timeline thanh Chenh lech KH vs TT (7.6)`.
  Sau commit: nhả khoá `vi.json`, `en.json` trong `phien-C.md` (trừ khi Bước 5 phải sửa lại, khi đó nhả sau Bước 5).

---

## Bước 5 - e2e giao diện tên app + chạy trọn bộ e2e trên 3003 / DB `_c`

**Files:**
- Sửa: `e2e/helpers/i18n.ts` (thêm `en()`)
- Tạo: `e2e/10-ten-app.spec.ts`
- Có thể sửa (chỉ khi rơi vào nhánh fallback 5.4): `src/components/layout/AppShell.tsx` dòng 109.

- [ ] **5.1 `e2e/helpers/i18n.ts`:** tách phần tra key thành hàm nội bộ `lookup(messages, key, vars)`, nạp thêm `en.json`, export thêm:

```ts
/** Như vi() nhưng đọc src/i18n/messages/en.json. */
export function en(key: string, vars?: Record<string, string | number>): string;
```

  Chữ ký và hành vi `vi()` giữ nguyên.

- [ ] **5.2 Viết `e2e/10-ten-app.spec.ts`** (`test.use({ storageState: 'e2e/.auth/admin.json' })`, comment không dấu). Gọi `T = { vi, en }` để chọn helper theo locale. Các test:
  1. **Sidebar desktop, vi và en** (viewport 1280x800): `page.goto(\`/${loc}/overview\`)`;
     `aside.side .brand .nm b` có text `T[loc]('app.headerTitle')`, `aside.side .brand .nm span` có text `T[loc]('app.name')`;
     `page` có title `\`${T[loc]('app.headerTitle')} - ${T[loc]('app.name')}\``.
     Đo bằng `evaluate` cho cả `b` và `span`: `scrollWidth <= clientWidth`; chiều cao `getBoundingClientRect().height` nhỏ hơn `1.5 * parseFloat(getComputedStyle(el).lineHeight)` (đúng 1 dòng); `nm.getBoundingClientRect().right <= aside.getBoundingClientRect().right`; `span.top >= b.bottom` (dòng mờ nằm dưới dòng đậm, không đè).
     Chụp `aside.side` ra `test-results/p7-sidebar-${loc}-desktop.png`.
  2. **Sidebar thu gọn** (desktop, vi và en): bấm nút đầu tiên trong `header.topbar`; `aside.side` có class `is-collapsed`; `.brand .nm` không hiển thị (`toBeHidden`); logo `.brand .appicon` vẫn hiển thị và nằm trọn trong `aside`. Chụp `test-results/p7-sidebar-${loc}-collapsed.png`.
  3. **Drawer mobile** (viewport 390x844, vi và en): bấm nút đầu tiên trong `header.topbar`; `aside.side` có class `is-open`; đo lại như test 1. Chụp `test-results/p7-sidebar-${loc}-mobile.png`.
  4. **Trang đăng nhập** (context mới không cookie `browser.newContext({ storageState: { cookies: [], origins: [] } })`, vi và en): `/${loc}/login` có `h1` text `T[loc]('app.headerTitle')`, h1 đúng 1 dòng (cùng cách đo), title trang đúng như test 1. Chụp `.authcard` ra `test-results/p7-login-${loc}.png`.

- [ ] **5.3 Chạy spec mới:** `Set-Location 'D:\_project\DDC_Control_Tower-C'; npx playwright test e2e/10-ten-app.spec.ts`.
  Mở từng ảnh `test-results/p7-*.png` (Read ảnh) và soát kỹ: chữ không tràn, không đè logo, không bị cắt, khoảng cách dòng đậm/mờ đều như trước, căn trái thẳng hàng với cũ.
  Mở thêm `/vi/admin` (chụp đầu trang) kiểm khoảng trống phía trên thẻ "Phân quyền người dùng" sau khi bỏ khối nút reset: không còn khoảng trống thừa so với các trang khác.

- [ ] **5.4 Nhánh fallback (chỉ khi test 1 hoặc 3 đỏ vì dòng đậm xuống 2 dòng/tràn ở vi hoặc en):**
  Ở `src/components/layout/AppShell.tsx` dòng 109 đổi thành `<b style={{ fontSize: 'var(--t-caption1)' }}>{t('app.headerTitle')}</b>` (13px xuống 12px, áp cho CẢ 2 locale để nhất quán), chạy lại 5.3.
  Vẫn đỏ: DỪNG, không sửa `app/globals.css`, ghi số đo (scrollWidth/clientWidth/chiều cao) + ảnh vào `.bangiao/thay-doi.md` và báo lại.
  Nếu dùng fallback: ghi rõ vào `thay-doi.md` lý do và số đo trước/sau.

- [ ] **5.5 Chạy trọn bộ e2e:** `Set-Location 'D:\_project\DDC_Control_Tower-C'; npx playwright test` (cổng 3003, DB `ddc_control_tower_c`).
  Ghi vào `.bangiao/thay-doi.md` mục "Kết quả e2e trọn bộ (Bước 5)": lệnh đã chạy, số pass/fail/skip, thời gian, so với kết quả nền Bước 1.
  Test đỏ: điều tra gốc (xem trace trong `e2e/.report`), sửa nếu trong phạm vi file cho phép, không thì ghi rõ và báo; KHÔNG ghi "xanh" khi chưa thấy output xanh.

- [ ] **5.6 Cổng kiểm cuối:** `npx tsc --noEmit` sạch; `npm test` xanh.

- [ ] **5.7 Commit:** `test(p7-c1): e2e ten app o sidebar/login/tab vi+en, ket qua e2e tron bo tren 3003` (kèm `AppShell.tsx` nếu dùng fallback).
  Cập nhật `phien-C.md`, nhả mọi khoá file nóng còn giữ.

---

## Trường hợp biên bắt buộc (tóm tắt để tester soát)

- `DATABASE_URL` trỏ `ddc_control_tower` với BẤT KỲ cổng nào: e2e dừng trước khi khởi động server và trước khi seed.
- Cặp lệch (DB C + 3001, DB B + 3003), cổng lạ (3002), tên DB gần giống (`_b2`, `_c2`), host/port Postgres khác, URL rỗng/không parse được: đều từ chối, không throw ở `isExpectedDbUrl`.
- `NEXTAUTH_URL` có đường dẫn, query, https, host khác `localhost`, thiếu cổng: từ chối.
- Thông điệp lỗi e2e không lộ mật khẩu trong `DATABASE_URL`.
- Nhật ký hoạt động cũ có action `reset_data` vẫn hiển thị được ở /admin (giữ `activity.reset_data`).
- Tên app dài hơn (en "MANAGEMENT REPORTS") không xuống dòng/tràn ở sidebar desktop, drawer mobile; sidebar thu gọn chỉ còn logo.
- Tiêu đề tab đúng theo locale (`/vi/...` tiếng Việt, `/en/...` tiếng Anh), kể cả trang đăng nhập.
- vi/en vẫn phủ key như nhau (`src/i18n/messages.test.ts`).

## Tự rà (planner)

- C-0: Bước 1 (test đỏ `isExpectedDbUrl` từ chối DB A, nhận cặp C, từ chối cặp lệch; config + global-setup + spec 09; chạy e2e 3003 ở 1.9 và 5.5).
- 7.1: Bước 2 (component, page, action, repo prisma + mock, test cũ, key i18n, grep toàn repo).
- 7.3: Bước 3 (JSON, tab title theo locale, h1 login, tin nhắn thử, fallback dòng 79 giữ theo K5, xác nhận `defaultLocale`) + Bước 5 (e2e pixel sidebar vi/en/thu gọn/mobile).
- 7.6: Bước 4.
- Không đụng `schema.prisma`, không page mới, không key i18n mới.
