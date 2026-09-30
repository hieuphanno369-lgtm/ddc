# P4 - Thay đổi đợt 1 (Nhóm A, B, E)

Nhánh `feature/p4-logic-bo-loc`, tài khoản C, DB `ddc_control_tower_c`.
Phạm vi đợt này: A1, A2, A3, B1, B2, E1, E2, E3. Chưa làm C, D, F, G.

## 1. Commit

- `398900b` feat(p4-k): thêm tầng kỳ báo cáo `src/lib/period.ts` (A1).
- `5f2ccd9` feat(p4-k): thêm pickAsOf/carrySeries mang số tháng trước (A2).
- `ae95c2a` feat(p4-k): thêm hàm đọc theo mốc/kỳ vào read repo (A3).
- `2c7035d` test(p4): tái hiện L-1..L-5, F-1, F-2 bằng test đỏ (B1).
- `52384c9` fix(p4-l1-l5): tính số tại mốc cuối kỳ, mang số tháng trước, SPI/CPI có trọng số (B2).
- `30fec22` refactor(p4-l2): bỏ `readMonthlyEvm` (AVG spi/cpi) vì không còn nơi gọi (B2, theo kế hoạch).
- `aa4f806` feat(p4): thêm key i18n P4 và đổi tên đã duyệt (E1, E2).
- `dc0c0aa` fix(p4-help): HelpTip mở bằng bấm, dùng được trên điện thoại; KpiCard thêm prop `help` (E3).

## 2. File đã sửa và để làm gì

### A1
- `src/lib/period.ts` (mới): `Period`, `parsePeriod`, `defaultOverviewPeriod` (12 tháng gần nhất, Q1), `periodMonths`, `periodAsOfDate/Month`, `previousPeriod`, `periodKey`, `periodContains`, `intersectsPeriod`, `periodSearch`.
- `src/lib/period.test.ts` (mới): 24 ca theo kế hoạch.

### A2
- `src/lib/as-of.ts` (mới): `pickAsOf` (tìm nhị phân dòng cuối có yearMonth <= tháng), `carrySeries`, `dataStateOf`.
- `src/lib/as-of.test.ts` (mới): 12 ca.

### A3
- `src/server/repo/read-types.ts`, `read-prisma.ts`, `read-mock.ts`: thêm 7 hàm `readFactSnapshotsAsOf`, `readFinancialAsOf`, `readRevenueInRange`, `readVolumeInRange`, `readFactSeries`, `readValueChainAsOf`, `readLastDailyDate`.
- `readFactSnapshotsAsOf` và `readFinancialAsOf` dùng `CROSS JOIN LATERAL ... LIMIT 1` theo đúng SQL của kế hoạch.
- `src/server/repo/read-period-contract.ts` (mới, không phải `.test.ts`): bộ 9 ca dùng chung cho mock và Postgres thật.
- `src/server/repo/read-mock.test.ts`: chạy bộ ca chung trên mock.
- `src/server/repo/read-period-real-db.test.ts` (mới): chạy bộ ca chung trên Postgres thật, `describe.skipIf(!DATABASE_URL)`, dữ liệu tiền tố `test-p4-`, tự dọn (đã kiểm DB sau khi chạy: 0 dòng `test-p4-`).
- `scripts/check-read-parity.ts`: thêm đối chiếu cho 7 hàm mới.

### B1
- `src/server/queries-period.fixture.ts` (mới): 3 dự án A/B/C, stub repo riêng dựng trên `createReadMock`.
- `src/server/queries-period.test.ts` (mới): 18 ca gắn mã L-1a..d, L-2, L-3a..c, L-4, L-5, HĐ chưa khởi công, F-1, F-2, công suất.

### B2
- `src/server/queries.ts` (file nóng): chuyển sang `Period`.
  - `summarize` tính tại `asOfDate`, không dùng "hôm nay"; ngày thực tế sau mốc coi như chưa xảy ra; so ngày bằng `slice(0,10)` vì Postgres trả ISO đầy đủ.
  - `getProjectSummaries(period, filters)` lọc "thuộc kỳ" (Q4) rồi lọc filters; nền `getPeriodBase(period)` được memo theo tham chiếu `period`.
  - `getPortfolioKpis`: KPI mới `projectsInPeriod`, `notStartedValue`, `revenueInPeriod`, `tonnageInPeriod`, `asOfDate`, `months`; delta so kỳ trước cùng độ dài (Q2), `null` khi không có số để so.
  - S-curve và SPI/CPI dùng chung `portfolioSeries`: tập id = tập của `getProjectSummaries` (sửa F-1), mang số tháng trước, `spi = ΣEV/ΣPV`, `cpi = ΣEV/ΣAC` (sửa L-2), số tháng theo kỳ (sửa F-2).
  - Công suất = công suất tháng x số tháng của kỳ; sản lượng/doanh thu theo nhóm cộng theo kỳ.
  - Xoá `getScopedProjectIds`; thêm `getAllProjectSummaries(period)` (xem mục 4).
  - `getProjectSummary(projectId, asOfMonth)` (trang Chi tiết) dùng `pickAsOf` trên `repo.getFacts`, ngày mốc = min(cuối tháng, hôm nay).
- `src/server/cache.ts`: mọi loader nhận `Period`, khoá = `periodKey` + filters, tags = `trendTag`, `profileTag`, `overviewTag(tháng mốc)`.
- `src/server/overdue-scorecard.ts`: công nợ quá hạn là số tồn tại mốc (`readFinancialAsOf`), cùng tập id với KPI; delta so cuối kỳ trước.
- `src/server/top-priority-queries.ts`: nhận `Period`.
- `src/server/report.ts`, `app/[locale]/(app)/report/page.tsx`, `app/api/report/export/route.ts`: theo tên KPI mới (kế hoạch không liệt kê nhưng bắt buộc để biên dịch).
- `src/components/dashboard/OverviewWidgets.tsx`: chỉ đổi prop `month` thành `period` và tên trường KPI, không đổi bố cục.
- `src/components/dashboard/FilterBar.tsx`: import danh sách enum từ `overview-params` (không đổi giao diện).
- `app/[locale]/(app)/overview/page.tsx`: `parsePeriod` + `parseDashboardFilters`, cùng một object `period`/`filters` truyền xuống mọi widget; `requireUser` vẫn là lời gọi đầu tiên sau `getLocale()`.
- `app/api/export/route.ts`: dùng `parsePeriod` + `parseDashboardFilters`, `?month=abc` hay `?from=rác` không ném lỗi.
- `src/lib/overview-params.ts` + `.test.ts` (mới): validate bộ lọc cho khoá cache.
- `scripts/perf/bench-data.ts`: gọi theo chữ ký mới.
- Test cũ đã chuyển sang chữ ký/ngữ nghĩa mới: `queries.test.ts`, `queries-independent.test.ts`, `queries-n1.test.ts`, `queries-request-memo.test.ts`, `overdue-scorecard.test.ts`, `overview-finance-gate.test.ts`, `top-priority-mask.qa.test.ts`, `top-priority-queries.test.ts`, `report-export-route.test.ts`, `export-finance-gate.test.ts`, `finance-gate-pages.test.ts`, `operation-pages-render.test.ts`, `finance-gate.test.ts`.
- Không xoá ca kiểm quyền hay che tiền nào.

### E1, E2
- `src/i18n/messages/vi.json`, `en.json` (file nóng): thêm cuối file các nhóm `period`, `filterChip`, `asOf`, `kpiGroup`, `scheduleGapSentence`, `chartHowTo`, `helpTip` (đủ 13 chuỗi `ov*` và 11 chuỗi `dt*`), `backfill`.
- Đổi tên đã duyệt, giữ nguyên tên key: `kpi.totalProjects`, `kpi.backlog`, `detail.sCurve12`, `detail.spiCpi12`.
- `src/i18n/messages-p4.test.ts` (mới): 4 ca (cùng tập key vi/en, đủ chuỗi "?", không dấu gạch dài, đổi tên đúng).

### E3
- `src/components/ui/HelpTip.tsx`: bấm mở/đóng, `aria-expanded`, đóng khi bấm lại, Escape, bấm ra ngoài, mất focus; hover/focus cũ vẫn chạy; nâng z-index thẻ chứa lúc mở.
- `src/lib/tooltip-position.ts`: thêm `openBubbleStyle` (style inline lúc mở, không sửa `globals.css`).
- `src/components/dashboard/KpiCard.tsx`: prop `help?: { text; label }` render `HelpTip` ngay sau nhãn `.lb`, mở `overflow` của thẻ khi có help.
- Test: `HelpTip.test.ts`, `KpiCard.test.ts` (3 ca mới), `tooltip-position.test.ts` (2 ca mới), `e2e/31-help-tip.spec.ts`.

## 3. Bằng chứng

### Test đỏ B1 (trước khi sửa `queries.ts`)
- `npx vitest run src/server/queries-period.test.ts` cho `Tests 17 failed | 1 passed (18)`.
- L-1a: `expected 0.7087912087912088 to be close to 0.2445054945054945` (code cũ tính %KH tại hôm nay).
- L-1b: `expected 'risk' to be 'none'`.
- L-1c: `expected 'Dang_trien_khai' to be 'Hoan_thanh'`.
- L-2: `expected [ ... 12 điểm ] to have a length of 1 but got 12`.
- L-3a: `expected +0 to be 0.45`.
- F-2: `expected [ '2025-10', '2025-11', ...(10) ] to deeply equal [ '2026-06', '2026-07', '2026-08' ]`.
- Công suất: `expected 100 to be 300`.
- Ca L-1d vốn đúng với code cũ (B chưa xong tại 03/2026) nên xanh ngay từ đầu, dùng làm ca đối chứng.
- Sau B2: 18/18 xanh.

