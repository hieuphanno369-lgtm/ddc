PHAN QUYET: CHOT

# Đánh giá reviewer

## P4 - Logic số liệu, lọc kỳ, mốc thời gian, nhập bù (tài khoản C)

Nhánh `feature/p4-logic-bo-loc` @ `5d79495`, so với `main` @ `2c20a95` (44 commit, 142 file ngoài `.bangiao/`).
Ngày đánh giá: 2026-09-30.
Skill đã dùng: `ddc-tower:code-review`.
Bản đánh giá bảo mật `.bangiao/danh-gia-bao-mat.md` CHƯA có lúc viết file này (security-reviewer chạy song song); phán quyết dưới đây chưa tính kết quả đó.
Nếu bản bảo mật ra LO HONG thì cộng thêm các chỗ vá của bản đó vào danh sách CẦN SỬA.

### 1. Kiểm chứng độc lập

- `npx tsc --noEmit`: exit 0, sạch.
- `npm test` (không đặt `DATABASE_URL`): 308 file (301 xanh, 7 bỏ qua); 3644 test (3574 xanh, 70 bỏ qua), 0 đỏ, exit 0. Khớp số coder báo.
- Không chạy lại e2e (bộ 320 ca mất khoảng 20 phút và `global-setup` seed lại DB `_c`); dựa vào kết quả e2e của coder/tester và đọc spec.
- Số liệu seed kỳ mặc định (01/10/2025 - 30/09/2026) tôi tính lại bằng SQL chỉ đọc trên DB `ddc_control_tower_c`, không qua code ứng dụng: Dự án trong kỳ 17, Đang triển khai 15, Chậm tiến độ 11. Khớp số 17/15/11 của Tổng quan và Báo cáo.
- Tổng quan và Báo cáo gọi cùng `loadPortfolioKpis(period, {})` với cùng kỳ mặc định (`defaultOverviewPeriod`), bảng Báo cáo lấy đúng tập `getProjectSummaries(period, {})` (R1 đạt).
- Trang Chi tiết khớp Tổng quan ở kỳ mặc định trên seed (mọi dự án đều có số tháng 09/2026), nhưng lệch ở 2 trường hợp (xem C-3, N-1).

### 2. Code có khớp kế hoạch không

Khớp phần lớn.
Đã kiểm từng mục của `lenh-cho-C-2026-09-28-p4.md` PHẦN 1d:

- L-1 (tính tại mốc): `summarize()` ở `src/server/queries.ts` dùng `asOfDate` cho %KH, nguy cơ phạt, trạng thái; ngày thực tế sau mốc coi như chưa xảy ra. Test đỏ trước ở `2c7035d`, sửa ở `52384c9`. Đạt.
- L-2 (SPI/CPI có trọng số): `getSpiCpiTrend` = ΣEV/ΣPV, ΣEV/ΣAC; `readMonthlyEvm` đã xoá. Đạt.
- L-3 (mang số tháng trước): `readFactSnapshotsAsOf` (LATERAL + index), `carrySeries`, delta null khi không có số. Đạt.
- L-4 (bỏ "Tất cả"): kỳ `Period` thay `month`, doanh thu/sản lượng cộng theo kỳ, công suất x số tháng. Đạt.
- L-5 (Dự án trong kỳ): `inPeriod` theo Q4. Đạt, số seed 17 kiểm lại bằng SQL.
- F-1: S-curve/SPI-CPI dùng đúng tập của `getProjectSummaries(period, filters)` kể cả trạng thái. Đạt.
- F-2: chart theo kỳ, không vẽ tháng sau mốc (R2), bỏ `.slice(-6)`. Đạt.
- F-3: chip "Từ biểu đồ" (e2e 32). Đạt.
- F-4: chip tên chiều lọc, ngày dd/mm/yyyy, "Xoá tất cả lọc", đếm n / total. Đạt.
- F-5: bộ chọn mốc, điều hướng tuần, "Số tại ..." trên thẻ, bỏ cửa sổ 180 ngày, bảng tài chính theo kỳ. Đạt.
- F-6: một câu "Chậm N ngày (x điểm %)" cho thẻ %TT và chân timeline. Đạt.
- N-6: nhân lực và thiết bị lệch ngày có nhãn ngày riêng (`asOf.day` ở 2 thẻ nguồn lực). Đạt.
- Icon "?": đủ 13/13 chỗ ở Tổng quan; Chi tiết thiếu 2 chỗ (Khâu nghẽn, Huy động nguồn lực), xem C-4.
- Chốt thêm của chủ dự án: nét đứt ở Chi tiết (đạt), Báo cáo chung kỳ (đạt), `DateField` mọi form (đạt, trừ ô tháng ở `ManpowerPlanEditor`, chờ duyệt P-2), `?month=all` im lặng (CHƯA làm, C-1), nhãn Excel theo màn hình (CHƯA làm, C-2).
- Nhóm F: bảng mới, repo có khoá `FOR UPDATE`, luật ngày và luật tháng ở server, chỉ admin bật/tắt, IDOR giữ qua `requireWriteProject`/lọc `owned`, khoá sổ vẫn `locked`, nhãn nhập bù ở `audit_log` và `activity_log`, thẻ ở Hồ sơ dự án chỉ admin, badge vàng ở Nhập liệu. Đạt.
- Migration `20260929165146_p4_backfill_window` chỉ `CREATE TABLE`, `CREATE INDEX`, `ADD FOREIGN KEY` cho bảng mới. Đạt.
- Không đụng `src/components/icons/index.tsx`, `middleware.ts`, trang đăng nhập/đăng ký, `PROGRESS.md`, `.serena/`, `package.json`. A và B không giữ file nóng nào lúc đọc.
- i18n: vi và en cùng tập key (so bằng script, 0 lệch); không có dấu gạch dài trong dòng thêm mới và trong commit message.
- Tài liệu `docs/huong-dan/nhap-bu-lich-su.md`: đủ nội dung (admin bật/tắt, PIC ngày/tháng, Excel, nhật ký), mỗi câu một dòng, khớp code (Excel ngày: giao diện chỉ gửi dòng hợp lệ nên câu "các dòng khác vẫn lưu được" là đúng).

