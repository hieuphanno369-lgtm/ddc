# P4 - Logic số liệu, lọc kỳ, mốc thời gian, nhập bù (Kế hoạch triển khai)

> Dành cho coder (dây chuyền `ddc-tower:ship`): làm từng task theo thứ tự, mỗi bước có checkbox `- [ ]`.
> Coder chỉ đọc file này, nên mọi quy ước cần thiết đều ghi rõ tên file để copy.

**Mục tiêu:** Mọi số trên 2 trang Tổng quan và Chi tiết được tính tại đúng một mốc/kỳ thời gian (không trộn "hôm nay" với "tháng đang xem"), có bộ lọc kỳ ngày-ngày, bộ chọn mốc ở trang Chi tiết, icon "?" giải thích, và cơ chế nhập bù lịch sử theo dự án.

**Kiến trúc:** Thêm 1 tầng thời gian thuần (`src/lib/period.ts`, `src/lib/as-of.ts`) + các hàm đọc mới trong read repo (`read-prisma.ts`/`read-mock.ts`, KHÔNG phải file nóng).
`src/server/queries.ts` chuyển từ tham số `yearMonth: string` sang `period: Period` và dùng "số gần nhất <= mốc" (mang số tháng trước sang).
Giao diện giữ nguyên style kính mờ hiện tại, chỉ đổi logic; mọi thay đổi bố cục/chart chỉ làm SAU KHI chủ dự án duyệt (mục 0.1).

**Tech stack (đúng bản trên đĩa, xem `package.json`):** Next 15.5.26 app router, React 19.3, Prisma 6.19, next-intl 4.14.7, Recharts 2.15.4, Vitest 2.1.1, Playwright 1.63.
Lưu ý: `CLAUDE.md` ghi "Next 14" nhưng `package.json` là 15.5.26; `searchParams`/`params` là Promise (đã dùng `await` ở các page).

**Yêu cầu gốc:** `D:\_project\DDC_dieu-phoi\lenh-cho-C-2026-09-28-p4.md` PHẦN 1 (ràng buộc), 1b (P4-T), 1c (P4-K), 1d (L-1..L-5, F-1..F-6, "?"), mục "CẬP NHẬT CHỦ DỰ ÁN 2026-09-29 ~00:40".

## Ràng buộc toàn cục (mọi task phải giữ)

- KHÔNG redesign style: không sửa token trong `app/globals.css`, không làm P4-0, giữ kính mờ, màu, font, bo góc, bóng.
- Không thêm/bớt/đổi chỗ thẻ, đổi loại chart, đổi tên chỉ số khi mục tương ứng ở 0.1 chưa được chủ dự án duyệt.
- Rule Priority đã chốt trên `main` (P0 vàng nhấn, P1 navy, P2/P3 xám; thẻ Top chỉ tên + "%TT · %KH") không đổi.
- `TopPriorityCard`/`ProjectListCard` luôn qua `maskProjectSummaries` (`src/lib/finance-gate.ts`); ẩn tiền theo `canViewFinance` không đổi.
- Mọi page gọi `requireUser` trước mọi lời gọi hàm khác (test `src/server/app-pages-require-user.test.ts`); trang Chi tiết giữ `requireProjectRead(user, id)` trước khi đọc dữ liệu; `projectId` kiểm `/^[1-9]\d*$/`.
- Chuỗi giá trị lấy giai đoạn từ `dim_stage` (`repo.getStages()`), không hằng số 7 giai đoạn.
- Chart T4/T5 ở trang Chi tiết giữ; bấm thẻ KPI nguồn lực (`href="#res-manpower"`, `#res-equipment`) vẫn cuộn tới chart.
- Hiệu năng T1: không thêm truy vấn N+1 (test `src/server/queries-n1.test.ts`), gom đọc độc lập vào `Promise.all` như trang Chi tiết đang làm.
- Khoá `unstable_cache` chỉ nhận giá trị đã validate (bài học N-2 ở `app/[locale]/(app)/overview/page.tsx` dòng 51-55).
- Không thêm `iframe` hay `canvas` tuỳ biến (P4-X của B chụp DOM); chart dùng Recharts SVG như hiện tại.
- Không sửa `src/components/icons/index.tsx`, trang đăng nhập/đăng ký, `middleware.ts` (của B).
- Không dùng dấu gạch dài em/en dash ở code, comment, i18n, commit.
- Commit message tiếng Việt không dấu theo lịch sử repo (vd `feat(p4-k): ...`, `fix(p4-l1): ...`), giữ dòng `Co-Authored-By`.
- Sau MỖI commit cập nhật `D:\_project\DDC_dieu-phoi\phien-C.md` (task, commit, file nóng đang giữ).

---

## 0. CÂU HỎI CÒN BỎ NGỎ (chặn code, phải có trả lời của chủ dự án)

Nhóm A (Task A1-A3) KHÔNG phụ thuộc câu trả lời nào, coder làm trước được.
Nhóm B cần câu Q1, Q2, Q3, Q4, Q5.
Nhóm C, D cần mục 0.1 được duyệt.
Nhóm F cần Q9-Q13.

### 0.1 CẦN CHỦ DỰ ÁN DUYỆT TRƯỚC KHI CODE (thay đổi bố cục hoặc chart)

Mỗi mục: mô tả nghiệp vụ + phương án đề xuất. Chủ dự án trả lời "Duyệt" / "Không" / "Sửa: ..." cho từng mã.

**Trang Tổng quan**

- **D-1 Thanh lọc kỳ thay ô chọn tháng.** Bỏ ô chọn tháng và lựa chọn "Tất cả" (L-4); thay bằng 2 ô ngày "Từ ngày" / "Đến ngày" (dd/mm/yyyy) ở đầu thanh lọc, cùng hàng với các ô lọc khác. Đề xuất: Duyệt.
- **D-2 Dòng "Kỳ báo cáo" dưới thanh lọc.** Một dòng chữ nhỏ (kiểu `hintline` đang có) ghi: "Kỳ 01/07/2026 - 16/09/2026 · số theo tháng tính trọn 07/2026 - 09/2026 · số tồn tại 16/09/2026". Đây là yêu cầu "ghi rõ khoảng tháng thực tế được tính" đã chốt, chỉ hỏi vị trí. Đề xuất: đặt ngay dưới thanh lọc.
- **D-3 Ô lọc dạng chip có tên chiều lọc (F-4).** Ô "Trạng thái" khi đã chọn hiện "Trạng thái: Đang triển khai ▾" thay vì chỉ "Đang triển khai"; nút "✕ Lọc" đổi thành "Xoá tất cả lọc"; thêm chữ đếm "12 / 17 dự án". Vẫn dùng ô chọn `select.inp` hiện tại, chỉ đổi chữ hiển thị. Đề xuất: Duyệt.
- **D-4 Chip "Từ biểu đồ: ..." (F-3).** Khi bấm cột biểu đồ "Lượng & Trị theo ..." hoặc lát donut, thanh lọc hiện chip "Từ biểu đồ: Team A ✕" để người xem biết số đang bị thu hẹp và bỏ được. Đề xuất: Duyệt.
- **D-5 Đổi tên "Tổng số dự án" thành "Dự án trong kỳ" (L-5).** Số đếm chỉ gồm dự án có hoạt động giao với kỳ. Đề xuất: Duyệt.
- **D-6 Đổi tên "Backlog" thành "HĐ chưa khởi công".** Cả ở KPI và thẻ "Backlog & công nợ quá hạn". Đề xuất: Duyệt (định nghĩa chốt 2026-09-24 khác nghĩa backlog thông dụng).
- **D-7 Tách KPI thành 2 nhóm có tiêu đề.** Nhóm "Đang thế nào?" (số tại cuối kỳ: Dự án trong kỳ, Đang triển khai, Chậm tiến độ, Nguy cơ phạt, Đã bị phạt, HĐ chưa khởi công) và nhóm "Làm được bao nhiêu trong kỳ?" (số cộng dồn trong kỳ: Doanh thu trong kỳ, Sản lượng trong kỳ). Nhóm 2 là 2 thẻ KPI MỚI (hiện chưa có); Doanh thu chỉ hiện với người được xem tiền. Đề xuất: Duyệt, dùng lại thẻ `KpiCard` và lưới `.kpis` hiện có.
- **D-8 Thẻ KPI 3 dòng.** Tên + "?", số lớn, 1 dòng diễn giải (vd "trên 8 dự án đang triển khai"), delta ghi rõ "so với kỳ trước cùng độ dài" (phụ thuộc Q2). Đề xuất: Duyệt.
- **D-9 Chart S-curve và SPI/CPI danh mục chạy theo kỳ (F-2).** Trục tháng = các tháng trong kỳ (bỏ cố định 12 tháng, bỏ cắt 6 tháng ở SPI/CPI). Việc chạy theo kỳ đã chốt ở 1c; hỏi thêm: khi kỳ chỉ 1 tháng, chart chỉ còn 1 điểm. Đề xuất: vẫn vẽ 1 điểm, có chữ "Kỳ chỉ có 1 tháng" dưới chart.
- **D-10 Tháng mang số sang vẽ nét đứt.** Ở S-curve/SPI-CPI, đoạn tới tháng mà có dự án dùng số tháng trước được vẽ nét đứt, tooltip ghi "3 dự án dùng số tháng trước". Đề xuất: Duyệt.
- **D-11 Dòng "Cách đọc" dưới mỗi chart + tên trục/đơn vị.** Thêm 1 dòng chữ nhỏ dưới chart và nhãn đơn vị trục Y (tỷ đồng, tấn, chỉ số). Đề xuất: Duyệt.
- **D-12 Cột "Số liệu" ở bảng danh sách dự án.** Giá trị: "Tháng 09" / "Dùng số tháng 08" / "Hoàn thành 05/2026" / "Chưa có số". Thêm 1 cột vào `ProjectTable`. Đề xuất: Duyệt, đặt sau cột "% TT".
- **D-13 Thẻ "Sản lượng vs công suất" theo kỳ.** Sản lượng = cộng các tháng trong kỳ, công suất = công suất tháng × số tháng trong kỳ; tiêu đề ghi số tháng. Đề xuất: Duyệt.

**Trang Chi tiết**

- **D-14 Bộ chọn mốc tháng đầu trang (P4-T đã chốt, hỏi vị trí).** Ô chọn tháng + nút "‹" "›" ngay dưới dòng breadcrumb, bên trái; kèm 2 ô kỳ "Từ ngày/Đến ngày" như Tổng quan (P4-K áp cho Chi tiết). Đề xuất: 1 thẻ lọc giống `FilterBar` Tổng quan, chỉ có kỳ + mốc.
- **D-15 Điều hướng ngày cho nhóm nguồn lực.** Thanh nhỏ ở đầu khu "Huy động nguồn lực": "‹ Tuần trước · [ô chọn ngày] · Tuần sau ›" điều khiển thẻ KPI Nhân lực/Thiết bị, "Nhân lực theo nhà thầu", "Thiết bị theo nhóm", "Tracking 7 ngày". Đề xuất: Duyệt.
- **D-16 Dòng "Số tại ..." trên từng thẻ (F-5).** Mỗi thẻ ghi mốc của số: "Số tại 08/2026" (theo tháng) hoặc "Số ngày 14/09/2026" (theo ngày) hoặc "Dùng số tháng 07/2026". Đề xuất: dùng `subtitle` của `CardHeader` có sẵn.
- **D-17 Gộp "Chậm N ngày" và "Chênh lệch x%" thành 1 câu (F-6).** Thẻ %TT và chân timeline cùng hiện "Chậm 21 ngày (9 điểm %)". Đề xuất: Duyệt; ô "Chênh lệch" ở chân timeline đổi thành câu này.
- **D-18 Đổi tên tiêu đề "S-curve PV/EV/AC (12 tháng)" và "SPI/CPI trend (12 tháng)".** Thành "S-curve PV/EV/AC" và "Xu hướng SPI/CPI", phụ đề ghi khoảng tháng đang vẽ. Đề xuất: Duyệt.
- **D-19 Vạch đánh dấu mốc đang xem trên chart thời gian.** Vạch dọc nét đứt màu đỏ (giống vạch "Hôm nay" đang có) tại tháng mốc trên S-curve, SPI/CPI, KH nhân lực theo tháng, Nhân lực theo tuần. Đề xuất: Duyệt.
- **D-20 Kéo chọn khoảng thời gian trên chart dài (P4-T mục 4).** Thanh kéo nhỏ dưới S-curve và SPI/CPI (Recharts `Brush`, vẫn là SVG). Hỏi thêm: kéo xong chỉ phóng to chart hay đổi luôn kỳ của cả trang? Đề xuất: chỉ phóng to chart đó, không đổi URL (đơn giản, không làm người xem lạc kỳ).
- **D-21 Bảng tài chính theo kỳ.** Thay "6 tháng cuối" bằng các tháng trong kỳ tới mốc, mới nhất trên cùng, thẻ cuộn khi dài. Đề xuất: Duyệt.
- **D-22 Ô chọn tháng bên trong chart "Nhân lực theo tuần".** Chart đang có ô chọn tháng riêng. Đề xuất: giữ ô đó làm "cuộn tới tháng", mặc định theo mốc trang (không bỏ, để không đổi bố cục chart).
- **D-23 Link từ Tổng quan sang Chi tiết mang theo kỳ.** Bấm tên dự án ở Tổng quan mở Chi tiết cùng kỳ. Đề xuất: Duyệt.