### EXPLAIN của `readFactSnapshotsAsOf` trên DB `_c`
```
Nested Loop (Cost: 0.27..37.74) [Rows: 17]
  -> Seq Scan on dim_project (Cost: 0.00..1.17) Filter: "isActive"
  -> Limit (Cost: 0.27..2.13) [Rows: 1]
    -> Index Scan (Cost: 0.27..20.74) on fact_progress_monthly [Rows: 11]
```
- Lấy bằng `explain_query` không `ANALYZE` (công cụ báo lỗi khi bật ANALYZE), nên là kế hoạch ước lượng, không phải số đo thật.
- Bảng `dim_project` chỉ 17 dòng nên Seq Scan là hợp lý, phần trong LATERAL dùng Index Scan.

### Parity mock và Postgres
- `npx tsx scripts/check-read-parity.ts` trên DB `_c`: cả 7 hàm mới (11 lời gọi) đều `[OK]`.
- Script vẫn báo lệch ở 3 hàm CŨ (`readManpowerWeekly(1)`, `readManpowerRange(1)`, `readManpowerActualByMonth(1)`) vì DB `_c` có nhân lực tới 29/09/2026 còn seed mock dừng ở 16/09/2026.
- Đã xác nhận lệch này có sẵn từ trước khi sửa (chạy lại script với thay đổi được stash: vẫn 4 lệch).

## 4. Điểm lệch so với kế hoạch và lý do

- `previousPeriod`: ví dụ trong kế hoạch ghi kỳ `2026-07-01..2026-09-30` có kỳ trước là `2026-04-01..2026-06-30`, nhưng kỳ đó chỉ 91 ngày, còn công thức trong kế hoạch (cùng số ngày) cho `2026-03-31..2026-06-30`.
  Đã theo công thức (Q2 = cùng độ dài), test ghi rõ.
- Biểu đồ S-curve và SPI/CPI chỉ vẽ các tháng của kỳ tới tháng mốc (không vẽ tháng sau mốc), vì số tháng tương lai không tồn tại, chỉ là số cũ lặp lại.
  Kỳ mặc định và mọi kỳ kết thúc trước hôm nay không bị ảnh hưởng.
- Thêm `getAllProjectSummaries(period)`: trang Báo cáo (`/report`, kế hoạch không nhắc) đang liệt kê MỌI dự án đang hoạt động (test cũ khẳng định 17 dòng).
  Nếu dùng `getProjectSummaries` thì bảng chỉ còn 10 dự án thuộc kỳ.
  Hệ quả cần chủ dự án quyết: thẻ KPI "Dự án trong kỳ" của trang Báo cáo đếm dự án thuộc kỳ (10) trong khi bảng bên dưới liệt kê cả danh mục (17).
- Đổi thêm `overview.spiCpiTrend` bỏ chữ "(6 tháng)" (vi và en), ngoài danh sách đổi tên của kế hoạch, vì chart nay theo kỳ (F-2).
  Chart vẫn `.slice(-6)` trong `SpiCpiCard` cho tới Task C3 (kế hoạch giao C3 bỏ dòng đó).
- Đã xoá 3 ca kiểm `readMonthlyEvm` trong `read-mock.test.ts` và `read-prisma.test.ts` cùng với hàm (kế hoạch yêu cầu xoá hàm khi không còn nơi gọi).
- Viết lại `queries.test.ts`, `queries-independent.test.ts`, `overdue-scorecard.test.ts`: các ca tháng `'all'`, tháng rác, "tháng sau tháng cuối seed" kiểm hành vi bản cũ đã bị kế hoạch loại bỏ (L-4); thay bằng ca tương ứng theo kỳ, giữ ca sad-path (groupKey lạ, getMissingMonth, id không tồn tại).
- Chưa cập nhật `D:\_project\DDC_dieu-phoi\phien-C.md` vì nằm ngoài worktree, người điều phối cần ghi.
- Trong khoảng B2 giao diện Tổng quan tạm có hành vi lệch chưa sửa (sẽ sửa ở C1, C2): ô chọn tháng của `FilterBar` vẫn còn (chọn "Tất cả" rơi về kỳ mặc định 12 tháng), ô chọn tháng hiển thị tháng hiện tại khi URL không có `month` dù dữ liệu là 12 tháng gần nhất, nhãn delta vẫn ghi "so tháng trước".

## 5. Chỗ Tester nên soi kỹ

- Mọi số tồn ở Tổng quan nay theo mốc `min(cuối kỳ, hôm nay)`: thử kỳ quá khứ (vd 03/2026), kỳ có tháng thiếu số (dự án mang số tháng trước), kỳ tương lai, kỳ 1 ngày.
- URL cũ `?month=all`, `?month=abc`, `?from=rác&to=rác` phải mở được và rơi về kỳ mặc định.
- Ngày dự án từ Postgres là ISO đầy đủ (`...T00:00:00.000Z`), mock là `YYYY-MM-DD`: mọi phép so ngày ở `queries.ts` dùng `slice(0,10)`, cần kiểm trên DB thật (dự án có ngày thực tế đúng bằng ngày mốc).
- `getProjectSummary` (trang Chi tiết) nay tính %KH, nguy cơ phạt, trạng thái tại cuối tháng đang xem thay vì hôm nay: xem tháng cũ sẽ khác trước.
- KPI "HĐ chưa khởi công" không phụ thuộc kỳ nhưng vẫn theo bộ lọc; delta của nó và của doanh thu/sản lượng là so kỳ trước cùng độ dài.
- Cache: mọi loader gắn `trendTag`, lưu số tháng/nhập Excel đã `revalidateTag(trendTag)` nên phải làm mới; kiểm bằng cách lưu số rồi tải lại Tổng quan.
- `HelpTip`: thử trên điện thoại thật hoặc giả lập cảm ứng (bấm, bấm lại, bấm ngoài, Escape), thử "?" trong thẻ có `href` (không được điều hướng).
- Trang Báo cáo: KPI dùng tên mới, bảng liệt kê cả danh mục (xem mục 4).

## 6. Kết quả kiểm

- `npx tsc --noEmit`: sạch (không lỗi).
- `npm test` (vitest run): 282 file xanh, 3 file bỏ qua; 3299 test xanh, 40 test bỏ qua (3339 tổng).
- 40 test bỏ qua là các test real-db cần `DATABASE_URL`, trong đó `read-period-real-db.test.ts` (9 ca) đã chạy riêng với `DATABASE_URL` của DB `_c`: 9/9 xanh, xong dọn sạch dữ liệu `test-p4-`.
- Không có script lint trong `package.json` nên bỏ qua bước lint.
- e2e (dev server cổng 3003, DB `_c`): `31-help-tip` 2 ca xanh ở 390px cảm ứng; `02-overview`, `03-project-detail`, `08-finance-gate`, `09-chan-chua-dang-nhap`, `11-tong-quan-sidebar-du-an`, `27-csp-vi-pham` xanh (65 test cả lượt, gồm 3 bước đăng nhập setup); URL `?month=all` mở được.
- Lưu ý: `global-setup` của e2e tự seed lại DB `_c` mỗi lần chạy (17 dự án), là hành vi có sẵn của repo.
- Chưa chạy e2e toàn bộ (theo yêu cầu đợt này).

---

# P4 - Thay đổi đợt 2 (Nhóm C, D và R1)

Nhánh `feature/p4-logic-bo-loc`, tài khoản C, DB `ddc_control_tower_c`, dev server cổng 3003.
Phạm vi đợt này: R1, C1, C2, C3, C4, D1, D2, D3, D4.
Chưa làm F, G.
Không sửa `vi.json`, `en.json`, `actions.ts`, `prisma-repo.ts`, `schema.prisma`, `globals.css`.

## 1. Commit đợt 2

- `38e59c7` fix(p4-r1): trang Báo cáo chỉ liệt kê dự án trong kỳ, bỏ `getAllProjectSummaries`.
- C1: thanh lọc theo kỳ ngày-ngày, chip tên chiều lọc, chip "Từ biểu đồ", dòng tóm tắt kỳ, đếm "n / total dự án".
- C2: KPI hai nhóm có tiêu đề, hai thẻ mới (doanh thu, sản lượng trong kỳ), dấu "?" từng thẻ.
- C3: chart theo kỳ, đoạn nét đứt cho tháng mang số, dòng "Cách đọc", nhãn đơn vị trục, công suất theo kỳ.
- C4: cột "Số liệu" ở bảng dự án, link Tổng quan sang Chi tiết giữ kỳ.
- D1: nguồn lực theo ngày chọn, bỏ cửa sổ 180 ngày.
- D2 đến D4: trang Chi tiết theo mốc tháng và kỳ, điều hướng tuần, dòng "Số tại", câu chậm/nhanh một câu, vạch mốc, Brush.
- Hash chi tiết xem `git log feature/p4-logic-bo-loc` (mỗi task một commit `feat(p4-c1)` ... `feat(p4-d2-d4)`).

## 2. File đã sửa và để làm gì

### R1
- `src/server/report.ts`: bảng dự án lấy từ `getProjectSummaries(period, {})`, cùng tập với thẻ "Dự án trong kỳ".
- `src/server/queries.ts` (file nóng): xoá `getAllProjectSummaries` (không còn nơi dùng).
- `src/server/report-export-route.test.ts`: ca cũ khẳng định số dòng bằng toàn bộ dự án (17) đổi thành khẳng định số dòng bằng số dự án trong kỳ.

