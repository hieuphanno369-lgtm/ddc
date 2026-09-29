# P4 - Kết quả kiểm thử (tester, tài khoản C)

Nhánh `feature/p4-logic-bo-loc`, gốc `d58a0dc`, DB `ddc_control_tower_c`, dev server cổng 3003.
Phạm vi: nhóm A, B, C, D, E, R1. Nhóm F và G chưa code nên bỏ qua.
Kết luận: KHÔNG xanh hết. Có 1 test đỏ vì lỗi sản phẩm (T-1), giữ đỏ có chủ đích để coder sửa.
Tôi không sửa code sản phẩm, chỉ thêm file test.

## 1. Kết quả số thật

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test`: 291 file xanh, 1 file đỏ, 4 file bỏ qua; 3403 test xanh, 1 đỏ, 47 bỏ qua (3451 tổng).
- Test đỏ duy nhất: `src/server/cache-key.test.ts` ca "groupKey KHÔNG kèm groupBy hợp lệ ... (T-1)".
- Trước khi tôi thêm test là 3321 test xanh (theo `thay-doi.md`); tôi thêm 82 test xanh, 1 test đỏ (T-1) và 7 test real-db bỏ qua khi không có `DATABASE_URL`.
- Real-db trên `ddc_control_tower_c` (set `DATABASE_URL`): 4 file, 46 test xanh (read-period 9, queries-period 7, signup 12, auth 18).
- Sau real-db đã kiểm DB: 0 dòng `test-p4-%` còn sót.
- e2e toàn bộ (`npx playwright test`, cổng 3003): 268 xanh, 1 đỏ, 0 bỏ qua, 12,0 phút (gồm 3 bước đăng nhập setup và 30 ca mới của tôi).
- Ca e2e đỏ: `10-ten-app.spec.ts:31` "Sidebar desktop vi" với `net::ERR_CONNECTION_REFUSED` tại `http://localhost:3003/vi/overview` (204ms).
- Chạy lại riêng `10-ten-app.spec.ts`: 11/11 xanh. Các ca liền trước và sau đều xanh.
- Kết luận về ca này: dev server cổng 3003 chết/khởi động lại đúng khoảnh khắc đó (nguyên nhân môi trường, không thấy do code P4), không tái hiện được. Ghi là chập chờn môi trường, không phải lỗi sản phẩm.
- Lưu ý: `global-setup` tự seed lại DB `_c` mỗi lần chạy e2e (hành vi có sẵn của repo).

## 2. File test đã thêm (chỉ file test)

- `src/server/queries-period-edge.test.ts` (19 ca): kỳ cắt ngang tháng, kỳ trống số, dự án bắt đầu giữa kỳ, không mang số từ tương lai về quá khứ, dự án kết thúc giữa kỳ, kỳ tương lai, kỳ 1 ngày, bộ lọc không khớp.
- `src/server/queries-period-iso.test.ts` (8 ca): bọc repo đổi mọi ngày sang ISO đầy đủ `...T00:00:00.000Z`, kiểm ngày thực tế đúng bằng ngày mốc, ngày đầu kỳ, ngày ký HĐ.
- `src/server/queries-period-real-db.test.ts` (7 ca, skip khi không có `DATABASE_URL`): cùng ý trên nhưng trên Postgres thật qua repo Prisma và `getProjectSummary` của trang Chi tiết.
- `src/server/cache-key.test.ts` (17 ca): khoá `unstable_cache` không phình theo tham số rác; 1 ca đỏ (T-1).
- `src/server/overview-page-params.test.ts` (14 ca): trang Tổng quan, tham số rác về kỳ mặc định, cùng một object `period`/`filters` cho mọi widget, viewer không thấy S-curve và thẻ HĐ chưa khởi công.
- `src/components/dashboard/KpiGrid-finance.test.ts` (5 ca): `KpiGrid` che tiền theo `canViewFinance`, số tiền không rò vào HTML.
- `src/server/projects-detail-page-p4.test.ts` (19 ca): `requireProjectRead` chặn trước mọi lần đọc theo mốc/ngày, che tiền ở khối mới, tham số cực đoan không 500.
- `e2e/34-p4-bien.spec.ts` (30 ca): chart vẽ xong có dữ liệu, tham số rác Tổng quan và Chi tiết, kỳ trống số, kỳ tương lai, kỳ 1 ngày, viewer.
- Ba nhóm bắt buộc đều có: đường chạy thuận lợi, biên đã nêu tên ở mục 4 kế hoạch, và ca phải thất bại (id lạ, dự án không được gán, tham số rác, ca đỏ T-1).

