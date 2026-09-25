# P2B — Biểu đồ & hiệu năng — Kế hoạch triển khai

> Planner dùng skill `writing-plans`. Coder làm **đúng thứ tự Bước 1 → Bước 10**, mỗi bước 1 commit, checkbox `- [ ]`.
> **Bước 11 (T1-migration) là bước TREO — lần này KHÔNG làm.**

**Mục tiêu:** T12b 2 chart nhân lực + T14 Gantt thiết bị ở trang Chi tiết; T1 trang Tổng quan/Chi tiết < ~1,5 s với 10 triệu dòng giả;
T4 ERD HTML 2 trang sinh từ schema thật.
**Kiến trúc:** mọi truy vấn đọc mới (aggregate SQL) nằm trong 1 "read repo" riêng (`src/server/repo/read-*.ts`), được **gộp vào
`repo`** qua `src/server/repo/index.ts` + `mock-repo.ts` → không sửa `prisma-repo.ts` (file nóng A đang dùng) và mọi test đang
mock `@/server/repo` tự có hàm mới. Logic dựng chart là hàm thuần trong `src/lib/`, component client trong `src/components/project/`.
**Tech:** Next 14.2.35 app router, Prisma 6.19.3 (`$queryRaw` + `Prisma.sql`), Postgres 16 (5433), next-intl 3.26.3, Recharts 2.12.7, Vitest 2.1.1.

---

## ĐÃ CHỐT (chủ dự án trả lời 2026-09-24) — coder làm theo đúng đề xuất mặc định

- **Q1 = (b)**: nhóm dùng N chiếc → đánh dấu N chiếc đầu theo `unitNo` tăng dần có thanh KH phủ ngày đó; phần dư / ngày
  ngoài KH chỉ đếm vào dòng chú thích "… lượt thiết bị-ngày có dùng nhưng nằm ngoài kế hoạch".
- **Q2**: cột nhóm theo nhà thầu, mỗi ca 1 cột, chiều cao = TT trung bình/ngày của ca; tooltip KH TB/ngày + % TT/KH.
- **Q3**: CÓ vẽ 1 đường KH tổng (TB/ngày) chồng lên cột.
- **Q4**: toàn timeline, chọn tháng → tự cuộn tới + làm mờ tuần không giao; có mục "Toàn dự án"; mặc định `?month`.
- **Q5**: đầu = actualStartDate → plannedStartDate, cuối = actualFinishDate → plannedFinishDate, nới cho chứa hết số
  liệu; thiếu cả 2 → ngày đầu/cuối có số liệu; ngày trong khoảng không nhập = 0 người.
- **Q6**: form nhập `project_equipment_plan` giao **A làm trong P2A** — P2B chỉ vẽ Gantt, dự án chưa có KH hiện
  "Chưa có kế hoạch thiết bị".

→ Mục dưới đây giữ lại để tra cứu, **không còn câu nào bỏ ngỏ**.

## CÂU HỎI CÒN BỎ NGỎ (đã trả lời — xem mục ĐÃ CHỐT ở trên)

Chủ dự án trả lời trước khi giao coder. Mỗi câu có **đề xuất mặc định** — kế hoạch bên dưới viết theo đề xuất đó; nếu chủ dự án
chọn khác, planner sửa đúng bước bị ảnh hưởng rồi mới giao coder.

- **Q1 (chặn Bước 4 — Gantt, phần "ngày thực tế").** Số liệu thiết bị hằng ngày (`fact_daily_equipment_usage`) chỉ lưu theo
  **nhóm thiết bị × nhà thầu × ngày** với `qtyActual` = số chiếc; KHÔNG có cột nào cho biết chiếc nào (No.1/No.2…) đã dùng. Kế
  hoạch Gantt lại theo **từng chiếc** (`project_equipment_plan.unitNo`). Không thể nối chính xác. Chọn cách nào?
  - (a) Ngày nhóm đó có dùng (tổng `qtyActual` ≥ 1) → đánh dấu trên **mọi chiếc** của nhóm có thanh KH phủ ngày đó (có thể phóng đại).
  - (b) **[Đề xuất]** Ngày nhóm đó dùng N chiếc → đánh dấu **N chiếc đầu tiên theo `unitNo` tăng dần** trong số các chiếc có thanh
    KH phủ ngày đó; phần dư (N lớn hơn số chiếc có KH) không vẽ, đếm vào dòng chú thích "… lượt thiết bị-ngày có dùng nhưng nằm
    ngoài kế hoạch".
  - (c) Nhập thực tế theo từng chiếc → cần bảng/cột mới (migration) + form nhập → ngoài P2B, chuyển P2A/P3A.
  - Kèm theo: ngày có dùng nhưng **không nằm trên thanh KH nào** → chỉ đếm vào dòng chú thích trên, không vẽ (đề xuất).
- **Q2 (chặn Bước 2 — chart ca).** Hình dạng chart "nhân lực theo ca theo nhà thầu" cho 1 tháng. **[Đề xuất]** trục X = nhà
  thầu (có số liệu trong tháng), mỗi nhà thầu 1 nhóm cột, **mỗi ca 1 cột** (tên ca đọc từ `dim_shift`); chiều cao cột = nhân lực
  **thực tế trung bình/ngày** của ca đó = Σ TT tháng ÷ số ngày ca đó có số liệu; KH trung bình/ngày + tỷ lệ TT/KH hiện trong tooltip.
- **Q3 (Bước 3 — chart tuần).** Cột chồng = nhân lực **thực tế** TB/ngày theo nhà thầu. Có vẽ thêm **đường KH tổng** (TB/ngày)
  chồng lên cột không? **[Đề xuất]** Có — 1 đường KH tổng.
- **Q4 (Bước 3 — chart tuần).** "Lọc tháng" nghĩa là gì? **[Đề xuất]** chart luôn chứa **toàn timeline** (cuộn/kéo ngang); chọn
  1 tháng → chart tự cuộn tới tuần đầu tiên giao với tháng đó và làm mờ các tuần không giao; có mục "Toàn dự án" (không làm mờ).
  Mặc định chọn tháng đang xem của trang (`?month`, mặc định tháng hiện tại).
- **Q5 (Bước 3 — tuần lẻ).** Đã chốt "tuần đầu/cuối không đủ 7 ngày → chia số ngày thực có". Cần chốt **mốc đầu/cuối dự án**.
  **[Đề xuất]** đầu = `actualStartDate` (chưa có thì `plannedStartDate`); cuối = `actualFinishDate` (chưa có thì
  `plannedFinishDate`); nếu có ngày số liệu nằm ngoài khoảng đó thì nới khoảng ra cho chứa hết; thiếu cả 2 ngày → dùng ngày đầu/cuối
  có số liệu. Tuần giữa luôn chia 7 — **ngày trong khoảng mà không nhập số liệu tính là 0 người** (vd Chủ nhật nghỉ).
- **Q6 (không chặn P2B).** Chưa có form nào nhập `project_equipment_plan` (hiện chỉ có dữ liệu seed của dự án 1). Form nhập kế
  hoạch thiết bị giao cho phase nào/ai? P2B chỉ vẽ Gantt; dự án chưa có kế hoạch hiện "Chưa có kế hoạch thiết bị".

---

## 0. Ràng buộc chung (mọi bước đều phải tuân)

- Worktree `D:\_project\DDC_Control_Tower-B`, nhánh `feature/p2b-bieu-do`, DB `ddc_control_tower_b`. Không đụng thư mục của A.
- **KHÔNG sửa `prisma/schema.prisma`, KHÔNG tạo migration** (A đang giữ). Chỉ Bước 11 (treo) mới có migration.
- **KHÔNG sửa** `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `app/globals.css`, `src/server/project-queries.ts`.
- Cổng kiểm mỗi bước: `npx tsc --noEmit` sạch + `npm test` xanh (mốc hiện tại 928/928; số test chỉ được tăng).
- Không ghi cứng tên/mã ca (`morning`/`afternoon`): A đổi ca chiều → **ca tối** trong migration P2A. Mọi tên ca đọc từ `dim_shift`
  (`nameVi`/`nameEn` theo locale), thứ tự theo `sortOrder`.
- Không dùng `new Date()` trong logic nghiệp vụ — "hôm nay" = `todayIso()` / `currentMonth()` (`src/lib/clock.ts`).
- Recharts: màu phải là **giá trị thật** từ `useChartTokens()` (Recharts đặt màu bằng thuộc tính SVG, `var(--x)` không chạy ở đó).
  SVG tự vẽ (Gantt, ERD) dùng `style={{ fill: 'var(--x)' }}` như `StageTimelineChart.tsx`.
- Key i18n mới chỉ nằm trong 2 nhóm mới **thêm ở CUỐI** `vi.json`/`en.json`: `"manpowerCharts"` và `"equipmentGantt"`.
  Trang `/data-schema`, `/data-dictionary` giữ kiểu hiện tại (chuỗi viết thẳng trong trang, `isVi` như `data-dictionary/page.tsx`) —
  không thêm key i18n cho T4.
- Commit: Conventional Commits + tiếng Việt KHÔNG dấu, vd `feat(p2b): ...` (xem `mem:conventions`).
- Sau MỖI commit: cập nhật `D:\_project\DDC_dieu-phoi\phien-B.md` (commit cuối, bước kế tiếp, file nóng đang giữ, giờ).
- Không thêm tính năng ngoài danh sách dưới đây (không thêm vạch "Hôm nay" cho Gantt, không thêm cache mới, không phân trang
  lại nhật ký hoạt động…).

## 1. File nóng dự kiến sửa (ghi vào "Đang giữ" của `phien-B.md` TRƯỚC khi sửa, bỏ ra sau khi commit bước đó)

| File nóng | Bước | Ghi chú |
|---|---|---|
| `src/i18n/messages/vi.json`, `en.json` | 2, 3, 4 | chỉ THÊM 2 nhóm mới ở cuối file |
| `src/server/queries.ts` | 5 | bỏ N+1, dims 1 lần, nhánh `all` qua read repo |
| `prisma/schema.prisma` + `prisma/migrations/` | **11 — TREO** | chỉ khi đủ điều kiện ở Bước 11 |

Trước khi sửa mỗi file: đọc `D:\_project\DDC_dieu-phoi\phien-A.md` — nếu A đang giữ file đó thì dừng bước đó, ghi chú, làm bước
khác không đụng file (vd Bước 8–10 T4 không đụng file nóng nào).

## 2. Bản đồ file

**Tạo mới**
- `src/server/repo/read-types.ts` — interface `ReadRepo` + kiểu dòng.
- `src/server/repo/read-prisma.ts` (+ `.test.ts`) — `readRepoPrisma: ReadRepo` (SQL/aggregate).
- `src/server/repo/read-mock.ts` (+ `.test.ts`) — `createReadMock(getData): ReadRepo` (tính trên dữ liệu mock).
- `src/lib/manpower-charts.ts` (+ `.test.ts`) — dựng dữ liệu chart ca + chart tuần (hàm thuần).
- `src/lib/equipment-gantt.ts` (+ `.test.ts`) — dựng mô hình Gantt (hàm thuần).
- `src/server/manpower-queries.ts` (+ `.test.ts`) — gom dữ liệu 2 chart nhân lực cho trang.
- `src/server/equipment-gantt-queries.ts` (+ `.test.ts`) — gom dữ liệu Gantt cho trang.
- `src/components/project/ShiftManpowerChart.tsx` (+ `.test.ts`), `WeeklyManpowerStackChart.tsx` (+ `.test.ts`),
  `EquipmentGantt.tsx` (+ `.test.ts`).
- `src/lib/perf-guard.ts` (+ `.test.ts`); `scripts/perf/seed-perf.ts`, `scripts/perf/bench-data.ts`,
  `scripts/perf/measure-pages.ts`; `scripts/check-read-parity.ts`.
- `src/lib/schema-meta/build.ts` (+ `.test.ts`), `src/lib/schema-meta/docs.ts` (+ `.test.ts`),
  `src/lib/schema-meta/erd-geometry.ts` (+ `.test.ts`), `src/lib/schema-meta/mermaid.ts` (+ `erd-doc.test.ts`);
  `scripts/gen-erd-doc.ts`.
- `.bangiao/hieu-nang.md` — kết quả đo (Bước 7).

**Sửa**
- `src/server/repo/index.ts`, `src/server/repo/mock-repo.ts` (chỉ thêm 2 dòng cuối file), `src/server/queries.ts` 🔥,
  `src/server/report.ts`, `src/server/overdue-scorecard.ts`, `src/server/audit-log-page.ts` (+ viết lại `.test.ts`),
  `app/[locale]/(app)/projects/[id]/page.tsx`, `app/[locale]/(app)/overview/page.tsx`, `app/[locale]/(app)/admin/page.tsx`,
  `app/[locale]/(app)/data-schema/page.tsx`, `app/[locale]/(app)/data-dictionary/page.tsx`, `src/lib/data-schema.ts`,
  `src/server/projects-detail-page-render.test.ts`, `src/i18n/messages/vi.json` 🔥, `en.json` 🔥, `package.json` (chỉ thêm scripts),
  `docs/DATA_WAREHOUSE_README.md`.

**Xoá:** `src/components/project/ManpowerDailyChart.tsx` (Bước 3 — bị chart tuần mới thay). Giữ nguyên `getManpowerDaily`
trong `project-queries.ts` và `src/lib/daily-series.ts` (không sửa file nóng; test cũ vẫn chạy).

## 3. Quy ước copy từ file có sẵn

| Việc | Copy quy ước từ |
|---|---|
| Hàm repo Prisma: map `Date` → `'YYYY-MM-DD'` bằng `toISOString().slice(0,10)`, tham số ngày `new Date(`${s}T00:00:00Z`)` | `src/server/repo/prisma-repo.ts` (hàm `day`, `dayStart`, `getDailyManpower`) |
| Test repo Prisma: `vi.hoisted` + `vi.mock('@/server/db', …)` | `src/server/repo/prisma-repo-key-milestones.test.ts` |
| Test tầng query dùng mock repo: `vi.mock('@/server/repo', async () => ({ repo: (await import('@/server/repo/mock-repo')).repo }))`, `vi.spyOn(repo, …)` | `src/server/project-queries.test.ts` |
| Test component: `renderToStaticMarkup` + mock `next-intl` trả key | `src/components/project/ResourceBreakdownChart.test.ts` |
| Test render trang Chi tiết | `src/server/projects-detail-page-render.test.ts` |
| Chart Recharts (tokens, `TOOLTIP_STYLE`, `.seg`, trạng thái rỗng `<p className="empty">`) | `src/components/project/ManpowerDailyChart.tsx` |
| SVG tự vẽ + tooltip `ChartTip`/`useChartTip` + trục thời gian | `src/components/project/StageTimelineChart.tsx`, `src/lib/stage-timeline.ts` (`xOf`) |
| Bảng màu chuỗi theo thứ tự | `src/lib/tracking.ts` (`EQUIPMENT_COLORS`, `equipmentColor`) |
| `<select>` nhỏ trong thẻ | `src/components/dashboard/FilterBar.tsx` (`className="inp"`, style `{ width:'auto', padding:'6px 10px', fontSize:'var(--t-caption1)' }`) |
| Card + tiêu đề + chú thích | trang `projects/[id]/page.tsx` (`Card`, `CardHeader` title/titleExtra/action, `Legend`, `HelpTip`) |
| Kiểm quyền trang admin | `app/[locale]/(app)/data-schema/page.tsx` (giữ nguyên khối redirect) |
| Chú thích trong SQL/migration viết không dấu | `prisma/migrations/20260924090000_p1a_data_foundation/migration.sql` |

---

## 4. Interface dùng chung — `src/server/repo/read-types.ts` (Bước 1 tạo, Bước 5–6 bổ sung)

```ts
import type { ActivityLogEntry, AuditLogEntry, FactProgressMonthly, ProjectEquipmentPlan, Shift } from './types';