### C1
- `src/components/dashboard/FilterBar.tsx`: bỏ ô chọn tháng và lựa chọn "Tất cả"; thêm 2 ô ngày, "?" của kỳ, chip "Tên chiều: giá trị", chip "Từ biểu đồ", nút "Xoá tất cả lọc" (giữ kỳ), đếm "n / total dự án", dòng tóm tắt kỳ.
- `src/components/dashboard/OverviewWidgets.tsx`: thêm `FilterBarSection` (server) để đọc số đếm, thanh lọc không chặn phần còn lại của trang.
- `src/server/queries.ts` (file nóng): thêm `getProjectCounts`; `src/server/cache.ts`: thêm `loadProjectCounts`.
- `src/lib/period-format.ts` (mới): `formatMonthShort`, `formatMonthRange`.
- `app/[locale]/(app)/overview/page.tsx`: dùng `FilterBarSection`.

### C2
- `OverviewWidgets.tsx` `KpiGrid`: nhóm "Đang thế nào?" (6 thẻ, thẻ HĐ chưa khởi công chỉ với người xem tiền) và nhóm "Làm được bao nhiêu trong kỳ?" (doanh thu chỉ với người xem tiền, sản lượng).
- Thẻ "Đang triển khai" có dòng diễn giải "trên N dự án trong kỳ"; mọi delta ghi "so với kỳ trước cùng độ dài".
- `KpiCard.tsx`: dòng delta cho phép xuống dòng thay vì cắt "..." ở thẻ hẹp.
- `HelpTip.tsx`: prop `onDark` để dấu "?" đọc được trên thẻ hero nền navy.

### C3
- `src/lib/carried-segments.ts` (mới): tách đoạn nét liền/nét đứt và thêm cột dữ liệu theo đoạn.
- `src/components/dashboard/charts.tsx`: `SCurve` (nay là `ComposedChart`) và `SpiCpiLine` nhận `markerMonth`, vẽ đoạn nét đứt, tooltip ghi "N dự án dùng số tháng trước", nhãn đơn vị trục, `Brush` khi từ 13 điểm trở lên.
- `OverviewWidgets.tsx`: bỏ `.slice(-6)`, dòng "Cách đọc", "?" và phụ đề khoảng tháng đang vẽ, ghi chú "Kỳ chỉ có 1 tháng".

### C4
- `src/lib/data-state-label.ts` (mới) và `ProjectTable.tsx`: cột "Số liệu" sau cột "% TT".
- `ProjectTable.tsx`, `TopPriorityList.tsx`: link sang `/projects/<id>?from=..&to=..`, nội dung thẻ Top không đổi.
- `src/lib/finance-gate.test.ts`: ca chứng minh `dataState` không bị che.

### D1
- `src/server/project-queries.ts` (file nóng): `getResourceSnapshot`, `getResourceBreakdown`, `getWeeklyTracking` nhận ngày cụ thể, ngày không có số thì lấy ngày gần nhất trước đó (`readLastDailyDate`), không còn cửa sổ 180 ngày; xoá `resourceWindow`; `getManpowerDaily(projectId, from, to)`.
- Ngày rác, ngày không tồn tại hoặc ngày tương lai rơi về hôm nay.
- `src/server/project-queries.test.ts`: viết lại các ca theo chữ ký mới, thêm ca ngày cách 200 ngày, ngày trống, ngày rác.

### D2
- `src/lib/detail-time.ts` (mới): `resolveDetailTime` (kỳ mặc định cả vòng đời, mốc mặc định là tháng gần nhất có số, kẹp `month` và `day` vào kỳ, giá trị rác về mặc định).
- `app/[locale]/(app)/projects/[id]/page.tsx`: `requireUser`, kiểm id, `requireProjectRead`, `getProject`, `getFacts`, `resolveDetailTime`, rồi `Promise.all` phần còn lại; chuỗi giá trị theo `readValueChainAsOf`, so sánh hạng mục theo tháng nguồn của chuỗi; S-curve và SPI/CPI theo kỳ với số mang sang; bảng tài chính theo kỳ tới mốc (mới nhất trước, cuộn khi dài); What-if và khâu nghẽn dùng dòng tại mốc.

### D3
- `src/components/project/DetailTimeBar.tsx` (mới): "‹ tháng ›" và hai ô ngày, chip "Dùng số tháng ..." khi mốc lớn hơn tháng có số cuối.
- `src/components/project/ResourceDayNav.tsx` (mới): "Tuần trước, ô ngày, Tuần sau", không vượt cuối kỳ hoặc hôm nay.
- Trang Chi tiết: dòng "Số tại ..." trên thẻ %KH, %TT, SPI, CPI, phụ đề "Số ngày ..." trên hai bảng nguồn lực, phụ đề trên thẻ chuỗi giá trị và tài chính, "?" từng thẻ.
- Thẻ %TT và chân timeline dùng chung một câu "Chậm N ngày (x điểm %)".

### D4
- `ManpowerMonthChart.tsx` và `WeeklyManpowerStackChart.tsx`: prop `markerMonth` (vạch đỏ nét đứt); ô chọn tháng trong chart tuần vẫn giữ, mặc định theo mốc.
- `charts.tsx`: vạch mốc cho S-curve và SPI/CPI.

### Test và e2e
- Test đơn vị mới hoặc cập nhật: `carried-segments`, `data-state-label`, `period-format`, `detail-time`, `queries-period` (thêm ca đếm), `project-queries`, `projects-detail-page-*` (mock hai component mới, thêm ca `from/to/day` rác), `TopPriorityList` (link giữ kỳ).
- e2e mới: `e2e/32-loc-ky.spec.ts`, `e2e/33-chi-tiet-moc.spec.ts`.
- e2e cập nhật: `02-overview`, `08-finance-gate`, `11-tong-quan-sidebar-du-an` (nhãn thẻ nay có dấu "?").

## 3. Điểm lệch so với kế hoạch và lý do

- Trang Chi tiết dùng `readFactSnapshots`-độc lập nên `getFacts` được đọc trước `Promise.all` (mốc mặc định phụ thuộc số của dự án); phần còn lại vẫn gom `Promise.all`.
- Đoạn nét đứt vẽ bằng nhiều `Line` (mỗi đoạn một cột `${key}_r${n}`) chứ không phải một `Line` phụ, vì Recharts không đổi nét giữa chừng; đường đầy đủ vẫn còn (ẩn nét) để giữ chú giải, tooltip, nhãn.
- Đoạn mang số của AC dùng nét "2 3" (AC vốn đã đứt "5 4").
- Ở Chi tiết, chart theo kỳ vẽ nét liền (số mang sang không tô nét đứt) vì dự án đã kết thúc sẽ có đoạn đứt kéo dài nhiễu.
- Thẻ "Sản lượng vs công suất": tiêu đề ghi số tháng bằng dòng `Tháng mm/yyyy - mm/yyyy` đặt ở dòng "Cách đọc" (đặt ở phụ đề thì dấu "?" bị xuống dòng lẻ).
- Chưa dùng được các chuỗi sau vì kế hoạch không giao chỗ đặt: `helpTip.dtBottleneck`, `helpTip.dtMobilization`, `helpTip.ovSpiCpi` chỉ dùng chung cho SPI/CPI dự án.
- Tên thẻ `overview.backlogOverdue` vẫn là "Backlog & Công nợ quá hạn": D-6 yêu cầu đổi tên cả thẻ này nhưng key này không nằm trong danh sách đổi tên đợt 1 và tôi không được sửa `vi.json`/`en.json`; xin đợt sau (bên giữ i18n) đổi thành "HĐ chưa khởi công & Công nợ quá hạn".
- Trước đây `.bangiao/thay-doi.md` ghi "hành vi tạm" của C1/C2 (ô tháng còn, nhãn "so tháng trước"): đã sửa hết.
- Dòng Co-Authored-By dùng đúng attribution của hệ thống (Claude Sonnet 5.5), khác `Claude Opus 5.5` trong lệnh giao việc.

## 4. Chỗ Tester nên soi kỹ

- Kỳ cắt ngang tháng, kỳ 1 ngày, kỳ tương lai: dòng tóm tắt kỳ ghi đúng, KPI và chart không lỗi.
- `?month=all`, `?from=rác`, `?day=2026-02-30`, `?month=9999-12` ở cả Tổng quan và Chi tiết phải mở được.
- Link từ Tổng quan sang Chi tiết giữ `from/to`; đổi tháng mốc ở Chi tiết bỏ `day`.
- Ngày nguồn lực chọn chưa có số: nhãn "Số ngày ..." phải là ngày thật của số đang hiện.
- Nhân lực và thiết bị nhập lệch ngày: mỗi bảng ghi ngày của chính nó.
- Người xem không có quyền tiền: không thấy thẻ doanh thu, HĐ chưa khởi công, S-curve, bảng tài chính (đã kiểm ở e2e 08).
- Dấu "?" trong thẻ có `href` (nhân lực, thiết bị) không được điều hướng khi bấm.
- Số liệu nhân lực ở seed DB `_c` nhiều tháng cũ không có nên mở `?month=2026-08` thấy trống là đúng.

## 5. Kết quả kiểm đợt 2

- `npx tsc --noEmit`: sạch.
- `npm test` (vitest run): 285 file xanh, 3 file bỏ qua; 3321 test xanh, 40 test bỏ qua (real-db cần `DATABASE_URL`), 0 đỏ.
- e2e toàn bộ (`npx playwright test`, cổng 3003, DB `_c`): 242 test xanh, 0 đỏ, 0 chập chờn, mất 18,4 phút.
- Ảnh chụp đã soi (1440 và 390, sáng và tối) ở `.bangiao/anh-p4/`: `tong-quan-*`, `full-*`, `kpi-*`, `chi-tiet-*`.
- Lệch pixel còn lại, chưa sửa vì cần sửa `globals.css` (không được phép): nhãn dài của thẻ KPI hẹp ("Tổng số nhân lực", "HĐ chưa khởi công") đẩy dấu "?" xuống dòng riêng ở 1440px.
- Chưa đo hiệu năng (Task G1) và chưa soi Nhập liệu, Hồ sơ dự án (thuộc nhóm F, G).

