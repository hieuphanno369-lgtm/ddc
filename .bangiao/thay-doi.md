# P3C-B — Chart T1/T2/T4/T5: thay đổi cho Tester

## Mốc đầu phase
`npx tsc --noEmit` sạch. `npm test` = **140 file / 1605 test xanh** (trước khi có bất kỳ sửa đổi nào của P3C-B).

## Mốc cuối (sau Bước 8)
`npx tsc --noEmit` sạch. `npm test` = **146 file / 1650 test xanh** (tăng 6 file / 45 test so với mốc đầu,
không tụt). `npm run check:read` chạy trên DB `ddc_control_tower_b` (đã seed + migrate) → **OK** (bao gồm
hàm mới `readManpowerActualByMonth`).

## Bước đã làm (1 → 8, mỗi bước 1 commit)

### Bước 1 — Kiểu tạm hợp đồng P3C + test chống lệch
Commit `3e96c1c`.
- `src/lib/p3c-contract.ts` (mới): chép nguyên văn 4 interface hợp đồng (`EquipmentPlanSegment`,
  `EquipmentQuota`, `ManpowerPlanMonthRow`, `ShiftRatio`) từ
  `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md`.
- `src/lib/p3c-contract.test.ts` (mới): `fieldsOf()` đọc mã nguồn dạng chữ, so khớp trường của
  `p3c-contract.ts` với `src/server/repo/types.ts` (file của A). Hiện A chưa merge P3C-A nên
  `types.ts` chưa có 4 kiểu này — test 2 ("khớp trường với types.ts") bỏ qua từng tên khi
  `fieldsOf(typesSrc, name) === null`. **Tester nên soi:** sau khi A merge P3C-A, chạy lại
  `npx vitest run src/lib/p3c-contract.test.ts` — nếu FAIL nghĩa là A đổi tên/kiểu trường khác
  hợp đồng, báo điều phối chứ không tự sửa.

### Bước 2 — T1: nhãn số chart tuần + tooltip dùng actualAvg
Commit `e751b94`.
- `src/components/project/WeeklyManpowerStackChart.tsx`: thêm `Bar` rỗng ở đỉnh chồng + `LabelList`
  cho nhãn tổng (`weeklyLabelValues(w).total`), `LabelList` trên `Line` KH (`.planned`); tăng
  `margin.top` 8→20 để không bị cắt; sửa tooltip dùng `w.actualAvg` (TB thật) thay vì tự cộng số
  từng nhà thầu đã làm tròn (tránh sai lệch khi cộng dồn phần dư).
- Export thêm `weeklyLabelValues`, `weeklyTooltip` (trước là hàm nội bộ) để test không phụ thuộc
  render SSR của Recharts.
- **Lưu ý kỹ thuật (Tester không cần sửa, chỉ để biết):** `LabelList` generic của Recharts 2.12.7
  suy luận kiểu `T` từ constraint mặc định `Data` (không tự khớp `WeekBucket`) → dùng
  `dataKey={(w: unknown) => weeklyLabelValues(w as WeekBucket)...}` để qua `tsc`, không ảnh hưởng
  runtime (Recharts luôn gọi hàm với đối tượng dữ liệu tuần thật).
- **Tester nên soi:** kiểm trình duyệt `/vi/projects/1` `#res-weekly` — nhãn tổng cột và nhãn KH có
  thể đè nhau ở tuần mà KH ≈ TT (đã ghi ở mục "Nợ để sau" bên dưới, không tự đổi thiết kế).

### Bước 3 — T2: logic "Top dự án trọng điểm"
Commit `30d2f4f`.
- `src/lib/top-priority.ts` (mới): `isBehindSchedule` (= định nghĩa KPI "Trễ tiến độ" hiện có:
  `status === 'Dang_trien_khai' && !onTrack`), `selectTopPriority` (lọc P0 + đang triển khai, sort
  trễ trước → %TT tăng dần → tên theo vi).
- `src/server/top-priority-queries.ts` (mới): `getTopPriority(yearMonth, filters)` = áp FilterBar
  qua `getProjectSummaries` rồi `selectTopPriority` (theo Câu hỏi 3 đã chốt: có lọc theo FilterBar).