/** Nhân lực theo tháng × nhà thầu × ca (đã cộng các ngày). days = số ngày có dòng của ca đó. */
export interface ShiftMonthRow { yearMonth: string; contractorId: number; shiftCode: string; planned: number; actual: number; days: number }
/** Nhân lực theo tuần ISO (Thứ 2) × nhà thầu, đã cộng mọi ca + mọi ngày trong tuần. */
export interface WeekContractorRow { weekStart: string; contractorId: number; planned: number; actual: number }
export interface DateRange { from: string; to: string } // 'YYYY-MM-DD', from <= to
/** Thiết bị dùng thực tế theo nhóm × ngày, đã cộng ngang nhà thầu; chỉ dòng qtyActual > 0. */
export interface EquipmentUsageDay { equipmentId: number; workDate: string; qtyActual: number }

// --- Bước 5 (T1) ---
export type FactSnapshot = Pick<FactProgressMonthly,
  'projectId' | 'yearMonth' | 'pctActual' | 'bac' | 'pv' | 'ev' | 'ac' | 'spi' | 'cpi' | 'bottleneckStage'>;
export interface FinancialSnapshot { projectId: number; yearMonth: string; revenuePeriod: number; arOverdue: number }
export interface VolumeSnapshot { projectId: number; factoryId: number; yearMonth: string; tonnageProcessed: number }
export interface MonthlyEvmRow { yearMonth: string; pv: number; ev: number; ac: number; spiAvg: number | null; cpiAvg: number | null }
// --- Bước 6 (T1) ---
export interface AuditLogPageResult { items: AuditLogEntry[]; total: number; page: number; totalPages: number; pageSize: number }

export interface ReadRepo {
  // Bước 1
  readShifts(): Promise<Shift[]>;                                                   // mọi ca, sortOrder tăng
  readManpowerByShiftMonth(projectId: number): Promise<ShiftMonthRow[]>;            // sort yearMonth, contractorId, shiftCode
  readManpowerWeekly(projectId: number): Promise<WeekContractorRow[]>;              // sort weekStart, contractorId
  readManpowerRange(projectId: number): Promise<DateRange | null>;                  // min/max workDate; không có dòng → null
  readEquipmentPlans(projectId: number): Promise<ProjectEquipmentPlan[]>;           // sort equipmentId, unitNo, plannedStart, id
  readEquipmentUsageDays(projectId: number, from: string, to: string): Promise<EquipmentUsageDay[]>; // sort equipmentId, workDate
  // Bước 5
  readFactSnapshots(yearMonth: string): Promise<FactSnapshot[]>;         // 'all' = bản isLatest của THÁNG MỚI NHẤT mỗi dự án
  readFinancialSnapshots(yearMonth: string): Promise<FinancialSnapshot[]>; // như trên cho fact_financial
  readVolumeSnapshots(yearMonth: string): Promise<VolumeSnapshot[]>;       // 'all' = tháng mới nhất mỗi (projectId, factoryId)
  readMonthlyEvm(months: string[], projectIds: number[]): Promise<MonthlyEvmRow[]>; // chỉ isLatest; tháng không có dòng → không trả
  // Bước 6
  readLastAuditAt(): Promise<string | null>;                                 // ISO; bảng rỗng → null
  readActivitySince(since: Date): Promise<ActivityLogEntry[]>;               // createdAt >= since, mới nhất trước
  readAuditLogPage(opts: { since: Date | null; page: number; pageSize: number }): Promise<AuditLogPageResult>;
}
```
Tên hàm đều bắt đầu bằng `read` để **không trùng** hàm nào của `prisma-repo.ts` (kể cả hàm A sắp thêm ở P2A).

---

## Bước 1 — Read repo nền (T12b/T14 dùng) + nối vào `repo`

**Files:** tạo `read-types.ts`, `read-prisma.ts`, `read-prisma.test.ts`, `read-mock.ts`, `read-mock.test.ts`,
`scripts/check-read-parity.ts`; sửa `src/server/repo/index.ts`, `src/server/repo/mock-repo.ts`, `package.json`.

- [ ] **1.1** `read-types.ts`: đúng phần "Bước 1" ở mục 4 (phần Bước 5/6 thêm sau).
- [ ] **1.2** `read-prisma.ts`: `import { Prisma } from '@prisma/client'; import { prisma } from '@/server/db';`
  `export const readRepoPrisma = { … } satisfies Pick<ReadRepo, …các hàm Bước 1…>` (Bước 5/6 đổi thành `satisfies ReadRepo`).
  SQL (dùng `prisma.$queryRaw<…>(Prisma.sql\`…\`)`, mọi SUM/COUNT ép `::int` để không nhận BigInt):
  ```sql
  -- readManpowerByShiftMonth
  SELECT to_char(m."workDate",'YYYY-MM') AS "yearMonth", m."contractorId", m."shiftCode",
         SUM(m."plannedHeadcount")::int AS planned, SUM(m."actualHeadcount")::int AS actual, COUNT(*)::int AS days
  FROM "fact_daily_manpower" m WHERE m."projectId" = ${projectId}
  GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
  -- readManpowerWeekly (date_trunc('week') = Thu 2 ISO; khong join dim_date de khong rot ngay ngoai 2020-2035)
  SELECT to_char(date_trunc('week', m."workDate"),'YYYY-MM-DD') AS "weekStart", m."contractorId",
         SUM(m."plannedHeadcount")::int AS planned, SUM(m."actualHeadcount")::int AS actual
  FROM "fact_daily_manpower" m WHERE m."projectId" = ${projectId}
  GROUP BY 1, 2 ORDER BY 1, 2;
  -- readManpowerRange
  SELECT to_char(MIN("workDate"),'YYYY-MM-DD') AS "from", to_char(MAX("workDate"),'YYYY-MM-DD') AS "to"
  FROM "fact_daily_manpower" WHERE "projectId" = ${projectId};          -- from null -> tra null
  -- readEquipmentUsageDays
  SELECT "equipmentId", to_char("workDate",'YYYY-MM-DD') AS "workDate", SUM("qtyActual")::int AS "qtyActual"
  FROM "fact_daily_equipment_usage"
  WHERE "projectId" = ${projectId} AND "workDate" BETWEEN ${from}::date AND ${to}::date
  GROUP BY 1, 2 HAVING SUM("qtyActual") > 0 ORDER BY 1, 2;
  ```
  `readShifts`: `prisma.shift.findMany({ orderBy: { sortOrder: 'asc' } })`.
  `readEquipmentPlans`: `prisma.projectEquipmentPlan.findMany({ where: { projectId }, orderBy: [{ equipmentId: 'asc' }, { unitNo: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }] })`
  → map `plannedStart/plannedFinish` → `'YYYY-MM-DD'`, `updatedAt` → ISO đầy đủ.
- [ ] **1.3** `read-mock.ts`: `export function createReadMock(getData: () => RepoData)` trả object cùng tên hàm, tất cả `async`,
  tính trên `getData().dailyManpowerShifts`, `.dailyEquipment`, `.equipmentPlans`, `.shifts`; cùng thứ tự sort như SQL.
  Tuần = `bucketOf(date,'week').from` (`src/lib/daily-series.ts`). Trả **bản sao** (không trả tham chiếu mảng gốc).
- [ ] **1.4** `src/server/repo/index.ts` thay toàn bộ nội dung:
  ```ts
  import { repo as prismaRepo } from './prisma-repo';
  import { readRepoPrisma } from './read-prisma';
  /** P2B: gộp read repo vào repo (mutate object gốc) - tầng trên chỉ import `repo` như cũ. */
  export const repo = Object.assign(prismaRepo, readRepoPrisma);
  export type * from './types';
  export type * from './read-types';
  ```
- [ ] **1.5** `mock-repo.ts`: KHÔNG sửa gì ở giữa file; chỉ thêm `import { createReadMock } from './read-mock';` ở khối import và
  ở **cuối file**: `Object.assign(repo, createReadMock(getData));` (kèm 1 dòng chú thích như 1.4).