---

# P4 - Vòng sửa sau tester

Nhánh `feature/p4-logic-bo-loc`, tài khoản C, DB `ddc_control_tower_c`, dev server cổng 3003.
Nguồn: `.bangiao/ket-qua-test.md` (T-1 đến T-6) và các quyết định chốt của chủ dự án.
Skill đã dùng: `coding-standards`, `frontend-patterns`.
File nóng đã giữ: `app/globals.css`, `vi.json`, `en.json`, `queries.ts`. Không sửa `project-queries.ts`, `actions.ts`, `prisma-repo.ts`, `schema.prisma`; `queries.ts` cuối cùng không cần sửa.

## 1. Commit

- `0d1bf85` fix(p4-t1): `groupKey` chỉ giữ khi `groupBy` hợp lệ và thuộc tập nhóm thật.
- `309cac9` feat(p4-ngay): ô ngày riêng dd/mm/yyyy `DateField`, đổi tên thẻ `overview.backlogOverdue`.
- `1a9fd60` fix(p4-t2-t6): Báo cáo dùng chung kỳ với Tổng quan, export nhận kỳ, báo kỳ lỗi.
- fix(p4-t3): chuỗi giá trị hiện "-" khi mốc chưa có số.
- feat(p4-d10-ct): Chi tiết vẽ nét đứt cho tháng mang số sang.
- fix(p4-t4-t5): dấu "?", đơn vị tấn, nhãn trục X, thanh kỳ Chi tiết, timeline 390px.
- test(p4): e2e, chờ chart vẽ xong, `global-setup` chờ dev server; test(p4): `DateField data-ready`, chữ ký route export.

## 2. Từng mục và file

- T-1: `src/lib/overview-params.ts` (`parseDashboardFilters(sp, teamNames?)`: type/market theo enum, team theo tên team thật + "-" cho dự án chưa gán team, không thì bỏ `groupKey`). `overview/page.tsx` truyền `dims.teams` names. Route `/api/export` không dùng khoá cache nên không đổi. Test `cache-key.test.ts` (đỏ T-1 nay xanh, thêm ca team/type/market lạ), `overview-params.test.ts`.
- T-2: `src/server/report.ts` (`getReportData(period)`), `report/page.tsx` (đọc `from/to/month`, mặc định 12 tháng, dòng tóm tắt kỳ, nhãn delta "so với kỳ trước cùng độ dài", link export mang kỳ), `ReportPeriodBar.tsx` (mới), `app/api/report/export/route.ts` (nhận Request, kỳ giống trang, thêm dòng "Kỳ báo cáo" ở sheet KPI). Test cập nhật: `report-export-route`, `export-finance-gate`, `operation-pages-render` (ca kỳ, mặc định, rác), `finance-gate-pages`, `pages-role-guard`, `queries-n1`.
- T-3: `projects/[id]/page.tsx` (`noChain` -> "-" ở từng giai đoạn và tổng). Test `projects-detail-page-render`.
- T-4: `KpiCard.tsx` bọc 2 từ cuối của nhãn cùng "?" trong span `nowrap`. `globals.css`: `.kpi .vl` thêm `white-space:nowrap`.
- T-5: `KpiCard.tsx` prop `unit` (thẻ "Sản lượng trong kỳ": số + chữ "tấn" nhỏ, không xuống dòng, hai thẻ cùng cao). `charts.tsx` `GroupBar`: `interval=0`, xoay nhãn -35 độ khi mỗi cột dưới 72px (đo bằng `onResize`). `DetailTimeBar.tsx`: hai ô ngày là một khối, nhãn trên ô dưới. `PlanActualTimeline.tsx` + `globals.css`: dưới 560px nhãn xếp trên thanh (`--tl-off:0px`), chip % không đè chữ ngày.
- T-6: `period.ts` `parsePeriodChecked` (from/to/month có trên URL mà không dùng được thì `invalid`); Tổng quan, Chi tiết (`resolveDetailTime` trả `invalidPeriod`), Báo cáo hiện `<p class="hintline" data-testid="period-invalid">` với chuỗi `period.invalid`. Chi tiết chỉ xét `from/to`.
- Ô ngày riêng: `src/lib/date-input.ts` (`formatDmy`, `maskDmy`, `parseDmy`), `src/components/ui/DateField.tsx`. Ô chữ dd/mm/yyyy, tự chèn "/", bàn phím số, Enter hoặc rời ô để áp dụng, sai thì báo lỗi (`role="alert"`, `aria-invalid`, class `.inp.bad`), ngoài min/max cũng báo. Nút lịch là `input[type=date]` gốc trong suốt phủ lên biểu tượng nên chạm mở lịch gốc của điện thoại; không thêm thư viện. Dùng ở `FilterBar`, `DetailTimeBar`, `ReportPeriodBar`, `ResourceDayNav` (ô ngày nguồn lực Chi tiết). Key i18n mới cuối nhóm `period`: `dateInvalid`, `dateOutOfRange`, `datePlaceholder`, `pickDate`.
- Nét đứt ở Chi tiết: trang truyền `carriedProjects` (1 nếu tháng dùng số tháng trước) cho `SCurve`/`SpiCpiLine`, prop `single` để tooltip ghi "Dùng số tháng trước" (`asOf.carriedTipOne`, cuối nhóm `asOf`). Test mới `projects-detail-carried.test.ts`.
- D-6: `overview.backlogOverdue` vi "HĐ chưa khởi công & Công nợ quá hạn", en "Contracts not started & Overdue Receivables".
- e2e: `32`, `33` chờ chart vẽ xong qua `e2e/helpers/chart-ready.ts`, đổi sang ô ngày mới (thêm ca nhập sai, lịch, kỳ lỗi, Báo cáo chung kỳ, export, thanh kỳ 390px); `34` thêm ca T-3.
- Mục 11 (`10-ten-app` ERR_CONNECTION_REFUSED): `global-setup` chờ `${baseURL}/vi/login` sẵn sàng (`e2e/helpers/wait-server.ts` + test). Xem mục 3.

## 3. Điểm lệch và lưu ý

- Ô ngày ở Nhập liệu (`ResourceEntryPanel`, `ProjectForm`...) vẫn là `input[type=date]` gốc: ngoài phạm vi (thuộc nhóm F/Hồ sơ), tôi hiểu "ô chọn ngày nguồn lực" là `ResourceDayNav` ở Chi tiết.
- Mục 11: không tái hiện được. Webserver của Playwright chạy trước `global-setup`; chờ sẵn sàng chỉ chữa được trường hợp server đang khởi động hoặc biên dịch lại lúc bắt đầu. Nếu server chết giữa suite (nghi do tiến trình `next dev` cổng 3003 bị dừng ngoài ý muốn) thì không có cách chắc chắn ở phía test.
- `?month=all` (link cũ) nay hiện dòng "Kỳ không hợp lệ" vì là tham số kỳ không dùng được (theo T-6). Nếu chủ dự án muốn link cũ này im lặng thì nói.
- Export Excel: sheet KPI vẫn ghi nhãn cũ "Tổng số dự án" và "Backlog (tỷ)" (test hiện có khoá nhãn đó), chỉ thêm dòng "Kỳ báo cáo".
- `.kpi .vl` nowrap: giá trị quá dài sẽ bị cắt thay vì xuống dòng (đã kiểm 390px).

## 4. Chỗ Tester nên soi kỹ

- Ô ngày: gõ 8 chữ số liền, xoá lùi qua "/", dán "1/2/2026", năm ngoài 2000-2999, trình duyệt giao diện tiếng Anh (phải luôn dd/mm/yyyy), chạm lịch trên điện thoại thật (iOS Safari, Android Chrome), Tab/Enter bằng bàn phím.
- Ô ngày nguồn lực: ngày ngoài [đầu kỳ, mốc] báo lỗi khoảng hợp lệ; nút Tuần trước/sau vẫn hoạt động.
- Báo cáo: đổi kỳ thì thẻ và bảng khớp Tổng quan cùng kỳ; export mở được với kỳ rác.
- Chi tiết: dự án có tháng thiếu số (đoạn nét đứt và tooltip); tháng có số thật thì nét liền.
- 390px: thanh kỳ Chi tiết, timeline, nhãn trục X `GroupBar`, thẻ Doanh thu/Sản lượng cao bằng nhau; sáng/tối.
- `groupKey`: `?groupBy=team&groupKey=<tên có thật>` vẫn lọc; tên lạ bị bỏ.

## 5. Kết quả kiểm vòng sửa

- `npx tsc --noEmit`: sạch.
- `npm test`: 295 file xanh, 4 bỏ qua; 3438 test xanh, 47 bỏ qua, 0 đỏ (trước vòng sửa 3403 xanh, 1 đỏ).
- Real-db trên `ddc_control_tower_c` (set `DATABASE_URL`): 4 file, 46 test xanh.
- e2e toàn bộ (cổng 3003): 275 xanh, 2 đỏ, 14,0 phút. Hai ca đỏ là `28-kich-ban-load-test` (`api_health` admin: ECONNRESET; `overview_month` viewer: ECONNREFUSED ::1:3003). Chạy lại riêng `28` và `10-ten-app`: 21/21 xanh.
- Nguyên nhân hai ca đỏ và cả ca `10-ten-app` của tester (mục 11): tiến trình dev server cổng 3003 (PID 37212) có `StartTime` 23:28, tức bị dừng rồi khởi động lại trong lúc suite đang chạy (suite bắt đầu khoảng 23:19); tiến trình mới đang ở 2,3 GB bộ nhớ. Đây là lỗi môi trường (dev server tự chết/bị khởi động lại), không phải code P4. `global-setup` chờ sẵn sàng chỉ chữa được lúc bắt đầu suite. Đề xuất cho điều phối: chạy e2e trên `next start` (bản build) hoặc nâng `NODE_OPTIONS=--max-old-space-size` cho dev server cổng 3003 nếu còn tái diễn.
- Ảnh soi sau sửa: `.bangiao/anh-p4-sua/sau-{tq,ct,bc}-{1440,390}-{light,dark}.png` (12 ảnh) và `r1.png`, `r2.png` (Báo cáo). Đã soi: "?" không rớt dòng, hai thẻ Doanh thu/Sản lượng cùng cao, đủ 5 nhãn trục X ở 390px, thanh kỳ Chi tiết thẳng cột, timeline 390px không đè chữ, Báo cáo khớp Tổng quan (17, 15, 11).
- Không cập nhật `D:\_project\DDC_dieu-phoi\phien-C.md` (ngoài worktree), điều phối ghi.