- `src/server/cache.ts`: thêm `loadTopPriority` (mẫu `loadWatchlist`, cùng tag `overviewTag` +
  `profileTag`). **Không đụng** `getWatchlist`/`loadWatchlist`/`AlertBanner` (banner đầu trang vẫn
  dùng watchlist cũ theo đúng kế hoạch).

### Bước 4 — T4: model Gantt thiết bị theo đợt
Commit `270d16e`.
- `src/lib/equipment-gantt-v2.ts` (mới): `buildGanttAxis` (trục tuần nếu tổng kế hoạch ≤ 92 ngày,
  ngược lại trục tháng — Câu hỏi/quyết định T4c), `assignLanes` (xếp lane cho đợt chồng ngày),
  `buildPlanGantt` (Câu hỏi 2 đã chốt: quota không có đợt vẫn ra 1 hàng trống `0/tổng`), `formatDayMonthDot`.
- 12 test bao trùm mọi trường hợp biên nêu trong kế hoạch (trục tuần/tháng, biên 92/93 ngày, lane
  chồng đợt, `qtyNow` tính đúng ngày hôm nay/ngày mai, quota không đợt, đợt không quota, dữ liệu
  rỗng/hỏng, `todayInRange`, màu theo `equipmentColor`).

### Bước 5 — T4: component `EquipmentPlanGantt`
Commit `67f3a76`.
- `src/components/project/EquipmentPlanGantt.tsx` (mới): SVG tự vẽ theo mẫu `EquipmentGantt.tsx`
  (`ChartTip`/`useChartTip`, `xOf`), cột "SL nay/tổng", dòng phụ dưới tên = khoảng ngày toàn quá
  trình, marker "Hôm nay" dạng pill khi `todayInRange`. **Không** có legend hạng mục/ô ngày thực
  tế/dòng "ngày có dùng" (đúng T4b đã chốt).
- **Tester nên soi:** độ rộng pill "Hôm nay" ước lượng theo số ký tự chuỗi dịch (không đo DOM thật
  vì SVG server-render) — nếu chuỗi dịch tiếng Anh dài bất thường có thể lệch nhẹ, kiểm bằng mắt ở
  Bước 11 khi lên trang thật.

### Bước 6 — T5: đọc thực tế nhân lực theo tháng (read repo của B)
Commit `6731acc`.
- `src/server/repo/read-types.ts`: thêm `ManpowerActualMonthRow`, khai báo
  `readManpowerActualByMonth` trong `ReadRepo`.
- `src/server/repo/read-prisma.ts`: SQL `GROUP BY to_char(workDate,'YYYY-MM')`,
  `SUM(actualHeadcount)`, `COUNT(DISTINCT workDate)`.
- `src/server/repo/read-mock.ts`: gom `dailyManpowerShifts` theo tháng, cộng `actualHeadcount`, đếm
  `Set` ngày khác nhau.
- `scripts/check-read-parity.ts`: thêm đối chiếu hàm mới cho dự án 1 và 17.
- `npm run check:read` chạy trên DB `ddc_control_tower_b` (đã migrate + seed) → **OK**, bao gồm
  `readManpowerActualByMonth(1)` và `(17)`.

### Bước 7 — T5: model chart KH nhân lực theo tháng
Commit `6a5c000`.
- `src/lib/manpower-month-chart.ts` (mới): `buildManpowerMonthModel` (ca hiển thị = hợp mã ca trong
  KH + tỷ lệ, tên/thứ tự lấy từ `dim_shift`; trục tháng = dải liên tục theo Câu hỏi 4 đã chốt;
  `actualAvg` chia cho số ngày CÓ NHẬP LIỆU theo Câu hỏi 1 đã chốt), `niceMax` (làm tròn trục Y bậc
  1/2/2.5/5×10^k).
- Test dùng đúng bộ số "ảnh mẫu" trong hợp đồng (450/700/800/900/800/650/400, 60/40) — khớp `maxY
  1000` và mọi trường hợp biên (tháng thiếu giữa dải, tháng chỉ có TT trước KH, mã ca lạ, rỗng).