**Nhập liệu / Quản trị**

- **D-24 Thẻ "Nhập bù lịch sử" cho admin.** Đặt ở trang Hồ sơ dự án (`/ho-so-du-an?project=<id>`), chỉ admin thấy: chọn "Từ ngày/Đến ngày", ghi chú, nút "Bật nhập bù"; danh sách khoảng đang bật + nút "Tắt". Đề xuất: Hồ sơ dự án (đúng ngữ cảnh 1 dự án), không đặt ở trang Quản trị.
- **D-25 Nhãn "Đang nhập bù" ở trang Nhập liệu.** Khi dự án có khoảng nhập bù đang bật, trang Nhập liệu hiện badge vàng "Đang nhập bù 01/01/2026 - 30/06/2026" cạnh tên dự án, ô chọn ngày/tháng mở thêm các ngày trong khoảng. Đề xuất: Duyệt.

**Icon "?"** - chủ dự án đã yêu cầu ở 1d nên không hỏi bố cục; nội dung chữ ở Task E2, nhờ chủ dự án đọc duyệt câu chữ cùng lúc.

### 0.2 Câu hỏi nghiệp vụ (mỗi câu chọn 1 phương án)

- **Q1 Kỳ mặc định khi mở Tổng quan (không có tham số kỳ trên URL).**
  (a) Tháng hiện tại: 01 của tháng đến hôm nay.
  (b) Từ đầu năm (01/01) đến hôm nay.
  **(c) 12 tháng gần nhất: ngày 01 của tháng cách 11 tháng đến hôm nay - ĐỀ XUẤT.** Lý do: chart xu hướng giữ đúng 12 tháng người dùng đang quen, số tồn vẫn là "tại hôm nay" như hiện tại; (a) làm chart chỉ còn 1 điểm.
  (d) Quý hiện tại.
- **Q2 Delta (mũi tên tăng/giảm) trên KPI khi lọc kỳ.**
  **(a) So với kỳ liền trước cùng độ dài: số tồn so với cuối kỳ trước, số phát sinh so với tổng kỳ trước - ĐỀ XUẤT.** Lý do: 1 quy tắc cho mọi kỳ, nhãn ghi rõ "so với kỳ trước cùng độ dài".
  (b) Bỏ delta khi đang lọc kỳ, chỉ hiện khi kỳ đúng 1 tháng.
  (c) So với cùng kỳ năm trước.
  (d) Số tồn so với cuối tháng trước mốc (giống hiện tại), số phát sinh không có delta.
- **Q3 "HĐ chưa khởi công" có phụ thuộc kỳ không?** Theo định nghĩa "dự án thuộc kỳ", một HĐ đã ký nhưng kế hoạch khởi công năm sau sẽ không nằm trong kỳ nên bị loại khỏi tổng.
  **(a) Không phụ thuộc kỳ: cộng mọi dự án đã ký HĐ (ngày ký <= cuối kỳ, thiếu ngày ký thì vẫn tính) và chưa khởi công tại cuối kỳ - ĐỀ XUẤT.** Lý do: đây là "hàng trong kho" tại 1 thời điểm, là số tồn.
  (b) Chỉ dự án thuộc kỳ.
- **Q4 Dự án thiếu cả ngày bắt đầu thực tế lẫn kế hoạch có "thuộc kỳ" không?**
  **(a) Có: coi như bắt đầu từ ngày ký HĐ, thiếu cả ngày ký thì luôn thuộc mọi kỳ - ĐỀ XUẤT.** Lý do: không để dự án "biến mất" chỉ vì thiếu dữ liệu nhập.
  (b) Không: loại khỏi mọi kỳ cho tới khi nhập ngày.
  Ghi chú kỹ thuật (không cần trả lời): thiếu ngày kết thúc (thực tế và kế hoạch) thì coi là còn chạy tới nay.
- **Q5 "Đã bị phạt" khi xem kỳ trong quá khứ.** Hệ thống chỉ lưu cờ "đã bị phạt" hiện tại, không lưu ngày bị phạt, nên xem kỳ cũ vẫn thấy dự án bị phạt về sau là "Đã bị phạt".
  **(a) Giữ cờ hiện tại, "?" của thẻ ghi rõ "theo tình trạng hiện tại, không theo kỳ" - ĐỀ XUẤT cho P4.** Lý do: không đụng schema/nhập liệu ở phần này.
  (b) Thêm trường "Ngày bị phạt" vào hồ sơ dự án (đụng schema + form Hồ sơ), đếm theo ngày đó.
- **Q6 Mặc định trang Chi tiết có kỳ không, và chart "cả vòng đời" theo kỳ hay theo cả đời dự án?** (1b mục 4 nói chart cả vòng đời + vạch mốc; 1c mục 6 nói Chi tiết cũng lọc kỳ.)
  **(a) Mặc định kỳ = cả vòng đời dự án (từ tháng đầu có số hoặc ngày bắt đầu, tới hôm nay); người dùng thu hẹp kỳ thì mọi chart theo kỳ - ĐỀ XUẤT.** Lý do: mở trang vẫn thấy cả đời dự án như 1b, lọc kỳ vẫn đúng 1c.
  (b) Chart cả vòng đời luôn vẽ cả đời dự án, kỳ chỉ ảnh hưởng số tổng/bảng tài chính.
  (c) Mặc định kỳ = 12 tháng gần nhất như Tổng quan.
- **Q7 Chọn 1 ngày ở nhóm nguồn lực mà ngày đó chưa nhập số.**
  **(a) Hiện số ngày gần nhất trước đó có số, nhãn ghi rõ "Số ngày 12/09" - ĐỀ XUẤT.** Lý do: giữ đúng cách "ảnh chụp ngày cuối có số" đang chạy.
  (b) Hiện trống "Chưa có số ngày này".
- **Q8 Số tháng tối đa được mang số sang.** Dự án ngừng nhập 1 năm vẫn hiện số cũ 1 năm.
  **(a) Không giới hạn, cột "Số liệu" ghi "Dùng số tháng 09/2025" để người xem tự thấy - ĐỀ XUẤT.** Lý do: đúng quyết định "mang số tháng trước sang".
  (b) Giới hạn N tháng, quá thì hiện "Chưa cập nhật" và %TT = trống.
- **Q9 Nhập bù cho số liệu THEO THÁNG.** Hiện tại server cho PIC lưu số tháng bất kỳ (chỉ chặn tháng đã khoá sổ), giao diện chỉ liệt kê 12 tháng gần nhất; số theo ngày thì PIC chỉ lùi được 7 ngày.
  (a) Không đổi luật tháng; nhập bù chỉ mở rộng danh sách tháng trên giao diện + mở ngày (theo ngày) trong khoảng bật.
  **(b) Siết luật tháng ở server: PIC chỉ nhập tháng hiện tại và tháng trước; tháng cũ hơn chỉ nhập được khi nằm trong khoảng nhập bù đang bật - ĐỀ XUẤT.** Lý do: nhập bù có ý nghĩa kiểm soát thật, có nhật ký; hiện server đang mở rộng hơn giao diện.
  (c) Như (b) nhưng cho PIC nhập tới 3 tháng trước.
- **Q10 Nhập bù có vượt được tháng đã khoá sổ không?**
  **(a) Không: tháng khoá sổ vẫn phải admin mở khoá trước - ĐỀ XUẤT.** Lý do: giữ luật khoá sổ hiện có, 2 công tắc rõ ràng.
  (b) Có: bật nhập bù là tự cho phép ghi vào tháng khoá trong khoảng.
- **Q11 Ai được bật/tắt nhập bù?**
  **(a) Chỉ admin - ĐỀ XUẤT** (đúng 1b mục 5).
  (b) Admin và BOD.
- **Q12 Giới hạn độ dài khoảng nhập bù và thời hạn tự tắt.**
  (a) Không giới hạn, admin tự tắt.
  **(b) Tối đa 24 tháng mỗi khoảng, tự hết hiệu lực sau 30 ngày kể từ lúc bật nếu admin quên tắt - ĐỀ XUẤT.** Lý do: tránh quên tắt để mở cửa sửa lịch sử vô thời hạn.
  (c) Như (b) nhưng tự tắt sau 7 ngày.
- **Q13 Nhập bù có cần duyệt số trước khi vào báo cáo không?**
  **(a) Không cần duyệt; mọi lần lưu có nhật ký (ai, lúc nào, số cũ, số mới, "nhập bù") - ĐỀ XUẤT.** Lý do: admin đã chủ động bật cho đúng dự án, đúng khoảng.
  (b) Cần admin duyệt từng lần lưu (thêm hàng chờ duyệt, tốn công nhiều).

---

## 1. Khảo sát hiện trạng (trên `feature/p4-logic-bo-loc` = `main` @ `2c20a95`)

| Chỗ | Hiện trạng | Lỗi/xung đột |
|---|---|---|
| `src/server/queries.ts` `summarize()` dòng 58-101 | `penaltyState(today())`, `calcDurationPctComplete(..., today())`, `deriveStatus` dùng `actualStartDate/actualFinishDate` hiện tại | L-1 |
| `queries.ts` `getProjectSummariesUncached` dòng 158-167 | `repo.readFactSnapshots(yearMonth)` lấy ĐÚNG tháng, thiếu → `pctActual 0` | L-3 |
| `queries.ts` `getPortfolioKpis` dòng 220-251 | delta chỉ chặn khi cả tháng trống; `'all'` → delta 0 | L-3, L-4 |
| `queries.ts` `kpisForMonth` dòng 196-209 | `totalProjects = summaries.length` (mọi dự án) | L-5 |
| `queries.ts` `getScopedProjectIds` dòng 129-141 | bỏ qua `status` | F-1 |
| `queries.ts` `getSpiCpiTrend`/`getPortfolioSCurve` dòng 315-345 | `historyMonths()` cố định 12 tháng | F-2 |
| `src/server/repo/read-prisma.ts` `readMonthlyEvm` dòng 81-90 | `AVG(spi)`, `AVG(cpi)` | L-2 |
| `read-prisma.ts` `readFactSnapshots('all')` và `readFinancialSnapshots('all')` | tháng mới nhất của từng dự án trộn nhau; `revenuePeriod` 1 tháng | L-4 |
| `queries.ts` `getTonnageValueByGroup`/`getCapacityData` | 1 tháng; `'all'` trộn tháng | L-4 |
| `src/server/overdue-scorecard.ts` | đúng tháng, `getScopedProjectIds` (bỏ status) | L-3, F-1 |
| `src/server/cache.ts` | khoá theo `month`; SPI/CPI và S-curve không theo tháng | F-2 |
| `src/components/dashboard/OverviewWidgets.tsx` `SpiCpiCard` | `.slice(-6)` | F-2 |
| `src/components/dashboard/FilterBar.tsx` | option "Tất cả"; tháng thô "2026-09"; chữ gợi ý làm nhãn; nút "✕ Lọc" | L-4, F-4 |
| `src/components/dashboard/DrillCharts.tsx` `useDrill` | thêm `groupBy/groupKey` vào URL, `FilterBar` không hiện | F-3 |
| `app/[locale]/(app)/overview/page.tsx` | `month` validate, `filters` ép kiểu thô (`as Status`...) vào khoá cache | khoá cache |
| `app/api/export/route.ts` dòng 41-46 | `month` thô, không validate | khoá/đúng số |
| `app/[locale]/(app)/projects/[id]/page.tsx` | `?month` mặc định `currentMonth()`; `getProjectSummary`, `repo.getValueChain`, `getWorkItemComparison` đúng tháng; nguồn lực theo `resourceWindow` 180 ngày; S-curve/SPI-CPI toàn bộ `facts`; tài chính `slice(-6)`; tiêu đề `detail.sCurve12`/`detail.spiCpi12` | 1b, F-5, F-6 |
| `src/server/project-queries.ts` `resourceWindow` dòng 35-43 | cửa sổ 180 ngày kết thúc `min(cuối tháng, hôm nay)` | 1b mục 3 |
| `src/components/ui/HelpTip.tsx` | mở bằng `:hover`/`:focus-visible` (CSS `app/globals.css` dòng 348-379); iOS Safari bấm không focus nút → không mở | 1d |
| `src/components/dashboard/KpiCard.tsx` | không có chỗ đặt "?" | 1d |
| `src/lib/daily-entry.ts` `dailyDateWindow` | data-entry lùi 7 ngày, admin không giới hạn | 1b mục 5 |
| `src/server/actions-entry.ts` `checkDailyPayload`, `previewDailyImportAction` | dùng `dailyDateWindow` | 1b mục 5 |
| `src/server/actions.ts` `saveMonthlyData` dòng 48-84, `commitImportAction` dòng 711-741 | không giới hạn tháng ở server, chỉ chặn tháng khoá | Q9 |
| `app/[locale]/(app)/nhap-lieu/page.tsx` | tháng chọn trong `historyMonths()` (12), ngày trong `dailyDateWindow` | 1b mục 5 |