---

# P4 - Thay đổi đợt 3 (Nhóm F: nhập bù lịch sử)

Coder đợt 3 bị ngắt giữa chừng; phiên này đọc lại toàn bộ code chưa commit, đối chiếu F2 đến F5, sửa chỗ thiếu rồi commit theo nhóm.
Các quyết định đã chốt: Q9 = b (luật tháng ở server), Q10 = a (không vượt khoá sổ), Q11 = a (chỉ admin), Q12 = b (tối đa 24 tháng, tự hết hạn 30 ngày), Q13 = a (không duyệt, chỉ nhật ký), D-24 (thẻ ở Hồ sơ dự án), D-25 (badge vàng ở Nhập liệu).

## 1. Commit đợt 3

- `914fdfb` (phiên trước): F1, bảng `project_backfill_window` (migration chỉ thêm bảng mới).
- `bfa61ec` F2: repo nhập bù (Prisma + mock), bộ ca dùng chung, khoá dòng dự án khi kiểm trùng khoảng.
- `c626c7b` F3 và F4: luật cửa sổ ngày, luật tháng ở server, bật/tắt chỉ admin, nhãn nhập bù ở `audit_log` và `activity_log`.
- `c354a16` F5: giao diện nhập bù, DateField mọi form, i18n, tài liệu, e2e `35-nhap-bu`.

## 2. File đã sửa và để làm gì

### F1 và F2 (repo)

- `prisma/schema.prisma`, `prisma/migrations/*_p4_backfill_window/`: bảng `project_backfill_window` (đã commit `914fdfb`, đã `migrate deploy` trên DB `_c`, `prisma generate` xong).
- `src/server/repo/prisma-repo-backfill.ts`: `readActiveBackfillWindows`, `listBackfillWindows`, `createBackfillWindow`, `disableBackfillWindow`. Tạo khoảng chạy trong 1 transaction: khoá dòng `dim_project` (`SELECT ... FOR UPDATE`), kiểm trùng khoảng đang hiệu lực, ghi khoảng, ghi `audit_log`. Tắt dùng `updateMany where disabledAt null` nên không race.
- `src/server/repo/mock-repo-backfill.ts`, `backfill-contract.ts`, `backfill-mock.test.ts`, `prisma-repo-backfill-real-db.test.ts`: bản mock và bộ ca dùng chung chạy trên cả mock và Postgres thật; thêm ca 3 lần tạo đồng thời cùng khoảng.
- `src/server/repo/index.ts`, `mock-repo.ts`, `types.ts`: gộp repo mới vào `repo`, kiểu `BackfillWindow`.
- `src/lib/schema-meta/docs.ts`, `docs/DATA_WAREHOUSE_README.md`: mô tả bảng và ERD (chạy lại `npm run docs:erd` cho ra đúng nội dung đã có, không lệch).

### F3 và F4 (luật và server action)

- `src/lib/backfill.ts` (+ test): hằng số Q12 (24 tháng, 30 ngày, ghi chú 5-500), `checkBackfillRange`, `backfillExpiresAt`, `backfillState`.
- `src/lib/daily-entry.ts` (+ test): `dailyDateWindow(role, today, backfill)` trả thêm `extra`, `isInWindow` nhận ngày trong khoảng, `isBackfillOnly` để gắn nhãn. Vẫn chặn ngày lớn hơn `max`; admin không đổi.
- `src/lib/daily-import.ts`: kiểu cửa sổ dùng `DailyWindow` (Excel ngày ngoài khoảng vẫn là `out_of_window` từng dòng).
- `src/lib/monthly-entry.ts` (+ test): `isMonthAllowed` (admin luôn được; data-entry chỉ tháng hiện tại, tháng trước, hoặc tháng giao 1 khoảng nhập bù), `isBackfillMonth`, `backfillMonths`.
- `src/server/actions-backfill.ts` (+ test): `enableBackfillAction`, `disableBackfillAction`, chỉ `requireRoleUser(['admin'])`, `projectId` số nguyên dương, ghi chú 5-500, `to <= hôm nay`, tối đa 24 tháng, `expiresAt` = bật + 30 ngày, ghi `activity_log`.
- `src/server/actions-entry.ts`: `checkDailyPayload` và `previewDailyImportAction` lấy khoảng đang bật (chỉ data-entry). Lần lưu chỉ hợp lệ nhờ nhập bù ghi `audit_log` (field `backfill`) và `activity_log` với action `save_daily_resources_backfill` hoặc `commit_daily_import_backfill`. Vẫn qua `requireWriteProject` trước, tháng khoá sổ vẫn `locked`.
- `src/server/actions.ts` (file nóng, đã giữ): `saveMonthlyData` chặn `out_of_window` theo `isMonthAllowed`; `commitImportAction` lọc từng dự án theo luật tháng (lỗi `out_of_window` từng dòng); nhãn `save_data_backfill`, `commit_import_backfill` và dòng `audit_log`.

### F5 (giao diện, tài liệu, e2e)

- `src/components/form/BackfillPanel.tsx`: thẻ "Nhập bù lịch sử" (D-24): danh sách khoảng đang bật + nút Tắt, form Từ ngày/Đến ngày/Ghi chú, lịch sử khoảng đã tắt hoặc hết hạn.
- `app/[locale]/(app)/ho-so-du-an/page.tsx`: render thẻ chỉ khi `user.role === 'admin'` và ở chế độ sửa.
- `app/[locale]/(app)/nhap-lieu/page.tsx`: danh sách tháng = `historyMonths()` cộng tháng giao khoảng nhập bù; cửa sổ ngày nhận khoảng; truyền `backfillRanges`.
- `src/components/form/DataEntryForm.tsx`: badge vàng "Đang nhập bù dd/mm/yyyy - dd/mm/yyyy" (D-25) và thông báo `out_of_window` cho tháng.
- `src/components/form/ResourceEntryPanel.tsx`: ô ngày dùng `DateField`, cho chọn tới ngày sớm nhất được phép (kể cả nhờ nhập bù).
- `src/components/form/ImportPanel.tsx`: kiểu lý do lỗi có thêm `out_of_window` (chữ hiển thị lấy từ `dataGuard.import.reason.out_of_window`).
- `src/components/ui/DateField.tsx`, `ProjectForm.tsx`, `KeyMilestoneEditor.tsx`, `EquipmentPlanEditor.tsx`: `DateField` áp cho mọi form nhập ngày (chốt sau tester): thêm `variant="form"`, `allowEmpty`, `invalid`.
- `src/i18n/messages/vi.json`, `en.json`: nhóm `backfill` (đủ 27 key, khớp vi/en), nhãn hoạt động (`activity`), `dataGuard.import.reason.out_of_window`.
- `src/server/ho-so-du-an-page-guard.test.ts`: mock `BackfillPanel` (client component cần provider i18n), thêm ca thẻ chỉ render cho admin ở chế độ sửa.
- `docs/huong-dan/nhap-bu-lich-su.md`: hướng dẫn admin bật/tắt, PIC chọn ngày/tháng, Excel, nhật ký.
- `e2e/35-nhap-bu.spec.ts`: luồng đầy đủ (admin bật, PIC lưu ngày cũ, audit_log + activity_log, PIC và viewer không thấy thẻ, admin tắt, ngày bị khoá lại).

## 3. Rà soát đối chiếu F2 đến F5 (phiên này) và điểm lệch

Đã đối chiếu từng mục, code phiên trước đã đủ: luật cửa sổ ngày (`extra`, vẫn chặn quá `max`), luật tháng (Q9 = b), audit_log + activity_log nhãn nhập bù (ngày, tháng, Excel), hết hạn 30 ngày, tối đa 24 tháng, kiểm trùng khoảng trong transaction, chỉ admin bật/tắt, data-entry không được gán vẫn `Forbidden` (test IDOR ở cả ngày và tháng), tháng khoá sổ vẫn `locked`, i18n vi/en cùng bộ key, badge D-25.
Phần thiếu hoặc sửa thêm:

- Kiểm trùng khoảng trong transaction READ COMMITTED không chặn được 2 admin bật cùng lúc: thêm khoá `FOR UPDATE` dòng `dim_project` đầu transaction. Ca 3 lần tạo đồng thời ở real-db xanh, nhưng KHÔNG đỏ khi tôi bỏ khoá thử (cửa sổ race quá hẹp trên máy này), nên ca này chỉ là kiểm khói, không chứng minh được khoá. Khoá đúng theo lý thuyết Postgres.
- `ImportPanel.tsx`: kiểu lý do lỗi thiếu `out_of_window` (chỉ là kiểu, chữ hiển thị đã có).
- `ho-so-du-an-page-guard.test.ts` đỏ (client component `BackfillPanel` cần provider i18n khi render tĩnh): mock component, thêm ca chỉ admin thấy thẻ.
- Tài liệu `docs/huong-dan/nhap-bu-lich-su.md` (chưa có), e2e `35-nhap-bu.spec.ts` (chưa có).
- Không cần sửa tay ERD: `npm run docs:erd` cho ra đúng nội dung đã có trong `docs/DATA_WAREHOUSE_README.md`.

