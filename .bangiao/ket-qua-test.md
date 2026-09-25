# XANH

Kiểm thử độc lập P3C-B **Bước 1–8** (nhánh `feature/p3c-b-chart`, so `git diff 2034548..HEAD`).
Bước 9–11 (nối key i18n + gắn UI vào trang Tổng quan/Chi tiết) **chưa làm** — treo đúng như
`.bangiao/thay-doi.md` mô tả, không thuộc phạm vi vòng test này.

## Skill đã dùng
`ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`. Không cần
`systematic-debugging` vì không có test nào rớt ở lần chạy cuối (2 lỗi test tự viết ban đầu do
tôi giả định sai cú pháp SQL/markup — đã sửa test, không đụng code sản phẩm, xem mục "Ghi chú
TDD" bên dưới).

## Cổng kiểm (PowerShell, `D:\_project\DDC_Control_Tower-B`)
- `npx tsc --noEmit` → sạch, 0 lỗi.
- `npm test` (trước khi thêm test QA) → **146 file / 1650 test xanh**, đúng mốc cuối Bước 8 ghi
  trong `thay-doi.md` (exit code xác nhận = 0, không chỉ nhìn dòng tóm tắt — PowerShell in cảnh
  báo "CJS build of Vite's Node API is deprecated" ra stderr khiến `Bash` tool báo nhầm "Exit code
  1" ở lần chạy đầu; chạy lại có `$LASTEXITCODE` tường minh → 0).
- `npm test` (sau khi thêm 6 file test QA của tôi) → **152 file / 1694 test xanh** (+6 file / +44
  test), exit code 0.
- `npm run check:read` trên DB `ddc_control_tower_b` (đã seed/migrate) → **OK**, gồm cả
  `readManpowerActualByMonth(1)` và `(17)`.

## Kiểm độc lập trên DB B (psql, chỉ đọc — không dùng MCP postgres vì nó trỏ vào DB của A)
```
psql -h localhost -p 5433 -U postgres -d ddc_control_tower_b
SELECT to_char("workDate",'YYYY-MM'), SUM("actualHeadcount"), COUNT(DISTINCT "workDate")
FROM fact_daily_manpower WHERE "projectId"=1 GROUP BY 1;
 -> 2026-09 | 3168 | 7   (dự án 17 -> 0 dòng)
SELECT code,"nameVi","nameEn","sortOrder" FROM dim_shift ORDER BY "sortOrder";
 -> morning/Ca sáng, evening/Ca tối
```
Dùng đúng 2 con số này để viết test độc lập cho `buildManpowerMonthModel` (actualAvg =
Math.round(3168/7) = **453**) — khớp code, không phải chỉ tin lại `check:read`.

## Smoke test UI (Playwright, chỉ phần đã lên trang thật)
T4/T5 (Gantt thiết bị, chart tháng) **chưa nối trang** (Bước 11 TREO) nên không có route để mở —
đúng theo `thay-doi.md`. T1 (nhãn số + tooltip `actualAvg` trên `WeeklyManpowerStackChart`) đã có
sẵn trên trang Chi tiết dự án đang chạy → mở `npm run dev` cổng 3001 (PowerShell,
`$env:PORT='3001'`), vào `/vi/projects/1`, card `#res-weekly`:
- Trang render không crash, không lỗi console thật (3 dòng console.error đều là cảnh báo
  `defaultProps` cũ của Recharts — xuất hiện cả ở `SpiCpiLine`/`ReferenceLine`, component không
  thuộc phạm vi P3C-B, nên không phải regression của đợt này).
- Chart tuần hiện đúng nhãn số trên đỉnh cột (vd 248, 204) và trên đường KH (vd 266, 118) với dữ
  liệu thật của dự án 1.
- Xác nhận lại đúng "Nợ để sau" mà coder đã ghi: ở tuần đỉnh (07/09) nhãn KH và nhãn tổng cột nằm
  sát nhau, chưa đè hẳn lên nhau nhưng khá gần — cần chủ dự án xác nhận có cần chỉnh `offset`
  không (giữ nguyên ghi chú của coder, không tự đổi thiết kế).
- Đã dừng dev server sau khi test xong.

## Test QA độc lập đã viết (6 file mới, 44 test — không sửa file test/code của coder)

| File | Số test | Phủ (đường thuận / biên kế hoạch / phải thất bại) |
|---|---|---|
| `src/lib/equipment-gantt-v2.qa.test.ts` | 14 | Trục tự động tham số hoá biên 92/93 ngày (mốc thời gian khác coder); mốc tháng rút gọn đúng 24 tháng (2 năm) → `labelStep 2`; 1 hàng/loại dù nhiều đợt; ranh giới chồng ngày đúng 1 ngày (`A.to === B.from`) → khác lane, liền kề 1 ngày sau → cùng lane; hôm nay trên ranh giới 2 đợt (`A.to===today===B.from`) → cộng cả 2; hôm nay trước `planFrom`; loại có Tổng SL chưa có đợt (2 loại cùng lúc) vẫn hiện 0/tổng; màu ổn định theo **thứ tự hàng** chứ không theo giá trị `equipmentId` (id không liên tục 5/100). **Phải thất bại:** `qty<=0` bị loại không làm sai `planFrom/planTo` của đợt còn lại; ngày sai định dạng bị loại êm, không `throw`. |
| `src/lib/manpower-month-chart.qa.test.ts` | 9 | Ca đọc đúng tên/thứ tự từ `dim_shift` **thật** (morning/evening, không dùng fixture `afternoon` của coder); `actualAvg` đối chiếu số thật từ DB B (3168/7→453); làm tròn `.5` hướng lên; trục tháng liên tục khi TT nằm **sau** KH (khác tình huống "TT trước KH" của coder); tổng KH = Σ 3 ca. **Phải thất bại:** `planned` âm → ép 0 (không để `plannedTotal` âm); `planned` NaN/thập phân → ép 0, không throw; `actual.days=0` → `actualAvg` null, không chia 0. |
| `src/server/repo/read-manpower-actual-by-month.qa.test.ts` | 5 | SQL: `sql.values` **chỉ** chứa đúng 1 giá trị = `projectId` (không rò tham số khác); regex xác nhận `COUNT(DISTINCT m."workDate")`, `SUM(m."actualHeadcount")`, `WHERE m."projectId" = ?`; gọi 2 dự án liên tiếp → 2 lệnh độc lập, không lẫn tham số. `read-mock`: tự tính tay 1 bộ dữ liệu giả (2 nhà thầu, 2 ca, trùng ngày) → xác nhận `days` đếm **ngày khác nhau** chứ không đếm số dòng (4 dòng nhưng chỉ 2 ngày); dự án không tồn tại → `[]`. |
| `src/lib/top-priority.qa.test.ts` | 7 | 5 dự án hỗn hợp → đúng thứ tự trễ trước/%TT tăng/tên; loại sạch P1-P3 và mọi trạng thái khác `Dang_trien_khai` của P0; `onTrack` thiếu (`undefined`) không `throw`; 2 dự án trùng cả 3 tiêu chí không bị dồn/mất. **Phải thất bại:** khẳng định rõ thứ tự **không được** là %TT giảm dần (chặn hồi quy nếu ai đổi ngầm tiêu chí sort). |
| `src/components/project/WeeklyManpowerStackChart.qa.test.ts` | 5 | Render thật qua `renderToStaticMarkup` (không chỉ gọi hàm thuần) → markup SVG chứa đúng số nhãn (42, 37, 45); tuần rỗng không vẽ nhãn "0" thừa (phân biệt với tick trục Y cũng có số "0", tránh test dương tính giả); tooltip `actualAvg` (13) khác tổng làm tròn từng người (11) — bộ số khác coder; tooltip trả `null` khi không active/rỗng payload. |
| `src/lib/p3c-contract.qa.test.ts` | 4 | Đúng yêu cầu mục 7: dựng **bản sao tạm trong bộ nhớ** (không sửa `types.ts` thật) mô phỏng A merge lệch hợp đồng — đổi tên `qty`→`quantity`, xoá trường `isManual` — khẳng định `fieldsOf(...)` phát hiện lệch (`not.toEqual`), chứng minh cơ chế chặn lệch ở Bước 1 có "răng" thật, không phải luôn xanh giả. |

## Ghi chú TDD (skill `test-driven-development`)
Viết test trước khi biết chắc kết quả, chạy thấy khác kỳ vọng 2 lần, xác nhận là lỗi giả định của
tôi (không phải lỗi code sản phẩm) rồi sửa lại test:
1. `WeeklyManpowerStackChart.qa.test.ts`: assertion `>0<` đầu tiên FAIL vì bắt luôn cả nhãn trục Y
   "0" (không phải lỗi component) — thu hẹp lại theo `style` riêng của nhãn `LabelList`.
2. `read-manpower-actual-by-month.qa.test.ts`: assertion regex `\$1` FAIL vì `Prisma.sql` dùng
   placeholder `?` chứ không phải `$1` — sửa lại đúng cú pháp Prisma thật.
Không có test nào rớt do lỗi trong `src/lib/equipment-gantt-v2.ts`, `manpower-month-chart.ts`,
`top-priority.ts`, `read-prisma.ts`, `read-mock.ts`, `p3c-contract.ts`, hay các component T1/T4/T5.

## Không phát hiện lỗi trong code sản phẩm Bước 1–8
Toàn bộ 8 mục kiểm (tsc, npm test, check:read, equipment-gantt-v2, manpower-month-chart,
readManpowerActualByMonth, top-priority/getTopPriority, WeeklyManpowerStackChart,
p3c-contract "phải thất bại") đều đúng như hợp đồng `hop-dong-du-lieu-P3C.md` và kế hoạch
`.bangiao/ke-hoach.md`.

## Phần để lại cho vòng test sau (khi Bước 9–11 xong)
- `EquipmentPlanGantt` và `ManpowerMonthChart` chưa có route thật để mở trình duyệt (Bước 11
  TREO) — mới kiểm được ở mức model + render `renderToStaticMarkup` (test của coder + smoke của
  tôi ở mức lib). Cần chụp 1440px/390px trên trang thật sau khi nối (đúng ghi chú "Tester nên
  soi" của coder ở Bước 5/8).
- Pill "Hôm nay" trong `EquipmentPlanGantt` ước lượng bề rộng theo ký tự chuỗi dịch — chưa kiểm
  bằng mắt trên DOM thật (SVG server-render ở bước này).
- Nhãn tổng cột và nhãn KH trên `WeeklyManpowerStackChart` sát nhau ở tuần đỉnh — xác nhận lại
  trên trình duyệt thật (mục "Smoke test UI" ở trên), chờ chủ dự án quyết có chỉnh `offset`
  không.
- T2 "Top dự án trọng điểm" (`getTopPriority`) chưa có UI (`TopPriorityList`, Bước 10 TREO) nên
  chưa kiểm được N-3 (`maskProjectSummaries`) đầu-cuối trên trình duyệt; đã kiểm cấu trúc:
  `getTopPriority` trả `ProjectSummary` thô giống hệt mẫu `getWatchlist` (không tự che số tiền),
  đúng kiến trúc hiện có (`WatchlistCard`/`ProjectListCard` mới là nơi gọi `maskProjectSummaries`)
  — khi làm Bước 10, `TopPriorityCard` (nếu có) phải gọi `maskProjectSummaries` giống
  `WatchlistCard`, nếu không sẽ lộ `contractValue`/`eac`/`vac` cho người không có quyền tài chính.
- `p3c-contract.test.ts` của coder (test 2 "khớp trường với types.ts") vẫn đang bỏ qua vì A chưa
  merge P3C-A — nhắc lại đúng như `thay-doi.md`: chạy lại sau khi A merge, FAIL thì báo điều phối,
  không tự sửa.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
