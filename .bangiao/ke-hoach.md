# P3C-B - Chart T1/T2/T4/T5: kế hoạch triển khai

> Skill đã dùng khi lập: `writing-plans`. Tra docs Recharts (context7) cho `LabelList` (`dataKey` nhận hàm, `position`, `offset`).
> Coder CHỈ đọc file này. Mỗi Bước = 1 commit riêng. Checkbox `- [ ]` để đánh dấu tiến độ.

**Mục tiêu:** nhãn số cho chart tuần (T1), thẻ "Top dự án trọng điểm" ở Tổng quan (T2), Gantt thiết bị theo đợt (T4) và chart KH nhân lực theo tháng cột + đường (T5), theo đúng hợp đồng dữ liệu với A.

**Kiến trúc:** logic thuần ở `src/lib/*` (test được, không đọc đồng hồ, không đụng repo) → component client ở `src/components/*` nhận model qua props → tầng query ở `src/server/*`. T4/T5 chỉ nối vào trang Chi tiết SAU khi A merge P3C-A (Bước 11 - TREO).

**Tech:** Next.js 14 app router, React 18, Recharts 2.12.7 (T1), SVG tự vẽ (T4, T5 - theo mẫu `src/components/project/EquipmentGantt.tsx`), next-intl, Vitest 2.

**Nguồn sự thật:** `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md` (quyết định chủ dự án T1-T5 + kiểu dữ liệu). Không đổi tên/kiểu trong hợp đồng.

---

## ĐÃ CHỐT (chủ dự án trả lời 2026-09-25) - coder làm theo đây, không còn câu nào bỏ ngỏ

1. T5 đường "TT TB/ngày" = tổng thực tế tháng ÷ **số ngày có nhập liệu** trong tháng.
2. T4 loại thiết bị có Tổng SL nhưng chưa có đợt → **vẫn hiện 1 hàng** trống, cột SL = `0/tổng`.
3. T2 "Top dự án trọng điểm" **lọc theo FilterBar** giống thẻ cũ; rỗng → "Không có dự án P0 đang triển khai".
4. T5 trục tháng = **dải tháng liên tục** từ tháng sớm nhất tới muộn nhất của (tháng có KH ∪ tháng có TT).

## CÂU HỎI CÒN BỎ NGỎ (đã trả lời - xem ĐÃ CHỐT)

Coder làm theo **đề xuất** (đã ghi vào từng Bước); nếu chủ dự án trả lời khác thì chỉ phải sửa đúng chỗ ghi trong ngoặc.

1. **T5 - đường "TT TB/ngày" chia cho mấy ngày?** Chia cho **số ngày có nhập liệu** trong tháng, hay chia cho **số ngày lịch** của tháng (ngày không nhập tính là 0 người, giống chart tuần P2B)?
   *Đề xuất:* chia cho số ngày có nhập liệu. Lý do: KH tháng là số người huy động chứ không phải người-ngày; tháng đang chạy hoặc ngày quên nhập mà tính 0 người thì đường TT tụt giả. (Chỗ sửa nếu khác: `buildManpowerMonthModel`, Bước 7.)
2. **T4 - loại thiết bị đã có "Tổng SL" nhưng chưa nhập đợt nào:** vẫn hiện 1 hàng (không có thanh, cột SL = `0/tổng`) hay ẩn đi?
   *Đề xuất:* vẫn hiện, để thấy thiết bị đã khai báo mà chưa lên lịch. (Chỗ sửa: `buildPlanGantt`, Bước 4.)
3. **T2 - "Top dự án trọng điểm" có lọc theo FilterBar** (team, khách hàng, loại, thị trường, tháng) như thẻ "Dự án cần lưu ý" cũ không?
   *Đề xuất:* có, giữ như thẻ cũ. Nếu người dùng lọc Priority = P1 thì thẻ rỗng, hiện dòng "Không có dự án P0 đang triển khai". (Chỗ sửa: `getTopPriority`, Bước 3.)
4. **T5 - trục tháng:** các tháng có số liệu thực tế nhưng không có KH (vd trước khi lập KH tháng) có hiện trên trục không (cột KH = 0, chỉ có điểm TT)?
   *Đề xuất:* có. Trục = dải tháng liên tục, từ tháng nhỏ nhất tới tháng lớn nhất của (tháng có KH ∪ tháng có TT). (Chỗ sửa: `buildManpowerMonthModel`, Bước 7.)

---

## Ràng buộc chung (áp cho mọi Bước)

- **Worktree / nhánh:** `D:\_project\DDC_Control_Tower-B`, nhánh `feature/p3c-b-chart`. Trước commit đầu tiên chạy `git branch --show-current` → phải ra `feature/p3c-b-chart` (git status đầu phiên báo `HEAD`, có thể đang detached). Nếu không đúng nhánh thì `git switch feature/p3c-b-chart`.
- **Không migration.** Không sửa `prisma/schema.prisma`, `prisma/migrations/`, `src/server/repo/types.ts`, form của A, `mock-repo.ts`, `prisma-repo.ts`, `actions.ts`, `app/globals.css`, `PROGRESS.md`, `.serena/memories/`.
- **File nóng B sẽ sửa:** chỉ `src/i18n/messages/vi.json` + `en.json` (Bước 9). **Không** sửa `queries.ts`/`project-queries.ts` - T2 đặt ở file mới. Trước Bước 9 đọc `D:\_project\DDC_dieu-phoi\phien-A.md`: nếu A còn giữ `vi.json`/`en.json` thì Bước 9 và Bước 10 CHỜ, làm các bước khác trước. Khi làm: ghi 2 file vào "Đang giữ" của `phien-B.md`, commit xong thì bỏ ra.
- **Sau mỗi commit:** cập nhật `D:\_project\DDC_dieu-phoi\phien-B.md` (bước vừa xong, commit cuối, bước kế, file đang giữ, giờ).
- **Cổng mỗi Bước** (PowerShell, ổ `D:` viết hoa - Git Bash làm Vitest báo giả "No test suite found"):
  ```powershell
  Set-Location D:\_project\DDC_Control_Tower-B
  npx tsc --noEmit
  npx vitest run <file test của bước>
  npm test
  ```
  `tsc` 0 lỗi; `npm test` xanh hết, số test không được thấp hơn mốc đầu phase (ghi mốc vào `thay-doi.md` ở Bước 1).
- **"Hôm nay"** luôn nhận qua tham số (`today: string`, 'YYYY-MM-DD'); lib/component không gọi `new Date()`/`todayIso()`. Trang lấy `todayIso()` từ `src/lib/clock.ts`. Vitest đã đặt `DDC_FAKE_TODAY=2026-09-16`.
- **Tên ca** luôn lấy từ `dim_shift` (`repo.readShifts()`, `nameVi`/`nameEn` theo locale). Không ghi cứng "sáng"/"chiều"/"tối" (mã `afternoon` nay nghĩa là ca tối).
- **Màu:** dùng token app (`var(--s-plan)`, `var(--s-actual)`, `var(--s-third)`, `var(--s-cost)`, `var(--danger)`, `var(--grid)`, `var(--axis)`, `var(--label)`, `var(--label2)`, `var(--label3)`), không chép màu ảnh mẫu. Trong SVG tự vẽ đặt màu qua `style={{ fill: ... }}` / `style={{ stroke: ... }}` (mẫu `EquipmentGantt.tsx`). Trong Recharts phải lấy màu qua `useChartTokens()` (Recharts không nhận `var()` ở presentation attribute).
- **Chặn số tiền N-3:** mọi `ProjectSummary` đưa xuống client phải đi qua `maskProjectSummaries(list, canViewFinance)` (`src/lib/finance-gate.ts`).
- **Quy ước copy từ:**
  - Test component SSR (`renderToStaticMarkup` + shim `globalThis.React` + mock `next-intl`): `src/components/project/WeeklyManpowerStackChart.test.ts`, `src/components/dashboard/Watchlist.test.ts`.
  - Test query dùng mock repo (`vi.mock('@/server/repo', ... mock-repo)`): `src/server/manpower-queries.test.ts`.
  - Test read-prisma (mock `$queryRaw`, kiểm `sql.values`): `src/server/repo/read-prisma.test.ts`. Test read-mock: `src/server/repo/read-mock.test.ts`.
  - SVG chart + tooltip `ChartTip`/`useChartTip`: `src/components/project/EquipmentGantt.tsx`.
  - Đo bề rộng bằng ResizeObserver + cuộn ngang: `src/components/project/WeeklyManpowerStackChart.tsx` dòng 21-35.
  - Danh sách 5 dòng + cuộn: `src/components/dashboard/Watchlist.tsx` + `src/lib/visible-rows.ts` (`WATCHLIST_VISIBLE_ROWS`, `maxHeightForRows`).
  - Cache overview: `src/server/cache.ts` (`loadWatchlist`).
  - Tên test: tiếng Việt không dấu (vd `'du an 17 -> null'`). Chú thích code: tiếng Việt.
  - Commit: `feat(p3c-b): ...` / `test(p3c-b): ...` / `refactor(p3c-b): ...`, mô tả tiếng Việt KHÔNG dấu.