### 3. Test có giá trị thật không

Có giá trị thật, không phải viết cho có.

- Test đỏ trước khi sửa có bằng chứng git: `2c7035d` (chỉ test + fixture) trước `52384c9` (sửa); T-1 đỏ ở `026a020` trước `0d1bf85`; T-7/T-8 đỏ ở `f31f8ba` trước `3a033dd`/`d64a7b2`. T-3 thêm test cùng commit sửa (`10c4c9a`), không có commit đỏ riêng (chấp nhận được, mức thấp).
- `queries-period.test.ts` sau khi tạo không bị nới, chỉ thêm 1 ca đếm.
- Fixture tay A/B/C với kỳ vọng tính tay (vd SPI 0,9 và CPI 0,87 thay cho 0,75/0,71 của AVG) bắt đúng lỗi cũ.
- Tester có ca ngày ISO đầy đủ từ Postgres, real-db, ca race đã đo độ nhạy (bản không khoá đỏ 29/30, bản có khoá xanh 15/15).
- Các ca bị xoá (tháng "all", tháng rác, `readMonthlyEvm`, `resourceWindow`) là kiểm hành vi đã bị kế hoạch loại bỏ; ca tương đương theo kỳ đã thay vào. Không thấy ca kiểm quyền/che tiền nào bị bỏ: các dòng bị xoá chứa `canViewFinance` chỉ là đổi chữ ký `month` sang `period` (`top-priority-mask.qa.test.ts`, `overview-finance-gate.test.ts` vẫn giữ ca viewer).
- Điểm yếu: 1 ca đang khoá SAI quyết định của chủ dự án (`src/lib/period.test.ts:109` khẳng định `?month=all` là `invalid: true`), và `src/server/export-finance-gate.test.ts:119-132` khoá nhãn cũ "Backlog (tỷ)". Hai ca này phải sửa cùng C-1, C-2.
- Chưa có test nào so số Tổng quan với Chi tiết cho cùng kỳ (vì vậy C-3 lọt).

### 4. Danh sách vấn đề

#### CHẶN

Không có.

#### CẦN SỬA

- **C-1 `?month=all` vẫn hiện "Kỳ không hợp lệ", trái chốt của chủ dự án ("link cũ `?month=all` im lặng về kỳ mặc định, tham số rác khác vẫn báo").**
  Chỗ: `src/lib/period.ts:50-51` (`parsePeriodChecked`: `given` tính cả `month` bằng "all").
  Sửa: bỏ qua `month` bằng "all" khi tính `given` (vẫn rơi về kỳ mặc định).
  Test phải sửa theo: `src/lib/period.test.ts:109` (tách ca `month: all` ra riêng, kỳ vọng `invalid: false`); thêm khẳng định `period-invalid` KHÔNG hiện ở `e2e/32-loc-ky.spec.ts:27-32` và một ca `?month=abc` vẫn hiện.
  Ảnh hưởng 2 trang dùng `parsePeriodChecked` với `month`: `app/[locale]/(app)/overview/page.tsx:55` và `app/[locale]/(app)/report/page.tsx` (dòng gọi `parsePeriodChecked`). Chi tiết (`src/lib/detail-time.ts`) chỉ xét from/to nên không bị.
