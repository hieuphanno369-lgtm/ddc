# P1B — Thay đổi (coder)

8 commit trên nhánh `feature/p1b-ui-nhanh`, theo đúng thứ tự Task 1 → 8 trong `ke-hoach.md`.
Cổng kiểm cuối: `npx tsc --noEmit` sạch, `npm test` **791/791** (baseline 712 + 79 test mới).
`git diff main --stat` không đụng `prisma/`, `app/globals.css`, `src/server/actions.ts`,
`src/server/repo/prisma-repo.ts`, `PROGRESS.md`, `.serena/`.

## Commit 1 — `be3cf9d` Task 1 (A): thẻ Tổng số nhân lực/thiết bị thay EAC/VAC

- `src/server/project-queries.ts`: thêm `manpowerContractors`/`equipmentContractors` vào
  `ResourceSnapshot` + `getResourceSnapshot` (đếm nhà thầu KHÁC NHAU bằng `Set` trên đúng ngày
  cuối cùng có dữ liệu của từng bên).
- `src/components/dashboard/KpiCard.tsx`: thêm prop `note` (dòng phụ thứ 2) và `href` (biến cả
  thẻ thành `<a>`, thêm class `tap`, dùng CSS `.tap` có sẵn).
- `app/[locale]/(app)/projects/[id]/page.tsx`: xoá 2 thẻ EAC/VAC + khối `.kpis k2` cũ; thêm 2
  `KpiCard` mới (Tổng nhân lực/thiết bị) ngay sau CPI, mỗi thẻ có `href="#res-manpower"` /
  `"#res-equipment"` nhảy tới đúng Card ở "Tầng 4" (đã thêm `id` + `style={{scrollMarginTop:72}}`
  để không bị topbar sticky che khi cuộn tới).
- i18n: thêm nhóm `resourceKpi` ở CUỐI `vi.json`/`en.json` (`manpowerTotal`, `equipmentTotal`,
  `asOf`, `planContractors`) — nhãn ngày theo D1 đã chốt: "Số liệu ngày {date}".
- Test mới/sửa: `project-queries.test.ts` (3 case nhà thầu khác nhau), `KpiCard.test.ts` (3 case
  href/note), `projects-detail-page-render.test.ts` (đổi thứ tự 6 thẻ, thêm case dự án 17 không
  có KH/số nhà thầu).

**Tester nên soi:** thẻ có `href` render bằng `<a>` (không phải `<div>`) — kiểm việc này không vỡ
layout CSS `.kpi` (Playwright/mắt thật, không chỉ unit test).

## Commit 2 — `305e31a` Task 2 (T13a): cột trọng số Chuỗi giá trị lấy thật từ `project_stage_weight`

- Tạo `src/lib/value-chain-view.ts` — hàm thuần `stageWeightLabel(weights, code, locale)`
  (format `%`, dấu phẩy/chấm theo locale, thiếu dòng hoặc `applicable=false` → `"-"`).
- `page.tsx`: tách biến `stageWeights` (dùng lại cho cả `buildStageTimelineRows` và cột `.w`);
  cột `<span className="w">` giờ hiện đúng % trọng số thay vì `-` cứng.

## Commit 3 — `c6cee40` Task 3 (T13b, nhánh **T** — số tấn): số tuyệt đối cạnh %

Chủ dự án đã chốt nhánh (T) — số tấn TT/KH, không làm nhánh (V) giá trị tỷ đồng.

- `value-chain-view.ts` thêm `stageTonnage(compare, code)` — Σ KH/TT tấn từ
  `getWorkItemComparison`; giai đoạn thủ công (Thiết kế, Nghiệm thu) hoặc không có hạng mục → `null`
  (không hiện gì, đúng yêu cầu chủ dự án).
- `page.tsx`: dòng `.stage` thêm `style={{gridTemplateColumns:'116px 38px 1fr auto'}}` để chừa
  chỗ cho số; số tấn là `<span>` nằm trong `.pc`, sau %.
- i18n nhóm `valueChainAbs` (`ton`: `"{actual}/{planned} tấn"` / `"{actual}/{planned} t"`).

## Commit 4 — `40ccb8d` Task 4 (T7a): bàn phím cho `Combobox` + `ProjectSwitcher`