## 3. Điều tra 4 nghi vấn của điều phối

### 3.1 Ba chart Tổng quan "trống" trong ảnh
- Kết luận: KHÔNG phải lỗi dữ liệu, là chụp trước khi Recharts vẽ xong.
- Bằng chứng: mở `/vi/overview` mặc định, đo theo thời gian: t=0 có 8 cột, 0 lát donut; t=300ms có 13 cột, 2 lát; t=1500ms có 13 cột, 3 lát (đủ).
- Sau 3 giây đủ 14 SVG chart, 13 cột, 3 lát donut, dữ liệu đúng (17 dự án: 1 chuẩn bị, 15 đang triển khai, 1 hoàn thành).
- Ảnh đúng khi chờ đủ: `.bangiao/anh-p4-test/tq-1440-light.png`.
- Nguyên nhân ảnh trống: `e2e/32-loc-ky.spec.ts` chỉ chờ `.recharts-wrapper` visible rồi chụp ngay, không chờ animation.
- Khuyến nghị cho coder (sửa spec ảnh): chờ thêm animation hoặc tắt animation trước khi chụp. Đây không phải lỗi sản phẩm.
- Ca e2e mới `34 ... chart Tong quan ve xong co du lieu` khoá hành vi này (chờ số lát/cột ổn định và đo chiều cao cột > 10).

### 3.2 SVĐ PVF mốc 08/2026: chuỗi giá trị 0,0%, so sánh hạng mục trống
- Tái hiện được bằng `/vi/projects/1?month=2026-08` (đúng ảnh điều phối thấy: %TT 76,27%, "Số tại 08/2026", chuỗi 0,0%, "Chưa có sản lượng hạng mục của tháng này"). Ảnh: `.bangiao/anh-p4-test/ct-0826-1440-light.png`.
- Kiểm DB: dự án id 1 có `fact_progress_monthly` đủ 2025-10 tới 2026-09, nhưng `fact_value_chain_progress` CHỈ có tháng 2026-09 và `fact_stage_work_item` CHỈ có tháng 2026-09.
- Nguyên nhân: seed (`src/data/seed/history.ts`, `buildValueChain(..., SEED_CURRENT_MONTH)`) chỉ tạo chuỗi giá trị và hạng mục cho đúng tháng hiện tại.
- Code đúng theo kế hoạch: `readValueChainAsOf` lấy tháng lớn nhất `<= mốc`; mốc 08 không có dòng nào `<= 08` nên rỗng. Kế hoạch cấm mang số từ tương lai (09) về quá khứ (08), nên không phải lỗi mang số.
- Mang số có hoạt động: mốc 09 chuỗi hiện 79,0% đúng; nếu có chuỗi ở tháng trước mốc thì được mang sang (đã có test `read-period-contract` và `pickAsOf`).
- Trang đang ghi "Chưa có số" ở tiêu đề thẻ nên người dùng không bị đánh lừa hoàn toàn, nhưng từng giai đoạn vẫn hiện "0,0%" và tổng "0,0%". Ghi là T-3 (thấp, hiển thị).
- Mốc mặc định KHÔNG phải 08 nữa: xem 3.4.

### 3.3 Ô Từ ngày/Đến ngày hiện mm/dd/yyyy
- Kết luận: không phải lỗi mã; là do giao diện ngôn ngữ của trình duyệt.
- Kiểm chứng: cùng trang, Chromium mặc định (UI en-US) hiện `10/01/2025` (mm/dd), Chromium chạy với `--lang=vi` hiện `01/10/2025` (dd/mm). `navigator.language` đều là `vi-VN` và `<html lang="vi">` nhưng ô `input[type=date]` gốc chỉ theo ngôn ngữ giao diện trình duyệt, không theo `lang` của trang hay `locale` của Playwright.
- Ảnh: `.bangiao/anh-p4-test/ngay-lang-vi.png` (dd/mm), `ngay-lang-mac-dinh.png` (mm/dd).
- Người dùng Việt dùng Chrome/Edge tiếng Việt sẽ thấy dd/mm/yyyy đúng D-1. Người dùng Việt dùng trình duyệt giao diện tiếng Anh vẫn thấy mm/dd/yyyy (rủi ro thấp, ghi T-6, chủ dự án quyết có cần ô tự dựng hay không).
- Dòng tóm tắt kỳ bên dưới luôn ghi dd/mm/yyyy nên không ai nhầm giá trị thật.