- **C-2 Nhãn Excel xuất Báo cáo chưa đổi giống màn hình (chốt sau tester).**
  Chỗ: `app/api/report/export/route.ts:34` ("Tổng số dự án" phải là "Dự án trong kỳ"), `:39` và `:59` ("Backlog (tỷ)" phải là "HĐ chưa khởi công (tỷ)").
  Test phải sửa theo: `src/server/export-finance-gate.test.ts:119, 121, 130, 132` và `src/server/report-export-route.test.ts` nếu có khoá nhãn cũ.
  Nên kiểm luôn file xuất danh sách dự án `app/api/export/route.ts` xem còn tiêu đề "Backlog" không.
- **C-3 Trang Chi tiết tính số tại cuối tháng mốc, bỏ qua `to` của kỳ, nên lệch Tổng quan khi kỳ kết thúc giữa tháng.**
  Ví dụ: Tổng quan kỳ 01/07/2026 - 15/07/2026 tính %KH, nguy cơ phạt, trạng thái tại 15/07; bấm tên dự án sang Chi tiết (link giữ `from/to`) thì `getProjectSummary(id, "2026-07")` tính tại 31/07. Dự án có ngày kết thúc thực tế 20/07 sẽ là "Đang triển khai" ở Tổng quan và "Hoàn thành" ở Chi tiết; %KH lệch 16 ngày.
  Trái mục 3 của kế hoạch ("Ngày mốc = min(period.to, hôm nay)") và mục tiêu "mọi số trên 2 trang tính tại đúng một mốc".
  Chỗ: `src/server/queries.ts:219-227` (`getProjectSummary` tự lấy `min(endOfMonth, today)`), nơi gọi `app/[locale]/(app)/projects/[id]/page.tsx:115`.
  Sửa: truyền thêm ngày mốc trần (`periodAsOfDate(t2.period, today)`) để `asOfDate = min(endOfMonth(asOfMonth), trần)`; thêm test so `getProjectSummaries` (kỳ giữa tháng) với `getProjectSummary` cùng kỳ ra cùng `pctPlan`/`status`/`penalty`.
- **C-4 Thiếu 2 dấu "?" bắt buộc ở PHẦN 1d (Chi tiết: "Khâu nghẽn", "Huy động nguồn lực"), chuỗi đã có sẵn nhưng không dùng.**
  Chuỗi `helpTip.dtBottleneck`, `helpTip.dtMobilization` có trong `vi.json`/`en.json`, 0 nơi dùng.
  Chỗ đặt tự nhiên, không đổi bố cục: `app/[locale]/(app)/projects/[id]/page.tsx:351-354` (badge "Khâu nghẽn" trong `action` của thẻ Chuỗi giá trị) và `:409-420` (`titleExtra` của 2 thẻ `res-manpower`, `res-equipment`, cạnh chip "Nhập tay"; thẻ cần `overflow-visible` như các thẻ khác có "?").

#### NÊN SỬA

- **N-1 Chi tiết mặc định lấy mốc = tháng cuối có số, nên với dự án đang mang số sang, %KH/trạng thái/nguy cơ phạt ở Chi tiết tính tại cuối tháng đó, còn dòng của dự án ở Tổng quan tính tại hôm nay.**
  Đúng chữ kế hoạch D2 nhưng làm 2 trang lệch số cho cùng dự án (seed hiện không lộ vì mọi dự án có số tháng 09).
  Chỗ: `src/lib/detail-time.ts` (`asOfMonth` mặc định = `lastDataMonth`). Cần chủ dự án chọn (xem mục 6).
- **N-2 Nhập liệu vẫn liệt kê 12 tháng cho data-entry trong khi server chỉ cho tháng hiện tại và tháng trước (Q9 = b).**
  PIC chọn được 10 tháng mà lưu kiểu gì cũng báo `out_of_window`.
  Chỗ: `app/[locale]/(app)/nhap-lieu/page.tsx:44`. Gợi ý: với `data-entry` chỉ liệt kê tháng `isMonthAllowed` trả true (tháng hiện tại, tháng trước, tháng nhập bù); admin giữ 12 tháng.
- **N-3 Công suất kỳ nhân đủ số tháng của kỳ kể cả tháng sau hôm nay, trong khi sản lượng chỉ có tới hôm nay.**
  Kỳ 01/07 - 31/12/2026 xem ngày 30/09 sẽ chia sản lượng 3 tháng cho công suất 6 tháng, tỷ lệ thấp giả. Chart xu hướng đã cắt ở tháng mốc (R2) nhưng thẻ công suất chưa.
  Chỗ: `src/server/queries.ts:368`. Gợi ý: đếm tháng tới tháng mốc, dòng "Cách đọc" ghi khoảng tháng thật.