- Tạo `src/lib/list-nav.ts` — 2 hàm thuần `nextActiveIndex` (vòng tròn ↓/↑) và
  `listboxKeyAction` (bảng quyết định phím: ArrowDown/Up mở+di chuyển, Enter chọn, Escape đóng).
  20 test phủ hết biên (count=0, vòng đầu↔cuối, Enter khi chưa chọn/ngoài khoảng, Esc khi đã đóng).
- `Combobox.tsx`, `ProjectSwitcher.tsx`: thêm `role="combobox"`/`listbox`/`option`, quản lý
  `active` bằng `listboxKeyAction`, `aria-activedescendant`, cuộn tới mục active
  (`scrollIntoView`). Chuột và bàn phím dùng chung một mục "đang sáng".

**Tester nên soi:** đây là 2 file có logic UI khá dày — nên bấm tay thật (Tab tới ô, gõ chữ, ấn
↓↓, Enter) chứ không chỉ tin unit test tĩnh.

## Commit 5 — `f6a561c` Task 5 (T7b): bàn phím cho `SettingsMenu` + `HelpTip`

- `SettingsMenu.tsx`: theo đúng mẫu WAI-ARIA menu button — nút ⚙ có `aria-haspopup="menu"`,
  ArrowDown/Up mở menu + focus mục đầu/cuối; panel `role="menu"`, mọi mục bấm được (kể cả nút
  toggle của `Section`) có `role="menuitem"`; Escape đóng + trả focus về nút ⚙; Tab tự đóng không
  chặn phím; các hành động (đổi theme/ngôn ngữ/mật khẩu) tự đóng + trả focus, riêng Link cấu hình
  và click ra ngoài đóng nhưng KHÔNG trả focus (theo đúng bảng trong kế hoạch).
- `HelpTip.tsx`: thêm `aria-describedby` liên kết nút "?" với bong bóng `role="tooltip"`; Escape
  ẩn bong bóng bằng inline style (thắng CSS `:focus-visible`), mở lại khi hover/focus tiếp theo
  hoặc khi blur/pointerleave.

## Commit 6 — `5423b08` Task 6 (T5): phân trang nhật ký (audit_log) 20 dòng/trang, 14 ngày mặc định

- Tạo `src/lib/log-paging.ts` (thuần, test riêng): `parseLogRange`, `parsePage`, `logSince`,
  `paginate`, `auditHref`.
- Tạo `src/server/audit-log-page.ts` — `getAuditLogPage()` gọi Prisma **trực tiếp**
  (`@/server/db`, KHÔNG qua `prisma-repo.ts` vì đó là file nóng không được sửa trong P1B):
  `count` + `findMany` (`orderBy changedAt desc, id desc`, `skip/take`). Chưa có index cho
  `audit_log.changed_at` (T1 thuộc P2B) — chấp nhận quét bảng theo đúng ràng buộc "không thêm
  index" của kế hoạch.
- Tạo `src/components/admin/AuditMiniTable.tsx` (server-safe, không hook) — bảng rút gọn dùng ở
  `/admin`, header đúng thứ tự **thời gian/người dùng/bảng/bản ghi/trường** (trước đây `/admin` ghi
  sai tên cột — "Table/Record/Field/By" tiếng Anh lẫn "Ngày" thay vì "Giờ:phút").
- `app/.../audit/page.tsx`: thêm nút chuyển "14 ngày gần nhất | Tất cả" (`Link`, không JS phía
  client), thanh phân trang dưới bảng (nút ← → vô hiệu ở biên bằng `<span aria-disabled>`).
- `app/.../admin/page.tsx`: bỏ `repo.getAuditLog()` (tải cả bảng), thay bằng
  `getAuditLogPage({page:1, range:'14d'})`; Activity giữ lọc 14 ngày qua `logSince('14d', ...)`.
- `ActivityViewer.tsx`: `formatDate` → `formatDateTime` (thêm giờ:phút), thêm phân trang 20
  dòng/trang bằng `paginate()`, reset về trang 1 khi đổi bộ lọc người dùng.
- i18n nhóm `logPaging` (`range14`, `rangeAll`, `prev`, `next`).
- Mock `@/server/audit-log-page` được thêm vào `operation-pages-render.test.ts` và
  `pages-role-guard.test.ts` để 2 file test này không chọc Postgres thật khi render `/audit`.