- **Không làm thêm:** không dựng trang xem thử (cần route + key i18n mới; kiểm bằng test + trình duyệt ở Bước 10/11). Không xoá key i18n cũ trong P3C-B (tránh giữ i18n thêm lần nữa; ghi nợ ở `thay-doi.md`).

---

## Bản đồ file

| File | Bước | Việc |
|---|---|---|
| `src/lib/p3c-contract.ts` (mới) | 1 | 4 kiểu tạm của hợp đồng; xoá ở Bước 11 |
| `src/lib/p3c-contract.test.ts` (mới) | 1 | so khớp chữ với `types.ts` khi A đã merge; xoá ở Bước 11 |
| `src/components/project/WeeklyManpowerStackChart.tsx` (+ `.test.ts`) | 2 | T1 nhãn số + tooltip dùng `actualAvg` |
| `src/lib/top-priority.ts` (+ `.test.ts`) (mới) | 3 | lọc + sắp xếp P0 |
| `src/server/top-priority-queries.ts` (+ `.test.ts`) (mới) | 3 | `getTopPriority` |
| `src/server/cache.ts` | 3 | thêm `loadTopPriority` |
| `src/lib/equipment-gantt-v2.ts` (+ `.test.ts`) (mới) | 4 | model Gantt theo đợt |
| `src/components/project/EquipmentPlanGantt.tsx` (+ `.test.ts`) (mới) | 5 | vẽ Gantt T4 |
| `src/server/repo/read-types.ts`, `read-prisma.ts`, `read-mock.ts` (+ 2 test), `scripts/check-read-parity.ts` | 6 | `readManpowerActualByMonth` |
| `src/lib/manpower-month-chart.ts` (+ `.test.ts`) (mới) | 7 | model chart tháng T5 |
| `src/components/project/ManpowerMonthChart.tsx` (+ `.test.ts`) (mới) | 8 | vẽ chart T5 |
| `src/i18n/messages/vi.json`, `en.json` (NÓNG), `src/i18n/messages.test.ts` | 9 | key mới (CHỜ A nhả) |
| `src/components/dashboard/TopPriorityList.tsx` (+ `.test.ts`) (mới), `OverviewWidgets.tsx`, `app/[locale]/(app)/overview/page.tsx`, `src/server/overview-finance-gate.test.ts`; xoá `Watchlist.tsx` + `Watchlist.test.ts` | 10 | T2 lên giao diện (sau Bước 9) |
| `app/[locale]/(app)/projects/[id]/page.tsx`, `src/server/manpower-queries.ts`, `src/server/equipment-plan-gantt-queries.ts` (mới), xoá chart cũ, `e2e/03-project-detail.spec.ts`, … | 11 | **TREO** - nối trang Chi tiết |
| `.bangiao/thay-doi.md` | 12 | tổng kết cho Tester |

---

### Bước 1: Kiểu tạm của hợp đồng + test chống lệch

**Files:** Create `src/lib/p3c-contract.ts`, `src/lib/p3c-contract.test.ts`.

**Produces** (Bước 4, 7, 8, 11 dùng - tên và trường phải giữ nguyên):
```ts
/**
 * Kiểu TẠM, chép nguyên văn hợp đồng P3C (D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md).
 * `src/server/repo/types.ts` là file của A - khi A merge P3C-A thì xoá file này và đổi import sang
 * '@/server/repo/types' (Bước 11). p3c-contract.test.ts chặn lệch trường giữa 2 nơi.
 */
export interface EquipmentPlanSegment {
  id: number; equipmentId: number; equipmentName: string;
  from: string; to: string;   // 'YYYY-MM-DD'
  qty: number;                // SL dùng trong đợt
}
export interface EquipmentQuota { equipmentId: number; equipmentName: string; totalQty: number }
export interface ManpowerPlanMonthRow { yearMonth: string; shiftCode: string; planned: number; isManual: boolean }
export interface ShiftRatio { shiftCode: string; pct: number }
```

**Test** `p3c-contract.test.ts` (đọc file dạng chữ bằng `readFileSync(join(process.cwd(), ...))`, mẫu `src/i18n/messages.test.ts` dòng 10-13):
- Hàm `fieldsOf(src: string, name: string): string[] | null`: regex `export interface ${name}\s*\{([^}]*)\}`; không khớp → `null`; bỏ chú thích `//…` tới cuối dòng; tách theo `;` và xuống dòng; trim, bỏ chuỗi rỗng; bỏ mọi khoảng trắng (`'id: number'` → `'id:number'`); sort.
- `it('p3c-contract khai du 4 kieu')`: với cả 4 tên, `fieldsOf(p3c, name)` khác `null`; `EquipmentPlanSegment` có đúng 6 trường `['equipmentId:number','equipmentName:string','from:string','id:number','qty:number','to:string']`.
- `it('khop truong voi types.ts neu A da merge')`: với từng tên, `const a = fieldsOf(typesSrc, name)`; `a === null` → bỏ qua tên đó (A chưa merge); ngược lại `expect(fieldsOf(p3c, name)).toEqual(a)`.

Bước này không đụng code khác. Ghi mốc `npm test` (số file/số test) vào đầu `.bangiao/thay-doi.md` (tạo file, mục "Mốc đầu phase").

- [ ] Viết test → chạy thấy FAIL (thiếu file) → tạo `p3c-contract.ts` → PASS → cổng → commit `feat(p3c-b): kieu tam hop dong P3C + test chong lech types.ts`.

---

### Bước 2: T1 - nhãn số chart tuần + sửa tooltip "Tổng TT"

**Files:** Modify `src/components/project/WeeklyManpowerStackChart.tsx`, `src/components/project/WeeklyManpowerStackChart.test.ts`.

**Produces** (export thêm từ file component, để test không phụ thuộc Recharts render SSR):
```ts
/** Nhãn số trên chart tuần: 0 -> null (không vẽ nhãn). */
export function weeklyLabelValues(w: WeekBucket): { total: number | null; planned: number | null }
// total = w.actualAvg > 0 ? w.actualAvg : null; planned = w.plannedAvg > 0 ? w.plannedAvg : null
export function weeklyTooltip(contractors: ContractorInfo[], t: ReturnType<typeof useTranslations>) // đã có, thêm `export`
```

**Sửa:**
1. Import thêm `LabelList` từ `recharts`.
2. **Số tổng trên đỉnh cột:** sau vòng `data.contractors.map(...)` thêm 1 `Bar` rỗng ở đỉnh chồng (luôn nằm trên cùng dù nhà thầu cuối = 0):
   ```tsx
   <Bar stackId="a" dataKey={() => 0} fill="transparent" isAnimationActive={false} legendType="none">
     <LabelList dataKey={(w: WeekBucket) => weeklyLabelValues(w).total ?? ''} position="top" offset={4}
       style={{ fontSize: 10, fontWeight: 700, fill: c.label2 }} />
   </Bar>
   ```
