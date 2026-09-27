# Kế hoạch: Nâng Next.js lên 15.5.x (≥ 15.5.24) + React 19 + next-intl 4 + next-auth 4.24 mới nhất

> Planner dùng skill `writing-plans`.
> Coder chỉ đọc file này.
> Làm đúng thứ tự Task 0 → 5, mỗi task 1 commit (Task 0 gộp vào commit Task 1, Task 5 không commit code), sau MỖI commit cập nhật `D:\_project\DDC_dieu-phoi\phien-A.md`.

**Mục tiêu:** gỡ các advisory chặn go-live của `next@14.2.35` (GHSA-p293-qw3h-jr36 RCE khi host Windows, GHSA-2xp9-vwfh-vxw4 AVIF optimizer), `next-intl@3.26.3` (GHSA-8f24-v5vv-gm5j open redirect), `cookie < 0.7` (qua `next-auth`), mà không đổi hành vi hay giao diện.

**Cách làm:** chuẩn bị trên Next 14 những gì làm trước được (dời `dynamic({ ssr: false })` ra client component), rồi nâng một lượt các gói bắt buộc đi cùng nhau (next, react, react-dom, @types/react(-dom), next-auth, recharts vì ràng buộc peer), chuyển request API sang async, sau đó nâng next-intl riêng, cuối cùng đo lại và chạy đủ cổng.

**Nguồn yêu cầu:** `D:\_project\DDC_dieu-phoi\lenh-cho-A-2026-09-26.md` PHẦN 4, `D:\_project\DDC_dieu-phoi\lenh-cho-A-2026-09-27.md` PHẦN 3.

---

## CÂU HỎI CÒN BỎ NGỎ (cần chủ dự án quyết, KHÔNG chặn Task 0-5)

**Q1. Đo lại T1 trên 10 triệu dòng khi nào?**
Script `perf:seed` chỉ chạy trên DB của B (`ddc_control_tower_b`, chốt cứng trong `src/lib/perf-guard.ts`), B hết limit tới 29/09.
Kế hoạch này chỉ đo **so sánh trước/sau** trên DB tạm e2e của A (17 dự án, Task 0 và Task 5), không phải phép đo T1 chính thức.
- (a) **Đề xuất:** gộp phép đo 10 triệu dòng vào load test P5 mục 7 (A làm, đằng nào cũng cần bộ seed 10 triệu dòng); merge bản nâng Next khi phép đo so sánh đạt.
- (b) Chờ B đo sau 29/09 rồi mới merge (go-live chậm theo).
- (c) Mở rộng `perf-guard.ts` cho phép 1 DB tạm của A (thêm việc + phải qua security review lại).

**Q2. Thứ tự merge với nhánh P7-C2 của C.**
C đang làm `feature/p7-c2-chuoi-gia-tri` (Task 4-9 sắp tới nhiều khả năng sửa `app/[locale]/(app)/projects/[id]/page.tsx`, `StageExplorer`...).
Nhánh này cũng sửa chữ ký hàm và khối `dynamic(...)` của đúng trang đó, nên sẽ có xung đột khi merge.
- (a) **Đề xuất:** bên nào merge `main` sau thì tự `git merge main` và giải xung đột (xung đột dự kiến nhỏ: dòng chữ ký page và khối import chart); A ghi rõ trong `phien-A.md` danh sách file page đã sửa.
- (b) C tạm dừng sửa page cho tới khi A merge xong.

**ĐÃ QUYẾT (chủ dự án, 2026-09-27):** Q1 = (a) gộp phép đo 10 triệu dòng vào load test P5 mục 7, merge khi phép đo so sánh trước/sau đạt.
Q2 = (a) bên merge `main` sau tự giải xung đột, A ghi danh sách page đã sửa vào `phien-A.md`.

Các lựa chọn kỹ thuật planner đã tự quyết nằm ở mục "Quyết định kỹ thuật" bên dưới.

---

## Ràng buộc chung (áp cho mọi task)

- Repo `D:\_project\DDC_Control_Tower`, nhánh `feature/nang-next15` từ `main` @ `54ac9bf`.
- Chạy lệnh qua PowerShell, đường dẫn ổ `D:` viết hoa.
- KHÔNG sửa các file tài khoản C đang giữ: `prisma/schema.prisma`, `prisma/migrations/`, `src/server/actions.ts`, `src/server/project-queries.ts`, `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`.
- Nếu `tsc`/test đỏ mà cách sửa duy nhất là sửa một trong các file đó: DỪNG, ghi vào `.bangiao/thay-doi.md` mục "Cần hỏi", báo điều phối viên, không tự sửa.
- File nóng A được sửa trong kế hoạch này: chỉ `src/server/queries.ts` (sửa comment, Task 2). Trước khi sửa, đọc `phien-B.md`, `phien-C.md` xác nhận không ai giữ, rồi thêm vào mục "Đang giữ" của `phien-A.md`; nhả sau commit.
- DB thật `ddc_control_tower` KHÔNG seed, KHÔNG ghi. Mọi lệnh chạy app/build/`check:read` thủ công đều đặt CẢ HAI biến `DATABASE_URL` và `DIRECT_URL` trỏ DB tạm `ddc_control_tower_e2e_a` (xem "Biến môi trường DB tạm").
- Mạng chặn TLS: `npm install`/`npm view`/`npm audit` và dev server cần `$env:NODE_EXTRA_CA_CERTS='D:\_project\DDC_dieu-phoi\tools\win-root-ca.pem'`. KHÔNG tắt kiểm TLS.
- Không sửa tay `package-lock.json` (chỉ sinh qua `npm install`), không sửa `PROGRESS.md`, `.serena/memories/`, `CHANGELOG.md`.
- `next-env.d.ts` là file Next tự sinh: nếu `next build`/`next dev` sinh lại thì commit bản sinh ra, không sửa tay.
- Ghim phiên bản CHÍNH XÁC (không `^`, không `~`) cho các gói nâng trong kế hoạch này, giống quy ước hiện có của `next`, `react`, `next-auth`, `next-intl`, `recharts` trong `package.json`.
- Giữ nguyên khối `"overrides": { "next-auth": { "nodemailer": "$nodemailer" } }` trong `package.json`.
- Không push. Commit message tiếng Việt không dấu, dạng `<loai>(next15): <mo ta>` (theo `git log`, ví dụ `fix(e2e): ...`), dòng cuối: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không dùng dấu gạch dài ở bất kỳ đâu (code, comment, tài liệu, commit).
- Ghi nhật ký thay đổi vào `.bangiao/thay-doi.md` (quy ước dây chuyền, xem mẫu `.bangiao/archive/p3c-a-form-ke-hoach-2026-09-27/thay-doi.md`).