Điểm lệch có chủ ý:

- Độ dài khoảng tính theo tháng LỊCH mà khoảng chạm tới (tối đa 24), không theo số ngày. Ví dụ 15/01/2024 đến 10/01/2026 chạm 25 tháng nên bị `too_long`, dù chưa đủ 24 tháng tròn. Chặt hơn một chút so với "24 tháng" nói chung; đổi sang theo ngày thì sửa `checkBackfillRange`.
- `expiresAt` = lúc bật + 30 ngày (mili giây), hết hạn là điều kiện đọc, không có job dọn.
- e2e: kế hoạch ghi tên `34-nhap-bu`, đã đổi thành `35-nhap-bu` (34 đã có `34-p4-bien`). Spec mở khoá tạm tháng của ngày cũ bằng Prisma (seed khoá sổ mọi tháng có số, mà nhập bù không vượt khoá sổ theo Q10) và trả nguyên `snapshotLockedAt` ở `afterAll`. Spec dọn khoảng nhập bù của dự án 1 ở `beforeAll`: DB `_c` được seed lại mỗi lần chạy nên không mất gì.
- `previewImportAction` (Excel tháng, bước xem trước) không tự báo `out_of_window` cho dự án ngoài khoảng: luật tháng chỉ áp ở `commitImportAction` (theo kế hoạch F4, "sau lọc owned"). Dòng bị chặn hiện ở phần `failed` sau khi lưu. Nếu chủ dự án muốn báo ngay ở bước xem trước thì nói.
- Các thư mục ảnh `.bangiao/anh-p3f`, `anh-p4`, `anh-p4-test` vẫn chưa commit (không thuộc nhóm F, không đụng).

## 4. Chỗ Tester nên soi kỹ

- Bảo mật: gọi trực tiếp `enableBackfillAction`/`disableBackfillAction` bằng tài khoản bod, viewer, data-entry (phải `Forbidden`); `projectId` âm, 0, số thực; khoảng chồng nhau; khoảng sang tương lai; chuỗi ngày rác.
- IDOR: PIC của dự án A khi admin bật nhập bù cho dự án B (PIC không được gán B) phải vẫn `Forbidden` ở lưu ngày, lưu tháng, commit Excel ngày, commit Excel tháng.
- Biên ngày: ngày đúng `from`, đúng `to`, hôm sau `to`, ngày trước `from`, ngày giữa 2 khoảng rời nhau, ngày quá `max` (hôm nay + 30) dù nằm trong khoảng.
- Biên tháng: tháng chỉ chạm 1 ngày của khoảng (ví dụ khoảng 31/03 đến 02/04 mở cả 03 và 04); "tháng trước" vào tháng 1 (12 năm trước); tháng tương lai với PIC bị chặn.
- Hết hạn: đổi `expiresAt` về quá khứ trong DB `_c`, PIC lưu ngày cũ phải `out_of_window`, danh sách trong Hồ sơ chuyển sang "Đã hết hạn".
- Khoá sổ: khoảng chạm tháng đã khoá, PIC lưu phải `locked`; admin mở khoá tháng thì lưu được.
- Nhật ký: Nhật ký thay đổi có dòng `enable`/`disable` (bảng `project_backfill_window`) và dòng `backfill` (bảng `fact_progress_monthly`, `fact_daily_resources`); Nhật ký hoạt động có nhãn tiếng Việt "(nhập bù)" và không để lộ key thô.
- Excel ngày có 1 dòng ngoài khoảng: xem trước báo `out_of_window` đúng dòng, dòng khác vẫn xem trước; commit bị chặn nếu có ngày ngoài khoảng.
- Excel tháng của PIC gồm 2 dự án, chỉ 1 dự án có khoảng nhập bù: dự án còn lại nằm ở `failed` với lý do "Tháng đã quá hạn nhập, cần admin bật nhập bù".
- Giao diện: thẻ "Nhập bù lịch sử" 1440px và 390px, sáng/tối, ô ngày dd/mm/yyyy (gõ tay, xoá trống, lịch gốc trên điện thoại), badge vàng ở Nhập liệu không rớt dòng; `DateField` mới ở Tạo/Sửa dự án (6 ngày + ngày ký HĐ), Mốc chính, Kế hoạch thiết bị: xoá trống một ngày rồi Lưu phải lưu là "chưa có ngày", không báo lỗi thừa.
- Đồng thời: 2 admin bật cùng khoảng cho cùng dự án trong cùng lúc chỉ được 1.

## 5. Kết quả kiểm đợt 3

- `npx tsc --noEmit`: sạch.
- `npm test` (không đặt `DATABASE_URL`): 304 file, 299 xanh, 5 bỏ qua; 3491 test xanh, 54 bỏ qua, 0 đỏ.
- `npx vitest run` với `DATABASE_URL` của DB `ddc_control_tower_c` (chạy cả các file real-db): 304 file xanh; 3544 test xanh, 1 bỏ qua, 0 đỏ. Riêng `prisma-repo-backfill-real-db.test.ts`: 7 test xanh (6 ca chung + 1 ca đồng thời).
- `npx prisma migrate status` trên `_c`: 14 migration, "Database schema is up to date"; `prisma generate` xong.
- e2e toàn bộ (cổng 3003, DB `_c`): 281 xanh, 0 đỏ, 12,5 phút (gồm `35-nhap-bu` 4 ca lúc đó). Sau đó thêm ca thứ 5 (ô ngày cho phép xoá trống) và chạy riêng `35-nhap-bu`: 5 ca xanh (cộng 3 ca setup, 8/8).
- Không có script `lint` trong `package.json`; không chạy build (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) ở đợt này, để nhóm G.
- Chưa kiểm bằng mắt pixel 1440/390 sáng/tối cho thẻ nhập bù và badge (thuộc Task G2, chưa chụp ảnh ở đợt này).
- Không cập nhật `PROGRESS.md`, `.serena/memories/`, `CHANGELOG`.

# P4 - Vòng sửa đợt 3 (coder sửa T-7, T-8, P-1, P-3 sau tester nhóm F + G)

Skill đã dùng: `coding-standards`, `frontend-patterns`.
Mỗi lỗi một commit, có test đỏ tái hiện chuyển xanh, không sửa hay nới test của tester (chỉ thêm ca).

## 1. Commit vòng sửa

- `d64a7b2` T-8: `src/components/ui/DateField.tsx`.
- `3a033dd` T-7: `src/lib/date-input.ts` + `src/lib/date-input.test.ts`.
- `4b4ea98` P-1: `src/components/form/BackfillPanel.tsx` + `e2e/37-p4-f-anh.spec.ts`.
- `6442540` P-3: `src/components/form/DataEntryForm.tsx` + `e2e/37-p4-f-anh.spec.ts`.

## 2. Đã sửa gì và vì sao

- T-8 (gốc): cờ `skipBlur` đặt lúc Enter nhưng Enter không làm ô mất tiêu điểm nên cờ không bao giờ reset và nuốt lần rời ô THẬT kế tiếp. Bỏ hẳn cờ (và import `useRef`). Không cần cờ vì `commit` idempotent: giá trị đã áp dụng thì `text === formatDmy(value)` nên blur không làm gì, giá trị sai thì blur báo lại đúng lỗi đó. Đỏ trước: 2 ca "(BUG T-8)" ở `e2e/36` (chạy lại trên bản cũ bằng `git stash`, đỏ đúng 2 ca). Xanh sau: 2 ca đó + cả `36` 16/16.
- T-7: `maskDmy` có thêm nhánh cho chuỗi đã có dấu phân tách `/`, `-`, `.` theo dạng `d/m/yyyy`: giữ đúng ý nghĩa, ngày hoặc tháng 1 chữ số mà đã có dấu theo sau thì đệm 0 (`1/2/2026` thành `01/02/2026`, năm cắt tối đa 4 chữ số). Không khớp dạng này (chữ lẫn vào, phần quá dài như `12/3456`, `1//`) thì rơi về nhánh cũ "chỉ giữ chữ số". 8 chữ số liền, gõ dần từng phím và xoá lùi qua "/" vẫn đúng. Đỏ trước: 2 ca "(BUG T-7)" ở `src/lib/date-input-tester.qa.test.ts` và 1 ca e2e. Xanh sau: cả 3 + thêm 18 ca mới ở `src/lib/date-input.test.ts` (bảng đầu vào/đầu ra, gõ từng phím, xoá lùi tới rỗng).
- P-1: tiêu đề "Nhập bù lịch sử" bị ép hẹp vì `.fsec>.h` xếp h4 và câu mô tả cạnh nhau. Sửa cục bộ ở `BackfillPanel.tsx` bằng style tại chỗ (cột dọc, `marginLeft: 0` cho mô tả), KHÔNG đụng `globals.css` (file nóng) và không đổi các `.fsec` khác. Giữ nguyên style kính mờ. Thêm kiểm pixel vào ca "Hồ sơ dự án (thẻ Nhập bù)" của `e2e/37`: tiêu đề cao dưới 1,5 dòng và câu mô tả nằm dưới tiêu đề. Đã chụp lại `.bangiao/anh-p4-f/hs-the-1440-light.png`, `hs-the-390-dark.png` (kèm 1440-dark, 390-light) và soi bằng mắt: tiêu đề một dòng ở cả hai cỡ, mô tả xuống dòng riêng, không tràn.
- P-3 (có sẵn từ trước, trang Nhập liệu bước Tiến độ tháng ở 390px): nhãn "Áp dụng" rớt 2 dòng và ô chọn dự án bị cắt "10626-00...". Sửa ở `DataEntryForm.tsx`: nhãn `whiteSpace: nowrap` + `flexShrink: 0`; ô chọn dự án `basis-full sm:basis-0` (từ 640px trở lên giữ nguyên như cũ; dưới 640px ô chiếm cả hàng dưới nhãn "Chọn dự án", hiện đủ "10626-008 - SVĐ PVF", ô chọn tháng và badge trạng thái xuống hàng kế). Thêm kiểm pixel vào ca "Nhập liệu bước Số liệu tháng" của `e2e/37`. Đã chụp lại `nl-thang-390-light.png` và soi bằng mắt. `globals.css` không đụng, nên không cần kiểm "Đang giữ" của A/B (cả hai không giữ file nóng nào lúc đọc).