### 3.4 Mốc mặc định Chi tiết là 08/2026 khi hôm nay 29/09/2026
- Kết luận: đúng, mặc định hiện nay là 09/2026, không phải 08.
- Bằng chứng: `/vi/projects/1` không tham số hiện ô "Xem số liệu tại 09/2026", %TT 78,98% (đúng dòng `2026-09` trong DB), chuỗi 79,0%. Ảnh: `ct-1440-light.png`.
- Ảnh điều phối thấy 08/2026 là ảnh chụp từ `e2e/33-chi-tiet-moc.spec.ts` cố ý mở `?month=2026-08` (các ca ảnh dùng URL đó), không phải mặc định.
- Logic `resolveDetailTime` đã có test: mặc định = tháng lớn nhất có số và `<= min(cuối kỳ, hôm nay)`; nếu PIC chưa nhập tháng 09 thì mặc định sẽ là 08 (đúng thiết kế "tháng gần nhất có số").

## 4. Danh sách lỗi

### T-1 (thấp đến trung bình, bảo mật/hiệu năng cache) - `groupKey` rác phình khoá cache
- Test đỏ: `src/server/cache-key.test.ts` ca "groupKey KHÔNG kèm groupBy hợp lệ không ảnh hưởng kết quả ... (T-1)".
- Tái hiện: gọi `keysFor({ groupKey: 'gia-tri-ngau-nhien-123' })` (đúng đường page: `parseDashboardFilters` rồi loader) và so với `keysFor({})`: khoá khác nhau.
- Cụ thể: `parseDashboardFilters` giữ `groupKey` (cắt 100 ký tự) kể cả khi `groupBy` thiếu hoặc rác; `matchesGroup` chỉ áp khi có CẢ `groupKey` và `groupBy` nên kết quả y hệt, nhưng `filters` (có `groupKey`) đi nguyên vào khoá `unstable_cache` ở 7 loader.
- Hệ quả: `?groupKey=<chuỗi bất kỳ>` sinh vô hạn khoá cache (mỗi khoá lưu một bộ kết quả), đúng loại phình mà bài học N-2 muốn chặn.
- Cũng đúng khi `groupBy=team` và `groupKey` là tên nhóm không có thật (khoá riêng, kết quả rỗng).
- Nghi gốc: `src/lib/overview-params.ts` hàm `parseDashboardFilters` (giữ `groupKey` không điều kiện) và `src/server/cache.ts` (`key(periodKey(period), filters)`).
- Gợi ý sửa: chỉ giữ `groupKey` khi `groupBy` hợp lệ; tốt hơn là đối chiếu `groupKey` với danh sách nhóm thật (team theo dims, type/market theo enum), không khớp thì bỏ.

### T-2 (thấp, hiển thị/nhất quán) - trang Báo cáo không ghi kỳ, số khác Tổng quan
- Tái hiện: mở `/vi/report`: "Dự án trong kỳ 10, Đang triển khai 9, Trễ tiến độ 7, Đã phạt 0"; mở `/vi/overview`: 17, 15, 11, 3. Ảnh: `bc-1440-light.png`, `tq-1440-light.png`.
- Nguyên nhân: `app/[locale]/(app)/report/page.tsx` cố định `getReportData(currentMonth())` (kỳ = tháng hiện tại 09/2026), Tổng quan mặc định 12 tháng. Cả hai đều đúng theo kỳ của mình.
- Vấn đề: trang Báo cáo không hiện kỳ nào trên màn hình, nhãn vẫn ghi "Dự án trong kỳ", nên người xem tưởng hai trang lệch số.
- Nghi gốc: `app/[locale]/(app)/report/page.tsx` (thiếu dòng tóm tắt kỳ và chưa nhận `?from/&to`); nhãn delta "So tháng trước" đúng chỉ khi kỳ là 1 tháng.
- R1 (bảng chỉ liệt kê dự án trong kỳ, khớp thẻ) vẫn đúng: bảng 10 dòng khớp thẻ 10.

### T-3 (thấp, hiển thị) - chuỗi giá trị mốc chưa có số vẫn hiện "0,0%"
- Tái hiện: `/vi/projects/1?month=2026-08` (xem 3.2). Mọi giai đoạn hiện thanh rỗng kèm "0,0%" và tổng "0,0%" cùng dòng "Chưa có số" ở tiêu đề thẻ.
- Đề xuất: khi không có dòng chuỗi tại mốc, hiện "-" thay vì 0,0%, để không lẫn với "đã có số và bằng 0".
- Nghi gốc: khối chuỗi giá trị của `app/[locale]/(app)/projects/[id]/page.tsx` (nhánh `chain.length === 0`).