Hàm thuần tái dùng: `src/lib/clock.ts` (`isValidIsoDate`, `isValidYearMonth`, `addMonths`, `endOfMonth`, `addDaysIso`, `daysBetween`, `todayIso`, `currentMonth`), `src/lib/evm.ts` (`deriveStatus`, `penaltyState`, `calcDurationPctComplete`, `isOnTrack`), `src/lib/schedule-gap.ts` (`calcScheduleGap`), `src/lib/format.ts` (`formatDate`, `formatDayMonth`, `formatPct`).

Cache invalidation hiện có: mọi lần ghi số tháng/nhập Excel đều `revalidateTag(trendTag)` (`src/server/actions.ts` dòng 221, 292, 341, 738; `src/server/actions-project.ts` dòng 45) và sửa hồ sơ thì `revalidateTag(profileTag)`.
Kế hoạch dùng lại 2 tag này, KHÔNG sửa `actions.ts` cho phần cache.

---

## 2. File nóng: giữ ở task nào (giữ ngắn, nhả ngay sau commit)

Trước khi giữ: đọc MỌI dòng "Đang giữ" trong `D:\_project\DDC_dieu-phoi\phien-A.md` và `phien-B.md`; bên kia đang giữ thì không sửa, làm task khác.
Ghi "Đang giữ: <file> (Task X)" vào `phien-C.md`, nhả khi commit xong task đó.

| File nóng | Task giữ | Ghi chú |
|---|---|---|
| `src/server/queries.ts` | B2 | 1 lần, sửa hết L-1..L-5, F-1, F-2 trong 1 commit |
| `src/server/project-queries.ts` | D1 | 1 lần |
| `src/i18n/messages/vi.json` + `en.json` | E1 (1 lần duy nhất cho toàn P4) | gom MỌI key mới + đổi tên đã duyệt vào 1 commit; task khác không sửa 2 file này |
| `prisma/schema.prisma` + `prisma/migrations/` | F1 | 1 migration duy nhất |
| `src/server/actions.ts` | F4, CHỈ khi Q9 chọn (b) hoặc (c) | nếu Q9 = (a) thì không đụng |
| `src/server/repo/prisma-repo.ts` | không giữ | repo nhập bù để ở file mới `prisma-repo-backfill.ts` |
| `app/globals.css` | không giữ | HelpTip mở bằng style inline; nếu buộc phải thêm CSS thì DỪNG, báo lại |

Thứ tự khuyến nghị để giảm thời gian giữ: E1 (i18n) làm ngay sau khi có trả lời mục 0, trước C/D/F; các task UI sau đó chỉ dùng key đã có.

---

## 3. Khái niệm và kiểu dữ liệu dùng chung

- **Kỳ (`Period`)**: `{ from: IsoDate; to: IsoDate }`, đã validate, `from <= to`, cả 2 trong `[2000-01-01, 2999-12-31]`.
- **Tháng của kỳ**: mọi tháng có ít nhất 1 ngày nằm trong kỳ (tính trọn tháng).
- **Ngày mốc (`asOfDate`)**: `min(period.to, todayIso())`.
- **Tháng mốc (`asOfMonth`)**: `asOfDate.slice(0, 7)`.
- **Số tồn** (%TT, SPI, CPI, PV/EV/AC luỹ kế, công nợ quá hạn, trạng thái, chậm, nguy cơ phạt, HĐ chưa khởi công): lấy dòng `isLatest` có `yearMonth` LỚN NHẤT mà `<= asOfMonth` của từng dự án. KHÔNG bao giờ lấy dòng tháng sau mốc.
- **Số phát sinh** (doanh thu `revenuePeriod`, sản lượng `tonnageProcessed`): cộng các tháng của kỳ; tháng thiếu = 0.
- **Dự án thuộc kỳ**: khoảng `[start, end]` giao `[period.from, period.to]`, với `start = actualStartDate ?? plannedStartDate ?? (theo Q4)`, `end = actualFinishDate ?? plannedFinishDate ?? +vô cùng`.
- **Trạng thái tại mốc**: `deriveStatus({ actualStartDate: d <= asOfDate ? d : null, actualFinishDate: d <= asOfDate ? d : null, pctActual })`.
- **Giới hạn kỹ thuật**: kỳ tối đa 120 tháng; dài hơn thì `to` giữ nguyên, `from` kéo lên cho đủ 120 tháng (chặn khoá cache và truy vấn quá dài; không phải quyết định nghiệp vụ).

---

## Nhóm A - Tầng thời gian thuần + hàm đọc (không file nóng, không cần trả lời câu hỏi)

### Task A1: `src/lib/period.ts` - kỳ, tháng của kỳ, mốc, kỳ trước

**Files:**
- Create: `src/lib/period.ts`
- Create: `src/lib/period.test.ts`
- Quy ước copy: `src/lib/clock.ts` (hàm thuần, JSDoc tiếng Việt, không đọc đồng hồ trừ khi nhận `today` từ tham số), `src/lib/clock.test.ts` (kiểu test).

**Interfaces (Produces):**
```ts
import type { IsoDate, YearMonth } from '@/lib/clock';
export interface Period { from: IsoDate; to: IsoDate }
export const PERIOD_MAX_MONTHS = 120;
/** Đọc kỳ từ URL. Ưu tiên from/to hợp lệ; không có thì `month=YYYY-MM` hợp lệ = trọn tháng đó; còn lại (kể cả 'all', rác) = fallback. */
export function parsePeriod(sp: { from?: string; to?: string; month?: string }, fallback: Period): Period;
/** Kỳ mặc định Tổng quan theo Q1. Nhận today để thuần. */
export function defaultOverviewPeriod(today: IsoDate): Period;
export function periodMonths(p: Period): YearMonth[];            // cũ → mới, tính trọn tháng
export function periodAsOfDate(p: Period, today: IsoDate): IsoDate; // min(p.to, today)
export function periodAsOfMonth(p: Period, today: IsoDate): YearMonth;
/** Kỳ liền trước cùng số ngày: to' = from - 1 ngày, from' = to' - (số ngày kỳ - 1). */
export function previousPeriod(p: Period): Period;
export function periodKey(p: Period): string;                     // `${from}_${to}`
export function periodContains(p: Period, d: IsoDate): boolean;
/** Giao nhau giữa [start,end] (null start/end = vô cùng) và kỳ. */
export function intersectsPeriod(start: IsoDate | null, end: IsoDate | null, p: Period): boolean;
/** Tham số URL để giữ kỳ khi tạo link: { from, to }. */
export function periodSearch(p: Period): { from: IsoDate; to: IsoDate };
```

- [ ] **Bước 1: Viết test đỏ** trong `src/lib/period.test.ts`, tối thiểu các ca:
  - `parsePeriod({ from: '2026-07-01', to: '2026-09-16' }, fb)` → đúng kỳ đó.
  - `from > to` → đổi chỗ thành `{ from: to, to: from }`.
  - `from: '2026-02-30'` (ngày không tồn tại) → fallback.
  - `month: '2026-03'` → `{ from: '2026-03-01', to: '2026-03-31' }`; `month: '2024-02'` → to `'2024-02-29'`.
  - `month: 'all'`, `month: 'abc'`, `month: '9999-12'`, không tham số → fallback (L-4: không còn 'all').
  - kỳ dài hơn 120 tháng → `from` kéo lên để `periodMonths(p).length === 120`.
  - `periodMonths({ from: '2026-06-15', to: '2026-08-02' })` → `['2026-06','2026-07','2026-08']`.
  - `periodAsOfDate({from:'2026-07-01',to:'2026-12-31'}, '2026-09-16')` → `'2026-09-16'`; kỳ quá khứ → `p.to`.
  - `previousPeriod({ from: '2026-07-01', to: '2026-09-30' })` → `{ from: '2026-04-01', to: '2026-06-30' }` (92 ngày).
  - `intersectsPeriod('2026-01-05','2026-06-20', {from:'2026-08-01',to:'2026-08-31'})` → false; `(null, null, p)` → true; `('2026-08-31', null, p)` → true.
  - `defaultOverviewPeriod('2026-09-16')` theo Q1 (Q1 = c → `{ from: '2025-10-01', to: '2026-09-16' }`).
- [ ] **Bước 2:** `npx vitest run src/lib/period.test.ts` → FAIL (module chưa có).
- [ ] **Bước 3:** Cài đặt, dùng `isValidIsoDate`, `addMonths`, `endOfMonth`, `addDaysIso`, `daysBetween` từ `src/lib/clock.ts`.
- [ ] **Bước 4:** Chạy lại → PASS; `npx tsc --noEmit` sạch.
- [ ] **Bước 5:** Commit `feat(p4-k): them tang ky bao cao src/lib/period.ts`.

**Xong khi:** mọi ca trên xanh; không import `@/server/*`.

### Task A2: `src/lib/as-of.ts` - mang số tháng trước sang

**Files:**
- Create: `src/lib/as-of.ts`, `src/lib/as-of.test.ts`
- Quy ước copy: `src/lib/top-priority.ts` + `.test.ts`.

**Interfaces (Produces):**
```ts
import type { IsoDate, YearMonth } from '@/lib/clock';
export type DataStateKind = 'current' | 'carried' | 'completed' | 'none';
export interface DataState { kind: DataStateKind; month: YearMonth | null } // month: tháng nguồn của số, 'completed' = tháng actualFinishDate
export interface AsOf<T> { row: T; sourceYm: YearMonth; carried: boolean }
/** rowsAsc sắp tăng theo yearMonth. Trả dòng cuối có yearMonth <= ym; không có → null. */
export function pickAsOf<T extends { yearMonth: string }>(rowsAsc: readonly T[], ym: YearMonth): AsOf<T> | null;
/** Chuỗi theo từng tháng của `months`, mỗi phần tử = pickAsOf tại tháng đó. */
export function carrySeries<T extends { yearMonth: string }>(rowsAsc: readonly T[], months: readonly YearMonth[]): (AsOf<T> | null)[];
/** Nhãn cột "Số liệu": completed nếu status Hoan_thanh tại mốc (month = actualFinishDate.slice(0,7)); none nếu không có số; carried/current theo AsOf. */
export function dataStateOf(asOf: AsOf<unknown> | null, statusAtAsOf: string, actualFinishDate: IsoDate | null): DataState;
```