- **N-4 Delta KPI chỉ tắt khi CẢ danh mục không có số ở kỳ trước (`factRows` không theo bộ lọc).**
  Lọc một nhóm dự án chưa có số ở kỳ trước vẫn ra delta so với 0.
  Chỗ: `src/server/queries.ts:303`. Gợi ý: đếm `factRows` trong tập đã lọc.

#### NIT

- `app/globals.css:261` thêm `white-space:nowrap` cho `.kpi .vl`: giá trị dài sẽ tràn thay vì xuống dòng (đã kiểm 390px với seed, chưa kiểm số tiền rất lớn).
- `src/components/dashboard/charts.tsx:227` nhãn "Công suất kỳ (tấn)" viết cứng tiếng Việt, trang `/en` vẫn hiện tiếng Việt (kiểu viết cứng có từ trước P4).
- `src/server/repo/prisma-repo-backfill.ts:55` khoá dòng `dim_project` không lọc `isActive`: admin bật được nhập bù cho dự án đã ngừng hoạt động.
- `.bangiao/anh-p3f/`, `anh-p4/`, `anh-p4-f/`, `anh-p4-test/` chưa commit và chưa dọn; khi archive trước merge cần quyết giữ hay bỏ.

### 5. Style kính mờ và thay đổi bố cục

- Không sửa token nào trong `app/globals.css`; kính mờ, màu, font, bo góc, bóng giữ nguyên.
- `app/globals.css` có 2 thay đổi nhỏ (dòng 261 `.kpi .vl` nowrap; dòng 542-543 timeline dưới 560px xếp nhãn lên trên thanh). Kế hoạch mục 2 ghi "nếu buộc phải thêm CSS thì DỪNG, báo lại"; coder đã giữ file nóng đúng quy trình và ghi ở `thay-doi.md`, nhưng dòng 543 là đổi bố cục timeline trên điện thoại, cần chủ dự án biết (mục 6).
- Các thay đổi bố cục/chart còn lại đều nằm trong D-1..D-25 đã duyệt: thanh lọc kỳ, KPI 2 nhóm và 2 thẻ mới, cột "Số liệu", thanh mốc và điều hướng tuần ở Chi tiết, vạch mốc, nét đứt, `Brush` từ 13 tháng, bảng tài chính cuộn, thẻ nhập bù, badge vàng.
- S-curve chuyển từ `AreaChart` sang `ComposedChart` nhưng vẫn vẽ vùng PV/EV và đường AC nét đứt như cũ (để tách đoạn nét đứt), không đổi loại chart nhìn thấy.
- Ngoài D-x: `GroupBar` xoay nhãn trục X -35 độ và cao thêm 30px khi hẹp (T-5); `DataEntryForm` ô chọn dự án chiếm cả hàng dưới 640px (P-3); `BackfillPanel` tiêu đề và mô tả xếp dọc (P-1). Đều là sửa lệch pixel ở màn hẹp, không đổi màu/token, nhưng liệt kê để chủ dự án biết.

### 6. Mục cần chủ dự án duyệt

1. Excel tháng không báo `out_of_window` ở bước xem trước (`importExcelAction`, không nhận tháng); dự án ngoài khoảng chỉ bị chặn ở bước lưu (`commitImportAction`), hiện ở danh sách `failed` với lý do rõ. Đề xuất: chấp nhận cho P4 (đúng F4 "sau lọc owned"); muốn báo sớm thì phải thêm ô chọn tháng vào bước xem trước.
2. P-2: ô `input[type=month]` ở "Kế hoạch nhân lực theo tháng" (`src/components/form/ManpowerPlanEditor.tsx:183`) hiện tiếng Anh theo ngôn ngữ trình duyệt. Đề xuất: phương án A của coder (ô `MonthField` mm/yyyy cùng họ `DateField`), vì chủ dự án đã chốt `DateField` cho mọi form.
3. Tối đa 24 tháng tính theo tháng lịch khoảng chạm tới (15/01/2024 - 10/01/2026 chạm 25 tháng nên bị từ chối dù chưa đủ 24 tháng tròn). Đề xuất: chấp nhận (dễ hiểu, khớp cách tính "tháng của kỳ"), đã ghi trong `docs/huong-dan/nhap-bu-lich-su.md:19`.
4. N-1: Chi tiết mặc định lấy mốc là tháng cuối có số (%KH tính tại cuối tháng đó) hay tháng hiện tại có mang số sang (%KH tính tại hôm nay, khớp Tổng quan). Đề xuất: tháng hiện tại có mang số sang, để 2 trang cùng một số.
5. Timeline Chi tiết dưới 560px xếp nhãn "Kế hoạch/Thực tế" lên trên thanh (`app/globals.css:543`) và các sửa pixel ở màn hẹp nêu ở mục 5. Đề xuất: duyệt (chỉ đổi ở điện thoại, sửa chữ đè).

