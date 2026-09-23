# Kết quả test — Đợt 2: App khớp `mockup-apple-glass.html` (10/10 Task)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm toàn bộ 10 Task → smoke-test + kiểm mắt bằng `mcp__playwright` (dev server thật,
`npm run dev`, dev-login cookie có sẵn từ phiên trước — không cần đăng nhập lại).
Không đụng DB (app chạy mock in-memory, không cần `mcp__postgres`).

## KẾT LUẬN: FAIL — 1 CAN SUA, 2 GOP Y

Nền xanh 100% (tsc/test/console không hydration-error), nhưng phát hiện **1 lỗi thật** khi kiểm
mắt (tooltip bị cắt ở viewport 1440px) — đúng điểm mà `thay-doi.md` Task 4 dặn "Tester soi kỹ:
tooltip (portal, không bị cắt)". Dừng dây chuyền cho debugger xử lý.

## Nền tự động (xác nhận lại, không đổi)

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **699/699 xanh** (50 file), không skip, không warning lạ.
- `npm run dev` chạy sạch, sẵn sàng ở `http://localhost:3000` (Ready in 2.8s).

## Đường chạy thuận lợi — đã kiểm bằng mắt, tất cả ĐÚNG

| Hạng mục (Task) | Kết quả |
|---|---|
| 3 thẻ "Trọng tâm" + thứ tự KPI (Task 1) | `/vi/projects/1`: đúng thứ tự %KH, %TT (hero), SPI (hero), CPI (hero), EAC, VAC — 3 thẻ hero liền vị trí 2-4 |
| Timeline KH/TT dạng thanh (Task 2) | Dự án 1: có `.tlbar act`, viên "Hôm nay" định vị đúng, không bị `.card` (overflow hidden) cắt (đã đo `getBoundingClientRect` viên nằm trọn trong card) |
| Đồng hồ đếm ngược (Task 3) | Chỉ hiện khi có `plannedFinishDate`; giây giảm thật qua 2 lần đọc cách nhau ~3s (12s → 01s); `prefers-reduced-motion: reduce` → `animationDuration` của `.pulsedot` = `0.00001s` (tắt hẳn, nhờ rule global `@media (prefers-reduced-motion: reduce)` trong `globals.css`) |
| Nhân lực theo nhà thầu / Thiết bị theo nhóm (Task 4) | TỔNG khớp đúng **520/486** (nhân lực) và **72/63** (thiết bị) ở dự án 1; hover hiện tooltip đúng số liệu (xem mục CAN SUA về vị trí tooltip) |
| Tracking huy động 7 ngày, 3 tab (Task 5) | Tuần hiển thị **10/09 - 16/09** (kết thúc đúng ngày cuối có dữ liệu seed, khớp `DDC_FAKE_TODAY`/Q4 default, KHÔNG phải hôm nay thật 23/09); chuyển cả 3 tab (Nhật ký/Ma trận/Theo thiết bị) hoạt động, nội dung đổi đúng |
| Các mốc chính + nút Sửa mốc (Task 6) | Nút "Sửa mốc" dẫn đúng `/vi/nhap-lieu?project=1&step=profile#key-milestones`; ở khổ 390px, 21 text-node trong SVG không overlap nhau (đo bằng `getBoundingClientRect` từng cặp) |
| Luồng ghi mốc chính (Task 7) | Thêm 1 mốc mới ("Mốc test QA"), Lưu → reload `/vi/projects/1` thấy dữ liệu thật; xoá lại mốc test, Lưu, reload xác nhận đã dọn sạch (về đúng 5 mốc ban đầu) — **ghi/đọc thật qua action + repo, không mock** |
| Trình sửa mốc trong form (Task 8) | Auto-focus + bôi chọn ô tên khi thêm dòng mới (đúng như thay-doi.md mô tả); xoá tên mốc #1 rồi bấm Lưu → **không lưu gì cả kể cả field hồ sơ khác** (đổi Khối lượng 26822→99999, Lưu, reload vẫn là 26822 — xác nhận validate chặn đúng toàn bộ submit) |
| Timeline 7 giai đoạn + chọn giai đoạn (Task 9) | Bấm "Lắp dựng" → biểu đồ so sánh đổi thành "Biểu đồ so sánh - Lắp dựng"; bấm lại để bỏ chọn → về "Gia công (mặc định)" |
| Biểu đồ so sánh theo hạng mục (Task 10) | Bấm "Thiết kế" (giai đoạn `manual`) → hiện đúng chữ "Giai đoạn này nhập tay %, không có sản lượng"; mặc định không chọn gì → "Gia công (mặc định)" |
| `/overview`, `/report` (Q2 — không đổi) | Mở cả 2 trang, không crash, không lộ key i18n thô |
| `/en/projects/1` | Không lộ key i18n thô (`kpi.focusTag`, `detail.tl.*` không xuất hiện dạng chữ thô) |
| Dark mode | `/vi/projects/1` full-page ở 1440px: mọi khối render đúng, chữ đọc được, không thấy hex lộ ra ngoài token |
| 3 khổ màn hình | 1440px, 900px, 390px: `document.documentElement.scrollWidth <= window.innerWidth` ở cả 3 — **không tràn ngang** |
| Console | Không có lỗi hydration / "Text content did not match" ở bất kỳ trang nào đã mở |

## CAN SUA (1)

### CAN-1 — Tooltip `.tip` của "Thiết bị theo nhóm" tràn ra ngoài viewport bên phải ở 1440px (sáng và tối, vì không liên quan theme)

- **Màn/khổ:** `/vi/projects/1`, khổ 1440×1000 (desktop chuẩn), cả 2 theme (bug ở logic JS, không
  phụ thuộc theme).