- [ ] **Bước 1: Test đỏ:** `pickAsOf` với rows `[06, 07, 09]` tại `08` → dòng `07`, `carried: true`; tại `09` → `carried: false`; tại `05` → null (không mang số từ tương lai về quá khứ); `carrySeries` với months `[05..10]` → `[null, 06c=false, 07, 07c, 09, 09c]`; `dataStateOf` 4 nhánh.
- [ ] **Bước 2-4:** chạy FAIL → cài → PASS.
- [ ] **Bước 5:** Commit `feat(p4-k): them pickAsOf/carrySeries mang so thang truoc`.

### Task A3: Hàm đọc theo mốc/kỳ trong read repo

**Files:**
- Modify: `src/server/repo/read-types.ts` (thêm kiểu + chữ ký vào `ReadRepo`)
- Modify: `src/server/repo/read-prisma.ts` (cài Postgres)
- Modify: `src/server/repo/read-mock.ts` (cài in-memory, cùng ngữ nghĩa)
- Modify: `src/server/repo/read-mock.test.ts` (ca mock)
- Create: `src/server/repo/read-period-real-db.test.ts` (Postgres thật, `describe.skipIf(!process.env.DATABASE_URL)`)
- Modify: `scripts/check-read-parity.ts` (thêm đối chiếu các hàm mới)
- Quy ước copy: tên hàm bắt đầu `read` (`read-prisma.ts` dòng 8-11); real-db copy khung `src/server/repo/prisma-repo-signup-real-db.test.ts` (skip khi không có `DATABASE_URL`, dữ liệu tiền tố `test-p4-`, tự dọn trong `afterAll`).

**Interfaces (Produces):**
```ts
// read-types.ts
export interface FactAsOfRow extends FactSnapshot {}              // cùng cột FactSnapshot
export interface FinancialAsOfRow { projectId: number; yearMonth: string; arOverdue: number }
export interface FlowRow { projectId: number; revenue: number }    // Σ revenuePeriod
export interface VolumeFlowRow { projectId: number; factoryId: number; tonnage: number } // Σ tonnageProcessed
export interface FactSeriesRow { projectId: number; yearMonth: string; pctActual: number; pv: number; ev: number; ac: number }
export interface ReadRepo {
  // ... giữ nguyên các hàm cũ ...
  /** Mỗi dự án đang hoạt động: dòng isLatest có yearMonth lớn nhất <= ym. Dự án chưa có dòng nào <= ym: không trả. */
  readFactSnapshotsAsOf(ym: string): Promise<FactAsOfRow[]>;
  readFinancialAsOf(ym: string): Promise<FinancialAsOfRow[]>;
  /** Σ revenuePeriod (isLatest) theo dự án cho yearMonth trong [fromYm, toYm]. */
  readRevenueInRange(fromYm: string, toYm: string): Promise<FlowRow[]>;
  readVolumeInRange(fromYm: string, toYm: string): Promise<VolumeFlowRow[]>;
  /** Dòng isLatest trong [fromYm, toYm] CỘNG dòng cuối cùng < fromYm của mỗi dự án (để mang số vào tháng đầu kỳ). Sắp projectId, yearMonth tăng. projectIds rỗng → []. */
  readFactSeries(fromYm: string, toYm: string, projectIds: number[]): Promise<FactSeriesRow[]>;
  /** Chuỗi giá trị của tháng lớn nhất <= ym có dòng; không có → []. */
  readValueChainAsOf(projectId: number, ym: string): Promise<ValueChainProgress[]>;
  /** MAX(workDate) <= onOrBefore của bảng ngày; không có → null. */
  readLastDailyDate(projectId: number, kind: 'manpower' | 'equipment', onOrBefore: IsoDate): Promise<IsoDate | null>;
}
```

SQL bắt buộc cho `readFactSnapshotsAsOf` (dùng index `[projectId, yearMonth, isLatest]`, không quét cả bảng bằng `DISTINCT ON`):
```sql
SELECT f."projectId", f."yearMonth", f."pctActual", f."bac", f."pv", f."ev", f."ac", f."spi", f."cpi", f."bottleneckStage"
FROM "dim_project" p
CROSS JOIN LATERAL (
  SELECT * FROM "fact_progress_monthly" x
  WHERE x."projectId" = p."id" AND x."isLatest" = true AND x."yearMonth" <= ${ym}
  ORDER BY x."yearMonth" DESC LIMIT 1
) f
WHERE p."isActive" = true
```
Kiểm tên bảng `dim_project` bằng `@@map` của `model Project` trong `prisma/schema.prisma` trước khi viết.
`readFinancialAsOf`: cùng khuôn trên `fact_financial`.
`readLastDailyDate`: `SELECT to_char(MAX("workDate"),'YYYY-MM-DD') FROM "fact_daily_manpower" WHERE "projectId"=$1 AND "workDate" <= $2::date` (bảng thiết bị: `fact_daily_equipment_usage`, kiểm `@@map`).

- [ ] **Bước 1: Test đỏ (mock)** trong `read-mock.test.ts`: dựng `createReadMock(() => data)` với dữ liệu tự tạo (copy cách dựng `RepoData` tối thiểu ở chính file test này), ca: dự án có dòng 06, 07, 09 → `readFactSnapshotsAsOf('2026-08')` trả dòng 07; `('2026-05')` không trả dự án đó; dòng `isLatest=false` bị bỏ; `readFactSeries('2026-08','2026-09',[id])` trả dòng 07 (mang vào) + 09; `readRevenueInRange` cộng đúng; `readLastDailyDate` với ngày chặn.
- [ ] **Bước 2: Test real-db** `read-period-real-db.test.ts` chạy CÙNG bộ ca trên Postgres DB `_c` (tạo dự án `test-p4-*`, fact, dọn sau).
  Chạy tay: `$env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'; npx vitest run src/server/repo/read-period-real-db.test.ts`.
- [ ] **Bước 3:** Cài mock + prisma. `npm test` xanh, real-db xanh.
- [ ] **Bước 4:** Thêm vào `scripts/check-read-parity.ts` các `check(...)` cho hàm mới với `ym = currentMonth()`, kỳ = `historyMonths()` đầu/cuối; chạy `npx tsx scripts/check-read-parity.ts` trên DB `_c` đã seed → không lệch.
- [ ] **Bước 5:** Commit `feat(p4-k): them ham doc theo moc/ky vao read repo`.

**Xong khi:** mock, real-db, parity cùng xanh; `EXPLAIN` của `readFactSnapshotsAsOf` trên DB `_c` dùng Index Scan (dán kết quả vào `thay-doi.md`).

---

## Nhóm B - Tầng truy vấn Tổng quan: sửa L-1..L-5, F-1, F-2 (giữ `queries.ts`)

Cần trả lời Q1-Q5 trước.

### Task B1: Fixture + test đỏ tái hiện L-1..L-5, F-1, F-2

**Files:**
- Create: `src/server/queries-period.fixture.ts` (không phải `.test.ts`, không tự chạy)
- Create: `src/server/queries-period.test.ts`
- Quy ước copy: cách `vi.mock('@/server/repo', ...)` ở `src/server/queries.test.ts` dòng 5-8, nhưng trả về **stub riêng** từ fixture (không dùng seed mock-repo, để số kiểm chứng được bằng tay).

Fixture (`DDC_FAKE_TODAY = 2026-09-16` do `vitest.config.ts` ghim sẵn):
- Dự án 1 "A": plannedStart `2026-01-01`, plannedFinish `2026-12-31`, actualStart `2026-01-10`, actualFinish null, committedHandover `2026-10-10`, penalized false, contractValue 100, P1.
  Fact: `2026-03` pct 0.22 (pv 20, ev 22, ac 20, spi 1.1, cpi 1.1); `2026-06` pct 0.40 (pv 40, ev 40, ac 40, spi 1, cpi 1); `2026-07` pct 0.45 (pv 50, ev 45, ac 50, spi 0.9, cpi 0.9); KHÔNG có `2026-08`; `2026-09` pct 0.70.
  Financial revenuePeriod: `2026-06` 5, `2026-07` 7.
- Dự án 2 "B" (nhỏ): planned `2026-01-01`→`2026-06-30`, actualStart `2026-01-05`, actualFinish `2026-06-20`, committedHandover `2026-07-15`, contractValue 10.
  Fact: `2026-03` pct 0.5; `2026-06` pct 1.0 (pv 10, ev 5, ac 12, spi 0.5, cpi 0.4167). Financial `2026-06` revenuePeriod 3.
- Dự án 3 "C" (chuẩn bị): planned `2026-11-01`→`2027-06-30`, không actual, contractDate `2026-08-01`, contractValue 50, không fact.
- `getDims()` trả 1 team, 1 customer, 1 factory `capacityTonPerYear: 1200`.
- Stub cài các hàm `listProjects`, `getDims`, `getProject` và toàn bộ hàm của Task A3 bằng `createReadMock` trên dữ liệu fixture.

Ca test (mỗi ca ghi mã lỗi trong tên `it`):
- [ ] **L-1a** kỳ `2026-03-01..2026-03-31`: dự án A `pctPlan ≈ 89/364` (±0.001), `onTrack = true`. Code cũ: `pctPlan ≈ 258/364`, `onTrack = false`.
- [ ] **L-1b** cùng kỳ: dự án A `penalty = 'none'` (còn 193 ngày). Code cũ: `'risk'`.
- [ ] **L-1c** kỳ `2026-06-01..2026-07-31` (mốc 07-31): dự án B `status = 'Hoan_thanh'`, `dataState.kind = 'completed'`, `month = '2026-06'` (mang số 06 = 1.0, actualFinish 06-20 <= mốc). Code cũ với tháng `2026-07`: `Dang_trien_khai`, pct 0.
- [ ] **L-1d** kỳ `2026-03-01..2026-03-31`: dự án B `status = 'Dang_trien_khai'` (actualFinish 06-20 sau mốc).
- [ ] **L-2** `getSpiCpiTrend` kỳ `2026-06-01..2026-06-30`, điểm tháng `2026-06`: `spi = (40+5)/(40+10) = 0.9`, `cpi = 45/52 ≈ 0.87` (làm tròn 2 số). Code cũ: 0.75 và 0.71.
- [ ] **L-3a** kỳ `2026-08-01..2026-08-31`: dự án A `pctActual = 0.45`, `dataState = { kind: 'carried', month: '2026-07' }`. Code cũ: 0.
- [ ] **L-3b** delta KPI không nhảy giả khi dự án thiếu số tháng: với Q2 = a, kỳ `2026-08-01..2026-08-31` so kỳ trước `2026-07-01..2026-07-31`: `delta.projectsInPeriod = 0`, `delta.behindSchedule = 0` (A chậm ở cả 2 mốc: 0.45 so %KH 0.665 và 0.58). Nếu chủ dự án chọn Q2 khác, coder sửa kỳ vọng theo đúng phương án và ghi vào `thay-doi.md`.
- [ ] **L-4** `getProjectSummaries` không còn nhận `'all'` (kiểm bằng kiểu: tham số là `Period`); doanh thu nhóm kỳ `2026-06-15..2026-07-10` = A 12 (5+7) + B 3 = 15.
- [ ] **L-5** kỳ `2026-08-01..2026-08-31`: `projectsInPeriod = 1` (chỉ A); B kết thúc 06-20 bị loại; C khởi công 11/2026 bị loại. Code cũ: 3.
- [ ] **HĐ chưa khởi công** kỳ `2026-08-01..2026-08-31`: theo Q3 (Q3 = a → 50 vì C ký 08-01 <= mốc; Q3 = b → 0).
- [ ] **F-1** lọc `status = 'Hoan_thanh'`, kỳ `2026-06-01..2026-07-31`: KPI chỉ có B; S-curve chỉ cộng B: PV 06 = 10, PV 07 = 10 (mang số 06). Code cũ: S-curve cộng cả A (bỏ qua lọc trạng thái).
- [ ] **F-2** kỳ `2026-06-01..2026-08-31`: `getPortfolioSCurve` trả đúng 3 tháng `['2026-06','2026-07','2026-08']` (code cũ: 12 tháng cố định).
  A và B đều thuộc kỳ nên cả 2 góp số tồn mọi tháng của kỳ.
  Kỳ vọng `carriedProjects`: 06 → 0; 07 → 1 (B mang số 06); 08 → 2 (A mang số 07, B mang số 06).
  PV tại 08 = 50 (A, số 07) + 10 (B, số 06) = 60.