### 7. Kết luận

CẦN SỬA: C-1, C-2, C-3, C-4 (đều nhỏ, khoanh vùng rõ, kèm test).
Logic cốt lõi L-1..L-5, F-1..F-6, N-6 và nhóm F đúng và có test thật; không có vấn đề chặn.
Sau khi sửa 4 mục trên và có kết quả `danh-gia-bao-mat.md`, cho reviewer soi lại vòng sửa trước khi CHỐT.
Ghi chú quy trình: theo luật của vai reviewer (chỉ đọc, không đổi lịch sử git), tôi KHÔNG commit file này; người điều phối commit giúp nếu cần.

## Vòng 2 - soi lại vòng sửa (2026-09-30)

Nhánh `feature/p4-logic-bo-loc` @ `07da17a`, soi `git diff 093fee1..HEAD` (15 commit, 36 file ngoài `.bangiao/`).
Skill đã dùng: `ddc-tower:code-review`.
Phán quyết vòng 1 là CẦN SỬA (C-1..C-4); dòng đầu file đã đổi thành phán quyết vòng 2.
Bản bảo mật `.bangiao/danh-gia-bao-mat.md` là ĐẠT (không phải LO HONG); S-1, S-2 mức thấp và S-3 thông tin đã được vá trong vòng này.

### V2.1 Kiểm chứng độc lập

- `npx tsc --noEmit`: exit 0, sạch.
- `npm test` với `DATABASE_URL` của DB `ddc_control_tower_c` (có real-db): 309 file xanh; 3699 test xanh, 1 bỏ qua, 0 đỏ.
- Thêm 2 ca so với số của coder (3697) là 2 ca `Card.test.ts` của `07da17a`.
- e2e chạy riêng (không chạy toàn bộ): `e2e/38-p4-vong-sua.spec.ts` 3 ca C-4 (gồm ca console "unique key") xanh; chạy lại lần 2 ca console cùng `e2e/03-project-detail.spec.ts` xanh (5/5 gồm setup).
- Lưu ý: `global-setup` của e2e đã seed lại DB `_c` trong 2 lượt chạy này (17 dự án), đúng như mọi lần chạy e2e.

### V2.2 Từng mục

- C-1 `d79ec36`: đạt, đúng gốc. `parsePeriodChecked` (`src/lib/period.ts:50-51`) bỏ riêng `month=all` khi tính `given`; `month=all` kèm from/to rác vẫn báo. Test `period.test.ts` tách ca đúng như yêu cầu; e2e 32 có ca `?month=all` im lặng và `?month=abc` vẫn báo (tester ghi xanh ở cả Tổng quan và Báo cáo).
- C-2 `d840f95`: đạt. `app/api/report/export/route.ts` đổi 3 nhãn; `export-finance-gate.test.ts` khẳng định có nhãn mới và KHÔNG còn "Tổng số dự án", "Backlog (tỷ)".
- C-3 `96e0d37`: đạt, đúng gốc. `getProjectSummary` nhận `asOfCap`, `asOfDate = min(cuối tháng mốc, hôm nay, trần)`; Chi tiết truyền `periodAsOfDate(t2.period, today)`, là nơi gọi duy nhất. Ca mặc định không đổi hành vi (trần = hôm nay). Test `queries-period.test.ts` so `getProjectSummaries` với `getProjectSummary` cùng kỳ giữa tháng trên status, pctPlan, penalty, onTrack, có ca dự án B "Hoàn thành" nếu không truyền trần (sẽ đỏ trên code cũ). e2e 38 kiểm cả 17 dự án với oracle tính tay.
- C-4 `738deb7`: đạt. 3 dấu "?" dùng `helpTip.dtBottleneck`, `helpTip.dtMobilization`; 2 thẻ nguồn lực thêm `overflow-visible` như các thẻ khác. Test mới `src/i18n/help-tip-usage.test.ts` bắt mọi chuỗi `helpTip.*` mồ côi về sau, có giá trị thật.
- N-2 `f8ab0ca`: đạt. `entryMonths` lọc theo chính `isMonthAllowed` của server, test khẳng định hai chiều (mọi tháng hiện đều được phép, không sót tháng được phép).
- N-3 `bd41aa2`: đạt về số. Test kỳ 06..12 ra 400 thay 700, kỳ hoàn toàn tương lai ra 0 và không cảnh báo.
- N-4 `ec069aa`: đạt. `factRows` đếm trong tập đã lọc (`dataState.kind !== 'none'`); test lọc P3 ra mọi delta null, lọc P1 vẫn có delta.
- NIT i18n chú giải chart `a064a99`: đạt. NIT `isActive` `7f4523d`: đạt, có test real-db.
- S-1 `4485335`: đạt. `isCacheablePeriod` chặn tập khoá ghi đĩa (test đếm dưới 400 khi thử mọi cặp ngày 01/cuối tháng 2000-2040); kỳ tuỳ ý và ô tìm kiếm đi React `cache`; `team`/`customer` đối chiếu id thật. Kỳ mặc định (to = hôm nay) vẫn cacheable. Tester đo đĩa: kỳ tuỳ ý không tăng tệp, kỳ trọn tháng tăng đúng 9 loader mỗi kỳ.
- S-2 `df3804e`: đạt. Rate limit đặt SAU kiểm quyền (403 không bị đếm), khoá theo `clientIpFrom` (đổi phần tử đầu XFF không né được), có test 429 và `Retry-After`.
- S-3 `c912734`: đạt. `recordId` dạng `<projectId>/<id>` ở cả prisma và mock, `readProjectAuditTrail` thêm `project_backfill_window`, có nhãn vi/en; test real-db khẳng định dự án khác không thấy dòng đó. Phần nhãn nhập bù ngoài transaction: chấp nhận theo đề xuất security, đã ghi ở `thay-doi.md` mục 6.
- `07da17a`: đạt. `CardHeader` bọc `titleExtra` và `action` trong `Fragment` có key, không thêm thẻ DOM (test `Card.test.ts` so markup chính xác). Gốc: Fragment không key nhiều con đi từ server component qua ranh giới RSC sang client component bị React dev coi như danh sách; sửa ở `CardHeader` chữa cho mọi nơi dùng, không phải vá từng trang. Ca console e2e 38 trước đỏ ở mọi lần chạy của tester (10 đến 35 cảnh báo), nay xanh 2/2 lần tôi chạy. Không đổi giao diện.