3. **Số trên đường KH:** thêm con cho `<Line dataKey="plannedAvg" ...>` và thêm `isAnimationActive={false}` vào Line:
   ```tsx
   <LabelList dataKey={(w: WeekBucket) => weeklyLabelValues(w).planned ?? ''} position="top" offset={8}
     style={{ fontSize: 10, fill: c.plan }} />
   ```
4. Tăng `margin.top` của `ComposedChart` từ 8 lên 20 để nhãn cột cao nhất không bị cắt.
5. **Tooltip:** trong `weeklyTooltip` bỏ biến `total` (đang cộng các số đã làm tròn) và hiện `w.actualAvg`: `{t('manpowerCharts.total')}: {w.actualAvg}`. Số từng nhà thầu giữ nguyên trong tooltip.
6. Không thêm key i18n.

**Biên:** tuần không có số liệu (`actualAvg = 0`) → không có nhãn; `plannedAvg = 0` → không có nhãn KH; tuần mờ (ngoài tháng đang lọc) vẫn có nhãn.

**Test thêm** vào `WeeklyManpowerStackChart.test.ts`:
- `weeklyLabelValues` với `DATA.weeks[0]` → `{ total: 10, planned: 12 }`; với tuần `actualAvg: 0, plannedAvg: 0` → `{ total: null, planned: null }`.
- Tooltip dùng `actualAvg`: gọi `weeklyTooltip([{id:1,name:'NT A'},{id:2,name:'NT B'}], t)` với payload tuần `{ actualByContractor: {1: 7, 2: 7}, actualAvg: 15, ... }` (2 số đã làm tròn cộng ra 14 nhưng TB thật 15), render `renderToStaticMarkup(el)` → chứa `manpowerCharts.total: 15`, không chứa `: 14<`; vẫn chứa `NT A: 7`.
- 2 test cũ giữ nguyên, vẫn xanh.

**Kiểm trình duyệt:** `npm run dev` cổng 3001, `/vi/projects/1`, card `#res-weekly`: có số trên đỉnh cột và trên đường KH; nếu 2 nhãn đè nhau ở tuần KH ≈ TT thì ghi vào `thay-doi.md` (không tự đổi thiết kế).

- [ ] Test → FAIL → sửa → PASS → cổng → commit `feat(p3c-b): T1 nhan so tong cot + duong KH chart tuan, tooltip dung actualAvg`.

---

### Bước 3: T2 - logic "Top dự án trọng điểm"

**Files:** Create `src/lib/top-priority.ts`, `src/lib/top-priority.test.ts`, `src/server/top-priority-queries.ts`, `src/server/top-priority-queries.test.ts`; Modify `src/server/cache.ts`.

Banner đầu trang (`AlertBanner` trong `OverviewWidgets.tsx`) và `src/server/report.ts` đang dùng chung `loadWatchlist`/`getWatchlist` → **KHÔNG sửa** `getWatchlist`, `loadWatchlist`, `AlertBanner`, `report.ts`. T2 là hàm mới.

**Produces:**
```ts
// src/lib/top-priority.ts
import type { ProjectSummary } from '@/server/queries';
type TopInput = Pick<ProjectSummary, 'priority' | 'status' | 'onTrack' | 'pctActual' | 'projectName'>;
/** Đang trễ = cùng định nghĩa KPI "Trễ tiến độ" (queries.ts kpisForMonth): đang triển khai và !onTrack. */
export function isBehindSchedule(s: Pick<ProjectSummary, 'status' | 'onTrack'>): boolean;
/** Chỉ P0 + status 'Dang_trien_khai'; sort: trễ trước → pctActual tăng dần → projectName localeCompare(…, 'vi'). Không cắt số dòng (UI cuộn). Trả mảng mới. */
export function selectTopPriority<T extends TopInput>(list: T[]): T[];

// src/server/top-priority-queries.ts
import { getProjectSummaries, type DashboardFilters, type ProjectSummary } from './queries';
export async function getTopPriority(yearMonth: string, filters: DashboardFilters = {}): Promise<ProjectSummary[]>;
// = selectTopPriority(await getProjectSummaries(yearMonth, filters))  (theo Câu hỏi 3: có áp filters)

// src/server/cache.ts - thêm, mẫu loadWatchlist
export const loadTopPriority = (month: string, filters: DashboardFilters) =>
  unstable_cache(async () => getTopPriority(month, filters), ['top-p0', key(month, filters)], {
    tags: [overviewTag(month), profileTag], revalidate: TTL,
  })();
```

**Test `top-priority.test.ts`** (dữ liệu tay, ép kiểu `as ProjectSummary`):
- Bỏ P1/P2/P3; bỏ P0 `Chuan_bi`/`Hoan_thanh`/`Tam_dung`.
- 4 dự án P0 đang triển khai: A (onTrack, 0.5), B (trễ, 0.6), C (trễ, 0.3), D (onTrack, 0.2) → thứ tự `C, B, D, A`.
- Cùng trễ + cùng pctActual → theo tên (`'Ánh'` trước `'Bình'`).
- Mảng rỗng → `[]`; không làm đổi mảng đầu vào (so sánh với bản sao).
- `isBehindSchedule({status:'Hoan_thanh', onTrack:false})` → `false`.

**Test `top-priority-queries.test.ts`** (mock repo như `manpower-queries.test.ts`): `getTopPriority('2026-09')` → mọi phần tử `priority === 'P0'` và `status === 'Dang_trien_khai'`; bằng đúng `selectTopPriority(await getProjectSummaries('2026-09'))`. `getTopPriority('2026-09', { priority: 'P1' })` → `[]`.

- [ ] Test → FAIL → code → PASS → cổng → commit `feat(p3c-b): T2 logic top du an trong diem P0 + loadTopPriority`.

---

### Bước 4: T4 - model Gantt thiết bị theo đợt

**Files:** Create `src/lib/equipment-gantt-v2.ts`, `src/lib/equipment-gantt-v2.test.ts`.

**Consumes:** `EquipmentPlanSegment`, `EquipmentQuota` từ `@/lib/p3c-contract`; `addDaysIso`, `daysBetween`, `addMonths` từ `@/lib/clock`; `bucketOf` từ `@/lib/daily-series`; `formatDayMonth` từ `@/lib/format`; `equipmentColor` từ `@/lib/tracking`.

**Produces:**
```ts
export type GanttAxisMode = 'week' | 'month';
export const WEEK_MODE_MAX_DAYS = 92;     // "≤ ~3 tháng" (chủ dự án T4c) = tổng số ngày kế hoạch ≤ 92
export interface PlanGanttTick { date: string; label: string }       // week: 'dd/mm'; month: 'MM.YYYY'
export interface PlanGanttAxis { mode: GanttAxisMode; from: string; toExclusive: string; ticks: PlanGanttTick[]; labelStep: number }
export interface PlanGanttSegment { id: number; from: string; to: string; qty: number; days: number; lane: number }
export interface PlanGanttRow {
  equipmentId: number; name: string; color: string;
  spanFrom: string | null; spanTo: string | null;   // ngày đầu - cuối toàn quá trình (null nếu chưa có đợt)
  qtyNow: number;                                  // Σ qty các đợt có from <= today <= to
  qtyTotal: number | null;                         // quota.totalQty; không có quota -> null
  lanes: number;                                   // >= 1
  segments: PlanGanttSegment[];                    // sort from, id
}
export interface PlanGanttModel { rows: PlanGanttRow[]; axis: PlanGanttAxis; planFrom: string; planTo: string; today: string; todayInRange: boolean }

export function buildGanttAxis(planFrom: string, planTo: string): PlanGanttAxis;
export function assignLanes(segs: { id: number; from: string; to: string }[]): Map<number, number>;
export function formatDayMonthDot(iso: string): string;   // '2026-09-25' -> '25.09'
export function buildPlanGantt(segments: EquipmentPlanSegment[], quotas: EquipmentQuota[], today: string): PlanGanttModel | null;
```