- [ ] **1.6** `scripts/check-read-parity.ts` (chạy tay, không nằm trong vitest): gọi từng hàm Bước 1 của `readRepoPrisma` và của
  `createReadMock(() => buildRepoData())` với projectId 1 và 17, (usage: from/to = min start/max finish của plan dự án 1), so sánh
  bằng `JSON.stringify` sau khi sort; khác → in diff + `process.exit(1)`. `package.json` thêm
  `"check:read": "tsx scripts/check-read-parity.ts"`. Chạy trên DB đã `npx prisma db seed` (seed mặc định, cùng `DDC_FAKE_TODAY` lúc seed).

**Trường hợp biên:** dự án không có dòng → mảng rỗng / `null`; plan có `workItemId = null` giữ `null`; ngày ra đúng
`'YYYY-MM-DD'` (không lệch múi giờ — SQL dùng `to_char`, findMany dùng `toISOString().slice(0,10)`).

**Test:**
- `read-prisma.test.ts` (mock `@/server/db` với `$queryRaw`, `shift.findMany`, `projectEquipmentPlan.findMany`): mỗi hàm gọi đúng
  1 lần; `Prisma.Sql` truyền vào có `.values` chứa `projectId` (và `from`,`to`); `readManpowerRange` nhận `[{from:null,to:null}]` → `null`;
  map Date → `'YYYY-MM-DD'` cho plan. Thêm test: `Object.keys(readRepoPrisma)` không giao với `Object.keys(repo từ './prisma-repo')`.
- `read-mock.test.ts` (dữ liệu `buildRepoData()`): dự án 1 — `readManpowerByShiftMonth` có đúng các `shiftCode` của seed, tổng
  `actual` của mọi dòng = tổng `actualHeadcount` các dòng `dailyManpowerShifts` của dự án 1; `readManpowerWeekly` mọi `weekStart`
  là Thứ 2; `readEquipmentPlans(1)` dài 6, sort đúng; `readEquipmentUsageDays` không có dòng `qtyActual = 0`; dự án 17 → rỗng/null.

**Nghiệm thu:** tsc + test xanh; `npm run check:read` in "OK" trên `ddc_control_tower_b`.
**Commit:** `feat(p2b): read repo doc tong hop nhan luc theo ca-tuan, ke hoach thiet bi`

---

## Bước 2 — T12b (a) Chart nhân lực theo ca × nhà thầu (theo đề xuất Q2)

**Files:** tạo `src/lib/manpower-charts.ts` (+test) [phần ca], `src/server/manpower-queries.ts` (+test) [phần ca],
`src/components/project/ShiftManpowerChart.tsx` (+test); sửa trang Chi tiết, `vi.json`, `en.json`, test render trang.

- [ ] **2.1** `src/lib/manpower-charts.ts`:
  ```ts
  export interface ShiftInfo { code: string; name: string; sortOrder: number; isActive: boolean }
  export interface ContractorInfo { id: number; name: string }
  export interface ShiftBarDatum {
    contractorId: number; name: string;
    actual: Record<string, number>;   // shiftCode -> TT TB/ngày (làm tròn số nguyên)
    planned: Record<string, number>;  // shiftCode -> KH TB/ngày
    days: Record<string, number>;     // shiftCode -> số ngày có số liệu
  }
  /** Các tháng có số liệu + pageMonth, giảm dần, không trùng. */
  export function shiftChartMonths(rows: ShiftMonthRow[], pageMonth: string): string[];
  /** Ca hiển thị của tháng: ca isActive + ca có trong rows tháng đó (mã lạ không có trong shifts → name = code, sortOrder = 999). */
  export function shiftsForMonth(rows: ShiftMonthRow[], yearMonth: string, shifts: ShiftInfo[]): ShiftInfo[];
  export function buildShiftBars(rows: ShiftMonthRow[], yearMonth: string, contractors: ContractorInfo[]): ShiftBarDatum[];
  ```
  `buildShiftBars`: chỉ dòng `yearMonth` đó; TB = `Math.round(sum / days)` (days ≥ 1 luôn đúng vì có dòng); nhà thầu không có
  trong `contractors` → name `#<id>`; sort theo tổng `actual` các ca giảm dần, rồi `name.localeCompare(b, 'vi')`.
- [ ] **2.2** `src/server/manpower-queries.ts`:
  ```ts
  export interface ShiftChartData { shifts: ShiftInfo[]; contractors: ContractorInfo[]; rows: ShiftMonthRow[] }
  export async function getShiftChartData(projectId: number, locale: string): Promise<ShiftChartData>;
  ```
  `rows = repo.readManpowerByShiftMonth(projectId)`; `shifts = repo.readShifts()` map `name = locale === 'vi' ? nameVi : nameEn`;
  `contractors` = `repo.getContractors()` (tất cả) lọc theo id có trong rows. Import `repo` từ `./repo` (như `project-queries.ts`).
  Không tự kiểm quyền — chỉ được gọi từ trang đã `requireProjectRead` (ghi JSDoc câu này).
- [ ] **2.3** `ShiftManpowerChart.tsx` (`'use client'`), props `{ data: ShiftChartData; initialMonth: string }`:
  - `<select className="inp">` tháng (option = `shiftChartMonths(rows, initialMonth)`, nhãn `MM/YYYY`), state mặc định `initialMonth`.
  - Recharts `ResponsiveContainer` cao 260 → `BarChart data={buildShiftBars(...)}`; `XAxis dataKey="name"`; mỗi ca trong
    `shiftsForMonth` 1 `<Bar dataKey={(d: ShiftBarDatum) => d.actual[code] ?? 0} name={shift.name} fill={màu}>`; màu ca thứ i
    = `[c.actual, c.third, c.cost, c.plan, c.thirdLt, c.neutral, c.accent2][i % 7]` (`useChartTokens`).
  - Tooltip tuỳ biến (`content`): mỗi ca 1 dòng `"<tên ca>: TT x · KH y (z%) · n ngày"` (z = `Math.round(x/y*100)`, y = 0 → "-").
  - Tháng không có dòng → `<p className="empty">{t('manpowerCharts.noDataMonth', { month: 'MM/YYYY' })}</p>` (select vẫn hiện).
- [ ] **2.4** Trang Chi tiết: thêm `const shiftChart = await getShiftChartData(id, locale);` + `dynamic(() => import(...ShiftManpowerChart), { ssr: false, loading: sk h-60 })`.
  Chèn thẻ **ngay SAU khối `WeeklyTrackingCard`/thẻ tracking rỗng**, TRƯỚC thẻ "Biểu đồ nhân lực" cuối trang:
  ```tsx
  <Card id="res-shift" style={{ scrollMarginTop: 72 }}>
    <CardHeader title={t('manpowerCharts.shiftTitle')} titleExtra={<HelpTip text={t('manpowerCharts.shiftHelp')} label={t('common.explain')} />} />
    <CardBody><ShiftManpowerChart data={shiftChart} initialMonth={month} /></CardBody>
  </Card>
  ```
  **Không** đổi `id="res-manpower"` / `id="res-equipment"` / `href="#res-…"` của thẻ KPI (P1B).
- [ ] **2.5** i18n — thêm ở cuối `vi.json`:
  `"manpowerCharts": { "shiftTitle": "Nhân lực theo ca · theo nhà thầu", "shiftHelp": "Mỗi nhà thầu 1 nhóm cột, mỗi ca 1 cột. Chiều cao = nhân lực thực tế trung bình mỗi ngày có số liệu của ca đó trong tháng.", "month": "Tháng", "noDataMonth": "Chưa có số liệu nhân lực tháng {month}", "tipLine": "TT {actual} · KH {planned} ({pct}) · {days} ngày" }`;
  `en.json`: `"manpowerCharts": { "shiftTitle": "Manpower by shift · by contractor", "shiftHelp": "One column group per contractor, one column per shift. Height = average actual headcount per recorded day of that shift in the month.", "month": "Month", "noDataMonth": "No manpower data for {month}", "tipLine": "Actual {actual} · Plan {planned} ({pct}) · {days} days" }`.

**Trường hợp biên:** tháng chưa có số liệu (vd tháng hiện tại chưa nhập) → trạng thái rỗng, vẫn chọn được tháng khác; dự án
không có dòng nào → select chỉ có `initialMonth` + trạng thái rỗng; ca mới thêm vào `dim_shift` (vd ca tối) → tự thêm cột, không
sửa code; ca `isActive=false` nhưng còn số liệu cũ → vẫn hiện; KH = 0 → tỷ lệ "-".

**Test:**
- `manpower-charts.test.ts`: `shiftChartMonths` (giảm dần, có pageMonth dù không có dữ liệu, không trùng); `shiftsForMonth`
  (ca lạ `x` → name `'x'`; ca inactive có dữ liệu vẫn có; ca inactive không dữ liệu bị bỏ; sort theo sortOrder);
  `buildShiftBars` (TB làm tròn: sum 25 / days 2 → 13; nhà thầu thiếu tên → `#9`; sort giảm dần tổng actual).
- `manpower-queries.test.ts` (mock repo): dự án 1 tháng seed → `shifts` tên theo locale `'vi'`/`'en'`; `contractors` chỉ gồm nhà thầu có dòng.
- `ShiftManpowerChart.test.ts`: tháng không dữ liệu → có `manpowerCharts.noDataMonth`; có `<select` với option tháng.
- `projects-detail-page-render.test.ts` thêm: có `id="res-shift"` và `manpowerCharts.shiftTitle`; vẫn có `href="#res-manpower"` +
  `id="res-manpower"`.

**Nghiệm thu:** tsc + test xanh; mở `http://localhost:3001/vi/projects/1` thấy chart ca tháng 09/2026 (dữ liệu seed), đổi tháng
không lỗi console. **Commit:** `feat(p2b): T12b chart nhan luc theo ca theo nha thau`

---

## Bước 3 — T12b (b) Chart cột chồng theo tuần × nhà thầu, lọc tháng, kéo toàn timeline (theo đề xuất Q3, Q4, Q5)

**Files:** thêm vào `manpower-charts.ts` (+test), `manpower-queries.ts` (+test); tạo `WeeklyManpowerStackChart.tsx` (+test);
sửa trang Chi tiết, `vi.json`, `en.json`, test render trang; **xoá** `ManpowerDailyChart.tsx`.

- [ ] **3.1** `manpower-charts.ts` thêm:
  ```ts
  export interface ProjectDates { plannedStartDate: string | null; plannedFinishDate: string | null; actualStartDate: string | null; actualFinishDate: string | null }
  /** Q5: đầu = actualStart ?? plannedStart, cuối = actualFinish ?? plannedFinish (cắt 'YYYY-MM-DD'), nới cho chứa dataRange;
   *  thiếu đầu hoặc cuối → lấy từ dataRange; không có gì → null. Nếu đầu > cuối → đổi chỗ. */
  export function projectTimeline(p: ProjectDates, dataRange: DateRange | null): DateRange | null;
  export interface WeekBucket {
    weekStart: string; weekEnd: string;     // Thứ 2 / Chủ nhật
    label: string;                           // 'dd/mm' của Thứ 2 (formatDayMonth)
    days: number;                            // số ngày của tuần nằm trong range (1..7)
    actualByContractor: Record<number, number>; // TB/ngày = Math.round(sum / days)
    actualAvg: number; plannedAvg: number;  // tổng mọi nhà thầu, TB/ngày
  }
  /** Mọi tuần từ Thứ 2 của range.from tới Thứ 2 của range.to (kể cả tuần không có dòng → 0). */
  export function buildWeeklyStack(rows: WeekContractorRow[], range: DateRange): WeekBucket[];
  /** Chỉ số các tuần giao với tháng (weekStart <= cuối tháng && weekEnd >= ngày 1). */
  export function weeksInMonth(weeks: WeekBucket[], yearMonth: string): number[];
  /** Các tháng mà timeline đi qua, tăng dần. */
  export function timelineMonths(range: DateRange): string[];
  ```
  `days` = `daysBetween(max(weekStart, range.from), min(weekEnd, range.to)) + 1` (`daysBetween` từ `src/lib/clock.ts`).
  `actualAvg` = `Math.round(Σ actual các nhà thầu / days)` (cộng thô rồi chia, không cộng các số đã làm tròn).