**Tester nên soi:** đây là Task rủi ro nhất về mặt vận hành (đụng nguồn dữ liệu thật qua Prisma
trực tiếp). Cần bấm tay `/vi/audit?page=2`, `/vi/audit?range=all`, `/vi/admin` trên DB dev thật
(không chỉ tin test có mock).

## Commit 7 — `4ac0e6b` Task 7 (T9 + T10): trang Tổng quan

- Tạo `src/lib/visible-rows.ts` — `maxHeightForRows()` tính chiều cao khung để thấy trọn 5 dòng
  đầu của danh sách "Dự án cần lưu ý".
- `Watchlist.tsx`: đo chiều cao thật bằng `ResizeObserver`-style (đăng ký lại khi resize cửa sổ),
  giá trị dự phòng SSR là `400px`; ≤ 5 mục thì không giới hạn chiều cao (không có thanh cuộn).
- `overview/page.tsx` dòng 92: đổi `.g21` (lệch cột) → `.g2` (2 cột đều nhau) CHỈ cho hàng
  Team KD/Cơ cấu — các hàng `.g21` khác giữ nguyên.

## Commit 8 — `64f5420` Task 8 (T12a, nhánh **8A** đã chốt gồm cả bước 8A-4): Backlog & Công nợ quá hạn thành 2 scorecard

Chủ dự án đã chốt định nghĩa Backlog = (a) tổng giá trị HĐ của dự án trạng thái "Chuẩn bị".

- Tạo `src/server/overdue-scorecard.ts` — `getOverdueScorecard(month, filters)`: Công nợ quá hạn
  tháng đang xem theo đúng phạm vi filter cấp dự án cũ (`getScopedProjectIds`, KHÔNG lọc status);
  `delta = null` khi `month='all'`/sai format hoặc tháng này/tháng trước chưa có dòng tài chính
  nào (không bịa mũi tên).
- `OverviewWidgets.tsx` (`BacklogOverdueCard`): bỏ hẳn logic dựng trend 12 tháng + chart đường,
  thay bằng 2 `KpiCard` (Backlog dùng `kpis.backlog`/`kpis.delta.backlog` có sẵn từ
  `loadPortfolioKpis`; Công nợ quá hạn dùng `getOverdueScorecard` mới, tô đỏ khi > 0).
- `charts.tsx`: xoá hẳn `BacklogOverdueLine` (không còn nơi nào gọi).
- `queries.ts` dòng TODO cũ (2 định nghĩa backlog lệch nhau) → đổi thành comment chốt quyết định,
  **không đổi công thức** (nhánh 8A giữ nguyên `kpisForMonth` hiện tại).
- `data-dictionary.ts:143`: đổi mục "Sparkline" (đã xoá) thành mô tả 2 scorecard mới.
- **Bước 8A-4** (đã chốt làm): `report.ts` — cột Backlog **từng dự án** ở `/report` + Excel export
  đổi từ `FactFinancial.backlog` (số liệu chết, app không có form nhập) sang cùng công thức (a):
  `status === 'Chuẩn_bị' ? contractValue : 0`. Sửa 2 test trong `report-export-route.test.ts`
  (dự án mới tạo/chưa khởi công → `backlog: 500`; thêm case dự án đã khởi công → `backlog: 0`).

**Tester nên soi:** đây là thay đổi công thức số liệu tài chính hiển thị trên `/report` + file
Excel xuất ra — cột Backlog từng dòng trong Excel giờ có thể khác số cũ (số cũ luôn là 0 vì
`fact_financial.backlog` không có đường nhập liệu nào trong app). Cần đối chiếu với chủ dự án nếu
có báo cáo Excel cũ đã gửi khách hàng dùng cột này.

## Điểm lệch so với kế hoạch

Không có điểm lệch — làm đúng Task 1→8, đúng các nhánh đã chốt (Task 3 nhánh T, Task 8 nhánh 8A
kèm 8A-4), D1–D6 giữ mặc định của planner.

## Ghi chú kỹ thuật khác

- Không thêm dependency, không thêm migration/index (đúng ràng buộc kế hoạch).
- Mọi style mới đều inline hoặc dùng class có sẵn — không đụng `app/globals.css`.
- `src/i18n/messages/vi.json` và `en.json` chỉ thêm 3 nhóm mới ở CUỐI file (sau `activity`):
  `resourceKpi`, `valueChainAbs`, `logPaging` — không chèn giữa key cũ, không đụng nhóm `dataGuard`
  mà Tài khoản A đang thêm song song.

