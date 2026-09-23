# Đợt 2 — App khớp `mockup-apple-glass.html` — Thay đổi

Nhánh: `feature/apple-glass-mock-parity`. 10/10 Task hoàn thành, đúng thứ tự phụ thuộc ghi trong
`.bangiao/ke-hoach.md`. Cổng cuối: `npx tsc --noEmit` = 0 lỗi, `npm test` = 699/699 xanh (mốc
trước Đợt 2: 548/548 → +151 test mới), `npm run build` sạch.

Mỗi Task 1 commit, prefix `feat(parity):`, không squash.

---

## Task 1 — 3 thẻ "Trọng tâm" + đổi thứ tự KPI (commit `8438794`)

- Sửa `app/[locale]/(app)/projects/[id]/page.tsx`: khối 6 KPI đổi thứ tự thành
  `%KH, %TT, SPI, CPI, EAC, VAC`; `%TT`, `SPI`, `CPI` gắn `hero heroTagLabel={t('kpi.focusTag')}`
  để đứng liền nhau như mock-up dòng 646-649. Không đổi `KpiCard.tsx`.
- Tạo `src/server/projects-detail-page-render.test.ts` — file test render THẬT trang chi tiết
  (dùng `renderToStaticMarkup`), sẽ được các Task 2/6 bổ sung thêm `describe`.
- **Tester soi kỹ:** đúng 3 thẻ có class `kpi rise key` liên tiếp ở vị trí 2-4; `/overview` và
  `/report` giữ nguyên (Q2 mặc định — không đổi, chỉ trang chi tiết đổi).

## Task 2 — Timeline KH/TT dạng thanh + vạch "Hôm nay" (commit `38a262e`)

- Tạo `src/lib/timeline.ts` (+test): `buildPlanActualTimeline()` — hình học thanh KH/TT thuần,
  không phụ thuộc DOM.
- Tạo `src/components/ui/Legend.tsx` (+test): chú thích dùng chung cho nhiều biểu đồ sau này
  (Task 4, 6, 9, 10).
- Tạo `src/components/project/PlanActualTimeline.tsx`: khối `.tl` server-safe (không hook).
- Sửa `page.tsx`: thêm `const today = todayIso()` (biến dùng lại ở Task 3/6/9), thay khối
  "Timeline" cũ bằng thanh KH/TT + dòng chân 4 mục (ngày HĐ, ngày cam kết, trễ khởi công,
  khoảng cách KH-TT).
- CSS mới trong `app/globals.css` bên trong `@layer components` (copy nguyên văn mock-up dòng
  311-332).
- **Tester soi kỹ:** dự án 17 (chưa khởi công) phải hiện "Chưa khởi công", KHÔNG có thanh `.tlbar
  act`; viên "Hôm nay" không bị cắt mép khi gần đầu/cuối trục.

## Task 3 — Đồng hồ đếm ngược `.cdpanel` (commit `6ee0512`)

- Tạo `src/lib/countdown.ts` (+test): tính ngày/giờ/phút/giây tới `plannedFinishDate` (Q1 mặc
  định (a)), cộng `clockOffsetMs()` để đồng hồ chạy thật từng giây dù `DDC_FAKE_TODAY` ghim ngày.
- Tạo `src/components/project/CountdownPanel.tsx` (client, nạp qua `next/dynamic`).
- Sửa `page.tsx`: chèn panel vào `.phead` ngay sau khối `.val`; CSS `.cdpanel` copy mock-up dòng
  293-309, đổi tên 2 keyframe `shine`→`cdShine`, `pulse`→`cdPulse` để không đụng animation
  Tailwind sẵn có; thêm `@media(max-width:820px)` cho panel xuống hàng riêng.
- **Tester soi kỹ:** panel chỉ hiện khi có `plannedFinishDate`; số giây chạy đúng, tắt hẳn khi
  `prefers-reduced-motion: reduce`.

## Task 4 — "Nhân lực theo nhà thầu" + "Thiết bị theo nhóm" (commit `060df04`)