- [ ] **Công suất** kỳ 3 tháng: `capacity = 1200/12*3 = 300`.
- [ ] Chạy `npx vitest run src/server/queries-period.test.ts` → các ca FAIL (chưa có chữ ký mới). Dán output đỏ vào `thay-doi.md`.
- [ ] Commit `test(p4): tai hien L-1..L-5, F-1, F-2 bang test do`.

### Task B2: Sửa `src/server/queries.ts` + các nơi gọi (GIỮ `queries.ts`)

**Files:**
- Modify: `src/server/queries.ts` (file nóng)
- Modify: `src/server/cache.ts`, `src/server/top-priority-queries.ts`, `src/server/overdue-scorecard.ts`
- Modify: `src/components/dashboard/OverviewWidgets.tsx` (chỉ đổi prop `month` → `period`, KHÔNG đổi bố cục ở task này)
- Modify: `app/[locale]/(app)/overview/page.tsx`, `app/api/export/route.ts`, `scripts/perf/bench-data.ts`
- Create: `src/lib/overview-params.ts` + `.test.ts` (validate bộ lọc cho khoá cache)
- Modify test cũ gọi chữ ký cũ: tìm bằng `rg -l "getProjectSummaries|getPortfolioKpis|getStatusBreakdown|getTonnageValueByGroup|getCapacityData|getSpiCpiTrend|getPortfolioSCurve|getWatchlist|getMissingMonth|getProjectSummary\(|getOverdueScorecard|getTopPriority|loadPortfolioKpis|exportProjects" src e2e scripts`, cập nhật từng file cho chữ ký mới, KHÔNG xoá ca kiểm quyền/che tiền.

**Interfaces (Produces, chữ ký chính xác):**
```ts
// queries.ts
export interface ProjectSummary { /* giữ mọi trường cũ */ dataState: DataState }
export interface DashboardFilters { /* giữ nguyên */ }
export async function getProjectSummaries(period: Period, filters?: DashboardFilters): Promise<ProjectSummary[]>; // đã lọc "thuộc kỳ" + filters; requestMemo giữ
export async function getProjectSummary(projectId: number, asOfMonth: YearMonth): Promise<ProjectSummary | undefined>; // dùng cho trang Chi tiết, không lọc kỳ
export interface PortfolioKpis {
  projectsInPeriod: number; inProgress: number; behindSchedule: number; penaltyRisk: number; penalized: number;
  notStartedValue: number;   // "HĐ chưa khởi công" (đổi tên từ backlog) theo Q3
  revenueInPeriod: number; tonnageInPeriod: number;
  delta: { [K in 'projectsInPeriod'|'inProgress'|'behindSchedule'|'penaltyRisk'|'penalized'|'notStartedValue'|'revenueInPeriod'|'tonnageInPeriod']: number | null }; // null = không có delta (theo Q2)
  asOfDate: IsoDate; months: YearMonth[];
}
export async function getPortfolioKpis(period: Period, filters?: DashboardFilters): Promise<PortfolioKpis>;
export async function getStatusBreakdown(period: Period, filters?: DashboardFilters): Promise<{ status: Status; value: number }[]>;
export async function getTonnageValueByGroup(period: Period, groupBy: GroupBy, filters?: DashboardFilters): Promise<{ key: string; tonnage: number; value: number }[]>;
export async function getCapacityData(period: Period, filters?: DashboardFilters): Promise<{ name: string; region: string; processed: number; capacity: number; warn: boolean }[]>;
export interface TrendPoint { month: YearMonth; carriedProjects: number }
export async function getSpiCpiTrend(period: Period, filters?: DashboardFilters): Promise<(TrendPoint & { spi: number | null; cpi: number | null })[]>;
export async function getPortfolioSCurve(period: Period, filters?: DashboardFilters): Promise<(TrendPoint & { pv: number; ev: number; ac: number })[]>;
export async function getWatchlist(period: Period, filters?: DashboardFilters): Promise<ProjectSummary[]>;
export async function getMissingMonth(yearMonth: string): Promise<{ id: number; projectName: string; code: string }[]>; // giữ nguyên
export interface ProjectListParams { period: Period; filters?: DashboardFilters; search?: string; sort?: ...; dir?: ...; page?: number; pageSize?: number }
export async function listProjects(params: ProjectListParams): ...; export async function exportProjects(params: ProjectListParams): ...;
// Xoá: getScopedProjectIds (thay bằng tập id của getProjectSummaries - F-1). Sửa overdue-scorecard dùng tập đó.

// overdue-scorecard.ts
export async function getOverdueScorecard(period: Period, filters: DashboardFilters): Promise<Scorecard>; // công nợ quá hạn = số tồn tại mốc (readFinancialAsOf)

// top-priority-queries.ts
export async function getTopPriority(period: Period, filters?: DashboardFilters): Promise<ProjectSummary[]>;

// cache.ts - mọi loader nhận (period, ...) ; khoá = ['kpis', key(periodKey(period), filters)] ; tags = [trendTag, profileTag, overviewTag(periodAsOfMonth(period, todayIso()))]
export const loadPortfolioKpis: (period: Period, filters: DashboardFilters) => Promise<PortfolioKpis>; // tương tự cho các loader còn lại

// src/lib/overview-params.ts
export function parseDashboardFilters(sp: Record<string, string | string[] | undefined>): DashboardFilters; // status/priority/market/type chỉ nhận giá trị trong danh sách enum (copy mảng STATUSES... ở FilterBar.tsx dòng 9-22 vào đây rồi FilterBar import lại); team/customer số nguyên dương; groupBy ∈ team|type|market; groupKey cắt 100 ký tự; sai → 'all'/undefined
```

Cách tính bắt buộc:
- `summarize(project, asOf: AsOf<FactSnapshot> | null, dims, asOfDate: IsoDate)`: đổi toàn bộ `today()` thành `new Date(asOfDate + 'T00:00:00Z')`; trạng thái dùng quy tắc "Trạng thái tại mốc" mục 3; `dataState = dataStateOf(...)`.
- `getProjectSummariesUncached(period, filters)`: `Promise.all([listProjects, getDims, readFactSnapshotsAsOf(asOfMonth)])`, lọc `intersectsPeriod` (Q4), rồi `filterSummaries`.
- S-curve/SPI-CPI: tập id = id của `getProjectSummaries(period, filters)` (F-1); `readFactSeries(firstMonth, lastMonth, ids)` → gom theo dự án → `carrySeries` → cộng từng tháng; `spi = ΣEV/ΣPV`, `cpi = ΣEV/ΣAC` (L-2), mẫu số 0 → null; `carriedProjects` = số dự án có `carried: true` tại tháng đó. Không đổi `readMonthlyEvm` (không còn nơi gọi thì xoá khỏi `ReadRepo`, `read-prisma.ts`, `read-mock.ts`, parity script).
- Doanh thu/sản lượng theo nhóm và KPI phát sinh: `readRevenueInRange`/`readVolumeInRange` với tháng đầu/cuối của kỳ.
- `getPortfolioKpis`: delta theo Q2 dùng `previousPeriod(period)`; kỳ trước không có dòng fact nào <= mốc kỳ trước → delta null (không bịa).
- `overview/page.tsx`: `const today = todayIso(); const period = parsePeriod({ from: p(sp,'from'), to: p(sp,'to'), month: p(sp,'month') }, defaultOverviewPeriod(today)); const filters = parseDashboardFilters(sp);` rồi truyền CÙNG 1 object `period` và `filters` xuống mọi widget (React `cache` so theo tham chiếu, tạo object mới trong widget sẽ làm mất memo).
  `requireUser` vẫn là lời gọi đầu tiên sau `getLocale()` như hiện tại.
- `app/api/export/route.ts`: dùng `parsePeriod` + `parseDashboardFilters`; thêm test ca `?month=abc` và `?from=rác` không ném lỗi.

- [ ] **Bước 1:** Giữ `queries.ts` (mục 2).
- [ ] **Bước 2:** Test `src/lib/overview-params.test.ts` đỏ (status rác → 'all', team '-1' → 'all', groupKey 500 ký tự → cắt 100) → cài → xanh.
- [ ] **Bước 3:** Cài `queries.ts` và các file ở trên cho tới khi `queries-period.test.ts` (Task B1) xanh toàn bộ.
- [ ] **Bước 4:** Cập nhật test cũ; `src/server/queries-n1.test.ts` phải chứng minh số lần gọi repo KHÔNG tăng theo số dự án.
- [ ] **Bước 5:** `npx tsc --noEmit` + `npm test` xanh; e2e `02-overview`, `08-finance-gate`, `11-tong-quan-sidebar-du-an`, `09-chan-chua-dang-nhap`, `27-csp-vi-pham` xanh (URL `?month=all` phải mở được, rơi về kỳ mặc định).
- [ ] **Bước 6:** Commit `fix(p4-l1-l5): tinh so tai moc cuoi ky, mang so thang truoc, SPI/CPI trong so`; nhả `queries.ts`.

**Xong khi:** mọi ca B1 xanh, không test cũ nào bị xoá ca quyền/che tiền, thẻ Top vẫn che tiền với viewer (`src/server/top-priority-mask.qa.test.ts` xanh).

---

## Nhóm E (làm trước C/D/F) - i18n một lần + HelpTip bấm được

### Task E1: Thêm toàn bộ key i18n P4 (GIỮ `vi.json` + `en.json`, 1 commit)

Cần: mục 0.1 đã duyệt (để biết đổi tên nào được làm) và Q2.

**Files:** `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` (file nóng).
**Quy ước:** key mới đặt trong object riêng của tính năng, thêm vào CUỐI file (không chèn giữa key cũ); tiếng Việt có dấu; không em/en dash; kiểm cùng tập key 2 file bằng test có sẵn (tìm `rg -l "en.json" src --glob "*.test.ts"`; nếu chưa có test so khớp key thì thêm `src/i18n/messages-parity.test.ts` so tập key lồng nhau của 2 file).

Nhóm key (VI; EN dịch tương ứng, câu chữ EN coder dịch sát nghĩa, ngắn):
- `period`: `from` "Từ ngày", `to` "Đến ngày", `label` "Kỳ báo cáo", `summary` "Kỳ {from} - {to} · số theo tháng tính trọn {m1} - {m2} · số tồn tại {asOf}", `oneMonth` "Kỳ chỉ có 1 tháng", `vsPrev` "so với kỳ trước cùng độ dài".
- `filterChip`: `named` "{dim}: {value}", `fromChart` "Từ biểu đồ: {value}", `clearAll` "Xoá tất cả lọc", `count` "{n} / {total} dự án".
- `asOf`: `month` "Số tại {month}", `day` "Số ngày {date}", `carried` "Dùng số tháng {month}", `completed` "Hoàn thành {month}", `none` "Chưa có số", `colData` "Số liệu", `prevMonth` "Tháng trước", `nextMonth` "Tháng sau", `prevWeek` "Tuần trước", `nextWeek` "Tuần sau", `pickDay` "Chọn ngày", `pickMonth` "Xem số liệu tại", `carriedTip` "{n} dự án dùng số tháng trước".
- `kpiGroup`: `now` "Đang thế nào?", `nowSub` "Số tại {date}", `flow` "Làm được bao nhiêu trong kỳ?", `flowSub` "Cộng dồn {m1} - {m2}", `inProgressNote` "trên {n} dự án trong kỳ", `revenue` "Doanh thu trong kỳ", `tonnage` "Sản lượng trong kỳ".
- `scheduleGapSentence`: `behind` "Chậm {days} ngày ({pts} điểm %)", `ahead` "Nhanh {days} ngày ({pts} điểm %)", `onTrack` "Đúng tiến độ".
- `chartHowTo`: một câu "Cách đọc" cho mỗi chart đã duyệt ở D-11 (soạn theo nội dung "?" tương ứng ở Task E2, rút còn 1 câu).
- `helpTip`: toàn bộ chuỗi ở Task E2.
- `backfill`: `title` "Nhập bù lịch sử", `from`, `to`, `note` "Ghi chú (lý do nhập bù)", `enable` "Bật nhập bù", `disable` "Tắt", `active` "Đang nhập bù {from} - {to}", `expires` "Tự tắt ngày {date}", `none` "Chưa bật khoảng nhập bù nào", `errTooLong` "Khoảng nhập bù tối đa {n} tháng", `errOverlap` "Trùng với khoảng đang bật", `errOrder` "Ngày bắt đầu phải trước ngày kết thúc".
- Đổi tên (chỉ khi đã duyệt): `kpi.totalProjects` → "Dự án trong kỳ" (D-5); `kpi.backlog` → "HĐ chưa khởi công" (D-6), EN "Contracts not started"; `detail.sCurve12` → "S-curve PV/EV/AC", `detail.spiCpi12` → "Xu hướng SPI/CPI" (D-18). Giữ nguyên TÊN key để không vỡ chỗ gọi.