**Thuật toán:**
- `buildGanttAxis`: `span = daysBetween(planFrom, planTo) + 1`.
  - `span <= 92` → `mode 'week'`: `from = bucketOf(planFrom,'week').from` (Thứ 2), `toExclusive = addDaysIso(bucketOf(planTo,'week').to, 1)`; tick = mọi Thứ 2 trong `[from, toExclusive)`, `label = formatDayMonth(d)`; `labelStep = Math.max(1, Math.ceil(ticks.length / 16))`.
  - ngược lại → `mode 'month'`: `from = planFrom.slice(0,7)+'-01'`, `toExclusive = addMonths(planTo.slice(0,7), 1)+'-01'`; tick = ngày 1 mọi tháng trong `[from, toExclusive)`, `label = 'MM.YYYY'`; `labelStep = Math.max(1, Math.ceil(ticks.length / 12))` ("rút gọn mốc").
- `assignLanes`: sort theo `from`, rồi `id`; mỗi đợt vào lane nhỏ nhất có `to` cuối cùng `< seg.from` (trùng 1 ngày = chồng, vì cả 2 đợt cùng dùng ngày đó); không có → mở lane mới.
- `buildPlanGantt`:
  1. Bỏ qua đợt hỏng: `from > to` hoặc `qty < 1` hoặc ngày không phải 'YYYY-MM-DD' (dùng regex `/^\d{4}-\d{2}-\d{2}$/`). Không ném lỗi.
  2. Còn 0 đợt hợp lệ → `return null` (kể cả khi có quota - không có trục thời gian).
  3. Hàng = hợp các `equipmentId` trong đợt và trong quota (theo Câu hỏi 2: có quota mà không có đợt vẫn có hàng, `segments: []`, `spanFrom/spanTo: null`, `lanes: 1`, `qtyNow: 0`). Sort `equipmentId` tăng. `name` = `equipmentName` của đợt đầu, không có thì của quota. `color = equipmentColor(index hàng)`.
  4. `days = daysBetween(from, to) + 1`; `lane` từ `assignLanes` theo từng hàng; `lanes = max(lane)+1`.
  5. `planFrom/planTo` = min `from` / max `to` của mọi đợt hợp lệ; `axis = buildGanttAxis(planFrom, planTo)`.
  6. `todayInRange = axis.from <= today && today < axis.toExclusive`.
  7. `qtyTotal`: quota có → `totalQty`; không → `null`. KHÔNG kẹp `qtyNow <= qtyTotal` (form của A đã chặn; nếu lệch thì hiện đúng số).

**Test `equipment-gantt-v2.test.ts`:**
- Ngắn (1 thiết bị, 01/09-30/10/2026, 60 ngày) → `mode 'week'`, tick đầu = `'2026-08-31'` label `'31/08'`, mọi tick là Thứ 2.
- Dài (01/07/2026-31/12/2026) → `mode 'month'`, 6 tick, label `'07.2026'` … `'12.2026'`, `labelStep 1`; 30 tháng → `labelStep 3`.
- Biên 92/93 ngày: `2026-09-01..2026-12-01` (92 ngày) → week; thêm 1 ngày → month.
- Chồng đợt: cẩu (id 1) đợt A 01/09-20/09 SL 2, đợt B 15/09-30/09 SL 1, đợt C 21/09-30/09 SL 1 → lane A=0, B=1, C=0, `lanes 2`; `today '2026-09-16'` → `qtyNow 3`; quota 3 → `qtyTotal 3`; `spanFrom '2026-09-01'`, `spanTo '2026-09-30'`.
- Đợt kết thúc đúng hôm nay được tính vào `qtyNow`; đợt bắt đầu ngày mai thì không.
- Quota không có đợt (id 9) → có hàng, `segments []`, `qtyNow 0`, `spanFrom null`. Đợt không có quota → `qtyTotal null`.
- Không có dữ liệu: `buildPlanGantt([], [], t)` → `null`; `buildPlanGantt([], [quota], t)` → `null`; chỉ có đợt hỏng (`from > to`) → `null`.
- Hôm nay ngoài trục (today `'2027-01-05'` với kế hoạch 2026) → `todayInRange false`.
- Màu: 2 hàng → `equipmentColor(0)`, `equipmentColor(1)`.
- `formatDayMonthDot('2026-09-25')` → `'25.09'`.

- [ ] Test → FAIL → code → PASS → cổng → commit `feat(p3c-b): T4 model gantt thiet bi theo dot (truc tuan/thang tu dong)`.

---

### Bước 5: T4 - component `EquipmentPlanGantt`

**Files:** Create `src/components/project/EquipmentPlanGantt.tsx`, `src/components/project/EquipmentPlanGantt.test.ts`. Chép khung từ `src/components/project/EquipmentGantt.tsx` (SVG `className="chart"`, `ChartTip`/`useChartTip`, `xOf` từ `@/lib/stage-timeline`).

**Produces:** `export function EquipmentPlanGantt({ model }: { model: PlanGanttModel })` (`'use client'`).

**Bố cục** (hằng số đầu file): `W = 1000, NAME_W = 190, QTY_W = 76, ML = NAME_W + QTY_W, MR = 16, MT = 40, LANE_H = 24, ROW_PAD = 10, BH = 16, ROW_MIN_H = 46, MIN_SVG_W = 720, LABEL_MIN_W = 44`. `rowH = max(ROW_MIN_H, ROW_PAD*2 + lanes*LANE_H)`. `IW = W - ML - MR`; `X = (d) => xOf(d, { from: axis.from, to: axis.toExclusive, ticks: [] }, ML, IW)`.
- Bọc: `<div style={{ overflowX: 'auto' }}><svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: MIN_SVG_W }} role="img" aria-label={t('equipmentPlanGantt.title')}>` - ở 390px sẽ cuộn ngang thay vì thu chữ.
- Hàng đầu (y ≈ MT − 18): chữ hoa nhỏ `t('equipmentPlanGantt.colEquipment')` ở x = 8 (textAnchor start), `t('equipmentPlanGantt.colQty')` ở giữa cột SL; fontSize 10, fontWeight 700, `var(--label3)`.
- Trục: mỗi tick 1 đường dọc `var(--grid)` từ `MT − 8` tới đáy; nhãn (chỉ khi `i % labelStep === 0`) ở `y = MT − 18`, fontSize 10.5, fontWeight 700, `var(--axis)`, textAnchor middle.
- Mỗi hàng: kẻ ngang `var(--grid)` giữa các hàng; tên thiết bị x = 8, fontSize 12, fontWeight 700, `var(--label)`, cắt bớt nếu dài > 24 ký tự (thêm "…", tên đủ trong `<title>`); dòng phụ ngay dưới, fontSize 10, `var(--label3)`: `${formatDateShort(spanFrom)} - ${formatDateShort(spanTo)}` (không có đợt → `-`). Cột SL: `${qtyNow}/${qtyTotal ?? '-'}` căn giữa cột, fontSize 12; `qtyNow > 0` → fontWeight 700 `var(--label)`, ngược lại `var(--label3)`.
- Thanh đợt: `y = top + ROW_PAD + lane*LANE_H + (LANE_H − BH)/2`; `x = X(from)`, `width = max(X(addDaysIso(to,1)) − x, 3)`, `rx 4`, `style={{ fill: row.color }}`, không đổ mờ/đậm. Nhãn `t('equipmentPlanGantt.qty', { n: qty })`: `width >= LABEL_MIN_W` → trong thanh, chữ trắng, fontSize 10.5, fontWeight 700; ngược lại → sau thanh `var(--label2)` nếu khoảng trống tới đợt kế cùng lane (hoặc mép phải) `>= LABEL_MIN_W`; không đủ chỗ → không vẽ (tooltip vẫn có).
- Tooltip mỗi thanh (`show(ev, row.name, rows)`): `{ k: t('equipmentPlanGantt.tipRange'), v: `${formatDateShort(from)} → ${formatDateShort(to)}`, color: row.color }`, `{ k: t('equipmentPlanGantt.tipQty'), v: String(qty) }`, `{ k: t('equipmentPlanGantt.tipDays'), v: String(days) }`. **Không** có dòng "ngày có dùng".
- Hôm nay (chỉ khi `todayInRange`): `xt = X(today) + (X(addDaysIso(today,1)) − X(today))/2`; đường dọc `var(--danger)` strokeWidth 1.5 từ `MT − 4` tới đáy; nhãn pill trên cùng (y = 12): rect `rx 8` nền `var(--danger)` + chữ trắng fontSize 10.5 fontWeight 700 `t('equipmentPlanGantt.today', { date: formatDayMonthDot(today) })`, căn giữa `xt`, kẹp trong `[ML, W − MR]`.
- **Không** legend hạng mục, **không** ô ngày thực tế, **không** dòng "ngoài kế hoạch".