- Sửa `src/lib/thresholds.ts`: thêm `mobilizationDangerPct/WarnPct/TotalWarnPct` — nguồn ngưỡng
  màu duy nhất.
- Tạo `src/lib/resources.ts` (+test): `ResourceRow`, `mobilizationRatio/Tone/TotalTone`,
  `TONE_VAR`, `TONE_CHIP`.
- Tạo `src/components/project/ChartTip.tsx`: tooltip `.tip` portal ra `document.body` (bắt buộc
  vì Card có transform hover-lift).
- Tạo `src/components/project/ResourceBreakdownChart.tsx` (+test): SVG tự vẽ, port
  `renderResource()` mock-up dòng 1576-1617.
- Sửa `src/components/ui/Card.tsx` (+test mới `Card.test.ts`): `CardHeader` thêm prop
  `titleExtra`.
- Sửa `src/components/ui/motion.ts`: export `SpringPreset`, thêm `useSpringProgress()` +
  `staggered()`.
- Sửa `src/server/project-queries.ts` (+test): thêm `getResourceBreakdown()` — gộp theo nhà thầu
  / theo nhóm thiết bị, đúng ngày ảnh chụp (cùng logic ngày với `getResourceSnapshot`).
- Sửa `page.tsx`: chèn khối `.g2` 2 biểu đồ mới trước thẻ "nhân lực theo thời gian" (thẻ đó vẫn ở
  cuối trang theo Q3 Run 1).
- **Tester soi kỹ:** dòng TỔNG phải khớp 520/486 (nhân lực) và 72/63 (thiết bị) ở dự án 1; nhà
  thầu/thiết bị không còn trong dim vẫn hiện `#id` không crash (đã có test).

## Task 5 — Tracking huy động theo tuần, 3 tab (commit `92c9dec`)

- `thresholds.ts`: thêm `equipmentDaysUsedOk/Warn`.
- `resources.ts`: thêm `daysUsedTone()`.
- `src/lib/format.ts` (+test): thêm `formatDateShort()` (`DD/MM/YY`), `formatDayMonth()`
  (`DD/MM`).
- Tạo `src/lib/tracking.ts` (+test): `WeeklyTracking`, `buildLogView/MatrixView/EquipmentView`,
  `buildTrackingSummary`, `equipmentColor()`.
- Tạo `src/components/ui/HelpTip.tsx` (+test): nút "?" + bong bóng, server-safe.
- Tạo `src/components/project/WeeklyTrackingCard.tsx` (+test): thẻ 3 tab (Nhật ký / Ma trận /
  Theo thiết bị), tự quản state `view`.
- `project-queries.ts` (+test): thêm `getWeeklyTracking()` — 7 ngày liên tiếp kết thúc ở ngày
  cuối CÓ số liệu (Q4 mặc định (a), không phải luôn kết thúc ở hôm nay).
- `page.tsx`: chèn thẻ tracking ngay sau khối nguồn lực Task 4.
- CSS: khối "Tracking tuần" mock-up dòng 496-510.
- **Tester soi kỹ:** với seed hiện tại + `DDC_FAKE_TODAY=2026-09-16`, tuần tracking phải kết thúc
  16/09 (không phải luôn "hôm nay" thật ngoài đời — xem Q4 trong plan để biết vì sao).

## Task 6 — Biểu đồ "Các mốc chính của dự án" (commit `05f55bd`)

- Tạo `src/lib/time-axis.ts` (+test): `monthTicks()` — vạch đầu tháng + nhãn `MM/YY` ở tháng lẻ.
- Tạo `src/lib/key-milestones.ts` (+test) — file này sẽ được Task 7/8 bổ sung tiếp: trạng thái mốc
  (`keyMilestoneState`), xếp nhãn tránh chạm (`layoutMilestoneLabels`), miền trục
  (`keyMsDomain`).
- Tạo `src/components/project/keyMsText.ts`: nhãn trạng thái mốc dùng chung chart + editor (Task
  8).
- Tạo `src/components/project/KeyMilestoneChart.tsx` (+test): SVG tự vẽ, port `renderKeyMs()`
  mock-up dòng 2082-2192.