### V2.3 Còn lại (không chặn CHỐT)

- NIT (còn từ vòng 1, chưa sửa): `app/globals.css:261` `.kpi .vl` `white-space:nowrap` có thể tràn với số rất lớn.
- NIT mới: dòng "Cách đọc" của thẻ công suất ở Tổng quan vẫn ghi đủ khoảng tháng của kỳ (vd "Tháng 07/2026 - 12/2026") trong khi số từ N-3 chỉ tính tới tháng mốc; nên ghi khoảng tháng thật (tester ghi nhận ở `ket-qua-test.md` 10.5). Chỗ: `src/components/dashboard/OverviewWidgets.tsx:161` (`months[months.length - 1]` nên cắt ở tháng mốc như `getCapacityData`).
- Chập chờn hạ tầng `e2e/36-datefield-form.spec.ts:208` (goto quá 60 giây sau 20 phút chạy toàn bộ), chạy riêng xanh; nên theo dõi, không phải lỗi P4.
- `ket-qua-test.md` mục 10.4 còn ghi ca "unique key" là ĐỎ; thực tế đã xanh sau `07da17a` (xem V2.1), tester nên cập nhật khi chạy lại toàn bộ.
- Chưa chạy lại e2e toàn bộ sau `07da17a` (thay bằng chạy riêng các ca liên quan).
- Thư mục ảnh `.bangiao/anh-p3f/`, `anh-p4/`, `anh-p4-f/`, `anh-p4-test/`, `anh-p4-sua/` chưa commit; quyết giữ hay bỏ khi archive trước merge.

### V2.4 Vẫn chờ chủ dự án duyệt (không đụng ở vòng này)

- N-1 (mốc mặc định của Chi tiết) = mục 4 của phần 6.
- P-2 (`MonthField` cho ô tháng ở `ManpowerPlanEditor`) = mục 2 của phần 6.
- Mục 1 (Excel tháng báo `out_of_window` ở bước lưu), mục 3 (24 tháng lịch), mục 5 (timeline dưới 560px và các sửa pixel màn hẹp) của phần 6.

### V2.5 Kết luận vòng 2

CHỐT về kỹ thuật: C-1..C-4, N-2..N-4, 2 NIT, S-1..S-3 đều vá đúng gốc, có test thật (không assert rỗng, nhiều ca sẽ đỏ trên code cũ), tsc sạch, unit và real-db xanh, lỗi console React đã hết.
Merge vào `main` vẫn cần chủ dự án đồng ý và trả lời các mục ở V2.4.
Tôi không commit file này (vai reviewer chỉ đọc).

## Vòng 3 (07da17a..HEAD: a6286d0, 74a5ca1, d20903b, 52e635f)

Skill đã dùng: `ddc-tower:code-review`.
Phán quyết vòng 3 ban đầu: CAN SUA (1 lỗi đúng đắn ở P-2). Sau bản vá 05c0313: CHOT (xem V3.6). Dòng đầu file là phán quyết hiện hành.

### V3.1 Số liệu