- [ ] Giữ 2 file → thêm key → `npm test` (test parity key) → commit `feat(p4): them key i18n P4 (period, asOf, helpTip, backfill)` → nhả ngay.

### Task E2: Nội dung icon "?" (nằm trong `helpTip` của Task E1)

Mỗi chuỗi: định nghĩa 1 câu, công thức bằng lời, 1 ví dụ số, ngưỡng màu nếu có. Coder chép nguyên văn VI; EN dịch sát.
Chuỗi có tên "HĐ chưa khởi công"/"Dự án trong kỳ" chỉ dùng tên mới khi D-5/D-6 được duyệt, không thì thay bằng tên cũ.

Tổng quan (`helpTip.ov*`):
- `ovPeriod`: "Khoảng ngày bạn chọn để xem báo cáo. Số theo tháng (tiến độ, doanh thu, sản lượng) tính trọn các tháng có ngày nằm trong kỳ; số theo ngày tính đúng từng ngày. Ví dụ kỳ 15/07 - 10/09 tính trọn tháng 07, 08, 09."
- `ovInPeriod`: "Số dự án có thi công trong kỳ: khoảng thực hiện (thực tế, thiếu thì theo kế hoạch) giao với kỳ. Ví dụ dự án chạy 01/2026 - 06/2026 có mặt trong kỳ 05/2026 - 08/2026."
- `ovInProgress`: "Dự án đã khởi công và chưa hoàn thành tại ngày cuối kỳ. Hoàn thành = %TT đạt 100% và có ngày kết thúc thực tế."
- `ovBehind`: "Dự án đang triển khai có %TT thấp hơn %KH quá 5 điểm tại cuối kỳ. %KH = phần thời gian kế hoạch đã trôi qua. Ví dụ đã qua 60% thời gian mà mới xong 52% → chậm (lệch 8 điểm). Màu vàng: có dự án chậm."
- `ovPenaltyRisk`: "Dự án chưa xong mà chỉ còn 30 ngày trở xuống tới ngày bàn giao cam kết (tính tại cuối kỳ). Ví dụ bàn giao 30/09, cuối kỳ 10/09, %TT 90% → nguy cơ phạt."
- `ovPenalized`: "Dự án đã ghi nhận bị phạt hợp đồng." + (Q5 = a) " Số này theo tình trạng hiện tại, không đổi theo kỳ."
- `ovNotStarted`: "Tổng giá trị hợp đồng của các dự án đã ký nhưng chưa khởi công tại cuối kỳ. Ví dụ 3 hợp đồng 50 + 30 + 20 tỷ chưa khởi công → 100 tỷ." (phạm vi kỳ theo Q3)
- `ovRevenue`: "Tổng doanh thu phát sinh các tháng trong kỳ, cộng mọi dự án đang lọc. Tháng chưa nhập tính 0. Ví dụ tháng 07 5 tỷ, tháng 08 7 tỷ → 12 tỷ."
- `ovTonnage`: "Tổng số tấn đã gia công các tháng trong kỳ, cộng mọi nhà máy và dự án đang lọc. Tháng chưa nhập tính 0."
- `ovSpiCpi`: "SPI = giá trị làm được / giá trị kế hoạch (EV/PV); CPI = giá trị làm được / chi phí thực (EV/AC), cộng gộp cả danh mục nên dự án lớn ảnh hưởng nhiều hơn. Dưới 0,9 là cảnh báo (vàng). Ví dụ EV 45, PV 50 → SPI 0,9."
- `ovSCurve`: "PV: giá trị kế hoạch luỹ kế; EV: giá trị đã làm được luỹ kế; AC: chi phí thực tế luỹ kế (tỷ đồng). EV dưới PV là chậm, AC trên EV là vượt chi phí. Tháng có dự án chưa nhập số thì dùng số tháng trước của dự án đó."
- `ovStatus`: "Cơ cấu dự án trong kỳ theo trạng thái tại cuối kỳ: Chuẩn bị (chưa khởi công), Đang triển khai, Hoàn thành, Tạm dừng. Bấm 1 phần để lọc."
- `ovCapacity`: "Sản lượng gia công trong kỳ so với công suất nhà máy trong cùng số tháng. Trên 85% công suất tô màu cảnh báo. Ví dụ công suất 1.200 tấn/năm, kỳ 3 tháng → 300 tấn."

Chi tiết (`helpTip.dt*`):
- `dtAsOf`: "Tháng dùng để tính các số trên trang. Mặc định là tháng gần nhất có số liệu. Tháng chưa nhập thì dùng số tháng trước và ghi rõ."
- `dtPctPlan`: "%KH = phần thời gian kế hoạch đã trôi qua tới cuối tháng đang xem. Ví dụ kế hoạch 01/01 - 31/12, xem tháng 06 → khoảng 50%."
- `dtPctActual`: "%TT = khối lượng đã hoàn thành luỹ kế, cộng các giai đoạn theo trọng số. Chậm/nhanh bao nhiêu ngày = chênh lệch %TT với %KH quy ra số ngày kế hoạch."
- `dtSpi`: "SPI = EV/PV của dự án. 1 là đúng kế hoạch, dưới 0,9 là cảnh báo chậm (vàng)."
- `dtCpi`: "CPI = EV/AC của dự án. 1 là đúng chi phí, dưới 0,9 là cảnh báo vượt chi phí (vàng)."
- `dtResource`: "Số người/thiết bị có mặt trong 1 ngày (ảnh chụp ngày ghi bên dưới), cộng mọi nhà thầu, KHÔNG cộng dồn nhiều ngày. Ví dụ 7 ngày mỗi ngày 520 người vẫn là 520."
- `dtTimeline`: "Thanh trên là kế hoạch, thanh dưới là thực tế, vạch đỏ là hôm nay. Chậm N ngày (x điểm %) là chênh lệch %TT với %KH."
- `dtValueChain`: "Mỗi giai đoạn có trọng số (tổng 100%). %TT dự án = Σ(trọng số × %hoàn thành giai đoạn). Ví dụ Thiết kế 10% xong 100%, Gia công 60% xong 50% → 10 + 30 = 40%."
- `dtBottleneck`: "Giai đoạn đầu tiên trong chuỗi (bỏ qua giai đoạn không áp dụng) chưa đạt 100%, là nơi đang giữ tiến độ cả dự án."
- `dtMobilization`: "So số huy động thực tế với kế hoạch trong ngày đang xem. Dưới 85% đỏ, dưới 95% vàng, từ 95% xanh."
- `dtSCurve`: như `ovSCurve` nhưng cho 1 dự án.
- `dtWeekly`: giữ nguyên nội dung key có sẵn `manpowerCharts.weeklyHelp` (không tạo trùng).

### Task E3: `HelpTip` mở bằng bấm + chỗ đặt "?" trong `KpiCard`/`CardHeader`

**Files:**
- Modify: `src/components/ui/HelpTip.tsx`
- Modify: `src/components/dashboard/KpiCard.tsx` (thêm prop `help?: { text: string; label: string }`, render `<HelpTip>` ngay sau nhãn `.lb`)
- Create: `src/components/ui/HelpTip.test.ts` (copy khung render `renderToStaticMarkup` ở `src/components/dashboard/KpiCard.test.ts`)
- Test e2e: `e2e/31-help-tip.spec.ts`

Yêu cầu:
- Thêm state `open`; `onClick` đảo `open`; khi `open` gán style inline cho `.bub`: `display:block; opacity:1; visibility:visible; transform:` (`translateY(0) scale(1)` nếu đã `clamped`, không thì `translateX(-50%) translateY(0) scale(1)`); gọi `place` trước khi mở.
- Đóng khi: bấm lại, `Escape`, bấm ra ngoài (`pointerdown` trên `document`, gỡ listener khi đóng/unmount), mất focus.
- `aria-expanded={open}`; hover/focus-visible cũ vẫn chạy (không xoá handler cũ).
- KHÔNG sửa `app/globals.css`.
- Card chứa "?" phải có `className="overflow-visible"` (ghi chú ở đầu `HelpTip.tsx`).

- [ ] Test đỏ: markup có `aria-expanded="false"`; e2e ở viewport 390px `page.tap()` vào `.help` đầu tiên → `.bub` hiển thị, tap ra ngoài → ẩn.
- [ ] Cài → xanh → commit `fix(p4-help): HelpTip mo bang bam, dung duoc tren dien thoai`.

---

## Nhóm C - Giao diện Tổng quan (chỉ làm các mục D-x đã duyệt)

### Task C1: `FilterBar` theo kỳ + chip (D-1, D-2, D-3, D-4)

**Files:**
- Modify: `src/components/dashboard/FilterBar.tsx`
- Modify: `app/[locale]/(app)/overview/page.tsx` (truyền `period`, `asOfDate`, `months`, `count`, `total`)
- Modify: `src/components/dashboard/DrillCharts.tsx` (không đổi hành vi drill; chip đọc `groupBy/groupKey` từ URL)
- Test: `e2e/02-overview.spec.ts` (cập nhật), `e2e/32-loc-ky.spec.ts` (mới)

**Interfaces:**
```ts
export function FilterBar(props: {
  teams: { id: number; name: string }[]; customers: { id: number; name: string }[];
  period: Period; asOfDate: IsoDate; months: YearMonth[];
  count: number; total: number; // "12 / 17 dự án": count = số dự án sau lọc, total = số dự án thuộc kỳ không lọc chiều nào
}): JSX.Element;
```
- 2 ô `<input type="date" className="inp">` ghi `from`/`to` lên URL (xoá `month` khi đổi), giữ style `selStyle` hiện có.
- Chip chiều lọc: `select` giữ nguyên, option đầu hiển thị tên chiều; khi đã chọn, `<option>` đang chọn hiển thị `t('filterChip.named', { dim, value })`.
- Chip "Từ biểu đồ": khi URL có `groupKey`, hiện `<button className="chip">` `t('filterChip.fromChart', { value })` + "✕" xoá `groupKey` (giữ `groupBy` vì nó còn là lựa chọn nhóm của chart).
- `clearAll` xoá mọi chiều lọc + `groupKey`, GIỮ `from`/`to`.
- Dòng `hintline` `t('period.summary', ...)` ngày dạng dd/mm/yyyy qua `formatDate`, tháng dạng `MM/yyyy`.
- Có "?" `helpTip.ovPeriod` cạnh nhãn kỳ.

- [ ] e2e đỏ trước: đặt `from=2026-07-01&to=2026-08-31` → dòng tóm tắt hiện "07/2026 - 08/2026"; bấm cột nhóm → chip "Từ biểu đồ" hiện, bấm ✕ → chip mất và số KPI trở lại; `?month=all` → không lỗi, hiện kỳ mặc định.
- [ ] Cài → xanh ở 1440px và 390px, sáng và tối (chụp so pixel như `e2e/30-priority-mau.spec.ts`) → commit.

### Task C2: KPI 2 nhóm, KPI 3 dòng, delta theo Q2, "?" (D-5..D-8)