- **Bước tái hiện:** cuộn tới card "Thiết bị theo nhóm" (Task 4), hover vào dòng đầu ("Cẩu bánh
  xích" — có nhiều nhà thầu trong "Phụ trách": "Nhà thầu Lắp dựng A, Nhà thầu Lắp dựng B, Nhà thầu
  Cơ khí C").
- **Kỳ vọng:** tooltip portal ra `document.body`, tự lật trái nếu sắp tràn phải (theo comment
  trong chính code: "PHẢI portal ra body... Card có transform, khiến position:fixed bên trong
  tính theo Card chứ không theo viewport").
- **Thực tế:** đo bằng `getBoundingClientRect()` khi tooltip đang hiện:
  `{ left: 1259.99, right: 1588.89, top: 129.99, bottom: 295.84 }`, trong khi
  `viewportSize = { width: 1440, height: 1000 }`. `right = 1588.89 > 1440` → **tràn ra ngoài màn
  hình bên phải ~149px**, phần cuối tooltip (giá trị "Thiếu"/"Đạt" hoặc mép phải) bị khuất ngoài
  viewport.
- **Nguyên nhân kỹ thuật:** `src/components/project/ChartTip.tsx` tính điểm lật trái/phải bằng
  hằng số cứng `const w = 200` (`if (x + w > window.innerWidth - 10) x = ev.clientX - w - 14`),
  nhưng CSS `.tip` trong `app/globals.css` (dòng 467-473) chỉ có `min-width:160px`, **không có
  `max-width`**, và dòng "Phụ trách" trong tooltip thiết bị có thể liệt kê nhiều tên nhà thầu
  (`Nhà thầu Lắp dựng A, Nhà thầu Lắp dựng B, Nhà thầu Cơ khí C`) không bị wrap/truncate, khiến
  bề rộng thực tế lên tới **~329-380px**, xa hơn nhiều so với giả định `w=200`. Vì flex `.tip .r`
  không giới hạn wrap, hàng dài tự nới rộng cả khối `.tip`.
- **File nghi ngờ:** `src/components/project/ChartTip.tsx` (hằng `w = 200` không khớp bề rộng
  thật đã render); có thể cần thêm `max-width` + `white-space: normal`/`word-break` cho `.tip .r
  span` trong `app/globals.css`, hoặc đo bề rộng thật bằng `ref` sau khi mount thay vì đoán trước.
- **Phạm vi ảnh hưởng:** áp dụng cho MỌI tooltip dùng chung `useChartTip()`/`ChartTip` (cả
  "Nhân lực theo nhà thầu" lẫn "Thiết bị theo nhóm", Task 4) — với "Nhân lực theo nhà thầu" tôi
  không thấy tràn vì dòng "Phụ trách" chỉ có 1 tên, nhưng bug tiềm ẩn tương tự nếu dữ liệu dài hơn
  (ví dụ nhà thầu tên dài). Đây là lỗi logic, không phải lệch thẩm mỹ nhỏ — đúng ngay điểm dặn
  trong `thay-doi.md`.

## GOP Y (2 — không phải lỗi của Đợt 2, không chặn merge)

### GOP-1 — Console warning "Support for defaultProps will be removed" (Recharts)

Xuất hiện ở mọi trang có Recharts (`XAxis`, `YAxis`, `ReferenceLine` trong
`src/components/dashboard/charts.tsx`, `WorkItemCompareChart.tsx`), kể cả `/vi/overview` — trang
Q2 khẳng định KHÔNG đổi trong Đợt 2. Xác nhận đây là cảnh báo cấp thư viện (Recharts 2.12.7 vẫn
dùng `defaultProps` trên function component, React 18 cảnh báo sẽ bỏ hỗ trợ ở bản sau), tồn tại từ
trước Đợt 2, không phải do code mới. Không phải lỗi hành vi, chỉ là noise console. Không chặn.

### GOP-2 — `<input type="date">` ở `DataEntryForm.tsx` (bước Hồ sơ) nhận giá trị ISO datetime thô

Console warning: `The specified value "2025-11-20T00:00:00.000Z" does not conform to the required
format, "yyyy-MM-dd"` cho các ô Ngày ký HĐ, Ngày BĐ kế hoạch, Ngày cam kết bàn giao, v.v. Đã
`git blame` xác nhận dòng `contractDate: project.contractDate ?? ''` (không `.slice(0,10)`) có từ
commit `e7cb788` — **trước Đợt 2**, Task 8 không đụng logic khởi tạo `form` này. Giá trị vẫn lưu/
đọc đúng khi Lưu (đã verify ở CAN-1 test flow), chỉ là input hiển thị rỗng cho tới khi user gõ lại
hoặc React tự phục hồi — hành vi cũ, ngoài phạm vi Đợt 2 (không nằm trong 10 Task, không thuộc
mục "Tester soi kỹ" nào). Ghi lại để chủ dự án cân nhắc dọn ở lần sau.

## Ghi chú thủ tục

- Đã chụp ~15 screenshot trong lúc kiểm mắt (`.bangiao/test-screens/*.png`) để đối chiếu trực tiếp
  trong phiên làm việc (KPI order, dark mode full-page, mobile 390px, tab Ma trận nhân lực, form
  KeyMilestoneEditor trước/sau khi thêm dòng). Theo đúng chỉ dẫn "không commit ảnh", đã dọn thư
  mục này sau khi xem xét xong — không còn tồn tại trên đĩa ở thời điểm ghi báo cáo này (không
  ảnh hưởng tới bằng chứng bằng số đã trích dẫn ở trên, vốn đến từ `getBoundingClientRect()` đo
  trực tiếp trong DOM thật, không phụ thuộc ảnh chụp).
- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động mới (các lỗi phát hiện đều thuộc
  loại hành vi hiển thị/layout thật — cần DOM layout thật để tái hiện; `vitest.config.ts` của repo
  chạy môi trường `node` (không DOM layout), nên không thể viết unit test tái hiện đúng bug
  CAN-1 trong hạ tầng test hiện có mà không đổi cấu hình — để nguyên cho debugger quyết định
  hướng vá kèm cách verify phù hợp).
- Dev server (`npm run dev`, chạy nền) đã dừng khi kết thúc phiên.

---

## Kiểm lại sau vòng debug 1 (commit `8da0486`)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`). Không đụng DB.

### KẾT LUẬN: FAIL — CAN-1 (tooltip `.tip` tràn phải ở 1440px) CHƯA ĐƯỢC VÁ Ở RUNTIME THẬT

Nền tự động xanh 100% (`tsc`/`test` — xem dưới), nhưng khi kiểm mắt lại đúng kịch bản tái hiện CAN-1
(hover dòng đầu "Cẩu bánh xích" ở card "Thiết bị theo nhóm", `/vi/projects/1`, 1440×1000), tooltip
**vẫn tràn phải y hệt lần trước**, gần như cùng con số đo được. Vá không có hiệu lực trong trình
duyệt thật dù 705/705 test xanh và không có lỗi console mới. Dừng dây chuyền, không tự sửa code.

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **705/705 xanh** (51 file, đúng như `thay-doi.md` báo cáo, +6 so với 699 trước đó
  nhờ `src/lib/tooltip-position.test.ts`).
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.
- `npm run build`: KHÔNG chạy (đúng ghi chú của điều phối viên — lỗi mạng cục bộ
  `SELF_SIGNED_CERT_IN_CHAIN` khi tải Google Font Inter, môi trường, không tính FAIL).

### Bằng chứng đo được — CAN-1 vẫn tái hiện y hệt

Kịch bản: `/vi/projects/1`, khổ **1440×1000**, hover từng dòng (row overlay `rect[fill="transparent"]`)
của cả 2 biểu đồ `ResourceBreakdownChart` ("Nhân lực theo nhà thầu" và "Thiết bị theo nhóm"), đo
`.tip.show` bằng Playwright `boundingBox()` (tương đương `getBoundingClientRect()`):

| Biểu đồ | Dòng | left | right | top | bottom | Tràn viewport (1440×1000)? |
|---|---|---|---|---|---|---|
| Nhân lực theo nhà thầu | 0-5 (cả 6 dòng) | ~596 | ~807-834 | ~571-712 | ~719-860 | KHÔNG — trong viewport |
| **Thiết bị theo nhóm** | **0** | **1259.99** | **1579.98** | 538.99 | 704.85 | **CÓ — tràn phải 139.98px** |
| Thiết bị theo nhóm | 1 | 1259.99 | 1579.98 | 570.99 | 736.85 | CÓ — tràn phải 139.98px |
| Thiết bị theo nhóm | 2-6 (5 dòng còn lại) | 1259.99 | 1459.08-1491.42 | 605.99-746.99 | 754.21-895.21 | CÓ — tràn phải 19-51px |

Tất cả 7 dòng của "Thiết bị theo nhóm" đều tràn phải (dòng dài nhất ~140px, khớp gần đúng con số
149px lần test trước — chênh lệch nhỏ do dữ liệu random/seed động, không phải do đã cải thiện).

Đo lặp lại ở dòng 0 với 8 lần chụp cách nhau 150ms (tổng 1050ms sau khi chuột đứng yên): style
`left`/`top` của `.tip` **không đổi qua bất kỳ lần đo nào** — luôn `left: 1260px; top: 536px`, `width`
luôn ~320px (đúng `max-width` mới đã áp dụng) nhưng vị trí **không được kẹp lại**:
`right = 1260 + 320 = 1580 > 1440`.

### Chẩn đoán sơ bộ (để debugger tham khảo, KHÔNG phải kết luận root-cause chính thức)

- `max-width` CSS mới trong `app/globals.css` **có** áp dụng đúng — bề rộng đo được ~320px thay vì
  ~380px như trước, xác nhận phần CSS của vá đã chạy.
- Nhưng phần "đo lại + kẹp vị trí" trong `ChartTip.tsx` (`useEffect` gọi `clampTipPosition` với
  `rect.width/height` thật) **không có tác dụng quan sát được**: vị trí `.tip` giữ nguyên vị trí ước
  lượng ban đầu (`estW = 200`) trong suốt thời gian tooltip hiển thị, kể cả sau 1050ms đứng yên
  chuột — nghĩa là `setMeasured(...)` hoặc không được gọi, hoặc bị gọi nhưng không kích hoạt
  re-render đưa `pos = measured` vào style, hoặc giá trị `measured` tính ra trùng với ước lượng ban
  đầu (đã loại khả năng này vì `clampTipPosition` tính tay với `width=320, clientX≈1244` cho ra
  `x=910`, không phải `1260`).
- Test mới `src/lib/tooltip-position.test.ts` chỉ test **hàm thuần** `clampTipPosition()` (chạy trong
  môi trường `node`, không DOM layout thật) — không có test nào phủ đường dây `useEffect` đo
  `getBoundingClientRect()` → `setMeasured` → re-render trong `ChartTip.tsx`, nên lỗi wiring này
  không bị 705 test hiện có bắt được.

### Console

Không có lỗi mới ngoài GOP-1 cũ (Recharts `defaultProps` warning, đã ghi nhận trước Đợt 2, không
liên quan CAN-1). Không có lỗi hydration.

### Chưa kiểm tiếp

Vì CAN-1 vẫn còn (lỗi thật, đúng điểm dặn trong `thay-doi.md`), dừng ở đây theo đúng quy trình —
chưa kiểm thêm khổ 900px/390px, dark mode, hay smoke trang chi tiết khác cho vòng debug này (không
cần thiết cho tới khi CAN-1 được vá lại). 2 GOP Ý cũ giữ nguyên, ngoài phạm vi.

Dev server (`npm run dev`) đã dừng khi kết thúc phiên (đã `taskkill` tiến trình PID giữ cổng 3000).

---

## Kiểm lại sau vòng debug 2 (commit `78ba1b2`, vòng cuối)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`). Không đụng DB.

### KẾT LUẬN: PASS — CAN-2 (tooltip đo-lại nhưng vị trí không đổi) ĐÃ VÁ, tooltip nằm trọn viewport ở mọi chart/khổ/theme đã kiểm

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **708/708 xanh** (51 file), đúng kỳ vọng điều phối viên nêu.
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.
- `npm run build`: KHÔNG chạy — lỗi mạng cục bộ `SELF_SIGNED_CERT_IN_CHAIN` khi tải Google Font
  Inter, môi trường máy này, không liên quan code (đúng như 2 vòng trước, không tính FAIL).

### Ghi chú môi trường quan trọng (ảnh hưởng cách đọc số đo)

Phiên Playwright MCP này chạy trên một cửa sổ trình duyệt thật với scaling hệ điều hành khiến
`window.innerWidth` KHÔNG khớp số truyền vào `browser_resize`/`setViewportSize` (tỉ lệ đúng
10/9 — ví dụ yêu cầu 1440 thì `window.innerWidth` thực tế là 1600, yêu cầu 390 thì thực tế 433).
Đây là đặc thù phiên làm việc (Windows display scaling ảnh hưởng CDP), KHÔNG phải bug app. Vì đề
bài yêu cầu so `right ≤ innerWidth` (không phải so với số nominal), tất cả phép đo dưới đây dùng
`window.innerWidth`/`window.innerHeight` ĐỌC TRỰC TIẾP tại thời điểm đo (qua `page.evaluate`),
không dùng số nominal đã yêu cầu resize — đây là cách đo đúng theo đúng chữ của đề bài và đúng với
những gì bản thân code ứng dụng dùng (`ChartTip.tsx` cũng đọc `window.innerWidth`/`innerHeight`
thật, nên hai bên nhất quán).

### Bằng chứng đo được — trường hợp tệ nhất trước đây ("Thiết bị theo nhóm", cột/dòng đầu) nay đã nằm trọn viewport

Khổ yêu cầu 1440×1000 (thực tế `innerWidth×innerHeight` = **1600×1111**), hover cả 7 dòng của
"Thiết bị theo nhóm" (rê chuột qua trái→giữa→phải trong hàng, không chỉ đứng yên), đo
`getBoundingClientRect()` của `.tip.show`:

| Dòng | left | right | top | bottom | innerWidth | Nằm trọn? |
|---|---|---|---|---|---|---|
| 0 | 1212.99 | 1532.99 | 650.99 | 816.85 | 1600 | CÓ |
| 1 | 1212.99 | 1532.99 | 685.99 | 851.85 | 1600 | CÓ |
| 2 | 1314.99 | 1533.08 | 721.99 | 870.21 | 1600 | CÓ |
| 3 | 1313.99 | 1532.79 | 756.99 | 905.21 | 1600 | CÓ |
| 4 | 1329.99 | 1533.04 | 791.99 | 940.21 | 1600 | CÓ |
| 5 | 1301.99 | 1533.43 | 826.99 | 975.21 | 1600 | CÓ |
| 6 | 1343.99 | 1533.06 | 861.99 | 1010.21 | 1600 | CÓ |

Đối chiếu: right lớn nhất đo được (~1533.4) còn cách mép phải viewport thật (1600) khoảng ~66px,
không tràn — khác hẳn vòng debug 1 (lúc đó `.tip` đứng yên tại vị trí ước lượng sai, không đo lại).
Đã xác nhận bằng `getComputedStyle`: `el.style.left` được gán đúng giá trị đã kẹp
(`clampTipPosition`), `computedWidth` = 319.988px (đúng `max-width:320px` của vòng debug 1), khớp
hoàn toàn với cơ chế `measureAndClampTip` (đặt `left:0/top:0` trước khi đọc `offsetWidth`) mô tả
trong `thay-doi.md`.

"Nhân lực theo nhà thầu" (6 dòng), "Các mốc chính của dự án" (5 mốc), "Timeline của 7 giai đoạn"
(7 hàng, kể cả hàng phải cuộn xuống mới thấy), "Tracking huy động theo tuần" tab "Theo thiết bị"
(sample 20 + toàn bộ cột phải cùng 49 ô) — **tất cả `fits=true`** (left≥0, right≤innerWidth,
top≥0, bottom≤innerHeight) ở khổ 1440 nominal. Tab "Nhật ký theo ngày" và "Ma trận nhân lực" của
`WeeklyTrackingCard` KHÔNG dùng `ChartTip` (chỉ `<span class="chip">` tĩnh, không `useChartTip`) —
đúng theo code `WeeklyTrackingCard.tsx`, không phải thiếu sót kiểm thử.

### Khổ 900 (thực tế 1000×1111) và 390 (thực tế 433×938), cả 2 kèm dark mode

Hover lại "Thiết bị theo nhóm" (trường hợp tệ nhất) ở cả 2 khổ, theme tối
(`page.emulateMedia({colorScheme:'dark'})`, xác nhận `document.documentElement.dataset.theme ===
'dark'` đã áp dụng đúng qua `prefers-color-scheme`):

- 900 (thực 1000×1111): cả 7 dòng `fits=true`, `right` lớn nhất 935.43 < 1000.
- 390 (thực 433×938): cả 7 dòng `fits=true`, `right` lớn nhất 368.43 < 433.

### Không nhấp nháy / không nhảy vị trí khi rê chuột

Rê chuột liên tục 15 lần qua lại trong cùng 1 dòng (bước 60ms/lần) của "Thiết bị theo nhóm": vị
trí `.tip` bám sát chuột mượt (giá trị `left` tăng/giảm đúng theo hướng di chuột, `top` giữ nguyên
vì cùng hàng), không có lần đọc nào nhảy về giá trị sai/giật ngược — không quan sát thấy nhấp
nháy.

### Console — không có lỗi mới

Ở `/vi/projects/1` (1440, sáng), `/en/projects/1`, `/vi/projects/17`: chỉ còn đúng 3 warning GOP-1
cũ (Recharts `defaultProps` ở `XAxis`/`YAxis`/`ReferenceLine`, đã ghi nhận từ trước Đợt 2, không
liên quan tooltip). Không có lỗi hydration, không có lỗi JS mới nào phát sinh từ
`useLayoutEffect`/`measureAndClampTip`.

### Smoke trang chi tiết — không hồi quy

`/vi/projects/1`, `/vi/projects/17` (dự án 17 vẫn hiện "Chưa khởi công" như Task 2 dặn),
`/en/projects/1` render bình thường, không crash, không lộ key i18n thô.

### 1 GOP Ý mới (không liên quan CAN-2, không chặn merge)

**GOP-3 — `HelpTip` bubble (`span.bub`) gây `document.documentElement.scrollWidth` thừa ~70px ở
khổ mobile (433 thực tế, tương đương 390 nominal), dù bubble đang ẩn (`opacity:0;
visibility:hidden`).**

- Đo được: `document.documentElement.scrollWidth = 504` > `window.innerWidth = 433` ở
  `/vi/projects/1` khổ mobile, dù không hover/focus bất kỳ nút "?" nào. Trang có thể cuộn ngang
  ~71-81px (xác nhận bằng `window.scrollTo(9999, ...)` rồi đọc lại `window.scrollX`).
- Nguyên nhân: phần tử `<span class="bub">` trong `src/components/ui/HelpTip.tsx` có
  `position:absolute; width:268px` cố định, `opacity:0; visibility:hidden; pointer-events:none`
  khi ẩn — nhưng vẫn `display:block` nên vẫn tham gia layout/tính `scrollWidth` của ancestor dù
  không nhìn thấy được và không click được (không phải lỗi tương tác thật, chỉ là số liệu
  `scrollWidth` bị thổi phồng).
- **Không thuộc phạm vi vòng debug 2**: `HelpTip.tsx` không nằm trong danh sách file đã sửa ở
  vòng debug 1 hay 2 (`thay-doi.md` chỉ liệt `tooltip-position.ts` + `ChartTip.tsx`), file này có
  từ Task 5 (Đợt 2, trước cả vòng debug). Vì bubble luôn ẩn khi không tương tác, người dùng thường
  sẽ không nhận ra trang "cuộn ngang được" trừ khi cố tình kéo — mức độ ảnh hưởng thấp, không chặn
  merge, ghi lại để chủ dự án cân nhắc dọn ở lần sau (có thể thêm `display:none` khi ẩn thay vì chỉ
  `opacity/visibility`).

### Ghi chú thủ tục

- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động (mọi kiểm tra ở vòng này đều là
  hành vi layout/tương tác thật cần trình duyệt thật, giống 2 vòng debug trước).
- Dev server (`npm run dev`) đã dừng khi kết thúc phiên (đã `taskkill` PID giữ cổng 3000).

---

## Kiểm đóng GOP-3 (vá `app/globals.css:350-372`, CHƯA commit)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`). Không đụng DB.

### KẾT LUẬN: FAIL — tiêu chí tràn ngang (`scrollWidth`/`scrollX`) ĐÃ ĐÓNG, nhưng tiêu chí "bong bóng nằm trọn viewport" CHƯA ĐÓNG — 1 nút "?" vẫn bị cắt mép phải ở mobile

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **708/708 xanh** (51 file), đúng kỳ vọng.
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.

### Ghi chú môi trường (giống vòng debug 2) — vẫn còn scaling 10/9

Phiên Playwright MCP này tiếp tục có scaling OS: yêu cầu `browser_resize(390, 844)` nhưng
`window.innerWidth` đọc được thực tế là **433** (390×10/9≈433.3), khớp đúng ghi chú vòng debug 2.
Mọi phép đo dưới đây dùng `window.innerWidth` **đọc trực tiếp** tại thời điểm đo (433), không
dùng số nominal 390 — đúng yêu cầu đề bài.

### 1. `document.documentElement.scrollWidth <= window.innerWidth` — PASS (sáng + tối, cả 3 trang)

| Trang | innerWidth thật | scrollWidth | Kết quả |
|---|---|---|---|
| `/vi/projects/1` (sáng) | 433 | 422 | PASS |
| `/vi/projects/1` (`data-theme="dark"`) | 433 | 422 | PASS |
| `/vi/projects/17` (sáng) | 433 | 422 | PASS |
| `/en/projects/1` (sáng) | 433 | 422 | PASS |

So với vòng debug 2 (trước vá: `scrollWidth 504 > innerWidth 433`, tràn/cuộn được ~71-81px), nay
`scrollWidth (422) < innerWidth (433)` ở mọi trang đã kiểm — `display:none` khi ẩn đã loại `.bub`
khỏi vùng tính `scrollWidth` như mong đợi.

### 2. `window.scrollTo(200,0)` rồi đọc `scrollX` — PASS (cả 3 trang)

`scrollX = 0` sau khi gọi `scrollTo(200,0)` ở cả `/vi/projects/1`, `/vi/projects/17`,
`/en/projects/1` (khổ mobile) — không cuộn ngang được.

### 3. Bấm/focus từng nút "?" (HelpTip): bong bóng hiện, nằm trọn viewport — **FAIL 1 nút**

Đo `getBoundingClientRect()` của `.bub` sau `element.focus()` (khổ mobile, `innerWidth` thật =
433):

| Trang | Nút "?" (theo heading/thẻ) | left | right | Kết quả |
|---|---|---|---|---|
| `/vi/projects/1` | "Các mốc chính của dự án" (không có class `.rt`) | 243.78 | **503.74** | **FAIL — tràn phải 70.74px** |
| `/vi/projects/1` | "Tracking huy động theo tuần" (class `.rt`) | 88.19 | 348.14 | PASS |
| `/vi/projects/17` | "Các mốc chính của dự án" | 243.78 | **503.74** | **FAIL — tràn phải 70.74px** (chỉ có 1 HelpTip trên trang) |
| `/en/projects/1` | "Key Milestones..." | 15.92 | 275.88 | PASS |
| `/en/projects/1` | "Weekly Tracking..." | 55.93 | 315.89 | PASS |

**Root cause (khác với nguyên nhân đã vá):** vá GOP-3 chỉ xử lý phần `display:none`/`max-width`
cho vùng cuộn (tiêu chí 1) — đúng và đủ cho tiêu chí đó. Nhưng bong bóng vẫn định vị bằng
`left:50%; transform:translateX(-50%)` (căn giữa theo tâm nút "?", `app/globals.css:350`),
KHÔNG kẹp lại theo mép viewport khi nút nằm gần mép phải. Ở bản tiếng Việt, heading "Các mốc chính
của dự án" dài (kèm phụ đề "Key Milestones of the Project") đẩy nút "?" ra gần cuối dòng tiêu đề →
bong bóng rộng 268px căn giữa quanh nút đó tràn phải ~70.74px, đúng bên trái mép: `left=243.78≥0`
(không tràn trái) nhưng `right=503.74 > innerWidth=433` (tràn phải). Bản tiếng Anh không tràn vì
heading ngắn hơn, nút "?" không nằm sát mép. Đây là lỗi định vị theo tâm cố định, `max-width` mới
không giải quyết được vì nó chỉ giới hạn bề rộng, không dịch chuyển tâm căn giữa vào trong viewport
— khác cơ chế với `ChartTip`/`.tip` (đã có `clampTipPosition`/`measureAndClampTip` để kẹp vị trí ở
2 vòng debug trước); `.help .bub` chưa có cơ chế kẹp tương đương.

### 4. Khổ 1440 — hover HelpTip không hồi quy — PASS

`/vi/projects/1`, khổ 1440×1000, hover thật (Playwright `element.hover()`, không phải
`focus()`/dispatch sự kiện giả) vào nút "?" "Các mốc chính của dự án": `.bub` có
`display:block; opacity:1; visibility:visible` — hiện đúng, không hồi quy so với trước vá.

### 5. `/vi/nhap-lieu` (form nhập liệu) — hover "?" vẫn hiện bong bóng — PASS

Trang mặc định `/vi/nhap-lieu` không có `.help` nào (chưa chọn dự án). Ở
`/vi/nhap-lieu?project=1&step=profile` có 6 `.help`; hover thật (Playwright `element.hover()`) vào
nút đầu tiên (aria-label "Viết hoa toàn bộ"): `.bub` có `display:block; opacity:1;
visibility:visible`, nằm trong viewport (`left=865.8, right=1133.8` ở khổ 1440 nominal, không
tràn). Không hồi quy so với trước vá.

### Console — không có lỗi mới

3 warning GOP-1 cũ (Recharts `defaultProps`) ở `/vi/projects/1`, không có lỗi hydration, không có
lỗi JS mới liên quan `.bub`/`HelpTip`.

### Kết luận cho reviewer/điều phối viên

Vá hiện tại đóng đúng phần "tràn ngang trang" (tiêu chí `scrollWidth`/`scrollX`) nhưng CHƯA đóng
đủ tiêu chí "bong bóng nằm trọn viewport" nêu trong `danh-gia.md` GOP-3 — nút "?" của "Các mốc
chính của dự án" (cả `/vi/projects/1` và `/vi/projects/17`, bản tiếng Việt) vẫn bị cắt mép phải
~70.74px ở khổ mobile khi focus/bấm. Cần vá thêm: kẹp vị trí `.bub` vào trong viewport (theo kiểu
`clampTipPosition` đã dùng cho `.tip`), hoặc đổi chiến lược định vị (ví dụ giới hạn
`left`/`right` bằng `clamp()` CSS thay vì `left:50%` cố định) — không tự sửa vì đây là code sản
phẩm, ngoài quyền của Tester.

### Ghi chú thủ tục

- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động (kiểm tra hành vi layout/tương tác
  thật cần trình duyệt thật).
- Dev server (`npm run dev`) đã dừng khi kết thúc phiên (`taskkill //F //PID` tiến trình giữ cổng
  3000).

---

## Kiểm đóng GOP-3 — lần đo 3 (vá gốc rễ: `clampBubbleX()` + `HelpTip.tsx` client, CHƯA commit)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`, đo bằng
`browser_run_code_unsafe` để dùng Playwright API thật — `locator.hover()`, `locator.focus()` —
thay vì giả lập sự kiện DOM). Không đụng DB.

Vá lần này: hoàn tác `alignRight` ở `page.tsx`; `src/components/ui/HelpTip.tsx` chuyển thành
client component, khi `pointerenter`/`focus` đo `getBoundingClientRect()` của nút thật rồi gọi
`clampBubbleX()` (`src/lib/tooltip-position.ts`) để tính `left`/vị trí mũi tên, gán CSS var
`--bub-left`/`--bub-arrow` + class `clamped` (`app/globals.css` dòng 368-377).

### KẾT LUẬN: FAIL — 3 trang chi tiết dự án (`page.tsx`/`WeeklyTrackingCard`) ĐÃ ĐÓNG đúng, nhưng `/vi/nhap-lieu` và `/en/nhap-lieu` CHƯA ĐÓNG vì các nút "?" ở đó KHÔNG dùng chung `HelpTip.tsx`

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **712/712 xanh** (51 file, +4 so với 708 nhờ `tooltip-position.test.ts` bổ sung
  test `clampBubbleX`).
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.

### Ghi chú môi trường — vẫn scaling 10/9

`innerWidth` thật đọc được: 390→433 (mobile), 860→955 (tablet), 1440→1600 (desktop) — mọi số dưới
đây dùng `innerWidth` đọc trực tiếp.

### 1. `scrollWidth <= innerWidth` và `scrollX = 0` — PASS toàn bộ (5 trang × 3 khổ × 2 theme = 30 tổ hợp)

Đo trên cả `/vi/projects/1`, `/vi/projects/17`, `/en/projects/1`, `/vi/nhap-lieu?project=1&step=profile`,
`/en/nhap-lieu?project=1&step=profile`: `scrollWidth` luôn nhỏ hơn `innerWidth` đúng 11px (422/433,
944/955, 1589/1600 — con số 11px lệch cố định, không đổi theo trang/theme, thuộc về thanh cuộn dọc
ảo/layout gốc, không liên quan `.help`), `scrollX = 0` sau `scrollTo(200,0)` ở mọi tổ hợp. Không
tràn ngang ở bất kỳ trang nào, kể cả 2 trang form.

### 2. Bong bóng "?" ở 3 trang chi tiết dự án — PASS toàn bộ (hover + Tab focus, 3 khổ × 2 theme)

| Trang | Nút | Khổ | left | right | fits | arrowDiff (steady-state) |
|---|---|---|---|---|---|---|
| `/vi/projects/1` | "Các mốc chính..." | mobile 433 | 142.0 | 410.0 | PASS | 0 |
| `/vi/projects/1` | "Tracking huy động..." | mobile 433 | 142.4 | 409.6 | PASS | 0.41 |
| `/vi/projects/1` | cả 2 nút | tablet 955 / desktop 1600 | — | — | PASS | ≤0.41 |
| `/vi/projects/17` | "Các mốc chính..." (chỉ 1 nút) | 433/955/1600 | — | — | PASS cả 3 khổ | ≤0.21 (xem ghi chú transient dưới) |
| `/en/projects/1` | "Explain" (Key Milestones) | mobile 433 | 12.0 | 280.0 | PASS | 0 |
| `/en/projects/1` | "Explain" (Weekly Tracking) | mobile 433 | 142.0 | 410.0 | PASS | 0.04 |
| `/en/projects/1` | cả 2 nút | tablet 955 / desktop 1600 | — | — | PASS | ≤0.41 |

Toàn bộ 2×3 = 6 nút (2 nút/trang trừ vi/projects/17 chỉ 1) × 3 khổ × 2 theme = **34/34 tổ hợp fits =
true**, `clamped: true` (xác nhận cơ chế mới đã chạy), `arrowDiff` steady-state ≤ 0.41px (« 2px yêu
cầu).

**Ghi chú về 1 số đo transient (KHÔNG phải lỗi):** lần quét đầu tiên (đo 80ms sau khi hover) ghi
nhận `arrowDiff = -3.16px` ở `/vi/projects/17` khổ tablet/desktop, theme sáng — tưởng như lệch quá
2px. Đo lại kỹ với 5 mốc thời gian (50/150/300/500/800ms sau hover) cho thấy đây là **artifact khi
transition CSS (`scale(.97)→scale(1)`) chưa chạy xong**: ở 50ms, `opacity=0.999`, `transform` chưa
về `matrix(1,0,0,1,...)`, `diff=-0.105`; từ 150ms trở đi `opacity=1`, `transform` về identity,
`diff=0.001px` và giữ nguyên tới 800ms — trạng thái ổn định (steady-state) đúng, không lệch. Bảng
trên dùng giá trị steady-state (≥150ms sau hover).

**Tab focus (bàn phím):** mẫu đo trên nút đầu tiên mỗi trang/khổ/theme — `display:block`, opacity
tiến về 1 (giống hover), không có tổ hợp nào bị kẹt ở `display:none`/`opacity:0`.

### 3. Bong bóng "?" ở `/vi/nhap-lieu` và `/en/nhap-lieu` — **FAIL, chưa được vá**

Root cause: 6 nút "?" trên form (bước Hồ sơ, gồm "Viết hoa toàn bộ", "Viết hoa chữ cái đầu mỗi từ",
gợi ý loại dự án, độ ưu tiên, thị trường, giá trị HĐ) là mã HTML **viết tay riêng** trong
`src/components/form/DataEntryForm.tsx:747` và `src/components/form/CreateProjectForm.tsx:138,242`
(`<button type="button" className="help" ...>`), **KHÔNG import/dùng chung component**
`src/components/ui/HelpTip.tsx`. Vì vậy cơ chế `pointerenter`/`focus` → `clampBubbleX()` mới hoàn
toàn không chạy trên các nút này — xác nhận bằng `bub.classList.contains('clamped') === false` ở
TẤT CẢ 6 nút, mọi khổ, mọi theme, kể cả sau 400ms ổn định (không phải do timing). Các nút này vẫn
dùng CSS định vị cũ (`left:50%; transform:translateX(-50%)`, không kẹp viewport).

| Trang | Khổ (innerWidth) | Số nút FAIL (tràn trái/phải) / tổng | Ví dụ tệ nhất |
|---|---|---|---|
| `/vi/nhap-lieu` | mobile 433 | 4/6 FAIL (i0,i1,i2,i3 tràn trái) | i2 "gợi ý loại dự án": `left=-31.5, right=236` |
| `/vi/nhap-lieu` | tablet 955 | 3/6 FAIL (i1,i2,i4) | i2: `left=-31, right=235.5` |
| `/vi/nhap-lieu` | desktop 1600 | 0/6 FAIL | — (đủ chỗ ở khổ rộng) |
| `/en/nhap-lieu` | mobile 433 | 4/6 FAIL (i1,i2,i3,i4) | i4 "TN/XK/NoiBo": `left=-44.9, right=222.7` |
| `/en/nhap-lieu` | tablet 955 | 3/6 FAIL (i1,i2,i4) | i4: `left=-44.9, right=222.7` |
| `/en/nhap-lieu` | desktop 1600 | 0/6 FAIL | — |

Kết quả giống hệt giữa sáng/tối (không phụ thuộc theme, đúng như dự đoán vì đây là lỗi hình học
CSS, không phải màu sắc). Đây là đúng vị trí bug cũ trước vòng vá này (GOP-3 gốc), chỉ là ở phạm vi
2 trang form thay vì trang chi tiết dự án.

### Console — không lỗi mới, không hydration

0 lỗi console ở mọi trang đã mở trong phiên này. 10 warning đều là `<input type="date">` nhận ISO
datetime thô ở `/vi/nhap-lieu` (GOP-2 cũ, đã ghi nhận từ trước, không liên quan `.help`/GOP-3).
Không có warning Recharts lần này vì không mở tab chứa biểu đồ đó trong phiên đo. Không có lỗi
hydration.

### Kết luận cho reviewer/điều phối viên

`clampBubbleX()` + `HelpTip.tsx` client component là hướng vá ĐÚNG GỐC RỄ và đóng hoàn toàn vấn đề
GOP-3 ở **3 trang chi tiết dự án** (nơi HelpTip được dùng qua component dùng chung) — PASS tuyệt
đối 34/34 tổ hợp đã kiểm, bao gồm cả tiêu chí mũi tên lệch ≤2px. Nhưng đề bài yêu cầu đóng GOP-3
"tổng quát" cho MỌI nút "?" `.help .bub` (`danh-gia.md` viết "form nhập liệu cũng dùng `.help
.bub`"), và **2 trang form nhập liệu vẫn còn 3-4/6 nút bị cắt mép ở mobile/tablet** vì chúng dùng
một bản HTML `.help` viết tay khác, không đi qua `HelpTip.tsx`. Cần áp dụng cùng cơ chế
(`clampBubbleX`) cho 3 nút "?" viết tay trong `DataEntryForm.tsx`/`CreateProjectForm.tsx`, hoặc đổi
chúng sang dùng chung component `HelpTip`. Không tự sửa — ngoài quyền Tester.

### Ghi chú thủ tục

- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động (kiểm tra hành vi layout/tương tác
  thật cần trình duyệt thật, dùng `mcp__playwright__browser_run_code_unsafe` với Playwright API
  thật — `locator.hover()`/`locator.focus()` — để đo chính xác 5 trang × 3 khổ × 2 theme trong 1
  phiên).
- Dev server (`npm run dev`) đã dừng khi kết thúc phiên (`taskkill //F //PID` tiến trình giữ cổng
  3000).

---

## Kiểm đóng GOP-3 — lần đo 4 (3 nút "?" viết tay đổi sang dùng chung `HelpTip`, CHƯA commit)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`, đo bằng
`browser_run_code_unsafe` với Playwright API thật). Không đụng DB.