- `page.tsx`: thẻ mới chèn ngay sau Timeline (Task 2); nút "Sửa mốc" chỉ hiện với admin/data-entry,
  dẫn tới `/nhap-lieu?project=ID&step=profile#key-milestones` (mở đúng bước ở Task 8).
- **Tester soi kỹ:** BOD và Viewer KHÔNG được thấy nút "Sửa mốc" (đã có test role trong
  `projects-detail-page-render.test.ts`); nhãn 5 mốc không đè nhau ở màn hẹp.

## Task 7 — Luồng ghi "Các mốc chính" (commit `f465542`)

- `src/server/repo/types.ts`: thêm `KeyMilestoneInput`.
- `src/server/repo/mock-repo.ts` + `prisma-repo.ts`: thêm `replaceKeyMilestones()` — thay TOÀN
  BỘ bộ mốc của 1 dự án trong 1 transaction (prisma: `deleteMany` + `createMany`), ghi
  `audit_log` với `tableName='project_key_milestone'`.
- `src/lib/key-milestones.ts`: thêm `KEY_MS_NAME_MAX`, `KEY_MS_MAX_ROWS`, `keyMsAuditText()`.
- `src/server/validation.ts` (+test): `keyMilestoneRowSchema`, `saveKeyMilestonesSchema`;
  `createProjectSchema` nhận thêm `keyMilestones?` tuỳ chọn.
- `src/server/actions.ts`: `createProjectAction` nhận thêm `keyMilestones?`; action mới
  `saveKeyMilestonesAction(projectId, rows)` — quyền như `saveMonthlyData` (admin hoặc data-entry
  là PIC dự án), KHÔNG kiểm khoá tháng ở server (mốc chính không thuộc số liệu tháng).
- Test mới: `src/server/repo/key-milestones.test.ts` (mock), `prisma-repo-key-milestones.test.ts`
  (prisma, mock `@/server/db`), `src/server/actions-key-milestones.test.ts` (action, 8 test case
  role/PIC/validate).
- **Tester soi kỹ:** đây là luồng ghi DUY NHẤT của Đợt 2 — data-entry KHÔNG phải PIC của dự án
  phải bị `Forbidden`; UI vẫn khoá theo cơ chế khoá tháng hiện có của `DataEntryForm` dù server
  không chặn theo tháng.

## Task 8 — Trình sửa "Các mốc chính" trong form (commit `dec5daf`)

- `src/lib/key-milestones.ts` (+test): thêm `validateKeyMilestones`, `normalizeKeyMilestones`,
  `toKeyMilestoneDraft`, `addKeyMilestone`, `removeKeyMilestone`, `updateKeyMilestone`,
  `keyMsSuggestions`.
- Tạo `src/components/form/KeyMilestoneEditor.tsx` (+test): bảng thêm/xoá/sửa mốc, gợi ý nhanh
  (loại tên đã dùng), focus + bôi chọn ô tên khi thêm dòng mới.
- `CreateProjectForm.tsx`: thêm prop `today`; state `msRows/msErrors`; validate chặn submit (kể
  cả hồ sơ) nếu mốc không hợp lệ; gửi `keyMilestones` kèm `createProjectAction`.
- `DataEntryForm.tsx`: export `type DataEntryStep`; thêm prop `keyMilestones`, `today`,
  `initialStep?`; state `msRows/msDirty/msErrors/msSaveErr`; lưu mốc qua `saveKeyMilestonesAction`
  SAU KHI `saveMonthlyData` thành công (nếu mốc lỗi thì lưu hồ sơ vẫn thành công, chỉ mốc báo lỗi
  riêng qua `msSaveErr`).
- `app/[locale]/(app)/nhap-lieu/page.tsx`: đọc `?step=` từ URL để mở đúng bước khi bấm "Sửa mốc"
  từ trang chi tiết; truyền `today`/`keyMilestones`/`initialStep`.