**Test `EquipmentPlanGantt.test.ts`** (mock `next-intl` như `WeeklyManpowerStackChart.test.ts`; model dựng bằng `buildPlanGantt`):
- Ngắn: chứa tên từng hàng, nhãn tick `'31/08'`, `equipmentPlanGantt.qty|2`, cột SL `3/3`, `equipmentPlanGantt.today|16.09`.
- Dài (6 tháng): chứa `'07.2026'`, không chứa nhãn dạng tuần của tháng đó (vd `'06/07'`).
- Chồng đợt: số `<rect` thanh = số đợt; 2 thanh chồng có thuộc tính `y` khác nhau.
- Hôm nay ngoài trục → không chứa `equipmentPlanGantt.today`.
- Quota không có đợt → có tên hàng + `0/5`.
- 390px: markup chứa `overflow-x:auto` và `min-width:720px`.
- Không chứa `equipmentGantt.tipUsedDays`, `legendUsed`, `unplanned`.

- [ ] Test → FAIL → code → PASS → cổng → commit `feat(p3c-b): T4 component EquipmentPlanGantt (SL nay/tong, marker hom nay)`.

---

### Bước 6: T5 - đọc thực tế nhân lực theo tháng (read repo của B)

**Files:** Modify `src/server/repo/read-types.ts`, `src/server/repo/read-prisma.ts`, `src/server/repo/read-mock.ts`, `src/server/repo/read-prisma.test.ts`, `src/server/repo/read-mock.test.ts`, `scripts/check-read-parity.ts`.

**Produces:**
```ts
// read-types.ts
/** Thực tế nhân lực theo tháng, cộng mọi nhà thầu + mọi ca. days = số NGÀY KHÁC NHAU có dòng trong tháng. */
export interface ManpowerActualMonthRow { yearMonth: string; actualSum: number; days: number }
// thêm vào interface ReadRepo:
readManpowerActualByMonth(projectId: number): Promise<ManpowerActualMonthRow[]>; // sort yearMonth; không có dòng -> []
```
- `read-prisma.ts` (mẫu `readManpowerByShiftMonth`):
  ```ts
  SELECT to_char(m."workDate",'YYYY-MM') AS "yearMonth", SUM(m."actualHeadcount")::int AS "actualSum",
         COUNT(DISTINCT m."workDate")::int AS days
  FROM "fact_daily_manpower" m WHERE m."projectId" = ${projectId}
  GROUP BY 1 ORDER BY 1
  ```
- `read-mock.ts`: gom `getData().dailyManpowerShifts` theo `workDate.slice(0,7)`, cộng `actualHeadcount`, đếm `Set` các `workDate`.
- `check-read-parity.ts`: trong vòng `for (const id of projectIds)` thêm `check(\`readManpowerActualByMonth(${id})\`, ...)`.
- `repo/index.ts` không cần sửa (đã `Object.assign(... readRepoPrisma ...)`); `mock-repo.ts` không sửa (đã gộp `createReadMock`).

**Test:**
- `read-prisma.test.ts`: gọi 1 lần `$queryRaw`, `sql.values` chứa projectId. Test "ten ham khong trung prisma-repo" sẵn có phải vẫn xanh.
- `read-mock.test.ts`: dự án 1 → Σ `actualSum` = Σ `actualHeadcount` của seed dự án 1; mỗi dòng `days` = số `workDate` khác nhau của tháng đó (đếm tay từ seed); sort tăng. Dự án 17 → `[]` (thêm vào test "du an 17").
- Chạy thêm `npm run check:read` nếu DB `ddc_control_tower_b` đang có seed (ghi kết quả vào `thay-doi.md`; DB không chạy thì ghi "chưa chạy").

- [ ] Test → FAIL → code → PASS → cổng → commit `feat(p3c-b): T5 readManpowerActualByMonth (tong TT + so ngay co so lieu theo thang)`.

---

### Bước 7: T5 - model chart KH nhân lực theo tháng

**Files:** Create `src/lib/manpower-month-chart.ts`, `src/lib/manpower-month-chart.test.ts`.

**Consumes:** `ManpowerPlanMonthRow`, `ShiftRatio` (`@/lib/p3c-contract`); `ShiftInfo`, `monthLabel` (`@/lib/manpower-charts`); `ManpowerActualMonthRow` (`@/server/repo/read-types`); `addMonths` (`@/lib/clock`).

**Produces:**
```ts
export interface MonthShift { code: string; name: string; pct: number | null }       // pct từ ShiftRatio
export interface MonthDatum {
  yearMonth: string; label: string;               // label = monthLabel(ym) -> 'MM/YYYY'
  planned: Record<string, number>;                // shiftCode -> người KH (thiếu = 0)
  plannedTotal: number;                           // Σ planned các ca (hợp đồng: tổng tháng không lưu riêng)
  hasPlan: boolean;                               // tháng có >= 1 dòng KH
  actualAvg: number | null;                       // Math.round(actualSum / days); days = 0 hoặc không có dòng -> null
  actualDays: number;
}
export interface ManpowerMonthModel { shifts: MonthShift[]; months: MonthDatum[]; maxY: number }
export function niceMax(v: number): number;
export function buildManpowerMonthModel(input: {
  plan: ManpowerPlanMonthRow[]; ratios: ShiftRatio[]; shifts: ShiftInfo[]; actual: ManpowerActualMonthRow[];
}): ManpowerMonthModel | null;
```

**Thuật toán:**
- Ca hiển thị = hợp mã ca trong `plan` và `ratios`; tên/thứ tự lấy từ `shifts` (`sortOrder` tăng, rồi `code`); mã không có trong `shifts` → `name = code`, `sortOrder = 999` (như `shiftsForMonth` trong `src/lib/manpower-charts.ts`). Hợp rỗng → dùng các ca `isActive`.
- Tháng = dải liên tục từ min tới max của (yearMonth trong `plan`) ∪ (yearMonth trong `actual` có `days > 0`) (Câu hỏi 4). Không có tháng nào → `null`.
- `actualAvg`: theo Câu hỏi 1 - chia cho `days` (ngày có nhập liệu).
- `planned` âm hoặc không phải số nguyên hữu hạn → coi là 0 (phòng thủ, không ném).
- `maxY = niceMax(max của mọi planned từng ca, plannedTotal, actualAvg)`; `niceMax(0) = 10`; còn lại làm tròn lên bậc 1/2/2.5/5 × 10^k (vd 900 → 1000, 450 → 500, 26 → 50, 7 → 10).

**Test:**
- Seed ảnh mẫu: 7 tháng 2026-03..2026-09, tổng 450, 700, 800, 900, 800, 650, 400 chia 60/40 (ca `morning` 270/180, …) → `months.length 7`, `plannedTotal` đúng dãy trên, `maxY 1000`, `shifts[0].name` = tên từ `shifts` (vd `'Ca ngày'`), `pct 0.6`.
- Tháng thiếu giữa dải (có 03 và 05, thiếu 04) → vẫn có 04 với `plannedTotal 0`, `hasPlan false`.
- Thực tế: `{ yearMonth: '2026-09', actualSum: 3100, days: 10 }` → `actualAvg 310`, `actualDays 10`; tháng không có dòng actual → `actualAvg null`.
- Tháng chỉ có TT (2026-02, trước KH) → nằm đầu dải, `hasPlan false`.
- Mã ca lạ `'night'` không có trong `shifts` → `name 'night'`, xếp cuối.
- Rỗng hoàn toàn → `null`. `niceMax` các ca ở trên.