Vá lần này: 3 nút "?" viết tay (`DataEntryForm.tsx` Field, `CreateProjectForm.tsx` tên dự án +
Field) chuyển sang dùng chung `HelpTip` (markup y hệt, nay có `clampBubbleX`).

### KẾT LUẬN: FAIL — HelpTip đã đóng đúng ở CẢ 2 form (cập nhật + tạo mới), nhưng phát hiện 1 lỗi
tràn ngang THẬT ở mobile, KHÔNG liên quan `.help`/GOP-3 — do bảng `KeyMilestoneEditor` (`.tbl`)
trong accordion "Thêm dự án mới" rộng cố định ~579-596px, vượt viewport 433px

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **712/712 xanh** (51 file), đúng kỳ vọng.
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.

### Ghi chú phương pháp đo quan trọng — phát hiện lúc đo, không phải lỗi sản phẩm

Lần đo đầu dùng `locator.focus()` (API cấp cao của Playwright) cho "focus" — kết quả SAI: bong bóng
luôn `display:none` dù `clamped:true` đã gán đúng CSS var. Điều tra: đây là hành vi CHUẨN của trình
duyệt (Chromium `:focus-visible` heuristic dựa trên "input modality" gần nhất) — sau khi vừa hover
bằng chuột, `focus()` bằng script/API không kích hoạt `:focus-visible` (điều đúng theo spec, không
phải bug). Xác nhận bằng 3 cách: (1) gọi `btn.focus()` qua `evaluate()` khi CHƯA có tương tác chuột
trước đó → `:focus-visible` khớp, bong bóng hiện; (2) dùng `page.keyboard.press('Tab')` thật (mô
phỏng đúng người dùng bàn phím) → luôn khớp `:focus-visible`, bất kể trước đó có hover hay không;
(3) test lại toàn bộ mẫu bằng Tab thật cho kết quả PASS tuyệt đối (xem mục 3 dưới). Vậy các "FAIL"
xuất hiện trong 2 lần quét đầu (dùng `.focus()` sau khi vừa hover) là **giả (test artifact)**,
không phải lỗi HelpTip — đã loại khỏi kết luận cuối, chỉ dùng kết quả đo bằng Tab thật.