- **Tester soi kỹ:** để trống tên mốc rồi bấm Lưu ở bước Hồ sơ → KHÔNG lưu gì cả (kể cả các field
  hồ sơ khác), ô tên viền đỏ, thanh lỗi hiện; xoá hết mốc rồi lưu → OK (mảng rỗng hợp lệ).

## Task 9 — "Timeline của 7 giai đoạn" + chọn giai đoạn (commit `628228a`)

- Tạo `src/lib/stage-timeline.ts` (+test) — file này Task 10 sẽ bổ sung thêm 2 kiểu:
  `StageTimelineRow`, `buildStageTimelineRows()`, `TimeDomain`, `buildTimeDomain()`, `xOf()`,
  `STAGE_MARKERS` (5 loại mốc: BĐ KH/HT KH/BĐ TT/HT TT/Dự kiến), `stageMarkers()`.
- Tạo `src/components/project/stageText.ts`: `varianceText`/`varianceColor` — dùng công thức
  "Ngày chênh lệch" đã chốt ở Run 1 (Q1), KHÔNG phải công thức thời lượng của mock-up (Q5 mặc
  định (a)).
- Tạo `src/components/project/StageTimelineChart.tsx`: SVG 7 hàng, bấm hàng để chọn/bỏ chọn giai
  đoạn, tô sáng hàng đang chọn.
- Tạo `src/components/project/StageExplorer.tsx` (+test): thẻ bọc ngoài, giữ state `selected`,
  dải `.msdetail` hiện 6 chip khi có giai đoạn được chọn.
- `page.tsx`: chèn `<StageExplorer>` ngay sau khối "Value chain + EVM".
- **Tester soi kỹ:** cột "CHÊNH LỆCH" phải khớp `dayVariance` (Run 1), KHÔNG khớp cách tính thời
  lượng của mock-up gốc — đây là lệch có chủ ý theo Q5, không phải bug.

## Task 10 — "Biểu đồ so sánh theo hạng mục" (commit `719b6bd`)

- `src/lib/stage-timeline.ts`: thêm `WorkItemCompareRow`, `WorkItemCompare`.
- `src/server/project-queries.ts` (+test): thêm `getWorkItemComparison()` — KH/TT theo hạng mục
  cho các giai đoạn ĐỊNH LƯỢNG (`STAGE_CALC_MODE === 'volume'`) của tháng.
- Tạo `src/components/project/WorkItemCompareChart.tsx`: Recharts `BarChart`, tooltip riêng
  (`CompareTip`).
- `StageExplorer.tsx` (+test): thêm prop `compare`; thẻ thứ 2 "Biểu đồ so sánh" dùng
  `selected ?? 'fabrication'` làm giai đoạn mặc định; giai đoạn `manual` (Thiết kế/Nghiệm thu)
  hiện chữ "nhập tay", không vẽ biểu đồ.
- `page.tsx`: thêm `getWorkItemComparison`, truyền `compare` vào `<StageExplorer>`.
- Cổng cuối Đợt 2: `npx tsc --noEmit` sạch, `npm test` 699/699, `npm run build` sạch (đã chạy,
  xem log).
- **Tester soi kỹ:** bấm "Lắp dựng" (erection) ở Timeline 7 giai đoạn → biểu đồ so sánh đổi theo;
  bấm "Thiết kế" (design, manual) → hiện chữ "nhập tay"; bỏ chọn → quay về "Gia công (mặc định)".

---

## Điểm lệch / phát sinh so với plan

Không có lệch đáng kể. Toàn bộ 10 Task bám sát code mẫu trong `.bangiao/ke-hoach.md` (plan đã
viết sẵn code khá chi tiết cho từng bước); các chỗ tự viết thêm (test file, một số đoạn JSX được
plan mô tả bằng văn xuôi thay vì code mẫu — ví dụ `WeeklyTrackingCard.tsx`, `StageTimelineChart.tsx`,
`KeyMilestoneChart.tsx`) đều bám đúng số dòng/mô tả mock-up mà plan trích, và mọi test tự viết đều
xanh ngay hoặc sau 1 lần chỉnh nhỏ.

