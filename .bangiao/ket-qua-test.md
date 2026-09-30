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

---

# P4 - Kết quả kiểm thử đợt 3 (tester, nhóm F nhập bù + nhóm G)

Nhánh `feature/p4-logic-bo-loc`, gốc `e873042`, DB `ddc_control_tower_c`, dev server cổng 3003 (chạy tay với `NODE_OPTIONS=--max-old-space-size=6144`, không tự chết suốt suite).
Skill đã dùng: `test-driven-development`, `verification-before-completion`.
Tôi chỉ thêm file test, không sửa code sản phẩm.
Kết luận: KHÔNG xanh hết.
Có 2 lỗi sản phẩm ở ô ngày `DateField` (T-7, T-8), giữ đỏ có chủ đích (5 test đỏ).
Toàn bộ logic nhập bù ở server (4 đường ghi, IDOR, biên, hết hạn, khoá sổ, nhãn nhật ký, Excel, race) xanh.

## 1. Kết quả số thật

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test` (không đặt `DATABASE_URL`), lần chạy đầu: 308 file (299 xanh, 2 đỏ, 7 bỏ qua); 3626 test (3553 xanh, 3 đỏ, 70 bỏ qua).
- Trong 3 ca đỏ đó, 1 ca là chập chờn do CHÍNH test của tôi (`getAuditLog` sắp theo mili giây nên thứ tự enable/disable không ổn định). Đã sửa (so sánh theo tập), chạy lại file 6 lần liền xanh. Còn 2 ca đỏ có chủ đích (T-7).
- `npx vitest run` với `DATABASE_URL` của DB `_c` (chạy cả real-db): 308 file (307 xanh, 1 đỏ); 3626 test (3623 xanh, 2 đỏ là đúng 2 ca T-7, 1 bỏ qua).
- Sau khi chạy, DB `_c` không còn dòng `test-p4-%`, khoảng nhập bù, audit, activity rác, và tháng 2026-03 vẫn khoá đủ (kiểm bằng `mcp__postgres`, chỉ đọc).
- e2e toàn bộ (`npx playwright test`, cổng 3003, DB `_c`): 317 xanh, 3 đỏ, 0 bỏ qua, 26,4 phút. Ba ca đỏ đều là ca có chủ đích của tôi ở `e2e/36-datefield-form.spec.ts` (T-7 một ca, T-8 hai ca). 0 chập chờn, 0 lỗi `ECONNREFUSED`.
- `npm run build` với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js`: exit 0, chỉ có cảnh báo webpack cache của `next-intl` (có sẵn). Đã xoá `.next` sau build và tắt dev server do tôi khởi động.
- Không có script `lint` trong `package.json`, nên không chạy lint.

## 2. File test đã thêm

- `src/server/backfill-tester.qa.test.ts` (56 ca, mock repo).
  - Quyền và IDOR trên 4 đường ghi (lưu ngày, lưu tháng, commit Excel ngày, commit Excel tháng) cho viewer, bod, chưa đăng nhập, data-entry không được gán.
  - Khoảng dự án 1 không mở dự án 16 (không được gán) và không mở dự án 2 (được gán nhưng không có khoảng).
  - Biên ngày: trước from, đúng from, đúng to, hôm sau to, khoảng 1 ngày, 2 khoảng rời nhau, today-7 và today-8, khoảng lọt vào tương lai vẫn chặn quá max.
  - Biên khoảng: to = hôm nay, to = mai, from > to, đúng 24 tháng, 25 tháng, ghi chú 4/5/500/501 ký tự và toàn khoảng trắng, đối số sai kiểu, chuỗi SQL, năm 0000/9999, 5 kiểu khoảng chồng, bấm bật hai lần.
  - Hết hạn đúng mốc 30 ngày (Date giả), tắt rồi bật lại, tắt khoảng dự án 1 không đóng dự án 2.
  - Biên tháng: khoảng 31/03 đến 02/04 mở cả 03 và 04, tháng tương lai bị chặn, luật thuần "tháng trước" vào tháng 1.
  - Khoá sổ: tháng khoá luôn `locked` (kể cả admin), khoảng chạy qua tháng khoá và tháng mở.
  - Nhãn `audit_log` và `activity_log` cho cả 4 đường và bật/tắt, bản dịch vi/en của mọi nhãn nhập bù.
  - Excel ngày có dòng ngoài khoảng, Excel tháng hai dự án chỉ một có khoảng.
- `src/server/backfill-tester-real-db.qa.test.ts` (12 ca, Postgres thật qua server action, skip khi không có `DATABASE_URL`).
  - Luồng bật, lưu ngày, lưu tháng, commit Excel tháng; IDOR trên DB thật.
  - Hết hạn thật (đổi `expiresAt` về quá khứ, kể cả đúng bằng bây giờ).
  - Khoá sổ thật (mở khoá tạm tháng 2026-03 rồi trả nguyên `snapshotLockedAt`).
  - Ba ca race.