## Debug vòng 1 — mục 3.16 (`/vi/audit?page=2` mở trực tiếp tự rơi về trang 1)

Skill đã dùng: `ddc-tower:systematic-debugging`, `ddc-tower:investigate-first`.

**Root cause (đã chứng minh bằng Playwright headless, không đoán):** KHÔNG phải do Link prefetch
của nút "14 ngày gần nhất" như tester nghi (giả thuyết đó bị loại sau khi kiểm chứng — 2 request
nền `_rsc=...` tester thấy đúng là do Next.js prefetch 2 Link đó, nhưng bản thân prefetch chỉ nạp
cache ngầm, KHÔNG tự đổi URL/nội dung đang hiển thị). Nguyên nhân thật nằm ở `SearchBox` — ô tìm
kiếm toàn ứng dụng trong `AppShell.tsx` (topbar, hiện diện trên MỌI trang, có từ trước P1B, không
phải code mới của Task 6):

```ts
const [v, setV] = useState(searchParams.get('search') ?? '');
useEffect(() => {
  const id = setTimeout(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!v) params.delete('search');
    else params.set('search', v);
    params.delete('page');           // <-- luôn chạy, kể cả khi v không đổi gì
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, 300);
  return () => clearTimeout(id);
}, [v]);
```

`useEffect` với dependency `[v]` LUÔN chạy ít nhất 1 lần ngay khi mount (đúng theo spec React), bất
kể người dùng đã gõ gì chưa. Khi mount `/audit?page=2`, `v` khởi tạo bằng `''` (không có `?search=`
trên URL) → 300ms sau, effect vẫn tự chạy → `params.delete('page')` xoá luôn `page=2` → gọi
`router.replace('?')` → URL rơi về `/vi/audit`, nội dung đổi lại trang 1. Do `AppShell` mount lại
từ đầu ở MỌI lần tải trang trực tiếp (gõ URL/F5/tab mới) nên bug luôn tái hiện; còn điều hướng
trong app (Link phân trang, soft navigation) không remount `AppShell` nên `v` không đổi, effect
không tự chạy lại → không bug. Giải thích luôn vì sao `?range=all` "không bị": trang đó vốn dĩ
không có `page` trong URL (mặc định page 1) nên bị xoá `page` (vốn không tồn tại) không tạo ra khác
biệt quan sát được.

**Verify bằng chứng (không đoán mò):**
1. Dựng lại đúng bug bằng Playwright headless (kênh `msedge` có sẵn qua cache `@playwright/mcp`,
   dev server cổng 3001, chèn tạm 26 dòng `audit_log`, xoá sạch sau khi xong — DB `ddc_control_tower_b`
   xác nhận `auditLog.count() = 0` sau khi kiểm): `/vi/audit?page=2` → sau ~3-4s URL tự đổi về
   `/vi/audit`, khớp 100% mô tả tester.
2. Fix lần 1 dùng `useRef` để "bỏ qua lần chạy đầu" — KHÔNG đủ, vì app bật
   `reactStrictMode: true` (next.config.mjs) khiến effect luôn chạy 2 lần liên tiếp ở dev
   (mount → cleanup → mount lại trên CÙNG fiber, ref không reset giữa 2 lần) → lần chạy thứ 2
   vẫn lọt qua "chốt" ref và vẫn xoá `page`. Đã bắt được bằng console.log tạm trong lúc điều tra
   (không còn trong code).
3. Fix đúng: bỏ hẳn cách "đếm lần chạy", thay bằng so sánh idempotent — chỉ đổi URL khi `v` THẬT SỰ
   khác với `search` hiện có trên URL (không phụ thuộc effect chạy mấy lần, remount bao nhiêu lần).
4. Verify lại bằng Playwright: `/vi/audit?page=2` giữ nguyên sau 5s; gõ vào ô tìm kiếm trên
   `/overview?page=3` vẫn hoạt động đúng như cũ (`search=cang` được set, `page` bị xoá theo đúng ý
   đồ ban đầu của tính năng tìm kiếm); `/vi/audit?range=all` vẫn ổn định như trước.