Một chỗ cần biết khi soát code (không phải lỗi, chỉ là quyết định nhỏ tự nhất quán theo pattern có
sẵn): `KeyMilestoneChart.test.ts` và `StageExplorer.test.ts` import `repo` trực tiếp từ
`@/server/repo/mock-repo` (không qua barrel `@/server/repo`) khi cần gọi đồng bộ (không `await`)
trong thân test — vì kiểu tĩnh của barrel luôn là async (theo `prisma-repo.ts`). Đây là cách làm
đã có sẵn trong repo (`projects-detail-page-month-guard.test.ts` cũng làm vậy), không phải quy ước
mới.

Mục 6 "Rà soát form Tạo/Sửa" (Q7, hạng mục G-1…G-20) — theo đúng mặc định của plan, KHÔNG làm gì
trong Đợt 2 vì cần chủ dự án chọn hạng mục.

## Kiểm mắt còn cần làm (agent không chạy được `npm run dev` + trình duyệt trong phiên này)

Plan yêu cầu kiểm mắt `npm run dev` ở `/vi/projects/1` và `/vi/nhap-lieu` (sáng/tối, nhiều khổ
màn hình) sau mỗi Task. Agent đã xác nhận qua test + build, nhưng CHƯA tự mở trình duyệt để nhìn.
Tester nên tự chạy `npm run dev`, mở `/vi/projects/1`, `/vi/projects/17`, `/en/projects/1`,
`/vi/nhap-lieu?project=1&step=profile#key-milestones`, kiểm cả 2 theme.

---

## Vòng debug 1 — CAN-1: tooltip `.tip` tràn phải ở 1440px (commit `8da0486`)

- **Root cause:** `useChartTip()` (`src/components/project/ChartTip.tsx`) dùng hằng số cứng
  `w = 200` để quyết định lật trái/phải, không khớp bề rộng THẬT sau render — dòng "Phụ trách"
  của "Thiết bị theo nhóm" liệt kê nhiều nhà thầu có thể rộng ~329-380px. CSS `.tip` trong
  `app/globals.css` cũng không có `max-width`, nên khối tự nới rộng theo nội dung thay vì xuống
  dòng. Kết quả: `right = 1588.89 > viewportWidth(1440)` — tràn phải ~149px (đúng số liệu tester
  đo bằng `getBoundingClientRect()`).
- **File sửa:**
  - `src/lib/tooltip-position.ts` (mới) — hàm thuần `clampTipPosition()`: nhận toạ độ chuột +
    bề rộng/chiều cao THẬT + kích thước viewport, luôn kẹp tooltip trong viewport cả 4 phía (kể
    cả trường hợp tooltip rộng hơn cả viewport).
  - `src/components/project/ChartTip.tsx` — `ChartTip` giờ có `ref` + `useEffect` đo
    `getBoundingClientRect()` thật sau khi mount rồi gọi `clampTipPosition()` tính lại vị trí
    (dùng `useEffect` chứ không phải `useLayoutEffect` để tránh warning SSR khi render qua
    `renderToStaticMarkup` trong test). Vị trí ước lượng ban đầu (trước khi đo) vẫn giữ để tránh
    tooltip "giật" khi vừa mở.
  - `app/globals.css` — `.tip` thêm `max-width:min(320px,calc(100vw - 20px))`; `.tip .r
    span:last-child` thêm `white-space:normal;word-break:break-word;text-align:right` để nội
    dung dài (danh sách nhà thầu) xuống dòng thay vì nới rộng khối vô hạn.
- **Test mới:** `src/lib/tooltip-position.test.ts` (6 case: đường chạy thuận, tái hiện đúng số
  liệu CAN-1 với bề rộng thật ~329px không còn tràn, lật trái/lật trên, tooltip rộng hơn viewport
  vẫn kẹp không âm toạ độ, góc màn hình không âm toạ độ).
- **Không đổi:** không đụng 2 mục GOP Ý (Recharts `defaultProps`, input date ISO ở
  `DataEntryForm`) — ngoài phạm vi.