- [ ] Test → FAIL → code → PASS → cổng → commit `feat(p3c-b): T5 model chart KH nhan luc theo thang + duong TT`.

---

### Bước 8: T5 - component `ManpowerMonthChart`

**Files:** Create `src/components/project/ManpowerMonthChart.tsx`, `src/components/project/ManpowerMonthChart.test.ts`.

**Produces:** `export function ManpowerMonthChart({ model }: { model: ManpowerMonthModel })` (`'use client'`). SVG tự vẽ (Recharts không vẽ được trục 2 tầng ca/tháng với đường theo tháng).

**Bố cục:**
- Hằng số: `ML = 44, MR = 16, MT = 26, PLOT_H = 220, AXIS_H = 40, BAR_W = 26, BAR_GAP = 6, MIN_MONTH_W = 96`. `groupW = shifts.length*BAR_W + (shifts.length−1)*BAR_GAP`. Đo bề rộng khung bằng ResizeObserver (chép `WeeklyManpowerStackChart.tsx` dòng 21-35, mặc định 800): `monthW = max(MIN_MONTH_W, groupW + 24, (containerWidth − ML − MR) / months.length)`; `W = ML + months.length*monthW + MR`; `H = MT + PLOT_H + AXIS_H`. SVG vẽ đúng pixel (`width={W} height={H}`, không `viewBox` co giãn), bọc `<div ref style={{ overflowX: 'auto' }}>` → nhiều tháng hoặc 390px thì cuộn ngang.
- `y(v) = MT + PLOT_H − (v / maxY) * PLOT_H`. Lưới ngang 5 mức (0, maxY/4 … maxY) `var(--grid)`, nhãn trục Y fontSize 10.5 `var(--axis)`.
- Màu ca theo thứ tự: `SHIFT_COLORS = ['var(--s-plan)', 'var(--s-cost)', 'var(--s-third-lt)', 'var(--s-neutral)']` (vòng lại). Đường tổng KH: `var(--s-actual)`, liền, 2px, chấm tròn r 3.5. Đường TT TB/ngày: `var(--s-third)`, nét đứt `4 3`, 2px, chấm tròn r 3.5.
- Mỗi tháng i: tâm nhóm `cx = ML + (i + 0.5)*monthW`; cột ca j ở `cx − groupW/2 + j*(BAR_W+BAR_GAP)`, cao theo `planned[code]`, `rx 3`. Nhãn số trên cột (fontSize 10, `var(--label2)`, textAnchor middle, y = đỉnh cột − 4), ẩn khi 0.
- Đường tổng KH: nối điểm `(cx, y(plannedTotal))` của các tháng `hasPlan`; tháng không có KH làm đứt đường (vẽ nhiều `<polyline>` theo đoạn liên tục). Nhãn số trên điểm (y − 8), fontSize 10.5, fontWeight 700, `var(--s-actual)`.
- Đường TT: điểm tháng có `actualAvg != null`, đứt như trên; nhãn DƯỚI điểm (y + 16) để không đè nhãn tổng KH, fontSize 10.5, fontWeight 700, `var(--s-third)`.
- Trục X 2 tầng: tầng 1 (y = MT + PLOT_H + 14) tên ca dưới từng cột, fontSize 10, `var(--label2)` (nhiều ca mà chật thì vẫn in, không xoay); tầng 2 (y = MT + PLOT_H + 32) `label` tháng giữa nhóm, fontSize 11, fontWeight 700, `var(--label)`; vạch dọc ngắn `var(--grid)` ngăn cách các tháng ở vùng trục.
- Chú giải phía trên SVG: `<Legend items>` (`@/components/ui/Legend`): mỗi ca `{ label: pct != null ? `${name} · ${Math.round(pct*100)}%` : name, color }`, `{ label: t('manpowerMonthChart.planTotal'), color: 'var(--s-actual)', line: true }`, `{ label: t('manpowerMonthChart.actualAvg'), color: 'var(--s-third)', line: true }`.
- Tooltip: 1 `<rect>` trong suốt phủ cả cột tháng (bắt `onMouseMove`/`onMouseLeave`), `show(ev, label, rows)` với: mỗi ca `{ k: name, v: String(planned[code] ?? 0), color }`, `{ k: t('manpowerMonthChart.planTotal'), v: String(plannedTotal) }`, `{ k: t('manpowerMonthChart.actualAvg'), v: actualAvg == null ? '-' : String(actualAvg) }`, `{ k: t('manpowerMonthChart.actualDays'), v: String(actualDays) }`.
- `aria-label={t('manpowerMonthChart.title')}`, `role="img"`, `className="chart"`.

**Test `ManpowerMonthChart.test.ts`** (model dựng bằng `buildManpowerMonthModel` với seed 7 tháng):
- Chứa nhãn tháng `'03/2026'` … `'09/2026'`, tên ca 2 lần/tháng ở tầng 1 (đếm ≥ 7 lần mỗi tên), số `270` (cột), `450` (điểm tổng).
- Có TT tháng 09 = 310 → chứa `310`; tháng không có TT → số `<circle` của đường TT = số tháng có TT.
- Tháng có KH 0 → không có nhãn `>0<` trên cột.
- Legend chứa `· 60%` và `manpowerMonthChart.planTotal`, `manpowerMonthChart.actualAvg`.
- 390px/nhiều tháng: 24 tháng → thuộc tính `width` của `<svg` ≥ `44 + 24*96 + 16`; markup chứa `overflow-x:auto`.

- [ ] Test → FAIL → code → PASS → cổng → commit `feat(p3c-b): T5 component ManpowerMonthChart (cot theo ca + duong tong KH + duong TT)`.

---

### Bước 9: Key i18n mới - **CHỜ A nhả `vi.json`/`en.json`**

**Điều kiện bắt đầu:** `phien-A.md` mục "Đang giữ" KHÔNG còn `vi.json`, `en.json`. Nếu còn → dừng bước này + Bước 10, ghi "Bước 9 chờ A nhả i18n" vào `phien-B.md`, làm Bước 12 phần đã có hoặc báo điều phối. Khi bắt đầu: nếu A đã merge vào `main` thì `git merge main` trước (giải xung đột: giữ đủ cả 2 bên), `npm test` xanh, rồi mới sửa.

**Files:** Modify `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` (NÓNG - ghi "Đang giữ" trước), `src/i18n/messages.test.ts`.

Thêm 3 nhóm MỚI ở **cuối file** (sau nhóm cuối hiện có, hiện là `notifyAdmin`; không chèn giữa key có sẵn), cùng thứ tự ở 2 file:

