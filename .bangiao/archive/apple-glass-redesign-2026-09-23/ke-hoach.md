# Apple Glass Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans` để chạy plan này theo từng Task. Các bước dùng checkbox (`- [ ]`).

**Goal:** Thay toàn bộ hệ thiết kế UI của DDC Control Tower từ Apple-đỏ (`#B91C1C`) sang "Apple Glass" navy `#1d5a9e` trên nền `#e9eef6`, lấy nguyên token từ `mockup-apple-glass.html`, áp dụng nhất quán cho **mọi** trang đang chạy.

**Architecture:** Một lớp token CSS-variable (`app/tokens.css`) + một lớp component-class copy nguyên từ mock-up (`app/globals.css`, trong `@layer components`). Component React chỉ **đổi className**, không đổi logic. Dark/light chạy bằng `prefers-color-scheme` + `[data-theme]` override — bỏ hẳn kiểu `.dark .bg-white{}` cũ. Hai test "canh" tự động (token + quét class cũ) bảo đảm không sót file nào.

**Tech Stack:** Next.js 14.2.15 (App Router), React 18.3.1, TypeScript 5.5.4, Tailwind CSS 3.4.10, Recharts 2.12.7, next-intl 3.26.3, Vitest 2.1.1 (node env).

**Spec:** `D:\_project\DDC_Control_Tower\mockup-apple-glass.html` (155KB). **Đây là đặc tả DUY NHẤT.** Mọi số đo/màu/blur/bo góc lấy từ file này. Plan có chỉ **số dòng chính xác** để copy — copy từ file, đừng gõ lại tay.

---

## CÂU HỎI CÒN BỎ NGỎ — ĐÃ CHỦ DỰ ÁN CHỐT (2026-09-23)

Chủ dự án đã trả lời trực tiếp cả 6 câu chặn Task. Coder đọc "QUYẾT ĐỊNH" ở mỗi câu, làm đúng
theo đó — không tự suy diễn lại từ phần mô tả câu hỏi phía trên.

**Q1 — Logo. (CHẶN Task 2, Task 12)**
Mock-up không dùng `logo.png`. Nó vẽ `.appicon`: ô bo superellipse (`--r-icon: 22.37%`), gradient navy `linear-gradient(160deg,#4e8ed0,#1d5a9e 46%,#0e2741)`, bên trong là glyph biểu đồ cột trắng (mock-up dòng 562–563). Logo Đại Dũng thật (`public/logo.png`) màu đỏ.
→ **QUYẾT ĐỊNH: (b)** Giữ `logo.png` đỏ, đặt trên nền trắng bo góc `--r-icon`. KHÔNG dùng `.appicon` navy vẽ tay của mock-up. Áp dụng cho cả sidebar lẫn trang login.

**Q2 — Chỗ đặt công tắc giao diện sáng/tối. (CHẶN Task 2)**
Mock-up: segmented control 2 nút `Sáng | Tối` nằm trên topbar (dòng 585). App hiện tại: 3 lựa chọn `Sáng / Tối / Hệ thống` nằm trong SettingsMenu (bánh răng ở chân sidebar).
→ **QUYẾT ĐỊNH: (c)** Không thêm gì lên topbar. Giữ nguyên 3 lựa chọn `Sáng/Tối/Hệ thống` trong SettingsMenu như hiện tại — chỉ đổi giao diện kính cho menu đó, không đổi vị trí/số lượng lựa chọn.

**Q3 — Sidebar thu gọn + drawer mobile. (CHẶN Task 2)**
Mock-up: sidebar cố định 236px, **không** có nút thu gọn, **không** có hamburger, **không** có drawer mobile. App hiện tại có cả ba (thu gọn còn 68px, hamburger ở header, drawer che màn hình dưới 1024px).
→ **QUYẾT ĐỊNH: (a)** Giữ cả 3 tính năng (thu gọn, hamburger, drawer mobile) — mock-up không vẽ nên coder TỰ thiết kế trạng thái kính hợp lý cho chúng (dùng đúng token blur/elevation/motion đã có ở Task 1, nhất quán phong cách với phần mock-up có vẽ).

**Q4 — Motion engine. (CHẶN Task 3)**
Mock-up có engine spring vật lý bằng rAF (dòng 1156–1230): `riseIn` (card trồi lên so le 35ms/card), `pressable` (nhấn co lại 0.972 rồi bật về), `hoverLift` (rê chuột nâng 3px). Đây là JS thuần, port sang React cần 1 hook + 1 wrapper component.
→ **QUYẾT ĐỊNH: (a)** Port đủ engine spring sang React (`src/components/ui/motion.ts` + hook `useRise`/`usePressable`) — làm y hệt mock-up, không dùng bản CSS xấp xỉ.

**Q5 — Widget HUD đo FPS. (CHẶN Task 9)**
Mock-up có `.hud` góc phải dưới hiện `Render — fps · Spring 400/30 · Regular 22px` (dòng 1147–1148, CSS 426–434). Đây là dụng cụ trình diễn, không phải chức năng nghiệp vụ.
→ **QUYẾT ĐỊNH: (a)** KHÔNG ship. Bỏ hẳn `.hud`, không đưa vào app thật dưới bất kỳ hình thức nào (kể cả chỉ hiện lúc dev).

**Q6 — Hình nền mesh động `.wall`. (CHẶN Task 1)**
Mock-up có 4 quả cầu màu `blur(90px)` bay chậm 26–35s vô hạn (CSS 144–156). Vật liệu kính **cần** nó để có cái mà làm mờ. Nhưng trang Tổng quan/Chi tiết dự án của app có 6–10 biểu đồ Recharts chạy cùng lúc, 4 layer blur 90px animate liên tục sẽ ăn GPU.
→ **QUYẾT ĐỊNH: (b)** Giữ nguyên 3-4 quả cầu gradient màu làm nền (giữ đúng màu/vị trí/kích thước/blur của mock-up) nhưng **TẮT HẲN animation drift** — đứng yên, không `@keyframes`/không JS di chuyển. Áp dụng đồng nhất cho MỌI trang (không cần phân biệt trang nhiều/ít biểu đồ vì đã tắt hẳn, không còn gánh nặng GPU để cân nhắc riêng).

**Q7 — Tag vàng "Trọng tâm" gắn cho KPI nào. (KHÔNG chặn — chủ dự án CHƯA trả lời, ÁP DỤNG MẶC ĐỊNH (a) dưới đây. Có thể đổi ý bất kỳ lúc nào trước khi Task 4 kết thúc.)**
Mock-up Tổng quan gắn tag "Trọng tâm" cho **3/6** KPI: `% Thực tế BQ`, `SPI danh mục`, `CPI danh mục` (dòng 595–597). App hiện chỉ gắn `hero` cho **1** thẻ: `Chậm tiến độ` (`kpi.behindSchedule`). Danh sách 6 KPI của app khác mock-up (Tổng dự án / Đang triển khai / Chậm tiến độ / Nguy cơ phạt / Đã bị phạt / Backlog).
→ **MẶC ĐỊNH ĐANG ÁP DỤNG: (a)** giữ đúng hiện trạng (1 tag trên "Chậm tiến độ"). Lựa chọn (b) gắn tag cho 3 thẻ khác — nếu chủ dự án muốn đổi, cần nói rõ tên 3 thẻ.

**Q8 — Có thêm phần tử thuần-trình-bày mà mock-up vẽ nhưng app chưa có không? (KHÔNG chặn — chủ dự án CHƯA trả lời, ÁP DỤNG MẶC ĐỊNH (a) dưới đây. Có thể đổi ý bất kỳ lúc nào trước khi Task 10 kết thúc.)**
Mock-up trang Chi tiết dự án có: `.cdpanel` đồng hồ đếm ngược tới ngày HT kế hoạch (dòng 636–640), `.tl` thanh timeline Kế hoạch vs Thực tế kèm vạch "Hôm nay" (661–674). Cả hai **không cần dữ liệu mới** — `plannedStartDate`/`plannedFinishDate`/`actualStartDate`/`committedHandoverDate` đã có trong DB và đã render dạng text ở `projects/[id]/page.tsx`.
→ **MẶC ĐỊNH ĐANG ÁP DỤNG: (a)** không thêm, đúng phạm vi "chỉ đổi giao diện". Lựa chọn (b) thêm cả 2, hoặc (c) chỉ thêm timeline — nếu chủ dự án muốn đổi, nói rõ lựa chọn nào.

---

## Global Constraints

Áp cho **mọi** Task. Coder đọc lại mục này trước mỗi Task.

1. **Không đụng nghiệp vụ.** Không sửa: `src/server/**`, `src/lib/**` (trừ khi Task ghi rõ), `prisma/**`, `src/data/**`, bất kỳ server action / query / repo nào. Không đổi props nghiệp vụ, không đổi luồng dữ liệu, không thêm/bớt field hiển thị. Chỉ đổi `className`, CSS, và giá trị màu truyền vào Recharts.
2. **Accent là navy `#1d5a9e`.** Đỏ `#B91C1C` bị loại hoàn toàn. Vàng `#f5b301` **được giữ** làm màu nhấn (`--gold`). Đây là chủ ý của chủ dự án — **không** "sửa lại cho đúng thương hiệu đỏ".
3. **Nguồn màu duy nhất là CSS variable.** Trong `.tsx` cấm hardcode hex. Cấm dùng `dark:` variant của Tailwind (token tự đổi theo theme). Cấm dùng họ màu Tailwind cũ (`slate-*`, `navy-*`, `red-*`, `amber-*`, `emerald-*`, `blue-*`, `accent*`, `gold-soft`, `canvas`, `offwhite`).
4. **Không dùng opacity modifier lên màu token.** `text-label/60` sẽ hỏng vì token là chuỗi `rgba()` thô, không có `<alpha-value>`. Cần mờ hơn thì dùng token có sẵn (`--label2`, `--label3`, `--label4`).
5. **Copy CSS từ spec, đừng gõ lại.** Mọi khối CSS trong plan đều có số dòng trong `mockup-apple-glass.html`. Mở file, copy đúng đoạn đó.
6. **Cổng kiểm tra cuối mỗi Task** (cả 4 phải xanh):
   - `npx tsc --noEmit`
   - `npm test`
   - `npx next lint` (nếu có cấu hình; không có thì bỏ)
   - Mở `npm run dev` → kiểm mắt các URL mà Task ghi, ở **cả** `data-theme=light` **và** `data-theme=dark`.
   `npm run build` chạy được thì chạy; nếu thiếu `DATABASE_URL` thì bỏ qua, không phải lỗi của Task.
7. **Commit từng Task một**, message tiếng Việt không dấu, prefix `style(glass):`.
8. **i18n:** thêm key mới là phải thêm vào **cả** `src/i18n/messages/vi.json` **và** `src/i18n/messages/en.json`, nếu không `src/i18n/messages.test.ts` sẽ đỏ.
9. **Test hiện có phải giữ xanh.** `src/server/operation-pages-render.test.ts`, `compliance-page.test.ts`, `projects-detail-page-month-guard.test.ts` render thật các page — đổi markup sai cú pháp sẽ làm chúng đỏ. Đó là tính năng, không phải phiền toái.

---

## File Structure

**Tạo mới**
| File | Trách nhiệm |
|---|---|
| `app/tokens.css` | Chỉ chứa custom property. 3 khối: `:root` (sáng), `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, `:root[data-theme="dark"]`. Không có selector nào khác. |
| `src/ui/design-tokens.test.ts` | Parse `app/tokens.css`, khẳng định đủ và đúng từng token. |
| `src/ui/legacy-style-guard.test.ts` | Quét `app/**/*.tsx` + `src/components/**/*.tsx` tìm dấu vết hệ cũ. Có danh sách `PENDING` co dần theo từng Task. |
| `src/components/dashboard/useChartTokens.ts` | Hook client đọc màu series từ CSS variable lúc chạy (Recharts không hiểu `var()` trong attribute SVG). |

**Sửa** — `app/globals.css`, `tailwind.config.ts`, `app/[locale]/layout.tsx`, và 42 file `.tsx` có `className` (liệt kê đủ trong `PENDING` ở Task 1).

**Vì sao toàn bộ component-class nằm trong một `app/globals.css`:** `@layer components` chỉ được Tailwind xử lý trong chính file có `@tailwind` directive. Tách ra file khác rồi `@import` sẽ để lại `@layer` thô (postcss-import **không** có trong `postcss.config.js`). Token thì tách được vì custom property không phụ thuộc thứ tự cascade.

---

### Task 1: Lớp token + cơ chế theme + 2 test canh

**Files:**
- Create: `app/tokens.css`
- Create: `src/ui/design-tokens.test.ts`
- Create: `src/ui/legacy-style-guard.test.ts`
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css` (thêm `@layer base` + `.wall`; **giữ nguyên** khối `.dark .xxx{}` cũ từ dòng 21–196)
- Modify: `app/[locale]/layout.tsx`
- Modify: `src/components/layout/SettingsMenu.tsx` (chỉ hàm `applyTheme`, dòng 27–32)

**Interfaces:**
- Produces: `app/tokens.css` — toàn bộ token; mọi Task sau dùng qua `var(--x)`.
- Produces: `PENDING: string[]` trong `src/ui/legacy-style-guard.test.ts` — mỗi Task sau xoá phần của mình khỏi mảng này.
- Produces: `applyTheme(theme: 'light' | 'dark' | 'system'): void` — đặt/xoá `data-theme` trên `<html>`, đồng thời bắn `window.dispatchEvent(new Event('ddc:theme'))`.
- **Chặn bởi Q6** (animation `.wall`).

- [ ] **Bước 1: Viết `app/tokens.css`**

Mở `mockup-apple-glass.html`, copy **nguyên văn dòng 16 → 128** (từ `:root{` tới `}` đóng khối `:root[data-theme="dark"]`) vào `app/tokens.css`. Không sửa một ký tự nào. Thêm header:

```css
/* ============================================================
   DDC · Apple Glass — Design Token
   Nguon: mockup-apple-glass.html dong 16-128. Copy nguyen van.
   Sua token o day, KHONG sua rai rac trong component.
   ============================================================ */
```

- [ ] **Bước 2: Viết test token — phải ĐỎ trước khi có gì cả**

Tạo `src/ui/design-tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Token la hop dong giua CSS va moi component. Sai 1 gia tri la lech ca he.
 * Test nay doc thang app/tokens.css va doi chieu voi bang chep tu
 * mockup-apple-glass.html (dong 16-128).
 */
const CSS = readFileSync(join(process.cwd(), 'app/tokens.css'), 'utf-8');

/** Tach 1 khoi selector ra khoi file (khong xu ly nested nhieu tang). */
function block(startMarker: string): string {
  const i = CSS.indexOf(startMarker);
  expect(i, `khong tim thay khoi "${startMarker}"`).toBeGreaterThan(-1);
  return CSS.slice(i, CSS.indexOf('\n}', i));
}

function tokensOf(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

const LIGHT: Record<string, string> = {
  '--mat-ultrathin': '8px', '--mat-thin': '14px', '--mat-regular': '22px',
  '--mat-thick': '34px', '--mat-chrome': '44px', '--mat-sat': '180%',
  '--r-xs': '8px', '--r-sm': '12px', '--r-md': '16px', '--r-lg': '20px',
  '--r-xl': '26px', '--r-2xl': '32px', '--r-full': '999px', '--r-icon': '22.37%',
  '--t-caption2': '11px', '--t-caption1': '12px', '--t-footnote': '13px',
  '--t-subhead': '15px', '--t-callout': '16px', '--t-body': '17px',
  '--t-title3': '20px', '--t-title2': '22px', '--t-title1': '28px', '--t-large': '34px',
  '--lh-tight': '1.12', '--lh-snug': '1.3', '--lh-body': '1.47',
  '--tr-large': '-0.026em', '--tr-title': '-0.02em', '--tr-body': '-0.006em',
  '--e0': 'none',
  '--e1': '0 .5px 1px rgba(10,31,61,.05), 0 1px 3px rgba(10,31,61,.05)',
  '--e2': '0 1px 2px rgba(10,31,61,.05), 0 6px 16px rgba(10,31,61,.07)',
  '--e3': '0 4px 10px rgba(10,31,61,.06), 0 16px 38px rgba(10,31,61,.10)',
  '--e4': '0 10px 24px rgba(10,31,61,.10), 0 30px 68px rgba(10,31,61,.16)',
  '--inner-hi': 'inset 0 .5px 0 rgba(255,255,255,.75)',
  '--ease-ios': 'cubic-bezier(.32,.72,0,1)',
  '--ease-out': 'cubic-bezier(.22,1,.36,1)',
  '--ease-std': 'cubic-bezier(.4,0,.2,1)',
  '--dur-fast': '.18s', '--dur-base': '.32s', '--dur-slow': '.52s',
  '--label': '#0a1f3d', '--label2': 'rgba(10,31,61,.62)',
  '--label3': 'rgba(10,31,61,.42)', '--label4': 'rgba(10,31,61,.24)',
  '--sep': 'rgba(10,31,61,.10)', '--sep-2': 'rgba(10,31,61,.16)',
  '--bg-base': '#e9eef6',
  '--glass': 'rgba(255,255,255,.60)', '--glass-2': 'rgba(255,255,255,.42)',
  '--glass-3': 'rgba(255,255,255,.80)', '--glass-stroke': 'rgba(255,255,255,.72)',
  '--fill': 'rgba(10,31,61,.05)', '--fill-2': 'rgba(10,31,61,.08)',
  '--accent': '#1d5a9e', '--accent-2': '#2a6db4', '--accent-deep': '#0e2741',
  '--accent-tint': 'rgba(29,90,158,.12)',
  '--gold': '#f5b301',
  '--s-plan': '#93b8e0', '--s-actual': '#1d5a9e', '--s-cost': '#a86a12',
  '--s-third': '#0f8a63', '--s-third-lt': '#6fbf9b', '--s-neutral': '#c3cddb',
  '--grid': 'rgba(10,31,61,.08)', '--axis': 'rgba(10,31,61,.42)',
  '--ok': '#248a3d', '--ok-fill': 'rgba(52,199,89,.16)',
  '--warn': '#b25000', '--warn-fill': 'rgba(255,149,0,.16)',
  '--danger': '#c30d0d', '--danger-fill': 'rgba(255,59,48,.14)',
  '--info': '#1d5a9e', '--info-fill': 'rgba(29,90,158,.12)',
};

const DARK: Record<string, string> = {
  '--label': '#f2f5f9', '--label2': 'rgba(235,242,250,.62)',
  '--label3': 'rgba(235,242,250,.40)', '--label4': 'rgba(235,242,250,.22)',
  '--sep': 'rgba(255,255,255,.10)', '--sep-2': 'rgba(255,255,255,.16)',
  '--bg-base': '#0a1020',
  '--glass': 'rgba(28,38,58,.58)', '--glass-2': 'rgba(28,38,58,.40)',
  '--glass-3': 'rgba(30,41,62,.82)', '--glass-stroke': 'rgba(255,255,255,.10)',
  '--fill': 'rgba(255,255,255,.06)', '--fill-2': 'rgba(255,255,255,.10)',
  '--inner-hi': 'inset 0 .5px 0 rgba(255,255,255,.14)',
  '--accent': '#4e8ed0', '--accent-2': '#6ba6e0', '--accent-deep': '#123a66',
  '--accent-tint': 'rgba(78,142,208,.18)',
  '--s-plan': '#2f6197', '--s-actual': '#7ab0ea', '--s-cost': '#c07d1a',
  '--s-third': '#12996b', '--s-third-lt': '#0d6349', '--s-neutral': '#33456b',
  '--grid': 'rgba(255,255,255,.08)', '--axis': 'rgba(235,242,250,.40)',
  '--ok': '#30d158', '--ok-fill': 'rgba(48,209,88,.16)',
  '--warn': '#ff9f0a', '--warn-fill': 'rgba(255,159,10,.16)',
  '--danger': '#ff6961', '--danger-fill': 'rgba(255,69,58,.16)',
  '--info': '#7ab0ea', '--info-fill': 'rgba(122,176,234,.16)',
  '--e1': '0 .5px 1px rgba(0,0,0,.30), 0 1px 3px rgba(0,0,0,.24)',
  '--e2': '0 1px 2px rgba(0,0,0,.30), 0 6px 16px rgba(0,0,0,.34)',
  '--e3': '0 4px 10px rgba(0,0,0,.34), 0 16px 38px rgba(0,0,0,.42)',
  '--e4': '0 10px 24px rgba(0,0,0,.42), 0 30px 68px rgba(0,0,0,.52)',
};

describe('design token: khoi sang', () => {
  const got = tokensOf(block(':root{'));
  for (const [k, v] of Object.entries(LIGHT)) {
    it(`${k} = ${v}`, () => expect(got[k]).toBe(v));
  }
  it('color-scheme: light', () => expect(block(':root{')).toContain('color-scheme: light'));
});

describe('design token: override [data-theme="dark"]', () => {
  const got = tokensOf(block(':root[data-theme="dark"]{'));
  for (const [k, v] of Object.entries(DARK)) {
    it(`${k} = ${v}`, () => expect(got[k]).toBe(v));
  }
  it('khong doi --gold trong dark', () => expect(got['--gold']).toBeUndefined());
});

describe('design token: override theo prefers-color-scheme', () => {
  it('co khoi media dark loai tru data-theme=light', () => {
    expect(CSS).toContain('@media (prefers-color-scheme: dark)');
    expect(CSS).toContain(':root:not([data-theme="light"])');
  });
  it('khoi media dark co cung bo token voi khoi data-theme=dark', () => {
    const media = tokensOf(block('@media (prefers-color-scheme: dark)'));
    for (const [k, v] of Object.entries(DARK)) expect(media[k], k).toBe(v);
  });
});
```

