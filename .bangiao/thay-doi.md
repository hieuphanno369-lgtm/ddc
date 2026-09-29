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
