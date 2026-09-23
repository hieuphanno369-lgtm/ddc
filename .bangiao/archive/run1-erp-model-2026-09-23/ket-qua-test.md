# Kết quả test — Run 1: ERP data model (Task 0-8)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm (Task 8) → smoke-test bằng `mcp__playwright` (đăng nhập thật, mở trình duyệt).
DB đụng chạm → kiểm trạng thái dữ liệu sau test bằng `mcp__postgres` (read-only).

## Tổng kết

- **Baseline trước khi thêm test:** `npx vitest run` → 316/316 xanh (23 file), `npx tsc --noEmit`
  → 0 lỗi. Đúng như coder báo cáo trong `.bangiao/thay-doi.md`.
- **Sau khi thêm 4 test mới** (file `src/server/queries.test.ts`): `npx vitest run` →
  **320/320 xanh** (24 file). `npx tsc --noEmit` → **0 lỗi**.
- **Không có test nào rớt.** Không cần dừng dây chuyền cho debugger.
- **Task 8 (biểu đồ nhân lực) đã verify bằng mắt qua Playwright, đăng nhập thật** — xem chi
  tiết bên dưới. Toàn bộ đúng như bản kế hoạch mô tả.
- **DB sau test (đọc qua `mcp__postgres`, read-only):** `dim_project` = 17, `fact_progress_monthly`
  = 204 dòng, cả 204 đều `isLatest = true`, không có dòng rác nào sót lại từ quá trình test thủ
  công trước đó của coder. Khớp đúng mô tả trong `thay-doi.md`.

## Test mới thêm — `src/server/queries.test.ts` (4 test)

Nhắm đúng điểm "Tester nên soi" của Task 0: `getPortfolioKpis()` đổi từ
`HISTORY_MONTHS.indexOf()` (tự tham chiếu ở tháng đầu lịch sử, delta luôn = 0) sang
`prevMonth()` thật (luôn tính tháng lịch trước đó, kể cả ngoài cửa sổ 12 tháng seed).
Trước đây **không có test nào** gọi trực tiếp `getPortfolioKpis`/`getProjectSummary` (chỉ có
test dùng số KPI tự bịa để test trang render) — đây là khoảng trống thật, không phải trùng lặp.

1. **Đường chạy thuận lợi** — `getPortfolioKpis('2026-09')`: đối chiếu `delta` với một "oracle"
   độc lập tính từ `getProjectSummaries()` công khai (không copy lại logic nội bộ
   `kpisForMonth`). Chốt số liệu thật của seed hiện tại: `delta.inProgress = -1`,
   `delta.behindSchedule = -1`, `delta.penaltyRisk = -1`.
2. **Biên (Task 0 flag)** — `getPortfolioKpis(historyMonths()[0])` = tháng `2025-10`, có
   `prevMonth = 2025-09` nằm **ngoài** cửa sổ seed 12 tháng (không có fact nào). Test khẳng
   định `delta` vẫn khớp đúng công thức `KPI(cur) - KPI(prevMonth ngoài cửa sổ)` tính độc lập
   qua `getProjectSummaries('2025-09')`, chứng minh code **không** rơi về hành vi cũ (tự tham
   chiếu chính nó khi ở đầu mảng). Ghi chú thật: với bộ seed hiện tại, hai tháng này tình cờ có
   cùng aggregate (statuses/backlog giống hệt nhau) nên `delta` ra toàn số 0 ở CẢ logic cũ lẫn
   logic mới — nghĩa là bug cũ (nếu bị revert) sẽ không tự lộ ra qua bộ seed này. Test vẫn có giá
   trị hồi quy: nó khoá đúng công thức `delta = cur - prev(thật)`, không khoá theo hành vi
   tự-tham-chiếu.
   Kèm 1 test phụ: mọi `ProjectSummary` ở tháng ngoài cửa sổ có `pctActual = 0`, không `NaN`.