| key | vi | en |
|---|---|---|
| `topPriority.title` | Top dự án trọng điểm | Key priority projects |
| `topPriority.subtitle` | Priority P0 · đang triển khai · dự án trễ xếp trước | Priority P0 · in progress · behind schedule first |
| `topPriority.empty` | Không có dự án P0 đang triển khai | No P0 project in progress |
| `topPriority.behind` | Trễ tiến độ | Behind schedule |
| `topPriority.onTrack` | Đúng tiến độ | On track |
| `equipmentPlanGantt.title` | Lịch sử dụng thiết bị | Equipment usage schedule |
| `equipmentPlanGantt.help` | Mỗi hàng là 1 loại thiết bị, mỗi thanh là 1 đợt sử dụng theo kế hoạch kèm số lượng dùng trong đợt. Cột "SL nay/tổng": số lượng theo kế hoạch đang dùng hôm nay / tổng số lượng của loại thiết bị. Dòng nhỏ dưới tên: ngày bắt đầu - kết thúc toàn quá trình sử dụng. | Each row is one equipment type; each bar is one planned usage period with its quantity. "Qty now/total": planned quantity in use today / total quantity of that type. Small line under the name: first - last day of the whole usage. |
| `equipmentPlanGantt.colEquipment` | THIẾT BỊ | EQUIPMENT |
| `equipmentPlanGantt.colQty` | SL nay/tổng | Qty now/total |
| `equipmentPlanGantt.qty` | SL: {n} | Qty: {n} |
| `equipmentPlanGantt.today` | Hôm nay {date} | Today {date} |
| `equipmentPlanGantt.tipRange` | Kế hoạch | Plan |
| `equipmentPlanGantt.tipQty` | Số lượng | Quantity |
| `equipmentPlanGantt.tipDays` | Số ngày | Days |
| `equipmentPlanGantt.noPlan` | Chưa có kế hoạch thiết bị cho dự án này | No equipment plan for this project |
| `manpowerMonthChart.title` | Kế hoạch nhân lực theo tháng · theo ca | Monthly manpower plan · by shift |
| `manpowerMonthChart.help` | Cột = nhân lực kế hoạch từng ca trong tháng. Đường liền = tổng kế hoạch tháng. Đường nét đứt = thực tế trung bình mỗi ngày có nhập liệu trong tháng (cộng mọi nhà thầu, mọi ca). | Bars = planned headcount per shift in the month. Solid line = monthly plan total. Dashed line = actual average per day with data in the month (all contractors, all shifts). |
| `manpowerMonthChart.planTotal` | Tổng KH tháng | Monthly plan total |
| `manpowerMonthChart.actualAvg` | TT TB/ngày | Actual avg/day |
| `manpowerMonthChart.actualDays` | Số ngày có số liệu | Days with data |
| `manpowerMonthChart.noData` | Chưa có kế hoạch nhân lực theo tháng | No monthly manpower plan yet |

(Nếu Câu hỏi 1 chốt "chia số ngày lịch" thì sửa câu `manpowerMonthChart.help` tương ứng.)

`messages.test.ts`: thêm vào `CHANGED_SOURCES`: `'EquipmentPlanGantt': 'src/components/project/EquipmentPlanGantt.tsx'`, `'ManpowerMonthChart': 'src/components/project/ManpowerMonthChart.tsx'`. (`TopPriorityList` thêm ở Bước 10 khi file đã tồn tại.)

- [ ] Sửa → `npx vitest run src/i18n/messages.test.ts` xanh → cổng → commit `feat(p3c-b): key i18n topPriority, equipmentPlanGantt, manpowerMonthChart` → bỏ 2 file khỏi "Đang giữ".

---

### Bước 10: T2 - thẻ "Top dự án trọng điểm" lên Tổng quan (sau Bước 9)

> **BẮT BUỘC (tester bước 1-8):** `getTopPriority` trả `ProjectSummary` thô → `TopPriorityCard` PHẢI gọi `maskProjectSummaries` (như `WatchlistCard`) theo `canViewFinance`, có test N-3 (không lộ contractValue/eac/vac).

**Files:** Create `src/components/dashboard/TopPriorityList.tsx`, `src/components/dashboard/TopPriorityList.test.ts`; Modify `src/components/dashboard/OverviewWidgets.tsx`, `app/[locale]/(app)/overview/page.tsx`, `src/server/overview-finance-gate.test.ts`, `src/i18n/messages.test.ts`; Delete `src/components/dashboard/Watchlist.tsx`, `src/components/dashboard/Watchlist.test.ts`.

**Produces:**
```ts
// TopPriorityList.tsx ('use client') - chép khung Watchlist.tsx (đo 5 dòng + cuộn)
export function TopPriorityList({ items }: { items: SafeProjectSummary[] })
// OverviewWidgets.tsx
export async function TopPriorityCard({ month, filters, canViewFinance }: { month: string; filters: DashboardFilters; canViewFinance: boolean })
// = <TopPriorityList items={maskProjectSummaries(await loadTopPriority(month, filters), canViewFinance)} />
```
- `TopPriorityList`: `CardHeader title={t('topPriority.title')} subtitle={t('topPriority.subtitle')}`; rỗng → `<p className="empty">{t('topPriority.empty')}</p>`; mỗi dòng `Link href={`/projects/${id}`} className="alert"`: dấu tròn `className="dot"` nền `var(--danger)` nếu `isBehindSchedule(s)` (từ `@/lib/top-priority`) còn lại `var(--ok)`; `h4` = tên; dòng `mt`: `Badge tone="danger"` `t('topPriority.behind')` hoặc `Badge tone="ok"` `t('topPriority.onTrack')` (kiểm `src/components/ui/Badge.tsx` có tone `ok`; không có thì dùng `neutral`), rồi `<span>{t('metric.pctActual')} {formatPct(s.pctActual, locale)} · {t('metric.pctPlan')} {formatPct(s.pctPlan, locale)}</span>` (`useLocale()` từ `next-intl`); `IconChevronRight` cuối dòng. Cuộn sau `WATCHLIST_VISIBLE_ROWS` (5) dòng y hệt `Watchlist.tsx`. Không hiện số tiền.
- `OverviewWidgets.tsx`: xoá `WatchlistCard` và import `Watchlist`; thêm `TopPriorityCard`; import `loadTopPriority`. **`AlertBanner` giữ nguyên** (vẫn `loadWatchlist` + tiêu đề `overview.watchlist`).
- `overview/page.tsx`: thay `<WatchlistCard .../>` bằng `<TopPriorityCard month={month} filters={filters} canViewFinance={canViewFinance} />` cùng chỗ, cùng `Suspense`.
- `messages.test.ts`: thêm `'TopPriorityList': 'src/components/dashboard/TopPriorityList.tsx'`.

**Test:**
- `TopPriorityList.test.ts` (mock `next-intl` gồm `useTranslations` + `useLocale: () => 'vi'`, mock `@/i18n/navigation` như `Watchlist.test.ts`): 7 dòng → có `overflow-y:auto` + `max-height:400px`; 3 dòng → không có `max-height`; dự án trễ → `background:var(--danger)` + `topPriority.behind`; dự án đúng tiến độ → `var(--ok)`; rỗng → `topPriority.empty`; markup không chứa `contractValue` số.
- `overview-finance-gate.test.ts`: thêm `loadTopPriority: vi.fn(async () => [SUMMARY])` vào mock `@/server/cache`; mock `@/components/dashboard/TopPriorityList` thu props (thay mock `Watchlist`); thay đoạn `WatchlistCard` bằng `TopPriorityCard({ ..., canViewFinance: false })` → `items[0].contractValue === null`; thêm ca `canViewFinance: true` → `123.4`.
- `npm run test:e2e -- e2e/02-overview.spec.ts` xanh (cổng 3001, DB B).
- Kiểm trình duyệt `/vi/overview` (admin): thẻ mới đúng vị trí, dự án trễ có dấu đỏ, > 5 dòng thì cuộn; banner đầu trang vẫn như cũ; đăng nhập viewer không thấy số tiền. Ảnh chụp để trong `.bangiao/anh-test/`.

- [ ] Test → FAIL → code → PASS → cổng + e2e 02 → commit `feat(p3c-b): T2 the Top du an trong diem P0 thay Du an can luu y`.

---

### Bước 11: Nối T4 + T5 vào trang Chi tiết - **CHUYỂN SANG A** (chủ dự án chốt 2026-09-26: A làm trong P3C-A; B chốt P3C-B không có bước này)

**Điều kiện bắt đầu (đủ cả 3):** (a) A đã merge P3C-A vào `main` - `git log main` có commit merge P3C-A và `src/server/repo/types.ts` trên `main` có 4 kiểu hợp đồng; `repo` có `readEquipmentPlanSegments`, `readEquipmentQuotas`, `readManpowerPlanMonths`, `readShiftRatios` (cả Prisma lẫn mock); (b) Bước 9 đã xong; (c) A KHÔNG đang nâng Next (phien-A.md). Thiếu 1 điều → ghi "Bước 11 TREO: thiếu <điều kiện>" vào `phien-B.md` và chuyển sang Bước 12.