- [ ] **3.2** `manpower-queries.ts` thêm:
  ```ts
  export interface WeeklyChartData { contractors: ContractorInfo[]; weeks: WeekBucket[]; range: DateRange }
  export async function getWeeklyChartData(projectId: number, project: ProjectDates): Promise<WeeklyChartData | null>;
  ```
  `range = projectTimeline(project, await repo.readManpowerRange(projectId))`; `null` → trả `null`. Không có dòng nhân lực nào
  (range lấy thuần từ ngày dự án nhưng rows rỗng) → vẫn trả `null` (trạng thái rỗng). `contractors` sort theo tổng actual giảm dần
  (thứ tự chồng cột + màu ổn định).
- [ ] **3.3** `WeeklyManpowerStackChart.tsx` (`'use client'`), props `{ data: WeeklyChartData; initialMonth: string }`:
  - Thanh điều khiển: `<select className="inp">` = `"all"` (nhãn `t('manpowerCharts.allMonths')`) + `timelineMonths(range)`
    (`MM/YYYY`); mặc định `initialMonth` nếu nằm trong timeline, không thì `"all"`. Dòng gợi ý `t('manpowerCharts.scrollHint')`.
  - Khung cuộn: `<div ref tabIndex={0} role="region" aria-label={t('manpowerCharts.weeklyTitle')} style={{ overflowX: 'auto' }}>`,
    bên trong `ComposedChart width={Math.max(containerWidth, weeks.length * 44)} height={280}` (đo `containerWidth` bằng
    `ResizeObserver`, lần đầu 800). Mỗi nhà thầu 1 `<Bar stackId="a" dataKey={(w) => w.actualByContractor[id] ?? 0}>` màu
    `palette[i % 7]` (palette như Bước 2), mỗi `<Cell>` có `fillOpacity` = 1 nếu tuần thuộc tháng đang chọn hoặc chọn `"all"`,
    ngược lại 0.35. Theo Q3: `<Line dataKey="plannedAvg" name={t('manpowerCharts.plannedLine')} stroke={c.plan} dot={false} />`.
  - Tooltip: tiêu đề `t('manpowerCharts.weekOf', { from: dd/mm, to: dd/mm })` + `t('manpowerCharts.days', { n })` (khi days < 7
    cho người xem biết đã chia số ngày thực có); từng nhà thầu TT; tổng TT; KH.
  - Kéo: `onPointerDown/Move/Up` trên khung → `scrollLeft -= deltaX` (chỉ khi nút chính đang nhấn, `setPointerCapture`).
    Phím: `ArrowLeft/ArrowRight` → cuộn ±44px, `Home/End` → đầu/cuối (chặn `preventDefault`).
  - Đổi tháng → `scrollLeft = index tuần đầu của weeksInMonth × 44` (clamp); mount lần đầu: tháng được chọn → cuộn tới đó,
    `"all"` → cuộn tới cuối.
  - `data.weeks.length === 0` không xảy ra (query trả null); phòng hờ: trạng thái rỗng `manpowerCharts.noData`.
- [ ] **3.4** Trang Chi tiết: bỏ `dynamic` `ManpowerDailyChart`, bỏ `getManpowerDaily` khỏi import + lời gọi; thay thẻ cuối trang
  "Biểu đồ nhân lực KH vs TT" bằng:
  ```tsx
  <Card id="res-weekly" style={{ scrollMarginTop: 72 }}>
    <CardHeader title={t('manpowerCharts.weeklyTitle')} titleExtra={<HelpTip text={t('manpowerCharts.weeklyHelp')} label={t('common.explain')} />} />
    <CardBody>{weekly ? <WeeklyManpowerStackChart data={weekly} initialMonth={month} /> : <p className="empty">{t('manpowerCharts.noData')}</p>}</CardBody>
  </Card>
  ```
  với `const weekly = await getWeeklyChartData(id, project);` (Project có đủ 4 trường ngày). Xoá file `ManpowerDailyChart.tsx`.
- [ ] **3.5** i18n thêm vào nhóm `manpowerCharts` (vi / en):
  `weeklyTitle` "Nhân lực theo tuần · theo nhà thầu" / "Weekly manpower · by contractor";
  `weeklyHelp` "Cột = nhân lực thực tế trung bình mỗi ngày trong tuần, chồng theo nhà thầu. Tuần đầu/cuối dự án không đủ 7 ngày thì chia cho số ngày thực có. Ngày không nhập số liệu tính là 0." /
  "Bars = average actual headcount per day of the week, stacked by contractor. The first/last project week is divided by its actual number of days. Days without data count as 0.";
  `allMonths` "Toàn dự án" / "Whole project"; `plannedLine` "KH (TB/ngày)" / "Plan (avg/day)";
  `weekOf` "Tuần {from} - {to}" / "Week {from} - {to}"; `days` "{n} ngày" / "{n} days";
  `scrollHint` "Kéo ngang hoặc dùng phím ← → để xem toàn bộ timeline" / "Drag or use ← → keys to see the whole timeline";
  `noData` "Chưa có số liệu nhân lực theo ngày" / "No daily manpower data yet"; `total` "Tổng TT" / "Total actual".

**Trường hợp biên (phải có test):** dự án bắt đầu Thứ 4 → tuần đầu `days = 5`, TB = sum/5; kết thúc Thứ 3 → tuần cuối `days = 2`;
đầu và cuối cùng 1 tuần (dự án < 7 ngày) → 1 tuần, `days` = số ngày thật; tuần giữa không có dòng → có cột 0, `days = 7`; ngày số
liệu trước `actualStartDate` → range nới ra, không mất dữ liệu; dự án thiếu mọi ngày KH/TT → dùng range dữ liệu; tháng chọn nằm
ngoài timeline → mặc định `"all"`; tuần vắt qua 2 tháng thuộc cả 2 tháng khi lọc.

**Test:**
- `manpower-charts.test.ts`: `projectTimeline` (4 ca: có actual, chỉ planned, nới theo dataRange, không có gì → null, đầu > cuối
  đổi chỗ); `buildWeeklyStack` (các biên ở trên, số tuần đúng, weekStart là Thứ 2, `actualAvg` = round(Σ/ days));
  `weeksInMonth` (tuần 28/09–04/10/2026 thuộc cả 2026-09 và 2026-10); `timelineMonths`.
- `manpower-queries.test.ts`: dự án 1 → `weeks.length ≥ 1`, tổng `actualAvg × days` của tuần cuối có số liệu khớp tổng actual thô
  (sai số làm tròn ≤ days); dự án 17 → `null`.
- `WeeklyManpowerStackChart.test.ts`: render có `role="region"`, `<select` có option `all`.
- `projects-detail-page-render.test.ts`: có `id="res-weekly"`, `manpowerCharts.weeklyTitle`; **không còn** `detail.manpowerTrend`.

**Nghiệm thu:** tsc + test xanh; trên `/vi/projects/1` kéo chuột + phím ←/→ cuộn được, đổi tháng tự cuộn + làm mờ đúng.
**Commit:** `feat(p2b): T12b chart cot chong nhan luc theo tuan theo nha thau, loc thang, keo timeline`

---

## Bước 4 — T14 Gantt thiết bị (theo đề xuất Q1 = b)

**Files:** tạo `src/lib/equipment-gantt.ts` (+test), `src/server/equipment-gantt-queries.ts` (+test),
`src/components/project/EquipmentGantt.tsx` (+test); sửa trang Chi tiết, `vi.json`, `en.json`, test render trang.

- [ ] **4.1** `src/lib/equipment-gantt.ts`:
  ```ts
  export interface GanttBar { planId: number; start: string; finish: string; workItemId: number | null; workItemName: string;
    color: string; rangeLabel: string /* 'dd/mm - dd/mm' */; planDays: number; usedDays: string[] /* tăng dần */ }
  export interface GanttRow { key: string /* `${equipmentId}-${unitNo}` */; equipmentId: number; unitNo: number; label: string; bars: GanttBar[] }
  export interface GanttLegendItem { key: string; name: string; color: string }
  export interface GanttModel { rows: GanttRow[]; legend: GanttLegendItem[]; from: string /* Thứ 2 */; to: string /* Chủ nhật */;
    ticks: string[] /* mọi Thứ 2 trong [from,to] */; planFrom: string; planTo: string; unplannedUsage: number }
  export interface GanttInput { plans: ProjectEquipmentPlan[]; usage: EquipmentUsageDay[];
    equipments: { id: number; name: string }[]; workItems: { id: number; name: string; sortOrder: number }[]; noWorkItemName: string }
  export function buildGantt(input: GanttInput): GanttModel | null;           // plans rỗng → null
  /** Q1(b): trả planId → ngày dùng, và số lượt thiết bị-ngày không gán được. */
  export function assignUsage(plans: ProjectEquipmentPlan[], usage: EquipmentUsageDay[]): { byPlan: Map<number, string[]>; unplanned: number };
  ```
  Quy tắc:
  - Hàng = mỗi cặp (`equipmentId`, `unitNo`) có trong plans, sort `equipmentId` rồi `unitNo`. Nhãn = tên thiết bị (không có trong
    `equipments` → `#<id>`) + `' No.' + unitNo` **nếu** nhóm đó có > 1 chiếc trong dự án **hoặc** `unitNo !== 1`; ngược lại chỉ tên
    (giống ảnh mẫu "Cẩu 800T" không có No.).
  - 1 hàng có thể nhiều thanh (nhiều dòng plan của cùng chiếc), sort theo `start`.
  - Màu = `EQUIPMENT_COLORS[chỉ số hạng mục trong workItems sort theo sortOrder % 7]` (`src/lib/tracking.ts`); `workItemId` null
    hoặc không còn trong workItems → `'var(--s-neutral)'` + tên `noWorkItemName`.
  - Legend = các hạng mục có trong plans theo sortOrder, cuối cùng là "chưa gán" nếu có.
  - `from` = Thứ 2 của min(start), `to` = Chủ nhật của max(finish) (`bucketOf` trong `daily-series.ts`); `planFrom/planTo` = min start / max finish.
  - `planDays = daysBetween(start, finish) + 1`; `rangeLabel = formatDayMonth(start) + ' - ' + formatDayMonth(finish)`.
  - `assignUsage` (Q1 b): với mỗi dòng usage (equipmentId, ngày d, N): ứng viên = các `unitNo` KHÁC NHAU của nhóm đó có plan phủ
    d (`start ≤ d ≤ finish`), sort `unitNo` tăng; chọn `k = min(N, số ứng viên)` chiếc đầu; mỗi chiếc được chọn gán d vào plan phủ d
    có `id` nhỏ nhất của chiếc đó; `unplanned += N − k`.
- [ ] **4.2** `src/server/equipment-gantt-queries.ts`:
  `export async function getEquipmentGantt(projectId: number, noWorkItemName: string): Promise<GanttModel | null>` —
  `plans = repo.readEquipmentPlans(projectId)`; rỗng → `null`; `usage = repo.readEquipmentUsageDays(projectId, minStart, maxFinish)`;
  `equipments = repo.getEquipments()`; `workItems = repo.getWorkItems(projectId)`; trả `buildGantt(...)`. JSDoc: chỉ gọi sau `requireProjectRead`.