- `npx tsc --noEmit`: sạch, không lỗi.
- `npx vitest run` với `DATABASE_URL` của `ddc_control_tower_c` (lấy từ `.env`): 310/310 file xanh, 3739 test xanh, 1 bỏ qua, 0 đỏ.
- Không chạy e2e (theo giao việc; coder báo 367/367).
- Diff không có dấu gạch dài; không đụng `app/globals.css`.

### V3.2 N-1 (a6286d0): ĐẠT

- Đúng gốc: `src/lib/detail-time.ts` dòng 45, mốc mặc định bỏ `lastDataMonth ?? capMonth`, lấy `capMonth` = tháng của min(cuối kỳ, hôm nay), nên mốc vẫn kẹp trong kỳ (kỳ kết thúc trước hôm nay thì mốc = tháng cuối kỳ, có test đơn vị và e2e `33` ca `from=2026-01-01&to=2026-03-20`).
- `?month=` vẫn qua `clampMonth`, rác rơi về mặc định.
- Số Chi tiết khớp Tổng quan: `src/server/queries-period.test.ts` khối "P4 N-1" so status, %TT, %KH, phạt, onTrack, dataState của cả dự án có số tháng hiện tại (A) và dự án mang số (B); test này đỏ trên code cũ (mốc cũ của B là 2026-06).
- Chip "Dùng số tháng...": `DetailTimeBar.tsx` dòng 52 `asOfMonth > lastDataMonth`, mặc định B cho mốc 2026-09 > 2026-06 nên chip hiện đúng; nhãn KPI (`page.tsx` dòng 180) theo tháng chuỗi giá trị nên cũng đúng.
- Ý kiến về ngày nguồn lực mặc định thành hôm nay (`detail-time.ts` dòng 49): chấp nhận được và nhất quán với mốc = tháng hiện tại.
  Hệ quả thực tế: buổi sáng khi chưa nhập số ngày thì nhóm nguồn lực mặc định có thể trống.
  Đề xuất (không chặn, cần chủ dự án quyết nếu muốn): lấy ngày gần nhất có số nguồn lực không vượt hôm nay.
- NIT có từ trước, không do vòng này: `lastDataMonth` tính theo `capMonth` chứ không theo mốc đang chọn, nên khi người dùng chọn `?month=` là tháng trống nằm giữa hai tháng có số (ví dụ số ở 03 và 05, chọn 04) thì chip mang số không hiện dù KPI đang dùng số tháng 03.
  Chỗ sửa nếu muốn: `src/lib/detail-time.ts` dòng 44, tính `lastDataMonth` với `m <= asOfMonth` (đặt sau dòng tính `asOfMonth`).

### V3.3 P-2 MonthField (74a5ca1): CẦN SỬA 1 chỗ

Đạt:
- `parseMy`/`maskMy` (`src/lib/date-input.ts` dòng 52-80): tháng 00, 13, năm 1999, 3000, năm 2 chữ số, chữ, ISO `2026-09`, `9/2026/1` đều trả null; nhận `9/2026`, `9-2026`, `09.2026`, `092026`, có khoảng trắng hai đầu. Test bảng có giá trị thật.
- Dán chuỗi: `maxLength=7` cộng mask; dán `2026-09` thành `20/2609` rồi báo lỗi khi áp dụng, chấp nhận được.
- i18n: nhóm `monthField` mới ở cuối cả `vi.json` và `en.json`, đủ 3 key, không chèn giữa key cũ; `messages.test.ts` đã đăng ký nguồn `MonthField`.
- a11y: `aria-label`, `aria-invalid` và `aria-describedby` trỏ dòng lỗi `role="alert"`, input lịch gốc có nhãn và `tabIndex=-1`.
- Style: dùng lại `.inp`/`.inp.bad`/`.hintline`, không thêm CSS mới, giữ kính mờ.

Lỗi phải sửa (đúng đắn):
- Gõ tháng sai rồi bấm "Thêm tháng" thì vẫn thêm một dòng tháng CŨ và lỗi biến mất.
  Luồng: bấm nút làm ô mất focus, `commit` (`src/components/ui/MonthField.tsx` dòng 54-60, gọi từ `onBlur` dòng 94) báo lỗi và không gọi `onChange`, nên `newMonth` giữ giá trị gợi ý cũ; `onAddMonth` (`src/components/form/ManpowerPlanEditor.tsx` dòng 43-51) vẫn thêm `newMonth` cũ rồi `setNewMonth(addMonths(...))`, làm `useEffect` theo `value` trong MonthField xoá lỗi.
  Người dùng gõ nhầm 13/2027 (định gõ 12/2027) sẽ thấy một dòng tháng khác được thêm im lặng.