## 3. P-2 (chỉ đánh giá, KHÔNG đổi giao diện, chờ chủ dự án duyệt)

- Chỗ duy nhất còn `input[type=month]` gốc: `src/components/form/ManpowerPlanEditor.tsx` dòng 183 (ô "Tháng" khi thêm dòng Kế hoạch nhân lực theo tháng).
- Trình duyệt hiện "January 2027" theo ngôn ngữ giao diện của trình duyệt, không theo ngôn ngữ app (cùng gốc với T-6 vòng trước, `DateField` đã giải quyết cho ô ngày).
- Đề xuất A (khuyến nghị): thay bằng hai ô chọn (Tháng 1-12 và Năm) hoặc một ô gõ `mm/yyyy` dạng `MonthField` cùng họ `DateField`, luôn tiếng Việt, cùng kiểu ô `.inp`. Ít rủi ro, không đổi bố cục thẻ.
- Đề xuất B: giữ `input[type=month]`, thêm chú thích định dạng. Rẻ nhưng vẫn hiện tiếng Anh.
- Chờ chủ dự án chọn. Đây là thay đổi giao diện nên không tự làm.

## 4. Chỗ Tester nên soi kỹ

- `DateField` sau khi bỏ `skipBlur`: mọi form dùng ô ngày (Sửa/Tạo dự án, Mốc chính, Kế hoạch thiết bị, ô kỳ ở Tổng quan/Chi tiết/Báo cáo, thẻ nhập bù, Nhập liệu ngày). Thử: Enter rồi Tab, Enter rồi bấm Lưu, Enter lỗi rồi sửa rồi Tab, chọn từ lịch gốc rồi rời ô, ô `allowEmpty` xoá trống rồi Tab.
- `maskDmy`: dán `1/2/2026`, `1-2-2026`, `1.2.2026`, `01/02/26`, chuỗi có chữ, chuỗi ISO `2026-02-01` (hành vi cũ, cố ý không đổi vì phần đầu có 4 chữ số, không phải d/m/yyyy), gõ tay từng phím và xoá lùi ở giữa chuỗi.
- Nhập liệu ở 390px: ô chọn dự án chiếm cả hàng; ở 640px đến 1100px giữ nguyên như cũ.
- Thẻ Nhập bù ở Hồ sơ dự án: tiêu đề và mô tả ở 390px, 1440px, sáng và tối.