- [ ] **Bước 3: Chạy test token, xác nhận ĐỎ rồi XANH**

`npx vitest run src/ui/design-tokens.test.ts`
Nếu chưa tạo `app/tokens.css` ở bước 1 → FAIL `ENOENT`. Tạo xong chạy lại → PASS toàn bộ. Sai một giá trị nào thì đọc lại đúng dòng trong mock-up, đừng sửa test.

- [ ] **Bước 4: Viết test canh style cũ — bắt đầu với PENDING đầy đủ 42 file**

Tạo `src/ui/legacy-style-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Chan viec sot file khi doi he thiet ke. Moi Task xoa phan cua minh khoi PENDING
 * TRUOC khi sua code -> test do -> sua xong -> test xanh. Task cuoi cung PENDING = [].
 */
const ROOT = process.cwd();

/** File duoc phep chua hex tho vi ly do chinh dang (logo hang thu ba...). */
const HEX_ALLOW = new Set<string>([
  'src/components/layout/LoginForm.tsx', // mau thuong hieu Google trong icon dang nhap
]);

/** Con no: file chua doi sang he Apple Glass. Xoa dan theo tung Task. */
const PENDING: string[] = [
  // Task 2 - shell
  'src/components/layout/AppShell.tsx',
  'src/components/layout/SettingsMenu.tsx',
  'src/components/layout/TopProgressBar.tsx',
  'src/components/layout/SyncProgressBar.tsx',
  'app/[locale]/layout.tsx',
  // Task 3 - surface
  'src/components/ui/Card.tsx',
  'src/components/ui/Badge.tsx',
  'src/components/ui/Badges.tsx',
  'src/components/ui/Skeleton.tsx',
  // Task 4 - kpi
  'src/components/dashboard/KpiCard.tsx',
  // Task 5 - bang
  'src/components/dashboard/ProjectTable.tsx',
  'src/components/dashboard/Watchlist.tsx',
  'src/components/alerts/AlertList.tsx',
  // Task 6 - form nho
  'src/components/dashboard/FilterBar.tsx',
  'src/components/form/Combobox.tsx',
  'src/components/form/CreateProjectForm.tsx',
  'src/components/project/ProjectSwitcher.tsx',
  'src/components/project/WhatIf.tsx',
  'src/components/ui/PasswordInput.tsx',
  'src/components/layout/ChangePasswordModal.tsx',
  // Task 7 - wizard nhap lieu
  'src/components/form/DataEntryForm.tsx',
  'src/components/form/ImportPanel.tsx',
  // Task 8 - admin editor
  'src/components/admin/UserEditor.tsx',
  'src/components/admin/FieldEditor.tsx',
  'src/components/admin/ActivityViewer.tsx',
  'src/components/admin/DeleteProject.tsx',
  'src/components/admin/ResetDataButton.tsx',
  // Task 9 - chart
  'src/components/dashboard/charts.tsx',
  'src/components/dashboard/DrillCharts.tsx',
  'src/components/dashboard/ChartLabels.tsx',
  'src/components/project/ManpowerDailyChart.tsx',
  // Task 10 - 2 dashboard chinh
  'app/[locale]/(app)/overview/page.tsx',
  'app/[locale]/(app)/projects/[id]/page.tsx',
  'src/components/dashboard/OverviewWidgets.tsx',
  // Task 11 - cac trang con lai
  'app/[locale]/(app)/report/page.tsx',
  'app/[locale]/(app)/alerts/page.tsx',
  'app/[locale]/(app)/compliance/page.tsx',
  'app/[locale]/(app)/audit/page.tsx',
  'app/[locale]/(app)/admin/page.tsx',
  'app/[locale]/(app)/nhap-lieu/page.tsx',
  'app/[locale]/(app)/import/page.tsx',
  'app/[locale]/(app)/data-dictionary/page.tsx',
  'app/[locale]/(app)/data-schema/page.tsx',
  'app/[locale]/not-found.tsx',
  // Task 12 - dang nhap
  'app/[locale]/login/page.tsx',
  'src/components/layout/LoginForm.tsx',
];

const BANNED: { re: RegExp; why: string }[] = [
  {
    re: /(?:^|[\s"'`:[])(?:[a-z-]+:)*(?:text|bg|border|ring|divide|from|via|to|fill|stroke|placeholder|outline|decoration|accent|shadow|rounded)-(?:slate|navy|red|amber|emerald|blue|accent|gold-soft|canvas|offwhite|card)(?:-(?:soft|hover|\d{1,3}))?(?:\/\d{1,3})?\b/,
    why: 'palette Tailwind cu - dung token --label/--fill/--accent...',
  },
  { re: /\bbg-white(?:\/\d{1,3})?\b/, why: 'bg-white - dung --glass/--glass-3 qua class .card/.mat' },
  { re: /\bdark:/, why: 'bien the dark: - token tu doi theo theme, khong can dark:' },
  { re: /\btable-zebra\b/, why: 'zebra cu - mock-up chi co hover, khong soc mau' },
  { re: /#B91C1C/i, why: 'do cu #B91C1C' },
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(relative(ROOT, p).split(sep).join('/'));
  }
  return out;
}

const FILES = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src/components'))]
  .filter((f) => f !== 'src/components/icons/index.tsx'); // chi dung currentColor

describe('canh style cu', () => {
  it('PENDING khong liet ke file khong ton tai', () => {
    expect(PENDING.filter((f) => !FILES.includes(f))).toEqual([]);
  });

  for (const file of FILES) {
    const done = !PENDING.includes(file);
    it(`${file} ${done ? '(da doi)' : '(con no - bo qua)'}`, () => {
      if (!done) return;
      const src = readFileSync(join(ROOT, file), 'utf-8');
      for (const { re, why } of BANNED) {
        const m = src.match(re);
        expect(m, `${file}: con "${m?.[0]}" -> ${why}`).toBeNull();
      }
      if (!HEX_ALLOW.has(file)) {
        const m = src.match(HEX);
        expect(m, `${file}: con hex tho "${m?.[0]}" -> dua vao app/tokens.css`).toBeNull();
      }
    });
  }
});
```

- [ ] **Bước 5: Chạy test canh, xác nhận XANH (mọi file đang nằm trong PENDING nên đều bỏ qua)**

`npx vitest run src/ui/legacy-style-guard.test.ts` → PASS. Nếu `PENDING khong liet ke file khong ton tai` đỏ thì sửa đường dẫn trong `PENDING` cho khớp thực tế (chú ý dấu `/` chứ không phải `\`).

- [ ] **Bước 6: Nối token vào Tailwind**

Thay toàn bộ `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  // Toi khi CA HAI dieu kien: co [data-theme="dark"], HOAC he dieu hanh toi ma
  // khong bi [data-theme="light"] de len. Tailwind 3.4 cho phep mang format,
  // moi format bat buoc chua '&'.
  darkMode: [
    'variant',
    [
      '&:is([data-theme="dark"] *)',
      '@media (prefers-color-scheme: dark){&:not([data-theme="light"] *)}',
    ],
  ],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- He Apple Glass (nguon: app/tokens.css) ---
        // KHONG dung opacity modifier (text-label/60) - token la rgba tho.
        label: 'var(--label)',
        label2: 'var(--label2)',
        label3: 'var(--label3)',
        label4: 'var(--label4)',
        sep: 'var(--sep)',
        sep2: 'var(--sep-2)',
        base: 'var(--bg-base)',
        glass: 'var(--glass)',
        glass2: 'var(--glass-2)',
        glass3: 'var(--glass-3)',
        'glass-stroke': 'var(--glass-stroke)',
        fill: 'var(--fill)',
        fill2: 'var(--fill-2)',
        brand: 'var(--accent)',
        'brand-2': 'var(--accent-2)',
        'brand-deep': 'var(--accent-deep)',
        'brand-tint': 'var(--accent-tint)',
        gold: 'var(--gold)',
        ok: 'var(--ok)',
        'ok-fill': 'var(--ok-fill)',
        warn: 'var(--warn)',
        'warn-fill': 'var(--warn-fill)',
        danger: 'var(--danger)',
        'danger-fill': 'var(--danger-fill)',
        info: 'var(--info)',
        'info-fill': 'var(--info-fill)',

        // --- Di san: XOA o Task 12, giu tam de trang chua doi khong mat mau ---
        navy: {
          50: '#eef2f7', 100: '#d9e2ee', 200: '#b3c4da', 300: '#8aa5c4',
          400: '#4f729d', 500: '#204060', 600: '#12314f', 700: '#0e2741',
          800: '#0a1f3d', 900: '#071832', 950: '#04101f',
        },
        accent: { DEFAULT: '#B91C1C', soft: '#FEE2E2' },
        canvas: '#f5f7fa',
        offwhite: '#e8e4d9',
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-lg)', xl: 'var(--r-xl)', '2xl': 'var(--r-2xl)',
        full: 'var(--r-full)', icon: 'var(--r-icon)',
        card: '16px', // di san - xoa o Task 12
      },
      boxShadow: {
        e0: 'var(--e0)', e1: 'var(--e1)', e2: 'var(--e2)',
        e3: 'var(--e3)', e4: 'var(--e4)',
        card: '0 1px 2px rgba(10,31,61,0.04), 0 4px 16px rgba(10,31,61,0.06)', // di san
        'card-hover': '0 6px 20px rgba(10,31,61,0.12)', // di san
      },
      fontSize: {
        caption2: 'var(--t-caption2)', caption1: 'var(--t-caption1)',
        footnote: 'var(--t-footnote)', subhead: 'var(--t-subhead)',
        callout: 'var(--t-callout)', body: 'var(--t-body)',
        title3: 'var(--t-title3)', title2: 'var(--t-title2)',
        title1: 'var(--t-title1)', large: 'var(--t-large)',
      },
      letterSpacing: {
        large: 'var(--tr-large)', title: 'var(--tr-title)', body: 'var(--tr-body)',
      },
      transitionTimingFunction: {
        ios: 'var(--ease-ios)', out: 'var(--ease-out)', std: 'var(--ease-std)',
      },
      transitionDuration: { fast: '180', base: '320', slow: '520' },
      backdropBlur: {
        ultrathin: 'var(--mat-ultrathin)', thin: 'var(--mat-thin)',
        regular: 'var(--mat-regular)', thick: 'var(--mat-thick)',
        chrome: 'var(--mat-chrome)',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text',
          'var(--font-inter)', 'system-ui', 'Segoe UI', 'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Bước 7: Base layer + hình nền `.wall` trong `app/globals.css`**

Chèn **ngay sau** 3 dòng `@tailwind` (dòng 1–3), **trước** khối `html, body {` cũ. Xoá luôn khối `html,body{...}` và `body{...}` cũ (dòng 5–19) vì khối mới thay thế. **Giữ nguyên** toàn bộ khối `.dark .xxx{}` (dòng 21–196) — Task 12 mới xoá.

```css
/* ============================================================
   DDC · Apple Glass — nen tang
   Token: app/tokens.css. CSS component: cuoi file nay.
   ============================================================ */
@layer base {
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font-size: var(--t-subhead);
    line-height: var(--lh-body);
    letter-spacing: var(--tr-body);
    color: var(--label);
    background: var(--bg-base);
    background-image: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv11', 'ss01';
    font-variant-numeric: tabular-nums;
    overflow-x: hidden;
  }
  h1, h2, h3, h4, p { margin: 0; }
  button, input, select, textarea { font: inherit; color: inherit; }
}

@layer components {
  /* --- Hinh nen mesh: vat lieu kinh can co cai de lam mo --- */
  /* Copy CSS tu mockup-apple-glass.html dong 145-156 vao day (.wall, .wall b,
     4 rule nth-child, 3 @keyframes drift, 2 rule giam opacity o dark). */
}

/* --- Thanh cuon --- */
* { scrollbar-width: thin; scrollbar-color: var(--sep-2) transparent; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: var(--sep-2); border-radius: 8px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Xoá luôn khối `@layer components { .card ... .card-hover ... .label ... }` cũ (dòng 242–252) và khối `.table-zebra` (198–210), `@keyframes headerSlideIn` + `.header-title` (226–240), `@media prefers-reduced-motion` cũ (254–261) — chúng bị thay hoặc bỏ.

> **Chặn Q6.** Có trả lời rồi mới điền `.wall`: (a) copy y nguyên 145–156; (b) copy 145–151 nhưng bỏ thuộc tính `animation`, bỏ 3 `@keyframes`; (c) copy y nguyên + thêm `body[data-noanim] .wall b{animation:none}` rồi Task 10 gắn `data-noanim` cho 3 trang có biểu đồ.

- [ ] **Bước 8: Đổi cơ chế theme trong `app/[locale]/layout.tsx`**

Thay dòng 7 `import '../globals.css';` thành 2 dòng:
```tsx
import '../tokens.css';
import '../globals.css';
```

Thay nội dung `dangerouslySetInnerHTML` (dòng 30–34) bằng:
```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var t=localStorage.getItem('ddc-theme')||'system';var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t)}else{r.removeAttribute('data-theme')}if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){r.classList.add('dark')}}catch(e){}})();`,
  }}
/>
```
(Vẫn gắn `.dark` song song để các trang chưa đổi không mất dark-mode giữa chừng. Task 12 gỡ.)

Thêm `<div className="wall" aria-hidden="true"><b/><b/><b/><b/></div>` làm phần tử **đầu tiên** trong `<body>`, trước `<NextIntlClientProvider>`.

- [ ] **Bước 9: `applyTheme` trong `SettingsMenu.tsx`**

Thay hàm `applyTheme` (dòng 27–32) bằng:
```tsx
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark); // di san, Task 12 xoa
  window.dispatchEvent(new Event('ddc:theme')); // chart doc lai mau token
}
```

- [ ] **Bước 10: Chạy cổng kiểm tra + kiểm mắt**

```
npx tsc --noEmit
npm test
npm run dev
```
Mở `http://localhost:3000/vi/overview`. Kỳ vọng: nền chuyển sang `#e9eef6` có 4 vệt màu mờ; chữ vẫn đọc được; bấm bánh răng → Giao diện → Tối thì `<html>` có `data-theme="dark"` và nền thành `#0a1020`. Giao diện còn lộn xộn (sidebar vẫn đỏ) — **đúng như dự kiến**, Task 2 mới sửa.

- [ ] **Bước 11: Commit**
```bash
git add app/tokens.css app/globals.css tailwind.config.ts "app/[locale]/layout.tsx" src/components/layout/SettingsMenu.tsx src/ui
git commit -m "style(glass): Task 1 - lop token + co che data-theme + 2 test canh"
```

---

### Task 2: Vỏ ứng dụng — sidebar + topbar + 2 thanh tiến trình

**Files:**
- Modify: `app/globals.css` (thêm khối CSS shell vào `@layer components`)
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/SettingsMenu.tsx`
- Modify: `src/components/layout/TopProgressBar.tsx:32-37`
- Modify: `src/components/layout/SyncProgressBar.tsx:25-28`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá 5 dòng nhóm "Task 2 - shell" khỏi `PENDING`)
- Có thể thêm key: `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`

**Interfaces:**
- Consumes: token từ Task 1.
- Produces: các class `.app .side .brand .appicon .sgrp .nav .foot .main .topbar .ttl .search .seg .avatar .page .sect` — Task 10/11 dùng `.page` và `.sect`.
- **Chặn bởi Q1 (logo), Q2 (chỗ đặt công tắc theme), Q3 (thu gọn/drawer).**

- [ ] **Bước 1: Gỡ 5 file khỏi PENDING → test phải ĐỎ**

Trong `src/ui/legacy-style-guard.test.ts` xoá 5 dòng dưới comment `// Task 2 - shell`.
`npx vitest run src/ui/legacy-style-guard.test.ts` → FAIL 4–5 case, ví dụ `AppShell.tsx: con "bg-[#B91C1C]"`. Đúng kỳ vọng.

- [ ] **Bước 2: Copy CSS shell vào `app/globals.css`**

Trong `@layer components`, ngay dưới khối `.wall`, dán **nguyên văn dòng 172–227** của `mockup-apple-glass.html` (từ `.app{` tới hết `.sect i{...}`). Đó là: `.app .side .brand .appicon .brand .nm b .brand .nm span .sgrp .nav .nav svg .nav:hover .nav.on .nav.on svg .side .foot .main .topbar .topbar .ttl .topbar .ttl h1 .topbar .ttl p .search .search:focus-within .search input .seg .seg button .seg button.on .avatar .page .sect .sect b .sect i`.

Rồi thêm phần bù cho những trạng thái mock-up không có (chỉ thêm nếu Q3 = (a) hoặc (b)):