### Biến môi trường DB tạm (dùng lại ở Task 0, 2, 3, 4)

```powershell
# Lấy DATABASE_URL trong .env, chỉ thay tên DB (đoạn sau dấu "/" cuối, trước "?") thành ddc_control_tower_e2e_a.
# Cách dựng giống hàm e2eADbUrlFrom trong e2e/helpers/env.ts.
$env:DATABASE_URL = '<URL .env với tên DB = ddc_control_tower_e2e_a>'
$env:DIRECT_URL   = $env:DATABASE_URL
$env:NEXTAUTH_URL = 'http://localhost:3010'
```

Kiểm lại trước mỗi lệnh: `echo $env:DATABASE_URL` phải chứa `ddc_control_tower_e2e_a`.

---

## Quyết định kỹ thuật (planner tự chọn, có lý do)

1. **next-intl: lên 4.x mới nhất, không ở lại 3.26.x.**
   Ưu của v4: nhánh đang được bảo trì, nhận bản vá bảo mật (v3 là nhánh cũ), hỗ trợ Next 15 và 16 nên lần nâng Next sau không phải nâng lại next-intl.
   Nhược của v4: có breaking change (gói chỉ ESM, cookie locale mặc định thành cookie phiên, cấm truyền `null`/`undefined`/`boolean` làm tham số ICU, TypeScript ≥ 5).
   Với repo này nhược điểm nhỏ: `src/i18n/request.ts` đã dùng `requestLocale` và đã trả `locale`; TypeScript 5.5.4; không dùng API đã bỏ; mọi test đều mock `next-intl`.
   Cookie locale: đặt `localeCookie.maxAge` 1 năm trong `src/i18n/routing.ts` để GIỮ hành vi cũ của v3 (người dùng đã chọn ngôn ngữ thì mở lại trình duyệt vẫn giữ).
   `NextIntlClientProvider` vẫn truyền `messages={messages}` như cũ (v4 vẫn nhận), không đổi layout.
2. **recharts: ở lại nhánh 2.x, lên bản 2.x mới nhất + ghim `react-is` cùng bản React.**
   Recharts 3 là bản viết lại nhiều API, ngoài phạm vi.
   Recharts 2.12.7 khai peer React ≤ 18 nên `npm install` sẽ ERESOLVE với React 19; recharts 2.x cần `react-is` khớp bản React (React 19 đổi `$$typeof` của element, `react-is` 18 nhận sai làm Tooltip/Legend biến mất).
3. **Không đặt `experimental.staleTimes`.**
   Next 15 đổi mặc định router cache phía client cho trang động từ 30 giây về 0 (điều hướng qua lại luôn lấy số mới từ server).
   Tiêu chí T1 đo thời gian server trả trang, không phụ thuộc cache này; dashboard nhiều người nhập liệu nên số mới là có lợi; bớt một cờ experimental.
4. **`unstable_cache` (`src/server/cache.ts`) và `React.cache` (`requestMemo`) giữ nguyên code.**
   Next 15 chỉ đổi mặc định cache của `fetch` và `GET` route handler.
   Repo không dùng `fetch` để đọc dữ liệu trang (chỉ `src/server/fx-rates.ts` gọi VCB và đã có `cache: 'no-store'`); mọi route handler đọc dữ liệu đã có `export const dynamic = 'force-dynamic'` hoặc chỉ có `POST`.
   React 19 export `cache` ở cả bản thường (ngoài server component nó chỉ gọi thẳng hàm, không memo), nên nhánh dự phòng của `requestMemo` vẫn đúng; chỉ comment trong `queries.ts` cần sửa cho đúng sự thật.
5. **Chuyển async bằng codemod rồi rà tay**, vì chỉ có 12 file app + 1 file lib, rà được hết.
6. **`eslint-config-next`: bỏ qua**, repo không cài ESLint (không có trong `package.json`, không có file cấu hình).
7. **`useFormState` → `useActionState`: không có việc**, repo không dùng `useFormState`/`useFormStatus`, không có `<form action={...}>`.

---

## Danh sách file dự kiến đụng

Tạo mới:
- `src/components/dashboard/OverviewChartsLazy.tsx` (Task 1)
- `src/components/project/ProjectDetailChartsLazy.tsx` (Task 1)
- `.bangiao/thay-doi.md`, `.bangiao/hieu-nang.md`, `.bangiao/anh-test/*.png` (hồ sơ dây chuyền)