- **Xác nhận:** `npx tsc --noEmit` sạch; `npm test` → **705/705 xanh** (51 file, +6 test so với
  699 trước đó), không warning console lạ. `npm run build` KHÔNG chạy được trong phiên debug này
  vì môi trường sandbox chặn mạng ra ngoài (`fonts.googleapis.com` bị lỗi
  `SELF_SIGNED_CERT_IN_CHAIN` khi Next tải font `Inter`) — lỗi hạ tầng mạng cục bộ, không liên
  quan tới thay đổi code (không đụng `layout.tsx`/cấu hình font); Task 10 đã xác nhận build sạch
  trước đó với cùng codebase (trừ 4 file sửa ở vòng debug này).

## Vòng debug 2 — CAN-2: tooltip đo-lại nhưng vị trí không bao giờ đổi (vòng cuối)

- **Triệu chứng tester ghi lại (Playwright thật, `/vi/projects/1`, 1440×1000):** tooltip "Thiết bị
  theo nhóm" vẫn `left≈1260, width≈320, right≈1580 > 1440`; `style.left/top` KHÔNG đổi khỏi vị trí
  ước lượng ban đầu (`estW=200`) dù chuột đứng yên >1s — tức bước "đo lại rồi kẹp" của vòng debug 1
  không có tác dụng quan sát được, dù `useEffect` vẫn chạy và `setMeasured()` vẫn gọi.
- **Root cause thật (vì sao vòng 1 không có tác dụng):** vòng 1 đo bằng
  `ref.current.getBoundingClientRect()` **ngay tại vị trí ước lượng SAI** (chưa dịch chuyển phần
  tử trước khi đo). Phần tử `.tip` là `position:fixed` với `left` xác định, `width:auto`,
  `right:auto` — theo CSS2.1 §10.3.7 (case 3: `left` không auto, `width` auto, `right` auto),
  trình duyệt tính "used width" bằng thuật toán shrink-to-fit nhưng bị chặn trên bởi khoảng trống
  còn lại **bên phải của `left` hiện tại** (`= viewportWidth - left`), không phải bởi bề rộng nội
  dung mong muốn. Với ước lượng ban đầu `left≈1260` trong khổ 1440px, chỉ còn ~180px bên phải →
  phép đo tại đó luôn cho ra một bề rộng bị bó hẹp gần bằng khoảng trống đó, rồi `clampTipPosition`
  lại tính ra một vị trí gần **giống hệt** vị trí sai ban đầu (điểm bất động sai/self-fulfilling
  measurement) — nên style trông như "không bao giờ đo lại", dù effect và setState vẫn chạy bình
  thường. Đây là lỗi hình học CSS thật, unit test thuần của vòng 1 (`clampTipPosition` nhận
  width/height đã đúng sẵn) không thể bắt được vì nó không mô phỏng việc đo width phụ thuộc vào
  vị trí hiện tại của phần tử trong DOM thật.
- **Cách sửa:**
  - `src/lib/tooltip-position.ts` — thêm `measureAndClampTip(el, tip, viewportWidth,
    viewportHeight)`: đặt phần tử về `left:0;top:0` (còn nguyên viewport bên phải/dưới) **TRƯỚC
    KHI** đọc `offsetWidth/offsetHeight`, để phép đo chỉ còn bị chặn bởi CSS `min-width/max-width`
    (đúng ý muốn) chứ không phải bởi vị trí hiện tại; sau đó gọi `clampTipPosition()` và gán thẳng
    kết quả vào `el.style.left/top`. Dùng `offsetWidth/offsetHeight` thay vì
    `getBoundingClientRect()` vì không bị ảnh hưởng bởi `transform: scale()`.
  - `src/components/project/ChartTip.tsx` — đổi `useEffect` → `useLayoutEffect` (guard isomorphic
    `typeof window !== 'undefined' ? useLayoutEffect : useEffect` để không cảnh báo SSR khi test
    render qua `renderToStaticMarkup`), gọi `measureAndClampTip()` thay cho đo/tính tay. Dùng
    `useLayoutEffect` để phép đo-và-định-vị-lại chạy ĐỒNG BỘ trước khi trình duyệt vẽ khung hình
    đầu tiên, không nhấp nháy ở vị trí sai. Áp dụng chung cho cả 4 chart dùng `ChartTip`
    (`ResourceBreakdownChart`, `KeyMilestoneChart`, `StageTimelineChart`, `WeeklyTrackingCard`) vì
    tất cả đều dùng chung component này — không cần sửa từng file chart.