- `src/lib/date-input-tester.qa.test.ts` (9 ca): chuỗi phím qua `maskDmy` rồi `parseDmy` đúng như `DateField` làm; 2 ca đỏ T-7.
- `e2e/36-datefield-form.spec.ts` (13 ca, 10 xanh, 3 đỏ): `DateField` ở Sửa dự án, Tạo dự án, Mốc chính, Kế hoạch thiết bị; 3 ca đỏ (T-7, T-8).
- `e2e/37-p4-f-anh.spec.ts` (28 ca xanh): chụp và tự kiểm (không cuộn ngang, không `pageerror`, badge không rớt dòng, thẻ nhập bù không tràn) cho Tổng quan, Chi tiết, Báo cáo, Nhập liệu (2 bước), Hồ sơ dự án ở 1440 và 390, sáng và tối. Ảnh ở `.bangiao/anh-p4-f/` (32 ảnh, chưa commit như các thư mục ảnh trước).
- `src/server/perf-period-bench.qa.test.ts` (4 ca, skip khi không có `DATABASE_URL`): đo hiệu năng theo kỳ 1, 12, 120 tháng.

## 3. Lỗi sản phẩm cần coder sửa

### T-7 (thấp đến trung bình, nhập ngày) - gõ hoặc dán "1/2/2026" thành "12/20/26" rồi báo sai

- Test đỏ: `src/lib/date-input-tester.qa.test.ts` 2 ca "(BUG T-7)", và `e2e/36-datefield-form.spec.ts` ca "(BUG T-7) dan 1/2/2026".
- Nguyên nhân: `parseDmy` chấp nhận d/m/yyyy, nhưng mọi ký tự gõ hay dán trong `DateField` đều qua `maskDmy` (chỉ giữ chữ số rồi chèn "/") trước khi tới `parseDmy`. "1/2/2026" thành chữ số `122026`, rồi `12/20/26`, và bị báo "Ngày không hợp lệ".
- Ảnh hưởng: người dùng gõ ngày không đệm số 0, hoặc dán ngày dạng d/m/yyyy từ Excel, đều bị báo lỗi. Gõ đủ `01/02/2026` hoặc 8 chữ số liền thì đúng.
- Nghi gốc: `src/lib/date-input.ts` `maskDmy` (dòng 22-28) và `DateField.tsx` `onChange` (`setText(maskDmy(...))`).

### T-8 (trung bình, mất dữ liệu nhập im lặng) - sau Enter, lần rời ô kế tiếp không được áp dụng

- Test đỏ: `e2e/36-datefield-form.spec.ts` hai ca "(BUG T-8)".
- Tái hiện 1: ở Sửa dự án, ô Ngày ký HĐ gõ `20112025` rồi Enter (đúng), gõ tiếp `21112025` rồi bấm "Lưu thay đổi" (không Enter lần 2). DB vẫn giữ 2025-11-20, giá trị sửa sau cùng bị mất mà không báo gì.
- Tái hiện 2: gõ `31022026` rồi Enter (báo lỗi), gõ tiếp `3102` rồi Tab. Không báo lỗi lần 2.
- Nguyên nhân: `onKeyDown` Enter đặt `skipBlur.current = true` để bỏ qua blur kế tiếp, nhưng Enter không làm ô mất tiêu điểm nên cờ không bao giờ được reset. Lần rời ô THẬT sau đó (Tab hoặc bấm nút Lưu) bị nuốt.
- Ở trang mới, chưa từng Enter, thì Tab và bấm Lưu đều đúng (đã có ca xanh chứng minh).
- Nghi gốc: `src/components/ui/DateField.tsx` (`skipBlur`, `onKeyDown`, `onBlur`).

## 4. Lệch pixel và điểm nhỏ (không có test đỏ)