### 1. `scrollWidth <= innerWidth`, `scrollX = 0` — PASS tablet/desktop, **FAIL mobile (lỗi thật, không liên quan `.help`)**

| Trang | Khổ (innerWidth thật) | scrollWidth | scrollX sau scrollTo(200,0) | Kết quả |
|---|---|---|---|---|
| `/vi/nhap-lieu` | mobile 433 | **465** | **42.96** | **FAIL** |
| `/en/nhap-lieu` | mobile 433 | **435** | **13.33** | **FAIL** |
| `/vi/nhap-lieu` | tablet 955 | 944 | 0 | PASS |
| `/en/nhap-lieu` | tablet 955 | 944 | 0 | PASS |
| `/vi/nhap-lieu` | desktop 1600 | 1589 | 0 | PASS |
| `/en/nhap-lieu` | desktop 1600 | 1589 | 0 | PASS |

**Root cause (đã xác minh bằng cách quét mọi phần tử tràn `main *`):** khi mở accordion "Thêm dự
án mới" (`CreateProjectForm`, có `KeyMilestoneEditor` bên trong ở bước hồ sơ mặc định), phần tử
`<table class="tbl">` render với bề rộng thật **579px (vi) / 596px (en)** — không co lại, không có
container cuộn ngang riêng — trong khi viewport mobile chỉ 433px, gây tràn ~146-163px. Chỉ xảy ra
khi accordion MỞ (trước khi mở, `scrollWidth=422<433`, PASS). Đây **không phải lỗi của `.help
.bub`/GOP-3** — `.help` không nằm trong danh sách offenders (đã lọc riêng, không thấy `.help`/`.bub`
tràn); là bug bảng riêng của `KeyMilestoneEditor.tsx` (Task 8, Đợt 2, có từ trước, các lần đo GOP-3
trước không phát hiện vì chưa từng mở accordion "Thêm dự án mới" ở mobile).