- **Test mới (`src/lib/tooltip-position.test.ts`, thêm `describe('measureAndClampTip...')`):** vì
  `vitest.config.ts` chạy môi trường `node` (không có DOM thật) nên không thể render component và
  quan sát layout CSS thật trong test. Thay vào đó, viết một đối tượng `MeasurableTipElement` giả
  (`makeSelfReferentialEl`) mô phỏng ĐÚNG hành vi CSS case-3 đã nêu ở trên (`offsetWidth` phụ
  thuộc vào `style.left` hiện tại, bị chặn bởi khoảng trống còn lại bên phải) — đây là cách tái
  hiện root cause bằng hàm thuần theo đúng gợi ý của điều phối viên. 3 test case: (1) tái hiện
  đúng bug — đọc `offsetWidth` ngay tại vị trí sai cho ra bề rộng bị bóp nhỏ, không phải bề rộng
  thật; (2) xác nhận `measureAndClampTip()` (có reset về 0 trước khi đo) trả về bề rộng thật + vị
  trí nằm gọn trong viewport, và ghi thẳng kết quả vào `el.style`; (3) gọi lặp lại nhiều lần vẫn
  hội tụ về đúng 1 vị trí đúng, không dao động. **Giới hạn:** test này không thay cho kiểm mắt
  bằng trình duyệt thật (agent không có trình duyệt trong phiên này) — vẫn cần tester xác nhận lại
  bằng Playwright/mắt thật như vòng 1.
- **Không đổi:** giữ nguyên toàn bộ vị trí ước lượng ban đầu (`estW=200` trong `useChartTip.show`,
  dùng cho khung hình trước khi `useLayoutEffect` chạy) và `app/globals.css` (`max-width`,
  `white-space` của vòng debug 1) — không cần sửa, vì root cause nằm ở THỜI ĐIỂM/VỊ TRÍ đo, không
  phải ở giá trị ước lượng hay CSS wrap.
- **Xác nhận:** `npx tsc --noEmit` sạch; `npm test` → **708/708 xanh** (51 file, +3 test so với
  705 trước đó). `npm run build` không chạy (lỗi mạng cục bộ `SELF_SIGNED_CERT_IN_CHAIN` khi tải
  Google Font, không liên quan code — như vòng debug 1).

---

## Vá GOP-3 theo yêu cầu reviewer (commit `16fa16b`, điều phối viên tự vá)

- `app/globals.css`: `.help .bub` `display:none` khi ẩn (visibility:hidden vẫn tính vào vùng cuộn → tràn ngang ~70px ở mobile), fade giữ bằng `@starting-style`; thêm class `.clamped` dùng `--bub-left/--bub-arrow`.
- `src/components/ui/HelpTip.tsx`: thành client component; khi pointerenter/focus đo nút, kẹp bong bóng theo viewport bằng `clampBubbleX()` (`src/lib/tooltip-position.ts`, +4 test). Neo cố định (`.rt`) không đủ vì vị trí nút đổi theo ngôn ngữ.
- `DataEntryForm.tsx`, `CreateProjectForm.tsx`: 3 nút "?" viết tay đổi sang `HelpTip` dùng chung.
- `CreateProjectForm.tsx:210`: ô grid bọc `KeyMilestoneEditor` thêm `minWidth: 0` — bảng mốc chính (Task 8) làm tràn ngang ở mobile.
- Tester đo 5 lần, lần 5 PASS toàn bộ (xem `ket-qua-test.md`). `tsc` sạch, `npm test` 712/712, `npm run build` compile sạch (font Google được mock bằng `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` do mạng máy này chặn TLS).