**11.1 Kéo main:** `git merge main` → `npx prisma migrate deploy` (DB `ddc_control_tower_b`) → `npx prisma db seed` nếu A đổi seed → `npm install` nếu `package.json` đổi → `npx tsc --noEmit` + `npm test`. **`p3c-contract.test.ts` phải xanh** (4 kiểu khớp `types.ts`); đỏ → dừng, báo điều phối (không tự sửa hợp đồng).

**11.2 Đổi import:** mọi `from '@/lib/p3c-contract'` → `from '@/server/repo/types'`; xoá `src/lib/p3c-contract.ts` + `src/lib/p3c-contract.test.ts`.

**11.3 Query:**
```ts
// src/server/equipment-plan-gantt-queries.ts (mới) - KHÔNG tự kiểm quyền, chỉ gọi từ trang đã requireProjectRead
export async function getEquipmentPlanGantt(projectId: number, today: string): Promise<PlanGanttModel | null>
// = buildPlanGantt(...await Promise.all([repo.readEquipmentPlanSegments(projectId), repo.readEquipmentQuotas(projectId)]), today)

// src/server/manpower-queries.ts - thêm
export async function getManpowerMonthChartData(projectId: number, locale: string): Promise<ManpowerMonthModel | null>
// Promise.all([repo.readManpowerPlanMonths(id), repo.readShiftRatios(id), repo.readShifts(), repo.readManpowerActualByMonth(id)])
// shifts map sang ShiftInfo như getShiftChartData (nameVi/nameEn theo locale) -> buildManpowerMonthModel(...)
```

**11.4 Trang `app/[locale]/(app)/projects/[id]/page.tsx`:**
- Card `id="res-shift"` (giữ nguyên id + `scrollMarginTop`): title `t('manpowerMonthChart.title')`, `HelpTip` `t('manpowerMonthChart.help')`, body `monthChart ? <ManpowerMonthChart model={monthChart} /> : <p className="empty">{t('manpowerMonthChart.noData')}</p>`.
- Card `id="eq-gantt"`: title `t('equipmentPlanGantt.title')`, subtitle `formatDate(planFrom) - formatDate(planTo)`, `HelpTip` `t('equipmentPlanGantt.help')`, **bỏ `action` Legend**, body `planGantt ? <EquipmentPlanGantt model={planGantt} /> : <p className="empty">{t('equipmentPlanGantt.noPlan')}</p>`.
- Cả 2 component nạp bằng `dynamic(..., { ssr: false, loading: () => <div className="sk h-60" /> })` như chart cũ.
- Trong `Promise.all`: thay `getShiftChartData(id, locale)` → `getManpowerMonthChartData(id, locale)`, `getEquipmentGantt(id, t('equipmentGantt.noWorkItem'))` → `getEquipmentPlanGantt(id, todayIso())`; đổi tên biến `shiftChart`→`monthChart`, `gantt`→`planGantt`.
- Chart tuần `#res-weekly` giữ nguyên.

**11.5 Xoá code cũ không còn ai dùng:** `src/components/project/ShiftManpowerChart.tsx` + `.test.ts`; `src/components/project/EquipmentGantt.tsx` + `.test.ts`; `src/lib/equipment-gantt.ts` + `equipment-gantt.test.ts` + `equipment-gantt-independent.test.ts`; `src/server/equipment-gantt-queries.ts` + `.test.ts`; trong `manpower-queries.ts` xoá `getShiftChartData` + `ShiftChartData` (+ test tương ứng trong `manpower-queries.test.ts`); trong `manpower-charts.ts` xoá `buildShiftBars`, `shiftChartMonths`, `shiftsForMonth`, `ShiftBarDatum` nếu `grep` không còn chỗ dùng (+ test tương ứng); `readEquipmentPlans` + `readEquipmentUsageDays` trong `read-types.ts`/`read-prisma.ts`/`read-mock.ts`/2 file test/`scripts/check-read-parity.ts` nếu `grep` không còn chỗ dùng; `scripts/perf/bench-data.ts` đổi `getEquipmentGantt(...)` → `getEquipmentPlanGantt(projectId, todayIso())`. Key i18n cũ (`equipmentGantt.*`, `manpowerCharts.shift*`) để nguyên, ghi nợ.

**11.6 Test:**
- `src/server/equipment-plan-gantt-queries.test.ts` (mock repo): dự án 1 (seed A: ≥ 3 loại, 1 loại > 3 tháng) → không null, `rows.length >= 3`, `axis.mode === 'month'`; dự án 17 → `null`.
- `manpower-queries.test.ts`: `getManpowerMonthChartData(1, 'vi')` → `months.length >= 7`, `shifts` tên lấy từ `dim_shift`; dự án 17 → `null`.
- `projects-detail-page-render.test.ts`: test "P2B Buoc 2" đổi thành: có `id="res-shift"` + `manpowerMonthChart.title`, KHÔNG còn `manpowerCharts.shiftTitle`; test "P2B Buoc 4": có `id="eq-gantt"` + `equipmentPlanGantt.title`, không còn `equipmentGantt.legendUsed`; dự án 17 → `equipmentPlanGantt.noPlan`.
- `messages.test.ts`: key literal của trang vẫn đủ.
- `e2e/03-project-detail.spec.ts`: `vi('equipmentGantt.noPlan')` → `vi('equipmentPlanGantt.noPlan')`; sau dòng `#res-shift` visible thêm: `#res-shift svg.chart` count > 0 hoặc `getByText(vi('manpowerMonthChart.noData'))` count > 0. Chạy `npm run test:e2e` toàn bộ (cổng 3001, DB B) → xanh.
- Kiểm trình duyệt `/vi/projects/1` ở 1440px và 390px: Gantt trục tháng MM.YYYY, marker "Hôm nay", cột SL; chart tháng cột + 2 đường + trục 2 tầng; 390px cuộn ngang, chữ không đè nhau. Ảnh vào `.bangiao/anh-test/`.

- [ ] 11.1 → 11.6 → `npx tsc --noEmit` + `npm test` + `npm run test:e2e` + `npm run build` (font mock: `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ `D:\_project\DDC_dieu-phoi\tools\font-mock.js`) → commit `feat(p3c-b): noi gantt theo dot + chart KH nhan luc thang vao trang chi tiet, xoa chart cu`.

---

### Bước 12: Tổng kết cho Tester

**File:** `.bangiao/thay-doi.md` - mốc test đầu/cuối, danh sách commit theo Bước, bước nào TREO/CHỜ + lý do, kết quả `check:read`, ảnh trình duyệt, nợ để sau (key i18n cũ chưa xoá; nhãn T1 có thể đè nhau khi KH ≈ TT nếu có), các câu hỏi còn mở + đề xuất đã áp.

- [ ] Cổng cuối: `npx tsc --noEmit` sạch, `npm test` xanh (≥ mốc), `git diff main...HEAD --stat` KHÔNG có `prisma/`, `types.ts`, `mock-repo.ts`, `prisma-repo.ts`, `actions.ts`, `queries.ts`, `project-queries.ts`, `globals.css`, `PROGRESS.md`, `.serena/` → commit `docs(bangiao): P3C-B thay-doi cho tester`.

---

## Trường hợp biên bắt buộc (tổng hợp)

- T1: tuần 0 người → không có nhãn; tooltip "Tổng TT" = `actualAvg` (TB thật), không cộng số đã làm tròn.
- T2: không có P0 đang triển khai → dòng rỗng; > 5 dòng → cuộn; banner giữ logic cũ; viewer không thấy tiền.
- T4: không có đợt / chỉ đợt hỏng → trạng thái rỗng; đợt chồng ngày → nhiều lane trong 1 hàng; kế hoạch 92/93 ngày → đổi trục tuần/tháng; hôm nay ngoài trục → không vẽ marker; đợt kết thúc đúng hôm nay tính vào "nay"; quota không có đợt → hàng trống `0/tổng`; đợt không có quota → `n/-`; 390px → cuộn ngang.
- T5: không KH và không TT → trạng thái rỗng; tháng thiếu giữa dải → cột 0, đường đứt; tháng không có TT → không có điểm TT; mã ca lạ → hiện mã, xếp cuối; nhiều tháng / 390px → cuộn ngang.