```css
  /* --- Bu cho trang thai mock-up khong ve (xem Q3) --- */
  .side.is-collapsed { width: 68px; flex: 0 0 68px; }
  .side.is-collapsed .brand .nm,
  .side.is-collapsed .sgrp,
  .side.is-collapsed .nav span,
  .side.is-collapsed .foot p { display: none; }
  .side.is-collapsed .brand { justify-content: center; padding: 8px 0 16px; }
  .side.is-collapsed .nav { justify-content: center; }

  @media (max-width: 1023px) {
    .side {
      position: fixed; inset: 0 auto 0 0; z-index: 60;
      transform: translate3d(-100%, 0, 0);
      transition: transform var(--dur-base) var(--ease-ios);
    }
    .side.is-open { transform: none; box-shadow: var(--e4); }
  }
  .side-scrim {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(10, 31, 61, 0.36);
    -webkit-backdrop-filter: blur(var(--mat-ultrathin));
    backdrop-filter: blur(var(--mat-ultrathin));
  }
  @media (min-width: 1024px) { .side-scrim { display: none; } }

  /* --- Thanh tien trinh (mock-up khong ve; dung accent, vang danh cho tag Trong tam) --- */
  .progbar { position: fixed; inset-inline: 0; top: 0; z-index: 100; height: 2px; }
  .progbar i {
    display: block; height: 100%; background: var(--accent);
    box-shadow: 0 0 8px var(--accent-tint);
    transition: width var(--dur-base) var(--ease-out);
  }
```

- [ ] **Bước 3: Viết lại `AppShell.tsx`**

Giữ **nguyên** phần trên dòng 78 (import, `NavItem`, `NAV`, `OPERATIONS_NAV`, `ADMIN_NAV`, `ROLE_LABEL`, chữ ký `AppShell`, các `useState`, các biến `navItems`/`operationsItems`/`adminItems`/`allNav`/`activeNav`/`pageTitle`). Chỉ thay từ `navItemCls` (dòng 78) tới hết file.

Bảng đổi class:

| Cũ | Mới |
|---|---|
| `<div className="flex min-h-screen">` | `<div className="app">` |
| `<aside className="fixed ... bg-[#B91C1C] text-white ...">` | `<aside className={\`side ${collapsed ? 'is-collapsed' : ''} ${open ? 'is-open' : ''}\`}>` |
| khối logo `flex h-16 items-center gap-3 border-b border-white/10 px-5` | `<div className="brand">` + `<div className="appicon">…</div>` + `<div className="nm"><b>{t('app.headerTitle')}</b><span>{t('app.name')}</span></div>` |
| `navItemCls` | `'nav'`; item đang mở thêm `' on'` |
| `<Icon size={20} className="shrink-0"/>` | `<Icon size={19} />` (`.nav svg` đã set 19px) |
| `<p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">` | `<div className="sgrp">` |
| các `<div className="mt-2 border-t border-white/10 pt-3">` bọc nhóm | bỏ hẳn div bọc; `.sgrp` đã tự tạo khoảng cách |
| `<div className="flex items-center justify-between border-t border-white/10 px-5 py-4">` | `<div className="foot">` với `display:flex;align-items:center;justify-content:space-between` thêm bằng utility `flex items-center justify-between` |
| `<p className="text-[11px] text-yellow-200/70">` | `<p>{t('app.builtBy')}</p>` (kế thừa `.foot`) |
| scrim `fixed inset-0 z-30 bg-navy-950/40 lg:hidden` | `<div className="side-scrim" onClick={...} />` |
| `<div className="flex min-h-screen w-full flex-col ... lg:pl-60">` | `<div className="main">` (bỏ `pl-*`: `.app` là flex, `.side` chiếm chỗ thật) |
| `<header className="sticky ... bg-[#B91C1C] ...">` | `<header className="topbar">` |
| `<h1 className="truncate text-base font-bold ...">` | `<div className="ttl"><h1>{pageTitle}</h1></div>` |
| nút hamburger `rounded-lg p-2 text-white hover:bg-white/15` | `className="nav" style={{width:'auto',padding:'6px'}}` — hoặc bỏ hẳn nếu Q3=(c) |
| avatar `grid h-8 w-8 ... rounded-full bg-white/20 text-xs font-bold text-white` | `<div className="avatar">{user.name.charAt(0).toUpperCase()}</div>` |
| khối tên+vai trò `hidden text-right leading-tight sm:block` với `text-white` / `text-gold` | `<div className="hidden text-right leading-tight sm:block"><div className="text-caption1 text-label">{user.name}</div><div className="text-caption2 font-semibold text-brand">{t(ROLE_LABEL[user.role])}</div></div>` |
| `<main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">` | `<main className="page">` |

`SearchBox` (dòng 180–207): giữ toàn bộ logic, chỉ đổi JSX trả về:
```tsx
return (
  <div className="search">
    <IconSearch size={15} />
    <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t('common.searchProject')} />
  </div>
);
```
Bỏ `mx-auto hidden w-full max-w-md ... md:flex` — `.search` đã có `margin-left:auto;width:230px`. Muốn ẩn ở mobile thì thêm utility `hidden md:flex`.

> **Chặn Q1.** `.appicon` chứa gì: (a) copy glyph SVG ở mock-up dòng 562–563; (b) `<Image src="/logo.png" .../>` bọc trong `.appicon` có `background:#fff`; (c) như (a) ở đây.
> **Chặn Q2.** Nếu (a)/(b): thêm `<div className="seg">` với các nút `data-theme` vào topbar giữa `.search` và `.avatar`, gọi thẳng `applyTheme` + `localStorage.setItem('ddc-theme', …)`; đồng thời xoá `<Section label={t('settings.theme')}>` khỏi `SettingsMenu.tsx` (dòng 180–193). Nếu (c): không đụng topbar, không đụng SettingsMenu phần theme.
> **Chặn Q3.** Nếu (c): xoá `useState collapsed`, `useState open`, nút hamburger, scrim, và khối CSS `.side.is-collapsed` + `@media (max-width:1023px)` ở Bước 2.

Nếu dùng `t('app.name')` mà key chưa có — đã có sẵn (`app.name = "DDC Control Tower"` ở `vi.json` dòng 3). Không cần thêm key.

- [ ] **Bước 4: `SettingsMenu.tsx` — menu thả xuống dùng kính**

Chỉ đổi class, giữ nguyên toàn bộ logic/state.

| Cũ (dòng) | Mới |
|---|---|
| nút bánh răng `rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white` (142) | `className="rounded-sm p-2 text-label3 transition-colors duration-fast ease-std hover:bg-fill hover:text-label"` |
| panel `absolute bottom-full right-0 z-50 mb-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:...` (149) | `className="mat mat-chrome absolute bottom-full right-0 z-50 mb-1 w-56 overflow-hidden rounded-md"` |
| `Section` wrapper `border-b border-slate-100 dark:border-slate-700` (77) | `border-b border-sep` |
| `Section` nút `... text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700` (80) | `... text-caption2 font-bold uppercase tracking-[.06em] text-label3 hover:bg-fill` |
| avatar `bg-navy-800 text-sm font-semibold text-white` (152) | `<div className="avatar" style={{ width: 36, height: 36, flex: '0 0 36px' }}>` |
| tên `text-navy-900 dark:text-slate-100` (156) | `text-footnote font-medium text-label` |
| vai trò `text-[11px] text-slate-500` (157) | `text-caption2 text-label3` |
| `itemCls` (132) | `'flex w-full items-center gap-2 px-3 py-2 text-footnote transition-colors duration-fast ease-std hover:bg-fill'` |
| `activeCls` (133) | `'text-brand font-semibold'` |
| `idleCls` (134) | `'text-label2'` |
| nút đăng xuất `text-red-600 dark:text-red-400` (225) | `text-danger` |
| viền `border-slate-100 ... dark:border-slate-700` (151) | `border-sep` |

- [ ] **Bước 5: 2 thanh tiến trình**

`TopProgressBar.tsx` — thay JSX trả về (dòng 31–38):
```tsx
return (
  <div className="progbar">
    <i style={{ width: `${progress}%` }} />
  </div>
);
```
`SyncProgressBar.tsx` — thay JSX trả về (dòng 24–29) y hệt.
Không đụng bất kỳ `useEffect`/`useState` nào ở hai file.

- [ ] **Bước 6: Chạy cổng kiểm tra**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Cả 3 xanh.

- [ ] **Bước 7: Kiểm mắt**

`npm run dev` → `http://localhost:3000/vi/overview`:
- Sidebar kính trong mờ, không còn đỏ; mục đang mở có nền `--accent-tint` chữ navy.
- Topbar kính, tiêu đề trang bên trái, ô tìm kiếm bên phải, avatar gradient navy.
- Đổi sang Tối: sidebar/topbar chuyển nền tối, chữ sáng, không còn mảng trắng lạc lõng.
- Thu nhỏ cửa sổ < 1024px: drawer hoạt động (nếu Q3 ≠ c).
- Chuyển trang: thanh tiến trình 2px navy chạy ở mép trên.

- [ ] **Bước 8: Commit**
```bash
git add app/globals.css src/components/layout src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 2 - sidebar + topbar + thanh tien trinh theo vat lieu kinh"
```

---

### Task 3: Bề mặt nền tảng — Card, chip, alert, skeleton, section

**Files:**
- Modify: `app/globals.css` (thêm khối CSS surface)
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/Badge.tsx`
- Modify: `src/components/ui/Badges.tsx`
- Modify: `src/components/ui/Skeleton.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 3 - surface")

**Interfaces:**
- Produces: `.mat .mat-thin .mat-chrome .card .card>.hd .card>.bd .en .g2 .g3 .g21 .chip .c-ok .c-warn .c-dan .c-info .c-plain .mono .bar-mini .legend .alert .rise .card-hover`
- Produces: `Card` nhận thêm prop `padded?: boolean` — mặc định `false`; `true` thì thêm `p-4` (thay cho các chỗ đang viết `<Card className="p-5">`).
- Produces: `Badge` giữ nguyên chữ ký `{ tone?: BadgeTone }` với `BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'`.
- **Chặn bởi Q4 (motion engine).**

- [ ] **Bước 1: Gỡ 4 file khỏi PENDING → test ĐỎ**

Xoá nhóm `// Task 3 - surface`. `npx vitest run src/ui/legacy-style-guard.test.ts` → FAIL ở `Badge.tsx` (`bg-emerald-50`…), `Skeleton.tsx` (`bg-slate-200/70`), `Card.tsx` (`text-navy-900`).

- [ ] **Bước 2: Copy CSS bề mặt vào `app/globals.css`**

Trong `@layer components`, dán nguyên văn các đoạn sau của `mockup-apple-glass.html`:
- **159–169** → `.mat`, `.mat-thin`, `.mat-chrome`
- **230–252** → `.card`, `.card>.hd`, `.card>.hd h3`, `.en`, `.card>.bd`, `.g2`, `.g3`, `.g21`, `@media(max-width:1180px)`, `.chip`, `.c-ok`, `.c-warn`, `.c-dan`, `.c-info`, `.c-plain`
- **288** → `.mono`
- **371–372** → `.bar-mini`, `.bar-mini i`
- **375–378** → `.legend`, `.legend span`, `.legend i`, `.legend .ln`
- **414–419** → `.alert`, `.alert .dot`, `.alert h4`, `.alert p`, `.alert .mt`
- **353–359** → `.msdetail` và con (Task 7 dùng cho thanh bước của wizard)

Thêm 3 quy tắc bù (mock-up để cho JS lo, ta làm bằng CSS):

```css
  /* Ho tro: card bi overflow:hidden se cat dropdown ben trong.
     Cho nao co Combobox/menu thi them utility "overflow-visible". */
  .card-hover {
    transition: transform var(--dur-base) var(--ease-ios),
                box-shadow var(--dur-base) var(--ease-ios);
  }
  .card-hover:hover { transform: translate3d(0, -3px, 0); box-shadow: var(--e3), var(--inner-hi); }

  /* Khung xuong tai trang */
  .sk {
    border-radius: var(--r-sm);
    background: linear-gradient(90deg, var(--fill) 25%, var(--fill-2) 37%, var(--fill) 63%);
    background-size: 400% 100%;
    animation: skShimmer 1.4s var(--ease-std) infinite;
  }
  @keyframes skShimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
```

Và phần `.rise` — **chặn Q4**:
- Nếu Q4 = (b): thêm
```css
  @keyframes riseIn {
    from { opacity: 0; transform: translate3d(0, 14px, 0); }
    to   { opacity: 1; transform: none; }
  }
  .rise { animation: riseIn var(--dur-base) var(--ease-ios) both; }
  .rise:nth-child(2) { animation-delay: .035s; }
  .rise:nth-child(3) { animation-delay: .07s; }
  .rise:nth-child(4) { animation-delay: .105s; }
  .rise:nth-child(5) { animation-delay: .14s; }
  .rise:nth-child(6) { animation-delay: .175s; }
  .btn:active, .nav:active, .kpi.tap:active { transform: scale(.972); }
```
- Nếu Q4 = (a): tạo thêm `src/components/ui/motion.ts` port hàm `spring` (mock-up dòng 1164–1187) sang TS, cộng hook `useRise(ref)` gọi `riseIn` trong `useEffect`, hook `usePressable(ref)` và `useHoverLift(ref, dy)` port từ dòng 1190–1230. Chỉ dùng trong Client Component. Card server-side vẫn phải render đầy đủ (không được `opacity:0` mặc định bằng CSS, nếu không JS tắt là trang trắng) — đúng theo failsafe 900ms ở mock-up dòng 1194–1195.

- [ ] **Bước 3: Viết lại `src/components/ui/Card.tsx`**

```tsx
import type { HTMLAttributes } from 'react';

/**
 * Be mat kinh chuan. Mac dinh KHONG co padding - dung <CardBody> cho phan than.
 * Luu y: .card co overflow:hidden (theo mock-up). Card nao chua dropdown/popover
 * (Combobox, ProjectSwitcher, menu sap xep) phai them className="overflow-visible".
 */
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card card-hover ${className}`} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="hd">
      <h3>
        {title}
        {subtitle && <span className="en">{subtitle}</span>}
      </h3>
      {action}
    </div>
  );
}