- P-1 (pixel, thẻ nhập bù ở Hồ sơ dự án, code sản phẩm): tiêu đề "Nhập bù lịch sử" bị ép hẹp cạnh câu mô tả. Ở 1440px rớt thành "Nhập bù lịch / sử", ở 390px thành 4 dòng "Nhập / bù / lịch / sử". Ảnh: `.bangiao/anh-p4-f/hs-the-1440-light.png`, `hs-the-390-dark.png`. Nghi gốc: `BackfillPanel.tsx` (`.fsec .h` xếp h4 và p cạnh nhau). Gợi ý: cho h4 không co (`white-space: nowrap`) hoặc xếp p xuống dưới ở màn hẹp.
- P-2 (thấp, có sẵn từ trước P4): ô `input[type=month]` gốc ở "Kế hoạch nhân lực theo tháng" hiện "January 2027" (tiếng Anh) trên trang tiếng Việt, vì theo ngôn ngữ giao diện trình duyệt. Cùng gốc với T-6 vòng trước. Ảnh: `nl-1440-light.png`.
- P-3 (thấp, có sẵn): ở 390px nhãn "Áp dụng" của bước "Tiến độ tháng" rớt 2 dòng, ô chọn dự án cắt chữ "10626-00...". Ảnh: `nl-thang-390-light.png`.
- Đã soi và không thấy lệch: badge vàng "Đang nhập bù" một dòng ở 1440 và 390, sáng và tối; thẻ nhập bù không tràn khung (kiểm bằng script cho mọi phần tử con); ô ngày dd/mm/yyyy và biểu tượng lịch thẳng hàng; Tổng quan, Chi tiết, Báo cáo giữ nguyên các chỗ đã sửa ở vòng trước (dấu "?" không rớt dòng, hai thẻ Doanh thu và Sản lượng cùng cao).
- Ảnh `fullPage` có dải nền gradient cắt ở mép viewport và huy hiệu "1 Issue" của Next dev đè lên nội dung: do chụp full page với nền `fixed` ở chế độ dev, không phải lỗi sản phẩm.

## 5. Điểm lệch coder nêu: bước xem trước Excel

- Tên hàm trong `thay-doi.md` là `previewImportAction`, nhưng hàm thật của Excel THÁNG là `importExcelAction` (Excel NGÀY là `previewDailyImportAction`).
- `importExcelAction` không nhận tham số tháng nên KHÔNG thể báo `out_of_window`. Kiểm thực tế: PIC xem trước file có dự án được gán vẫn `mapped`, `reason: null`, bất kể dự án đó có khoảng nhập bù hay không.
- Luật tháng chỉ chặn ở `commitImportAction`: dự án ngoài khoảng vào mảng `failed` với `reason: 'out_of_window'`, dự án có khoảng vẫn ghi. Đã khoá bằng ca "MO TA HANH VI".
- Excel NGÀY khác: `previewDailyImportAction` báo `out_of_window` đúng dòng, dòng khác vẫn `ok`, commit chặn cả lô nếu có ngày ngoài khoảng. Ca xanh.
- Kết luận: hành vi đúng kế hoạch F4 ("sau lọc owned" ở commit). Nếu chủ dự án muốn báo sớm ở bước xem trước Excel tháng thì cần thêm ô chọn tháng ở bước xem trước, đó là việc code.

## 6. Ca race thật

- Ca cũ của coder (3 lần tạo đồng thời cùng khoảng) không phát hiện được việc bỏ khoá. Tôi đo độ nhạy: dựng bản sao logic KHÔNG khoá dòng `dim_project` (kiểm trùng rồi ghi, cùng transaction READ COMMITTED) và cho 6 lần tạo đồng thời. Có 2 khoảng thành công ở 29 trên 30 vòng. (Phép đo chạy bằng script tạm, đã xoá, dữ liệu tạm đã dọn.)
- Trên code sản phẩm (có `FOR UPDATE`), ca mới của tôi (6 lần bật đồng thời, 15 vòng): mỗi vòng đúng 1 thành công, 5 `overlap`, đúng 1 dòng hiệu lực.
- Ca 4 khoảng gác nhau đồng thời (10 vòng): không bao giờ có 2 khoảng hiệu lực chồng nhau.
- Ca 5 lần tắt cùng 1 khoảng đồng thời: 1 `ok`, 4 `already`, đúng 1 dòng audit `disable`.
- Bản không khoá đỏ 29/30 còn bản có khoá xanh 15/15, nên ca mới chứng minh được khoá có tác dụng (khác ca cũ chỉ là kiểm khói).

## 7. G1: hiệu năng

DB `_c`, seed thường: 17 dự án, 204 dòng `fact_progress_monthly`, 204 `fact_financial`, 84 `fact_daily_manpower`, 70 `fact_daily_equipment_usage`.
`EXPLAIN (ANALYZE, BUFFERS)` chạy trong transaction chỉ đọc. Có thêm bản `SET LOCAL enable_seqscan = off` để xem index có dùng được không, vì bảng quá nhỏ nên planner chọn Seq Scan là hợp lý.

