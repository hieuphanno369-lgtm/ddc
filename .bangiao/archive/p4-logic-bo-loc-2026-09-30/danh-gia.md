PHAN QUYET: CAN SUA

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
