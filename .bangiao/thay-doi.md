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