| Hàm | Kế hoạch chọn | Thời gian thực thi | Buffers |
|---|---|---|---|
| `readFactSnapshotsAsOf('2026-09')` | Nested Loop, Index Scan Backward `ux_fact_progress_latest` (LATERAL LIMIT 1, 17 vòng) | 0,090 ms | shared hit 52 |
| `readFactSeries` kỳ 120 tháng, 17 dự án | Append: Seq Scan (bảng 204 dòng) + LATERAL Index Scan `ux_fact_progress_latest`. Ép tắt seqscan thì Bitmap Index Scan trên cùng index | 0,180 ms (ép index 0,194 ms) | 47 (ép index 75) |
| `readFactSeries` kỳ 12 tháng | như trên | 0,164 ms | 41 |
| `readRevenueInRange` 120 tháng | HashAggregate trên Seq Scan. Ép tắt seqscan thì Bitmap Index Scan `fact_financial_yearMonth_projectId_idx` | 0,093 ms (ép index 0,110 ms) | 4 (ép index 8) |
| `readLastDailyDate` nhân lực (dự án 1) | Index Only Scan Backward `fact_daily_manpower_projectId_workDate_idx`, Heap Fetches 0 | 0,542 ms lần đầu, 0,023 ms lần sau | 2 |
| `readLastDailyDate` thiết bị (dự án 1) | Index Only Scan Backward `fact_daily_equipment_usage_projectId_workDate_idx`, Heap Fetches 0 | 0,122 ms | 2 |

Ý nghĩa: cả 4 truy vấn có index dùng được và dùng đúng (LATERAL với `ORDER BY ... DESC LIMIT 1` đi theo index, `readLastDailyDate` là index-only).
Với bảng 200 dòng, Seq Scan ở `readFactSeries` và `readRevenueInRange` là lựa chọn đúng của planner, chưa nói được gì về quy mô lớn.

`npx tsx scripts/perf/bench-data.ts` KHÔNG chạy được trên DB `_c`.
Script in "Khong tim thay du an PERF-0001 - chay `npm run perf:seed` truoc." rồi thoát, vì cần dự án PERF-0001 của `perf:seed`, chỉ chạy được trên DB `_b` (đúng guard).
Script cũng hardcode tháng hiện tại và `'all'` (kỳ rác, rơi về mặc định), không nhận kỳ 12 hay 120 tháng.
Vì vậy tôi thêm `src/server/perf-period-bench.qa.test.ts` đo đúng các hàm của trang Tổng quan (không qua `unstable_cache`, 5 vòng, ms):

| Kỳ | Hàm chậm nhất theo median | Cả trang (Promise.all) median / max |
|---|---|---|
| 1 tháng (09/2026) | `getPortfolioKpis` 6 (max 218 ở vòng đầu nạp module) | 15 / 17 |
| 12 tháng (10/2025 đến 09/2026) | `getPortfolioKpis` 4 | 14 / 16 |
| 120 tháng (10/2016 đến 09/2026) | `getSpiCpiTrend` 3 | 15 / 18 |

Kỳ 120 tháng không chậm hơn 12 tháng rõ rệt trên dữ liệu seed. Bảng từng hàm đầy đủ in ra khi chạy file.

GIỚI HẠN: seed `_c` chỉ có 17 dự án và khoảng 200 dòng mỗi bảng fact, nên CHƯA đo trên 10 triệu dòng.
Số đo 10 triệu dòng cần `npm run perf:seed` trên DB `_b`. Guard chỉ cho DB `_b`, tôi không chạy và không nới guard, không đụng DB `_a`, `_b`.
Điều phối cần nhờ chủ dự án cho phép hoặc nhờ B đo trên `_b` nếu muốn có số đó.
Chưa đo trang Chi tiết theo kỳ dài.

## 8. Việc bỏ qua hoặc chưa kiểm

- Chưa kiểm chạm lịch gốc trên điện thoại thật (iOS Safari, Android Chrome): không có thiết bị, chỉ có Chromium desktop và viewport 390px.
- Chưa kiểm ô ngày với trình duyệt giao diện tiếng Anh. Ô là `input[type=text]` nên về nguyên lý độc lập ngôn ngữ, nhưng chỉ chạy ở Chromium mặc định.
- Chưa kiểm mutation trên code sản phẩm (không được sửa code sản phẩm). Độ nhạy chỉ chứng minh cho ca race (mục 6); các ca khác dựa vào việc khẳng định giá trị cụ thể (mã lỗi, `recordId`, `action`).
- Đã soi ảnh bằng mắt: Tổng quan 1440 tối, Chi tiết 390 sáng, Báo cáo 1440 sáng, Nhập liệu 1440 sáng và 390 tối, Nhập liệu tháng 390 sáng, Hồ sơ 390 sáng, các thẻ nhập bù ở 1440 sáng và 390 tối. Các tổ hợp còn lại chỉ được kiểm bằng script (không cuộn ngang, không lỗi trang), chưa nhìn bằng mắt.

## 9. Việc coder cần làm trước khi qua Reviewer

- T-8: bắt buộc (mất dữ liệu nhập im lặng, 2 test đỏ).
- T-7: nên sửa (1 e2e và 2 unit đỏ).
- P-1: nên sửa (pixel, thẻ nhập bù).
- P-2, P-3: tuỳ coder.