### Bước 8 — T5: component `ManpowerMonthChart`
Commit `c3ff1fe`.
- `src/components/project/ManpowerMonthChart.tsx` (mới): SVG tự vẽ pixel thật (không `viewBox`) +
  `ResizeObserver` đo bề rộng khung (mẫu `WeeklyManpowerStackChart.tsx`), cột theo ca, đường tổng KH
  (liền) + đường TT TB/ngày (nét đứt) — đứt đoạn ở tháng thiếu dữ liệu tương ứng, `Legend` hiện tỷ lệ
  % từng ca, tooltip qua `ChartTip`/`useChartTip` (không dùng tooltip Recharts vì đây là SVG tự vẽ).
- **Tester nên soi:** cách chia ô "SL"/nhãn theo trục 2 tầng (tên ca + tháng) chỉ kiểm bằng test
  markup (không có trình duyệt thật ở bước này vì trang Chi tiết TREO ở Bước 11) — khi lên trang
  thật (Bước 11) cần chụp ảnh 1440px và 390px để xác nhận không đè chữ.

## Việc chờ / TREO
- **Bước 9–10 (key i18n mới + thẻ "Top dự án trọng điểm" lên Tổng quan): CHƯA LÀM.** Kiểm
  `D:\_project\DDC_dieu-phoi\phien-A.md` lúc coder làm xong Bước 8 (2026-09-25): mục "Đang giữ" của A
  vẫn còn `vi.json`, `en.json` (khoá cho vòng sửa 1 P3A) — chưa có ghi chú nhả khoá. Theo đúng chỉ
  thị nhiệm vụ, DỪNG ở đây, không sửa `vi.json`/`en.json`. Khi A nhả khoá: làm Bước 9 (3 nhóm key
  `topPriority.*`, `equipmentPlanGantt.*`, `manpowerMonthChart.*` — nội dung đã có sẵn trong
  `.bangiao/ke-hoach.md` mục Bước 9) rồi Bước 10 (nối `TopPriorityList` vào `OverviewWidgets.tsx` +
  `overview/page.tsx`, xoá `Watchlist.tsx`/`Watchlist.test.ts`).
- **Bước 11 (nối Gantt theo đợt + chart KH nhân lực tháng vào trang Chi tiết dự án, xoá chart cũ):
  TREO** — chờ đủ 3 điều kiện: (a) A merge P3C-A vào `main` (đủ 4 kiểu hợp đồng trong
  `src/server/repo/types.ts` + 4 hàm `readEquipmentPlanSegments`/`readEquipmentQuotas`/
  `readManpowerPlanMonths`/`readShiftRatios` ở cả Prisma lẫn mock), (b) Bước 9 xong, (c) A không
  đang nâng Next. Chưa động tới `equipment-gantt.ts`, `EquipmentGantt.tsx`, `ShiftManpowerChart.tsx`,
  trang `projects/[id]/page.tsx` — chart cũ vẫn đang chạy, KHÔNG có rủi ro regression cho người dùng.

## Lệch so với kế hoạch
Không có — Bước 1-8 làm đúng theo `.bangiao/ke-hoach.md`, không đổi tên/kiểu hợp đồng, không đụng
file nóng nào ngoài phạm vi cho phép.

## Nợ để sau (ghi lại, không tự sửa)
- T1: nhãn tổng cột và nhãn KH trên `WeeklyManpowerStackChart` có thể đè nhau ở tuần mà KH ≈ TT —
  cần chủ dự án/Tester xác nhận trên trình duyệt thật rồi mới quyết định có cần chỉnh `offset` không.
- Key i18n cũ của chart bị thay thế (`manpowerCharts.shift*`, `equipmentGantt.*`) CHƯA xoá — theo
  đúng kế hoạch, việc xoá chart cũ + key cũ dồn vào Bước 11 (khi nối trang Chi tiết).
- `EquipmentPlanGantt`: bề rộng pill "Hôm nay" ước lượng theo độ dài chuỗi dịch (không đo DOM thật).

## Câu hỏi còn mở
Không có — 4 câu hỏi trong `.bangiao/ke-hoach.md` đã được chủ dự án CHỐT trước khi coder bắt đầu
(mục "ĐÃ CHỐT" đầu file), Bước 1-8 làm đúng theo đó, không phát sinh câu hỏi nghiệp vụ mới.