## 5. Kết quả kiểm vòng sửa

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test` (không đặt `DATABASE_URL`): 308 file (301 xanh, 7 bỏ qua); 3644 test (3574 xanh, 70 bỏ qua), 0 đỏ. Mốc trước (tester): 3626 test; thêm 18 ca mới ở `date-input.test.ts` (16 bảng + 2 ca gõ phím/xoá lùi).
- `npx vitest run` với `DATABASE_URL` của DB `_c`: 308 file xanh; 3644 test (3643 xanh, 1 bỏ qua), 0 đỏ (2 ca T-7 đã xanh).
- e2e toàn bộ (`npx playwright test`, cổng 3003, DB `_c`, dev server chạy tay với `--max-old-space-size=6144`): 320 xanh (gồm 3 ca setup), 0 đỏ, 0 chập chờn, 19,8 phút. Trong đó `36-datefield-form` 13/13 (đủ 3 ca đỏ trước), `37-p4-f-anh` 28/28, `35-nhap-bu` xanh.
- Không chạy `npm run build` ở vòng này (không đụng cấu hình, CSS toàn cục hay route).
- Việc bỏ qua: chưa kiểm chạm lịch gốc trên điện thoại thật, chưa kiểm trình duyệt giao diện tiếng Anh (như tester đã ghi). Ảnh `.bangiao/anh-p4-f/` vẫn chưa commit như các thư mục ảnh trước.
- Không cập nhật `PROGRESS.md`, `.serena/memories/`, `CHANGELOG`. Không push.

## 6. Vòng sửa sau reviewer và security-reviewer (C-1..C-4, N-2..N-4, NIT, S-1..S-3)

Mỗi mục là một commit riêng, có test kèm theo, nhánh `feature/p4-logic-bo-loc`.

- C-1 `d79ec36`: `?month=all` cũ về kỳ mặc định im lặng, không hiện "Kỳ không hợp lệ"; `?month=abc` vẫn báo.
- C-2 `d840f95`: nhãn Excel xuất Báo cáo khớp màn hình ("Dự án trong kỳ", "HĐ chưa khởi công (tỷ)").
- C-3 `96e0d37`: `getProjectSummary` nhận ngày mốc trần của kỳ, nên Chi tiết và Tổng quan cùng ra `pctPlan`, trạng thái, nguy cơ phạt khi kỳ kết thúc giữa tháng.
- C-4 `738deb7`: gắn dấu "?" cho "Khâu nghẽn" và "Huy động nguồn lực" ở Chi tiết, không đổi bố cục.
- N-2 `f8ab0ca`: Nhập liệu với `data-entry` chỉ liệt kê tháng mà server cho phép; admin vẫn 12 tháng.
- N-3 `bd41aa2`: công suất kỳ chỉ nhân số tháng tới tháng mốc, không tính tháng sau hôm nay.
- N-4 `ec069aa`: delta KPI so kỳ trước xét theo tập đã lọc; không có số trong tập đã lọc thì delta là null.
- NIT `a064a99`: chú giải chart công suất dùng i18n (`vi.json`, `en.json`, file nóng, đã giữ và nhả).
- NIT `7f4523d`: khoá dòng `dim_project` khi bật nhập bù chỉ áp cho dự án đang hoạt động; dự án ngừng hoạt động trả `not_found`.
- S-2 `df3804e`: `/api/report/export` có rate limit theo IP như `/api/export`, trả 429 kèm `Retry-After`.
- S-1 `4485335`: chỉ kỳ mặc định và kỳ trọn tháng trong 24 tháng gần đây (`isCacheablePeriod`, `src/lib/period.ts`) mới ghi `unstable_cache`; kỳ tuỳ ý và ô tìm kiếm chỉ dùng React `cache` theo request.
- S-1 (tiếp): `parseDashboardFilters(sp, dims)` đối chiếu `team` và `customer` với id thật trong dims, id lạ về `all`; `/api/export` không truyền dims nên chỉ kiểm dạng số (route đó không dùng khoá cache).
- S-3 `c912734`: `recordId` nhật ký bật/tắt nhập bù đổi từ `<id khoảng>` sang `<projectId>/<id khoảng>`; `readProjectAuditTrail` (prisma và mock) lấy thêm bảng `project_backfill_window`; thêm nhãn `projectForm.audit.tbl.project_backfill_window` ở `vi.json`, `en.json`, `ho-so-du-an/page.tsx`.
- S-3 (tiếp): dòng audit cũ (nếu có trên DB đã bật nhập bù) vẫn nằm ở nhật ký toàn hệ thống nhưng không hiện ở thẻ dự án; chỉ có ở DB dev, chưa go-live nên không viết migration dữ liệu.
- S-3 phần nhãn "nhập bù" ghi ngoài transaction lưu số: CHẤP NHẬN theo đề xuất của security (số cũ/mới vẫn có audit riêng trong transaction); ghi rõ ở đây, không đổi code.
- S-4: chấp nhận theo security (cửa sổ vài mili giây, có audit, tháng khoá sổ vẫn chặn).

Chưa làm, chờ chủ dự án: N-1 (mốc mặc định của Chi tiết), P-2 (`MonthField`), và các mục 1, 3, 5 ở `danh-gia.md` mục 6.

Kết quả kiểm sau vòng sửa mục 6: `npx tsc --noEmit` sạch; `npx vitest run` với `DATABASE_URL` của DB `_c`: 309 file xanh, 3697 test xanh, 1 bỏ qua, 0 đỏ.
Chưa chạy lại e2e toàn bộ và build ở vòng này (S-3 đổi `recordId` nên `e2e/35-nhap-bu` cần tester chạy lại).

## 7. Vòng sửa sau khi chủ dự án duyệt N-1, P-2 và NIT (2026-09-30 tối)

Skill đã dùng: `coding-standards`, `frontend-patterns`, `test-driven-development`.
Mỗi việc một commit, test đỏ trước rồi mới sửa. Nhánh `feature/p4-logic-bo-loc`, chưa push.

### 7.1 Commit

- `a6286d0` N-1: `src/lib/detail-time.ts`, `src/lib/detail-time.test.ts`, `src/server/queries-period.test.ts`, `e2e/33-chi-tiet-moc.spec.ts`, chú thích ở `app/[locale]/(app)/projects/[id]/page.tsx`.
- `74a5ca1` P-2: `src/components/ui/MonthField.tsx` (mới), `src/lib/date-input.ts` (+ `formatMy`, `maskMy`, `parseMy`), `src/components/form/ManpowerPlanEditor.tsx`, `src/i18n/messages/vi.json` + `en.json` (nhóm mới `monthField` ở cuối file), test, `e2e/40-monthfield.spec.ts`.
- `d20903b` NIT: `src/components/dashboard/OverviewWidgets.tsx`, `chartHowTo.capacity` ở `vi.json` + `en.json`, `src/components/dashboard/CapacityCard.test.ts` (mới).
- Hồ sơ: mục này và mục 10.4 của `ket-qua-test.md` (ca "unique key" nay xanh sau `07da17a`).

### 7.2 Đã sửa gì và vì sao

- N-1: `resolveDetailTime` mặc định `asOfMonth = capMonth` (tháng chứa `min(cuối kỳ, hôm nay)`, tức tháng hiện tại với kỳ mặc định), không còn `lastDataMonth`. Tháng đó chưa có số thì mang số tháng trước sang (đã có sẵn ở `pickAsOf`, `readValueChainAsOf`), nên %KH, trạng thái, nguy cơ phạt ở Chi tiết cùng một số với dòng dự án ở Tổng quan (tính tại hôm nay). Kỳ kết thúc trước tháng hiện tại thì mốc = tháng cuối kỳ (không vượt cuối kỳ). `lastDataMonth` vẫn được trả về nên `DetailTimeBar` vẫn hiện chip nét vàng "Dùng số tháng mm/yyyy" khi mốc lớn hơn tháng có số gần nhất. Ngày nguồn lực mặc định giờ là `min(cuối tháng mốc, cuối kỳ hôm nay)`, tức hôm nay với kỳ mặc định (trước là cuối tháng có số gần nhất). Không đổi chart/KPI khác: mọi chỗ khác chỉ đọc `asOfMonth` đã giải quyết.
- Đỏ trước của N-1: 6 ca (4 ở `detail-time.test.ts`, 2 ở `queries-period.test.ts`), báo mốc `2026-06` thay vì `2026-09`. Ca so sánh mới ở `queries-period.test.ts` so Chi tiết với Tổng quan cho dự án A (có số tháng hiện tại) và dự án B (chỉ có số tới 06, đang mang số) trên status, `pctActual`, `pctPlan`, `penalty`, `onTrack`, `dataState`.
- P-2: `MonthField` mm/yyyy cùng họ `DateField`: gõ được (tự chèn "/", chấp nhận `9/2026`, `9-2026`, `092026`), Enter hoặc rời ô để áp dụng, sai báo lỗi (`monthField.invalid`, theo ngôn ngữ ứng dụng vi/en), `data-ready` cho e2e, `aria-invalid`, `role="alert"`. Nút lịch là `input[type=month]` gốc trong suốt, chỉ bật khi trình duyệt hỗ trợ (dò lúc mount), nên Firefox/Safari desktop chỉ còn gõ. Đã grep: `ManpowerPlanEditor` là chỗ duy nhất còn `input[type=month]`. Không đụng `app/globals.css` (dùng class `.inp`, `.hintline` có sẵn). Key i18n mới nằm trong nhóm `monthField` thêm vào CUỐI `vi.json`/`en.json`, không chèn giữa key có sẵn.
- NIT: thẻ công suất ở Tổng quan ghi "Cách đọc" với khoảng tháng chỉ tới tháng mốc (`periodAsOfMonth`), kỳ bắt đầu sau hôm nay (không có tháng nào tới mốc) thì không ghi khoảng tháng (trước khi vá dòng này ném lỗi `undefined.slice`, test đỏ bắt được). Chữ `chartHowTo.capacity` (vi + en) nói rõ sản lượng tính từ đầu kỳ tới tháng mốc và tháng sau hôm nay chưa tính.

### 7.3 Điểm lệch và lưu ý

- Ô nhập ngày nguồn lực mặc định ở Chi tiết đổi theo N-1 (hôm nay thay vì cuối tháng có số gần nhất). Đây là hệ quả trực tiếp của mốc mới; nếu chủ dự án muốn giữ cuối tháng có số thì phải tách ngày khỏi mốc.
- `MonthField` không có `min/max` và không có `allowEmpty` (YAGNI: chỗ dùng duy nhất không cần). Thêm khi có chỗ dùng thứ hai.
- Ô tháng ở Nhập liệu (bước Số liệu tháng, `2026-09` thô, tester ghi nhận ở mục 10.5) là `<select>`, không thuộc P-2, chưa đổi.
- Khi ô tháng báo lỗi, hàng "Thêm tháng" nhảy nhẹ theo chiều dọc vì dòng lỗi nằm dưới ô (cùng cách `DateField` đang làm); chưa chỉnh.
- Hai file nóng `vi.json`, `en.json` đã giữ (A và B đều không giữ file nóng lúc đọc) và nhả sau commit.

### 7.4 Chỗ Tester nên soi kỹ

- Chi tiết mở không tham số ở dự án đang mang số: chip "Dùng số tháng ..." hiện, số %KH/%TT/trạng thái bằng dòng ở Tổng quan kỳ mặc định.
- Chi tiết với `?to=` trước tháng hiện tại: mốc = tháng cuối kỳ; `?month=` vẫn kẹp trong kỳ.
- Bảng Kế hoạch nhân lực (`/nhap-lieu?project=1&step=resources`): ô "Thêm tháng" gõ `092026`, `9/2026`, `13/2027`, tháng trùng, bản EN; ảnh `.bangiao/anh-p4-sua/o-thang-*.png` và `o-thang-loi-*.png` (1440, 390, sáng, tối).
- Thẻ công suất ở Tổng quan với kỳ kéo sang tương lai: "Cách đọc" chỉ tới tháng hiện tại.

### 7.5 Kết quả kiểm

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test` với `DATABASE_URL` của DB `_c` (có real-db): 310 file xanh; 3739 test xanh, 1 bỏ qua, 0 đỏ (mốc trước 309 file, 3699 test).
- e2e toàn bộ (`npx playwright test`, cổng 3003, DB `_c`, dev server do Playwright tự khởi và tắt, `--max-old-space-size=6144`): 367 xanh (gồm 3 ca setup), 0 đỏ, 0 chập chờn, 17,2 phút. Gồm `33-chi-tiet-moc`, `38-p4-vong-sua` (ca console "unique key" xanh), `36`, `37`, `39`, `03`, `34`, `40-monthfield` mới 8 ca.
- Không chạy `npm run build`. Không cập nhật `PROGRESS.md`, `.serena/memories/`, `CHANGELOG`. Không push.
- Việc bỏ qua: chưa thử chạm lịch gốc `input[type=month]` trên điện thoại thật, chưa thử Firefox/Safari (nhánh không có nút lịch).

### 7.6 Vòng sửa Vòng 3 (reviewer: P-2 gõ sai rồi bấm "Thêm tháng")

Skill đã dùng: `coding-standards`, `frontend-patterns`.
- Lỗi: gõ `13/2027` rồi bấm "Thêm tháng" thì bảng vẫn thêm dòng tháng gợi ý cũ và dòng báo lỗi biến mất (blur chạy `commit` báo lỗi nhưng không đổi `newMonth`; `onAddMonth` thêm `newMonth` cũ rồi đổi `newMonth` làm `useEffect` của `MonthField` xoá lỗi).
- Đỏ trước khi sửa: `e2e/40-monthfield.spec.ts` thêm kiểm số dòng bảng trước và sau bằng nhau, lỗi `plan-new-month-error` vẫn hiện, ô còn `13/2027`; thêm 1 ca bấm thẳng nút không qua Enter. Cả 2 ca đỏ (`Expected: 21, Received: 22`), sau sửa xanh.
- Sửa: `src/components/ui/MonthField.tsx` thêm prop `onInvalidChange(bad)` (gọi `true` khi `commit` báo lỗi, `false` khi áp dụng thành công, khi gõ lại xoá lỗi, và khi giá trị từ ngoài đổi). `src/components/form/ManpowerPlanEditor.tsx` giữ cờ `newMonthBad`, `onAddMonth` dừng sớm khi cờ bật (không đổi `newMonth`, không đụng `addErr`), nên lỗi và giá trị gõ còn nguyên.
- NIT 1: `MonthField` đặt `aria-invalid` khi `error || invalid`.
- NIT 2: `src/lib/detail-time.ts` tính `lastDataMonth` với `m <= asOfMonth` (đặt sau dòng tính `asOfMonth`; vì `asOfMonth <= capMonth` nên mặc định không đổi). Chọn `?month=` là tháng trống giữa hai tháng có số (03 và 05, chọn 04) thì chip "Dùng số tháng 03" hiện đúng. Hai test mới ở `src/lib/detail-time.test.ts` (đỏ trước: nhận `2026-05` thay vì `2026-03`; và `2026-05` thay vì null khi mốc trước mọi tháng có số). `lastDataMonth` chỉ dùng ở `DetailTimeBar` qua `page.tsx`.
- Không viết test đơn vị cho cờ `newMonthBad`: repo chưa có testing-library/jsdom; e2e 40 phủ đường này.
- Kết quả: `npx tsc --noEmit` sạch; `npm test` với `DATABASE_URL` DB `_c`: 310 file xanh, 3741 test xanh, 1 bỏ qua, 0 đỏ (trước 3739); e2e `40-monthfield` (9 ca) + `33-chi-tiet-moc` + `03-project-detail` cổng 3003: 25 xanh + 3 setup, 0 đỏ. Dev server do Playwright khởi và tắt. Không đụng `globals.css`, không push.
- Tester soi kỹ: gõ sai rồi bấm "Thêm tháng" có/không qua Enter (không thêm dòng, lỗi còn, ô giữ chữ gõ); sau đó sửa lại đúng rồi bấm thì thêm bình thường; Chi tiết `?month=` tháng trống giữa hai tháng có số hiện chip mang số.