- Cách sửa đề xuất: MonthField báo trạng thái ô đang sai cho cha (ví dụ prop `onInvalidChange(bad: boolean)` gọi trong `commit` và khi gõ lại), `ManpowerPlanEditor.tsx` giữ cờ `newMonthBad` và `onAddMonth` dừng sớm khi cờ bật (dòng 43), dòng 184 truyền callback.
- Test không bắt được lỗi này: `e2e/40-monthfield.spec.ts` dòng 46-48 ghi chú "không thêm dòng" nhưng chỉ kiểm không có ô `13/2027`.
  Cần thêm: đếm số dòng bảng trước và sau khi bấm (phải bằng nhau), ô lỗi `plan-new-month-error` vẫn hiện, và ô vẫn giữ `13/2027`.
  Test này phải đỏ trên code hiện tại trước khi sửa.

NIT (không chặn): prop `invalid` của MonthField tô viền đỏ nhưng không đặt `aria-invalid` (`MonthField.tsx` dòng 79 chỉ xét `error`); hiện chưa nơi nào dùng `invalid`, sửa thành `error || invalid` khi có người dùng.

### V3.4 CapacityCard (d20903b): ĐẠT

- `src/components/dashboard/OverviewWidgets.tsx` dòng 152-163: lọc tháng tới `periodAsOfMonth`, mảng rỗng thì chỉ in câu "Cách đọc", hết lỗi `undefined.slice`.
- `CapacityCard.test.ts`: ca 1 và ca 3 đỏ trên code cũ (cũ ghi 12/2026; cũ gọi `formatMonthShort(undefined)`), ca 2 giữ hành vi kỳ đã qua. Có giá trị thật.
- Chữ `chartHowTo.capacity` vi/en sửa nghĩa khớp, cùng key cũ (không thêm key).

### V3.5 Kết luận vòng 3

CAN SUA: chỉ còn lỗi P-2 ở V3.3 (MonthField + ManpowerPlanEditor + e2e 40). N-1 và NIT CapacityCard CHỐT.
Sau khi sửa: chạy lại `npx tsc --noEmit`, `npm test`, `e2e/40-monthfield.spec.ts` (kèm ảnh lỗi) là đủ để tôi chốt.
Tôi không commit file này (vai reviewer chỉ đọc).

### V3.6 Soát lại sau bản vá 05c0313: CHỐT

- Lỗi P-2 ở V3.3 đã vá đúng gốc:
  - `src/components/ui/MonthField.tsx` thêm `onInvalidChange`, bật khi `commit` sai, tắt khi `commit` đúng, khi gõ lại và khi giá trị từ ngoài đổi.
  - `src/components/form/ManpowerPlanEditor.tsx` giữ cờ `newMonthBad`, `onAddMonth` dừng sớm khi cờ bật (dòng 46), nên không còn thêm im lặng tháng gợi ý cũ và lỗi không bị xoá.
  - Luồng gõ đúng rồi bấm thẳng "Thêm" vẫn chạy: blur áp dụng tháng mới trước khi click.
- Test có giá trị thật:
  - `e2e/40-monthfield.spec.ts` đếm số dòng trước và sau khi bấm, kiểm lỗi còn hiện, kiểm ô giữ `13/2027`.
  - Thêm ca "gõ sai rồi bấm thẳng Thêm tháng (không Enter)".
  - Theo luồng code cũ, cả hai ca đều đỏ vì bảng bị thêm một dòng.
- NIT a11y: `aria-invalid` giờ xét cả `error || invalid`.
- NIT `lastDataMonth` (`src/lib/detail-time.ts` dòng 48) giờ tính theo `m <= asOfMonth`.
  Chỉ `DetailTimeBar` dùng giá trị này (chip mang số), nên không ảnh hưởng chỗ khác.
  Mặc định N-1 không đổi, vì mốc mặc định = `capMonth`.
  Có 2 test đơn vị mới: tháng trống giữa hai tháng có số cho kết quả 03; tháng trước mọi tháng có số cho kết quả null.
- Số liệu tôi tự chạy:
  - `npx tsc --noEmit`: sạch.
  - `npx vitest run` (DB `_c`): 310/310 file, 3741 xanh, 1 bỏ qua, 0 đỏ.
  - `npx playwright test e2e/40-monthfield.spec.ts`: 12/12 xanh (gồm 3 bước setup), ảnh ở `.bangiao/anh-p4-sua/`.
- Không có dấu gạch dài trong diff, không đụng `app/globals.css`, không có key i18n mới.
- Còn mở, không chặn: đề xuất "ngày nguồn lực mặc định = ngày gần nhất có số" ở V3.2, cần chủ dự án quyết nếu muốn.

Kết luận vòng 3: CHỐT về kỹ thuật. Merge vào `main` vẫn cần chủ dự án đồng ý.
Tôi không commit file này.