- [ ] **4.3** `EquipmentGantt.tsx` (`'use client'`), props `{ model: GanttModel }`. SVG `viewBox="0 0 1000 H"`, class `chart`,
  hằng số `W=1000, ML=190, MR=100, MT=30, ROW_H=34, BH=16, MB=8`, `IW = W-ML-MR`, `H = MT + rows*ROW_H + MB`.
  Trục: `X(d) = xOf(d, { from, to: addDaysIso(to,1), ticks: [] }, ML, IW)` (`src/lib/stage-timeline.ts`); đường lưới dọc mỗi tick
  (`stroke: var(--grid)`); nhãn tick `dd/mm` phía trên chỉ ở tick có `index % step === 0`, `step = Math.max(1, Math.ceil(ticks.length / 16))`.
  Mỗi hàng: nhãn trái (`fontSize 13, fontWeight 700, fill var(--label)`, `textAnchor="end"` tại x = ML − 10); mỗi thanh:
  `rect x=X(start) width=max(X(finish+1) − X(start), 3) height=BH rx=4 style={{ fill: color }} fillOpacity={0.38}`; mỗi ngày dùng:
  `rect x=X(d) width=max(X(d+1) − X(d), 1.5) height=BH style={{ fill: color }}` (đậm, cùng màu hạng mục). Nhãn `rangeLabel`
  (`fontSize 11, fill var(--label2)`): đặt ngay sau cuối thanh nếu khoảng trống tới thanh kế tiếp cùng hàng (hoặc tới W) ≥ 84;
  không đủ thì đặt **trong** thanh (chữ trắng, `textAnchor="end"`) nếu thanh rộng ≥ 84; không đủ nữa thì bỏ (tooltip vẫn có).
  Tooltip (`useChartTip`/`ChartTip`) khi rê thanh: tiêu đề = nhãn hàng; dòng: hạng mục, KH `dd/mm/yy → dd/mm/yy`
  (`formatDateShort`), số ngày KH, số ngày có dùng. Dưới SVG: nếu `unplannedUsage > 0` → `<p className="hintline">` với
  `t('equipmentGantt.unplanned', { n })`.
- [ ] **4.4** Trang Chi tiết: `const gantt = await getEquipmentGantt(id, t('equipmentGantt.noWorkItem'));` +
  `dynamic` EquipmentGantt (ssr:false). Thẻ đặt **ngay sau thẻ `res-weekly`** (cuối trang):
  ```tsx
  <Card id="eq-gantt" style={{ scrollMarginTop: 72 }} className="overflow-visible">
    <CardHeader title={t('equipmentGantt.title')}
      subtitle={gantt ? `${formatDate(gantt.planFrom, locale)} - ${formatDate(gantt.planTo, locale)}` : undefined}
      titleExtra={<HelpTip text={t('equipmentGantt.help')} label={t('common.explain')} />}
      action={gantt ? <Legend items={[...gantt.legend.map((l) => ({ label: l.name, color: l.color })), { label: t('equipmentGantt.legendUsed'), color: 'var(--label2)' }]} /> : undefined} />
    <CardBody>{gantt ? <EquipmentGantt model={gantt} /> : <p className="empty">{t('equipmentGantt.noPlan')}</p>}</CardBody>
  </Card>
  ```
- [ ] **4.5** i18n thêm ở cuối file, nhóm mới `"equipmentGantt"` (vi / en):
  `title` "Tiến độ sử dụng thiết bị theo tuần" / "Weekly equipment usage schedule";
  `help` "Mỗi hàng là 1 chiếc thiết bị. Thanh nhạt = kế hoạch sử dụng, màu theo hạng mục; ô đậm trên thanh = ngày thực tế có dùng (lấy từ số liệu thiết bị hằng ngày, gán cho các chiếc theo số thứ tự)." /
  "Each row is one equipment unit. Light bar = planned usage, coloured by work item; solid cells = days actually used (from daily equipment data, assigned to units in unit-number order).";
  `noPlan` "Chưa có kế hoạch thiết bị cho dự án này" / "No equipment plan for this project yet";
  `noWorkItem` "Chưa gán hạng mục" / "No work item"; `legendUsed` "Ô đậm = ngày có dùng" / "Solid = day used";
  `tipWorkItem` "Hạng mục" / "Work item"; `tipPlan` "Kế hoạch" / "Plan"; `tipPlanDays` "Số ngày KH" / "Planned days";
  `tipUsedDays` "Ngày có dùng" / "Days used";
  `unplanned` "{n} lượt thiết bị-ngày có dùng nhưng nằm ngoài kế hoạch (không vẽ)" / "{n} equipment-days used outside the plan (not drawn)".

**Trường hợp biên (phải có test):** plans rỗng → `null`; 1 chiếc 2 thanh liền nhau (seed: thiết bị 1 No.1 03/08–30/08 và
31/08–11/10) → 1 hàng 2 thanh; N=3 nhưng chỉ 2 chiếc có KH phủ ngày đó → gán 2, `unplanned += 1`; ngày dùng không có KH → chỉ
`unplanned`; 2 plan cùng chiếc chồng ngày → gán vào plan id nhỏ; `workItemId` null → màu neutral + legend "chưa gán"; thiết bị bị
tắt `isActive` → nhãn `#id`; nhóm chỉ 1 chiếc `unitNo=1` → nhãn không có "No."; ngày ra đúng Thứ 2/Chủ nhật.

**Test:** `equipment-gantt.test.ts` (dữ liệu tay + seed `equipmentPlanSeed`), `equipment-gantt-queries.test.ts` (mock repo: dự án 1
→ 5 hàng — thiết bị 1 No.1..3, thiết bị 2 No.1..2; dự án 17 → null), `EquipmentGantt.test.ts` (render có đủ nhãn hàng + ít nhất 1
`rangeLabel`), render trang: có `id="eq-gantt"` + `equipmentGantt.title`; dự án 17 có `equipmentGantt.noPlan`.

**Nghiệm thu:** tsc + test xanh; `/vi/projects/1` thấy 5 hàng, ô đậm ở 10–16/09/2026 trên chiếc có KH phủ ngày đó.
**Commit:** `feat(p2b): T14 gantt thiet bi theo tung chiec, danh dau ngay thuc te`

---

## Bước 5 — T1-code (a): tổng quan — bỏ N+1, dims 1 lần, bỏ nhánh `month=all` kéo cả bảng

**Files:** thêm hàm Bước 5 vào `read-types.ts`, `read-prisma.ts` (+test), `read-mock.ts` (+test); sửa `src/server/queries.ts` 🔥,
`src/server/report.ts`, `src/server/overdue-scorecard.ts`; test mới trong `src/server/queries-n1.test.ts`.

- [ ] **5.1** Read repo (SQL):
  ```sql
  -- readFactSnapshots('all')
  SELECT DISTINCT ON ("projectId") "projectId","yearMonth","pctActual","bac","pv","ev","ac","spi","cpi","bottleneckStage"
  FROM "fact_progress_monthly" WHERE "isLatest" = true ORDER BY "projectId", "yearMonth" DESC;
  -- readFinancialSnapshots('all'): cung mau, bang fact_financial, cot "projectId","yearMonth","revenuePeriod","arOverdue"
  -- readVolumeSnapshots('all')
  SELECT DISTINCT ON ("projectId","factoryId") "projectId","factoryId","yearMonth","tonnageProcessed"
  FROM "fact_volume" ORDER BY "projectId","factoryId","yearMonth" DESC;
  -- readMonthlyEvm (months/projectIds rong -> tra [] khong goi DB)
  SELECT "yearMonth", SUM("pv")::float8 AS pv, SUM("ev")::float8 AS ev, SUM("ac")::float8 AS ac,
         AVG("spi")::float8 AS "spiAvg", AVG("cpi")::float8 AS "cpiAvg"
  FROM "fact_progress_monthly"
  WHERE "isLatest" = true AND "yearMonth" = ANY(${months}::text[]) AND "projectId" = ANY(${projectIds}::int[])
  GROUP BY "yearMonth" ORDER BY "yearMonth";
  ```
  Tháng cụ thể (không phải `'all'`): dùng `findMany({ where: { yearMonth, isLatest: true } , select: {…đúng các cột…} })`
  (fact_volume không có isLatest: `where: { yearMonth }`). Mock: cùng ngữ nghĩa trên `getData().facts/financial/volumes`
  (facts/financial lọc `isLatest`; `'all'` = dòng có `yearMonth` lớn nhất mỗi khoá).
- [ ] **5.2** `queries.ts`:
  - `type Dims = Awaited<ReturnType<typeof repo.getDims>>`.
  - `summarize(project: Project, fact: FactSnapshot | undefined, dims: Dims): ProjectSummary` — **đồng bộ**, bỏ `repo.getDims()` bên trong, logic giữ nguyên.
  - `matchesGroup(p: Pick<Project, 'teamKdId' | 'projectType' | 'marketCode'>, groupKey: string, groupBy: GroupBy, dims: Dims): boolean` — đồng bộ.
  - `filterSummaries(summaries, filters, dims)` — dùng chính `ProjectSummary` (có `teamKdId`, `projectType`, `marketCode`), **bỏ `repo.getProject`**.
  - `getScopedProjectIds`: lấy `dims` 1 lần, gọi `matchesGroup` đồng bộ.
  - `getProjectSummaries(yearMonth, filters?)`:
    ```ts
    const [projects, dims, facts] = await Promise.all([repo.listProjects(), repo.getDims(), repo.readFactSnapshots(yearMonth)]);
    const byId = new Map(facts.map((f) => [f.projectId, f]));
    const summaries = projects.map((p) => summarize(p, byId.get(p.id), dims));
    return filters ? filterSummaries(summaries, filters, dims) : summaries;
    ```
  - `getProjectSummary`: `summarize(p, await repo.getLatestFact(projectId, yearMonth), await repo.getDims())` (giữ nguyên nguồn).
  - `getPortfolioKpis`: `curFacts/prevFacts` dùng `repo.readFactSnapshots` (chỉ cần `.length`).
  - `getTonnageValueByGroup`: bỏ `repo.getProject` trong vòng lặp; khoá nhóm team = `s.teamName`; dựng trước
    `Map<projectId, tổng tonnageProcessed>` từ `repo.readVolumeSnapshots(yearMonth)` và `Map<projectId, tổng revenuePeriod>` từ
    `repo.readFinancialSnapshots(yearMonth)`; bỏ `repo.getDims()` thừa.
  - `getCapacityData`: `repo.readVolumeSnapshots(yearMonth)`.
  - `getSpiCpiTrend` / `getPortfolioSCurve`: `rows = await repo.readMonthlyEvm(historyMonths(), [...ids])`, tra theo tháng; tháng
    không có dòng → `spi/cpi = null`, `pv/ev/ac = 0`; làm tròn y như cũ (`Math.round(x*100)/100` cho spi/cpi, `Math.round` cho pv/ev/ac).
  - `getMissingMonth`: `Map` từ `repo.readFactSnapshots(yearMonth)`, bỏ `getLatestFact` theo từng dự án.
  - `listProjects`/`exportProjects`: không đổi.
- [ ] **5.3** `report.ts`: `rows = (await getProjectSummaries(month)).map((s) => ({ id: s.id, code: s.currentAliasCode, name: s.projectName, spi: s.spi, cpi: s.cpi, pctActual: s.pctActual, backlog: s.status === 'Chuan_bi' ? s.contractValue : 0 }))`;
  bỏ `repo.listProjects()` + `repo.getLatestFact` (hết 2N). (`summary.spi/cpi` đã làm tròn 2 số giống hệt cách cũ.)
- [ ] **5.4** `overdue-scorecard.ts`: `repo.getFinancialForMonth` → `repo.readFinancialSnapshots` (2 chỗ), logic giữ nguyên.

**Trường hợp biên:** `month='all'` (giữ ngữ nghĩa cũ = tháng mới nhất của từng dự án); `month` rác `'abc'` → không dòng nào, như cũ;
dự án chưa có fact tháng đó → `summarize(p, undefined, dims)` như cũ; dự án `isActive=false` không vào summaries (listProjects đã lọc);
`readMonthlyEvm` với `ids` rỗng → `[]`, trend trả null/0 cho mọi tháng; fact có nhiều bản version → chỉ `isLatest`.

**Test:**
- **Hồi quy:** `queries.test.ts`, `project-queries.test.ts`, `overdue-scorecard.test.ts`, `report-export-route.test.ts` chạy
  NGUYÊN (không sửa kỳ vọng). Nếu phải sửa kỳ vọng nào → dừng, ghi lý do vào `.bangiao/thay-doi.md`.
