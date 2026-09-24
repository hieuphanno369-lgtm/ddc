# XANH

P2B — Biểu đồ & hiệu năng. Kiểm thử độc lập (không chỉnh sửa file sản phẩm), skill dùng:
`ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion` (viết test/chạy
tay trước khi tin kết quả). Đụng UI → smoke-test bằng `mcp__playwright` trên dev server cổng 3001.
Đụng DB → kiểm trạng thái dữ liệu bằng `psql`/`prisma` qua `DATABASE_URL` trong `.env` (MCP
postgres đang trỏ DB của A nên không dùng để đọc/ghi DB B).

## Cổng kiểm

- `npx tsc --noEmit`: sạch.
- `npm test`: **1088/1088 xanh** (95 file test). Mốc trước khi tester thêm: 1060/1060 (coder).
  Tester thêm 3 file test mới, 28 test: `src/lib/equipment-gantt-independent.test.ts` (7),
  `src/lib/manpower-charts-independent.test.ts` (7), `src/server/queries-independent.test.ts` (14).
- `npm run check:read` (chạy tay trên Postgres thật `ddc_control_tower_b`, không phải mock): **OK**
  toàn bộ 18 dòng đối chiếu `readRepoPrisma` vs `createReadMock` (Bước 1 + Bước 5).
- Trạng thái DB sau khi kiểm (đọc bằng `prisma`, không qua MCP postgres): 17 dự án, 0 dòng
  `PERF-*`, đúng DB `ddc_control_tower_b` — không còn dấu vết seed hiệu năng, khớp mô tả trong
  `thay-doi.md`.

## Test tester viết thêm (độc lập với test của coder)

### 1. `src/lib/equipment-gantt-independent.test.ts` (assignUsage, Q1-b)

Không tin test có sẵn của coder — dựng thêm 7 case riêng, gồm cả case dùng plans KHÔNG theo thứ tự
`unitNo` trong mảng đầu vào (coder test luôn tạo plans theo đúng thứ tự 1,2,3 nên không bắt được
lỗi sort nếu có): plans thứ tự (unitNo 3, 1, 2) + N=2 → vẫn đúng chọn unitNo 1 và 2 (không phải 3).
Thêm: biên đúng 2 đầu mút `plannedStart`/`plannedFinish` (bao gồm), sad-path ngày lệch 1 ngoài biên
(31/08 khi KH bắt đầu 01/09) → KHÔNG được gán + `unplanned` tăng đúng 1, `qtyActual=0` không gán gì
không cộng `unplanned`, 2 nhóm thiết bị khác nhau trong 1 lần gọi không lẫn nhau, nhiều ngày dùng
cộng dồn đúng 1 chiếc → `usedDays` tăng dần không trùng, và `buildGantt` gán đúng ngày dùng vào đúng
thanh khi 2 plan cùng chiếc nối tiếp không chồng ngày. **Tất cả pass — không phát hiện lỗi.**

### 2. `src/lib/manpower-charts-independent.test.ts` (Q3/Q4/Q5)

Trọng tâm: coder test chỉ dùng chuỗi `'YYYY-MM-DD'` thuần cho `ProjectDates`, nhưng dữ liệu thật từ
Prisma (`prisma-repo.ts` hàm `iso()`) trả `Date.toISOString()` — chuỗi ISO ĐẦY ĐỦ có giờ
(`'2026-09-02T00:00:00.000Z'`). Test độc lập truyền thẳng dạng ISO đầy đủ này vào `projectTimeline`
để xác nhận `.slice(0,10)` cắt đúng, kể cả case mix (actualStart có, actualFinish thiếu → rơi về
plannedFinish, cả 2 đều ISO đầy đủ). Thêm: nới khoảng CẢ HAI đầu cùng lúc, dataRange nằm gọn trong
ngày dự án (không nới), `buildWeeklyStack` với số liệu không tròn để xác nhận TB tính trên TỔNG THÔ
rồi mới chia (không cộng các số hạng đã làm tròn trước — nếu code cộng nhầm số đã tính TB theo từng
nhà thầu thay vì cộng thô, test này bắt được ngay), và 2 sad-path: `range.from > range.to` (gọi hàm
sai tham số) → không throw, trả mảng rỗng; `weeksInMonth` với tháng không giao timeline nào → mảng
rỗng. **Tất cả pass — không phát hiện lỗi.**

### 3. `src/server/queries-independent.test.ts` (T1 — bỏ N+1, so kết quả TRƯỚC/SAU)

