# Nâng Next >= 15.5.24 - nhật ký thay đổi (coder)

Nhánh `feature/nang-next15`, từ `main` @ `54ac9bf` (**BASE**, dùng để rollback nếu cần).

## Task 0: mốc nền trên Next 14

- Nhánh đã đúng `feature/nang-next15`, cây làm việc sạch (chỉ có `.bangiao/ke-hoach.md` chưa track).
- `npx tsc --noEmit`: **sạch**.
- `npm test`: **210 file / 2407 test xanh** (đúng mốc tham chiếu).
- `npm run test:e2e:a` (cổng 3010, DB tạm `ddc_control_tower_e2e_a`): **74/74 xanh**, không spec nào đỏ hay chập chờn ở lần chạy này (kể cả `02-overview`).

### Audit trước (Task 0 Bước 3)

`npm audit --omit=dev` (11 vulnerabilities: 1 low, 3 moderate, 5 high, 2 critical):

| Gói | Mức | Advisory | Ghi chú |
|---|---|---|---|
| `next` (14.2.35) | critical | GHSA-p293-qw3h-jr36 (RCE trên Windows), GHSA-2xp9-vwfh-vxw4 (RCE AVIF Image Optimization), + ~20 advisory khác của nhánh 9.3.4-16.3.0 | Mục tiêu chính của phase này |
| `next-intl` (3.26.3) | moderate | GHSA-8f24-v5vv-gm5j (open redirect), GHSA-4c35-wcg5-mm9h (prototype pollution `experimental.messages.precompile`, repo không dùng flag này) | Mục tiêu Task 3 |
| `cookie` (0.5.0, qua `next-auth` 4.24.7) | low | GHSA-pxg6-pf52-xh8x | Gỡ qua nâng `next-auth` (Task 2) |
| `postcss` (<=8.5.22, kéo theo bởi `next` cũ) | high | GHSA-qx2v-qp2m-jg93 + 3 advisory path traversal source map | Tự gỡ khi `next` lên bản mới (bundled `postcss` mới hơn) |
| `deepmerge-ts` (qua `@prisma/config`/`prisma`) | high | GHSA-ggr8-5vv4-36mx | NGOÀI PHẠM VI (không đụng Prisma trong phase này) |
| `uuid` (<11.1.1, qua `exceljs`) | moderate | GHSA-w5hq-g745-h8pq | NGOÀI PHẠM VI |
| `xlsx` (*) | high | GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 | NGOÀI PHẠM VI, không có bản vá (No fix available) |

`npm ls cookie` trước khi nâng: `next-auth@4.24.7 overridden -> cookie@0.5.0`.

### Bảng phiên bản đã chốt (Task 0 Bước 4)