- `queries-n1.test.ts` (mock repo + `vi.spyOn`): `getProjectSummaries('2026-09')` gọi `repo.getLatestFact` **0 lần**, `repo.getDims`
  **1 lần**, `repo.getProject` **0 lần** (cả khi có `filters.groupKey`); `getTonnageValueByGroup` gọi `repo.getProject` 0 lần;
  `getSpiCpiTrend({})` gọi `repo.getFactsForMonth` 0 lần và `repo.readMonthlyEvm` 1 lần; `getReportData` gọi `repo.getLatestFact` 0 lần.
- `read-mock.test.ts`: `readFactSnapshots('all')` mỗi dự án đúng 1 dòng = tháng lớn nhất; `readMonthlyEvm` so với cộng tay trên
  `buildRepoData().facts`.
- `read-prisma.test.ts`: nhánh `'all'` gọi `$queryRaw` (không gọi `findMany`); nhánh tháng gọi `findMany` với `where` đúng;
  `readMonthlyEvm([], …)` không gọi DB.

**Nghiệm thu:** tsc + test xanh; `npm run check:read` mở rộng thêm các hàm Bước 5 (tháng `currentMonth()` và `'all'`) → OK;
`/vi/overview` và `/vi/overview?month=all` hiện số như trước khi sửa (so bằng mắt 6 KPI + donut trên seed mặc định).
**Commit:** `perf(p2b): T1 tong quan - bo N+1, dims 1 lan, nhanh all bang DISTINCT ON, aggregate EVM trong DB`

---

## Bước 6 — T1-code (b): nhật ký + "Cập nhật lần cuối" + song song hoá trang Chi tiết

**Files:** thêm hàm Bước 6 vào read repo (+test); sửa `src/server/audit-log-page.ts` (+ viết lại test),
`app/[locale]/(app)/overview/page.tsx`, `app/[locale]/(app)/admin/page.tsx`, `app/[locale]/(app)/projects/[id]/page.tsx`.

- [ ] **6.1** Read repo: `readLastAuditAt` = `prisma.auditLog.aggregate({ _max: { changedAt: true } })` → ISO | null;
  `readActivitySince(since)` = `prisma.activityLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } })`
  map giống `getActivity` trong `prisma-repo.ts`; `readAuditLogPage` = **chuyển nguyên** thân `getAuditLogPage` hiện tại
  (`count` + `findMany` skip/take, kẹp page) sang, nhận `since` thay vì `range`. Mock: tương đương trên `getData().auditLog/activityLog`.
- [ ] **6.2** `audit-log-page.ts`: giữ chữ ký `getAuditLogPage(opts: { page; range; pageSize?; now? })`, thân =
  `repo.readAuditLogPage({ since: logSince(opts.range, opts.now ?? new Date()), page: opts.page, pageSize: opts.pageSize ?? 20 })`;
  bỏ `import { prisma }`; sửa chú thích đầu file (index `audit_log_changedAt_idx` ĐÃ có từ migration P1A).
  Test cũ (mock `@/server/db`) chuyển sang `read-prisma.test.ts` cho `readAuditLogPage`; `audit-log-page.test.ts` mới dùng mock repo:
  range `14d` truyền `since` đúng `now − 14 ngày`, `all` → `since: null`, `pageSize` mặc định 20.
- [ ] **6.3** `overview/page.tsx` và `projects/[id]/page.tsx`: `lastUpdate = await repo.readLastAuditAt()` (bỏ `repo.getAuditLog()`).
- [ ] **6.4** `admin/page.tsx`: `activity = await repo.readActivitySince(logSince('14d', new Date())!)` (bỏ lọc trong bộ nhớ).
- [ ] **6.5** `projects/[id]/page.tsx`: sau `requireProjectRead` + `getProject` + `notFound()` (giữ thứ tự này), gom các lệnh đọc độc
  lập vào **1** `Promise.all`: `getProjectSummary, readLastAuditAt, getFacts, getValueChain, getFinancial, getAlerts, getAliases,
  getSapCodes, getPhotos, getDims, getResourceSnapshot, getResourceBreakdown, getWeeklyTracking, getKeyMilestones, getStageWeights,
  getStageMilestones, getWorkItemComparison, listProjects, getShiftChartData, getWeeklyChartData, getEquipmentGantt`. Không đổi
  hiển thị nào; `listProjects` lấy ra biến trước `return` (không `await` trong JSX nữa).

**Trường hợp biên:** audit_log rỗng → "-" như cũ; `page` vượt số trang → kẹp như cũ; activity rỗng → viewer hiện rỗng như cũ.

**Test:** `audit-log-page.test.ts` (viết lại), `read-prisma.test.ts` (3 hàm mới), `read-mock.test.ts`; toàn bộ test trang
(`projects-detail-page-*.test.ts`, `operation-pages-render.test.ts`, `pages-role-guard.test.ts`) xanh không sửa kỳ vọng.
Thêm vào `queries-n1.test.ts`: render trang Chi tiết (theo boilerplate `projects-detail-page-render.test.ts`) gọi `repo.getAuditLog` 0 lần.

**Commit:** `perf(p2b): T1 nhat ky loc trong DB, lastUpdate bang MAX, trang chi tiet doc song song`

---

## Bước 7 — T1-code (c): seed 10 triệu dòng giả + đo lặp lại được

**Files:** tạo `src/lib/perf-guard.ts` (+test), `scripts/perf/seed-perf.ts`, `scripts/perf/bench-data.ts`,
`scripts/perf/measure-pages.ts`, `.bangiao/hieu-nang.md`; sửa `package.json` (scripts).

- [ ] **7.1** `src/lib/perf-guard.ts`:
  ```ts
  export const PERF_DB = 'ddc_control_tower_b';
  export const PERF_PREFIX = 'PERF-';
  export const PERF_USER = 'perf-seed';               // audit_log.changedBy, dim_project.createdBy/updatedBy
  export const PERF_ACTIVITY_EMAIL = 'perf@seed.local';
  /** Ném Error nếu currentDb !== PERF_DB (chặn chạy nhầm DB của A 'ddc_control_tower' hay DB khác). */
  export function assertPerfDb(currentDb: string): void;
  export interface PerfOptions { projects: number; days: number; audit: number; activity: number; end: string; clean: boolean }
  /** Đọc argv: --projects=500 --days=730 --audit=1000000 --activity=100000 --end=YYYY-MM-DD --clean-only; kiểm số nguyên dương, end hợp lệ (isValidIsoDate). */
  export function parsePerfArgs(argv: string[], today: string): PerfOptions;
  /** Ước lượng số dòng sẽ sinh (để in trước khi chạy). */
  export function estimateRows(o: PerfOptions, contractors: number, shifts: number, equipments: number, stages: number): number;
  ```
  `estimateRows` = projects × (1 + 36×3 + 36×stages + contractors + 6 + contractors×days×shifts + contractors×equipments×days) + audit + activity.
- [ ] **7.2** `scripts/perf/seed-perf.ts` (tsx, dùng `prisma` từ `@/server/db`):
  1. `SELECT current_database()` → `assertPerfDb`. 2. Luôn **dọn trước**: `DELETE FROM "dim_project" WHERE "masterCode" LIKE 'PERF-%'`
  (cascade xoá fact/daily/plan/contractor link), `DELETE FROM "audit_log" WHERE "changedBy"='perf-seed'`,
  `DELETE FROM "activity_log" WHERE "userEmail"='perf@seed.local'`. `--clean-only` → dừng ở đây.
  3. Kiểm có `dim_currency.code='VND'`, ≥1 customer/team/factory, 6 contractor, ≥2 equipment, `dim_shift` active ≥1 — thiếu → báo
  "chạy npx prisma db seed trước" và thoát 1. 4. In `estimateRows`. 5. Sinh bằng `INSERT … SELECT … generate_series` (trong DB,
  không đẩy dữ liệu qua Node), theo lô 50 dự án (in tiến độ), cửa sổ ngày `S = end − (days−1)` … `end`, 36 tháng kết thúc ở tháng của `end`:
  - `dim_project` × projects: `masterCode = currentAliasCode = 'PERF-' || lpad(g,4,'0')`, customer/team luân phiên
    (`array_agg(id ORDER BY id)[1 + g % n]`), market/type/priority luân phiên qua mảng hằng + ép enum (`::"MarketCode"` …),
    `contractValue = 100 + g % 900`, `tonnage = 500 + g % 5000`, `currencyCode='VND'`, `plannedStartDate = actualStartDate = S`,
    `plannedFinishDate = end + 180`, `createdBy = updatedBy = 'perf-seed'`, `createdAt = updatedAt = now()`.
  - `project_contractor`: 6 nhà thầu đầu mỗi dự án. `project_equipment_plan`: 6 dòng/dự án (equipment 1 unit 1..3, equipment 2 unit 1..3,
    khoảng ngày nằm trong cửa sổ, `workItemId NULL`, `updatedAt = now()`).
  - `fact_progress_monthly`, `fact_financial`, `fact_volume` (factory luân phiên): 36 tháng/dự án, `version 1`, `isLatest true`;
    tháng thứ k: `pctPlan = LEAST(1,k/36.0)`, `pctActual = LEAST(1,k/40.0)`, `bac = contractValue`, `pv = cv*pctPlan`,
    `ev = cv*pctActual`, `ac = ev*(0.95 + (id%10)/100.0)`, `spi = ev/NULLIF(pv,0)`, `cpi = ev/NULLIF(ac,0)`, cột tiền còn lại
    = số dương bất kỳ theo k (vd `revenuePeriod = cv/36`), `equipmentActual = 0`.
  - `fact_value_chain_progress`: 36 tháng × mọi `dim_stage`.
  - `fact_daily_manpower` (khối lớn nhất):
    ```sql
    INSERT INTO "fact_daily_manpower" ("projectId","contractorId","workDate","shiftCode","plannedHeadcount","actualHeadcount")
    SELECT p.id, c.id, d::date, s.code, 20 + (p.id + c.id) % 30, 15 + (p.id*7 + c.id*3 + EXTRACT(DOY FROM d)::int) % 35
    FROM "dim_project" p
    CROSS JOIN (SELECT id FROM "dim_contractor" ORDER BY id LIMIT 6) c
    CROSS JOIN generate_series(${S}::date, ${E}::date, interval '1 day') d
    CROSS JOIN (SELECT code FROM "dim_shift" WHERE "isActive" ORDER BY "sortOrder") s
    WHERE p."masterCode" LIKE 'PERF-%' AND p.id BETWEEN ${a} AND ${b};
    ```
  - `fact_daily_equipment_usage`: tương tự, `CROSS JOIN (SELECT id FROM "dim_equipment" ORDER BY id LIMIT 2) e`,
    `qtyPlanned = 1 + (p.id + e.id) % 3`, `qtyActual = (p.id + c.id + EXTRACT(DOY FROM d)::int) % 4`.
  - `audit_log` × audit: `tableName 'fact_progress_monthly'`, `recordId = (g % projects)::text`, `field 'pctActual'`,
    `changedBy 'perf-seed'`, `changedAt = now() - (g || ' minutes')::interval`.
  - `activity_log` × activity: `userEmail 'perf@seed.local'`, `action 'view'`, `createdAt = now() - ((g * 121) || ' seconds')::interval`
    (≈140 ngày → ~10% nằm trong 14 ngày).
  6. `ANALYZE;` 7. In `count(*)` từng bảng + tổng; tổng các bảng < 10.000.000 → in CẢNH BÁO và exit 1.
  Mặc định (500 dự án, 730 ngày, 2 ca, 6 nhà thầu, 2 thiết bị, 7 giai đoạn, 1 tr audit, 100k activity) ≈ **10,05 triệu dòng**.
- [ ] **7.3** `scripts/perf/bench-data.ts` (chẩn đoán tầng dữ liệu, không qua `unstable_cache`): 5 vòng; mỗi vòng đo
  (a) Tổng quan = `Promise.all` đúng các hàm trang gọi: `getPortfolioKpis(m,{})`, `getStatusBreakdown`, `getTonnageValueByGroup(m,'team',{})`,
  `getCapacityData`, `getSpiCpiTrend({})`, `getPortfolioSCurve({})`, `getWatchlist`, `listProjects({ month: m, pageSize: 10 })`,
  `getOverdueScorecard(m,{})`, `getMissingMonth(m)`, `repo.getDims()`, `repo.readLastAuditAt()` — với `m = currentMonth()` và `'all'`;
  (b) Chi tiết = đúng danh sách `Promise.all` ở 6.5 cho dự án `PERF-0001` và dự án 1. In median/max (ms) dạng bảng.