**Cách sửa (tối thiểu, đúng chỗ):**
- Tách phần tính "có cần đổi URL không, đổi thành gì" ra hàm thuần
  `computeSearchNavParams(currentQueryString, v)` trong `src/lib/search-box-nav.ts` (mới) — trả về
  `null` khi `v` khớp đúng `search` hiện có (không làm gì), trả về querystring mới khi có thay đổi
  thật. Test `src/lib/search-box-nav.test.ts` (mới, Vitest node, 6 case) phủ đúng case bug 3.16 gốc
  + case mount có sẵn `search`/`page` + case gõ tìm kiếm thật + case xoá tìm kiếm + case
  `range=all`.
- `src/components/layout/AppShell.tsx` (`SearchBox`): gọi hàm trên trong effect, chỉ `router.replace`
  khi kết quả khác `null`. Không đổi UI/props/behavior nào khác của component.
- Không sửa file nóng nào trong danh sách CLAUDE.md mục 3; không đụng `audit/page.tsx`,
  `log-paging.ts`, `audit-log-page.ts` của Task 6 (bug không nằm ở đó).

**Phạm vi ảnh hưởng:** đây là bug có sẵn từ trước P1B (file `AppShell.tsx` không đổi trong 8 commit
P1B trước đó), chỉ mới lộ ra vì Task 6 (T5) là tính năng ĐẦU TIÊN dùng `page` trên URL của một trang
KHÔNG dùng chung `page` với ô tìm kiếm toàn cục (`/overview`, `/projects`... vốn đã quen bị xoá
`page` mỗi khi tìm kiếm, đúng ý đồ). Sửa ở `SearchBox` thay vì ở `/audit` vì gốc rễ nằm ở hành vi
effect chạy vô điều kiện của `SearchBox`, không phải ở Task 6.

## Sửa theo review vòng 1

Theo `.bangiao/danh-gia.md` mục CẦN SỬA TRƯỚC MERGE #1 (TB-1, kiểu tham số `/audit` làm hỏng
`next build`). Chỉ sửa đúng phạm vi này, không đụng mục 2 (archive — thủ tục lúc merge, chủ dự án
tự làm) và không làm các mục "Để sau".

- `app/[locale]/(app)/audit/page.tsx`: bỏ giá trị mặc định `= {}` ở ngoài cùng của tham số hàm
  `AuditPage` (dòng `} = {}) {` → `}) {`), giữ `searchParams = {}` trong destructuring nên tham số
  vẫn tuỳ chọn khi gọi trực tiếp. Nguyên nhân gốc: giá trị mặc định ngoài cùng khiến kiểu suy ra có
  `| undefined`, không khớp `PageProps` mà `next build` kiểm ở `.next/types`.
- `src/server/operation-pages-render.test.ts` (dòng 204, 215, 230, 242): `render(AuditPage)` →
  `render(() => AuditPage({}))` vì tham số giờ bắt buộc khi gọi trực tiếp hàm.
- `src/server/pages-role-guard.test.ts` (dòng 128, 133, 138, 143, 148): `visit(AuditPage)` →
  `visit(() => AuditPage({}))`, cùng lý do.

**Kết quả kiểm:**
- Khởi động `npm run dev -- -p 3001`, mở `/vi/login` và `/vi/audit` (chưa đăng nhập, redirect 307 —
  đủ để Next compile route và sinh `.next/types/app/[locale]/(app)/audit/page.ts`), không xoá
  `.next` trước đó. Tắt dev server (port 3001) trước khi kiểm kiểu/build để tránh khoá file
  `.next/trace`.
- `npx tsc --noEmit`: **exit code 0** (có `.next/types` khi chạy, không xoá `.next`).
- `npm test`: **802/802 pass** (chạy cả trước và sau `next build`, cùng kết quả).
- `npx next build` (env `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ tới
  `D:\_project\DDC_dieu-phoi\tools\font-mock.js`): **exit code 0**, "Compiled successfully", có
  route `ƒ /[locale]/audit` trong bảng kết quả — không còn lỗi `TS2344` ở `.next/types` như review
  vòng 1 đã bắt được.

**Tester nên soi:** không cần chạy lại toàn bộ, nhưng nên xác nhận lại đúng phép kiểm review vòng 1
đã yêu cầu — `.next/types` phải được sinh bởi `next dev`/`next build` thật (không xoá `.next` giữa
chừng) trước khi chạy `tsc --noEmit`, nếu không sẽ không bắt được lớp lỗi kiểu này.

Cổng kiểm sau sửa: `npx tsc --noEmit` sạch; `npm test` **802/802 PASS** (796 cũ + 6 test mới).