Sửa:
- `src/components/dashboard/OverviewWidgets.tsx` (Task 1)
- `app/[locale]/(app)/projects/[id]/page.tsx` (Task 1, Task 2)
- `package.json`, `package-lock.json` (Task 2, Task 3)
- `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`, `app/[locale]/login/page.tsx`, `app/[locale]/(app)/layout.tsx`, `app/[locale]/(app)/projects/page.tsx`, `app/[locale]/(app)/overview/page.tsx`, `app/[locale]/(app)/nhap-lieu/page.tsx`, `app/[locale]/(app)/ho-so-du-an/page.tsx`, `app/[locale]/(app)/audit/page.tsx` (Task 2)
- `app/api/cron/[job]/route.ts`, `app/api/photos/[...path]/route.ts` (Task 2)
- `src/lib/activity.ts` (Task 2)
- `src/server/queries.ts` (chỉ comment, Task 2), `src/server/queries-request-memo.test.ts` (chỉ comment, Task 2)
- Test gọi page/route với `params`/`searchParams` (Task 2): `src/server/app-pages-auth-guard.test.ts`, `src/server/cron-route.test.ts`, `src/server/photo-route.test.ts`, `src/server/ho-so-du-an-page-guard.test.ts`, `src/server/ho-so-du-an-page-guard.qa.test.ts`, `src/server/nhap-lieu-page-guard.test.ts`, `src/server/operation-pages-render.test.ts`, `src/server/projects-detail-page-finance-guard.test.ts`, `src/server/projects-detail-finance-gate.test.ts`, `src/server/projects-detail-page-month-guard.test.ts`, `src/server/projects-detail-page-render.test.ts`, `src/server/queries-n1.test.ts`
- `src/i18n/routing.ts` (Task 3)
- `vitest.config.ts` (CHỈ nếu Task 3 bước 4 cần)
- `next-env.d.ts` (nếu Next tự sinh lại)

KHÔNG đụng: `next.config.mjs` (giữ nguyên `experimental.serverActions.bodySizeLimit: '11mb'` và plugin next-intl, cả hai vẫn hợp lệ ở Next 15), `middleware.ts`, `src/i18n/request.ts`, `src/lib/session.ts`, `src/lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `src/server/cache.ts`.
Nếu buộc phải sửa file nào ngoài danh sách: ghi lý do vào `.bangiao/thay-doi.md` trước khi sửa.

---

### Task 0: Mốc nền trên Next 14 (không commit)

**Mục đích:** có số liệu "trước" để so sánh, biết trước test nào vốn đã đỏ/chập chờn.

- [ ] **Bước 1: Nhánh và phiên.**
  `git status` phải sạch; `git branch --show-current` phải là `feature/nang-next15`.
  Nếu đang ở HEAD rời: `git switch feature/nang-next15` (nếu chưa có: `git switch -c feature/nang-next15 54ac9bf`).
  Ghi lại hash HEAD làm `BASE` vào `.bangiao/thay-doi.md` (dùng cho rollback).
  Xác nhận `phien-A.md` mục "Đang giữ" có `package.json`, `package-lock.json`, `next.config.mjs`, `middleware.ts`, `src/i18n/request.ts`, "mọi page trong `app/`" (đã ghi lúc 02:30); bổ sung `src/i18n/routing.ts`, `vitest.config.ts`, `src/components/dashboard/OverviewWidgets.tsx`.
- [ ] **Bước 2: Cổng hiện tại.**
  `npx tsc --noEmit` → ghi kết quả.
  `npm test` → ghi số file / số test / số đỏ (tham chiếu gần nhất: ~210 file, 2407 test xanh).
  `npm run test:e2e:a` (tắt dev server A trước; đặt `NODE_EXTRA_CA_CERTS`) → ghi số spec xanh/đỏ (tham chiếu: 74/74). Ghi tên spec đỏ nếu có (đã biết `02-overview` có lúc chập chờn, sổ nợ N-P7-3).
- [ ] **Bước 3: Chụp số liệu bảo mật.**
  `npm audit --omit=dev` → lưu danh sách advisory (tên gói, GHSA) vào `.bangiao/thay-doi.md` mục "Audit trước".
  `npm ls cookie` → ghi các bản `cookie` đang có.
- [ ] **Bước 4: Chốt số bản sẽ cài** (ghi bảng vào `.bangiao/thay-doi.md`, cột: gói | bản cũ | bản mới | lý do chọn):
  - `NEXT_VER` = bản 15.x ổn định cao nhất trong `npm view next@15 version` (bỏ canary/rc); bắt buộc ≥ 15.5.24, nếu không có thì DỪNG, báo lại.
  - `npm view next@<NEXT_VER> peerDependencies` → dải React được hỗ trợ.
  - `REACT_VER` = bản 19.x ổn định cao nhất trong `npm view react@19 version` nằm trong dải peer trên; `react-dom` dùng đúng `REACT_VER` (`npm view react-dom@<REACT_VER> version` phải tồn tại).
  - `TYPES_REACT_VER` = cao nhất trong `npm view @types/react@19 version`; `TYPES_REACT_DOM_VER` = cao nhất trong `npm view @types/react-dom@19 version`.
  - `NEXTAUTH_VER` = cao nhất trong `npm view next-auth@4 version`; kiểm `npm view next-auth@<NEXTAUTH_VER> peerDependencies` có `next` gồm `^15` và `react` gồm `^19`; `npm view next-auth@<NEXTAUTH_VER> dependencies` có `cookie` ≥ 0.7. Thiếu điều kiện nào thì DỪNG, báo lại.
  - `RECHARTS_VER` = cao nhất trong `npm view recharts@2 version`; `npm view recharts@<RECHARTS_VER> peerDependencies` phải gồm React 19; ghi lại dải `react-is` trong `dependencies`.
  - `INTL_VER` = cao nhất trong `npm view next-intl@4 version`; kiểm peer `next` gồm `^15`. Ghi thêm bản 3.x cao nhất (`npm view next-intl@3 version`) để đối chiếu.
- [ ] **Bước 5: Đo và chụp ảnh "trước"** theo "Quy trình đo và chụp" (cuối file), nhãn `truoc`.
  Kết quả vào `.bangiao/hieu-nang.md` mục "Trước (Next 14)", ảnh vào `.bangiao/anh-test/truoc-*.png`.

**Xong khi:** `.bangiao/thay-doi.md` có BASE, mốc test, mốc e2e, audit trước, bảng phiên bản; `.bangiao/hieu-nang.md` có bảng "Trước"; có 4 ảnh `truoc-*`.
Commit hồ sơ này cùng Task 1 (không commit riêng).

---

### Task 1: Dời `dynamic({ ssr: false })` ra client component (vẫn trên Next 14)

**Lý do:** Next 15 báo lỗi build "`ssr: false` is not allowed with `next/dynamic` in Server Components".
Hiện có 2 server component dùng: `src/components/dashboard/OverviewWidgets.tsx` (dòng 1, 27-31) và `app/[locale]/(app)/projects/[id]/page.tsx` (dòng 3, 30-48).
Mọi module đích đã có `'use client'`, nên props vốn đã qua ranh giới server→client; hành vi không đổi.

**Files:**
- Create: `src/components/dashboard/OverviewChartsLazy.tsx`
- Create: `src/components/project/ProjectDetailChartsLazy.tsx`
- Modify: `src/components/dashboard/OverviewWidgets.tsx:1,27-31`
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx:3,30-48`