- [ ] **7.4** `scripts/perf/measure-pages.ts` (tiêu chí nghiệm thu, qua HTTP thật): env `PERF_BASE` (mặc định `http://localhost:3001`),
  `PERF_EMAIL`, `PERF_PASSWORD` (tài khoản admin seed; KHÔNG ghi mật khẩu vào file/commit). Đăng nhập: `GET /api/auth/csrf` → lấy
  `csrfToken` + cookie; `POST /api/auth/callback/credentials` (urlencoded `csrfToken, email, password, callbackUrl, json=true`,
  `redirect: 'manual'`) → gom cookie (`res.headers.getSetCookie()`). Đo (thời gian tới khi đọc xong body, `redirect: 'manual'`,
  status ≠ 200 → báo lỗi): `/vi/overview?month=<m>` với 5 tháng KHÁC NHAU (tháng hiện tại và 4 tháng trước — mỗi khoá cache là lần
  đầu) + `month=all`; `/vi/projects/<id>` với id của `PERF-0001..PERF-0005` + dự án 1. In bảng + `max`.
  Quy trình chạy (ghi vào `.bangiao/hieu-nang.md`): dừng dev 3001 → xoá `.next/cache/fetch-cache` → `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js npx next build`
  → `npx next start -p 3001` → `npm run perf:pages`.
- [ ] **7.5** `package.json` scripts: `"perf:seed": "tsx scripts/perf/seed-perf.ts"`, `"perf:clean": "tsx scripts/perf/seed-perf.ts --clean-only"`,
  `"perf:bench": "tsx scripts/perf/bench-data.ts"`, `"perf:pages": "tsx scripts/perf/measure-pages.ts"`.
- [ ] **7.6** Chạy: `npm run perf:seed` → `npm run perf:bench` → quy trình 7.4. Ghi `.bangiao/hieu-nang.md`: số dòng từng bảng,
  bảng bench, bảng HTTP, `EXPLAIN (ANALYZE, BUFFERS)` của 3 truy vấn chậm nhất trong bench. Xong thì `npm run perf:clean` rồi
  `npx prisma db seed` để DB về seed mặc định (test tay các bước sau dựa trên seed mặc định).

**Tiêu chí nghiệm thu T1:** mọi request trong `perf:pages` (6 Tổng quan + 6 Chi tiết) **≤ 1500 ms**. Nếu có request > 1500 ms:
KHÔNG tự thêm cache/đổi kiến trúc — ghi rõ truy vấn chậm (EXPLAIN) vào `hieu-nang.md` mục "Đề xuất cho Bước 11" và báo lại.

**Test:** `perf-guard.test.ts`: `assertPerfDb('ddc_control_tower')` ném, `'ddc_control_tower_b'` không ném, `''` ném;
`parsePerfArgs` mặc định đúng, `--projects=0`/`--days=abc`/`--end=2026-13-01` ném; `estimateRows` mặc định ≥ 10.000.000.

**Commit:** `perf(p2b): T1 seed 10 trieu dong gia + script do tang du lieu va HTTP` (kèm `.bangiao/hieu-nang.md`).

---

## Bước 8 — T4 (a): siêu dữ liệu schema sinh từ Prisma + mô tả field/join

**Cách chống lệch:** không viết tay danh sách bảng/cột nữa. `buildSchemaMeta(Prisma.dmmf.datamodel)` đọc datamodel mà Prisma Client
sinh từ `schema.prisma` (có `dbName` = tên `@@map` thật, cột, PK, quan hệ + `relationFromFields`). Phần chữ (ý nghĩa, join logic) ở
`docs.ts`; test bắt buộc **mọi bảng/cột thật phải có mô tả** và **không có mô tả thừa** → thêm/đổi bảng mà quên cập nhật là `npm test` đỏ.

**Files:** tạo `src/lib/schema-meta/build.ts` (+test), `src/lib/schema-meta/docs.ts` (+test); sửa `src/lib/data-schema.ts`.

- [ ] **8.1** `build.ts`:
  ```ts
  export interface MetaField { name: string; type: string /* 'Int' | 'String' | 'DateTime' | '@db.Date'→'Date' | enum name */; nullable: boolean;
    isList: boolean; pk: boolean; unique: boolean; hasDefault: boolean; fk: { table: string; column: string } | null }
  export interface MetaTable { model: string; table: string; fields: MetaField[]; primaryKey: string[] }
  export interface MetaRelation { name: string; fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[];
    kind: 'N:1' | '1:1'; optional: boolean; onDelete: string | null }
  export interface SchemaMeta { tables: MetaTable[]; relations: MetaRelation[] }
  /** Kiểu tối thiểu, khớp cấu trúc Prisma.dmmf.datamodel (Prisma 6: model.dbName, model.primaryKey, field.kind/relationFromFields…). */
  export interface DatamodelLike { models: readonly { name: string; dbName: string | null; primaryKey: { fields: readonly string[] } | null;
    uniqueFields: readonly (readonly string[])[]; fields: readonly { name: string; kind: string; type: string; isRequired: boolean;
    isList: boolean; isId: boolean; isUnique: boolean; hasDefaultValue: boolean; nativeType?: readonly [string, readonly string[]] | null;
    relationName?: string; relationFromFields?: readonly string[]; relationToFields?: readonly string[]; relationOnDelete?: string }[] }[] }
  export function buildSchemaMeta(dm: DatamodelLike): SchemaMeta;
  ```
  Quy tắc: `table = dbName ?? model`; chỉ field `kind` `scalar`/`enum` thành `MetaField`; `pk` = `isId` hoặc thuộc `primaryKey.fields`;
  quan hệ lấy từ field `kind==='object'` có `relationFromFields.length > 0` (bên giữ FK): `kind = '1:1'` nếu tập cột FK trùng 1 ràng
  buộc unique (field `isUnique`, 1 phần tử `uniqueFields`, hoặc đúng PK), ngược lại `'N:1'`; `optional` = có cột FK nullable;
  `fk` của `MetaField` điền từ quan hệ. Sort bảng theo `table`, quan hệ theo `fromTable, fromColumns`.
- [ ] **8.2** `docs.ts`:
  ```ts
  export type TableKind = 'dim' | 'hub' | 'fact' | 'support' | 'log';
  export interface TableDoc { kind: TableKind; desc: string; fields: Record<string, string> }
  export const TABLE_DOCS: Record<string /* tên bảng DB */, TableDoc>;
  /** Join không có FK thật trong DB (vẽ nét đứt). */
  export const LOGICAL_JOINS: { from: string /* 'bang.cot' */; to: string; note: string }[];
  export const ERD_LAYOUT: Record<string, { col: number; row: number }>;
  ```
  Nội dung `desc`/`fields`: chuyển từ `SCHEMA_ENTITIES` trong `src/lib/data-schema.ts` sang, **đổi về tên DB thật**
  (`customers→dim_customer`, `teams→dim_team_kd`, `factories→dim_factory`, `currencies→dim_currency`,
  `exchange_rates→dim_exchange_rate`, `projects→dim_project`, `project_aliases→dim_project_alias`,
  `value_chain_progress→fact_value_chain_progress`); bổ sung các bảng/cột P1A chưa có: `dim_shift` (ca làm việc, thêm ca = INSERT),
  `dim_date` (lịch ngày tuần ISO, Thứ 2 đầu tuần, đổ sẵn 2020–2035), `project_equipment_plan` (1 dòng = 1 thanh Gantt; chiếc =
  equipmentId + unitNo; ngày thực tế lấy từ fact_daily_equipment_usage), `dim_project.factoryId` (khu vực SX chính),
  `dim_project.contractValueOriginal` (giá trị HĐ nguyên tệ theo currencyCode), `fact_daily_manpower.shiftCode` (tổng ngày = cộng các ca);
  sửa mô tả `fact_daily_manpower` thành "theo NGÀY × nhà thầu × CA"; `project_history` thêm `id`, `projectId`. Mọi cột của
  `SchemaMeta` phải có mô tả (cột hiển nhiên như `id` ghi ngắn "khoá chính").
  `kind`: dim = `dim_customer, dim_team_kd, dim_factory, dim_currency, dim_exchange_rate, dim_stage, dim_contractor, dim_equipment, dim_shift, dim_date`;
  hub = `dim_project`; fact = mọi bảng `fact_*`; log = `audit_log, activity_log, alert_log`; còn lại support.
  `LOGICAL_JOINS`: `project_assignments.userEmail → user_roles.email`; `fact_daily_manpower.workDate → dim_date.date`;
  `fact_daily_equipment_usage.workDate → dim_date.date`; `audit_log.recordId → (bảng ghi trong audit_log.tableName)` (note, không vẽ).
  `ERD_LAYOUT` (cột, hàng) đúng như sau:
  | col | hàng 0 → n |
  |---|---|
  | 0 | dim_customer, dim_team_kd, dim_factory, dim_currency, dim_exchange_rate, user_roles |
  | 1 | dim_project_alias, project_sap_codes, project_assignments, project_history, project_photos, sap_queue, alert_log |
  | 2 | dim_project, project_key_milestone, project_stage_weight, project_work_item, project_contractor, project_equipment_plan |
  | 3 | fact_progress_monthly, fact_financial, fact_volume, fact_value_chain_progress, fact_stage_work_item, fact_stage_milestone, fact_daily_manpower, fact_daily_equipment_usage |
  | 4 | dim_stage, dim_contractor, dim_equipment, dim_shift, dim_date, audit_log, activity_log |
- [ ] **8.3** `src/lib/data-schema.ts`: xoá `SCHEMA_ENTITIES` + kiểu liên quan; giữ `IMPORT_MAPPING` nhưng sửa tên bảng về DB thật
  (`project_aliases.aliasCode → dim_project_alias.aliasCode`, `projects.masterCode / currentAliasCode → dim_project.masterCode / currentAliasCode`,
  `customers.name / teams.name → dim_customer.name / dim_team_kd.name`, join text tương ứng).

**Test:**
- `build.test.ts`: với `Prisma.dmmf.datamodel` thật (`import { Prisma } from '@prisma/client'`): số bảng = số model; có đủ
  `dim_shift`, `dim_date`, `project_equipment_plan`, `fact_daily_manpower`; KHÔNG còn tên `customers`/`projects`; quan hệ
  `fact_daily_manpower.shiftCode → dim_shift.code` kind `N:1`, không optional; `dim_project.factoryId → dim_factory.id` optional;
  tự quan hệ `dim_customer.mergedIntoId → dim_customer.id`; PK ghép `fact_daily_manpower` = 4 cột. Với datamodel giả (fixture): FK
  unique → `1:1`.
- `docs.test.ts`: mọi bảng trong meta có `TABLE_DOCS` + `ERD_LAYOUT`; mọi cột có mô tả không rỗng; không có bảng/cột thừa trong
  `TABLE_DOCS`; không 2 bảng trùng ô layout; mọi `LOGICAL_JOINS.from/to` dạng `bang.cot` tồn tại (trừ mục note); mọi token `bang.cot`
  trong `IMPORT_MAPPING.targetField` tồn tại.

**Commit:** `feat(p2b): T4 sieu du lieu schema sinh tu Prisma dmmf + mo ta field/join co test chong lech`

---

## Bước 9 — T4 (b): `/data-schema` ERD có đường quan hệ + cardinality; `/data-dictionary` có field + join

**Files:** tạo `src/lib/schema-meta/erd-geometry.ts` (+test); sửa 2 trang.