### 2. Bong bóng "?" hover — PASS toàn bộ (12 nút × 2 trang × 3 khổ × 2 theme = 72 tổ hợp)

Sau khi mở accordion, mỗi trang có 12 nút "?" (6 của `CreateProjectForm` mới thêm dùng `HelpTip` +
6 của `DataEntryForm` đã có từ lần đo 3). Hover thật (`locator.hover()`, có `scrollIntoViewIfNeeded`
trước) trên toàn bộ 12 nút × 2 trang (vi/en) × 3 khổ × 2 theme: **72/72 PASS** —
`clamped:true`, `display:block`, `fits:true` (left≥0, right≤innerWidth), `arrowDiff` = 0 ở hầu hết,
lớn nhất quan sát được là artifact transition (đã re-verify bằng chờ 300ms → về đúng vị trí, fits
true, ví dụ nút "Total contract value..." `/en/nhap-lieu` tablet: `left=55.68, right=323.68,
innerWidth=955`).

### 3. Bong bóng "?" Tab focus (bàn phím thật) — PASS mẫu 12 tổ hợp

Dùng `page.keyboard.press('Tab')` thật (không phải `.focus()` API) để tới nút ĐẦU và nút CUỐI của
mỗi trang × khổ (2×2×3=12 tổ hợp mẫu, đại diện cho toàn bộ dải vì hình học không đổi theo vị trí
DOM, chỉ đổi theo vị trí màn hình đã kiểm đủ ở mục 2):