**Files:** `src/components/dashboard/OverviewWidgets.tsx` (`KpiGrid`, `BacklogOverdueCard`), `src/components/dashboard/KpiCard.tsx` (nếu D-8 duyệt: prop `note` đã có, dùng cho dòng diễn giải; delta null → không hiện mũi tên), `e2e/02-overview.spec.ts`, `e2e/08-finance-gate.spec.ts`.
- Nếu D-7 duyệt: 2 khối, tiêu đề dùng khuôn `<div className="sect"><b>..</b><i /></div>` của `overview/page.tsx` dòng 85; thẻ "Doanh thu trong kỳ" chỉ render khi `canViewFinance`.
- `deltaSuffix = t('period.vsPrev')`.
- Mỗi thẻ có `help` tương ứng `helpTip.ov*`.
- [ ] e2e: viewer không thấy thẻ doanh thu/HĐ chưa khởi công; admin thấy; bấm "?" mở bong bóng.

### Task C3: Chart theo kỳ, nét đứt, cách đọc, công suất theo kỳ (D-9..D-11, D-13, F-2)

**Files:** `src/components/dashboard/OverviewWidgets.tsx` (bỏ `.slice(-6)`), `src/components/dashboard/charts.tsx` (`SpiCpiLine`, `SCurve`, `CapacityBar`), `src/components/dashboard/OverviewChartsLazy.tsx` (không đổi nếu chữ ký giữ tương thích).
- `SCurve`/`SpiCpiLine` nhận thêm prop tuỳ chọn `markerMonth?: string` (dùng ở Nhóm D) và dữ liệu có `carriedProjects`; nét đứt (D-10) = vẽ thêm 1 `Line`/`Area` nét đứt `strokeDasharray="5 4"` cho đoạn từ tháng liền trước tới tháng có `carriedProjects > 0`, series liền giữ nguyên (không đổi màu token).
- Tooltip thêm dòng `t('asOf.carriedTip', { n })` khi `carriedProjects > 0`.
- Dòng cách đọc: `<p className="hintline">{t('chartHowTo.x')}</p>` dưới `CardBody`.
- Không dùng `canvas`; `Brush` (nếu D-20) là SVG của Recharts.
- [ ] Unit: hàm tách đoạn nét đứt viết thuần trong `src/lib/carried-segments.ts` + test (dữ liệu `[{carried:0},{carried:1},{carried:0}]` → đoạn nét đứt chỉ ở tháng 2).

### Task C4: Cột "Số liệu" + link sang Chi tiết giữ kỳ (D-12, D-23)

**Files:** `src/components/dashboard/ProjectTable.tsx`, `src/components/dashboard/TopPriorityList.tsx` (chỉ link, không đổi nội dung thẻ Top).
- Cột hiển thị theo `s.dataState` (`asOf.current` là `t('asOf.month', ...)`...); `maskProjectSummaries` không che trường này (không phải tiền): kiểm `src/lib/finance-gate.ts` giữ nguyên trường `dataState`, thêm ca vào `src/lib/finance-gate.test.ts`.
- Link `/projects/${id}?from=..&to=..` dùng `periodSearch`.

---

## Nhóm D - Trang Chi tiết: mốc tháng, kỳ, điều hướng tuần (P4-T, F-5, F-6)

Cần Q6, Q7 và mục D-14..D-22 đã duyệt.

### Task D1: `project-queries.ts` bỏ cửa sổ 180 ngày, nhận ngày cụ thể (GIỮ `project-queries.ts`)

**Interfaces (thay chữ ký cũ):**
```ts
/** Ngày ảnh chụp: MAX(workDate) <= day, riêng nhân lực và thiết bị (Q7 = a). Không giới hạn 180 ngày. */
export async function getResourceSnapshot(projectId: number, day: IsoDate): Promise<ResourceSnapshot>;
export async function getResourceBreakdown(projectId: number, day: IsoDate): Promise<ResourceBreakdown>;
/** 7 ngày kết thúc ở ngày cuối có số <= day. */
export async function getWeeklyTracking(projectId: number, day: IsoDate): Promise<WeeklyTracking | null>;
export async function getWorkItemComparison(projectId: number, yearMonth: string): Promise<WorkItemCompare>; // giữ, nơi gọi truyền tháng nguồn của chuỗi giá trị
export async function getManpowerDaily(projectId: number, from: IsoDate, to: IsoDate): Promise<DailyPoint[]>;
// Xoá resourceWindow + RESOURCE_WINDOW_DAYS (sửa test cũ dùng chúng).
```
- Mỗi hàm: `readLastDailyDate` (Task A3) → đọc đúng ngày đó bằng `repo.getDailyManpower(projectId, d, d)` / `getDailyEquipment` (tracking: `addDaysIso(d, -6)` tới `d`).
- `day` phải hợp lệ (`isValidIsoDate`), sai → `todayIso()`; `day > todayIso()` → `todayIso()`.
- [ ] Test đỏ trong `src/server/project-queries.test.ts`: dữ liệu ngày cách 200 ngày trước vẫn hiện (code cũ trống); `day` là ngày không có số → lấy ngày trước gần nhất; nhân lực và thiết bị lệch ngày giữ nhãn riêng (N-6).
- [ ] Cài → xanh → commit → nhả.

### Task D2: Tham số thời gian trang Chi tiết

**Files:** Create `src/lib/detail-time.ts` + `.test.ts`; Modify `app/[locale]/(app)/projects/[id]/page.tsx`; Modify `src/server/projects-detail-page-month-guard.test.ts`.
```ts
export interface DetailTime { period: Period; asOfMonth: YearMonth; day: IsoDate; lastDataMonth: YearMonth | null }
/** factMonthsAsc: yearMonth các dòng fact isLatest của dự án (lấy từ repo.getFacts đã đọc sẵn). */
export function resolveDetailTime(
  sp: { from?: string; to?: string; month?: string; day?: string },
  project: { plannedStartDate: string | null; actualStartDate: string | null },
  factMonthsAsc: YearMonth[], today: IsoDate,
): DetailTime;
```
- Kỳ mặc định theo Q6. Mốc mặc định = tháng lớn nhất trong `factMonthsAsc` mà `<= periodAsOfMonth(period, today)`; không có → `periodAsOfMonth`.
- `month` trên URL hợp lệ nhưng ngoài kỳ → kẹp về tháng đầu/cuối của kỳ.
- `day` mặc định = `min(endOfMonth(asOfMonth), today)`; ngoài kỳ → kẹp.
- Trang: `requireUser` → kiểm id → `requireProjectRead` → `repo.getProject` → `repo.getFacts` → `resolveDetailTime` → `Promise.all` phần còn lại (giữ khối gom T1; thay `getProjectSummary(id, month)` bằng `getProjectSummary(id, t.asOfMonth)`, `repo.getValueChain` bằng `repo.readValueChainAsOf(id, t.asOfMonth)`, các hàm nguồn lực nhận `t.day`).
- `getWorkItemComparison(id, chain[0]?.yearMonth ?? t.asOfMonth)`.
- S-curve/SPI-CPI dự án: `carrySeries(facts, periodMonths(t.period))`, bỏ điểm null trước tháng có số đầu tiên.
- Tài chính (D-21): `financial` lọc tháng trong kỳ và `<= asOfMonth`, mới nhất trước.
- `WhatIf` dùng dòng `pickAsOf(facts, asOfMonth)` thay `facts[facts.length - 1]`.
- Timeline `buildPlanActualTimeline` giữ `today` (vạch hôm nay), %KH/%TT lấy từ summary tại mốc.
- [ ] Test đỏ `detail-time.test.ts`: dự án có số tới `2026-05` mở không tham số → `asOfMonth = '2026-05'`; `?month=2027-01` → kẹp; `?month=abc` → mặc định; `?day=2026-02-30` → mặc định.
- [ ] `projects-detail-page-month-guard.test.ts` giữ các ca rác cũ và thêm `from/to/day` rác không ném 500.
- [ ] e2e `e2e/33-chi-tiet-moc.spec.ts`: dự án đã kết thúc (tra trong `src/data/seed/history.ts` dự án có `actualFinishDate` trước `2026-09`, ghi id + lý do trong comment) mở trang thấy %TT khác "-" và dòng "Số tại <tháng cuối có số>"; link có `?month=` mở đúng mốc; nút "‹" đổi số.

### Task D3: Bộ chọn mốc + điều hướng tuần + "Số tại" + câu chậm/nhanh (D-14..D-17)

**Files:**
- Create: `src/components/project/DetailTimeBar.tsx` ('use client'; khuôn `useRouter`/`useSearchParams`/`router.replace(..., { scroll: false })` copy từ `src/components/dashboard/FilterBar.tsx` dòng 37-50).
- Create: `src/components/project/ResourceDayNav.tsx` (nút `asOf.prevWeek`/`nextWeek` = `day ± 7`, `<input type="date">`; không cho vượt hôm nay).
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx` (đặt 2 component theo vị trí đã duyệt, `CardHeader subtitle` = nhãn `asOf.*` cho từng thẻ).
- Modify: `src/components/dashboard/KpiCard.tsx` không cần nếu dùng `scheduleGap.text` với chuỗi `scheduleGapSentence.*` mới (điểm % = `Math.round(|gapPct|*100)`).
```ts
export function DetailTimeBar(props: { period: Period; asOfMonth: YearMonth; monthsInPeriod: YearMonth[]; lastDataMonth: YearMonth | null }): JSX.Element;
export function ResourceDayNav(props: { day: IsoDate; min: IsoDate; max: IsoDate; manpowerAsOf: IsoDate | null; equipmentAsOf: IsoDate | null }): JSX.Element;
```
- Đổi mốc/ngày chỉ đổi URL (`month`, `day`), trang server render lại; không fetch phía client.
- [ ] e2e: "Tuần trước" đổi nhãn "Số ngày" lùi 7 ngày (hoặc ngày gần nhất có số trước đó); KPI Nhân lực đổi theo; `href="#res-manpower"` vẫn cuộn.

### Task D4: Vạch mốc, tiêu đề, kéo chọn khoảng (D-18..D-20, D-22)

**Files:** `src/components/dashboard/charts.tsx` (`markerMonth` → `<ReferenceLine x={markerMonth} stroke={c.danger} strokeDasharray="4 4" />`, lấy màu từ `useChartTokens`, kiểm có token `danger`; không có thì dùng token của vạch "Hôm nay" ở `src/components/project/KeyMilestoneChart.tsx`), `src/components/project/ManpowerMonthChart.tsx`, `src/components/project/WeeklyManpowerStackChart.tsx` (`initialMonth` = mốc; vạch mốc), trang Chi tiết (tiêu đề + phụ đề khoảng tháng).
- `Brush` chỉ khi D-20 duyệt và số tháng > 12; theo phương án đã duyệt (chỉ phóng to, không đổi URL).

---

## Nhóm F - Nhập bù lịch sử (cần Q9-Q13)

### Task F1: Schema + migration (GIỮ `schema.prisma` + `prisma/migrations/`)

**Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_p4_backfill_window/migration.sql` (sinh bằng `npx prisma migrate dev --name p4_backfill_window --create-only` trên DB `_c`, đọc lại SQL rồi `npx prisma migrate deploy`), `docs/` ERD sinh lại bằng `npm run docs:erd` (không sửa tay).
```prisma
/** P4-T: admin bật cho PIC nhập lùi ngày/tháng cũ của 1 dự án trong [fromDate, toDate]. Không xoá dòng, tắt = điền disabledAt. */
model ProjectBackfillWindow {
  id         Int       @id @default(autoincrement())
  projectId  Int
  fromDate   DateTime  @db.Date
  toDate     DateTime  @db.Date
  note       String
  enabledBy  String
  enabledAt  DateTime  @default(now())
  expiresAt  DateTime?            // theo Q12; null = không tự hết hạn
  disabledBy String?
  disabledAt DateTime?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, disabledAt])
  @@map("project_backfill_window")
}
```
Thêm `backfillWindows ProjectBackfillWindow[]` vào `model Project`. Quy ước comment/`@@map` copy `model ProjectKeyMilestone`.
- [ ] `npx prisma generate`, `npx tsc --noEmit`, `npm test` → commit `feat(p4-t): bang project_backfill_window` → nhả.

### Task F2: Repo nhập bù (file mới, không đụng `prisma-repo.ts`)