Cách làm: dựng lại nguyên văn logic `queries.ts` TRƯỚC refactor bằng `git show
10cda5a:src/server/queries.ts` (đổi hậu tố `Old`, chỉ tồn tại trong file test, không đụng code sản
phẩm), chạy song song với `queries.ts` SAU refactor trên CÙNG mock repo (seed mặc định), so sánh
GIÁ TRỊ trả về (không chỉ số lần gọi repo như `queries-n1.test.ts` của coder) cho:
`getProjectSummaries` (tháng hiện tại, `month=all`, tháng rác, có filter `groupBy=team`, groupKey
không tồn tại), `getPortfolioKpis` (tháng hiện tại, `all`), `getTonnageValueByGroup` (theo team,
theo market x `all`), `getCapacityData`, `getSpiCpiTrend`, `getPortfolioSCurve`, `getWatchlist`,
`getMissingMonth`. **14/14 pass — giá trị SAU refactor giống HỆT giá trị TRƯỚC refactor** trên toàn
bộ seed 17 dự án. Đây là bằng chứng độc lập mạnh nhất rằng T1 Bước 5 không đổi hành vi (không chỉ
dựa vào lời khai "test hồi quy chạy nguyên" của coder).

## Kiểm bằng mắt qua Playwright (dev server cổng 3001, đăng nhập admin@daidung.com.vn)

Ảnh lưu `.bangiao/anh-test/`: `projects-1-full.png`, `shift-chart.png`, `weekly-chart.png`,
`equipment-gantt.png`, `data-schema.png`, `data-dictionary.png`, `admin.png`, `admin-bottom.png`.

- `/vi/overview`: render đủ KPI, donut, 4 chart, bảng dự án, không crash. "Cập nhật DB lần cuối: -"
  — kiểm DB thật thì `audit_log` đang RỖNG (0 dòng) nên `-` là đúng biên (không phải lỗi).
- `/vi/projects/1`: 3 thẻ mới hiện đủ — chart ca × nhà thầu (6 nhà thầu, cột KH/TT), chart tuần
  chồng (mặc định tháng hiện tại 09/2026, đường KH tổng), Gantt thiết bị (5 hàng, màu theo hạng
  mục, dòng chú thích "385 lượt thiết bị-ngày ngoài kế hoạch"). Anchor `#res-manpower`,
  `#res-equipment` (thẻ P1B) và `#res-shift` (thẻ mới) đều cuộn đúng — kiểm bằng
  `getBoundingClientRect().top` sau khi click/scrollIntoView, ra đúng ~72px (khớp
  `scrollMarginTop: 72`, không bị header che). Phím `ArrowLeft`/`ArrowRight` trên chart tuần cuộn
  đúng ±44px mỗi lần nhấn (đo `scrollLeft` trước/sau, khớp chính xác spec kế hoạch).
- `/vi/projects/17` (dự án không có KH thiết bị): hiện đúng "Chưa có kế hoạch thiết bị cho dự án
  này".
- `/vi/data-schema`: ERD có đường nối quan hệ (nét liền + nét đứt cho join logic), legend
  cardinality N/1/0..1, hộp bảng theo màu `kind`, mục "Chi tiết từng bảng" đủ field. Không lỗi
  console.
- `/vi/data-dictionary`: mỗi bảng 1 accordion, mô tả + bảng field + mục Join. Không lỗi console.
- `/vi/admin`: "Lịch sử hoạt động" (P2B — `readActivitySince`) hiện đúng "Không có dữ liệu" — kiểm
  DB thật thì `activity_log` đang RỖNG (0 dòng, seed không tạo activity log) nên đây là biên đúng,
  không phải lỗi lọc DB.

### Phát hiện ngoài phạm vi P2B (không phải lỗi của coder — không chặn XANH)

`/vi/admin` có 2 lỗi console `MISSING_MESSAGE: admin.delete` (nút "Xóa dự án" trong
`DeleteProject.tsx`, file KHÔNG nằm trong bất kỳ bước nào của kế hoạch P2B). Đã kiểm
`git show 10cda5a` (commit gốc trước khi P2B bắt đầu) — key `admin.delete`/`admin.deleted` đã thiếu
từ trước, không phải do coder P2B gây ra. Ghi lại để chủ dự án biết, không tính vào kết quả P2B.

## Không phát hiện lỗi nào trong phạm vi P2B

Không có test nào rớt. Không cần sửa code sản phẩm.