**Interfaces:**
- Produces: `OverviewChartsLazy.tsx` export `CapacityBar`, `SCurve`, `SpiCpiLine`, `DrillDonut`, `GroupByCard`.
- Produces: `ProjectDetailChartsLazy.tsx` export `SCurve`, `SpiCpiLine`, `CountdownPanel`, `ResourceBreakdownChart`, `WeeklyTrackingCard`, `KeyMilestoneChart`, `StageExplorer`, `ManpowerMonthChart`, `WeeklyManpowerStackChart`, `EquipmentPlanGantt`.
- Mỗi export PHẢI là đúng giá trị trả về của `dynamic(...)` (không bọc thêm component), để các test đang mock `next/dynamic` (`src/server/overview-finance-gate.test.ts`, `src/server/top-priority-mask.qa.test.ts`) vẫn bắt đúng props.

- [ ] **Bước 1: Tạo `src/components/dashboard/OverviewChartsLazy.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { CardSkeleton } from '@/components/ui/Skeleton';

/**
 * Next 15 cấm `dynamic({ ssr: false })` trong Server Component: các chart Recharts của trang
 * Tổng quan nạp lười ở đây (client component), OverviewWidgets.tsx (server) chỉ import lại.
 */
export const CapacityBar = dynamic(() => import('./charts').then((m) => m.CapacityBar), { ssr: false, loading: () => <CardSkeleton h={220} /> });
export const SCurve = dynamic(() => import('./charts').then((m) => m.SCurve), { ssr: false, loading: () => <CardSkeleton h={240} /> });
export const SpiCpiLine = dynamic(() => import('./charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <CardSkeleton h={200} /> });
export const DrillDonut = dynamic(() => import('./DrillCharts').then((m) => m.DrillDonut), { ssr: false, loading: () => <CardSkeleton h={200} /> });
export const GroupByCard = dynamic(() => import('./DrillCharts').then((m) => m.GroupByCard), { ssr: false, loading: () => <CardSkeleton h={260} /> });
```

- [ ] **Bước 2: Sửa `OverviewWidgets.tsx`**: xoá dòng `import dynamic from 'next/dynamic';` và 5 dòng `const ... = dynamic(...)` (27-31); thêm `import { CapacityBar, DrillDonut, GroupByCard, SCurve, SpiCpiLine } from './OverviewChartsLazy';`.
  Nếu sau đó `CardSkeleton` không còn chỗ dùng trong file thì xoá import của nó; còn dùng thì giữ.
- [ ] **Bước 3: Tạo `src/components/project/ProjectDetailChartsLazy.tsx`**: `'use client'`, `import dynamic from 'next/dynamic'`, chép NGUYÊN 10 định nghĩa ở `page.tsx` dòng 30-48 (giữ nguyên đường dẫn import `@/components/...`, `.then((m) => m.X)`, `loading` y hệt, kể cả `style={{ width: 240, height: 88 }}` của `CountdownPanel`), đổi `const` thành `export const`. Comment đầu file 1-2 dòng giống Bước 1.
- [ ] **Bước 4: Sửa `page.tsx`**: xoá `import dynamic from 'next/dynamic';` và dòng 30-48; thêm 1 import gộp 10 tên từ `@/components/project/ProjectDetailChartsLazy`. Không đổi JSX nào khác.
- [ ] **Bước 5: Kiểm**
  `npx tsc --noEmit` sạch.
  `npm test` xanh, số test = mốc Task 0.
  `git grep -n "ssr: false" -- app src` chỉ còn trong 2 file `*Lazy.tsx` (và comment `ValueChainModeChip.tsx`).
- [ ] **Bước 6: Commit**