export function CardBody({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bd ${className}`} {...props} />;
}
```
Lưu ý: `.card>.hd` và `.card>.bd` là selector con trực tiếp — `CardHeader`/`CardBody` **phải** là con trực tiếp của `Card`. Chỗ nào đang bọc thêm div thì bỏ div đó.

- [ ] **Bước 4: Viết lại `src/components/ui/Badge.tsx`**

```tsx
import type { HTMLAttributes } from 'react';

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  ok: 'c-ok',
  warn: 'c-warn',
  danger: 'c-dan',
  info: 'c-info',
  neutral: 'c-plain',
};

export function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={`chip ${TONES[tone]} ${className}`} {...props} />;
}

/** Cham trang thai nho - mau lay tu token, an theo theme. */
export function Dot({ tone }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' }) {
  const v = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--label3)' }[tone];
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: v }}
    />
  );
}
```

- [ ] **Bước 5: `src/components/ui/Badges.tsx`**

Chỉ một chỗ phải sửa — dòng 41: `<span className="text-xs text-slate-400">-</span>` → `<span className="text-caption1 text-label3">-</span>`. Mọi thứ còn lại đi qua `Badge` nên tự đổi theo.

- [ ] **Bước 6: `src/components/ui/Skeleton.tsx`**

```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`sk ${className}`} />;
}

export function CardSkeleton({ h = 180 }: { h?: number }) {
  return (
    <div className="card">
      <div className="bd">
        <Skeleton className="mb-3 h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <div className="mt-4" style={{ height: h }}>
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Bước 7: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt `/vi/overview` và `/vi/alerts`: card nay là kính bo 20px, có viền sáng 0.5px, đổ bóng 2 tầng; tiêu đề card nằm trong dải có gạch chân mảnh; badge thành chip bo tròn không còn viền `ring`. Card hover nhấc lên 3px.

- [ ] **Bước 8: Commit**
```bash
git add app/globals.css src/components/ui src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 3 - card/chip/alert/skeleton theo vat lieu kinh"
```

---

### Task 4: Thẻ KPI (scorecard)

**Files:**
- Modify: `app/globals.css` (thêm khối `.kpis`/`.kpi`)
- Modify: `src/components/dashboard/KpiCard.tsx` (viết lại toàn bộ)
- Modify: `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` (thêm `kpi.focusTag`)
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 4 - kpi")

**Interfaces:**
- Consumes: token Task 1, `.chip` Task 3.
- Produces: `KpiCard` **giữ nguyên chữ ký cũ** để 3 nơi gọi (`OverviewWidgets.tsx`, `report/page.tsx`, `projects/[id]/page.tsx`) không phải sửa:
  ```ts
  export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger';
  export interface KpiCardProps {
    label: string; value: string; sub?: string;
    delta: number | null; deltaSuffix?: string;
    tone?: KpiTone; invertDelta?: boolean; hero?: boolean;
    icon: (p: IconProps) => React.ReactNode;
  }
  ```
  `hero: true` → render `.kpi key` (nền gradient navy + tag vàng "Trọng tâm", **không** hiện icon). `hero: false` → `.kpi` thường (có icon ở `.ic`).
- Produces: class `.kpis` cho lưới 6 cột — Task 10/11 dùng thay cho `grid grid-cols-2 … xl:grid-cols-6`.
- Liên quan Q7 (không chặn).

- [ ] **Bước 1: Gỡ `KpiCard.tsx` khỏi PENDING → test ĐỎ**

`npx vitest run src/ui/legacy-style-guard.test.ts` → FAIL `KpiCard.tsx: con "bg-navy-50"`.

- [ ] **Bước 2: Copy CSS KPI vào `app/globals.css`**

Trong `@layer components`, dán nguyên văn **dòng 254–280** của `mockup-apple-glass.html`: `.kpis`, 2 `@media`, `.kpi`, `.kpi .lb`, `.kpi .vl`, `.kpi .sb`, `.kpi .ic`, `.kpi .ic svg`, `.kpi.tap`, `.kpi.tap:hover .ic`, `.kpi.key`, `.kpi.key .lb`, `.kpi.key .sb`, `.kpi.key .tag`, `.kpi.key .chip`.

Thêm 2 quy tắc bù (mock-up không cần vì chỉ có 6 thẻ; app có lúc 5, lúc 4, lúc 2):
```css
  /* Bien the so cot - app co luoi 5 / 4 / 2 thay vi luon 6 */
  .kpis.k5 { grid-template-columns: repeat(5, 1fr); }
  .kpis.k4 { grid-template-columns: repeat(4, 1fr); }
  .kpis.k2 { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 1180px) { .kpis.k5, .kpis.k4 { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 680px)  { .kpis.k5, .kpis.k4 { grid-template-columns: repeat(2, 1fr); } }

  /* Mui ten delta trong .sb - mock-up viet ky tu tho "▼", ta dung icon nen can can chinh */
  .kpi .sb .delta { display: inline-flex; align-items: center; gap: 2px; font-weight: 650; }
  .kpi .sb .delta.up { color: var(--ok); }
  .kpi .sb .delta.down { color: var(--danger); }
  .kpi.key .sb .delta.up,
  .kpi.key .sb .delta.down { color: #fff; }
```

- [ ] **Bước 3: Thêm key i18n**

`src/i18n/messages/vi.json` — trong object `"kpi"`, thêm `"focusTag": "Trọng tâm"`.
`src/i18n/messages/en.json` — trong object `"kpi"`, thêm `"focusTag": "Focus"`.

- [ ] **Bước 4: Viết lại `src/components/dashboard/KpiCard.tsx`**

`KpiCard` hiện là Server Component (không có `'use client'`), nhưng cần `useTranslations` cho tag. Server Component **không** dùng `useTranslations` của next-intl client. Cách rẻ nhất, không đổi API: thêm `'use client'` vào đầu file — thẻ KPI thuần hiển thị, không có payload nặng.

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { IconArrowDown, IconArrowUp, type IconProps } from '@/components/icons';

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger';

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta: number | null;
  deltaSuffix?: string;
  tone?: KpiTone;
  invertDelta?: boolean;
  /** true -> the "Trong tam": nen gradient navy + tag vang, khong hien icon. */
  hero?: boolean;
  icon: (p: IconProps) => React.ReactNode;
}

/** Mau chu so chinh theo sac thai. The hero luon chu trang (nen gradient). */
const TONE_VALUE: Record<KpiTone, string> = {
  neutral: 'var(--label)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaSuffix,
  tone = 'neutral',
  invertDelta = false,
  hero = false,
  icon: Icon,
}: KpiCardProps) {
  const t = useTranslations();
  const deltaUp = (delta ?? 0) > 0;
  const hasDelta = delta != null && delta !== 0;
  const good = invertDelta ? !deltaUp : deltaUp;

  return (
    <div className={`kpi rise${hero ? ' key' : ''}`}>
      {hero ? (
        <span className="tag">{t('kpi.focusTag')}</span>
      ) : (
        <div className="ic">
          <Icon size={15} />
        </div>
      )}

      <div className="lb">{label}</div>
      <div className="vl" style={hero ? undefined : { color: TONE_VALUE[tone] }}>
        {value}
      </div>

      <div className="sb">
        {hasDelta ? (
          <>
            <span className={`delta ${good ? 'up' : 'down'}`}>
              {deltaUp ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />}
              {Math.abs(delta!)}
            </span>
            {deltaSuffix && <span>{deltaSuffix}</span>}
          </>
        ) : (
          !sub && <span>-</span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
```

Ghi chú chuyển đổi (để reviewer đối chiếu):
- Bỏ `Card` bọc ngoài — `.kpi` tự là bề mặt kính, không lồng 2 lớp blur.
- Bỏ vệt gradient trên đỉnh và quả cầu blur `radial-gradient` cũ — mock-up không có.
- Cỡ chữ số liệu do `.kpi .vl` quyết định (`--t-title1` = 28px); bỏ `text-[34px]`/`text-[28px]`.
- Không đổi một prop nào → 3 nơi gọi giữ nguyên.

> **Q7.** Chưa có trả lời thì để nguyên: `hero` vẫn chỉ gắn ở `kpi.behindSchedule` (`OverviewWidgets.tsx:59`, `report/page.tsx:47`) và `metric.spi` (`projects/[id]/page.tsx:133`). Có trả lời (b) thì Task 10 chỉnh cờ `hero` theo danh sách chủ dự án đưa.

- [ ] **Bước 5: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx vitest run src/i18n/messages.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt `/vi/overview` và `/vi/report`: 6 thẻ KPI trên một hàng ở màn rộng; 5 thẻ thường là kính có icon góc phải; thẻ "Chậm tiến độ" nền gradient navy, chữ trắng, tag vàng "Trọng tâm" góc phải. Dark mode: gradient dùng `--accent-2/--accent/--accent-deep` bản tối, tag vẫn vàng.

- [ ] **Bước 6: Commit**
```bash
git add app/globals.css src/components/dashboard/KpiCard.tsx src/i18n/messages src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 4 - the KPI scorecard + tag Trong tam mau vang"
```

---

### Task 5: Bảng dữ liệu

**Files:**
- Modify: `app/globals.css` (thêm khối `.tbl`)
- Modify: `src/components/dashboard/ProjectTable.tsx`
- Modify: `src/components/alerts/AlertList.tsx`
- Modify: `src/components/dashboard/Watchlist.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 5 - bang")

**Interfaces:**
- Produces: `.tbl` (+ `.tbl th`, `.tbl td`, `.tbl .num`), `.scroll`, và bảng mẫu mà Task 8/10/11 copy theo.
- Quy ước bảng chuẩn — mọi bảng trong app từ nay theo đúng khuôn này:
  ```tsx
  <div className="bd scroll">
    <table className="tbl">
      <thead><tr><th>…</th><th className="num">…</th></tr></thead>
      <tbody><tr><td>…</td><td className="num">…</td></tr></tbody>
    </table>
  </div>
  ```
  Cột số → `className="num"` (căn phải). Mã/ID → `className="mono"`. **Không** còn `px-4 py-2.5`, không còn `divide-y`, không còn zebra — `.tbl td` đã lo hết.

- [ ] **Bước 1: Gỡ 3 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: Copy CSS bảng vào `app/globals.css`**

Dán nguyên văn **dòng 362–370** của `mockup-apple-glass.html`: `.tbl`, `.tbl th`, `.tbl td`, `.tbl tbody tr:last-child td`, `.tbl tbody tr`, `.tbl tbody tr:hover`, `.tbl .num`, `.scroll`.

Thêm 3 quy tắc bù:
```css
  /* Bang co header dinh khi cuon doc (Audit log, danh muc dim) */
  .tbl.sticky thead th {
    position: sticky; top: 0; z-index: 2;
    background: var(--glass-3);
    -webkit-backdrop-filter: blur(var(--mat-thick));
    backdrop-filter: blur(var(--mat-thick));
  }
  /* O trong - mock-up khong ve nhung app can */
  .tbl .empty {
    padding: 40px 12px; text-align: center;
    color: var(--label3); font-size: var(--t-footnote);
  }
  /* Hang co the bam sang trang khac */
  .tbl a { color: inherit; text-decoration: none; }
  .tbl a:hover { color: var(--accent); }
```

- [ ] **Bước 3: `ProjectTable.tsx`**

Giữ nguyên `Props`, hàm `update`, và toàn bộ dữ liệu render. Chỉ đổi class theo bảng:

| Vị trí (dòng cũ) | Cũ | Mới |
|---|---|---|
| 35 | `<div className="card">` | `<div className="card overflow-visible">` (có `<select>` sắp xếp) |
| 36 | `flex flex-wrap items-center justify-between gap-3 px-5 pt-4` | `hd` |
| 37 | `<h3 className="text-sm font-semibold text-navy-900">` | `<h3>` |
| 39 | `<span className="ml-2 text-xs font-normal text-slate-400">` | `<span className="en">` |
| 43-47 `<select>` | `h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-navy-800 focus:outline-none` | `inp` + `style={{ width: 'auto', padding: '5px 10px' }}` |
| 57 | `mt-2 overflow-x-auto` | `bd scroll` |
| 58 | `w-full min-w-[980px] text-sm table-zebra` | `tbl` + `style={{ minWidth: 980 }}` |
| 60 | `<tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs uppercase …">` | `<tr>` (bỏ hết class) |
| 61-72 `<th className="px-4 py-2.5 font-medium">` | | `<th>`; các `th` số (`% TT`, `SPI`, `CPI`, giá trị HĐ) → `<th className="num">` |
| 76 | `<tbody className="divide-y divide-slate-100">` | `<tbody>` |
| 78 | `<tr key={s.id} className="group">` | `<tr key={s.id}>` |
| 79 | `px-4 py-2.5 font-mono text-xs text-slate-500` | `mono` |
| 81 | `<Link … className="font-medium text-navy-900 hover:text-accent">` | `<Link … >` (đã có `.tbl a`); `<td>` bọc thêm `style={{ whiteSpace: 'normal', maxWidth: 260, fontWeight: 600 }}` |
| 85-87 | `px-4 py-2.5 text-slate-600` | bỏ class hết |
| 97,103,108 | `px-4 py-2.5 text-right tabular-nums text-slate-700` | `num` |
| 99,104 | `font-medium text-amber-600` / `text-slate-700` | dùng chip: `<Badge tone={s.spi != null && s.spi < 0.9 ? 'danger' : s.spi != null && s.spi < 1 ? 'warn' : 'ok'}>{formatRatio(s.spi)}</Badge>` (theo mock-up dòng 1678, 1685) |
| 110 | `text-slate-300 hover:text-navy-500` | `text-label3` |
| 118 | `px-4 py-10 text-center text-sm text-slate-400` | `empty` |
| 128 | `flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 text-sm text-slate-600` | `flex items-center justify-end gap-2 border-t border-sep px-4 py-3 text-caption1 text-label2` |
| 132,142 nút phân trang | `rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40` | `btn ghost` + `style={{ padding: '5px 12px', fontSize: 'var(--t-caption1)' }}` + giữ `disabled:opacity-40` |

Cần import `Badge` từ `@/components/ui/Badge` nếu dùng chip cho SPI/CPI.

- [ ] **Bước 4: `AlertList.tsx`**

Cùng khuôn: `overflow-x-auto` → `scroll`; `w-full min-w-[980px] text-sm table-zebra` → `tbl` + `style={{minWidth:980}}`; `<tr className="border-y …">` → `<tr>`; mọi `<th className="px-4 py-2.5 font-medium">` → `<th>`; `<tbody className="divide-y divide-slate-100">` → `<tbody>`; `px-4 py-2.5 font-medium text-navy-900` → `style={{fontWeight:600}}`; `px-4 py-2.5 text-xs text-slate-500` → `mono`; `px-4 py-2.5 text-navy-800` → bỏ; `px-4 py-2.5 text-slate-600` → bỏ; dòng 30 `py-10 text-center text-sm text-slate-400` → `<p className="empty">`; nút Đóng (66) `shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy-800 hover:bg-slate-50 disabled:opacity-50` → `btn ghost` + `style={{padding:'6px 12px',fontSize:'var(--t-caption1)'}}` + giữ `disabled:opacity-50`.

- [ ] **Bước 5: `Watchlist.tsx`**

Đây là danh sách, không phải bảng — chuyển sang mẫu `.alert` của mock-up (CSS 414–419):

| Cũ | Mới |
|---|---|
| 27 `py-4 text-center text-sm text-slate-400` | `empty` |
| 29 `<ul className="divide-y divide-slate-100">` | `<div className="flex flex-col gap-2.5">` (bỏ `<ul>/<li>`, mỗi mục là `<Link className="alert">`) |
| 34 `group flex items-center gap-3 px-1 py-3 … hover:bg-slate-50` | `alert` |
| 36 `flex h-8 w-8 … rounded-lg bg-red-50 text-red-600` | `<span className="dot" style={{ background: 'var(--danger)' }} />` (bỏ icon trong ô vuông, theo mock-up dòng 1758) |
| 40 `truncate text-sm font-medium text-navy-900` | `<h4>` |
| 41 `flex flex-wrap gap-1.5 pt-1` | `mt` |
| 49 `text-slate-300 group-hover:text-navy-500` | `text-label3` |

Giữ nguyên `reasonsOf`, `Badge tone="warn"`, và `Card`/`CardHeader`/`CardBody` bọc ngoài.

- [ ] **Bước 6: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt `/vi/overview` (bảng Danh mục dự án + Watchlist) và `/vi/alerts`: header bảng chữ hoa 10px xám nhạt, kẻ ngang 0.5px, hover đổi nền nhẹ, **không** còn sọc zebra. Cột số căn phải. Mã dự án font mono.

- [ ] **Bước 7: Commit**
```bash
git add app/globals.css src/components/dashboard/ProjectTable.tsx src/components/dashboard/Watchlist.tsx src/components/alerts/AlertList.tsx src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 5 - bang du lieu theo mau .tbl cua mock-up"
```

---

### Task 6: Form nền tảng — input, nút, switch, combobox, modal

**Files:**
- Modify: `app/globals.css` (thêm khối form)
- Modify: `src/components/dashboard/FilterBar.tsx`
- Modify: `src/components/form/Combobox.tsx`
- Modify: `src/components/form/CreateProjectForm.tsx`
- Modify: `src/components/project/ProjectSwitcher.tsx`
- Modify: `src/components/project/WhatIf.tsx`
- Modify: `src/components/ui/PasswordInput.tsx`
- Modify: `src/components/layout/ChangePasswordModal.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 6 - form nho")

**Interfaces:**
- Produces: `.field .field .lb .inp .inp.ro .inp.bad .fgrid .f2 .f4 .btn .btn.ghost .switch .switch.on .fsec .req .hintline .inline .tagbox .sumbar .stickybar .help .help .bub .modal-scrim`
- Quy ước form chuẩn (mọi Task sau bám theo):
  ```tsx
  <div className="field">
    <span className="lb">Nhãn <span className="req">*</span></span>
    <input className="inp" />
    <span className="hintline">Ghi chú</span>
  </div>
  ```
  Nút chính: `<button className="btn">`. Nút phụ: `<button className="btn ghost">`.
  Lưới field: `f2` (2 cột), `fgrid` (3 cột), `f4` (4 cột).

- [ ] **Bước 1: Gỡ 7 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: Copy CSS form vào `app/globals.css`**

Dán nguyên văn các đoạn của `mockup-apple-glass.html`:
- **393–411** → `.field`, `.field label`, `.inp`, `.inp:focus`, `.fgrid`, `@media(max-width:900px)`, `.btn`, `.btn.ghost`, `.btn svg`, `.switch`, `.switch i`, `.switch.on`, `.switch.on i`
- **461–494** → `.fsec`, `.fsec:first-child`, `.fsec>.h`, `.fsec>.h .n`, `.fsec>.h h4`, `.fsec>.h p`, `.field .lb`, `.req`, `.hintline`, `.inp.ro`, `.inp.bad`, `.f2`, `.f4`, 2 `@media`, `.inline`, `.tagbox` + con, `.sumbar`, `.sumbar.good`, `.sumbar.bad`, `.stickybar`
- **438–458** → `.help`, `.help:hover`, `.help .bub` + con, `.help.rt` + con

Thêm 3 quy tắc bù:
```css
  /* Nut chinh khi bi khoa */
  .btn:disabled, .btn[aria-disabled='true'] { opacity: .5; cursor: not-allowed; }
  .btn.danger { background: linear-gradient(160deg, #e0524c, var(--danger)); }

  /* Nen mo phia sau modal - mock-up khong co modal nen tu suy tu .tip/.hud */
  .modal-scrim {
    position: fixed; inset: 0; z-index: 90;
    display: flex; align-items: center; justify-content: center; padding: 16px;
    background: rgba(10, 31, 61, 0.36);
    -webkit-backdrop-filter: blur(var(--mat-thin)) saturate(var(--mat-sat));
    backdrop-filter: blur(var(--mat-thin)) saturate(var(--mat-sat));
  }
  .modal {
    width: 100%; max-width: 420px; border-radius: var(--r-xl);
    background: var(--glass-3);
    -webkit-backdrop-filter: blur(var(--mat-chrome)) saturate(var(--mat-sat));
    backdrop-filter: blur(var(--mat-chrome)) saturate(var(--mat-sat));
    border: .5px solid var(--glass-stroke);
    box-shadow: var(--e4), var(--inner-hi);
    padding: 22px;
  }

  /* Danh sach goi y cua combobox - tu suy tu .tip (glass-3 + mat-thick + e4) */
  .pop {
    position: absolute; z-index: 60; margin-top: 4px; width: 100%;
    max-height: 288px; overflow: auto;
    border-radius: var(--r-sm);
    background: var(--glass-3);
    -webkit-backdrop-filter: blur(var(--mat-thick)) saturate(var(--mat-sat));
    backdrop-filter: blur(var(--mat-thick)) saturate(var(--mat-sat));
    border: .5px solid var(--glass-stroke);
    box-shadow: var(--e4);
  }
  .pop button {
    display: block; width: 100%; text-align: left;
    padding: 8px 12px; font-size: var(--t-footnote); color: var(--label);
    background: none; border: none; cursor: pointer;
    transition: background var(--dur-fast) var(--ease-std);
  }
  .pop button:hover { background: var(--fill); }
```

- [ ] **Bước 3: `FilterBar.tsx`**

- dòng 62–63: thay `selectCls` bằng `const selectCls = 'inp';` và thêm `style={{ width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)' }}` cho từng `<select>` — hoặc gọn hơn: khai báo `const selStyle = { width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)' } as const;` rồi `style={selStyle}` cho cả 7 select.
- dòng 66: `card flex flex-wrap items-center gap-2 px-3 py-3` → `card overflow-visible flex flex-wrap items-center gap-2 px-3 py-3`
- dòng 67–68: `text-xs font-medium text-slate-500` → `text-caption1 font-semibold text-label2`; `<IconFilter size={15} className="text-slate-500" />` → `<IconFilter size={15} />`
- dòng 124: nút xoá lọc `rounded-lg bg-accent-soft px-2 py-1.5 text-xs text-accent hover:bg-accent-soft/70` → `btn ghost` + `style={{ padding: '5px 10px', fontSize: 'var(--t-caption1)' }}`

- [ ] **Bước 4: `Combobox.tsx`**

Giữ 100% logic. Chỉ 3 chỗ:
- dòng 80: `absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg` → `pop`
- dòng 91: `block w-full px-3 py-2 text-left text-sm text-navy-900 hover:bg-slate-50` → bỏ hết (`.pop button` lo)
- dòng 102: `block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-slate-50 disabled:opacity-50` → `className="disabled:opacity-50"` + `style={{ borderTop: '.5px solid var(--sep)', color: 'var(--accent)', fontWeight: 600 }}`
- dòng 108: `px-3 py-2 text-sm text-slate-400` → `px-3 py-2 text-footnote text-label3`

**Bẫy:** `.card{overflow:hidden}` sẽ cắt `.pop`. Mọi `Card`/`div.card` chứa Combobox **phải** có thêm `overflow-visible`.

- [ ] **Bước 5: `ProjectSwitcher.tsx`**

- dòng 50: `<IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />` → giữ vị trí, đổi class màu thành `text-label3`
- dòng 59: `h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-navy-800 focus:border-accent focus:outline-none` → `inp pl-8`
- dòng 64: `absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:…` → `pop`
- dòng 66: `px-3 py-2.5 text-xs text-slate-400` → `px-3 py-2.5 text-caption1 text-label3`
- dòng 72: `flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700` → `flex items-center gap-2` (phần còn lại do `.pop button`)
- dòng 74: `shrink-0 font-mono text-xs text-slate-400` → `mono shrink-0`
- dòng 75: `flex-1 truncate text-navy-800 dark:text-slate-200` → `flex-1 truncate`

- [ ] **Bước 6: `WhatIf.tsx`**

- dòng 24: `text-slate-600` → `text-label2`
- dòng 25: `font-semibold text-accent` → `font-semibold text-brand`
- dòng 34: `w-full accent-accent` → `w-full` + `style={{ accentColor: 'var(--accent)' }}`
- dòng 36: `grid grid-cols-3 gap-2` → `fgrid` + `style={{ gap: 10 }}`
- dòng 37,41,45: 3 ô thống kê — theo mock-up dòng 738–746:
  ```tsx
  <div style={{ background: 'var(--fill)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
    <div className="text-[10px] font-bold uppercase text-label3">{t('whatif.currentEac')}</div>
    <div className="mt-[3px] text-callout font-bold">{formatTyd(baseEac, locale)}</div>
  </div>
  ```
  Ô 2 (EAC mới): giá trị `style={{ color: 'var(--accent)' }}`. Ô 3 (Tiết kiệm): giá trị `style={{ color: 'var(--ok)' }}`.
- Bỏ `label` class cũ (đã xoá khỏi globals.css ở Task 1).

- [ ] **Bước 7: `PasswordInput.tsx`**

- dòng 27: `const colors = ['bg-slate-200','bg-red-500','bg-amber-500','bg-emerald-500'];`
  → `const colors = ['var(--fill-2)', 'var(--danger)', 'var(--warn)', 'var(--ok)'];`
- dòng 44: `absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300` → `absolute right-2.5 top-1/2 -translate-y-1/2 text-label3 transition-colors duration-fast hover:text-label`
- dòng 54–57: đổi sang inline style:
  ```tsx
  <span
    key={i}
    className="h-1 w-6 rounded-full"
    style={{ background: i <= strength ? colors[strength] : 'var(--fill-2)' }}
  />
  ```
- dòng 60: `text-[11px] text-slate-500` → `text-caption2 text-label2`

- [ ] **Bước 8: `ChangePasswordModal.tsx`**

- dòng 18–19: `inputCls` → `const inputCls = 'inp';`
- dòng 46: `fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/60 p-4` → `modal-scrim`
- dòng 48: `w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800` → `modal`
- dòng 53: `text-base font-semibold text-navy-900 dark:text-slate-100` → `text-callout font-semibold`
- dòng 54: `mt-0.5 text-xs text-slate-400` → `hintline`
- dòng 58: nút đóng `rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700` → `rounded-sm p-2 text-label3 transition-colors duration-fast hover:bg-fill hover:text-label`
- dòng 67,71,76: `<label className="mb-1.5 block text-xs font-medium text-slate-600">` → `<span className="lb">` (bọc mỗi cặp label+input trong `<div className="field">`)
- dòng 73: `mt-1 text-[11px] text-slate-400` → `hintline`
- dòng 79: `rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600` → `sumbar bad`
- dòng 83: nút Lưu `w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white … disabled:opacity-50` → `btn w-full justify-center`

- [ ] **Bước 9: `CreateProjectForm.tsx`**

- dòng 17–18: `inputCls` → `const inputCls = 'inp';`
- dòng 114: nút mở form `flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90` → `btn`
- dòng 121: `card mt-3 grid gap-4 p-5 sm:grid-cols-2` → `card overflow-visible mt-3 p-4` bọc ngoài, bên trong dùng `<div className="f2">` (Combobox nằm đây → **bắt buộc** `overflow-visible`)
- dòng 123 + 219: label `mb-1 flex items-center gap-1 text-xs font-medium text-slate-600` → `lb`; bọc mỗi cặp trong `<div className="field">`
- dòng 125 + 222: nút gợi ý `!` `cursor-help rounded-full bg-slate-200 px-1.5 text-[10px] font-bold leading-4 text-slate-500` → chuyển sang mẫu `.help` của mock-up:
  ```tsx
  <button type="button" className="help" aria-label={hint}>?<span className="bub">{hint}</span></button>
  ```
  (bỏ `title=`, dùng bong bóng kính; giữ nguyên nội dung `hint`)
- dòng 196: `text-xs text-red-600 sm:col-span-2` → `sumbar bad` + `style={{ gridColumn: '1 / -1' }}`
- dòng 197: `text-xs text-emerald-600 sm:col-span-2` → `sumbar good` + `style={{ gridColumn: '1 / -1' }}`
- dòng 202: nút Lưu → `btn`
- dòng 206: nút Huỷ `rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-50` → `btn ghost`
- dòng 122 `sm:col-span-2` (ô Tên dự án) → `style={{ gridColumn: '1 / -1' }}`

- [ ] **Bước 10: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt: `/vi/overview` (FilterBar), `/vi/projects/1` (ProjectSwitcher + WhatIf), `/vi/nhap-lieu` (CreateProjectForm), bánh răng → Người dùng → Đổi mật khẩu (modal).
Kiểm riêng: mở Combobox "Chủ đầu tư" trong CreateProjectForm — danh sách gợi ý **không bị cắt** bởi mép card. Nếu bị cắt → thiếu `overflow-visible`.

- [ ] **Bước 11: Commit**
```bash
git add app/globals.css src/components/dashboard/FilterBar.tsx src/components/form/Combobox.tsx src/components/form/CreateProjectForm.tsx src/components/project/ProjectSwitcher.tsx src/components/project/WhatIf.tsx src/components/ui/PasswordInput.tsx src/components/layout/ChangePasswordModal.tsx src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 6 - input/nut/switch/combobox/modal theo mock-up"
```

---

### Task 7: Wizard nhập liệu + panel import

**Files:**
- Modify: `app/globals.css` (thêm khối `.stage`/`.stagegrid` cho chuỗi giá trị)
- Modify: `src/components/form/DataEntryForm.tsx`
- Modify: `src/components/form/ImportPanel.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 7 - wizard nhap lieu")

**Interfaces:**
- Consumes: mọi class form của Task 6, `.tbl` của Task 5, `.msdetail` của Task 3.
- Produces: `.stagegrid .stage .stage.on .stage.bt .chainfoot` — Task 10 dùng lại cho chuỗi giá trị ở trang Chi tiết dự án.

- [ ] **Bước 1: Gỡ 2 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: Copy CSS chuỗi giá trị vào `app/globals.css`**

Dán nguyên văn **dòng 335–352** của `mockup-apple-glass.html`: `.stagegrid`, `@media`, `.stage`, `.stage:hover`, `.stage.on`, `.stage .nm`, `.stage.on .nm`, `.stage .w`, `.stage .bar`, `.stage .fill`, `.stage.bt .fill`, `.stage .pc`, `.chainfoot`.

- [ ] **Bước 3: `DataEntryForm.tsx` — thanh chọn dự án + thanh bước**

- dòng 296: `card flex flex-wrap items-center gap-3 p-4` → `card overflow-visible flex flex-wrap items-center gap-3 p-4` (có 2 `<select>`)
- dòng 297: `text-sm font-medium text-navy-900` → `text-footnote font-semibold`
- dòng 301, 312: `h-9 … rounded-xl border border-slate-200 px-3 text-sm text-navy-800 focus:border-accent focus:outline-none` → `inp` + `style={{ width: 'auto' }}` (select dự án giữ `min-w-0 flex-1 sm:max-w-xs`)
- dòng 326: `flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-1` → `msdetail` + `style={{ borderBottom: 'none', background: 'transparent', padding: 0 }}`
- dòng 333–335: nút bước
  - đang mở: `className="k"` + `style={{ background: 'var(--accent-tint)', color: 'var(--accent)', borderColor: 'transparent' }}`
  - chưa mở: `className="k"` (mặc định `.msdetail .k` đã là nền `--glass-3`, viền `--sep`)
  - số thứ tự (dòng 337) `flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px]` → `<b>{i + 1}</b>` (`.msdetail .k b` đã tô đậm)
- dòng 344: `card p-5 ${locked ? 'pointer-events-none opacity-60' : ''}` → `card overflow-visible ${locked ? 'pointer-events-none opacity-60' : ''}` và bọc nội dung trong `<div className="bd">`

- [ ] **Bước 4: `DataEntryForm.tsx` — thân các bước**

Áp bảng đổi chung (dùng Find & Replace trong file, kiểm từng chỗ):

| Cũ | Mới |
|---|---|
| `grid gap-4 sm:grid-cols-2` | `f2` |
| `space-y-4` (bọc nhóm field) | giữ nguyên |
| `mt-1 text-[11px] text-slate-400` | `hintline` |
| `mt-1 text-xs text-red-600` | `hintline` + `style={{ color: 'var(--danger)' }}` |
| `mb-2 text-xs font-medium uppercase text-slate-400` | `<div className="sect"><b>…</b><i /></div>` |
| `w-28 shrink-0 text-xs text-slate-600` (tên giai đoạn, dòng 482) | `nm` — cả hàng chuyển sang `<div className="stage">` |
| `flex shrink-0 items-center gap-1.5 text-xs text-slate-500` (dòng 493) | `inline` + `style={{ fontSize: 'var(--t-caption1)', color: 'var(--label2)' }}` |
| `mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy-800` (511, 520) | `chainfoot` |
| `rounded-lg bg-slate-50 p-3` (518) | `sumbar` |
| `text-xs font-medium uppercase text-slate-400` (519) | `text-caption2 font-bold uppercase text-label3` |
| `text-sm font-medium text-navy-900` (556, 567) | `text-footnote font-semibold` |
| `mt-2 divide-y divide-slate-100` (557, 568) | `mt-2 flex flex-col` + mỗi `<li>` thêm `style={{ borderTop: '.5px solid var(--sep)' }}` (bỏ dòng đầu bằng `first:border-t-0`) |
| `font-mono text-xs text-navy-800` (560, 572) | `mono` |
| `text-xs text-slate-400` (561, 569, 573) | `text-caption1 text-label3` |
| `py-4 text-center text-sm text-slate-400` (621) / `py-2 text-sm text-slate-400` (569) | `empty` |
| `mb-1 block text-xs font-medium text-slate-600` (579) | `lb` |
| `text-xs text-red-600` (599, 619) | `hintline` + `style={{ color: 'var(--danger)' }}` |
| `text-sm text-emerald-600` (665) | `chip c-ok` |
| `${inputCls('code')} bg-slate-50 text-slate-400` (348) | `inp ro` |
| `rounded-xl bg-accent …` (mọi nút lưu/nộp) | `btn` |
| `rounded-xl border border-slate-200 …` (mọi nút phụ) | `btn ghost` |
| `aspect-[4/3] … bg-slate-100` (ô ảnh, 623–631) | `style={{ background: 'var(--fill)', borderRadius: 'var(--r-md)' }}` |

Thanh hành động cuối (dòng 649–~690): bọc trong `<div className="stickybar">` thay cho `flex items-center justify-between gap-3`.

Hàm `Field` (dòng 697–711) — viết lại theo khuôn Task 6:
```tsx
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="lb">
        {label}
        {hint && (
          <button type="button" className="help" aria-label={hint}>
            ?<span className="bub">{hint}</span>
          </button>
        )}
      </span>
      {children}
    </div>
  );
}
```

Hàm `AlertTab` (dòng 712–~750): mỗi cảnh báo → `<div className="alert">` + `<span className="dot" style={{background: a.alertType === 'Red' ? 'var(--danger)' : 'var(--warn)'}} />` + `<h4>` + `<p>` + `<div className="mt">`. Giống hệt cách làm Watchlist ở Task 5.

Hàng 7 giai đoạn (khối dòng 478–509): chuyển sang `.stage`:
```tsx
<div className="stagegrid">
  {STAGE_ORDER.map((s) => (
    <div key={s} className="stage">
      <span className="nm">{t(stageKey[s])}</span>
      <span className="w">{/* trọng số nếu có, nếu không để '-' */}</span>
      <div className="bar"><i className="fill" style={{ width: `${pct * 100}%` }} /></div>
      <span className="pc">{/* % */}</span>
    </div>
  ))}
</div>
```
**Lưu ý:** `.stage .fill` trong mock-up là con của `.stage .bar`; ở đây dùng `<i className="fill">`. Giữ nguyên các `<input>`/`<label>` điều khiển của app bằng cách đặt chúng ngay sau `.stage` trong cùng một `<div>` bọc — **không** xoá control nào, vì đó là chức năng nhập liệu.

- [ ] **Bước 5: `ImportPanel.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 78, 97, 161 | `card p-4` | `card` + bọc nội dung trong `<div className="bd">` |
| 79 | `flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-navy-800 hover:bg-slate-50` | `flex cursor-pointer items-center gap-3 px-4 py-5 text-footnote transition-colors duration-fast hover:bg-fill` + `style={{ border: '1px dashed var(--sep-2)', borderRadius: 'var(--r-md)' }}` |
| 80 | `text-accent` | `text-brand` |
| 83 | `ml-2 text-xs text-slate-400` | `en` |
| 92 | `mt-2 text-sm text-slate-500` | `hintline` |
| 107, 174 | `h-8 rounded-lg border border-slate-200 px-2 text-xs text-navy-800 focus:outline-none` | `inp` + `style={{ width: 'auto', padding: '5px 10px', fontSize: 'var(--t-caption1)' }}` |
| 118, 186 | `rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40` | `btn` + `style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}` |
| 123 | `text-xs text-emerald-600` | `chip c-ok` |
| 130 | `overflow-x-auto` | `scroll` |
| 131 | `w-full text-sm` | `tbl` |
| 133 | `text-left text-xs uppercase text-slate-400` | bỏ hết |
| 134–137 | `py-1.5 font-medium` | bỏ hết |
| 140 | `divide-y divide-slate-100` | bỏ |
| 143 | `py-1.5 font-mono text-xs text-navy-800` | `mono` |
| 144–146 | `py-1.5 text-slate-600` / `py-1.5` | bỏ |
| 162 | `text-sm font-semibold text-navy-900` | dùng `<CardHeader title={…} />` thay cho `<h3>` rời |
| 164 | `py-4 text-center text-sm text-slate-400` | `empty` |
| 166 | `mt-2 divide-y divide-slate-100` | `mt-2 flex flex-col` + `<li style={{ borderTop: '.5px solid var(--sep)' }}>` |
| 169 | `font-mono text-xs text-navy-800` | `mono` |
| 170 | `min-w-0 flex-1 truncate text-xs text-slate-400` | `min-w-0 flex-1 truncate text-caption1 text-label3` |

Card ở dòng 97 và 161 có `<select>` → thêm `overflow-visible`.

- [ ] **Bước 6: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt `/vi/nhap-lieu` (chạy đủ 4 bước wizard, bấm từng bước) và `/vi/import`.
Kiểm riêng: khi `locked = true`, khối form phải mờ 60% và không bấm được (giữ nguyên hành vi cũ).

- [ ] **Bước 7: Commit**
```bash
git add app/globals.css src/components/form src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 7 - wizard nhap lieu + panel import"
```

---

### Task 8: Công cụ quản trị (5 editor)

**Files:**
- Modify: `src/components/admin/UserEditor.tsx`
- Modify: `src/components/admin/FieldEditor.tsx`
- Modify: `src/components/admin/ActivityViewer.tsx`
- Modify: `src/components/admin/DeleteProject.tsx`
- Modify: `src/components/admin/ResetDataButton.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 8 - admin editor")

**Interfaces:** chỉ tiêu thụ class của Task 3/5/6. Không tạo class mới, **trừ** `.btn.danger` (đã thêm ở Task 6).

Không sửa một dòng logic nào ở 5 file này — chúng gọi server action thật (`resetPasswordAction`, `mergeDimValueAction`, `deleteProjectAction`…). Chỉ đổi `className` / `style`.

- [ ] **Bước 1: Gỡ 5 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: `UserEditor.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 34–35 | `inputCls = 'h-9 rounded-lg border border-slate-200 px-2.5 text-sm text-navy-800 focus:border-accent focus:outline-none'` | `inputCls = 'inp'` |
| 69, 78, 82 | `mb-1 block text-xs font-medium text-slate-600` | `lb`; bọc từng cặp trong `<div className="field">` |
| 90 | `h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90` | `btn` |
| 95 | `overflow-x-auto` | `scroll` |
| 96 | `w-full text-sm` | `tbl` |
| 98 | `text-left text-xs uppercase text-slate-400` | bỏ hết |
| 99–104 | `py-1.5 font-medium` | bỏ hết |
| 107 | `divide-y divide-slate-100` | bỏ |
| 110 | `py-2 text-navy-800` | `mono` |
| 111 | `py-2 text-slate-600` | bỏ |
| 134–139 | badge trạng thái `rounded-full px-2.5 py-1 text-xs font-medium ${u.isActive ? … : …}` | `<Badge tone={u.isActive ? 'ok' : 'neutral'}>` (import `Badge` từ `@/components/ui/Badge`) |
| 141 | `py-2 text-xs text-slate-500` | bỏ |
| 142 | `whitespace-nowrap py-2 text-right` | `num` |
| 143 | `rounded-lg px-2 py-1 text-xs text-navy-800 hover:bg-slate-50` | `btn ghost` + `style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}` |
| 152 | `rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50` | `btn ghost` + `style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)', color: 'var(--danger)' }}` |
| 164 | `fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/60 p-4` | `modal-scrim` |
| 166 | `w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800` | `modal` |
| 170 | `text-base font-semibold text-navy-900 dark:text-slate-100` | `text-callout font-semibold` |
| 173 | `rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700` | `rounded-sm p-2 text-label3 transition-colors duration-fast hover:bg-fill hover:text-label` |
| 179, 183 | `mb-1.5 block text-xs font-medium text-slate-600` | `lb` + bọc `<div className="field">` |
| 186 | `rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600` | `sumbar bad` |
| 187 | `w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90` | `btn w-full justify-center` |

Dòng 74/79/83/120/180/184 dùng `${inputCls} w-full` / `w-44` → giữ nguyên hậu tố chiều rộng, `inputCls` đã là `'inp'`.

- [ ] **Bước 3: `FieldEditor.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 46 | `text-xs text-red-600` | `sumbar bad` |
| 51 | `h-8 w-full rounded-lg border border-slate-200 px-2.5 text-sm focus:border-accent focus:outline-none` | `inp` |
| 53 | `max-h-64 overflow-auto` | `scroll` + `style={{ maxHeight: 256 }}` |
| 54 | `w-full text-sm` | `tbl sticky` |
| 56 | `text-left text-xs uppercase text-slate-400` | bỏ |
| 57–60 | `py-1.5 font-medium` | bỏ |
| 63 | `divide-y divide-slate-100` | bỏ |
| 98 | `py-2 pr-2` | bỏ |
| 104 | `h-8 w-40 rounded-lg border border-slate-200 px-2 text-sm` | `inp w-40` |
| 114 | `rounded-lg bg-accent px-2 py-1 text-xs text-white disabled:opacity-50` | `btn disabled:opacity-50` + `style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}` |
| 118 | `px-2 py-1 text-xs text-slate-400` | `btn ghost` + `style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}` |
| 125 | `font-medium text-navy-900 hover:text-accent` | bỏ (`.tbl a` lo) — nếu là `<button>` thì `style={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}` |
| 132, 133, 163 | `py-2 text-xs text-slate-500` / `text-slate-400` | `text-caption1 text-label3` |
| 140 | `h-8 w-32 rounded-lg border border-slate-200 px-2 text-xs` | `inp w-32` |
| 157 | `rounded-lg border border-slate-200 px-2 py-1 text-xs text-navy-800 hover:bg-slate-50 disabled:opacity-40` | `btn ghost disabled:opacity-40` + `style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}` |

- [ ] **Bước 4: `ActivityViewer.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 21 | `h-9 rounded-lg border border-slate-200 px-2.5 text-sm text-navy-800 focus:border-accent focus:outline-none` | `inp` + `style={{ width: 'auto' }}` |
| 29 | `max-h-64 overflow-auto` | `scroll` + `style={{ maxHeight: 256 }}` |
| 30 | `w-full text-sm` | `tbl sticky` |
| 32 | `text-left text-xs uppercase text-slate-400` | bỏ |
| 33–36 | `py-1.5 font-medium` | bỏ |
| 39 | `divide-y divide-slate-100` | bỏ |
| 42 | `py-2 font-mono text-xs text-slate-500` | `mono` |
| 43 | `py-2 text-navy-800` | bỏ |
| 45 | `ml-1 text-xs text-slate-400` | `en` |
| 47 | `py-2 text-slate-600` | `<Badge tone="neutral">{t(\`activity.${a.action}\`)}</Badge>` (theo mock-up dòng 1780: cột Hành động là chip) |
| 48 | `py-2 text-xs text-slate-500` | `text-caption1 text-label2` |
| 53 | `py-4 text-center text-sm text-slate-400` | `empty` |

- [ ] **Bước 5: `DeleteProject.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 36 | `h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-sm text-navy-800 focus:border-accent focus:outline-none` | `inp min-w-0 flex-1` |
| 48 | `rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40` | `btn danger disabled:opacity-40` |
| 52 | `text-xs text-emerald-600` | `chip c-ok` |

- [ ] **Bước 6: `ResetDataButton.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 29 | `rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50` | `btn ghost` + `style={{ color: 'var(--danger)', borderColor: 'var(--danger-fill)', padding: '6px 12px', fontSize: 'var(--t-caption1)' }}` |
| 38 | `text-xs text-red-600` | `chip c-dan` |
| 42 | `rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50` | `btn danger disabled:opacity-50` + `style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}` |
| 46 | `rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50` | `btn ghost` + `style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}` |

- [ ] **Bước 7: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt `/vi/admin` (đăng nhập bằng tài khoản admin): 5 khu vực đều theo hệ kính; modal đặt lại mật khẩu có nền mờ phía sau; nút xoá/reset màu `--danger`.
Kiểm hành vi (phải **không đổi**): bấm sửa tên một khách hàng rồi Lưu vẫn chạy; nút Reset vẫn có bước xác nhận 2 nhịp.

- [ ] **Bước 8: Commit**
```bash
git add src/components/admin src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 8 - cong cu quan tri theo he kinh"
```

---

### Task 9: Biểu đồ Recharts — bộ màu series + tooltip kính

**Files:**
- Create: `src/components/dashboard/useChartTokens.ts`
- Modify: `app/globals.css` (thêm khối `.tip` + override Recharts)
- Modify: `src/components/dashboard/charts.tsx`
- Modify: `src/components/dashboard/DrillCharts.tsx`
- Modify: `src/components/dashboard/ChartLabels.tsx`
- Modify: `src/components/project/ManpowerDailyChart.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 9 - chart")

**Vì sao cần hook:** `var(--x)` **không** dùng được trong *presentation attribute* của SVG (`fill="var(--s-plan)"` không hiển thị gì). Recharts đặt màu bằng attribute. Nên phải đọc giá trị thật lúc chạy bằng `getComputedStyle`, đúng như mock-up làm (hàm `cssv()` dòng 1317, gọi lại `drawAll()` khi đổi theme dòng 2296). `contentStyle` của `<Tooltip>` là *inline style* nên `var()` ở đó **chạy được** — giữ nguyên `var()`.

**Interfaces:**
- Produces:
  ```ts
  export interface ChartTokens {
    plan: string; actual: string; cost: string; third: string; thirdLt: string;
    neutral: string; grid: string; axis: string; label2: string;
    ok: string; warn: string; danger: string; accent: string; accent2: string; gold: string;
  }
  export function useChartTokens(): ChartTokens;
  ```
- Produces: `TOOLTIP_STYLE` giữ nguyên tên export (charts.tsx + ManpowerDailyChart.tsx đang import).
- **`CHART_COLORS` bị xoá.** 2 nơi đang import nó (`DrillCharts.tsx:8`, `ManpowerDailyChart.tsx:8`) chuyển sang `useChartTokens()`.
- **Chặn bởi Q5 (HUD).**

**Bảng ánh xạ màu series — lấy từ mock-up, không tự chế:**

| Series | Token | Nguồn trong mock-up |
|---|---|---|
| PV | `--s-plan` | dòng 725, 1526 |
| EV | `--s-actual` | dòng 725, 1526 |
| AC | `--s-cost` (nét đứt `5 4`) | dòng 725, 1526 |
| SPI | `--s-actual` | dòng 728, 1555 |
| CPI | `--s-third` | dòng 728, 1555 |
| Kế hoạch (mọi biểu đồ cột) | `--s-plan` | dòng 605, 718 |
| Thực tế (mọi biểu đồ cột) | `--s-actual` | dòng 605, 718 |
| Doanh thu | `--s-plan` | dòng 857 |
| Chi phí | `--s-cost` | dòng 857 |
| Biên LN gộp (đường) | `--s-third` | dòng 857 |
| Trạng thái: Đang triển khai | `--s-actual` | dòng 1272 |
| Trạng thái: Chuẩn bị | `--s-plan` | dòng 1272 |
| Trạng thái: Hoàn thành | `--s-third` | dòng 1273 |
| Trạng thái: Tạm dừng | `--s-cost` | dòng 1273 |
| Nhân lực KH / TT | `--s-plan` / `--s-third` | dòng 762 |
| Thiết bị KH / TT | `--s-plan` / `--s-cost` | dòng 765 |
| Lưới / trục | `--grid` / `--axis` | dòng 1697–1698 |

Series app có mà mock-up không có → suy ra theo đúng logic trên, ghi rõ để reviewer đối chiếu:
- `GroupBar`: cột "Trị (tỷ VNĐ)" = `--s-actual` (đại lượng chính), đường "Lượng (tấn)" = `--s-cost` (đại lượng phụ khác đơn vị).
- `CapacityBar`: "Công suất" = `--s-neutral` (nền tham chiếu), "Sản lượng" = `--s-actual`, ô cảnh báo = `--warn`.
- `BacklogOverdueLine`: "Backlog" = `--s-plan`, "Công nợ quá hạn" = `--danger`.
- `Sparkline`: mặc định `--s-actual`.
- Vạch ngưỡng `ReferenceLine` SPI: `--warn`.

- [ ] **Bước 1: Gỡ 4 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: Copy CSS tooltip + override Recharts vào `app/globals.css`**

Dán nguyên văn **dòng 379–390** của `mockup-apple-glass.html` (`svg.chart`, `.tip`, `.tip.show`, `.tip b`, `.tip .r`, `.tip .r span:last-child`, `.tip i`).

Thêm khối override cho Recharts (mock-up tự vẽ SVG nên không có phần này):
```css
  /* --- Recharts: keo ve he token --- */
  .recharts-cartesian-axis-tick-value { fill: var(--axis); font-size: var(--t-caption1); }
  .recharts-legend-item-text { color: var(--label2) !important; font-size: var(--t-caption1); }
  .recharts-default-tooltip { background: none !important; border: none !important; }
  .recharts-tooltip-item { color: var(--label2) !important; }
  .recharts-tooltip-label { color: var(--label) !important; font-weight: 700; }
  .recharts-surface { overflow: visible; }
```

> **Chặn Q5.** Nếu (b)/(c): thêm tiếp dòng 427–434 (`.hud`, `.hud b`, `.hud .sp`) và tạo `src/components/ui/Hud.tsx` port vòng đo fps ở mock-up dòng 1233–1238. Nếu (a): bỏ qua hoàn toàn.

- [ ] **Bước 3: Tạo `src/components/dashboard/useChartTokens.ts`**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Recharts dat mau bang presentation attribute cua SVG; var() KHONG chay o do.
 * Nen phai doc gia tri that tu CSS variable luc chay - giong ham cssv() cua
 * mock-up (dong 1317) va ve lai khi doi theme (dong 2296).
 */
export interface ChartTokens {
  plan: string;
  actual: string;
  cost: string;
  third: string;
  thirdLt: string;
  neutral: string;
  grid: string;
  axis: string;
  label2: string;
  ok: string;
  warn: string;
  danger: string;
  accent: string;
  accent2: string;
  gold: string;
}

const VARS: Record<keyof ChartTokens, string> = {
  plan: '--s-plan',
  actual: '--s-actual',
  cost: '--s-cost',
  third: '--s-third',
  thirdLt: '--s-third-lt',
  neutral: '--s-neutral',
  grid: '--grid',
  axis: '--axis',
  label2: '--label2',
  ok: '--ok',
  warn: '--warn',
  danger: '--danger',
  accent: '--accent',
  accent2: '--accent-2',
  gold: '--gold',
};

/** Gia tri dung cho lan render dau (truoc khi doc duoc DOM) - bang bo sang. */
const FALLBACK: ChartTokens = {
  plan: '#93b8e0', actual: '#1d5a9e', cost: '#a86a12', third: '#0f8a63',
  thirdLt: '#6fbf9b', neutral: '#c3cddb',
  grid: 'rgba(10,31,61,.08)', axis: 'rgba(10,31,61,.42)', label2: 'rgba(10,31,61,.62)',
  ok: '#248a3d', warn: '#b25000', danger: '#c30d0d',
  accent: '#1d5a9e', accent2: '#2a6db4', gold: '#f5b301',
};

function read(): ChartTokens {
  if (typeof window === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const out = {} as ChartTokens;
  for (const k of Object.keys(VARS) as (keyof ChartTokens)[]) {
    out[k] = cs.getPropertyValue(VARS[k]).trim() || FALLBACK[k];
  }
  return out;
}

export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(FALLBACK);
  const refresh = useCallback(() => setTokens(read()), []);

  useEffect(() => {
    refresh();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('ddc:theme', refresh);
    mq.addEventListener('change', refresh);
    return () => {
      window.removeEventListener('ddc:theme', refresh);
      mq.removeEventListener('change', refresh);
    };
  }, [refresh]);

  return tokens;
}
```

- [ ] **Bước 4: `charts.tsx`**

- Xoá export `CHART_COLORS` (dòng 28–43).
- Thay `TOOLTIP_STYLE` (dòng 45–52) bằng:
  ```tsx
  /** Tooltip kinh - inline style nen var() chay duoc. */
  export const TOOLTIP_STYLE = {
    contentStyle: {
      borderRadius: 'var(--r-sm)',
      border: '.5px solid var(--glass-stroke)',
      background: 'var(--glass-3)',
      backdropFilter: 'blur(var(--mat-thick)) saturate(var(--mat-sat))',
      WebkitBackdropFilter: 'blur(var(--mat-thick)) saturate(var(--mat-sat))',
      boxShadow: 'var(--e4)',
      fontSize: 'var(--t-caption1)',
      color: 'var(--label)',
      padding: '10px 12px',
    },
    itemStyle: { color: 'var(--label2)' },
    labelStyle: { color: 'var(--label)', fontWeight: 700, marginBottom: 6 },
  } as const;
  ```
- Trong **mỗi** hàm biểu đồ (`StatusDonut`, `GroupBar`, `CapacityBar`, `SpiCpiLine`, `SCurve`, `BacklogOverdueLine`, `Sparkline`) thêm dòng đầu `const c = useChartTokens();` rồi thay màu theo bảng ánh xạ ở trên.
- Mọi `stroke="#eef2f7"` của `<CartesianGrid>` → `stroke={c.grid}`.
- Mọi `tick={{ fontSize: 11, fill: '#64748b' }}` và `'#94a3b8'` → `tick={{ fontSize: 11, fill: c.axis }}`.
- `<Legend wrapperStyle={{ fontSize: 12 }} />` → `<Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />`.
- `ReferenceLine` SPI (dòng 180–185): `stroke={c.warn}`, `label={{ …, fill: c.warn }}`.
- `SCurve` gradient (dòng 207–216): `stopColor={c.plan}` / `stopColor={c.actual}`; `<Area dataKey="ac" stroke={c.cost} strokeDasharray="5 4" fill="transparent" />` (thêm nét đứt theo mock-up dòng 1526).
- `Sparkline` (dòng 257): `color = CHART_COLORS.accent` → đổi chữ ký thành `{ data, color }: { data: number[]; color?: string }` và bên trong `const c = useChartTokens(); const stroke = color ?? c.actual;`.
- Bo góc cột: mock-up dùng `rx:4` → đổi mọi `radius={[6,6,0,0]}` thành `radius={[4,4,0,0]}` và `[0,6,6,0]` thành `[0,4,4,0]`.

- [ ] **Bước 5: `DrillCharts.tsx`**

- Bỏ import `CHART_COLORS`; import `useChartTokens`.
- Xoá hằng `STATUS_COLOR` ở module scope (dòng 10–15), chuyển vào trong `DrillDonut`:
  ```tsx
  const c = useChartTokens();
  const STATUS_COLOR: Record<Status, string> = {
    Chuan_bi: c.plan,
    Dang_trien_khai: c.actual,
    Hoan_thanh: c.third,
    Tam_dung: c.cost,
  };
  ```
- dòng 50: `flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50` → `legend` là dạng span, nhưng đây là nút bấm được → dùng `flex w-full items-center gap-2 rounded-xs px-2 py-1 text-caption1 transition-colors duration-fast hover:bg-fill`
- dòng 52: `h-2.5 w-2.5 rounded-full` → giữ, chỉ đổi thành `h-2.5 w-2.5 rounded-[3px]` (mock-up `.legend i` bo 3px)
- dòng 53: `flex-1 text-left text-slate-600` → `flex-1 text-left text-label2`
- dòng 54: `font-semibold text-navy-900` → `font-bold`
- dòng 55: `text-slate-400` → `text-label3`
- dòng 86: `text-sm font-semibold text-navy-900` → `text-footnote font-semibold`
- dòng 92: `h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-navy-800 focus:outline-none` → `inp` + `style={{ width: 'auto', padding: '4px 9px', fontSize: 'var(--t-caption1)' }}`

- [ ] **Bước 6: `ChartLabels.tsx`**

- dòng 15–17:
  ```tsx
  const base = 'rounded-[6px] px-2.5 py-1 text-caption1 font-semibold transition-all duration-fast ease-std';
  const on = 'text-label';
  const off = 'text-label2';
  ```
- dòng 19: `flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800` → `seg`
- nút đang chọn thêm class `on` (`.seg button.on` đã lo nền + bóng): `className={\`${base} ${mode === 'smart' ? 'on ' + on : off}\`}`
- `valueLabel` (dòng 60): `fill="currentColor"` → `fill="var(--label2)"` — **được phép** vì đây là JSX `<text>` do ta tự render, không phải attribute do Recharts sinh; nhưng để chắc chắn, đổi thành `fill={'var(--label2)'}` sẽ vẫn hỏng. **Dùng `fill="currentColor"` và giữ nguyên** — phần tử nằm trong SVG kế thừa `color` từ container, mà container `.card .bd` có `color: var(--label)`. Không sửa dòng này.

- [ ] **Bước 7: `ManpowerDailyChart.tsx`**

- Bỏ import `CHART_COLORS`; import `useChartTokens` và giữ `TOOLTIP_STYLE`.
- Thêm `const c = useChartTokens();` trong component.
- dòng 22: `py-8 text-center text-sm text-slate-400` → `empty`
- dòng 28: `rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700` → `chip c-plain`
- dòng 31: `flex gap-1` → `seg`
- dòng 37–39: `rounded-md px-2 py-1 text-xs ${bucket === b ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600'}` → `${bucket === b ? 'on' : ''}` (để `.seg button` lo)
- dòng 48: `stroke="#eef2f7"` → `stroke={c.grid}`
- dòng 51, 57: `fill: '#64748b'` → `fill: c.axis`
- dòng 63: `wrapperStyle={{ fontSize: 12 }}` → `wrapperStyle={{ fontSize: 'var(--t-caption1)' }}`
- dòng 68: `stroke={CHART_COLORS.ac}` (kế hoạch) → `stroke={c.plan}`
- dòng 76: `stroke={CHART_COLORS.accent}` (thực tế) → `stroke={c.third}`
- Sửa comment dòng 14: `Màu bám bộ đỏ-vàng của dashboard: kế hoạch = vàng, thực tế = đỏ.` → `Mau bam bo series cua mock-up: ke hoach = --s-plan, thuc te = --s-third (mock-up dong 762).`

- [ ] **Bước 8: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt `/vi/overview`, `/vi/projects/1`, `/vi/report`:
- Donut trạng thái: Đang triển khai navy đậm, Chuẩn bị navy nhạt, Hoàn thành xanh lục, Tạm dừng nâu vàng. **Không còn màu đỏ nào.**
- Rê chuột vào biểu đồ → tooltip nền kính mờ, viền sáng 0.5px, bóng `--e4`.
- **Bấm chuyển sang giao diện Tối, biểu đồ phải đổi màu ngay** (không cần tải lại trang). Nếu không đổi → `ddc:theme` chưa được bắn từ `applyTheme` (kiểm lại Task 1 Bước 9) hoặc chart không gọi `useChartTokens`.

- [ ] **Bước 9: Commit**
```bash
git add app/globals.css src/components/dashboard src/components/project/ManpowerDailyChart.tsx src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 9 - bo mau series + tooltip kinh cho Recharts"
```

---

### Task 10: Hai dashboard chính — Tổng quan + Chi tiết dự án

**Files:**
- Modify: `app/[locale]/(app)/overview/page.tsx`
- Modify: `src/components/dashboard/OverviewWidgets.tsx`
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 10 - 2 dashboard chinh")

**Interfaces:** chỉ tiêu thụ. Không tạo class mới.

**Quy ước bố cục lấy từ mock-up** (thay cho `grid gap-6 lg:grid-cols-3` các kiểu):
- `.page` (đã có ở `<main>` từ Task 2) tự tạo `gap: 14px` giữa các khối con → **bỏ** `space-y-4`/`space-y-6` ở lớp ngoài cùng của mỗi page.
- Hàng 2 cột đều nhau → `g2`. 3 cột đều → `g3`. 2 cột lệch 1.55/1 → `g21`. Lưới KPI → `kpis` (+ `k5`/`k4`/`k2` nếu không đủ 6).
- Tiêu đề phân tầng → `<div className="sect"><b>Tầng 1 — Metrics</b><i /></div>` (mock-up dòng 644, 654, 722, 759).

- [ ] **Bước 1: Gỡ 3 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: `overview/page.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 31 | `grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6` (KpiSkeleton) | `kpis` |
| 33 | `card h-24 animate-pulse` | `kpi sk` + `style={{ height: 96 }}` |
| 71 | `<div className="space-y-6">` | `<>` … `</>` (bỏ hẳn div bọc, `.page` lo khoảng cách) |
| 72 | `text-xs text-slate-500` | `hintline` |
| 90, 101, 113 | `grid gap-6 lg:grid-cols-3` | `g21` |
| 94, 105, 117 | `<div className="lg:col-span-2">` | bỏ div bọc (`.g21` đã chia 1.55fr/1fr) — **nhưng** phải đảo thứ tự: `.g21` cho phần tử **đầu** là phần rộng. Hiện `StatusDonutCard` (hẹp) đứng trước `GroupBarCard` (rộng) → đổi chỗ để `GroupBarCard` đứng trước, đúng mock-up dòng 602–613. Tương tự cặp `CapacityCard`/`SpiCpiCard` và `BacklogOverdueCard`/`SCurveCard`. |

Thêm 3 dải phân tầng (bám mock-up): trước `KpiGrid` chèn `<div className="sect"><b>{t('overview.title')}</b><i /></div>` — **chỉ khi** key `overview.title` đã có; nếu chưa có thì bỏ qua, không thêm key mới ở Task này.

- [ ] **Bước 3: `OverviewWidgets.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 40 | `flex items-start gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3` | `alert` |
| 41 | `<IconAlert size={20} className="mt-0.5 shrink-0 text-red-600" />` | `<span className="dot" style={{ background: 'var(--danger)' }} />` |
| 42 | `text-sm text-red-800` | `<div style={{ minWidth: 0, flex: 1 }}><h4>…</h4><p>…</p></div>` |
| 56 | `grid grid-cols-2 gap-5 md:grid-cols-3 ${canViewFinance ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}` | `kpis${canViewFinance ? '' : ' k5'}` |
| 86 | `<CardBody className="pt-4">` | `<CardBody>` |
| 142 | `<CardBody className="space-y-3">` | `<CardBody className="flex flex-col gap-3">` |
| 143 | `grid grid-cols-2 gap-3` | `g2` |
| 145, 149 | `<div className="label">` | `<div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">` (class `.label` cũ đã bị xoá ở Task 1) |
| 146 | `text-xl font-semibold text-navy-900` | `text-title3 font-bold` |
| 150 | `text-xl font-semibold text-red-600` | `text-title3 font-bold` + `style={{ color: 'var(--danger)' }}` |
| 74, 98, 111, 141, 164 | `<CardHeader title={…} subtitle={…} />` | giữ nguyên — `CardHeader` mới render `subtitle` thành `<span className="en">` trong `.hd h3` |

- [ ] **Bước 4: `projects/[id]/page.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 17–22 | 3 chỗ `className="h-60 animate-pulse rounded-lg bg-slate-200/70"` | `className="sk h-60"` |
| 86 | `<div className="space-y-4">` | `<>` … `</>` |
| 88 | `flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500` | `flex flex-wrap items-center justify-between gap-2 text-footnote text-label2` |
| 90 | `hover:text-navy-800` | `transition-colors duration-fast hover:text-brand` |
| 94 | `font-medium text-navy-900` | `font-semibold text-label` |
| 102 | `text-xs text-slate-500` | `hintline` |
| 107 | `<Card className="p-5">` | `<Card><div className="phead">…</div></Card>` — dùng khối `.phead` của mock-up (xem Bước 5) |
| 132 | `grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6` | `kpis` |
| 142 | `grid grid-cols-1 gap-3 sm:grid-cols-2` | `kpis k2` |
| 165 | `grid gap-4 sm:grid-cols-2` | `g2` |
| 169 | `mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500` | `chainfoot` |
| 171 | `<b className="text-navy-800">` | `<b style={{ color: 'var(--label)' }}>` |
| 177, 233, 259, 306 | `grid gap-4 lg:grid-cols-2` | `g2` |
| 189 | `<CardBody className="space-y-2">` | `<CardBody><div className="stagegrid">…</div></CardBody>` |
| 196–207 | hàng giai đoạn thủ công | `<div className="stage${isBottleneck ? ' bt' : ''}"><span className="nm">…</span><span className="w">-</span><div className="bar"><i className="fill" style={{width:…}}/></div><span className="pc">…</span></div>` |
| 216, 263, 335 | `<table className="w-full text-sm">` | `<table className="tbl">` |
| 217, 271, 344 | `<tbody className="divide-y divide-slate-100">` | `<tbody>` |
| 265, 337 | `<tr className="text-left text-xs uppercase text-slate-400">` | `<tr>` |
| 266–268, 338–341 | `className="py-1.5 font-medium"` | bỏ; cột số → `className="num"` |
| 274, 295 | `py-2 font-mono text-xs text-navy-800` | `mono` |
| 275–278, 296, 347 | `py-2 text-xs text-slate-500` | bỏ |
| 290, 311, 365 | `py-4 text-center text-sm text-slate-400` | `<p className="empty">` |
| 292 | `<ul className="divide-y divide-slate-100">` | `<ul className="flex flex-col">` + `<li style={{ borderTop: '.5px solid var(--sep)' }}>` (mục đầu `first:border-t-0`) |
| 313–326 | danh sách cảnh báo | mỗi mục → `<div className="alert">` + `<span className="dot" style={{background: a.alertType==='Red' ? 'var(--danger)' : 'var(--warn)'}} />` + `<h4>` + `<p>` + `<div className="mt">` |
| 315 | `flex items-start gap-2 rounded-lg border border-slate-100 p-3` | `alert` |
| 320 | `text-xs text-slate-400` | (nằm trong `.mt`, bỏ class) |
| 322 | `mt-1 text-navy-800` | bỏ (`.alert p` lo) |
| 348–350 | `py-2 text-right text-slate-700` | `num` |
| 367 | `grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4` | giữ nguyên (lưới ảnh, mock-up không có) |
| 369 | `relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100` | `relative aspect-[4/3] overflow-hidden rounded-md` + `style={{ background: 'var(--fill)' }}` |
| 373 | `flex h-full flex-col items-center justify-center text-slate-400` | `flex h-full flex-col items-center justify-center text-label3` |
| 408 | `TimelineItem` wrapper `rounded-xl bg-slate-50 p-3` | `sumbar` |
| 409 | `<div className="label">` | `<div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">` |
| 411, 413 | `text-navy-900` | bỏ |
| 412 | `text-slate-300` | `text-label3` |
| 422 | `py-2 text-slate-500` | bỏ |
| 423 | `py-2 text-right font-medium text-navy-900` | `num` + `style={{ fontWeight: 600 }}` |
| 124 | `<div className="label">` (Giá trị HĐ) | thuộc khối `.phead` ở Bước 5 |

- [ ] **Bước 5: Khối header dự án `.phead`**

Copy CSS **dòng 283–292** của `mockup-apple-glass.html` vào `@layer components` của `app/globals.css`: `.phead`, `.phead .idz`, `.phead h2`, `.phead .nmrow`, `.phead .meta`, `.phead .val`, `.phead .val .l`, `.phead .val .v`, `.phead .val .s`.
(**Không** copy `.cdpanel` 293–309 — xem Q8.)

Dựng lại khối header (thay dòng 107–129), giữ **y nguyên** dữ liệu đang hiển thị:
```tsx
<Card>
  <div className="phead">
    <div className="idz">
      <div className="nmrow">
        <h2>{project.projectName}</h2>
        <StatusBadge status={summary.status} />
        <PriorityBadge priority={project.priority} />
      </div>
      <div className="meta">
        <span className="mono">{project.currentAliasCode}</span>
        <span>{customer?.name ?? '-'}</span>
        <span>{team?.name ?? '-'}</span>
        <span><TypeLabel type={project.projectType} /></span>
        <span><MarketLabel market={project.marketCode} /></span>
      </div>
    </div>
    <div className="val">
      <div className="l">{t('metric.contractValue')}</div>
      <div className="v">{formatTyd(project.contractValue, locale)}</div>
      <div className="s">{formatTon(project.tonnage)} tấn</div>
    </div>
  </div>
</Card>
```

> **Q8.** Chưa trả lời → dừng ở đây, không thêm `.cdpanel`/`.tl`. Trả lời (b)/(c) → copy thêm CSS 293–332 và dựng khối tương ứng; dữ liệu lấy từ `project.plannedStartDate`, `project.plannedFinishDate`, `project.actualStartDate`, `project.committedHandoverDate`, `summary.pctPlan`, `summary.pctActual` (đã có sẵn trong scope, **không** gọi thêm query nào).

> **Q7.** Trả lời (b) → chỉnh cờ `hero` ở `OverviewWidgets.tsx` dòng 57–63 và `projects/[id]/page.tsx` dòng 133–138 theo đúng 3 thẻ chủ dự án chỉ định.

- [ ] **Bước 6: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
`npm test` phải giữ xanh `src/server/projects-detail-page-month-guard.test.ts` (render thật trang chi tiết).
Kiểm mắt `/vi/overview` và `/vi/projects/1` ở cả 2 theme. Đối chiếu mock-up: KPI 6 cột, biểu đồ rộng bên trái / donut bên phải, bảng danh mục cuối trang.

- [ ] **Bước 7: Commit**
```bash
git add "app/[locale]/(app)/overview/page.tsx" "app/[locale]/(app)/projects/[id]/page.tsx" src/components/dashboard/OverviewWidgets.tsx app/globals.css src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 10 - trang Tong quan + Chi tiet du an"
```

---

### Task 11: Các trang còn lại (gồm trang không có trong mock-up)

**Files (10 file):**
- Modify: `app/[locale]/(app)/report/page.tsx`
- Modify: `app/[locale]/(app)/alerts/page.tsx`
- Modify: `app/[locale]/(app)/compliance/page.tsx`
- Modify: `app/[locale]/(app)/audit/page.tsx`
- Modify: `app/[locale]/(app)/admin/page.tsx`
- Modify: `app/[locale]/(app)/nhap-lieu/page.tsx`
- Modify: `app/[locale]/(app)/import/page.tsx`
- Modify: `app/[locale]/(app)/data-dictionary/page.tsx`
- Modify: `app/[locale]/(app)/data-schema/page.tsx`
- Modify: `app/[locale]/not-found.tsx`
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 11 - cac trang con lai")

**Nguyên tắc suy ra cho trang mock-up KHÔNG vẽ** (Từ điển dữ liệu, Sơ đồ dữ liệu, Import, 404) — rút từ 7 trang mock-up có vẽ, áp cứng:
1. Mọi khối nội dung là `.card`; tiêu đề khối nằm trong `.card > .hd > h3`; chú thích phụ là `<span className="en">`; thân là `.card > .bd`.
2. Tiêu đề trang (`<h1>`) **bỏ hẳn** — topbar đã hiện tên trang (mock-up dòng 582). Mô tả trang giữ lại dưới dạng `<p className="hintline">` **trong** card đầu tiên, không để trần trên nền.
3. Bảng: `.tbl` trong `.bd.scroll`. Danh sách: `.alert` hoặc `<li>` có `border-top: .5px solid var(--sep)`.
4. Nhãn phân loại: `.chip` + `c-ok|c-warn|c-dan|c-info|c-plain`. **Không** tự chế màu mới.
5. Nút: `.btn` / `.btn.ghost`. Input: `.inp`.
6. Trạng thái rỗng: `<p className="empty">`.
7. Dải phân nhóm trong trang dài: `<div className="sect"><b>TÊN NHÓM</b><i /></div>`.
8. Lưới: `g2` / `g3` / `g21` / `kpis`. Không dùng `grid-cols-*` của Tailwind nữa trừ lưới ảnh.

- [ ] **Bước 1: Gỡ 10 file khỏi PENDING → test ĐỎ**

- [ ] **Bước 2: `report/page.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 33 | `<div className="space-y-4">` | `<>` … `</>` |
| 34–42 | hàng tiêu đề + nút xuất | bỏ `<h1>`; đưa nút xuất vào `.hd` của card đầu, hoặc để riêng `<div className="flex justify-end">` |
| 38 | `inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90` | `btn` |
| 44 | `grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6` | `kpis` |
| 57, 112 | `py-4 text-center text-sm text-slate-400` / `px-4 py-10 text-center …` | `empty` |
| 59 | `<ul className="space-y-2">` | `<div className="flex flex-col gap-2.5">` |
| 61 | `flex items-center gap-3 rounded-lg border border-slate-100 p-3` | `alert` |
| 62 | `min-w-0 flex-1 truncate text-sm font-medium text-navy-900` | `<h4 className="min-w-0 flex-1 truncate">` |
| 74 | `<CardBody className="pt-2">` | `<CardBody>` |
| 75 | `overflow-x-auto` | `scroll` |
| 76 | `w-full min-w-[980px] text-sm table-zebra` | `tbl` + `style={{ minWidth: 980 }}` |
| 78 | `<tr className="border-y …">` | `<tr>` |
| 79–84 | `px-4 py-2.5 font-medium` | bỏ; 4 cột số → `num` |
| 87 | `divide-y divide-slate-100` | bỏ |
| 90 | `px-4 py-2.5 font-mono text-xs text-slate-500` | `mono` |
| 92 | `font-medium text-navy-900 hover:text-accent` | bỏ |
| 96–107 | `px-4 py-2.5 text-right tabular-nums …` | `num` |
| 97, 102 | `font-medium text-amber-600` / `text-slate-700` | `<Badge tone={… < THRESHOLDS.spiWarn ? 'warn' : 'ok'}>` |

- [ ] **Bước 3: `alerts/page.tsx`**

- dòng 22: `<div className="space-y-4">` → `<>` … `</>`
- dòng 23: bỏ `<h1 className="text-lg font-semibold text-navy-900">` (topbar đã có tên trang)
- Bọc `<AlertList …/>` trong `<Card><div className="hd"><h3>{t('alert.title')}</h3><Badge tone="neutral">{open.length} {t('alert.open')}</Badge></div><div className="bd scroll">…</div></Card>` — **chỉ** nếu key `alert.open` đã tồn tại; nếu chưa có thì bỏ badge, **không** thêm key mới ở Task này.

Cẩn thận: `src/server/operation-pages-render.test.ts` render trang này. Chạy `npm test` ngay sau khi sửa.

- [ ] **Bước 4: `compliance/page.tsx`**

- dòng 49 `<div className="space-y-4">` → `<>` … `</>`; dòng 50 bỏ `<h1>`
- dòng 53 `<CardBody className="pt-4">` → thêm `<div className="hd"><h3>{t('compliance.title')}</h3><Badge tone="warn">{rows.length}</Badge></div>` phía trên, rồi `<CardBody className="scroll">`
- dòng 55 `py-10 text-center text-sm text-slate-400` → `empty`
- dòng 57 `overflow-x-auto` → bỏ (đã có `scroll`)
- dòng 58 `w-full min-w-[980px] text-sm table-zebra` → `tbl` + `style={{minWidth:980}}`
- dòng 60 `<tr className="border-y …">` → `<tr>`; 61–65 `px-4 py-2.5 font-medium` → bỏ
- dòng 68 `divide-y divide-slate-100` → bỏ
- dòng 72 `font-medium text-navy-900 hover:text-accent` → bỏ; `<td>` thêm `style={{fontWeight:600}}`
- dòng 76 `px-4 py-2.5 font-mono text-xs text-slate-500` → `mono`
- dòng 77, 81 `px-4 py-2.5 text-slate-600` → bỏ

`src/server/compliance-page.test.ts` render trang này — chạy `npm test`.

- [ ] **Bước 5: `audit/page.tsx`**

Cùng khuôn Bước 4. Riêng:
- dòng 28 `w-full min-w-[980px] text-sm table-zebra` → `tbl sticky` + `style={{minWidth:980}}`
- dòng 44, 47, 50, 52 `font-mono text-xs …` → `mono`
- dòng 46 `px-4 py-2.5 text-xs text-navy-800` → `<Badge tone="neutral">{a.tableName}</Badge>` (mock-up dòng 1780: cột hành động là chip)
- dòng 49 `max-w-[300px] break-all px-4 py-2.5` → `style={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-all' }}`
- dòng 51 `mx-1 text-slate-300` → `mx-1 text-label3`

- [ ] **Bước 6: `admin/page.tsx`**

- dòng 30 `<div className="space-y-4">` → `<>` … `</>`
- dòng 31–34: bỏ `<h1>`, để `<div className="flex justify-end"><ResetDataButton /></div>`
- dòng 61 `py-4 text-center text-sm text-slate-400` → `empty`
- dòng 63, 160 `max-h-64 overflow-auto` → `scroll` + `style={{ maxHeight: 256 }}`
- dòng 64, 161 `w-full text-sm` → `tbl sticky`
- dòng 66, 163 `text-left text-xs uppercase text-slate-400` → bỏ
- dòng 67–71, 165 `py-1.5 font-medium` → bỏ
- dòng 74, 171 `divide-y divide-slate-100` → bỏ
- dòng 77, 79 `py-1.5 font-mono text-xs text-slate-500` → `mono`
- dòng 78, 80, 81 `py-1.5 text-xs …` → bỏ
- dòng 97 `space-y-6` → `flex flex-col gap-5`
- dòng 99, 103 `mb-2 text-sm font-medium text-navy-900` → `<div className="sect"><b>…</b><i /></div>`
- dòng 110 `grid gap-4 lg:grid-cols-2` → `g2`
- dòng 112, 122, 132, 142 `className="text-navy-400"` trên icon → bỏ class
- dòng 175 `py-2 ${j === 0 ? 'font-medium text-navy-900' : 'text-slate-600'}` → `className={j === 0 ? '' : undefined} style={j === 0 ? { fontWeight: 600 } : undefined}`
- `UserEditor`/`FieldEditor`/`ActivityViewer` nằm trong `Card` và có `<select>`/dropdown → các `Card` bọc chúng thêm `className="overflow-visible"`

- [ ] **Bước 7: `nhap-lieu/page.tsx` + `import/page.tsx`**

`nhap-lieu/page.tsx`:
- dòng 47 `mx-auto max-w-4xl` → `mx-auto w-full max-w-5xl`
- dòng 48 bỏ `<h1 className="mb-4 text-lg font-semibold text-navy-900">`
- dòng 50 `<section className="mb-8">` → `<section className="mb-5">`
- dòng 51, 56 `mb-3 text-sm font-semibold text-navy-800` → `<div className="sect"><b>{t('form.sectionNew')}</b><i /></div>`
- dòng 58 `py-10 text-center text-sm text-slate-400` → `empty`

`import/page.tsx`:
- dòng 12 `mx-auto max-w-4xl` → `mx-auto w-full max-w-5xl`
- dòng 13 bỏ `<h1 className="mb-4 text-lg font-semibold text-navy-900">`

- [ ] **Bước 8: `data-dictionary/page.tsx`** (không có trong mock-up — suy theo nguyên tắc 1/2/6)

| Dòng | Cũ | Mới |
|---|---|---|
| 17 | `mx-auto max-w-4xl space-y-4` | `mx-auto flex w-full max-w-5xl flex-col gap-3.5` |
| 18 | bỏ `<h1>` | — |
| 19 | `text-sm text-slate-500` | đưa vào card đầu: `<div className="card"><div className="bd"><p className="hintline">…</p></div></div>` |
| 26 | `card group overflow-hidden` | `card group` |
| 27 | `flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden` | `hd cursor-pointer [&::-webkit-details-marker]:hidden` — lưu ý `<summary>` phải là con trực tiếp của `<details className="card">` để `.card>.hd` ăn |
| 29 | `shrink-0 text-slate-400 transition-transform group-open:rotate-180` | `shrink-0 text-label3 transition-transform duration-fast group-open:rotate-180` |
| 31 | `space-y-2.5 px-5 pb-5` | `bd flex flex-col gap-2.5` |
| 33 | `rounded-xl border border-slate-100 p-3 dark:border-slate-700` | `sumbar` + `style={{ display: 'block' }}` |
| 34 | `text-sm font-medium text-navy-900 dark:text-slate-100` | `text-footnote font-semibold text-label` |
| 37 | `mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400` | `mt-1 text-caption1 leading-relaxed text-label2` |
| 41 | `mt-1.5 font-mono text-xs text-emerald-700 dark:text-emerald-400` | `mono mt-1.5` + `style={{ color: 'var(--ok)' }}` |

- [ ] **Bước 9: `data-schema/page.tsx`** (không có trong mock-up — suy theo nguyên tắc 1/4/8)

- dòng 7–12 `KIND`: đổi `cls` sang chip của hệ mới
  ```ts
  const KIND: Record<SchemaKind, { label: string; cls: string }> = {
    dim: { label: 'Dimension', cls: 'chip' },       // + style nen vang, xem duoi
    project: { label: 'Hub', cls: 'chip c-info' },
    fact: { label: 'Fact', cls: 'chip c-ok' },
    support: { label: 'Support', cls: 'chip c-plain' },
  };
  ```
  Riêng `dim` là màu vàng — không có sẵn class `c-*`. Thêm vào `@layer components` của `app/globals.css` (3 rule tách rời, **không** lồng `@media` trong danh sách selector):
  ```css
  .c-gold { background: rgba(245, 179, 1, .18); color: #7a5a00; }
  :root[data-theme="dark"] .c-gold { color: var(--gold); }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .c-gold { color: var(--gold); }
  }
  ```
  Hex `#7a5a00` ở đây là vàng-đậm cho chữ trên nền vàng-nhạt chế độ sáng — đưa vào **CSS**, không phải `.tsx`, nên guard test không chặn.
  Rồi `dim: { label: 'Dimension', cls: 'chip c-gold' }`.
- dòng 31 `mx-auto max-w-5xl space-y-6` → `mx-auto flex w-full max-w-5xl flex-col gap-3.5`
- dòng 32–37: bỏ `<h1>`, đưa `<p>` mô tả vào card đầu dưới dạng `hintline`
- dòng 42 `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${KIND[k].cls}` → `${KIND[k].cls}` (`.chip` đã lo)
- dòng 43 `h-2 w-2 rounded-full bg-current opacity-60` → giữ
- dòng 50 `card p-5` → `card` + bọc nội dung `<div className="bd">`
- dòng 51 `text-sm font-semibold text-navy-900` → chuyển thành `<div className="hd"><h3>Mô hình quan hệ - Star schema</h3></div>`
- dòng 52 `mt-1 text-xs text-slate-500` → `hintline`
- dòng 53 `font-mono text-accent` / `font-mono` → `mono` + `style={{ color: 'var(--accent)' }}` / `mono`
- dòng 59 `<div className="label">` → `<div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">`
- dòng 61 `rounded-lg border border-slate-200 bg-gold-soft/40 px-3 py-2` → `sumbar` + `style={{ display: 'block', background: 'rgba(245,179,1,.12)' }}`
- dòng 62 `font-mono text-xs font-semibold text-navy-800` → `mono` + `style={{ fontWeight: 700 }}`
- dòng 63 `text-[11px] text-slate-500` → `hintline`
- dòng 70 `hidden text-slate-300 lg:block` → `hidden text-label3 lg:block`
- **Các dòng còn lại (70→cuối file):** áp đúng 8 nguyên tắc ở đầu Task. Quy tắc chuyển nhanh: `border-slate-*` → `border-sep`; `bg-slate-50|100` → `bg-fill`; `bg-navy-50` → `bg-fill-2`; `text-navy-800|900` → bỏ (kế thừa `--label`); `text-slate-400|500` → `text-label3`; `text-slate-600|700` → `text-label2`; `text-accent` → `text-brand`; `rounded-lg|xl` → `rounded-sm|md`; `text-xs` → `text-caption1`; `text-[11px]` → `text-caption2`; `text-sm` → `text-footnote`. Xong phải chạy lại guard test để chắc không sót.

- [ ] **Bước 10: `not-found.tsx`** (không có trong mock-up)

```tsx
<div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
  <div className="card" style={{ padding: '32px 40px' }}>
    <div
      className="mx-auto grid h-16 w-16 place-items-center"
      style={{ borderRadius: 'var(--r-icon)', background: 'var(--accent-tint)', color: 'var(--accent)' }}
    >
      <IconProject size={30} />
    </div>
    <h1 className="mt-4 text-title1 font-bold tracking-large">404</h1>
    <p className="mt-1 text-footnote text-label2">{t('common.noData')}</p>
    <Link href="/overview" className="btn mt-4 inline-flex">
      {t('nav.overview')}
    </Link>
  </div>
</div>
```
(Bỏ `bg-canvas` — `.wall` + `--bg-base` đã lo nền.)

- [ ] **Bước 11: Cổng kiểm tra + kiểm mắt**
```
npx vitest run src/ui/legacy-style-guard.test.ts
npx tsc --noEmit
npm test
```
Kiểm mắt đủ 10 URL ở cả 2 theme:
`/vi/report` · `/vi/alerts` · `/vi/compliance` · `/vi/audit` · `/vi/admin` · `/vi/nhap-lieu` · `/vi/import` · `/vi/data-dictionary` · `/vi/data-schema` · `/vi/khong-ton-tai` (404).
Đối chiếu: không trang nào còn mảng trắng đục / xám `slate` lạc lõng; mọi card đều là kính; mọi bảng cùng một khuôn.

- [ ] **Bước 12: Commit**
```bash
git add app "app/globals.css" src/ui/legacy-style-guard.test.ts
git commit -m "style(glass): Task 11 - cac trang van hanh + he thong + 404"
```

---

### Task 12: Trang đăng nhập + dọn sạch di sản

**Files:**
- Modify: `app/[locale]/login/page.tsx`
- Modify: `src/components/layout/LoginForm.tsx`
- Modify: `app/globals.css` (xoá toàn bộ khối `.dark .xxx{}` di sản)
- Modify: `tailwind.config.ts` (xoá key màu/bo góc/bóng di sản)
- Modify: `app/[locale]/layout.tsx` (bỏ gắn class `.dark`)
- Modify: `src/components/layout/SettingsMenu.tsx` (bỏ `root.classList.toggle('dark', …)`)
- Modify: `src/ui/legacy-style-guard.test.ts` (xoá nhóm "Task 12 - dang nhap" → `PENDING` rỗng; bổ sung 2 case canh cuối)

**Interfaces:** kết thúc. Sau Task này `PENDING = []` và không còn dấu vết hệ cũ trong repo.
**Chặn bởi Q1** (logo ở trang login).

- [ ] **Bước 1: Gỡ 2 file cuối khỏi PENDING → test ĐỎ**

`PENDING` giờ là `const PENDING: string[] = [];`. Chạy `npx vitest run src/ui/legacy-style-guard.test.ts` → FAIL ở `login/page.tsx` (`bg-[#B91C1C]`) và `LoginForm.tsx` (`bg-accent`).

- [ ] **Bước 2: Thêm CSS trang đăng nhập vào `app/globals.css`**

Mock-up không vẽ trang đăng nhập. Suy theo nguyên tắc: nền là `.wall` + `--bg-base` (giống mọi trang khác), thẻ đăng nhập là vật liệu kính dày nhất (`--mat-chrome`, `--glass-3`, `--e4`) — cùng công thức với `.modal` ở Task 6.

```css
  /* --- Trang dang nhap (mock-up khong ve; suy tu .modal + .card) --- */
  .authwrap {
    position: relative; z-index: 1;
    min-height: 100vh; display: grid; place-items: center; padding: 16px;
  }
  .authcard {
    width: 100%; max-width: 380px; padding: 30px 28px;
    border-radius: var(--r-xl);
    background: var(--glass-3);
    -webkit-backdrop-filter: blur(var(--mat-chrome)) saturate(var(--mat-sat));
    backdrop-filter: blur(var(--mat-chrome)) saturate(var(--mat-sat));
    border: .5px solid var(--glass-stroke);
    box-shadow: var(--e4), var(--inner-hi);
  }
  .authcard .brandbox { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 22px; }
  .authcard .brandbox h1 { margin-top: 12px; font-size: var(--t-title3); font-weight: 700; letter-spacing: var(--tr-title); }
  .authcard .brandbox p { font-size: var(--t-caption1); color: var(--label3); margin-top: 2px; }
  .authsep { position: relative; text-align: center; margin: 4px 0; }
  .authsep:before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: .5px; background: var(--sep); }
  .authsep span {
    position: relative; padding: 0 12px; background: var(--glass-3);
    font-size: var(--t-caption2); text-transform: uppercase; letter-spacing: .06em; color: var(--label3);
  }
```

- [ ] **Bước 3: `login/page.tsx`**

```tsx
return (
  <div className="authwrap">
    <div className="authcard">
      <div className="brandbox">
        {/* Q1: (a)/(c) -> .appicon navy; (b) -> logo.png tren nen trang */}
        <div className="appicon" style={{ width: 56, height: 56, flex: '0 0 56px' }}>
          {/* noi dung theo Q1 */}
        </div>
        <h1>DDC Control Tower</h1>
        <p>{t('app.subtitle')}</p>
      </div>
      <LoginForm googleEnabled={googleEnabled} />
      <p className="hintline" style={{ textAlign: 'center', marginTop: 22 }}>
        Built by Buffalo Tech
      </p>
    </div>
  </div>
);
```
Trang này hiện là Server Component không dùng `useTranslations`. Muốn dùng `t('app.subtitle')` thì thêm `const t = await getTranslations();` (import từ `next-intl/server`) — key `app.subtitle` đã có sẵn ở cả vi/en. Nếu không muốn đụng, để nguyên chuỗi cũ và bỏ dòng `<p>`.
Bỏ import `Image` nếu Q1 = (a).

> **Chặn Q1.** (a)/(c) → dán glyph SVG mock-up dòng 562–563 vào trong `.appicon`. (b) → `<div className="appicon" style={{background:'#fff'}}><Image src="/logo.png" alt="DDC" width={56} height={56} className="h-full w-full object-cover" /></div>`.

- [ ] **Bước 4: `LoginForm.tsx`**

| Dòng | Cũ | Mới |
|---|---|---|
| 18–19 | `inputCls` dài | `const inputCls = 'inp';` |
| 35 | `space-y-4` | `flex flex-col gap-3.5` |
| 36 | `space-y-3.5` | `flex flex-col gap-3` |
| 37–47 | `<div><label className="mb-1.5 block text-xs font-medium text-slate-600">…</label><input …/></div>` | `<div className="field"><span className="lb">…</span><input … className={inputCls} /></div>` |
| 48–51 | như trên cho mật khẩu | như trên |
| 53 | `rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600` | `sumbar bad` |
| 58 | `w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50` | `btn w-full justify-center` |
| 66–73 | khối "hoặc" | `<div className="authsep"><span>{t('auth.or')}</span></div>` |
| 81 | `flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-slate-50 disabled:opacity-50` | `btn ghost w-full justify-center` |
| 92–113 | `GoogleIcon` | **giữ nguyên hex thương hiệu Google** — file này đã nằm trong `HEX_ALLOW` của guard test |

- [ ] **Bước 5: Xoá di sản trong `app/globals.css`**

Xoá **toàn bộ** khối bắt đầu từ comment `/* Dark mode — override các utility màu sáng tập trung tại 1 chỗ */` tới hết rule `.dark .hover\:bg-slate-100:hover{…}` (gốc là dòng 21–196). Kiểm tra bằng `rg "\.dark " app/globals.css` → phải không còn kết quả nào.

- [ ] **Bước 6: Xoá di sản trong `tailwind.config.ts`**

Trong `theme.extend.colors` xoá: cả object `navy`, cả object `accent`, `canvas`, `offwhite`.
Trong `borderRadius` xoá `card: '16px'`.
Trong `boxShadow` xoá `card` và `'card-hover'`.
Giữ nguyên toàn bộ token mới.

- [ ] **Bước 7: Bỏ gắn class `.dark`**

`app/[locale]/layout.tsx` — script nội tuyến rút gọn còn:
```tsx
__html: `(function(){try{var t=localStorage.getItem('ddc-theme')||'system';var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t)}else{r.removeAttribute('data-theme')}}catch(e){}})();`,
```
`src/components/layout/SettingsMenu.tsx` — trong `applyTheme` xoá 4 dòng: biến `dark` và `root.classList.toggle('dark', dark);`. Giữ `window.dispatchEvent(new Event('ddc:theme'));`.

- [ ] **Bước 8: Bổ sung 2 case canh cuối vào `src/ui/legacy-style-guard.test.ts`**

Thêm vào cuối `describe('canh style cu', …)`:
```ts
  it('globals.css khong con override .dark', () => {
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf-8');
    expect(css.includes('.dark ')).toBe(false);
  });

  it('tailwind.config.ts khong con palette di san', () => {
    const cfg = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf-8');
    for (const k of ['#B91C1C', '#FEE2E2', "canvas:", "offwhite:", "navy: {", "navy:{"]) {
      expect(cfg.includes(k), `con "${k}"`).toBe(false);
    }
  });

  it('PENDING da rong - khong con file nao chua doi', () => {
    expect(PENDING).toEqual([]);
  });
```

- [ ] **Bước 9: Cổng kiểm tra toàn bộ**
```
npx vitest run src/ui
npx tsc --noEmit
npm test
npm run build
```
Cả 4 phải xanh. `npm run build` mà lỗi do thiếu `DATABASE_URL` thì bỏ qua; lỗi do CSS/Tailwind thì **phải** sửa.

- [ ] **Bước 10: Kiểm mắt lần cuối — quét toàn bộ 14 URL, cả 2 theme**

`/vi/login` · `/vi/overview` · `/vi/projects/1` · `/vi/nhap-lieu` · `/vi/report` · `/vi/alerts` · `/vi/compliance` · `/vi/audit` · `/vi/admin` · `/vi/import` · `/vi/data-dictionary` · `/vi/data-schema` · `/vi/khong-ton-tai` · `/en/overview`

Danh sách kiểm (mỗi URL × 2 theme):
1. Không còn bất kỳ mảng đỏ `#B91C1C` nào (trừ logo nếu Q1 = b).
2. Không còn nền trắng đặc `#fff` trên card — phải là kính có thấy nền mesh phía sau.
3. Chữ trên nền kính đạt độ tương phản đọc được ở cả 2 theme.
4. Không có phần tử nào "mất màu" (đen/không style) — dấu hiệu sót utility đã bị xoá khỏi tailwind.config.
5. Biểu đồ đổi màu ngay khi bấm chuyển theme.
6. Dropdown/popover không bị cắt bởi mép card.
7. Bảng: header dính khi cuộn (ở các bảng có `.tbl.sticky`).

- [ ] **Bước 11: Commit**
```bash
git add -A
git commit -m "style(glass): Task 12 - trang dang nhap + don sach di sản he do"
```

---

## Tự soát lại (đã chạy khi viết plan)

**Phủ đặc tả** — đối chiếu từng mục yêu cầu với Task:

| Yêu cầu | Task |
|---|---|
| Token blur `--mat-*` 5 mức | 1 |
| Corner radius `--r-*` continuous | 1 |
| Elevation `--e0`→`--e4` | 1 |
| Dynamic type `--t-*` kiểu SF | 1 |
| Easing/motion `--ease-ios`, `--dur-*` | 1 (token) + 3 (áp dụng, Q4) |
| Accent navy `#1d5a9e` trên nền `#e9eef6` | 1 |
| Giữ vàng `#f5b301` cho tag "Trọng tâm" | 1 (token) + 4 (tag) |
| Bộ màu series đã qua validator | 1 (token) + 9 (áp vào Recharts) |
| Light/dark qua `prefers-color-scheme` + `data-theme` | 1 |
| AppShell / sidebar / header | 2 |
| TopProgressBar, SyncProgressBar | 2 |
| `charts.tsx` + màu series Recharts | 9 |
| KPI card / dashboard widget | 4, 10 |
| Bảng | 5 |
| Form / wizard 4 bước | 6, 7 |
| Compliance, Audit, Admin (không có trong mock-up) | 8, 11 |
| Login | 12 |
| SettingsMenu | 2 |
| Modal | 6 (ChangePasswordModal) + 8 (modal đặt lại mật khẩu) |
| Trang phụ không bị bỏ sót | test `legacy-style-guard` bắt buộc `PENDING = []` ở Task 12 |
| Không đụng data model / business logic / API | Global Constraint #1; `npm test` giữ xanh ở mọi Task |

**Quét placeholder:** không có "TBD"/"tương tự Task N"/"xử lý lỗi phù hợp". Mọi bước có bảng ánh xạ class cụ thể hoặc khối code đầy đủ; mọi khối CSS có số dòng nguồn trong `mockup-apple-glass.html`.

**Nhất quán kiểu:** `ChartTokens` + `useChartTokens()` khai báo ở Task 9 và chỉ dùng ở Task 9; `KpiCardProps` giữ nguyên chữ ký cũ nên 3 nơi gọi ở Task 10/11 không phải sửa; `BadgeTone` giữ nguyên 5 giá trị nên `Badges.tsx` và mọi `<Badge tone=…>` ở Task 5/8/10/11 vẫn hợp lệ; `applyTheme` (Task 1) bắn `ddc:theme` mà `useChartTokens` (Task 9) lắng nghe — cùng tên sự kiện; `PENDING` (Task 1) được từng Task sau xoá đúng nhóm comment đã đặt sẵn.

**Rủi ro đã ghi rõ trong plan, đừng để dính lại:**
1. `.card{overflow:hidden}` cắt dropdown → mọi card chứa `<select>`/Combobox/popover phải thêm `overflow-visible` (Task 3, 5, 6, 7, 8, 11).
2. `var()` không chạy trong presentation attribute của SVG → bắt buộc dùng `useChartTokens()` cho Recharts, **không** truyền chuỗi `'var(--s-plan)'` vào prop `fill`/`stroke` (Task 9).
3. Không dùng opacity modifier lên màu token (Global Constraint #4).
4. `.card > .hd` / `.card > .bd` là selector con **trực tiếp** — không bọc thêm div ở giữa (Task 3).
5. Thêm key i18n phải thêm cả vi lẫn en (Global Constraint #8) — chỉ Task 4 thêm key (`kpi.focusTag`).

---

## Bàn giao thi công

Plan đã lưu ở `.bangiao/ke-hoach.md`. Hai cách chạy:

**1. Subagent-Driven (khuyến nghị)** — mỗi Task một subagent mới, review giữa các Task, vòng lặp nhanh. Dùng `superpowers:subagent-driven-development`.

**2. Chạy tuần tự trong phiên này** — dùng `superpowers:executing-plans`, chạy theo lô kèm điểm dừng review.

**Trước khi bắt đầu:** trả lời Q1–Q6 (Q7, Q8 trả lời sau cũng được). Q6 chặn ngay Task 1 nên cần trả lời trước tiên.