| Trang | Khổ | Nút | display | :focus-visible | left | right | arrowDiff | fits |
|---|---|---|---|---|---|---|---|---|
| vi | mobile 433 | đầu ("Viết hoa toàn bộ") | block | true | 12 | 280 | 0 | PASS |
| vi | mobile 433 | cuối ("Tổng giá trị HĐ...") | block | true | 12 | 280 | 0 | PASS |
| en | mobile 433 | đầu/cuối | block | true | 12-42.35 | 280-310.35 | 0 | PASS |
| vi/en | tablet 955 | đầu/cuối | block | true | 12-55.68 | 280-323.68 | 0 | PASS |
| vi/en | desktop 1600 | đầu/cuối | block | true | 363.55-436.13 | 631.55-704.13 | 0 | PASS |

**12/12 PASS** — mũi tên luôn trùng khít tâm nút (`arrowDiff = 0`), không có tổ hợp nào lệch quá
2px.

### 4. Smoke `/vi/projects/1` mobile — PASS, không hồi quy

`innerWidth=433`, `scrollWidth=422` (≤433), `scrollX=0` sau `scrollTo(200,0)`; nút "?" đầu tiên
hover: `display:block, left=12.02, right=271.98` (nằm trọn). Console chỉ còn 3 warning GOP-1 cũ
(Recharts `defaultProps`), không có lỗi hydration, không có lỗi mới.