```powershell
git add .bangiao/thay-doi.md .bangiao/hieu-nang.md .bangiao/anh-test src/components/dashboard/OverviewChartsLazy.tsx src/components/project/ProjectDetailChartsLazy.tsx src/components/dashboard/OverviewWidgets.tsx "app/[locale]/(app)/projects/[id]/page.tsx"
git commit -m "refactor(next15): doi dynamic ssr:false ra client component, ghi moc nen truoc khi nang" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Xong khi:** tsc sạch, `npm test` xanh bằng mốc, commit xong, `phien-A.md` cập nhật.

---

### Task 2: Nâng Next 15 + React 19 + next-auth + recharts, chuyển request API sang async

Các gói này phải nâng CÙNG MỘT LẦN vì ràng buộc peer (next-auth 4.24.7 không nhận Next 15, recharts 2.12.7 không nhận React 19).

**Files:** xem "Danh sách file dự kiến đụng" (mọi mục ghi Task 2).

- [ ] **Bước 1: Codemod trước khi cài gói** (cây làm việc sạch sau commit Task 1):
  `npx @next/codemod@latest next-async-request-api .`
  Sau đó:
  - `git diff --stat`: chỉ được đụng các file trong danh sách Task 2 (12 file app/api + `src/lib/activity.ts`). File khác bị đụng: xem diff, không liên quan thì `git checkout -- <file>`.
  - `git grep -n -e "@next-codemod" -e "UnsafeUnwrapped"` phải RỖNG. Còn dấu nào thì sửa tay theo mẫu Bước 3.
  Nếu codemod lỗi/không chạy được: sửa tay toàn bộ theo mẫu Bước 3.
- [ ] **Bước 2: Cài gói** (đặt `NODE_EXTRA_CA_CERTS`), dùng số bản đã chốt ở Task 0 Bước 4:

```powershell
npm install --save-exact next@<NEXT_VER> react@<REACT_VER> react-dom@<REACT_VER> next-auth@<NEXTAUTH_VER> recharts@<RECHARTS_VER> react-is@<REACT_VER>
npm install --save-exact --save-dev @types/react@<TYPES_REACT_VER> @types/react-dom@<TYPES_REACT_DOM_VER>
```

  Sau cài:
  - `npm ls react-is`: mọi bản dưới `recharts` phải là 19.x. Nếu còn 18.x: thêm vào khối `overrides` của `package.json` mục `"recharts": { "react-is": "$react-is" }` (giữ nguyên mục `next-auth`), chạy lại `npm install`, kiểm lại.
  - `npm ls react react-dom`: chỉ một bản `REACT_VER`, không có bản 18 nào.
  - Nếu `npm install` ERESOLVE vì `next-intl@3.26.3` không nhận React 19/Next 15: thêm `next-intl@<INTL_VER>` vào lệnh cài ở bước này và làm luôn Task 3 Bước 2-4 trong task này (ghi rõ vào `thay-doi.md`); KHÔNG dùng `--legacy-peer-deps`/`--force`.
  - Nếu Prisma client rỗng (tsc báo thiếu kiểu `@prisma/client`): `node node_modules/prisma/build/index.js generate`.
- [ ] **Bước 3: Rà/sửa tay theo mẫu** (kết quả codemod phải tương đương):

  Page/layout có `params`:
```tsx
export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // phần còn lại giữ nguyên
}
```
  Áp cho: `app/[locale]/page.tsx`, `app/[locale]/login/page.tsx`, `app/[locale]/(app)/projects/page.tsx` (đổi `params.locale` thành `locale`), `app/[locale]/(app)/layout.tsx` (`children` giữ nguyên, `params: Promise<{ locale: string }>`), `app/[locale]/layout.tsx` (cả `generateMetadata` lẫn `LocaleLayout`).

  Page có `searchParams`:
```tsx
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // thay mọi chỗ dùng `searchParams` bên dưới bằng `sp`
}
```
  Áp cho: `overview/page.tsx`, `nhap-lieu/page.tsx`, `ho-so-du-an/page.tsx`.
  `audit/page.tsx` (hiện `searchParams = {}` và kiểu tuỳ chọn): kiểu `searchParams?: Promise<Record<string, string | string[] | undefined>>`, bỏ giá trị mặc định ở tham số, thêm `const sp = (await searchParams) ?? {};`.
  `projects/[id]/page.tsx`: kiểu `params: Promise<{ id: string; locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>`, đầu hàm `const [{ id: rawId }, sp] = await Promise.all([params, searchParams]);`, thay `searchParams.month` bằng `sp.month`, `params.id` bằng `rawId` (giữ nguyên regex `/^[1-9]\d*$/` và `notFound()`).
  Quy tắc thứ tự: `await params`/`await searchParams` không phải lời gọi hàm nên không vi phạm test `src/server/app-pages-require-user.test.ts` (chỉ bắt `await <tên>(`); KHÔNG chèn lời gọi `await xxx(` nào trước `requireUser` (hoặc trước cặp `getLocale` → `requireUser`).

  Route handler:
```ts
export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  // ... giữ nguyên kiểm secret + Authorization TRƯỚC
  const { job } = await params;
  if (!(JOB_NAMES as string[]).includes(job)) { /* giữ nguyên */ }
  const result = await runJob(job as JobName, 'cron');
}
```
  `app/api/photos/[...path]/route.ts`: `{ params }: { params: Promise<{ path: string[] }> }`, `const { path } = await params;`, `readPhotoFile((path ?? []).join('/'))`; giữ nguyên thứ tự kiểm phiên hiện có.

  `src/lib/activity.ts`: trong `try`, `const h = await headers();` (giữ `try/catch`, ngoài request scope vẫn rơi vào `catch`).

  Không đổi logic nào khác trong các file trên.
- [ ] **Bước 4: Sửa test gọi page/route** (12 file liệt kê ở danh sách): bọc đối số bằng `Promise.resolve(...)`, không đổi kỳ vọng.
  Ví dụ: `ProjectDetailPage({ params: Promise.resolve({ id: '1', locale: 'vi' }), searchParams: Promise.resolve({}) })`, `OverviewPage({ searchParams: Promise.resolve({}) })`, `HoSoDuAnPage({ searchParams: Promise.resolve(searchParams) })`, `AuditPage({ searchParams: Promise.resolve({ range: 'all' }) })`, `const ctx = (job: string) => ({ params: Promise.resolve({ job }) });`.
  `AuditPage({})` giữ nguyên.
- [ ] **Bước 5: Sửa comment React.cache** (giữ khoá `src/server/queries.ts` theo Ràng buộc chung trước khi sửa):
  `src/server/queries.ts` dòng 149-151: thay ý "'react' không có export `cache` thật" bằng: từ React 19, `cache` có ở mọi bản React nhưng ngoài Server Component (tsx, Vitest) nó chỉ gọi thẳng hàm, không memo; `typeof` kiểm vẫn giữ để an toàn.
  `src/server/queries-request-memo.test.ts` dòng 4-5: sửa tương ứng ("Vitest không có React.cache memo thật").
  KHÔNG đổi code của `requestMemo`.
- [ ] **Bước 6: Kiểm next-auth với Next 15** (ghi kết quả vào `thay-doi.md`):
  `Select-String -Path node_modules/next-auth/next/index.js -Pattern "await"` quanh chỗ gọi `headers()`/`cookies()` và `params`: ghi lại bản này có `await` hay không.
  Nếu không có `await`: Next 15 vẫn chạy (chỉ cảnh báo dev); ghi vào `thay-doi.md` mục "Để sau" (bắt buộc xử lý trước khi lên Next 16), không vá `node_modules`.
- [ ] **Bước 7: Kiểm**
  - `npx tsc --noEmit` sạch.
  - `npm test` xanh, số test ≥ mốc Task 0.
  - `npm run build` với `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES='D:\_project\DDC_dieu-phoi\tools\font-mock.js'` và biến DB tạm: build thành công, không có lỗi `ssr: false`, không có cảnh báo "should be awaited"/"sync dynamic APIs".
  - Nếu Vitest lỗi kiểu render do React 19 (chuỗi HTML khác): so chuỗi cũ/mới, chỉ sửa kỳ vọng khi khác biệt là do React 19 (ghi từng test + lý do vào `thay-doi.md`); khác biệt về dữ liệu/logic thì sửa code, không sửa test.
- [ ] **Bước 8: Commit**

```powershell
git add -A
git status   # rà: không có file ngoài danh sách, không có .next/, không có e2e/.auth
git commit -m "feat(next15): nang next <NEXT_VER>, react <REACT_VER>, next-auth <NEXTAUTH_VER>, recharts <RECHARTS_VER>; params/searchParams/headers async" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Xong khi:** tsc sạch, `npm test` xanh, build xanh, commit xong, `phien-A.md` cập nhật (nhả khoá `queries.ts`).

**Trường hợp biên bắt buộc:**
- `/vi/projects/1.0`, `/vi/projects/abc` vẫn `notFound()` (test `app-pages-auth-guard.test.ts` dòng 147-152 phủ).
- `?month=abc` trên Tổng quan và Chi tiết vẫn rơi về tháng hiện tại.
- `?page=rac`, `?page=2&page=3` trên Nhật ký vẫn xử lý như cũ (`operation-pages-render.test.ts` dòng 252-285 phủ).
- Cron: sai/thiếu `Authorization` vẫn 401 TRƯỚC khi đọc `params`; job lạ 404.
- `logActivity` gọi ngoài request (script, test) không ném lỗi.

---

### Task 3: Nâng next-intl lên 4.x

(Bỏ qua bước nào đã làm trong Task 2 do ERESOLVE, ghi rõ.)

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/i18n/routing.ts`
- Modify (chỉ nếu Bước 4 cần): `vitest.config.ts`

- [ ] **Bước 1:** `npm install --save-exact next-intl@<INTL_VER>` (đặt `NODE_EXTRA_CA_CERTS`).
- [ ] **Bước 2: `src/i18n/routing.ts`** (giữ cookie locale 1 năm như v3):

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  // next-intl 4 mặc định cookie locale là cookie phiên; giữ 1 năm như bản 3 để người dùng không mất ngôn ngữ đã chọn.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Bước 3:** `npx tsc --noEmit`.
  Lỗi "null/undefined/boolean không được làm tham số ICU" ở chỗ gọi `t(key, {...})`: sửa tại chỗ gọi sao cho chuỗi hiển thị KHÔNG đổi so với hiện tại (ví dụ giá trị có thể `undefined` mà bản 3 in ra rỗng thì truyền `?? ''`; boolean dùng trong `select` thì `String(x)`). Nếu chỗ gọi nằm trong file C đang giữ: DỪNG theo Ràng buộc chung.
  Không sửa `src/i18n/request.ts` (đã đúng chuẩn v4: dùng `requestLocale`, trả `locale`), không sửa `middleware.ts`, không bỏ `messages={messages}` ở `app/[locale]/layout.tsx`.
- [ ] **Bước 4:** `npm test`.
  Chỉ khi có test lỗi kiểu không nạp được module ESM của `next-intl` (ví dụ `Cannot find module 'next/navigation'` từ trong `node_modules/next-intl`): thêm vào `vitest.config.ts` trong `test`: `server: { deps: { inline: ['next-intl'] } },` rồi chạy lại. Không lỗi thì không sửa file này.
- [ ] **Bước 5: Kiểm**
  - `npx tsc --noEmit` sạch, `npm test` xanh (≥ mốc).
  - `npm run build` (font mock + DB tạm) xanh.
  - `npm audit --omit=dev`: không còn advisory của `next-intl`.
- [ ] **Bước 6: Commit** `feat(next15): nang next-intl <INTL_VER>, giu cookie locale 1 nam` + dòng Co-Authored-By. Cập nhật `phien-A.md`.

**Trường hợp biên bắt buộc (kiểm ở Task 5 bằng trình duyệt/e2e):**
- `/` → chuyển về `/vi/...` khi không có cookie; có cookie `NEXT_LOCALE=en` thì về `/en/...`.
- Đổi ngôn ngữ trong menu Cài đặt → URL đổi đúng, cookie `NEXT_LOCALE` có hạn ~1 năm (xem trong DevTools/Playwright `context.cookies()`).
- Chưa đăng nhập vào `/vi/overview` vẫn về `/vi/login` (e2e `09-chan-chua-dang-nhap`).
- Không có open redirect: `GET /vi//evil.com` và `GET //evil.com/vi` (qua `fetch` với `redirect: 'manual'` tới cổng 3010) không trả `Location` trỏ ra host khác localhost; ghi kết quả vào `thay-doi.md`.

---

### Task 4: Cổng đầy đủ + kiểm trình duyệt

- [ ] **Bước 1:** `npx tsc --noEmit`, `npm test` (ghi số file/số test, so mốc).
- [ ] **Bước 2:** `npm run build` với font mock + DB tạm.
- [ ] **Bước 3:** Tắt mọi server ở cổng 3010 và dev server A; `$env:NODE_EXTRA_CA_CERTS='D:\_project\DDC_dieu-phoi\tools\win-root-ca.pem'`; `npm run test:e2e:a`. Phải xanh hết; spec nào đỏ mà ở Task 0 cũng đỏ/chập chờn thì chạy lại riêng spec đó 3 lần (`npm run test:e2e:a -- e2e/<ten>.spec.ts`) và ghi kết quả; spec mới đỏ thì sửa gốc.
- [ ] **Bước 4:** `npm run check:read` với biến DB tạm (DB đã seed bởi e2e global-setup) → OK.
- [ ] **Bước 5:** `npm audit --omit=dev` → không còn advisory của `next`, `next-intl`, `cookie`; `npm ls cookie` → mọi bản ≥ 0.7. Advisory còn lại của gói khác (ví dụ `xlsx`) liệt kê vào `thay-doi.md` mục "Còn lại, ngoài phạm vi".
- [ ] **Bước 6:** Đo và chụp "sau" theo "Quy trình đo và chụp", nhãn `sau`. So với "trước":
  - Ảnh `sau-*` phải giống `truoc-*` (bố cục, chart có đủ trục/tooltip/legend, font). Lệch chỗ nào phải sửa, hoặc giải thích được là do dữ liệu/ngày chạy khác nhau.
  - Console trình duyệt không có lỗi, không có cảnh báo `defaultProps`, hydration, "should be awaited".
  - Hover 1 chart Recharts ở Tổng quan và ở Chi tiết: tooltip hiện (chụp thêm `sau-tooltip.png`).
  - Hiệu năng: mọi request < 1500 ms; mỗi URL "lần đầu" không chậm hơn "trước" quá 20% (hoặc quá 150 ms, lấy mức lớn hơn); cột "3 lần sau" của `/vi/overview?...` nhỏ hơn rõ cột "lần đầu" (chứng tỏ `unstable_cache` vẫn ăn). Không đạt thì điều tra trước khi commit, ghi phân tích vào `hieu-nang.md`.
- [ ] **Bước 7:** Kiểm các trường hợp biên của Task 2 và Task 3 chưa có test tự động phủ (cookie locale, open redirect) và ghi kết quả.
- [ ] **Bước 8: Commit** hồ sơ `.bangiao/thay-doi.md`, `.bangiao/hieu-nang.md`, `.bangiao/anh-test/sau-*.png` (và sửa lỗi nếu có): `docs(next15): cong day du, do hieu nang va anh truoc/sau` + Co-Authored-By. Cập nhật `phien-A.md`.

**Xong khi:** tất cả cổng xanh, audit sạch 3 gói, ảnh và số liệu đạt tiêu chí.

---

### Task 5: Bàn giao cho dây chuyền

- [ ] `.bangiao/thay-doi.md` có: bảng phiên bản, danh sách file đã sửa, test đã sửa kỳ vọng kèm lý do, kết quả next-auth Bước 6, advisory còn lại, mục "Để sau".
- [ ] `phien-A.md`: phase/task, commit cuối, "chờ tester → security → reviewer"; giữ ghi chú "đang sửa mọi page" tới khi merge.
- [ ] Nhắc trong `thay-doi.md` cho bước merge sau này: B và C phải `git merge main` + `npm install` (có `NODE_EXTRA_CA_CERTS`) + xoá `.next` trước khi chạy dev.

---

## Quy trình đo và chụp (dùng ở Task 0 với nhãn `truoc`, Task 4 với nhãn `sau`)

Chạy SAU `npm run test:e2e:a` (để DB tạm đã seed và có `e2e/.auth/admin.json`).
Hai script dưới đây để ở `$env:TEMP`, KHÔNG commit.

1. `Remove-Item -Recurse -Force .next` (xoá cả cache `unstable_cache` cũ).
2. Đặt biến DB tạm. Build lấy font thật: `$env:NODE_EXTRA_CA_CERTS=...win-root-ca.pem`, KHÔNG đặt `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, `npx next build`. Nếu build lỗi tải font thì dùng font mock và ghi rõ vào `hieu-nang.md` (cả trước và sau phải cùng một cách build).
3. `npx next start -p 3010` (cửa sổ riêng, cùng biến DB tạm).
4. `node $env:TEMP\do-trang-a.mjs` (chạy từ thư mục repo), chép bảng vào `.bangiao/hieu-nang.md`.
5. `node $env:TEMP\chup-a.mjs <nhan>` (chạy từ thư mục repo), ảnh vào `.bangiao/anh-test/`, chép danh sách console vào `hieu-nang.md`.
6. Tắt `next start`, `Remove-Item -Recurse -Force .next`.

`$env:TEMP\do-trang-a.mjs`:

```js
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3010';
const state = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf8'));
const cookie = state.cookies.filter((c) => c.domain === 'localhost').map((c) => `${c.name}=${c.value}`).join('; ');
const URLS = ['/vi/overview?month=all', '/vi/overview?month=2026-09', '/vi/overview?month=2026-08', '/vi/overview?month=2026-07', '/vi/projects/1', '/vi/projects/2', '/vi/projects/3'];

async function hit(path) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, { headers: { Cookie: cookie }, redirect: 'manual' });
  await res.text();
  const ms = performance.now() - t0;
  if (res.status !== 200) throw new Error(`${path} -> HTTP ${res.status} (cookie het han? chay lai npm run test:e2e:a)`);
  return ms;
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

console.log(`lam nong /vi/projects/4 (khong tinh): ${(await hit('/vi/projects/4')).toFixed(0)} ms`);
console.log('| Trang | lan dau (ms) | median 3 lan sau (ms) |');
console.log('|---|---|---|');
for (const u of URLS) {
  const first = await hit(u);
  const rest = [await hit(u), await hit(u), await hit(u)];
  console.log(`| ${u} | ${first.toFixed(0)} | ${median(rest).toFixed(0)} |`);
}
```

`$env:TEMP\chup-a.mjs`:

```js
import { createRequire } from 'node:module';

const require = createRequire('D:/_project/DDC_Control_Tower/package.json');
const { chromium } = require('@playwright/test');
const label = process.argv[2];
if (!label) throw new Error('can nhan: truoc | sau');

const PAGES = [['overview', '/vi/overview?month=2026-09'], ['project1', '/vi/projects/1']];
const SIZES = [[1440, 900], [390, 844]];
const browser = await chromium.launch();
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'light', locale: 'vi-VN', storageState: 'e2e/.auth/admin.json' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  for (const [name, path] of PAGES) {
    await page.goto(`http://localhost:3010${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // cho animation Recharts xong
    await page.screenshot({ path: `.bangiao/anh-test/${label}-${name}-${w}.png`, fullPage: true });
  }
  console.log(`--- console ${w}px ---\n${logs.join('\n') || '(khong co)'}`);
  await ctx.close();
}
await browser.close();
```

---

## Rủi ro và cách lùi

| Rủi ro | Dấu hiệu | Xử lý |
|---|---|---|
| Recharts 2.x mới nhất vẫn hỏng với React 19 (mất trục/tooltip/legend) | Ảnh `sau` thiếu phần chart, console báo `defaultProps`/`react-is` | Kiểm `npm ls react-is`, thêm override (Task 2 Bước 2). Vẫn hỏng thì DỪNG, báo điều phối viên (lên recharts 3 cần kế hoạch riêng), không tự nâng 3.x. |
| next-auth 4 chưa `await` `headers()`/`params` | Cảnh báo dev, hoặc đăng nhập lỗi | Cảnh báo: ghi "Để sau". Đăng nhập lỗi (e2e `01-login` đỏ): DỪNG, báo; không vá `node_modules`. |
| Chuỗi HTML của `renderToStaticMarkup` đổi ở React 19 | Test so chuỗi đỏ | Theo Task 2 Bước 7. |
| next-intl 4 ESM trong Vitest | `Cannot find module` từ `node_modules/next-intl` | Task 3 Bước 4. |
| Build không tải được font | `next build` lỗi `SELF_SIGNED_CERT` | Font mock (cổng build) hoặc `NODE_EXTRA_CA_CERTS`. |
| Xung đột merge với nhánh C | Xung đột ở page | Q2. |
| e2e `02-overview` chập chờn (N-P7-3, nghi `unstable_cache` trên đĩa) | Đỏ không ổn định | So với Task 0; chạy lại 3 lần; không che bằng `retries`. |

**Cách lùi:**
- Lùi 1 task trên nhánh local: `git revert <hash>` (không `reset --hard` khi đã có commit sau nó).
- Lùi toàn bộ gói về bản cũ:

```powershell
git checkout <BASE> -- package.json package-lock.json
Remove-Item -Recurse -Force node_modules, .next
$env:NODE_EXTRA_CA_CERTS='D:\_project\DDC_dieu-phoi\tools\win-root-ca.pem'
npm ci
node node_modules/prisma/build/index.js generate
npx tsc --noEmit; npm test
```

- Nhánh chưa merge `main` nên `main` và các bên B, C không bị ảnh hưởng khi lùi.