3. **Phải thất bại** — `getProjectSummary(999999, '2026-09')` phải trả `undefined`, không throw.

Đã tự verify RED/GREEN cho file test này (không đụng code sản phẩm): tạm sửa 1 assertion sang
giá trị sai (`-999`), chạy thấy FAIL đúng lý do (`expected -1 to be -999`), phục hồi lại giá trị
đúng, chạy lại thấy PASS. Xác nhận test không phải "test vô hại luôn xanh".

## Rà soát các điểm "Tester nên soi" khác trong `thay-doi.md`

- **Task 0 `clock.ts`** — đã có test đầy đủ sẵn (`clock.test.ts`, 12 test): env rác, `historyMonths`
  biên `count <= 0`, `endOfMonth` không đọc đồng hồ. Không có khoảng trống.
- **Task 3 `WhatIf.tsx` (API đổi, cần `bac`)** — grep xác nhận đúng 1 call site
  (`app/[locale]/(app)/projects/[id]/page.tsx:242`), đã truyền đủ `bac`. Repo **không có** hạ
  tầng test component React (không jsdom, không `@testing-library/react`, `vitest.config.ts`
  chỉ include `src/**/*.test.ts`) — nhất quán với quy ước hiện có (không component `.tsx` nào
  trong repo có unit test riêng, chỉ có RSC page được render-smoke-test qua
  `react-dom/server`). `WhatIf` không có logic riêng ngoài gọi lại `calcEv/calcCpi/calcEac` — cả
  3 hàm này đã có unit test trực tiếp trong `evm.test.ts`. Đã verify bằng mắt qua Playwright:
  card "What-if" hiện đúng EAC/slider ở cả `/vi/projects/1` và `/en/projects/1`, không lỗi.
  Không thêm hạ tầng test mới (đúng tinh thần "dùng framework repo đang dùng").
- **Task 6 `nonPicOf()`** — đã có sẵn bộ test đầy đủ trong `close-alert-role.test.ts` (8 test,
  gồm nhóm "trường hợp phải thất bại" dùng đúng `nonPicOf()`). Không có khoảng trống.
- **Task 7 thứ tự xoá `prisma/seed.ts`** — không thể unit-test thứ tự DB thao tác mà không chạy
  seed thật (rủi ro động vào dữ liệu dev). Đã xác minh qua `mcp__postgres` (read-only): DB hiện
  tại đúng trạng thái đã seed (17/204, không rác) — khớp báo cáo của coder rằng seed đã chạy sạch
  sau khi sửa thứ tự xoá.

## Verify Task 8 bằng mắt — Playwright, đăng nhập thật (`admin@daidung.com.vn` / `Admin@123`)

Khởi động `npm run dev` (nền), đăng nhập qua form thật (không mock), điều hướng
`http://localhost:3000/vi/projects/1`:

| Kiểm tra | Kết quả |
|---|---|
| 2 scorecard nguồn lực | **486/520** và **63/72**, đúng dòng phụ "Số liệu ngày 16/09/2026" |
| Vị trí biểu đồ | Nằm cuối trang, sau card "Ảnh hiện trường", tiêu đề "Nhân lực theo thời gian (KH vs TT)" |
| Mặc định "Theo tuần" | Đúng 2 điểm nhãn: `07.09 - 13.09`, `14.09 - 20.09` |
| Bấm "Theo tháng" | Đúng 1 điểm nhãn: `01.09 - 30.09` |
| Badge góc trái | Ghi `2026` |
| `/en/projects/1` | Không lộ key i18n thô — 9 key mới của Task 8 dịch đúng: "Manpower over time (plan vs actual)", "By week"/"By month", "Planned headcount"/"Actual headcount", "Manpower (actual/plan)", "Equipment (actual/plan)", "As of 16/09/2026" |

**Kết luận Task 8: ĐẠT toàn bộ**, đúng như bản kế hoạch Q3 mô tả.

### Ghi chú phụ (không phải lỗi Task 8, không cần debugger)