### Console — không lỗi mới, không hydration ở 2 trang form

0 lỗi console ở `/vi/nhap-lieu`, `/en/nhap-lieu` trong toàn bộ phiên đo. Không có warning input date
(GOP-2) xuất hiện lần này vì không mở lại bước có các trường ngày trong phiên đo cụ thể này — không
có gì mới đáng lo.

### Kết luận cho reviewer/điều phối viên

GOP-3 (HelpTip/`.bub` tràn viewport) đã đóng đầy đủ, đúng nghĩa đen 100% tổ hợp đã kiểm (72 hover +
12 Tab focus, cả 2 form, cả 2 ngôn ngữ, 3 khổ, 2 theme). Tuy nhiên đo lần này phát hiện **1 lỗi tràn
ngang thật khác** ở mobile khi mở "Thêm dự án mới": bảng `KeyMilestoneEditor` (`.tbl`) rộng cố định
~579-596px không co lại theo viewport — **ngoài phạm vi GOP-3, không phải do vá HelpTip gây ra**,
nhưng vi phạm đúng tiêu chí `scrollWidth <= innerWidth` mà đề bài yêu cầu kiểm nên phải báo cáo là
FAIL. Đề nghị điều phối viên xác nhận đây là phát hiện mới (không thuộc GOP-3) và quyết định có vá
trong đợt này hay ghi lại cho lần sau. Không tự sửa — ngoài quyền Tester.

### Ghi chú thủ tục

- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động (kiểm tra hành vi layout/tương tác
  thật cần trình duyệt thật, dùng `mcp__playwright__browser_run_code_unsafe` với Playwright API
  thật — `locator.hover()`, `page.keyboard.press('Tab')` — để đo chính xác và tránh nhầm lẫn với
  hành vi `:focus-visible` heuristic của trình duyệt).
- Dev server (`npm run dev`) đã dừng khi kết thúc phiên (`taskkill //F //PID` tiến trình giữ cổng
  3000).

---

## Kiểm đóng GOP-3 — lần đo 5 (vá bảng mốc chính tràn ngang: `minWidth: 0` cho grid item, CHƯA commit)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`, đo bằng
`browser_run_code_unsafe` với Playwright API thật). Không đụng DB.

Vá lần này: `src/components/form/CreateProjectForm.tsx:210` — div bọc `KeyMilestoneEditor` (grid
item `1fr`) thêm `minWidth: 0` (mặc định grid item có `min-width:auto`, khiến item giãn theo
min-content của bảng `nowrap` bên trong, đẩy tràn ra ngoài `.scroll`; nay `.scroll` mới thật sự
nhận quyền cuộn ngang).

### KẾT LUẬN: PASS — bảng mốc chính không còn tràn trang ở mobile, cuộn ngang được trong khung `.scroll`, HelpTip không hồi quy

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **712/712 xanh** (51 file), đúng kỳ vọng.
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.

### 1. `scrollWidth <= innerWidth`, `scrollX = 0` — PASS toàn bộ 12 tổ hợp (2 trang × 3 khổ × 2 theme), cả khi mở accordion "Thêm dự án mới" (bước Hồ sơ, có editor mốc chính)

| Trang | Khổ (innerWidth thật) | scrollWidth | scrollX | Kết quả |
|---|---|---|---|---|
| `/vi/nhap-lieu` | mobile 433 | 422 | 0 | PASS |
| `/en/nhap-lieu` | mobile 433 | 422 | 0 | PASS |
| `/vi/nhap-lieu` | tablet 955 | 944 | 0 | PASS |
| `/en/nhap-lieu` | tablet 955 | 944 | 0 | PASS |
| `/vi/nhap-lieu` | desktop 1600 | 1589 | 0 | PASS |
| `/en/nhap-lieu` | desktop 1600 | 1589 | 0 | PASS |

Kết quả giống hệt sáng/tối ở mọi khổ (12/12 PASS, đã liệt cả 2 theme). So với lần đo 4 (trước vá:
`scrollWidth=465/435 > innerWidth=433` ở mobile khi mở accordion), nay `scrollWidth` trở về đúng
baseline (422, bằng lúc accordion đóng) — bảng không còn đẩy tràn ra `<html>` nữa.

### 2. Bảng mốc chính cuộn ngang được trong khung `.scroll` ở mobile — PASS

Đo trực tiếp phần tử `.scroll` (không phải `document.documentElement`) ở khổ mobile (433), accordion
"Thêm dự án mới" đã mở:

| Trang | `.scroll` (bảng mốc chính) | scrollWidth | clientWidth | canScroll (scrollWidth>clientWidth) |
|---|---|---|---|---|
| `/vi/nhap-lieu` | thứ 2 trong DOM | 579 | 349 | true |
| `/en/nhap-lieu` | thứ 2 trong DOM | 596 | 349 | true |

Xác nhận cuộn THẬT (không chỉ đo số, gán `scrollLeft=100` rồi đọc lại): `/vi/nhap-lieu` cuộn được
tới `scrollLeft≈79.26px`, `/en/nhap-lieu` tới `scrollLeft≈49.63px` — bảng vẫn rộng hơn khung (đúng
vì có nhiều cột), nhưng giờ cuộn NẰM TRONG khung `.scroll`, không còn đẩy `<html>` tràn ra ngoài
(khớp mục 1).

### 3. Thêm 1 dòng mốc mới (không lưu) — vẫn không tràn

Bấm nút "Thêm mốc"/"Add milestone" (không submit form) rồi đo lại `scrollWidth` cấp trang, khổ
mobile:

| Trang | scrollWidth sau khi thêm dòng | innerWidth | Kết quả |
|---|---|---|---|
| `/vi/nhap-lieu` | 422 | 433 | PASS |
| `/en/nhap-lieu` | 422 | 433 | PASS |

### 4. Smoke HelpTip trên form — PASS, không hồi quy (12/12 nút "?")

`/vi/nhap-lieu`, mobile, accordion mở: hover thật cả 12 nút "?" (6 của `CreateProjectForm` + 6 của
`DataEntryForm`) — toàn bộ `display:block`, `fits=true` (ví dụ nút cuối "Tổng giá trị HĐ trước
VAT": `left=24, right=292`, trong viewport 433). Không đổi hành vi so với lần đo 4.

### Console — không lỗi mới, không hydration

0 lỗi console trong toàn phiên đo; 10 warning đều là GOP-2 cũ (input date ISO), không liên quan.

### Kết luận cho reviewer/điều phối viên

Vá `minWidth: 0` đã đóng đúng gốc rễ lỗi tràn bảng mốc chính phát hiện ở lần đo 4 — PASS tuyệt đối
mọi tổ hợp đã kiểm (12 scrollWidth/scrollX, 2 khung `.scroll` xác nhận cuộn thật, 2 test thêm dòng
mới, 12 HelpTip không hồi quy). Cùng với 4 lần đo trước, **toàn bộ tiêu chí đóng GOP-3 (bao gồm
cả lỗi phát sinh ngoài phạm vi ban đầu) nay đã PASS**.

### Ghi chú thủ tục

- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động (kiểm tra hành vi layout/tương tác
  thật cần trình duyệt thật).
- Dev server (`npm run dev`) đã dừng khi kết thúc phiên (`taskkill //F //PID` tiến trình giữ cổng
  3000).

---

## Kiểm đóng GOP-3 — lần đo 2 (vá thêm `alignRight`/`.help.rt` cho HelpTip "Các mốc chính của dự án", CHƯA commit)

Skill đã dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
UI đụng chạm → smoke-test bằng `mcp__playwright` (dev server thật `npm run dev`). Không đụng DB.

Vá thêm so với lần đo 1: `app/[locale]/(app)/projects/[id]/page.tsx:231` — HelpTip của thẻ "Các
mốc chính của dự án" nay truyền `alignRight` (→ thêm class `help rt`, bong bóng neo mép phải nút
qua `right:-8px`, mở sang trái), giống HelpTip có sẵn của `WeeklyTrackingCard`. `app/globals.css`
không đổi thêm so với lần đo 1.