### T-4 (thấp, pixel) - dấu "?" rơi xuống dòng riêng ở nhãn KPI hẹp
- Tổng quan 390px sáng và tối: "DỰ ÁN TRONG KỲ" và "HĐ CHƯA KHỞI CÔNG" (dấu "?" xuống dòng 2). Ảnh: `.bangiao/anh-p4-test/cat/tq390L-00.png`, `cat/tq390D-00.png`.
- Tổng quan 1440px: "HĐ CHƯA KHỞI CÔNG ?" (ảnh `cat/tq1440D-00.png`) và Chi tiết 1440px thẻ "TỔNG SỐ NHÂN LỰC ?" (ảnh `cat/ct1440D-00.png`).
- Đây là lệch coder đã tự ghi ở `thay-doi.md` (cần sửa `globals.css`), tôi xác nhận còn nguyên.

### T-5 (thấp, pixel) - vài lệch khác ở 390px
- Chi tiết 390px: thanh "Xem số liệu tại" xuống dòng thành 3 hàng, nhãn "Từ ngày" căn phải còn "Đến ngày" căn trái, hai ô ngày lệch cột. Ảnh: `cat/ct390L-00.png`.
- Tổng quan 390px: thẻ "Sản lượng trong kỳ" xuống dòng chữ "tấn" (chiều cao hai thẻ nhóm 2 khác nhau, số 99.004 và "tấn" tách dòng). Ảnh: `cat/tq390L-00.png`, `cat/tq390L-01.png`.
- Tổng quan 390px: chart "Lượng & Trị theo Team KD" chỉ hiện 3 trên 5 nhãn trục X (P.KD 01, P.KD 05, P.KD EPC), mất P.KD 03 và P.KD 06 (Recharts tự lược nhãn). Ảnh: `cat/tq390L-01.png`.
- Chi tiết 390px: thanh Timeline KH/TT bị nhãn "100%" và "78,98%" đè lên chữ "29/09/202..." và "đang chạy". Ảnh: `cat/ct390L-01.png` (có thể có từ trước P4).

### T-6 (thông tin, không phải lỗi mã)
- Ô ngày gốc theo ngôn ngữ trình duyệt (xem 3.3).
- Chuỗi i18n `period.invalid` ("Kỳ không hợp lệ, đang dùng kỳ mặc định") có trong `vi.json` nhưng không nơi nào dùng: `?from=rác` rơi về kỳ mặc định im lặng, không báo người dùng. Nếu muốn báo thì cần code, không phải test.
- e2e chập chờn môi trường ở `10-ten-app` (xem mục 1).
- Ảnh e2e của coder (`32`, `33`) chụp trước khi animation xong nên ảnh chart trống ở `.bangiao/anh-p4/`; nên dùng ảnh của tôi trong `.bangiao/anh-p4-test/` để soi pixel.

## 5. Soi giao diện (1440px và 390px, sáng và tối)

- Đã soi Tổng quan, Chi tiết, Báo cáo ở cả 4 tổ hợp (1440 sáng/tối, 390 sáng/tối), chờ 3,5 giây cho chart vẽ xong; ảnh chart giữa chừng animation (vd S-curve có mép cắt) đã kiểm lại bằng ảnh độ phân giải cao sau khi vẽ xong: bình thường, không lỗi (`.bangiao/anh-p4-test/scurve-ct-dark.png`).
- Ảnh đầy đủ: `.bangiao/anh-p4-test/{tq,ct,bc}-{1440,390}-{light,dark}.png`; ảnh cắt lát theo chiều cao: `.bangiao/anh-p4-test/cat/`.
- Không thấy lỗi console ngoài cảnh báo hydration `nonce` của dev (script trong `<head>`, không phải lỗi P4) và huy hiệu "1 Issue" của Next dev.
- Tổng quan: chip, kỳ, KPI hai nhóm, chart, bảng có cột "Số liệu" đều hiện đúng; toàn bộ delta là "-" ở kỳ mặc định vì kỳ trước (10/2024 tới 09/2025) không có số (đúng thiết kế delta null).
- Viewer: không thấy thẻ doanh thu, HĐ chưa khởi công, S-curve, bảng tài chính (test đơn vị và e2e).

## 6. Lỗi sản phẩm cần coder sửa trước khi qua Reviewer

- T-1: bắt buộc (test đang đỏ).
- T-2, T-3: nên sửa, mức thấp.
- T-4, T-5: pixel, coder tự cân đối (T-4 cần `globals.css`).