**Files:** Create `src/server/repo/prisma-repo-backfill.ts`, `src/server/repo/mock-repo-backfill.ts`, `src/server/repo/backfill-contract.ts` (bộ ca dùng chung), `src/server/repo/backfill-mock.test.ts`, `src/server/repo/prisma-repo-backfill-real-db.test.ts`; Modify `src/server/repo/index.ts` (thêm vào `Object.assign`), `src/server/repo/mock-repo.ts` (thêm `makeBackfillMockRepo` như `makeNotifyMockRepo` dòng 923-926), `src/server/repo/types.ts` (kiểu).
Quy ước copy: `prisma-repo-notify.ts` / `mock-repo-notify.ts` / `signup-store-contract.ts` + `prisma-repo-signup-real-db.test.ts`.
```ts
export interface BackfillWindow { id: number; projectId: number; fromDate: IsoDate; toDate: IsoDate; note: string; enabledBy: string; enabledAt: string; expiresAt: string | null; disabledBy: string | null; disabledAt: string | null }
readActiveBackfillWindows(projectId: number, now: Date): Promise<BackfillWindow[]>; // disabledAt null và (expiresAt null hoặc > now)
listBackfillWindows(projectId: number): Promise<BackfillWindow[]>;                  // mới nhất trước, cho admin
createBackfillWindow(input: { projectId: number; fromDate: IsoDate; toDate: IsoDate; note: string; expiresAt: Date | null }, by: string): Promise<BackfillWindow | 'overlap' | 'not_found'>; // trong 1 transaction: kiểm trùng khoảng đang hiệu lực + ghi audit_log
disableBackfillWindow(id: number, by: string): Promise<'ok' | 'not_found' | 'already'>; // ghi audit_log
```
Ghi `audit_log` theo đúng cột mà `saveDailyResources` đang ghi (tìm `auditLog.create` trong `prisma-repo.ts` để copy tên bảng/trường, không sửa file đó).

### Task F3: Luật cửa sổ nhập + server action bật/tắt

**Files:**
- Modify: `src/lib/daily-entry.ts`: `dailyDateWindow(role, today, backfill: { from: IsoDate; to: IsoDate }[] = [])` trả `{ min, max, extra }`; `isInWindow` chấp nhận ngày nằm trong 1 khoảng `extra` (vẫn chặn `> max`). Test `src/lib/daily-entry.test.ts` thêm ca.
- Modify: `src/server/actions-entry.ts`: `checkDailyPayload` và `previewDailyImportAction` lấy `readActiveBackfillWindows(projectId, new Date())` rồi truyền vào `dailyDateWindow` (chỉ khi `role === 'data-entry'`; admin không cần). Khi ghi ngày chỉ hợp lệ nhờ nhập bù: `logActivity(user, 'save_daily_resources_backfill', ...)` thay vì action thường; lý do sửa số cũ (`needsReason`) giữ nguyên luật.
- Create: `src/server/actions-backfill.ts` (khuôn `src/server/actions-notify.ts`: `'use server'`, `requireRoleUser(['admin'])` từ `action-guards.ts` theo Q11, zod schema, `logActivity`):
```ts
export async function enableBackfillAction(projectId: number, fromDate: string, toDate: string, note: string): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'too_long' | 'overlap' | 'Not found' }>;
export async function disableBackfillAction(windowId: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'already' }>;
```
  Kiểm: ngày hợp lệ, `from <= to`, `to <= todayIso()` (nhập bù là quá khứ), độ dài theo Q12, `note` 5-500 ký tự; `expiresAt` theo Q12; `revalidateTag(profileTag)` không cần.
- Create: `src/server/actions-backfill.test.ts` (khuôn `src/server/actions-notify.test.ts`): viewer/bod/data-entry gọi → `Forbidden`; admin bật → data-entry ghi được ngày cũ trong khoảng qua `saveDailyResourcesAction` và qua `commitDailyImportAction`; ngày ngoài khoảng → `out_of_window`; sau `disable` → `out_of_window`; data-entry KHÔNG được gán dự án → vẫn `Forbidden` dù dự án có khoảng nhập bù; tháng khoá sổ → `locked` (Q10 = a).

### Task F4: Luật tháng (CHỈ khi Q9 = b hoặc c; GIỮ `actions.ts`)

**Files:** Create `src/lib/monthly-entry.ts` + test; Modify `src/server/actions.ts` (`saveMonthlyData` sau `requireProject`, `commitImportAction` sau lọc `owned`).
```ts
export function isMonthAllowed(role: Role, month: YearMonth, today: IsoDate, backfill: { from: IsoDate; to: IsoDate }[]): boolean; // admin luôn true; data-entry: tháng hiện tại, tháng trước (Q9), hoặc tháng giao 1 khoảng backfill
```
- Lỗi mới `error: 'out_of_window'`; thêm chuỗi `backfill.errMonth` ở Task E1 (nếu Q9 đã có trước E1; nếu không, E1 làm lại lần 2 và ghi rõ trong `phien-C.md`).
- Test trong `src/server/actions-entry.test.ts` hoặc file mới `actions-monthly-window.test.ts`.

### Task F5: Giao diện nhập bù (D-24, D-25) + tài liệu

**Files:** Create `src/components/form/BackfillPanel.tsx` (khuôn `src/components/admin/NotifyChannelEditor.tsx`); Modify `app/[locale]/(app)/ho-so-du-an/page.tsx` (chỉ render khi `user.role === 'admin'`), `app/[locale]/(app)/nhap-lieu/page.tsx` (tháng: `historyMonths()` cộng các tháng giao khoảng nhập bù; ngày: `dailyDateWindow(user.role, today, active)`; badge D-25), `src/components/form/ResourceEntryPanel.tsx` (nếu cần hiện badge); tài liệu `docs/huong-dan/nhap-bu-lich-su.md` (cách admin bật/tắt, cách PIC chọn ngày/tháng, Excel mẫu dùng file mẫu hiện có ở route `daily-template`, mỗi câu 1 dòng).
- e2e `e2e/34-nhap-bu.spec.ts`: admin bật khoảng cho dự án của `data-entry` e2e → đăng nhập data-entry → chọn ngày cũ 30 ngày trước → lưu thành công → admin tắt → ngày đó bị khoá lại; viewer mở `/ho-so-du-an` không thấy thẻ.

---

## Nhóm G - Kiểm cuối

### Task G1: Hiệu năng

- `npm run perf:seed` CHỈ chạy trên DB `ddc_control_tower_b` (guard `src/lib/perf-guard.ts`); C KHÔNG nới guard.
- Trên DB `_c`: chạy `EXPLAIN (ANALYZE, BUFFERS)` cho `readFactSnapshotsAsOf`, `readFactSeries` (kỳ 120 tháng), `readRevenueInRange`, `readLastDailyDate` trên seed thường; dán kết quả + giới hạn "chưa đo trên 10 triệu dòng" vào `thay-doi.md`.
- `npx tsx scripts/perf/bench-data.ts` (đã sửa chữ ký ở B2) với kỳ 12 tháng và 120 tháng, ghi thời gian.
- Nếu cần số đo 10 triệu dòng: ghi vào `phien-C.md` nhờ chủ dự án cho phép hoặc nhờ B đo trên DB `_b`.

### Task G2: e2e hồi quy + pixel

- Cập nhật `e2e/03-project-detail.spec.ts` (tiêu đề `detail.sCurve12` vẫn dùng key, số KPI vẫn 6), `02-overview`, `10-ten-app`, `11-tong-quan-sidebar-du-an`, `08-finance-gate`.
- Soi 1440px và 390px, sáng và tối cho Tổng quan, Chi tiết, Nhập liệu, Hồ sơ dự án; ghi mọi lệch pixel thấy được (kể cả ngoài phạm vi) vào `thay-doi.md`.
- `npx tsc --noEmit`, `npm test`, `npm run test:e2e` xanh; build kiểm compile với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ `D:\_project\DDC_dieu-phoi\tools\font-mock.js`.

---

## 4. Trường hợp biên bắt buộc

- Kỳ cắt ngang tháng (15/07 - 10/09): tính trọn 07, 08, 09; dòng tóm tắt ghi rõ.
- Kỳ trống số (không dự án nào có số <= mốc): KPI 0, chart trục vẫn đủ tháng với giá trị null/0, delta null; không ném lỗi.
- Dự án bắt đầu giữa kỳ: các tháng trước tháng có số đầu tiên là null (không mang số từ tương lai về).
- Dự án kết thúc giữa kỳ: vẫn thuộc kỳ, trạng thái tại cuối kỳ "Hoàn thành", %TT giữ 100% (mang số).
- Kỳ nằm hẳn trong tương lai (`from > hôm nay`): `asOfDate = min(to, today)` nhỏ hơn `from`.
  Khi đó số tồn vẫn tính tại hôm nay (mang số tới hôm nay), số phát sinh = 0, dòng tóm tắt kỳ ghi "số tồn tại <hôm nay>" để người xem thấy rõ.
  Không bịa số tương lai.
- `from`/`to` rác, ngày 30/02, năm 9999, chuỗi rất dài: rơi về mặc định, không 500, khoá cache không phình.
- `?month=all` (link cũ, e2e 09/27): mở được, dùng kỳ mặc định.
- Người không xem tiền: không thấy doanh thu, HĐ chưa khởi công, S-curve, bảng tài chính (giữ nhánh `canViewFinance` hiện có ở cả 2 trang).
- Nhân lực và thiết bị nhập lệch ngày: nhãn ngày riêng từng thẻ (N-6, `project-queries.ts` dòng 13-18).
- Nhập bù: khoảng trùng nhau, khoảng hết hạn, data-entry không được gán dự án, tháng khoá sổ, Excel có ngày ngoài khoảng (dòng đó `out_of_window`, dòng khác vẫn xem trước được).

## 5. Rủi ro, hiệu năng, bảo mật

- **Đổi chữ ký hàng loạt ở `queries.ts`**: nhiều test cũ đỏ; làm trong 1 task B2 có danh sách `rg` ở trên, không xoá ca kiểm quyền. Rủi ro xung đột merge với bên đang sửa `queries.ts`: giữ file ngắn, merge `main` trước khi bắt đầu B2.
- **Cache**: khoá theo `periodKey` + bộ lọc đã validate; tag `trendTag` đảm bảo mọi lần ghi số làm mới mọi kỳ (mang số làm tháng sau phụ thuộc tháng trước). Số kỳ khác nhau do người dùng chọn có thể nhiều: TTL 1800 giây giữ như cũ.
- **React `cache` theo tham chiếu**: truyền cùng object `period`/`filters`; test `src/server/queries-request-memo.test.ts` phải còn xanh.
- **Hiệu năng kỳ dài**: 500 dự án x 120 tháng = 60.000 dòng fact tối đa cho chuỗi xu hướng, chấp nhận được; `readFactSnapshotsAsOf` dùng LATERAL + index; nguồn lực chỉ đọc 1 ngày/7 ngày thay vì 180 ngày (nhẹ hơn hiện tại).
- **Bảo mật nhập bù**: chỉ admin bật/tắt (Q11), kiểm ở server action, không tin client; data-entry vẫn phải qua `canWriteProject` (assignment) trước khi xét khoảng nhập bù; khoảng có hạn (Q12); mọi lần bật/tắt và mọi lần ghi nhờ nhập bù có `audit_log` + `activity_log`; security-reviewer soi `actions-backfill.ts`, `actions-entry.ts`, `daily-entry.ts`, `actions.ts` (nếu F4).
- **Trang Chi tiết**: mọi truy vấn mốc/ngày vẫn sau `requireProjectRead`; tham số `day`/`month` chỉ dùng sau validate.
- **CSP (B, P5)**: không thêm thư viện mới; `Brush` là Recharts có sẵn.

## 6. Ngoài phạm vi

- P4-0 đổi token, redesign style, P4-X xuất report (của B), P3F, P5.
- Không thêm preset kỳ ("Quý này", "Năm nay"...) khi chủ dự án chưa yêu cầu.
- Không sửa `PROGRESS.md`, `.serena/memories/` trong nhánh phase.
- Nhánh làm việc: `feature/p4-logic-bo-loc` (đã tạo, thay tên `feature/p4-redesign`); ghi tên nhánh này vào dòng P4 của `lo-trinh.md` khi cập nhật trạng thái.