### KẾT LUẬN: FAIL — còn 1 trường hợp tràn TRÁI mới phát sinh ở bản tiếng Anh (mobile + tablet)

Tràn phải ở bản tiếng Việt (lần đo 1) đã hết, nhưng đổi cơ chế neo-phải (`.rt`) làm phát sinh tràn
**trái** ở `/en/projects/1` vì nút "?" ở bản tiếng Anh không nằm gần mép phải (heading ngắn hơn) —
bong bóng 268px neo theo mép phải NÚT (không phải theo mép phải VIEWPORT) nên kéo dài sang trái ra
ngoài màn hình khi nút ở giữa/trái màn hình hẹp.

### Nền tự động

- `npx tsc --noEmit` → **0 lỗi**.
- `npm test` → **708/708 xanh** (51 file).
- `npm run dev` chạy sạch, Ready ở `http://localhost:3000`.

### Ghi chú môi trường — vẫn scaling 10/9

`browser_resize` nominal → `window.innerWidth` thật đọc được: 390→433, 860→955, 1440→1600 (đúng tỉ
lệ 10/9 như 2 lần đo trước). Mọi số trong bảng dưới dùng `innerWidth` **đọc trực tiếp** tại thời
điểm đo.

### 1. `scrollWidth <= innerWidth` và `scrollX = 0` sau `scrollTo(200,0)` — PASS toàn bộ

| Trang | Khổ (innerWidth thật) | scrollWidth | scrollX sau scrollTo(200,0) |
|---|---|---|---|
| `/vi/projects/1` | 433 / 955 / 1600 | 422 / 944 / 1589 | 0 / 0 / 0 |
| `/vi/projects/17` | 433 / 955 / 1600 | 422 / 944 / 1589 | 0 / 0 / 0 |
| `/en/projects/1` | 433 / 955 / 1600 | 422 / 944 / 1589 | 0 / 0 / 0 |

Đúng cho cả sáng và tối (đo bằng `document.documentElement.setAttribute('data-theme', ...)`) — giá
trị giống hệt nhau giữa 2 theme ở mọi trang/khổ, không lệch.

### 2. Bong bóng "?" nằm trọn viewport (`left ≥ 0`, `right ≤ innerWidth`) — FAIL 1 nút, 2/3 khổ

| Trang | Nút "?" | Khổ (innerWidth thật) | left | right | fits |
|---|---|---|---|---|---|
| `/vi/projects/1` | "Các mốc chính của dự án" (`.help.rt`, mới đổi) | 433 | 125.28 | 385.24 | PASS |
| `/vi/projects/1` | "Tracking huy động theo tuần" (`.help.rt`, cũ) | 433 | 88.19 | 348.14 | PASS |
| `/vi/projects/1` | "Các mốc chính của dự án" | 955 | 125.28 | 385.24 | PASS |
| `/vi/projects/1` | "Tracking huy động theo tuần" | 955 | 88.19 | 348.14 | PASS |
| `/vi/projects/1` | "Các mốc chính của dự án" | 1600 | 361.28 | 621.23 | PASS |
| `/vi/projects/1` | "Tracking huy động theo tuần" | 1600 | 324.18 | 584.14 | PASS |
| `/vi/projects/17` | "Các mốc chính của dự án" (chỉ 1 HelpTip) | 433 / 955 / 1600 | 125.28 / 125.28 / 361.28 | 385.24 / 385.24 / 621.23 | PASS cả 3 khổ |
| `/en/projects/1` | "Key Milestones..." (`.help.rt`, mới đổi) | **433** | **-102.58** | 157.38 | **FAIL — tràn trái 102.58px** |
| `/en/projects/1` | "Key Milestones..." | **955** | **-102.58** | 157.38 | **FAIL — tràn trái 102.58px** (giá trị left giống hệt 433, không đổi theo viewport vì bong bóng neo theo NÚT, không theo viewport) |
| `/en/projects/1` | "Key Milestones..." | 1600 | 133.42 | 393.38 | PASS (ở khổ rộng, nút đủ xa mép trái nên không tràn) |
| `/en/projects/1` | "Weekly Tracking..." (`.help.rt`, cũ, không đổi) | 433 / 955 / 1600 | 55.93 / 55.93 / 291.93 | 315.89 / 315.89 / 551.88 | PASS cả 3 khổ |

**Kết quả PASS/FAIL đúng nghĩa đen:** 10/12 tổ hợp (trang × nút × khổ đã liệt kê) PASS; **2 FAIL**
(cùng 1 nút "?" — "Key Milestones of the Project" ở `/en/projects/1` — tại khổ mobile 433 và
tablet 955; PASS lại ở khổ desktop 1600).

**Root cause của FAIL mới:** `.help.rt .bub{left:auto;right:-8px}` (`app/globals.css:366`) neo mép
phải bong bóng cách mép phải CỦA NÚT 8px, mở bong bóng 268px sang bên trái nút. Cơ chế này đúng khi
nút nằm gần mép PHẢI trang (trường hợp tiếng Việt: heading dài đẩy nút ra gần cuối dòng, hoặc
`WeeklyTrackingCard` vốn đã dùng `.rt` từ trước và luôn pass). Nhưng ở bản tiếng Anh, heading "Key
Milestones of the Project" ngắn hơn nhiều so với bản Việt (~"Các mốc chính của dự án Key Milestones
of the Project"), nên nút "?" nằm gần đầu dòng tiêu đề, KHÔNG gần mép phải trang — bong bóng neo
theo nút (không phải theo viewport) kéo dài về bên trái vượt khỏi mép trái màn hình. Đây là bằng
chứng cụ thể cho thấy `alignRight`/`.rt` là giải pháp "cố định hướng mở" (luôn mở sang trái), không
phải giải pháp "luôn kẹp trong viewport" — khác về bản chất với `clampTipPosition`/
`measureAndClampTip` đã dùng cho `.tip` (2 vòng debug trước), vốn đo vị trí thật rồi tính lại theo
viewport bất kể hướng.

### 3. Hover thật ở khổ 1440 (đại diện cho khổ ~820-900 vì đã đo ở mục 2) — không hồi quy

Playwright `element.hover()` thật (không dùng `focus()`) trên nút "Các mốc chính của dự án" ở
`/vi/projects/1`, khổ 1440 nominal: `.bub` có `display:block; opacity:1; visibility:visible`. Không
hồi quy so với lần đo 1.

### Console — không có lỗi mới

3 warning GOP-1 cũ (Recharts `defaultProps`) ở mọi trang đã mở, không có lỗi hydration, không có
lỗi JS mới.

### Kết luận cho reviewer/điều phối viên

`alignRight` đóng đúng tràn phải ở bản tiếng Việt (mục tiêu ban đầu của GOP-3) nhưng gây tràn trái
mới ở bản tiếng Anh cùng chính nút đó, tại 2/3 khổ đã kiểm (mobile, tablet). Không dùng chung một
hướng mở cố định (`.rt`) cho một vị trí có thể xuất hiện ở nhiều toạ độ khác nhau tuỳ độ dài text
tiêu đề (phụ thuộc locale) — cần cơ chế kẹp theo viewport thật (đo `getBoundingClientRect` của nút
rồi chọn hướng mở HOẶC dịch `left` để bong bóng luôn nằm trong `[0, innerWidth]`), tương tự cách
`.tip` đã làm ở CAN-1/CAN-2, thay vì chỉ đổi hướng mở tĩnh theo class. Không tự sửa — ngoài quyền
Tester.

### Ghi chú thủ tục

- Không sửa file sản phẩm nào. Không tạo/sửa file test tự động (kiểm tra hành vi layout/tương tác
  thật cần trình duyệt thật).
- Dev server (`npm run dev`) đã dừng khi kết thúc phiên (`taskkill //F //PID` tiến trình giữ cổng
  3000).