- Console có 3 "error" khi mở `/vi/projects/1` — đều là warning `defaultProps` deprecated của thư
  viện `recharts` (XAxis/YAxis/ReferenceLine), phát sinh từ `SCurve`/`SpiCpiLine` (component đã có
  từ trước Run 1, không phải code Task 8), không ảnh hưởng hiển thị/hành vi.
- Ở bản `/en/projects/1`, một số chuỗi vẫn tiếng Việt: "Ảnh hiện trường tháng 09/2026", nội dung
  message alert ("Rule: Nguy cơ phạt HĐ...", "Còn ≤30 ngày đến mốc bàn giao...", "%TT chưa đạt
  100%"), "Mã hiện hành". Đây là dữ liệu seed/chuỗi hardcode có từ trước, KHÔNG phải 1 trong 9 key
  i18n mới của Task 8 (đã dịch đúng, xem bảng trên) — nằm ngoài phạm vi Run 1 theo Global
  Constraints ("styling / i18n message mới để Run 3"). Nêu ra để chủ dự án biết, không phải lỗi
  cần debugger xử lý trong Run 1 này.

## Việc đã làm để verify

- `npx vitest run` (baseline 316/316, sau khi thêm test 320/320).
- `npx tsc --noEmit` (0 lỗi, cả trước và sau khi thêm test).
- Đọc code `queries.ts`, `WhatIf.tsx`, `close-alert-role.test.ts`, `prisma/seed.ts` theo đúng
  danh sách "Tester nên soi" của `thay-doi.md`.
- Viết `src/server/queries.test.ts`, tự verify RED (assertion sai → fail đúng lý do) rồi GREEN.
- Mở Playwright thật, đăng nhập bằng tài khoản seed, kiểm bằng mắt toàn bộ yêu cầu Task 8 ở cả
  2 locale.
- Đọc DB qua `mcp__postgres` (chỉ SELECT, không sửa gì) xác nhận trạng thái seed sạch sau test.

## File chỉ được tạo/sửa (đúng phạm vi cho phép — chỉ file test)

- Tạo mới: `src/server/queries.test.ts`
- Tạo mới: `.bangiao/ket-qua-test.md` (báo cáo này)
- Không sửa bất kỳ file code sản phẩm nào.

---

## Vòng chạy lại — sau CAN SUA #1 (commit `987c2e1`, 5 điểm A-1 → A-5)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
A-3 đụng UI (`app/[locale]/(app)/projects/[id]/page.tsx`) → smoke-test bằng `mcp__playwright`
trên dev server thật, đăng nhập sẵn. A-2 cũng đụng UI (`/overview`) → verify thêm bằng mắt.
Không có điểm nào trong 5 điểm cần thao tác ghi/xoá dữ liệu DB dev thật nên không dùng
`mcp__postgres` lần này (xem lý do bỏ qua tích hợp DB thật ở mục A-5 bên dưới).

### Tổng kết

- **Baseline trước khi thêm test:** `npx vitest run` → 320/320 xanh (24 file),
  `npx tsc --noEmit` → 0 lỗi. Đúng như coder báo cáo trong `.bangiao/thay-doi.md`.
- **Sau khi thêm 15 test mới** (3 file test mới + bổ sung 2 file có sẵn):
  `npx vitest run` → **335/335 xanh (26 file)**. `npx tsc --noEmit` → **0 lỗi**.
- **Không có test nào rớt ở lần chạy cuối.** Không cần dừng dây chuyền cho debugger.
- Cả 3 bộ test mới đều đã tự verify RED → GREEN thật (tạm revert đúng dòng code sản phẩm đã
  sửa ở vòng CAN SUA #1, chạy thấy FAIL đúng lý do mô tả trong `thay-doi.md`, phục hồi lại
  bằng Edit rồi `git diff --stat` xác nhận file về đúng trạng thái commit `987c2e1`, chạy lại
  thấy PASS). Không có sai lệch nào sau khi phục hồi.

### A-2 — `getPortfolioKpis('all')` không còn bịa số (file `src/server/queries.test.ts`, +3 test)

- **Đường chạy thuận lợi:** `getPortfolioKpis('all').delta` = toàn bộ 6 trường = 0.
- **Biên (nêu tên trong `thay-doi.md`):** phần KPI chính (không phải `delta`) vẫn phản ánh đúng
  toàn portfolio (`totalProjects` khớp `getProjectSummaries('all').length`, > 0) — chứng minh
  fix không "zero hoá lây" sang phần số liệu chính.
- **Phải thất bại (oracle công thức CŨ):** gọi `prevMonth('all')` thật (từ `@/lib/clock`) ra
  đúng chuỗi rác `'0NaN-NaN'` như mô tả; dùng chuỗi rác đó tính lại `delta.inProgress` theo
  đúng công thức CŨ (`cur - prev(chuỗi rác)`) — ra số **khác 0** thật sự với bộ seed 17 dự án
  hiện tại (không phải giả định suông). Khẳng định `kpis.delta.inProgress` (đã fix) = 0 và
  **khác** con số bịa đó.
- RED xác nhận: tạm bỏ khối `if (yearMonth === 'all') {...}` trong `getPortfolioKpis` (revert
  về đúng code trước vòng sửa) → 2/3 test FAIL đúng lý do (`delta.behindSchedule: -5`,
  `delta.penaltyRisk: -1`, `delta.inProgress: -1` thay vì 0) — bằng chứng bug A-2 có thật trên
  seed hiện tại, không phải test vô hại.
- **Verify bằng mắt qua Playwright** (`admin@daidung.com.vn`, dev server thật):
  `http://localhost:3000/vi/overview?month=all` — cả 6 card KPI hiện delta = `"-"` (không đổi),
  không còn số dương/âm bất thường.

### A-3 — Validate `month` trước khi dùng ở trang Chi tiết dự án (+9 test, 2 file)

**`src/server/project-queries.test.ts` (+5 test)** — test trực tiếp 2 hàm đọc dữ liệu thật mà
trang gọi (`getResourceSnapshot`, `getManpowerDaily`) và `getProjectSummary`, với đúng công
thức guard `page.tsx` dùng:
- **Phải thất bại:** KHÔNG validate, gọi thẳng `getResourceSnapshot(1, 'abc')` /
  `getManpowerDaily(1, 'abc')` → cả hai đúng là `rejects.toThrow(RangeError)` — chứng minh lỗ
  hổng gốc (`endOfMonth('abc')` → `Invalid time value`) có thật.
- **Đường chạy thuận lợi:** month hợp lệ (`'2026-07'`) qua guard không đổi.
- **Biên:** `'abc'` qua guard → fallback đúng `currentMonth()`, cả 3 hàm đọc dữ liệu resolve
  bình thường; `'all'` (giá trị đặc biệt của code CŨ, chỉ loại đúng 1 chuỗi này) cũng phải qua
  guard mới, không còn là trường hợp đặc biệt; `searchParams.month` dạng mảng (`string[]`, hợp
  lệ theo kiểu Next.js) cũng fallback an toàn.

**`src/server/projects-detail-page-month-guard.test.ts` (+4 test, file mới)** — render THẬT
component `app/[locale]/(app)/projects/[id]/page.tsx` (không phải re-implement công thức guard
ở nơi khác), theo đúng pattern render RSC có sẵn (`operation-pages-render.test.ts`, mock
`next-intl/server`/`@/lib/session`/`@/server/repo`/component client `Badges`/`WhatIf`/
`ProjectSwitcher`):
- `?month=abc`, `?month=2026-99` (đúng format nhưng tháng rác), không truyền `month`, và
  `?month=2026-07` (hợp lệ) — cả 4 trường hợp đều render ra tên dự án "SVĐ PVF", KHÔNG throw.
- RED xác nhận: tạm revert điều kiện guard về đúng code CŨ
  (`searchParams.month !== 'all'` thay vì `isValidYearMonth(...)`) → test `?month=abc` FAIL
  đúng lý do, stack trace trỏ thẳng `Module.endOfMonth src/lib/clock.ts:70` →
  `resourceWindow` → `getResourceSnapshot` → `ProjectDetailPage` — đúng chuỗi gọi thật mô tả
  trong `thay-doi.md`, không phải lỗi giả.
- **Smoke-test Playwright trên dev server thật** (đăng nhập sẵn `admin@daidung.com.vn`):
  `http://localhost:3000/vi/projects/1?month=abc` → trang render bình thường (tiêu đề "SVĐ
  PVF", breadcrumb, KPI card...), console 0 lỗi mới, không phải trang lỗi 500 của Next.js.

### A-5 — `resetAllData()` xoá thêm `sap_queue` (file `src/server/repo/prisma-repo-reset.test.ts`, +3 test, file mới)

Mock thẳng `@/server/db` (nguồn duy nhất `prisma-repo.ts` import client Prisma) thay vì chạy
thật trên DB dev — lý do: `resetAllData()` xoá **toàn bộ** 17 dự án + mọi bảng con qua cascade,
trong khi DB dev hiện đang ở đúng trạng thái seed ERP v2 đầy đủ mà `thay-doi.md` xác nhận
"không cần seed lại". Chạy thật sẽ phá trạng thái đó, phải seed lại tốn thời gian, trong khi
hành vi cần kiểm (lệnh Prisma nào được gọi, có cùng transaction hay không) chứng minh được đầy
đủ bằng cách bắt lệnh gọi tới `prisma.sapQueue.deleteMany` — **đã chủ động bỏ qua tích hợp DB
dev thật cho đúng điểm này**, đúng tinh thần "nếu rủi ro/tốn thời gian thì ghi rõ lý do".
- **Đường chạy thuận lợi:** gọi `repo.resetAllData()` → `prisma.sapQueue.deleteMany` /
  `project.deleteMany` / `auditLog.deleteMany` đều được gọi đúng 1 lần.
- **Biên:** cả 3 lệnh xoá nằm CHUNG một `$transaction` (mảng độ dài 3), không phải 3 lệnh rời
  rạc — đúng tính atomic mà comment code mới ghi rõ.
- **Phải thất bại:** giả lập `$transaction` ném lỗi (deadlock/constraint) → `resetAllData()`
  phải propagate lỗi (`rejects.toThrow`), không được nuốt im lặng.
- RED xác nhận: tạm bỏ dòng `prisma.sapQueue.deleteMany()` khỏi mảng `$transaction` trong
  `prisma-repo.ts` (revert về đúng code trước vòng sửa) → 2/3 test FAIL đúng lý do (`sapQueue.
  deleteMany` gọi 0 lần thay vì 1; mảng transaction chỉ còn 2 phần tử thay vì 3).

### A-1 — migration.sql (kiểm bằng mắt, không viết test tự động — đúng chỉ thị)

Đọc trực tiếp `prisma/migrations/20260922220000_erp_model_v2/migration.sql` (diff commit
`987c2e1`):
- Khối `INSERT INTO "dim_stage" (...) VALUES (7 dòng) ... ON CONFLICT ("code") DO NOTHING`
  nằm **đúng vị trí** — ngay sau dòng `CREATE INDEX
  "fact_progress_monthly_projectId_yearMonth_isLatest_idx"...` và **trước** dòng
  `-- AddForeignKey` đầu tiên (`ALTER TABLE "dim_customer" ADD CONSTRAINT
  "dim_customer_mergedIntoId_fkey"...`). Đúng yêu cầu "trước khối AddForeignKey".
- 7 dòng dữ liệu (`design/shop/procurement/fabrication/transport/erection/handover`) khớp
  từng ký tự với `src/data/seed/erp.ts` (đã đối chiếu `code`, `nameVi`, `nameEn`, `sortOrder`,
  `calcMode` — đúng cả thứ tự 1→7).
- 2 lệnh dọn có `WHERE` hợp lý, không tràn lan:
  - `UPDATE fact_progress_monthly SET "bottleneckStage" = NULL WHERE "bottleneckStage" IS NOT
    NULL AND "bottleneckStage" NOT IN (SELECT "code" FROM "dim_stage")` — chỉ đụng dòng có
    `bottleneckStage` KHÔNG khớp 7 mã vừa insert; vì 7 mã đã có sẵn ngay phía trên, dữ liệu hợp
    lệ hiện tại (seed cũ dùng đúng 7 mã này) sẽ không bị đụng.
  - `DELETE FROM fact_value_chain_progress WHERE "stageCode" NOT IN (SELECT "code" FROM
    "dim_stage")` — cùng logic, chỉ xoá dòng mồ côi thật sự.
- **Không dựng DB mới từ đầu để chạy `migrate deploy` full history** (bỏ qua bước "tuỳ chọn"
  mà đề bài cho phép bỏ) — lý do: dựng schema tạm + chạy lại toàn bộ 3 migration history rồi
  seed lại tốn ~10-15 phút và không có nhiều giá trị tăng thêm so với việc đọc SQL bằng mắt,
  vì nội dung INSERT/WHERE đã đối chiếu được chính xác qua text diff (không có logic động nào
  cần "chạy thử mới biết"). Nếu chủ dự án cần bằng chứng chạy thật trên DB rỗng, nên làm ở vòng
  Go-live QA gate (`ddc-tower:golive`) trước khi lên production, không cần thiết ở vòng tester
  patch nhỏ này.

### A-4 — `.env.example` (kiểm bằng mắt)

Đọc file: dòng `DDC_FAKE_TODAY=2026-09-16` đã có `#` ở đầu (dòng 24), kèm 3 dòng comment giải
thích rõ "CHỈ dùng cho test", cấm dùng ở production/dev thật. Đúng yêu cầu A-4.

### Việc đã làm để verify (vòng này)

- `npx vitest run` (trước 320/320, sau khi thêm test 335/335) + `npx tsc --noEmit` (0 lỗi cả
  hai lần).
- Tự verify RED/GREEN cho cả 3 bộ test mới bằng cách tạm revert đúng dòng code sản phẩm của
  vòng CAN SUA #1, chạy thấy FAIL đúng lý do, phục hồi bằng Edit, xác nhận `git diff --stat`
  rỗng (file về đúng trạng thái commit) rồi chạy lại thấy PASS.
- Mở dev server thật (`npm run dev`, nền), dùng `mcp__playwright` với phiên đăng nhập sẵn có
  (`admin@daidung.com.vn`) để smoke-test cả A-2 (`/vi/overview?month=all`) và A-3
  (`/vi/projects/1?month=abc`) trên môi trường thật, không chỉ unit test.
- Đọc bằng mắt `migration.sql` (A-1) và `.env.example` (A-4), đối chiếu với `src/data/seed/
  erp.ts` cho phần dữ liệu `dim_stage`.

### File chỉ được tạo/sửa ở vòng này (đúng phạm vi cho phép — chỉ file test)

- Sửa: `src/server/queries.test.ts` (+3 test — A-2)
- Sửa: `src/server/project-queries.test.ts` (+5 test — A-3)
- Tạo mới: `src/server/projects-detail-page-month-guard.test.ts` (4 test — A-3, render RSC thật)
- Tạo mới: `src/server/repo/prisma-repo-reset.test.ts` (3 test — A-5)
- Sửa: `.bangiao/ket-qua-test.md` (thêm mục này)
- Không sửa bất kỳ file code sản phẩm nào (2 lần revert tạm thời để verify RED đều đã phục hồi
  nguyên trạng, xác nhận bằng `git diff --stat` rỗng trước khi chạy GREEN lần cuối).