| Gói | Bản cũ | Bản mới | Lý do chọn |
|---|---|---|---|
| `next` | 14.2.35 | **15.5.26** | Bản 15.x ổn định cao nhất hiện có trên npm (>= 15.5.24 theo yêu cầu); gỡ RCE Windows + AVIF |
| `react` | 18.3.1 | **19.3.0** | Bản 19.x ổn định cao nhất, nằm trong dải peer `^19.0.0` của `next@15.5.26` |
| `react-dom` | 18.3.1 | **19.3.0** | Khớp đúng bản `react` (bản 19.3.0 tồn tại trên npm) |
| `@types/react` | 18.3.5 | **19.3.0** | Cao nhất khớp React 19 |
| `@types/react-dom` | 18.3.0 | **19.3.0** | Cao nhất khớp React 19 |
| `next-auth` | 4.24.7 | **4.24.15** | Cao nhất nhánh 4.x; peer có `next: ^12...^15...^16`, `react: ^17...^18...^19`; `dependencies.cookie: ^0.7.0` (gỡ advisory `cookie`) |
| `recharts` | 2.12.7 | **2.15.4** | Cao nhất nhánh 2.x (giữ nguyên nhánh theo quyết định kỹ thuật #2 của kế hoạch); peer `react: ^16...^18 || ^19.0.0` |
| `react-is` | (kéo theo `recharts`, không ghim) | **19.3.0** | Ghim cùng bản React: `recharts@2.15.4` khai `react-is: ^18.3.1` trong `dependencies`, React 19 đổi `$$typeof` của element nên `react-is` 18 nhận sai (Tooltip/Legend biến mất) |
| `next-intl` | 3.26.3 | **4.14.7** | Cao nhất nhánh 4.x (nhánh đang bảo trì); peer `next: ^12...^15...^16` |

## Task 1: dời `dynamic({ ssr: false })` ra client component

(cập nhật khi hoàn thành)

## Task 2: nâng Next 15 + React 19 + next-auth + recharts, chuyển request API sang async

- **Bước 1 (codemod):** `npx @next/codemod@latest next-async-request-api .` chạy được (phải thêm `--force` vì
  `.bangiao/ke-hoach.md` chưa track), chỉ đụng đúng 13 file dự kiến (12 file `app/**`/`app/api/**` + `src/lib/activity.ts`).
  Codemod tự sinh format không khớp phong cách repo (destructure nhiều dòng, thụt lề lệch ở `projects/page.tsx`) nên đã
  `git checkout --` bỏ kết quả codemod và **tự sửa tay lại đúng mẫu ở Bước 3 của kế hoạch** cho cả 13 file (không còn
  dấu vết `@next-codemod`/`UnsafeUnwrapped`).
- **`app/[locale]/(app)/projects/[id]/page.tsx`:** theo mẫu kế hoạch ban đầu dùng
  `const [{ id: rawId }, sp] = await Promise.all([params, searchParams]);` nhưng test tĩnh
  `src/server/app-pages-require-user.test.ts` (`awaitedCallees`) coi `Promise.all(...)` là MỘT lời gọi hàm đứng trước
  `requireUser` nên bị đỏ (test này không nằm trong danh sách file dự kiến đụng của kế hoạch, không phải file khoá của
  C). Đổi sang 2 lệnh `await params;` / `await searchParams;` riêng (không có dấu ngoặc ngay sau tên biến nên không bị
  tính là lời gọi), giữ đúng thứ tự `getLocale` → `requireUser`; đã ghi lý do bằng comment ngay tại chỗ.
- **Bước 2 (cài gói):** `next@15.5.26`, `react@19.3.0`, `react-dom@19.3.0`, `next-auth@4.24.15`, `recharts@2.15.4`,
  `react-is@19.3.0`, `@types/react@19.3.0`, `@types/react-dom@19.3.0` (đều `--save-exact`).
  `npm ls react-is`: lần cài đầu `recharts` vẫn kéo `react-is@18.3.1` riêng (peer cảnh báo, không tự override khi chỉ
  cài gói mới) → thêm `"recharts": { "react-is": "$react-is" }` vào `overrides` của `package.json`, chạy lại
  `npm install` (không tham số) để npm reconcile lại `node_modules` → `react-is` dưới `recharts` đã dedupe về 19.3.0.
  Còn 1 bản `react-is@16.13.1` lồng dưới `prop-types` (dependency của `react-smooth`) - không đụng tới vì đây chỉ
  dùng cho `PropTypes.isValidElementType` khi dev-check, không liên quan `$$typeof`/Tooltip/Legend của Recharts.
  `npm ls react react-dom`: chỉ 1 bản `19.3.0` duy nhất, không còn bản 18.x nào.
- **Sửa ngoài danh sách dự kiến - `src/components/ui/motion.ts`:** React 19 đổi kiểu để `useRef<T>(null)` trả về
  `RefObject<T | null>` thay vì `RefObject<T>`; 3 hook `useRise`, `usePressable`, `useHoverLift` khai tham số
  `ref: RefObject<HTMLElement>` (không nhận `null`) nên `tsc` đỏ ở 3 nơi gọi (`Rise.tsx`, `Card.tsx`, `LoginForm.tsx`).
  Cả 3 hook đã tự kiểm `if (!ref.current) return` ngay dòng đầu `useEffect`, nên chỉ nới kiểu tham số thành
  `RefObject<HTMLElement | null>`, không đổi logic. Đây là hệ quả bắt buộc của việc nâng React 19 (không phải lựa
  chọn), ghi rõ ở đây theo yêu cầu "sửa file ngoài danh sách phải ghi lý do".
- **Bước 3 (rà tay params/searchParams):** áp đúng mẫu kế hoạch cho 9 page/layout, 2 route handler, `activity.ts`
  (`await headers()`). Trang `overview`/`nhap-lieu`/`ho-so-du-an` đổi tên biến cục bộ `searchParams` (đối tượng đã
  `await`) thành `sp` như mẫu; `audit/page.tsx` dùng `const sp = (await searchParams) ?? {};` để giữ hành vi
  `AuditPage({})` không có `searchParams` vẫn chạy được (test `AuditPage({})` giữ nguyên, không sửa).
- **Bước 4 (sửa 12 file test gọi page/route):** bọc `Promise.resolve(...)` quanh `params`/`searchParams` truyền vào,
  không đổi kỳ vọng của test nào.
- **Bước 5 (comment `React.cache`, khoá `src/server/queries.ts`):** đã xác nhận B/C không giữ file này trước khi sửa
  (xem `phien-B.md`/`phien-C.md` lúc 08:xx); chỉ sửa comment giải thích `requestMemo` (từ React 19, `cache` có export
  thật ở mọi bản React nhưng ngoài Server Component chỉ gọi thẳng hàm gốc, không memo), không đổi code. Đồng bộ comment
  ở `queries-request-memo.test.ts`. Đã nhả khoá ngay sau khi commit Task 2.
- **Bước 6 (next-auth với Next 15):** `grep -n "await" node_modules/next-auth/next/index.js` quanh chỗ gọi
  `context.params`, `cookies()`, `headers()`: **next-auth@4.24.15 đã `await` đầy đủ cả 3** (`await context.params`,
  `await cookies()`, `await headers()`). Không có gì phải ghi vào mục "Để sau" cho advisory này.
- **Bước 7 (cổng):** `npx tsc --noEmit` sạch; `npm test` **210 file / 2409 test xanh** (bằng mốc Task 0+1, không tụt).
  `npm run build` (font mock + DB tạm `ddc_control_tower_e2e_a`) qua, không cảnh báo `ssr: false`/"should be
  awaited"/"sync dynamic APIs". Không có test nào lỗi do khác biệt chuỗi HTML React 19 (`renderToStaticMarkup`).
  Lưu ý môi trường: lần build đầu chạy `run_in_background` bị hệ điều hành/harness dừng vì hệ thống thiếu RAM (máy có
  23 tiến trình `node.exe` khác đang chạy, gồm dev server 3003 của C ~2.2GB) - build lại thành công khi chạy trực
  tiếp (foreground, không qua nền).

**Bảng phiên bản đã cài (khớp Task 0 Bước 4):**

| Gói | Bản cũ | Bản mới |
|---|---|---|
| next | 14.2.35 | 15.5.26 |
| react | 18.3.1 | 19.3.0 |
| react-dom | 18.3.1 | 19.3.0 |
| @types/react | 18.3.5 | 19.3.0 |
| @types/react-dom | 18.3.0 | 19.3.0 |
| next-auth | 4.24.7 | 4.24.15 |
| recharts | 2.12.7 | 2.15.4 |
| react-is | (ẩn, 18.x) | 19.3.0 (ghim + override cho recharts) |

## Task 3: nâng next-intl 4.x

- `npm install --save-exact next-intl@4.14.7`.
- `src/i18n/routing.ts`: thêm `localeCookie: { maxAge: 60 * 60 * 24 * 365 }` để giữ cookie locale 1 năm như
  bản 3 (v4 mặc định cookie phiên).
- `npx tsc --noEmit`: 1 lỗi ICU tại `src/components/form/ProjectForm.tsx:244`
  (`t('projectForm.err.generic', { msg: res.error })` - `res.error` kiểu `string | undefined`, next-intl 4 cấm
  `undefined` làm tham số ICU) → sửa thành `msg: res.error ?? ''` (chuỗi hiển thị không đổi so với trước, chỉ
  khác khi `res.error` chính nó là `undefined`, một nhánh lỗi hiếm khi không khớp `t.has(key)`).
- `npm test`: 1 file lỗi `src/server/pages-role-guard.test.ts` kiểu `Cannot find module 'next/navigation'`
  từ `node_modules/next-intl/dist/esm/.../createNavigation.js` (next-intl 4 chỉ phát hành ESM) → thêm
  `server: { deps: { inline: ['next-intl'] } }` vào `vitest.config.ts` (đúng theo kế hoạch, không cần vì
  file nào khác). Sau đó lộ tiếp 1 lỗi khác cùng file: mock `next/navigation` của
  `pages-role-guard.test.ts` chỉ có `redirect`, thiếu `permanentRedirect` mà `createNavigation` (next-intl 4,
  dùng ở `@/i18n/navigation` cho `<Link>`) đọc ngay lúc nạp module → thêm `permanentRedirect: vi.fn()` vào
  mock của đúng 1 file này (23 file khác cũng mock `next/navigation` nhưng không đụng `@/i18n/navigation`
  thật nên không cần sửa).
- `npm run build` (font mock + DB tạm): qua, chỉ có cảnh báo webpack cache vô hại của
  `next-intl/dist/esm/production/extractor/format/index.js` ("Parsing ... for build dependencies failed"),
  không phải lỗi/cảnh báo của app.
- `npm audit --omit=dev`: hết advisory của `next`, `next-intl`, `cookie`. `npm ls cookie` → `cookie@0.7.2`
  (>= 0.7). Còn lại `deepmerge-ts`/`prisma`, `postcss` (bundle trong `next`, chỉ hết khi lên next 16),
  `uuid`/`exceljs`, `xlsx` - ngoài phạm vi (xem mục "Còn lại, ngoài phạm vi" ở Task 4).
- Kết quả cổng: `npx tsc --noEmit` sạch, `npm test` 210 file / 2409 test xanh (bằng mốc), build xanh.

## Task 4: cổng đầy đủ + kiểm trình duyệt

- **Bước 1-2:** `npx tsc --noEmit` sạch; `npm test` 210 file / 2409 test xanh (bằng mốc); `npm run build`
  (font mock + DB tạm) qua sạch.
- **Bước 3 (e2e đầy đủ):** lần chạy đầu **73/74** - `e2e/02-overview.spec.ts` đỏ (`chartCount` = 0, cần
  >= 4). Chạy lại riêng spec 3 lần: đỏ cả 3 (không phải chập chờn - lặp lại chính xác), nên đây là **spec mới
  đỏ, phải sửa gốc** theo đúng quy định của kế hoạch. Điều tra bằng Playwright thủ công trên bản `next start`
  (production): KHÔNG có lỗi JS/console, cả 5 chart (đúng số lượng cho role admin) đều mount đúng, chỉ mất
  khoảng 1-2s để chunk client (`OverviewChartsLazy`, nặng hơn do bọc thêm recharts 2.15.4 + React 19) tải xong
  khi chạy qua `next dev` (biên dịch on-demand) - quá mốc 5s mặc định của `expect()` Playwright khi hệ thống
  đang tải (nhiều tiến trình node khác chạy song song, xem mục môi trường bên dưới). **Sửa
  `e2e/02-overview.spec.ts`** (test-only, không sửa app): thay `.count()` đọc 1 lần bằng
  `expect(async () => {...}).toPass({ timeout: 15_000 })` để chờ đúng lúc chart mount thay vì đoán 1 mốc cố
  định. Chạy lại riêng spec 3 lần sau sửa: XANH cả 3. Chạy lại toàn bộ: **74/74 xanh**.
- **Bước 4 (`check:read`):** lần đầu (ngay sau khi chạy hết 74 spec e2e) LỆCH 3 mục
  (`readManpowerWeekly/Range/ActualByMonth`) - nguyên nhân: `04-data-entry.spec.ts` (1 trong 74 spec) ghi
  thật 1 ô số nhân lực vào DB, làm dữ liệu trôi khỏi mốc tĩnh `SEED_REPORT_DATE` mà `buildRepoData()` (hàm
  build dữ liệu "mock" để so sánh) dùng - không liên quan gì tới việc nâng Next/React/next-intl (không đụng
  file seed/check nào ở phase này). Seed sạch lại (`npx prisma db seed`, KHÔNG chạy lại e2e) rồi `npm run
  check:read` ngay sau: **OK toàn bộ 23/23 dòng**. Ghi chú cho Tester: `check:read` chỉ đáng tin khi chạy
  NGAY sau seed, chưa qua spec e2e nào ghi dữ liệu (đúng như comment gốc của
  `scripts/check-read-parity.ts`) - không phải quy định riêng của phase này.
- **Bước 5 (audit cuối):** `npm audit --omit=dev` hết sạch advisory của `next`, `next-intl`, `cookie`.
  `npm ls cookie` → `cookie@0.7.2` (mọi bản >= 0.7). Còn lại 8 advisory (3 moderate, 5 high) NGOÀI PHẠM VI
  (xem mục "Còn lại, ngoài phạm vi" bên dưới).
- **Bước 6 (đo + chụp "sau"):** xem `.bangiao/hieu-nang.md` mục "Sau". Tóm tắt: hiệu năng mọi trang NHANH
  HƠN "trước" (không có ô nào chậm hơn), `unstable_cache` vẫn ăn (median 3 lần sau < lần đầu ở hầu hết
  dòng), console sạch, ảnh `sau-*` giống hệt `truoc-*` (chỉ khác giờ/mã ngẫu nhiên do seed lại), tooltip
  Recharts hiện đúng ở cả Tổng quan và Chi tiết.
- **Bước 7 (trường hợp biên Task 2+3, kiểm bằng `curl`/trình duyệt):**
  - `GET /` không cookie → `307` `Location: /vi` (mặc định đúng locale `vi`).
  - `GET /` với cookie `NEXT_LOCALE=en` → `307` `Location: /en`.
  - `GET /vi//evil.com` → `308` `Location: /vi/evil.com` (KHÔNG có `//host` lạ - không phải open redirect).
  - `GET //evil.com/vi` → `308` `Location: /evil.com/vi` (KHÔNG có host lạ - không phải open redirect).
  - Mở `/vi` thật (theo redirect) → `Set-Cookie: NEXT_LOCALE=vi; ...; Max-Age=31536000` (đúng 1 năm, khớp
    `localeCookie.maxAge` đã cấu hình ở Task 3).
  - Chưa đăng nhập vào `/vi/overview` vẫn về `/vi/login`: đã phủ bởi e2e `09-chan-chua-dang-nhap.spec.ts`
    (74/74 xanh ở Bước 3).

### Còn lại, ngoài phạm vi (không thuộc next/next-intl/cookie)

| Gói | Mức | Lý do ngoài phạm vi |
|---|---|---|
| `deepmerge-ts` (qua `@prisma/config`/`prisma`) | high | Cần hạ `prisma` xuống 6.12.0 (breaking) - không liên quan Next |
| `postcss` (bundle sẵn trong `next`) | high | Chỉ hết khi lên `next@16` (breaking, ngoài phạm vi ">= 15.5.24") |
| `uuid` (qua `exceljs`) | moderate | Cần hạ `exceljs` xuống 3.4.0 (breaking) - không liên quan Next |
| `xlsx` | high | Không có bản vá (No fix available), đã biết từ trước phase này |

### Môi trường lúc chạy (ghi chú cho Tester)

Máy chạy song song nhiều tiến trình node (MCP servers, tsserver của cả 3 worktree A/B/C, dev server 3003 của
C ~2.2GB) nên có lúc RAM khả dụng thấp (~2.3-2.7GB/16GB). 1 lần `next build` chạy nền (`run_in_background`)
bị chính hệ thống/harness dừng để bảo vệ máy (không phải lỗi của build) - build lại thành công khi chạy trực
tiếp (foreground). Không tắt bất kỳ tiến trình nào của B/C.

## Cần hỏi

(chưa có mục nào)

## Để sau

(cập nhật khi hoàn thành Task 2 Bước 6)