- [ ] **9.1** `erd-geometry.ts`:
  ```ts
  export interface ErdBox { table: string; kind: TableKind; x: number; y: number; w: number; h: number;
    keyFields: { name: string; tag: 'PK' | 'FK' | 'PK,FK'; y: number }[]; moreCount: number }
  export interface ErdEdge { from: string; to: string; path: string /* SVG d */; fromLabel: string; toLabel: string;
    fromLabelPos: { x: number; y: number }; toLabelPos: { x: number; y: number }; dashed: boolean }
  export function buildErd(meta: SchemaMeta, docs: { layout: typeof ERD_LAYOUT; kinds: Record<string, TableKind>; logical: typeof LOGICAL_JOINS }): { boxes: ErdBox[]; edges: ErdEdge[]; width: number; height: number };
  ```
  Hằng: `BOX_W=230, COL_GAP=90, HEAD_H=26, LINE_H=16, PAD=8, ROW_GAP=28`. Hộp chỉ liệt kê cột PK/FK, dòng cuối "+n cột" (`moreCount`).
  `x = col*(BOX_W+COL_GAP)`; `y` = cộng dồn chiều cao hộp các hàng trên **trong cùng cột** + ROW_GAP. Đường: từ cạnh hộp giữ FK tại
  `y` của dòng cột FK tới cạnh hộp đích tại giữa header; đích ở cột lớn hơn → phải→trái, nhỏ hơn → trái→phải, cùng cột → cả 2 ra
  cạnh phải, cong ra ngoài 40px; tự quan hệ → vòng cạnh phải. `path` = cubic bezier tiếp tuyến ngang. Nhãn: đầu FK `'N'` (hoặc `'1'`
  nếu `1:1`), đầu đích `'1'` (hoặc `'0..1'` nếu `optional`), đặt cách đầu mút 12px. Join logic → `dashed: true`, nhãn `'N'`/`'1'`.
- [ ] **9.2** `/data-schema/page.tsx`: giữ khối kiểm quyền admin. Nội dung: (1) legend 5 loại bảng (giữ kiểu chip `KIND` hiện có, thêm
  `hub`/`log`) + chú thích "nét liền = khoá ngoại thật trong DB, nét đứt = join logic không có FK; N / 1 / 0..1 = cardinality";
  (2) thẻ "Mô hình quan hệ" chứa `<div style={{ overflowX: 'auto' }}><svg viewBox width={width}>` vẽ `edges` (`stroke: var(--label3)`,
  nét đứt `strokeDasharray="5 4"`, nhãn `fontSize 10 fontWeight 800 fill var(--label2)`) rồi `boxes` (nền `var(--glass-3)`, viền
  `var(--sep)`, header tô theo kind: dim `rgba(245,179,1,.18)`, hub `var(--accent-tint)`, fact `var(--fill)`, support/log trong suốt;
  tên bảng `mono` đậm; dòng cột có tag PK/FK); (3) bảng `IMPORT_MAPPING` giữ nguyên như hiện tại; (4) accordion "Chi tiết từng bảng"
  giữ kiểu hiện tại nhưng dữ liệu lấy từ `buildSchemaMeta(Prisma.dmmf.datamodel)` + `TABLE_DOCS` (cột: Field, Type, Null, Key, Ghi chú).
  Server component thuần (không `'use client'`), không truy vấn DB.
- [ ] **9.3** `/data-dictionary/page.tsx`: giữ nguyên phần `DATA_DICTIONARY` hiện có; thêm phía dưới tiêu đề mục
  `isVi ? 'Từ điển bảng dữ liệu (sinh từ schema)' : 'Table dictionary (generated from schema)'`, mỗi bảng 1 `<details className="card group">`
  nhóm theo kind: mô tả bảng; bảng field (Field | Kiểu | Bắt buộc | Khoá | Ý nghĩa); mục "Join": mỗi quan hệ đi ra
  `cột → bảng.cột (N:1, xoá: Cascade/Restrict/SetNull)` và đi vào `bảng.cột → cột này`, cộng `LOGICAL_JOINS` liên quan (ghi "join logic").
  Mô tả field hiện tiếng Việt cho cả 2 locale (như `data-schema` hiện tại).

**Trường hợp biên:** bảng không có quan hệ (vd `activity_log`, `user_roles`, `dim_date`) vẫn vẽ hộp; FK ghép nhiều cột (vd
`fact_stage_work_item` → 3 bảng) mỗi quan hệ 1 đường; bảng không có cột khoá → hộp chỉ header + "+n cột".

**Test:** `erd-geometry.test.ts`: số `boxes` = số bảng; số cạnh liền = `meta.relations.length`, số cạnh đứt = số `LOGICAL_JOINS` có đích
là cột; không 2 hộp chồng nhau (kiểm giao hình chữ nhật); cạnh `dim_project.factoryId` có `toLabel === '0..1'`; `fact_daily_manpower → dim_shift`
có `fromLabel 'N'`/`toLabel '1'`. Test render (`renderToStaticMarkup`, mock `@/lib/session` admin + `next-intl/server`) cho 2 trang: có
`<svg`, có `dim_shift`, `project_equipment_plan`; data-dictionary có `→ dim_project.id`. Theo boilerplate `src/server/operation-pages-render.test.ts`
(đặt test mới tại `src/server/data-pages-render.test.ts`).

**Commit:** `feat(p2b): T4 ERD HTML co duong quan he + cardinality, tu dien bang co field va join`

---

## Bước 10 — T4 (c): tài liệu `docs/DATA_WAREHOUSE_README.md`

**Files:** tạo `src/lib/schema-meta/mermaid.ts`, `src/lib/schema-meta/erd-doc.test.ts`, `scripts/gen-erd-doc.ts`; sửa
`docs/DATA_WAREHOUSE_README.md`, `package.json`.

- [ ] **10.1** `mermaid.ts`: `export function toMermaid(meta: SchemaMeta): string` — `erDiagram`; mỗi quan hệ
  `<toTable> <trái> -- <phải> <fromTable> : "<fromColumns.join(',')>"` với `||--o{` (N:1 bắt buộc), `|o--o{` (N:1 optional),
  `||--||` (1:1), `|o--o|` (1:1 optional); mỗi bảng khối thuộc tính `<type> <name> [PK|FK]`. Thứ tự ổn định (sort như meta).
- [ ] **10.2** `scripts/gen-erd-doc.ts`: thay đoạn giữa 2 dấu `<!-- ERD:BEGIN (sinh tu dong: npm run docs:erd) -->` và `<!-- ERD:END -->`
  trong README bằng khối ```` ```mermaid ```` từ `toMermaid(buildSchemaMeta(Prisma.dmmf.datamodel))`. `package.json`:
  `"docs:erd": "tsx scripts/gen-erd-doc.ts"`.
- [ ] **10.3** `docs/DATA_WAREHOUSE_README.md`: dòng 4 "Trạng thái hiện tại: mock in-memory…" → "Runtime dùng Prisma + PostgreSQL
  (`src/server/repo/prisma-repo.ts`); mock chỉ dùng cho test."; thêm ngay dưới tiêu đề khung cảnh báo:
  "> **Nguồn sự thật:** trang `/data-schema` và `/data-dictionary` (sinh từ `prisma/schema.prisma`). Mục 1 (ERD) sinh tự động; các
  mục khác viết tay ngày 2026-09 trở về trước, **có thể đã cũ** — khi lệch, tin trang web."; thay toàn bộ mục 1 (khối mermaid cũ)
  bằng 2 dấu mốc + nội dung sinh ra; chạy `npm run docs:erd`.
- [ ] **10.4** `erd-doc.test.ts`: đọc README (`path.resolve(__dirname, '../../../docs/DATA_WAREHOUSE_README.md')`), cắt đoạn giữa 2
  dấu mốc, so với khối sinh từ `toMermaid(...)` → khác thì fail với thông báo "chạy npm run docs:erd". Thêm test `toMermaid` có dòng
  `dim_shift ||--o{ fact_daily_manpower : "shiftCode"` và `dim_factory |o--o{ dim_project : "factoryId"`.

**Commit:** `docs(p2b): T4 ERD trong DATA_WAREHOUSE_README sinh tu schema, danh dau phan cu`

---

## Bước 11 — T1-migration (TREO — coder KHÔNG làm lần này)

**Điều kiện mở (đủ cả 4):** (1) P2A đã merge `main`; (2) `phien-A.md` không còn giữ `prisma/schema.prisma`; (3) B đã `git merge main`
+ `npx prisma migrate deploy` + `npx prisma generate` + `npm test` xanh (lưu ý: sau merge, test Bước 8/10 sẽ đỏ nếu P2A thêm bảng —
bổ sung `TABLE_DOCS`/`ERD_LAYOUT` cho bảng mới rồi `npm run docs:erd`); (4) `.bangiao/hieu-nang.md` (đo lại sau merge) có truy vấn
> 1500 ms hoặc EXPLAIN cho thấy quét tuần tự trên bảng lớn. **Không có (4) → không tạo migration.**

**Index T1 ĐÃ CÓ (không tạo lại):** `fact_progress_monthly (yearMonth, projectId)`, `(projectId, yearMonth, isLatest)`;
`fact_financial` như trên; `fact_volume (yearMonth, projectId)`; `fact_daily_manpower (projectId, workDate)` + `(workDate)` (P1A);
`fact_daily_equipment_usage (projectId, workDate)`; `audit_log (changedAt)`, `(tableName, recordId)` (P1A); `activity_log (createdAt)`;
`alert_log (projectId)`, `(openedAt)` (P1A); `dim_project (factoryId)` (P1A); `project_equipment_plan (projectId, equipmentId, unitNo)`,
`(projectId, plannedStart)` (P1A).

**Ứng viên (chỉ chọn cái EXPLAIN chứng minh cần):** `@@index([isLatest, projectId, yearMonth(sort: Desc)])` cho
`fact_progress_monthly`/`fact_financial` (phục vụ `DISTINCT ON`); `@@index([projectId, factoryId, yearMonth(sort: Desc)])` cho `fact_volume`;
bảng tổng hợp tuần chỉ khi `readManpowerWeekly` > 200 ms trên dữ liệu perf. Chỉ dùng index biểu diễn được trong `schema.prisma` (không
index một phần `WHERE` — Prisma 6 không mô tả được, sẽ gây drift).

**Cách làm khi mở:** ghi `prisma/schema.prisma` + `prisma/migrations/` vào "Đang giữ" của `phien-B.md`; sửa `@@index` trong schema;
`npx prisma migrate dev --create-only --name p2b_t1_perf_index` trên `ddc_control_tower_b`; chú thích SQL không dấu; `migrate deploy`;
đo lại `perf:pages`; commit `perf(p2b): T1 index bo sung theo ket qua do`; nhả khoá sau khi merge `main`.

---

## Ngoài phạm vi P2B (ghi để reviewer không đòi)

N+1 ở `/compliance`, `/alerts`, `/nhap-lieu` (không thuộc tiêu chí Tổng quan/Chi tiết); phân trang server cho `ActivityViewer`;
form nhập `project_equipment_plan` (Q6); cache mới cho trang Chi tiết (dữ liệu nhập phải hiện ngay; invalidation nằm ở `actions.ts` của A).

## Tự kiểm của planner

- T12b(a) → Bước 2; T12b(b) + thay chart cũ + tuần lẻ → Bước 3; anchor KPI giữ nguyên → Bước 2.4 + test; T14 → Bước 4; T1 aggregate DB /
  N+1 / `month=all` / cache → Bước 5–6; `report.ts` 2N → 5.3; `/admin` activity → 6.4; audit-log-page + index → 6.2 + mục index đã có;
  seed 10 tr + đo lặp lại → Bước 7; T1-migration treo → Bước 11; T4 ERD/dictionary/sinh từ schema/README → Bước 8–10.
- Tên hàm dùng xuyên bước: `readManpowerByShiftMonth`, `readManpowerWeekly`, `readManpowerRange`, `readEquipmentPlans`,
  `readEquipmentUsageDays`, `readFactSnapshots`, `readFinancialSnapshots`, `readVolumeSnapshots`, `readMonthlyEvm`, `readLastAuditAt`,
  `readActivitySince`, `readAuditLogPage`, `getShiftChartData`, `getWeeklyChartData`, `getEquipmentGantt`, `buildSchemaMeta`, `buildErd`, `toMermaid`.
