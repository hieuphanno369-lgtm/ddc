# Run 1 — ERP data model, lớp tính toán, REST API

> **Cho agent thực thi:** dùng `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Mỗi bước là một checkbox `- [ ]`. Làm TUẦN TỰ theo số task —
> thứ tự đã tính phụ thuộc (không thể viết API trước khi có schema, không sửa test trước khi đổi công thức).

**Mục tiêu:** dựng lại data model ERP (11 bảng mới + sửa 3 bảng cũ), mở khoá đồng hồ ứng dụng,
chuyển %TT sang tổng có trọng số và %KH sang tính theo thời gian, đổi nguồn nhân lực/thiết bị
sang bảng theo ngày (kèm biểu đồ nhân lực KH/TT ở trang Chi tiết dự án),
và bày lớp tính toán ra 5 REST endpoint có phân quyền.

**Kiến trúc:** một nguồn công thức duy nhất ở `src/lib/*` (pure function, unit-test được).
RSC page và REST route đều gọi chung `src/server/queries.ts` + `src/server/project-queries.ts`.
Phân quyền đọc gom về `src/server/authz.ts`. Đồng hồ gom về `src/lib/clock.ts`.

**Tech stack:** Next.js 14.2.15 (App Router) · Prisma 6.19 + PostgreSQL · TypeScript 5.5 strict ·
Vitest 2.1 · zod 4 · next-auth 4.24 · next-intl 3.26.

**Nhánh:** `feature/erp-model-v2` (baseline đã commit, 237/237 test xanh, `tsc --noEmit` 0 lỗi).

---

## QUYẾT ĐỊNH ĐÃ CHỐT

Chủ dự án đã chốt toàn bộ. **Không còn câu hỏi mở, không còn "tạm dùng".**
Không viết `// TODO(Q…)` ở bất kỳ đâu trong Run 1 — chỗ nào plan cũ ghi TODO(Q…) thì nay đã là
quyết định, ghi comment giải thích *lý do* thay vì TODO.

**Q1 — Mốc thứ 6 của `fact_stage_milestone` = "Ngày chênh lệch", DẪN XUẤT, KHÔNG lưu cột.**
`dayVariance = actualFinish − plannedFinish` (đơn vị **ngày**, dương = trễ, âm = sớm,
`null` khi thiếu một trong hai ngày). Lý do không lưu: 2 cột gốc sửa được bất cứ lúc nào,
cột dẫn xuất lưu cứng sẽ tự mâu thuẫn. Tính bằng `calcDayVariance()` (`src/lib/evm.ts`, Task 3),
gắn vào kiểu `StageMilestoneView` ở tầng repo (Task 5) nên **mọi** nơi trả
`fact_stage_milestone` (repo, RSC page, `GET /api/projects/[id]/milestones`) đều có field này.

**Q2 — "% Kế hoạch" CHỈ còn một định nghĩa: theo thời gian (duration).**
- `calcDurationPctComplete(plannedStart, plannedFinish, at)` là nguồn DUY NHẤT của "% Kế hoạch"
  — ở `summarize()` (`src/server/queries.ts`), ở trang RSC `/projects/[id]`, và ở
  `GET /api/projects/[id]/summary`. API **không** trả `pctPlanDuration` / `pctPlanSource` song song.
- `PV = duration% × BAC` và `SPI = EV / PV` tại **mọi đường ghi**: seed (Task 6) và
  `saveMonthlyFact` của cả `mock-repo` lẫn `prisma-repo` (Task 6/7). Mốc thời gian để tính
  duration% của một tháng là **ngày cuối tháng đó** (`endOfMonth(yearMonth)`), không phải "hôm nay"
  — lưu lại tháng quá khứ phải ra đúng PV của tháng đó.
- Cột `fact_progress_monthly.pctPlan` **giữ nguyên trong DB** nhưng **đổi vai trò**: chỉ còn là
  "% KH người dùng nhập tay", phục vụ lịch sử/audit và form nhập liệu. **Cấm** dùng nó để tính
  PV/SPI hoặc để hiển thị "% Kế hoạch" ở bất kỳ đâu.
- `ProjectSummary.pctPlan` đổi kiểu thành `number | null` (`null` = thiếu ngày kế hoạch → UI hiện `-`).

**Q3 — Nhân lực/thiết bị lấy theo NGÀY, thêm biểu đồ nhân lực ở cuối trang Chi tiết dự án.**
- `GET /api/projects/[id]/summary` và 2 scorecard (nhân lực, thiết bị) đọc từ
  `fact_daily_manpower` / `fact_daily_equipment_usage`, **không** đọc
  `fact_progress_monthly.manpower*`/`equipment*` nữa (2 cụm cột đó chỉ còn là số tháng cho form/audit).
- Con số là **ảnh chụp của NGÀY gần nhất có dữ liệu** (≤ mốc đang xem), cộng ngang qua nhà thầu —
  KHÔNG cộng dồn nhiều ngày. Mỗi scorecard có một dòng nhỏ bên dưới ghi rõ ngày đó.
- Thêm **Task 8**: line chart Recharts ở CUỐI trang `/projects/[id]`, 2 đường
  "Số nhân lực kế hoạch" / "Số nhân lực thực tế", toggle drill-down **Tuần / Tháng**,
  nhãn trục X là khoảng ngày thật (`21.09 - 27.09`), năm ghi ở góc chart.
- Không thêm endpoint mới cho chart: trang RSC đọc thẳng qua `src/server/project-queries.ts`
  rồi truyền `data` xuống client component — đúng pattern `SCurve`/`SpiCpiLine` hiện có.
  Route `GET /api/projects/[id]/resources` (viết ở chunk sau) dùng lại đúng 2 hàm đó.

**Q4 — `fact_daily_equipment_usage` tách `qtyPlanned` + `qtyActual`.** Giữ nguyên như plan đang viết
(Task 4/5/6/7). Không còn cột `qty` gộp.

**Q5 — `calcMode` của 7 giai đoạn.** `volume` = `shop`, `procurement`, `fabrication`, `transport`,
`erection` · `manual` = `design`, `handover`.

**Q6 — 10 hạng mục.** Đúng danh sách ở Task 6 (`Hệ giàn nâng` … `Hệ Walkaway`).

**Q7-Q11 — chốt theo đúng phương án plan đã đề xuất, không đổi:**
Q7 5 mốc chính + 2 mốc đã có `actualDate` (danh sách ở Task 6) ·
Q8 6 nhà thầu + 7 nhóm thiết bị (danh sách ở Task 6) ·
Q9 dự án `id = 1` (SVĐ PVF) nhận trọn bộ dữ liệu ERP chi tiết, cả 17 dự án nhận
`project_stage_weight` mặc định và `fact_stage_milestone` suy từ `plannedStart/FinishDate` ·
Q10 `admin` + `bod` đọc mọi dự án, `data-entry` + `viewer` chỉ đọc dự án được gán, Task 6 sửa
`buildAssignments` sang 4 email thật ·
Q11 `validateStageWeights` trả kết quả kiểm tra (không throw), Run 1 chỉ dùng trong test + seed.

---

## Global Constraints

Áp cho MỌI task, không nhắc lại ở từng task:

- **Next.js 14.2.15 App Router.** Route handler ký hiệu
  `export async function GET(req: NextRequest, { params }: { params: { id: string } })`.
  `params` là object thường, **không phải Promise** (đó là Next 15). Không dùng `await params`.
- **Prisma 6.19.** Column camelCase, table snake_case qua `@@map` — bám đúng
  `prisma/schema.prisma` hiện có.
- **Tiền tệ/đơn vị:** `contractValue`, `bac`, `pv`, `ev`, `ac` tính bằng **tỷ VNĐ**.
  `tonnage`, `qtyPlan`, `qtyActual` bằng **tấn**.
- **Phần trăm là phân số [0, 1.5]**, KHÔNG phải 0..100. Ngoại lệ duy nhất:
  `ProjectStageWeight.weightPct` là **điểm phần trăm 0..100** (Thiết kế = 5, Gia công = 40).
  Chỗ nào trộn hai quy ước là bug.
- **Ngày tháng qua ranh giới TS ↔ JSON luôn là string:** `'YYYY-MM-DD'` cho ngày,
  `'YYYY-MM'` cho tháng, ISO 8601 đầy đủ cho datetime. `Date` chỉ tồn tại bên trong
  Prisma row và `src/lib/clock.ts`. Mapper trong repo chịu trách nhiệm đổi (xem hàm `iso`/`d8`
  ở `src/server/repo/prisma-repo.ts:42-43`).
- **Không hardcode ngưỡng.** Mọi hằng số so sánh lấy từ `THRESHOLDS` (`src/lib/thresholds.ts`).
- **Không hardcode ngày/tháng trong code production.** Lấy từ `src/lib/clock.ts`.
  `src/data/seed/*` là ngoại lệ duy nhất được phép giữ hằng số ngày. Seed **được phép** import
  hàm thuần không đọc đồng hồ từ `clock.ts` (`endOfMonth`, `addDaysIso`, `daysBetween`);
  seed **không được** gọi `today()` / `todayIso()` / `currentMonth()` / `historyMonths()`.
- **Comment tiếng Việt**, một dòng, giải thích *tại sao* chứ không mô tả lại code —
  bám phong cách hiện có ở `src/lib/evm.ts` và `src/lib/thresholds.ts`.
- **Test:** đặt cạnh file nguồn (`src/lib/stages.test.ts` cạnh `src/lib/stages.ts`).
  `vitest.config.ts` chỉ include `src/**/*.test.ts` — test cho route trong `app/api/`
  vẫn đặt ở `src/server/` rồi import ngược lên (xem `src/server/photo-route.test.ts:14`).
- **KHÔNG đụng trong Run 1:** `src/components/form/DataEntryForm.tsx`,
  `src/components/form/CreateProjectForm.tsx` (để Run 2) · styling / i18n message mới /
  hint UI (để Run 3). Hai ngoại lệ được phép, không mở rộng thêm:
  (a) thay literal `0.9` bằng `THRESHOLDS.spiWarn` trong `DataEntryForm.tsx` (Task 1) —
  chỉ đúng 2 dòng đó; (b) đúng 9 key i18n mới của Task 8 (scorecard + biểu đồ nhân lực),
  thêm song song vào `src/i18n/messages/vi.json` và `en.json` — danh sách key liệt kê trong Task 8.
- **Commit sau mỗi task**, message tiếng Việt theo Conventional Commits
  (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).

---

## Bản đồ file

### Tạo mới
| File | Trách nhiệm |
|---|---|
| `src/lib/clock.ts` | Đồng hồ ứng dụng. `today()`, `currentMonth()`, `prevMonth()`, `historyMonths()`, `endOfMonth()`. Đọc `DDC_FAKE_TODAY`. |
| `src/lib/clock.test.ts` | Test đồng hồ + override env + biên năm. |
| `src/server/authz.ts` | `requireUser()`, `requireProjectRead()`, `authzError()`. Nguồn duy nhất cho quyền đọc. |
| `src/server/authz.test.ts` | 4 role × dự án được gán / không được gán. |
| `src/server/project-queries.ts` | Hàm đọc dùng chung cho RSC page + API: `getResourceSnapshot()`, `getManpowerDaily()` (Task 8) và 5 hàm đọc cho API (summary, value-chain, milestones, work-items, resources). |
| `src/server/project-queries.test.ts` | Ảnh chụp ngày gần nhất + biên "chưa có dữ liệu ngày" (Task 8). |
| `src/lib/daily-series.ts` | Gộp chuỗi số liệu theo ngày thành bucket TUẦN/THÁNG + nhãn khoảng ngày `dd.mm - dd.mm` (Task 8). |
| `src/lib/daily-series.test.ts` | Test gộp bucket: biên tuần qua tháng/năm, mảng rỗng, ngày trùng. |
| `src/components/project/ManpowerDailyChart.tsx` | Client component Recharts: 2 đường nhân lực KH/TT + toggle Tuần/Tháng + badge năm (Task 8). |
| `src/server/api-projects-routes.test.ts` | 401/403/200 cho cả 5 route. |
| `app/api/projects/[id]/summary/route.ts` | |
| `app/api/projects/[id]/value-chain/route.ts` | |
| `app/api/projects/[id]/milestones/route.ts` | |
| `app/api/projects/[id]/work-items/route.ts` | |
| `app/api/projects/[id]/resources/route.ts` | |
| `prisma/migrations/<ts>_erp_model_v2/migration.sql` | Sinh bằng `migrate dev --create-only` rồi bổ sung tay. |

### Sửa nặng
`prisma/schema.prisma` · `src/server/repo/types.ts` · `src/server/repo/prisma-repo.ts` ·
`src/server/repo/mock-repo.ts` · `src/lib/stages.ts` · `src/lib/evm.ts` ·
`src/lib/data-schema.ts` · `src/lib/data-dictionary.ts` · `src/data/seed/history.ts` ·
`prisma/seed.ts` · `src/server/queries.ts`

### Sửa nhẹ
`src/lib/thresholds.ts` · `src/server/actions.ts` · `src/server/repo/index.ts` ·
`src/server/report.ts` · `src/components/dashboard/FilterBar.tsx` ·
`src/components/dashboard/OverviewWidgets.tsx` · `src/components/dashboard/charts.tsx` ·
`src/components/project/WhatIf.tsx` · `app/api/export/route.ts` ·
`app/api/report/export/route.ts` · `vitest.config.ts` · `.env.example` ·
`src/i18n/messages/vi.json` + `en.json` (đúng 9 key của Task 8) ·
4 page: `overview`, `nhap-lieu`, `import`, `projects/[id]`, `compliance`, `report`

### Test phải sửa (đã vỡ do đổi công thức / đổi kiểu `currentMonth`)
`src/lib/stages.test.ts` · `src/server/actions-valuechain.test.ts` ·
`src/data/seed/history.test.ts` · `src/server/report-export-route.test.ts` ·
`src/server/pages-role-guard.test.ts` · `src/server/operation-pages-render.test.ts` ·
`src/server/compliance-page.test.ts`

Riêng `src/data/seed/history.test.ts:26` vỡ vì Q2 (PV không còn bằng `pctPlan × BAC`) —
cách sửa viết sẵn ở Task 6 Bước 6. Các file còn lại vỡ vì `currentMonth` đổi string → function
và vì %TT sang trọng số, cách sửa nằm trong Task 0 Bước 10 và Task 2 Bước 5.

---

## Task 0: Mở khoá đồng hồ — `src/lib/clock.ts`

Hiện `CURRENT_MONTH='2026-09'` và `REPORT_DATE=2026-09-16` là literal ở
`src/data/seed/history.ts:26-27` nhưng được import thẳng vào code production.
Task này tách làm đôi: **seed giữ hằng số** (để demo 09/2026 không hỏng),
**production đọc đồng hồ thật**.

**Files:**
- Create: `src/lib/clock.ts`, `src/lib/clock.test.ts`
- Modify: `vitest.config.ts`, `.env.example`, `src/data/seed/history.ts:24-41`,
  `src/server/repo/mock-repo.ts:1,720`, `src/server/repo/prisma-repo.ts:2,892`,
  `src/server/repo/index.ts:5`, `src/server/queries.ts:3,4,67,185-186,271,286,342,386`,
  `src/server/actions.ts:14,209,223,260,333`, `src/server/report.ts:2,22`,
  `src/components/dashboard/FilterBar.tsx:7,27-33,69,71`,
  `src/components/dashboard/OverviewWidgets.tsx:15,124,129,136`,
  `app/[locale]/(app)/overview/page.tsx:6,49,76`,
  `app/[locale]/(app)/nhap-lieu/page.tsx:3,4,30,32,73`,
  `app/[locale]/(app)/import/page.tsx:3,4,15`,
  `app/[locale]/(app)/projects/[id]/page.tsx:6,37`,
  `app/[locale]/(app)/compliance/page.tsx:4,22`,
  `app/[locale]/(app)/report/page.tsx:5,28`, `app/api/report/export/route.ts:5,14`

**Interfaces — Produces:**
```ts
export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';
export type YearMonth = string;                       // 'YYYY-MM'
export type IsoDate = string;                         // 'YYYY-MM-DD'
export function todayIso(): IsoDate;
export function today(): Date;                        // 00:00:00Z của ngày hôm nay theo giờ VN
export function currentMonth(): YearMonth;
export function monthOf(d: Date): YearMonth;
export function addMonths(ym: YearMonth, delta: number): YearMonth;
export function prevMonth(ym: YearMonth): YearMonth;
export function endOfMonth(ym: YearMonth): IsoDate;           // ngày cuối tháng, HÀM THUẦN (seed dùng được)
export function historyMonths(count?: number): YearMonth[];   // mặc định 12, cũ → mới, kết thúc ở currentMonth()
export function isValidYearMonth(s: string): boolean;
export function isValidIsoDate(s: string): boolean;
export function addDaysIso(d: IsoDate, delta: number): IsoDate;
export function daysBetween(from: IsoDate, to: IsoDate): number;
```

- [ ] **Bước 1: Viết test trước (`src/lib/clock.test.ts`)**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addDaysIso, addMonths, currentMonth, daysBetween, endOfMonth, historyMonths,
  isValidIsoDate, isValidYearMonth, monthOf, prevMonth, today, todayIso,
} from './clock';

const FAKE = process.env.DDC_FAKE_TODAY;
afterEach(() => { if (FAKE) process.env.DDC_FAKE_TODAY = FAKE; else delete process.env.DDC_FAKE_TODAY; });

describe('clock - DDC_FAKE_TODAY ghi đè được (demo giữ dữ liệu seed 09/2026)', () => {
  it('đặt DDC_FAKE_TODAY → today()/currentMonth() bám theo', () => {
    process.env.DDC_FAKE_TODAY = '2026-09-16';
    expect(todayIso()).toBe('2026-09-16');
    expect(today().toISOString()).toBe('2026-09-16T00:00:00.000Z');
    expect(currentMonth()).toBe('2026-09');
  });

  it('DDC_FAKE_TODAY rác → bỏ qua, rơi về đồng hồ thật (không crash)', () => {
    process.env.DDC_FAKE_TODAY = 'khong-phai-ngay';
    expect(isValidIsoDate(todayIso())).toBe(true);
    expect(isValidYearMonth(currentMonth())).toBe(true);
  });

  it('today() trả Date MỚI mỗi lần gọi - không chia sẻ object mutable', () => {
    process.env.DDC_FAKE_TODAY = '2026-09-16';
    const a = today();
    a.setUTCFullYear(1999);
    expect(today().getUTCFullYear()).toBe(2026);
  });
});

describe('clock - số học tháng', () => {
  it('addMonths qua ranh giới năm cả hai chiều', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-09', 0)).toBe('2026-09');
    expect(addMonths('2025-10', 15)).toBe('2027-01');
  });
  it('prevMonth = addMonths(-1)', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
  });
  it('monthOf cắt đúng YYYY-MM theo UTC', () => {
    expect(monthOf(new Date('2026-09-16T00:00:00Z'))).toBe('2026-09');
  });
  it('endOfMonth: 30/31 ngày, tháng 2 thường và tháng 2 nhuận', () => {
    expect(endOfMonth('2026-09')).toBe('2026-09-30');
    expect(endOfMonth('2026-01')).toBe('2026-01-31');
    expect(endOfMonth('2026-02')).toBe('2026-02-28');
    expect(endOfMonth('2024-02')).toBe('2024-02-29');
    expect(endOfMonth('2026-12')).toBe('2026-12-31');
  });
  it('endOfMonth KHÔNG đọc đồng hồ - đổi DDC_FAKE_TODAY không ảnh hưởng (seed gọi được)', () => {
    process.env.DDC_FAKE_TODAY = '2030-01-01';
    expect(endOfMonth('2026-09')).toBe('2026-09-30');
  });
});

describe('clock - historyMonths', () => {
  beforeEach(() => { process.env.DDC_FAKE_TODAY = '2026-09-16'; });

  it('mặc định 12 tháng, cũ → mới, phần tử cuối = tháng hiện tại', () => {
    const ms = historyMonths();
    expect(ms).toHaveLength(12);
    expect(ms[0]).toBe('2025-10');
    expect(ms[11]).toBe('2026-09');
    expect([...ms].sort()).toEqual(ms);
  });
  it('count = 1 → chỉ tháng hiện tại; count <= 0 → mảng rỗng (không vòng lặp âm)', () => {
    expect(historyMonths(1)).toEqual(['2026-09']);
    expect(historyMonths(0)).toEqual([]);
    expect(historyMonths(-3)).toEqual([]);
  });
});

describe('clock - số học ngày', () => {
  it('addDaysIso qua ranh giới tháng/năm', () => {
    expect(addDaysIso('2026-09-22', -6)).toBe('2026-09-16');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween có dấu, cùng ngày = 0', () => {
    expect(daysBetween('2026-09-16', '2026-09-22')).toBe(6);
    expect(daysBetween('2026-09-22', '2026-09-22')).toBe(0);
    expect(daysBetween('2026-09-22', '2026-09-16')).toBe(-6);
  });
});
```

- [ ] **Bước 2: Chạy test cho chắc là FAIL**

`npx vitest run src/lib/clock.test.ts` → FAIL `Cannot find module './clock'`.

- [ ] **Bước 3: Viết `src/lib/clock.ts`**

```ts
/**
 * Đồng hồ ứng dụng - nguồn DUY NHẤT cho "hôm nay" và "tháng hiện tại".
 * Trước đây mọi thứ neo vào hằng số seed (history.ts:26-27) nên app đóng băng ở 09/2026.
 * DDC_FAKE_TODAY ('YYYY-MM-DD') ghi đè để test/demo giữ được bộ số seed.
 * KHÔNG import file này từ src/data/seed/* - seed phải deterministic, giữ hằng số riêng.
 */

export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type YearMonth = string; // 'YYYY-MM'
export type IsoDate = string;   // 'YYYY-MM-DD'

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidYearMonth(s: string): boolean {
  return YM_RE.test(s);
}

export function isValidIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Ngày hôm nay theo múi giờ VN (en-CA cho ra đúng 'YYYY-MM-DD'). */
export function todayIso(): IsoDate {
  const override = process.env.DDC_FAKE_TODAY?.trim();
  if (override && isValidIsoDate(override)) return override;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** 00:00:00Z của ngày hôm nay - mọi phép trừ ngày (penaltyState...) dùng mốc này. */
export function today(): Date {
  return new Date(`${todayIso()}T00:00:00Z`);
}

export function monthOf(d: Date): YearMonth {
  return d.toISOString().slice(0, 7);
}

export function currentMonth(): YearMonth {
  return todayIso().slice(0, 7);
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

export function prevMonth(ym: YearMonth): YearMonth {
  return addMonths(ym, -1);
}

/**
 * Ngày cuối của tháng. HÀM THUẦN - không đọc DDC_FAKE_TODAY, không đọc đồng hồ máy,
 * nên seed được phép import (mốc tính "% Kế hoạch theo thời gian" của một tháng).
 * Mẹo: ngày 0 của tháng kế tiếp = ngày cuối tháng này.
 */
export function endOfMonth(ym: YearMonth): IsoDate {
  const next = addMonths(ym, 1);
  const d = new Date(`${next}-01T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** Cửa sổ trend: `count` tháng liên tiếp, cũ → mới, kết thúc ở tháng hiện tại. */
export function historyMonths(count = 12): YearMonth[] {
  if (count <= 0) return [];
  const end = currentMonth();
  return Array.from({ length: count }, (_, i) => addMonths(end, i - (count - 1)));
}

export function addDaysIso(d: IsoDate, delta: number): IsoDate {
  const t = new Date(`${d}T00:00:00Z`).getTime() + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
```

- [ ] **Bước 4: Chạy test tới khi PASS**

`npx vitest run src/lib/clock.test.ts` → PASS.

- [ ] **Bước 5: Ghim đồng hồ cho toàn bộ test suite**

Sửa `vitest.config.ts` — thêm `env` vào block `test`. Nhờ đó mọi test cũ vẫn thấy
"hôm nay = 2026-09-16" đúng như `REPORT_DATE` cũ, không phải mock từng file:

```ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Ghim đồng hồ: giữ nguyên mốc REPORT_DATE cũ để test cũ không lệch ngày.
    env: { DDC_FAKE_TODAY: '2026-09-16' },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

Thêm vào `.env.example`:
```
# Ghim "hôm nay" cho demo/dev để bộ dữ liệu seed 09/2026 còn ý nghĩa.
# Bỏ dòng này ở production để app dùng ngày thật.
DDC_FAKE_TODAY=2026-09-16
```

- [ ] **Bước 6: Đổi tên hằng số seed cho hết nhập nhằng**

Trong `src/data/seed/history.ts`:
- `REPORT_DATE` → `SEED_REPORT_DATE` (giữ nguyên `new Date('2026-09-16T00:00:00Z')`)
- `CURRENT_MONTH` → `SEED_CURRENT_MONTH` (giữ `'2026-09'`)
- `HISTORY_MONTHS` → `SEED_HISTORY_MONTHS` (giữ nguyên mảng 12 phần tử)
- Cập nhật mọi chỗ dùng nội bộ trong chính file: dòng 62, 65, 70, 129, 166, 248, 306, 311, 339, 340, 384, 387.
- Thêm comment đầu file: `// Hằng số seed - CHỈ dùng để sinh dữ liệu mẫu. Code production đọc src/lib/clock.ts.`
- Cập nhật `src/data/seed/history.test.ts:2` cho khớp tên mới.

- [ ] **Bước 7: Gỡ `currentMonth` khỏi tầng repo (đổi string → function)**

`currentMonth` hiện là **string** (`mock-repo.ts:720`, `prisma-repo.ts:892`) — sau task này
nó là **function** và chỉ sống ở `src/lib/clock.ts`. Xoá hẳn khỏi tầng repo/queries:

| File | Việc |
|---|---|
| `src/server/repo/mock-repo.ts:1` | bỏ `CURRENT_MONTH` khỏi import (giữ `buildRepoData`, `SEED_VERSION`, `RepoData`) |
| `src/server/repo/mock-repo.ts:720` | xoá `export const currentMonth = CURRENT_MONTH;` |
| `src/server/repo/prisma-repo.ts:2` | xoá dòng import `CURRENT_MONTH` |
| `src/server/repo/prisma-repo.ts:892` | xoá `export const currentMonth = CURRENT_MONTH;` |
| `src/server/repo/index.ts:5` | `export { repo } from './prisma-repo';` |
| `src/server/queries.ts:3` | `import { repo } from './repo';` |
| `src/server/queries.ts:386` | xoá `export { currentMonth };` |
| `src/server/queries.ts:342` | `const { month = currentMonth(), ... }` (import từ `@/lib/clock`) |
| `src/server/report.ts:2,22` | import từ `@/lib/clock`; `month: string = currentMonth()` |
| `app/api/report/export/route.ts:5,14` | import từ `@/lib/clock`, gọi `currentMonth()` |
| `app/[locale]/(app)/report/page.tsx:5,28` | như trên |
| `app/[locale]/(app)/compliance/page.tsx:4,22` | `const month = currentMonth();` |
| `app/[locale]/(app)/overview/page.tsx:6,49` | `|| currentMonth()` |
| `app/[locale]/(app)/projects/[id]/page.tsx:6,37` | `: currentMonth()` |
| `app/[locale]/(app)/nhap-lieu/page.tsx:3,32` | `: currentMonth()` |
| `app/[locale]/(app)/import/page.tsx:3,15` | prop `currentMonth={currentMonth()}` |

- [ ] **Bước 8: Thay `HISTORY_MONTHS` trong code production bằng `historyMonths()`**

| File | Dòng | Sửa thành |
|---|---|---|
| `src/server/queries.ts:4` | | bỏ import từ seed; `import { currentMonth, historyMonths, prevMonth, today } from '@/lib/clock';` |
| `src/server/queries.ts:67` | `today: REPORT_DATE` | `today: today()` |
| `src/server/queries.ts:185-186` | `HISTORY_MONTHS.indexOf(...)` | `const prev = prevMonth(yearMonth);` — bỏ hẳn logic `indexOf` |
| `src/server/queries.ts:271,286` | `HISTORY_MONTHS.map` | `historyMonths().map` |
| `src/server/actions.ts:14` | import | `import { historyMonths } from '@/lib/clock';` |
| `src/server/actions.ts:209,223,260,333` | `for (const m of HISTORY_MONTHS)` | `for (const m of historyMonths())` |
| `src/components/dashboard/OverviewWidgets.tsx:15,124,129,136` | | `const months = historyMonths();` dùng lại 3 chỗ |
| `app/[locale]/(app)/nhap-lieu/page.tsx:4,30,73` | | `const months = historyMonths();` cho `months.includes(...)` và prop |
| `app/[locale]/(app)/import/page.tsx:4,15` | | `months={historyMonths()}` |

Ghi chú: với `DDC_FAKE_TODAY=2026-09-16`, `historyMonths()` cho ra đúng `2025-10 … 2026-09`
— **trùng khít mảng cũ**, nên số liệu hiển thị không đổi.

- [ ] **Bước 9: `FilterBar` nhận tháng qua prop (client component không đọc được env server)**

`src/components/dashboard/FilterBar.tsx`:
- Bỏ import dòng 7.
- Signature mới:
```ts
export function FilterBar({
  teams, customers, months, currentMonth,
}: {
  teams: { id: number; name: string }[];
  customers: { id: number; name: string }[];
  months: string[];
  currentMonth: string;
}) {
```
- Dòng 69: `value={searchParams.get('month') ?? currentMonth}` (bỏ literal `'2026-09'`).
- Dòng 71: `{months.map((m) => (`.
- `app/[locale]/(app)/overview/page.tsx:76`:
  `<FilterBar teams={dims.teams} customers={dims.customers} months={historyMonths()} currentMonth={currentMonth()} />`

- [ ] **Bước 10: Dọn `currentMonth` khỏi 8 factory mock**

Barrel `@/server/repo` không còn export `currentMonth` → **xoá key đó khỏi factory mock**:
`report-export-route.test.ts:62`, `pages-role-guard.test.ts:28`,
`operation-pages-render.test.ts:26`, `compliance-page.test.ts:31` (đang là string `'2026-09'`) và
`actions.test.ts:16`, `actions-valuechain.test.ts:15`, `actions-security.test.ts:17`,
`close-alert-role.test.ts:14` (đang là hàm `() => '2026-09'`).
Không cần mock nữa vì đồng hồ đã bị ghim bằng `DDC_FAKE_TODAY` ở Bước 5.

- [ ] **Bước 11: Kiểm chứng + commit**

```bash
npx tsc --noEmit
npx vitest run
git add -A
git commit -m "feat(clock): tách đồng hồ ứng dụng khỏi hằng số seed, bỏ đóng băng 09/2026"
```
`grep -rn "CURRENT_MONTH\|REPORT_DATE\|HISTORY_MONTHS" src app --include=*.ts --include=*.tsx`
chỉ còn khớp trong `src/data/seed/*` (đã có tiền tố `SEED_`).

---

## Task 1: Gom hằng số rải rác về `THRESHOLDS`

**Files:**
- Modify: `src/lib/thresholds.ts`, `src/components/dashboard/charts.tsx:184`,
  `src/components/dashboard/OverviewWidgets.tsx:110`,
  `app/[locale]/(app)/projects/[id]/page.tsx:112-113`,
  `app/[locale]/(app)/report/page.tsx:96,101`,
  `src/components/form/DataEntryForm.tsx:521-522`,
  `src/data/seed/history.ts:134,139,148,153`, `src/lib/data-dictionary.ts:96,111`,
  `src/server/actions.ts:8,443-444`

**Interfaces — Produces:** 2 key mới trong `THRESHOLDS`.

- [ ] **Bước 1: Thêm key mới vào `src/lib/thresholds.ts`**

```ts
  /** Tổng trọng số 7 giai đoạn (điểm phần trăm) - project_stage_weight phải cộng đủ số này */
  stageWeightTotal: 100,
  /** Sai số float chấp nhận khi cộng trọng số (0.01 điểm phần trăm) */
  stageWeightEpsilon: 0.01,
```

- [ ] **Bước 2: Thay literal `0.9` bằng `THRESHOLDS.spiWarn` / `THRESHOLDS.cpiWarn`**

| File:dòng | Hiện tại | Sửa thành |
|---|---|---|
| `charts.tsx:184` | `label={{ value: '0.9', ... }}` | `label={{ value: String(THRESHOLDS.spiWarn), ... }}` (file đã import `THRESHOLDS`) |
| `OverviewWidgets.tsx:110` | `` `${t('overview.threshold')}: 0.9` `` | `` `${t('overview.threshold')}: ${THRESHOLDS.spiWarn}` `` + thêm import |
| `projects/[id]/page.tsx:112` | `summary.spi < 0.9` | `summary.spi < THRESHOLDS.spiWarn` |
| `projects/[id]/page.tsx:113` | `summary.cpi < 0.9` | `summary.cpi < THRESHOLDS.cpiWarn` |
| `report/page.tsx:96` | `r.spi < 0.9` | `r.spi < THRESHOLDS.spiWarn` |
| `report/page.tsx:101` | `r.cpi < 0.9` | `r.cpi < THRESHOLDS.cpiWarn` |
| `DataEntryForm.tsx:521` | `evm.spi < 0.9` | `evm.spi < THRESHOLDS.spiWarn` |
| `DataEntryForm.tsx:522` | `evm.cpi < 0.9` | `evm.cpi < THRESHOLDS.cpiWarn` |
| `history.ts:134` | `f.spi < 0.9` | `f.spi < THRESHOLDS.spiWarn` |
| `history.ts:148` | `f.cpi < 0.9` | `f.cpi < THRESHOLDS.cpiWarn` |
| `history.ts:139` | `'SPI < 0.9'` | `` `SPI < ${THRESHOLDS.spiWarn}` `` |
| `history.ts:153` | `'CPI < 0.9'` | `` `CPI < ${THRESHOLDS.cpiWarn}` `` |

Trong `src/lib/data-dictionary.ts:96,111` các chuỗi `'SPI / CPI < 0.9'` và
`'…đường ngang 0.9 là ngưỡng…'` là **văn bản hiển thị** — nội suy `${THRESHOLDS.spiWarn}`
vào template string (file phải `import { THRESHOLDS } from './thresholds';`).
Sửa cả bản `meaningVi` lẫn `meaningEn`.

- [ ] **Bước 3: Bỏ literal `1.5` ở `actions.ts:443-444`**

```ts
// Trước
const pctActual = pctRaw ? Number(String(pctRaw).replace('%', '').replace(',', '.')) : null;
const norm = pctActual != null && pctActual > 1.5 ? pctActual / 100 : pctActual;

// Sau - dùng đúng hàm chuẩn hoá của lớp tính toán, không viết lại quy ước /100
const norm = pctRaw ? normPct(String(pctRaw).replace('%', '').replace(',', '.')) : null;
```
Sửa import dòng 8:
`import { calcChainPctActual, findCurrentStage, normPct } from '@/lib/stages';`

- [ ] **Bước 4: Kiểm chứng + commit**

```bash
npx tsc --noEmit && npx vitest run
git commit -am "refactor(thresholds): gom ngưỡng 0.9 và 1.5 rải rác về THRESHOLDS"
```

---

## Task 2: `src/lib/stages.ts` — công thức trọng số

**Files:**
- Modify: `src/lib/stages.ts`, `src/lib/stages.test.ts`, `src/server/actions-valuechain.test.ts`

**Interfaces — Consumes:** `THRESHOLDS.stageWeightTotal`, `THRESHOLDS.stageWeightEpsilon` (Task 1).
**Interfaces — Produces:**
```ts
export type StageCalcMode = 'manual' | 'volume';

export interface StageWeight {
  stageCode: StageCode;
  weightPct: number;   // điểm phần trăm 0..100
  applicable: boolean;
}

export const DEFAULT_STAGE_WEIGHTS: StageWeight[];
export const STAGE_CALC_MODE: Record<StageCode, StageCalcMode>;

export function calcChainPctActual(stages: StageInput[], weights?: StageWeight[]): number;

export interface WorkItemQty { qtyPlan: number; qtyActual: number }
export function calcStagePctFromVolume(items: WorkItemQty[]): number;

export interface WeightValidation {
  ok: boolean;
  total: number;                                   // tổng weightPct của giai đoạn applicable
  error?: 'empty' | 'negative' | 'sum' | 'duplicate';
}
export function validateStageWeights(weights: StageWeight[]): WeightValidation;

export interface StageContribution {
  stageCode: StageCode;
  weightPct: number;
  applicable: boolean;
  calcMode: StageCalcMode;
  pctComplete: number;
  contributionPct: number;                         // w × pct / Σw; cộng lại = calcChainPctActual
}
export function calcStageContributions(
  stages: StageInput[], weights?: StageWeight[],
): StageContribution[];
```

`calcChainPctActual` **giữ nguyên tham số thứ nhất** để mọi call site cũ
(`actions.ts:135`, `DataEntryForm.tsx`) còn compile; `weights` mặc định `DEFAULT_STAGE_WEIGHTS`.

- [ ] **Bước 1: Viết test mới trong `src/lib/stages.test.ts`**

Giữ nguyên các `describe` về `findCurrentStage` và `normPct`.
**Thay toàn bộ** `describe('% tổng thể chuỗi giá trị')` (dòng 11-28) và
`describe('Biên bổ sung - % tổng thể (ke-hoach mục 3)')` (dòng 60-83) bằng:

```ts
// import bổ sung ở đầu file
import {
  DEFAULT_STAGE_WEIGHTS, STAGE_ORDER, calcChainPctActual, calcStageContributions,
  calcStagePctFromVolume, findCurrentStage, normPct, validateStageWeights,
  type StageInput, type StageWeight,
} from './stages';

const w = (stageCode: StageWeight['stageCode'], weightPct: number, applicable = true): StageWeight =>
  ({ stageCode, weightPct, applicable });

describe('% tổng thể = tổng CÓ TRỌNG SỐ', () => {
  it('0 giai đoạn áp dụng → 0 (không chia cho 0)', () => {
    expect(calcChainPctActual([])).toBe(0);
    expect(calcChainPctActual([stage('design', 0.5, false), stage('shop', 1, false)])).toBe(0);
  });

  it('tất cả = 0 → 0; tất cả = 1 → 1 (trọng số mặc định cộng đủ 100)', () => {
    expect(calcChainPctActual(STAGE_ORDER.map((s) => stage(s, 0)))).toBe(0);
    expect(calcChainPctActual(STAGE_ORDER.map((s) => stage(s, 1)))).toBeCloseTo(1, 10);
  });

  it('trọng số mặc định 5/10/10/40/5/27/3 được áp đúng, KHÔNG phải trung bình cộng', () => {
    const stages = [
      stage('design', 1), stage('shop', 0.8), stage('procurement', 0.6),
      stage('fabrication', 0), stage('transport', 0), stage('erection', 0), stage('handover', 0),
    ];
    // (5×1 + 10×0.8 + 10×0.6) / 100 = 0.19
    expect(calcChainPctActual(stages)).toBeCloseTo(0.19, 10);
    // Trung bình cộng cũ ≈ 0.342 - phải KHÁC, đây là chỗ chứng minh test có giá trị
    expect(calcChainPctActual(stages)).not.toBeCloseTo((1 + 0.8 + 0.6) / 7, 3);
  });

  it('giai đoạn không áp dụng bị loại khỏi CẢ tử số lẫn mẫu số', () => {
    const stages = [stage('design', 0.5), stage('shop', 1.0), stage('procurement', 0.9, false)];
    expect(calcChainPctActual(stages)).toBeCloseTo(12.5 / 15, 10);
  });

  it('applicable=false ở BẢNG TRỌNG SỐ cũng loại giai đoạn đó (2 nguồn, cùng hiệu lực)', () => {
    const weights = [w('design', 5), w('shop', 10, false), w('procurement', 10)];
    const stages = [stage('design', 1), stage('shop', 1), stage('procurement', 0)];
    expect(calcChainPctActual(stages, weights)).toBeCloseTo(5 / 15, 10);
  });

  it('stage có trong chain nhưng KHÔNG có trong bảng trọng số → trọng số 0, bị bỏ', () => {
    const weights = [w('design', 100)];
    expect(calcChainPctActual([stage('design', 0.5), stage('erection', 1)], weights)).toBe(0.5);
  });

  it('trọng số không cộng đủ 100 vẫn chuẩn hoá đúng (mẫu số là Σw thật)', () => {
    const weights = [w('design', 30), w('shop', 20)];
    expect(calcChainPctActual([stage('design', 1), stage('shop', 0)], weights)).toBeCloseTo(0.6, 10);
  });

  it('mọi trọng số applicable = 0 → 0, không NaN', () => {
    const r = calcChainPctActual([stage('design', 1), stage('shop', 1)], [w('design', 0), w('shop', 0)]);
    expect(r).toBe(0);
    expect(Number.isNaN(r)).toBe(false);
  });
});

describe('validateStageWeights', () => {
  it('bộ mặc định hợp lệ, tổng đúng 100', () => {
    const v = validateStageWeights(DEFAULT_STAGE_WEIGHTS);
    expect(v.ok).toBe(true);
    expect(v.total).toBeCloseTo(THRESHOLDS.stageWeightTotal, 10);
  });

  it('tổng applicable KHÔNG đủ 100 → chặn, kèm tổng thực tế', () => {
    const bad = DEFAULT_STAGE_WEIGHTS.map((x) => (x.stageCode === 'fabrication' ? w('fabrication', 30) : x));
    const v = validateStageWeights(bad);
    expect(v.ok).toBe(false);
    expect(v.error).toBe('sum');
    expect(v.total).toBeCloseTo(90, 10);
  });

  it('bỏ 1 giai đoạn mà không phân bổ lại → vẫn chặn', () => {
    const bad = DEFAULT_STAGE_WEIGHTS.map((x) => (x.stageCode === 'transport' ? { ...x, applicable: false } : x));
    expect(validateStageWeights(bad).ok).toBe(false);
  });

  it('bỏ 1 giai đoạn VÀ dồn trọng số sang giai đoạn khác → hợp lệ', () => {
    const good = DEFAULT_STAGE_WEIGHTS.map((x) => {
      if (x.stageCode === 'transport') return { ...x, applicable: false };
      if (x.stageCode === 'erection') return w('erection', 32); // 27 + 5
      return x;
    });
    expect(validateStageWeights(good).ok).toBe(true);
  });

  it('trọng số âm → "negative"; rỗng → "empty"; trùng stageCode → "duplicate"', () => {
    expect(validateStageWeights([w('design', -1), w('shop', 101)]).error).toBe('negative');
    expect(validateStageWeights([]).error).toBe('empty');
    expect(validateStageWeights([w('design', 50), w('design', 50)]).error).toBe('duplicate');
  });

  it('sai số float trong epsilon vẫn hợp lệ', () => {
    expect(validateStageWeights([w('design', 33.333), w('shop', 33.333), w('procurement', 33.335)]).ok).toBe(true);
  });
});

describe('calcStagePctFromVolume', () => {
  it('Σ qtyActual / Σ qtyPlan', () => {
    expect(calcStagePctFromVolume([
      { qtyPlan: 100, qtyActual: 40 }, { qtyPlan: 300, qtyActual: 60 },
    ])).toBeCloseTo(0.25, 10);
  });
  it('qtyPlan = 0 → 0, KHÔNG Infinity/NaN (biên bắt buộc)', () => {
    expect(calcStagePctFromVolume([{ qtyPlan: 0, qtyActual: 10 }])).toBe(0);
    expect(calcStagePctFromVolume([{ qtyPlan: 0, qtyActual: 0 }])).toBe(0);
    expect(calcStagePctFromVolume([])).toBe(0);
  });
  it('tổng plan âm (data rác) → 0 thay vì số âm', () => {
    expect(calcStagePctFromVolume([{ qtyPlan: -5, qtyActual: 3 }])).toBe(0);
  });
  it('vượt kế hoạch cho phép > 1 (khớp quy ước pctInputMax)', () => {
    expect(calcStagePctFromVolume([{ qtyPlan: 100, qtyActual: 120 }])).toBeCloseTo(1.2, 10);
  });
});

describe('calcStageContributions', () => {
  it('tổng contributionPct = calcChainPctActual (bất biến của bảng chuỗi giá trị)', () => {
    const stages = [
      stage('design', 1), stage('shop', 0.8), stage('procurement', 0.6),
      stage('fabrication', 0.2), stage('transport', 0), stage('erection', 0), stage('handover', 0),
    ];
    const sum = calcStageContributions(stages).reduce((a, c) => a + c.contributionPct, 0);
    expect(sum).toBeCloseTo(calcChainPctActual(stages), 10);
  });
  it('giai đoạn không áp dụng có contributionPct = 0 nhưng vẫn nằm trong danh sách', () => {
    const rows = calcStageContributions([stage('design', 1), stage('shop', 1, false)]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.stageCode === 'shop')!.contributionPct).toBe(0);
  });
  it('trả về theo STAGE_ORDER, không theo thứ tự mảng đầu vào', () => {
    const rows = calcStageContributions([stage('erection', 1), stage('design', 1)]);
    expect(rows.map((r) => r.stageCode)).toEqual(['design', 'erection']);
  });
});
```

- [ ] **Bước 2: Chạy test cho chắc là FAIL**

`npx vitest run src/lib/stages.test.ts` → FAIL (export chưa có + công thức cũ là trung bình cộng).

- [ ] **Bước 3: Viết code trong `src/lib/stages.ts`**

```ts
export type StageCalcMode = 'manual' | 'volume';

export interface StageWeight {
  stageCode: StageCode;
  /** Điểm phần trăm 0..100 (KHÔNG phải phân số) - tổng giai đoạn applicable = 100. */
  weightPct: number;
  applicable: boolean;
}

/** Trọng số mặc định đã duyệt. Dùng khi dự án chưa có dòng nào trong project_stage_weight. */
export const DEFAULT_STAGE_WEIGHTS: StageWeight[] = [
  { stageCode: 'design', weightPct: 5, applicable: true },
  { stageCode: 'shop', weightPct: 10, applicable: true },
  { stageCode: 'procurement', weightPct: 10, applicable: true },
  { stageCode: 'fabrication', weightPct: 40, applicable: true },
  { stageCode: 'transport', weightPct: 5, applicable: true },
  { stageCode: 'erection', weightPct: 27, applicable: true },
  { stageCode: 'handover', weightPct: 3, applicable: true },
];

/** manual = nhập tay %HT; volume = suy từ sản lượng hạng mục (fact_stage_work_item). Bộ phân loại đã chốt (Q5). */
export const STAGE_CALC_MODE: Record<StageCode, StageCalcMode> = {
  design: 'manual',
  shop: 'volume',
  procurement: 'volume',
  fabrication: 'volume',
  transport: 'volume',
  erection: 'volume',
  handover: 'manual',
};

/** Giai đoạn chỉ tính vào % tổng khi applicable ở CẢ chain lẫn bảng trọng số, và w > 0. */
function effectiveWeight(stage: StageInput, weights: StageWeight[]): number {
  if (!stage.applicable) return 0;
  const row = weights.find((x) => x.stageCode === stage.stageCode);
  if (!row || !row.applicable || !(row.weightPct > 0)) return 0;
  return row.weightPct;
}

/** % tổng = Σ(w_i × pct_i) / Σ(w_i) trên giai đoạn applicable. Σw = 0 → 0. */
export function calcChainPctActual(
  stages: StageInput[],
  weights: StageWeight[] = DEFAULT_STAGE_WEIGHTS,
): number {
  let num = 0;
  let den = 0;
  for (const s of stages) {
    const w = effectiveWeight(s, weights);
    if (!w) continue;
    num += w * s.pctComplete;
    den += w;
  }
  return den ? num / den : 0;
}

export interface WorkItemQty {
  qtyPlan: number;
  qtyActual: number;
}

/** %HT giai đoạn định lượng = Σ TT / Σ KH. Mẫu số <= 0 → 0 (không Infinity/NaN). */
export function calcStagePctFromVolume(items: WorkItemQty[]): number {
  let plan = 0;
  let actual = 0;
  for (const it of items) {
    plan += it.qtyPlan;
    actual += it.qtyActual;
  }
  return plan > 0 ? actual / plan : 0;
}

export interface WeightValidation {
  ok: boolean;
  total: number;
  error?: 'empty' | 'negative' | 'sum' | 'duplicate';
}

/** Hợp lệ khi: có ít nhất 1 applicable, không âm, không trùng, tổng applicable = 100. */
export function validateStageWeights(weights: StageWeight[]): WeightValidation {
  if (weights.length === 0) return { ok: false, total: 0, error: 'empty' };
  if (new Set(weights.map((x) => x.stageCode)).size !== weights.length) {
    return { ok: false, total: 0, error: 'duplicate' };
  }
  if (weights.some((x) => !Number.isFinite(x.weightPct) || x.weightPct < 0)) {
    return { ok: false, total: 0, error: 'negative' };
  }
  const applicable = weights.filter((x) => x.applicable);
  const total = applicable.reduce((sum, x) => sum + x.weightPct, 0);
  if (applicable.length === 0) return { ok: false, total, error: 'empty' };
  const ok = Math.abs(total - THRESHOLDS.stageWeightTotal) <= THRESHOLDS.stageWeightEpsilon;
  return ok ? { ok: true, total } : { ok: false, total, error: 'sum' };
}

export interface StageContribution {
  stageCode: StageCode;
  weightPct: number;
  applicable: boolean;
  calcMode: StageCalcMode;
  pctComplete: number;
  /** Phần đóng góp vào % tổng: w×pct/Σw. Cộng cả 7 dòng = calcChainPctActual. */
  contributionPct: number;
}

/** Bảng chuỗi giá trị cho UI/API - luôn trả theo STAGE_ORDER, chỉ gồm stage có trong `stages`. */
export function calcStageContributions(
  stages: StageInput[],
  weights: StageWeight[] = DEFAULT_STAGE_WEIGHTS,
): StageContribution[] {
  const den = stages.reduce((sum, s) => sum + effectiveWeight(s, weights), 0);
  return STAGE_ORDER.flatMap((code) => {
    const s = stages.find((x) => x.stageCode === code);
    if (!s) return [];
    const row = weights.find((x) => x.stageCode === code);
    const eff = effectiveWeight(s, weights);
    return [{
      stageCode: code,
      weightPct: row?.weightPct ?? 0,
      applicable: s.applicable && (row?.applicable ?? false),
      calcMode: STAGE_CALC_MODE[code],
      pctComplete: s.pctComplete,
      contributionPct: den ? (eff * s.pctComplete) / den : 0,
    }];
  });
}
```

- [ ] **Bước 4: Chạy test tới khi PASS**

`npx vitest run src/lib/stages.test.ts` → PASS.

- [ ] **Bước 5: Sửa `src/server/actions-valuechain.test.ts` cho khớp công thức mới**

Chỉ đổi **kỳ vọng số**, không đổi cấu trúc. Trọng số mặc định 5/10/10/40/5/27/3:

| Dòng | Hiện tại | Sửa thành |
|---|---|---|
| 42 (tên `it`) | `%TT = trung bình 7 giai đoạn áp dụng` | `%TT = tổng CÓ TRỌNG SỐ 7 giai đoạn áp dụng` |
| 49 | `toBeCloseTo((1 + 0.8 + 0.6) / 7)` | `toBeCloseTo((5 * 1 + 10 * 0.8 + 10 * 0.6) / 100, 10)` |
| 61 | `toBe(0.75)` | `toBeCloseTo((5 * 0.5 + 10 * 1.0) / 15, 10)` · comment `// (5×0.5+10×1.0)/15, KHÔNG phải trung bình cộng 0.75` |
| 74 | `toBe(0)` | giữ nguyên |
| 86-88 | `toBe(1)` | `toBeCloseTo(1, 10)` |

Thêm 1 test mới cuối `describe` đầu tiên — chứng minh trọng số thật sự có tác dụng:
```ts
  it('cùng bộ %HT, đổi giai đoạn hoàn thành → %TT khác nhau theo trọng số (Gia công 40 >> Thiết kế 5)', async () => {
    const id = pid();

    await saveMonthlyData(id, YM, { chain: chain([1, 0, 0, 0, 0, 0, 0]) });   // chỉ Thiết kế xong
    const chiThietKe = repo.getLatestFact(id, YM)!.pctActual;

    await saveMonthlyData(id, YM, { chain: chain([0, 0, 0, 1, 0, 0, 0]) });   // chỉ Gia công xong
    const chiGiaCong = repo.getLatestFact(id, YM)!.pctActual;

    expect(chiThietKe).toBeCloseTo(0.05, 10);
    expect(chiGiaCong).toBeCloseTo(0.40, 10);
  });
```

- [ ] **Bước 6: Kiểm chứng + commit**

```bash
npx tsc --noEmit && npx vitest run
git commit -am "feat(stages): %TT sang tổng có trọng số + calcStagePctFromVolume + validateStageWeights"
```

---

## Task 3: `src/lib/evm.ts` — % kế hoạch theo thời gian + gỡ trùng lặp EVM

**Files:**
- Modify: `src/lib/evm.ts` (bỏ TODO dòng 9), `src/lib/evm.test.ts`,
  `src/server/queries.ts:1,31,83,87,89-92`, `src/components/project/WhatIf.tsx:11,16-18`,
  `app/[locale]/(app)/projects/[id]/page.tsx:116,212`

**Interfaces — Consumes:** `today()` từ `@/lib/clock` (Task 0).
**Interfaces — Produces:**
```ts
export function calcDurationPctComplete(
  plannedStart: string | Date | null,
  plannedFinish: string | Date | null,
  at: Date,
): number | null;

export type ScheduleDirection = 'ahead' | 'behind';
export interface ScheduleGap { pct: number; direction: ScheduleDirection }
export function calcScheduleGap(pctPlan: number, pctActual: number): ScheduleGap;

/** Q1: "Ngày chênh lệch" của một mốc - DẪN XUẤT, không lưu DB. */
export function calcDayVariance(
  plannedFinish: string | Date | null,
  actualFinish: string | Date | null,
): number | null;
```

Ngoài ra Task này đổi `ProjectSummary` trong `src/server/queries.ts:31`:
`pctPlan: number;` → `pctPlan: number | null;` (Q2).

Quy ước chốt (không ai phải đoán):
- `calcDurationPctComplete` trả `null` khi thiếu ngày, ngày rác, hoặc `finish < start`.
  `finish === start` → `at >= start ? 1 : 0`. Kết quả luôn kẹp `[0, 1]`.
  Tham số thứ 3 tên `at` chứ không phải `today` vì chỗ gọi truyền cả ngày cuối tháng quá khứ
  (seed + `saveMonthlyFact`), không chỉ "hôm nay".
- `calcScheduleGap`: `pct = Math.abs(pctActual - pctPlan)` (độ lớn),
  `direction = pctActual >= pctPlan ? 'ahead' : 'behind'` (bằng nhau → `'ahead'`, gap 0).
- `calcDayVariance`: `actualFinish − plannedFinish` tính bằng **ngày nguyên**, dương = trễ,
  âm = sớm, `0` = đúng hạn. Thiếu một trong hai ngày (hoặc ngày rác) → `null`, KHÔNG trả `0`
  (chưa kết thúc khác hẳn với đúng hạn).

- [ ] **Bước 1: Thêm test vào `src/lib/evm.test.ts`**

```ts
import { calcDayVariance, calcDurationPctComplete, calcScheduleGap } from './evm';

const D = (s: string) => new Date(`${s}T00:00:00Z`);

describe('calcDurationPctComplete - "% Kế Hoạch" theo thời gian trôi', () => {
  const start = '2026-01-01';
  const finish = '2026-12-31';   // 364 ngày

  it('trước/đúng ngày bắt đầu → 0', () => {
    expect(calcDurationPctComplete(start, finish, D('2025-06-30'))).toBe(0);
    expect(calcDurationPctComplete(start, finish, D('2026-01-01'))).toBe(0);
  });
  it('đúng/sau ngày kết thúc → 1 (kẹp, không vượt 100%)', () => {
    expect(calcDurationPctComplete(start, finish, D('2026-12-31'))).toBe(1);
    expect(calcDurationPctComplete(start, finish, D('2030-01-01'))).toBe(1);
  });
  it('giữa kỳ → tỷ lệ ngày đã trôi', () => {
    expect(calcDurationPctComplete(start, finish, D('2026-07-01'))).toBeCloseTo(181 / 364, 6);
  });
  it('thiếu ngày → null (không đoán)', () => {
    expect(calcDurationPctComplete(null, finish, D('2026-07-01'))).toBeNull();
    expect(calcDurationPctComplete(start, null, D('2026-07-01'))).toBeNull();
    expect(calcDurationPctComplete(null, null, D('2026-07-01'))).toBeNull();
  });
  it('ngày rác → null', () => {
    expect(calcDurationPctComplete('khong-phai-ngay', finish, D('2026-07-01'))).toBeNull();
  });
  it('finish < start (data lỗi) → null, KHÔNG trả số âm', () => {
    expect(calcDurationPctComplete('2026-12-31', '2026-01-01', D('2026-07-01'))).toBeNull();
  });
  it('finish === start (dự án 1 ngày) → không chia 0', () => {
    expect(calcDurationPctComplete('2026-05-05', '2026-05-05', D('2026-05-04'))).toBe(0);
    expect(calcDurationPctComplete('2026-05-05', '2026-05-05', D('2026-05-05'))).toBe(1);
  });
  it('nhận cả Date lẫn ISO string đầy đủ', () => {
    expect(calcDurationPctComplete(D(start), D(finish), D('2026-12-31'))).toBe(1);
    expect(calcDurationPctComplete('2026-01-01T00:00:00.000Z', finish, D('2026-01-01'))).toBe(0);
  });
});

describe('calcScheduleGap', () => {
  it('chậm hơn kế hoạch → behind, pct là độ lớn dương', () => {
    const r = calcScheduleGap(0.8, 0.7);
    expect(r.direction).toBe('behind');
    expect(r.pct).toBeCloseTo(0.1, 10);
  });
  it('nhanh hơn kế hoạch → ahead', () => {
    expect(calcScheduleGap(0.7, 0.8).direction).toBe('ahead');
  });
  it('bằng nhau → ahead với gap 0 (union chỉ có 2 giá trị)', () => {
    expect(calcScheduleGap(0.5, 0.5)).toEqual({ pct: 0, direction: 'ahead' });
  });
});

describe('calcDayVariance - "Ngày chênh lệch" của mốc giai đoạn (Q1)', () => {
  it('kết thúc muộn hơn kế hoạch → số DƯƠNG bằng số ngày trễ', () => {
    expect(calcDayVariance('2026-09-15', '2026-09-22')).toBe(7);
  });
  it('kết thúc sớm hơn kế hoạch → số ÂM', () => {
    expect(calcDayVariance('2026-09-22', '2026-09-15')).toBe(-7);
  });
  it('đúng hạn → 0', () => {
    expect(calcDayVariance('2026-09-22', '2026-09-22')).toBe(0);
  });
  it('chưa kết thúc thực tế → null, KHÔNG phải 0 (phân biệt với đúng hạn)', () => {
    expect(calcDayVariance('2026-09-22', null)).toBeNull();
    expect(calcDayVariance(null, '2026-09-22')).toBeNull();
    expect(calcDayVariance(null, null)).toBeNull();
  });
  it('ngày rác → null', () => {
    expect(calcDayVariance('khong-phai-ngay', '2026-09-22')).toBeNull();
  });
  it('qua ranh giới tháng/năm và nhận cả Date', () => {
    expect(calcDayVariance('2026-12-28', '2027-01-03')).toBe(6);
    expect(calcDayVariance(D('2026-02-26'), D('2026-03-02'))).toBe(4);
  });
});
```

- [ ] **Bước 2: Chạy test cho chắc là FAIL**

`npx vitest run src/lib/evm.test.ts` → FAIL, export chưa tồn tại.

- [ ] **Bước 3: Viết code trong `src/lib/evm.ts`**

```ts
/** Parse 'YYYY-MM-DD' | ISO đầy đủ | Date. Rác → null. */
function toDate(v: string | Date | null): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "% Kế Hoạch" = số ngày đã trôi / tổng số ngày kế hoạch, kẹp [0, 1].
 * Thiếu ngày hoặc finish < start → null (không đoán, tầng trên hiển thị "-").
 */
export function calcDurationPctComplete(
  plannedStart: string | Date | null,
  plannedFinish: string | Date | null,
  today: Date,
): number | null {
  const start = toDate(plannedStart);
  const finish = toDate(plannedFinish);
  if (!start || !finish) return null;
  const totalMs = finish.getTime() - start.getTime();
  if (totalMs < 0) return null;
  const elapsedMs = today.getTime() - start.getTime();
  if (totalMs === 0) return elapsedMs >= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, elapsedMs / totalMs));
}

export type ScheduleDirection = 'ahead' | 'behind';
export interface ScheduleGap {
  /** Độ lớn chênh lệch (luôn >= 0); dấu nằm ở `direction`. */
  pct: number;
  direction: ScheduleDirection;
}

/** Chênh lệch %TT so với %KH. Bằng nhau coi là 'ahead' với gap 0. */
export function calcScheduleGap(pctPlan: number, pctActual: number): ScheduleGap {
  return {
    pct: Math.abs(pctActual - pctPlan),
    direction: pctActual >= pctPlan ? 'ahead' : 'behind',
  };
}

/**
 * "Ngày chênh lệch" (mốc thứ 6 của fact_stage_milestone) = TT kết thúc − KH hoàn thành.
 * Dẫn xuất, KHÔNG lưu cột: 2 ngày gốc sửa lúc nào cũng được, lưu cứng sẽ tự mâu thuẫn.
 * Chưa có ngày kết thúc thực tế → null (khác hẳn 0 = đúng hạn).
 */
export function calcDayVariance(
  plannedFinish: string | Date | null,
  actualFinish: string | Date | null,
): number | null {
  const planned = toDate(plannedFinish);
  const actual = toDate(actualFinish);
  if (!planned || !actual) return null;
  return Math.round((actual.getTime() - planned.getTime()) / 86_400_000);
}
```

Xoá dòng TODO ở `src/lib/evm.ts:9` (`TODO: audit EVM inline dup…`) — Bước 4 và Bước 6 đóng nó.

- [ ] **Bước 4: Gỡ trùng lặp EAC/VAC ở `src/server/queries.ts:89-92`**

```ts
// Trước
    spi: fact?.spi != null ? Math.round(fact.spi * 100) / 100 : null,
    cpi: fact?.cpi != null ? Math.round(fact.cpi * 100) / 100 : null,
    eac: fact?.cpi ? Math.round((bac / fact.cpi) * 100) / 100 : null,
    vac: fact?.cpi ? Math.round((bac - bac / fact.cpi) * 100) / 100 : null,

// Sau - một nguồn công thức, làm tròn tách khỏi tính toán
    spi: round2(fact?.spi ?? null),
    cpi: round2(fact?.cpi ?? null),
    eac: round2(eac),
    vac: round2(calcVac(bac, eac)),
```
Ngay trước `return {` trong `summarize()` thêm: `const eac = calcEac(bac, fact?.cpi ?? null);`
Thêm helper cuối file:
```ts
/** Làm tròn 2 chữ số, giữ null. Chỉ để hiển thị - KHÔNG dùng để tính tiếp. */
function round2(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100;
}
```
Sửa import dòng 1 (gồm luôn hàm dùng ở Bước 5, khỏi sửa hai lần):
`import { calcDurationPctComplete, calcEac, calcVac, deriveStatus, isOnTrack, penaltyState, type PenaltyState } from '@/lib/evm';`

- [ ] **Bước 5: "% Kế hoạch" ở `summarize()` chuyển hẳn sang duration (Q2)**

`src/server/queries.ts` — `summarize()` là hàm dùng chung cho trang RSC `/projects/[id]`,
bảng danh sách và (chunk sau) `GET /api/projects/[id]/summary`, nên sửa một chỗ là cả ba khớp nhau.

Dòng 31, trong `interface ProjectSummary`:
```ts
  pctPlan: number | null;   // % KH THEO THỜI GIAN (duration); null = thiếu ngày kế hoạch
```

Trong `summarize()`, ngay trước `return {`:
```ts
  // % Kế hoạch = thời gian đã trôi. KHÔNG dùng fact.pctPlan nữa - đó chỉ còn là số nhập tay (audit).
  const pctPlan = calcDurationPctComplete(project.plannedStartDate, project.plannedFinishDate, today());
```

Dòng 83 và 87:
```ts
    onTrack: status === 'Dang_trien_khai' && isOnTrack(fact?.pctActual ?? 0, pctPlan ?? 0),
    pctPlan,
```

Import dòng 1 đã sửa xong ở Bước 4 (có sẵn `calcDurationPctComplete`).
`today` đã được import từ `@/lib/clock` ở Task 0 (Bước 8) — dùng lại, không import lần hai.

Không phải sửa nơi hiển thị: `formatPct(null)` đã trả `'-'` (`src/lib/format.ts:24`) nên
`app/[locale]/(app)/projects/[id]/page.tsx:116` giữ nguyên, và `app/api/export/route.ts:69`
ghi ô rỗng khi `null`.

**Không** thêm `pctPlanDuration` / `pctPlanSource` vào bất kỳ response nào — chỉ còn đúng
MỘT con số tên `pctPlan`. SPI vẫn đọc `fact.spi`, nhưng `fact.spi` được Task 6/7 ghi lại theo
PV duration-based nên tự khớp định nghĩa mới.

- [ ] **Bước 6: Gỡ trùng lặp EAC ở `src/components/project/WhatIf.tsx`**

```tsx
import { calcCpi, calcEac, calcEv } from '@/lib/evm';

export function WhatIf({ ac, pctActual, bac }: { ac: number; pctActual: number; bac: number }) {
  ...
  const baseEac = calcEac(bac, calcCpi(calcEv(pctActual, bac), ac));
  const newEac = calcEac(bac, calcCpi(calcEv(pctActual + delta, bac), ac));
  const saving = baseEac != null && newEac != null ? baseEac - newEac : null;
```
Call site `app/[locale]/(app)/projects/[id]/page.tsx:212`:
```tsx
<WhatIf ac={latest.ac} pctActual={latest.pctActual} bac={latest.bac || project.contractValue} />
```

- [ ] **Bước 7: Kiểm chứng + commit**

```bash
npx tsc --noEmit && npx vitest run
git commit -am "feat(evm): %KH theo duration + calcDayVariance, gỡ EAC/VAC tính inline"
```

`grep -rn "fact\?\?\.pctPlan\|fact\.pctPlan" src app --include=*.ts --include=*.tsx` không còn khớp
ở `queries.ts` (chỉ còn trong form nhập liệu + tầng repo, đúng vai trò "số nhập tay").

---

## Task 4: `prisma/schema.prisma` — 11 bảng mới, enum, khoá ngoại, sửa lời nói dối `version`

Đây là task nặng nhất. Làm nguyên khối rồi mới sinh **một** migration.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_erp_model_v2/migration.sql`

**Interfaces — Produces:** toàn bộ model Prisma cho Task 5-7 dùng.

### Quyết định kỹ thuật đã chốt (đọc trước khi gõ)

1. **`stageCode` và `currencyCode` là KHOÁ NGOẠI, KHÔNG phải enum.** Kế hoạch cấp cao liệt kê
   chúng ở cả mục "thêm enum" lẫn mục "thêm FK". FK mạnh hơn (ràng buộc thật + `dim_stage` còn
   mang `calcMode`, `sortOrder`, tên song ngữ) nên chọn FK. Một cột không thể vừa là enum vừa là FK.
2. **`UserRole.role` giữ nguyên `String`.** Giá trị `'data-entry'` có dấu gạch ngang, không phải
   identifier Prisma hợp lệ, phải `@map` từng value. Ngoài phạm vi Run 1.
3. **KHÔNG thêm FK `project_assignments.userEmail → user_roles.email` trong Run 1.** Seed hiện
   trỏ tới 3 email không tồn tại trong `user_roles`; Task 6 sửa seed trước, FK để run sau.
4. **`isLatest` + partial unique index.** Prisma không diễn đạt được index có mệnh đề `WHERE`,
   nên index này viết tay trong file migration. **Rủi ro đã biết:** lần chạy
   `prisma migrate dev` kế tiếp có thể sinh lệnh `DROP INDEX` cho nó. Cách xử lý:
   luôn dùng `--create-only`, xem SQL, nếu thấy `DROP INDEX "ux_fact_progress_latest"`
   thì xoá dòng đó trước khi apply. Ghi chú này phải nằm ngay trong file migration.
   Ngoài ra tầng repo (Task 6-7) tự duy trì bất biến trong transaction, index chỉ là lưới an toàn.

- [ ] **Bước 1: Thêm 6 enum vào đầu phần dimension của `prisma/schema.prisma`**

```prisma
// ---- Enum (thay String trần - chặn giá trị rác ở tầng DB) ----
enum MarketCode {
  TN
  XK
  NoiBo
}

enum ProjectTypeCode {
  EPC
  San_van_dong
  San_bay
  Nha_xuong
  Cau_cang
  Cao_tang
  Dong_tau
  Cau_giao_thong
  Khac
}

enum PriorityCode {
  P0
  P1
  P2
  P3
}

enum AlertType {
  Red
  Amber
}

enum RoleInProject {
  PIC
  Backup
}

enum SapQueueStatus {
  pending
  resolved
}

enum StageCalcMode {
  manual
  volume
}
```

- [ ] **Bước 2: Đổi kiểu cột sang enum + thêm quan hệ cho model cũ**

| Model | Cột | Từ | Thành |
|---|---|---|---|
| `Project` | `marketCode` | `String` | `MarketCode` |
| `Project` | `projectType` | `String` | `ProjectTypeCode` |
| `Project` | `priority` | `String` | `PriorityCode` |
| `AlertLog` | `alertType` | `String` | `AlertType` |
| `ProjectAssignment` | `roleInProject` | `String` | `RoleInProject` |
| `SapQueue` | `status` | `String @default("pending")` | `SapQueueStatus @default(pending)` |

Thêm quan hệ (tất cả `onDelete: Cascade` trừ chỗ ghi khác):

```prisma
model Customer {
  // ... field cũ giữ nguyên
  mergedInto   Customer?  @relation("CustomerMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom   Customer[] @relation("CustomerMerge")
  projects     Project[]
}

model TeamKd {
  // ... field cũ
  mergedInto Customer? -> KHÔNG, dùng đúng kiểu TeamKd:
  mergedInto TeamKd?  @relation("TeamMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom TeamKd[] @relation("TeamMerge")
  projects   Project[]
}

model Factory {
  // ... field cũ
  volumes FactVolume[]
}

model Currency {
  // ... field cũ
  projects      Project[]
  exchangeRates ExchangeRate[]
}

model ExchangeRate {
  // ... field cũ
  currency Currency @relation(fields: [currencyCode], references: [code], onDelete: Cascade)
}

model Project {
  // ... field cũ
  customer        Customer            @relation(fields: [customerId], references: [id])
  team            TeamKd              @relation(fields: [teamKdId], references: [id])
  currency        Currency            @relation(fields: [currencyCode], references: [code])
  aliases         ProjectAlias[]
  sapCodes        ProjectSapCode[]
  assignments     ProjectAssignment[]
  facts           FactProgressMonthly[]
  valueChain      ValueChainProgress[]
  financials      FactFinancial[]
  volumes         FactVolume[]
  history         ProjectHistory[]
  alerts          AlertLog[]
  photos          ProjectPhoto[]
  sapQueue        SapQueue[]
  stageWeights    ProjectStageWeight[]
  workItems       ProjectWorkItem[]
  workItemFacts   FactStageWorkItem[]
  stageMilestones FactStageMilestone[]
  keyMilestones   ProjectKeyMilestone[]
  contractors     ProjectContractor[]
  dailyManpower   FactDailyManpower[]
  dailyEquipment  FactDailyEquipmentUsage[]
}
```

Lưu ý: `Customer`/`TeamKd` bị `removeProject` xoá khi không còn dự án dùng — quan hệ
`Project.customer`/`Project.team` **không** đặt `onDelete: Cascade` (mặc định `Restrict`)
để chặn xoá nhầm customer còn dự án. `removeProject` đã kiểm tra trước nên không vướng.

Thêm quan hệ ngược ở các model con (mỗi model thêm đúng 1 dòng):
```prisma
model ProjectAlias      { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model ProjectSapCode    { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model ProjectAssignment { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model ValueChainProgress{ project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
                          stage   Stage   @relation(fields: [stageCode], references: [code]) }
model FactFinancial     { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model FactVolume        { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
                          factory Factory @relation(fields: [factoryId], references: [id]) }
model ProjectHistory    { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model AlertLog          { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model ProjectPhoto      { project Project @relation(fields: [projectId], references: [id], onDelete: Cascade) }
model SapQueue          { project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull) }
```

- [ ] **Bước 3: Sửa `FactProgressMonthly` — bỏ lời nói dối `version`**

```prisma
model FactProgressMonthly {
  projectId         Int
  yearMonth         String
  version           Int       @default(1)
  /** true = bản mới nhất của (projectId, yearMonth). Chỉ 1 dòng true mỗi cặp khoá. */
  isLatest          Boolean   @default(true)
  pctPlan           Float
  pctActual         Float
  actualStartDate   DateTime?
  actualFinishDate  DateTime?
  bac               Float     @default(0)
  pv                Float
  ev                Float
  ac                Float
  spi               Float?
  cpi               Float?
  bottleneckStage   String?
  manpowerPlanned   Int       @default(0)
  manpowerActual    Int       @default(0)
  equipmentPlanned  Int       @default(0)
  equipmentActual   Int       @default(0)
  snapshotLockedAt  DateTime?
  lockedBy          String?
  changedBy         String    @default("")
  changedAt         DateTime?
  changeNote        String    @default("")

  project         Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  bottleneckStageRef Stage? @relation("FactBottleneck", fields: [bottleneckStage], references: [code], onDelete: SetNull)

  @@id([projectId, yearMonth, version])
  @@index([yearMonth, projectId])
  @@index([projectId, yearMonth, isLatest])
  @@map("fact_progress_monthly")
}
```
Thay đổi so với hiện tại: `version` vào PK · thêm `isLatest` · thêm `manpowerPlanned`/`manpowerActual` ·
`equipmentPlanned` có `@default(0)` · 2 quan hệ · index mới.

- [ ] **Bước 4: Sửa `FactFinancial` y hệt**

```prisma
model FactFinancial {
  projectId            Int
  yearMonth            String
  version              Int       @default(1)
  isLatest             Boolean   @default(true)
  revenuePeriod        Float
  revenueCumulative    Float
  costActualPeriod     Float
  costActualCumulative Float
  grossProfit          Float
  grossMarginPct       Float
  backlog              Float
  arCollected          Float
  arOutstanding        Float
  arOverdue            Float
  changedBy            String    @default("")
  changedAt            DateTime?
  changeNote           String    @default("")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@id([projectId, yearMonth, version])
  @@index([yearMonth, projectId])
  @@index([projectId, yearMonth, isLatest])
  @@map("fact_financial")
}
```

- [ ] **Bước 5: Thêm 11 model mới**

```prisma
// ---- ERP: giai đoạn, trọng số, sản lượng, mốc ----

/** 7 giai đoạn chuỗi giá trị thành dimension thật (trước đây là hằng số trong code). */
model Stage {
  code      String        @id
  nameVi    String
  nameEn    String
  sortOrder Int
  calcMode  StageCalcMode @default(manual)

  weights          ProjectStageWeight[]
  valueChain       ValueChainProgress[]
  workItemFacts    FactStageWorkItem[]
  milestones       FactStageMilestone[]
  bottleneckFacts  FactProgressMonthly[] @relation("FactBottleneck")

  @@index([sortOrder])
  @@map("dim_stage")
}

/** Trọng số từng giai đoạn theo dự án. weightPct là ĐIỂM PHẦN TRĂM 0..100, tổng applicable = 100. */
model ProjectStageWeight {
  projectId  Int
  stageCode  String
  weightPct  Float   @default(0)
  applicable Boolean @default(true)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stage   Stage   @relation(fields: [stageCode], references: [code])

  @@id([projectId, stageCode])
  @@map("project_stage_weight")
}

/** Hạng mục động theo dự án (Hệ giàn nâng, Hệ mái, … Hệ Walkaway). */
model ProjectWorkItem {
  id        Int    @id @default(autoincrement())
  projectId Int
  name      String
  sortOrder Int    @default(0)

  project Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  facts   FactStageWorkItem[]

  @@unique([projectId, name])
  @@index([projectId, sortOrder])
  @@map("project_work_item")
}

/** Sản lượng KH/TT (tấn) theo hạng mục × giai đoạn × tháng - nguồn tính %HT giai đoạn volume. */
model FactStageWorkItem {
  projectId  Int
  stageCode  String
  workItemId Int
  yearMonth  String
  qtyPlan    Float @default(0)
  qtyActual  Float @default(0)

  project  Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stage    Stage           @relation(fields: [stageCode], references: [code])
  workItem ProjectWorkItem @relation(fields: [workItemId], references: [id], onDelete: Cascade)

  @@id([projectId, stageCode, workItemId, yearMonth])
  @@index([projectId, yearMonth])
  @@map("fact_stage_work_item")
}

/**
 * 5 cột ngày của từng giai đoạn. Mốc thứ 6 "Ngày chênh lệch" (actualFinish − plannedFinish)
 * CỐ Ý không có cột: tính runtime bằng calcDayVariance() (Q1), tránh dữ liệu tự mâu thuẫn
 * khi sửa plannedFinish/actualFinish mà quên cập nhật cột dẫn xuất.
 */
model FactStageMilestone {
  projectId     Int
  stageCode     String
  plannedStart  DateTime?
  plannedFinish DateTime?
  actualStart   DateTime?
  actualFinish  DateTime?
  forecastDate  DateTime?
  updatedAt     DateTime  @updatedAt
  updatedBy     String    @default("system")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stage   Stage   @relation(fields: [stageCode], references: [code])

  @@id([projectId, stageCode])
  @@map("fact_stage_milestone")
}

/** Mốc chính động của dự án (danh sách do người dùng tự định nghĩa). */
model ProjectKeyMilestone {
  id          Int       @id @default(autoincrement())
  projectId   Int
  name        String
  sortOrder   Int       @default(0)
  plannedDate DateTime?
  actualDate  DateTime?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, sortOrder])
  @@map("project_key_milestone")
}

// ---- ERP: nguồn lực ----

/** Nhà thầu phụ - theo đúng pattern dim_customer (isActive + mergedIntoId để gộp trùng). */
model Contractor {
  id           Int     @id @default(autoincrement())
  name         String
  scopeOfWork  String  @default("")
  isActive     Boolean @default(true)
  mergedIntoId Int?

  mergedInto Contractor?  @relation("ContractorMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom Contractor[] @relation("ContractorMerge")
  projects   ProjectContractor[]
  manpower   FactDailyManpower[]
  equipment  FactDailyEquipmentUsage[]

  @@map("dim_contractor")
}

model ProjectContractor {
  projectId    Int
  contractorId Int

  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  contractor Contractor @relation(fields: [contractorId], references: [id], onDelete: Cascade)

  @@id([projectId, contractorId])
  @@map("project_contractor")
}

model Equipment {
  id       Int     @id @default(autoincrement())
  name     String
  unit     String  @default("cái")
  isActive Boolean @default(true)

  usages FactDailyEquipmentUsage[]

  @@map("dim_equipment")
}

/** Nhân lực theo NGÀY × nhà thầu. */
model FactDailyManpower {
  projectId        Int
  contractorId     Int
  workDate         DateTime @db.Date
  plannedHeadcount Int      @default(0)
  actualHeadcount  Int      @default(0)

  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  contractor Contractor @relation(fields: [contractorId], references: [id], onDelete: Cascade)

  @@id([projectId, contractorId, workDate])
  @@index([projectId, workDate])
  @@map("fact_daily_manpower")
}

/** Bảng nối nhiều-nhiều: 1 nhà thầu dùng nhiều thiết bị, 1 thiết bị dùng chung nhiều nhà thầu.
 *  Q4 đã chốt: tách `qtyPlanned`/`qtyActual` (một cột `qty` không thể vừa KH vừa TT). */
model FactDailyEquipmentUsage {
  projectId    Int
  contractorId Int
  equipmentId  Int
  workDate     DateTime @db.Date
  qtyPlanned   Int      @default(0)
  qtyActual    Int      @default(0)

  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  contractor Contractor @relation(fields: [contractorId], references: [id], onDelete: Cascade)
  equipment  Equipment  @relation(fields: [equipmentId], references: [id], onDelete: Cascade)

  @@id([projectId, contractorId, equipmentId, workDate])
  @@index([projectId, workDate])
  @@map("fact_daily_equipment_usage")
}
```

- [ ] **Bước 6: Sinh migration (create-only) và soi SQL**

```bash
npx prisma migrate dev --name erp_model_v2 --create-only
```
Mở file `prisma/migrations/<timestamp>_erp_model_v2/migration.sql` và **kiểm 3 điểm**:

1. **Chuyển String → enum có `USING` không?** Nếu Prisma sinh
   `ALTER TABLE "dim_project" ALTER COLUMN "marketCode" TYPE "MarketCode";` (thiếu `USING`)
   thì Postgres báo `column cannot be cast automatically`. Sửa tay thành:
   ```sql
   ALTER TABLE "dim_project" ALTER COLUMN "marketCode" TYPE "MarketCode" USING ("marketCode"::text::"MarketCode");
   ```
   Làm tương tự cho `projectType`, `priority`, `alert_log.alertType`,
   `project_assignments.roleInProject`, `sap_queue.status`.
   Với `sap_queue.status` phải **bỏ DEFAULT trước, đổi kiểu, rồi đặt lại DEFAULT**:
   ```sql
   ALTER TABLE "sap_queue" ALTER COLUMN "status" DROP DEFAULT;
   ALTER TABLE "sap_queue" ALTER COLUMN "status" TYPE "SapQueueStatus" USING ("status"::text::"SapQueueStatus");
   ALTER TABLE "sap_queue" ALTER COLUMN "status" SET DEFAULT 'pending';
   ```
2. **Đổi PK của 2 bảng fact.** Prisma sẽ sinh `DROP CONSTRAINT … PKEY` +
   `ADD CONSTRAINT … PRIMARY KEY ("projectId","yearMonth","version")`. Đúng thì để nguyên.
3. **Khoá ngoại.** Mọi `ADD CONSTRAINT … FOREIGN KEY` phải có mặt. Đếm cho chắc:
   `grep -c "FOREIGN KEY" migration.sql` phải **> 0** (hiện tại migration init đang là 0).

- [ ] **Bước 7: Thêm tay partial unique index vào cuối file migration**

```sql
-- Bất biến append-only: mỗi (projectId, yearMonth) chỉ có ĐÚNG 1 dòng isLatest = true.
-- Prisma không diễn đạt được index có mệnh đề WHERE nên phải viết tay ở đây.
-- CẢNH BÁO: lần `prisma migrate dev` sau có thể sinh DROP INDEX cho 2 index này.
-- Luôn dùng --create-only, xem SQL, xoá lệnh DROP đó trước khi apply.
CREATE UNIQUE INDEX "ux_fact_progress_latest"
  ON "fact_progress_monthly" ("projectId", "yearMonth")
  WHERE "isLatest";

CREATE UNIQUE INDEX "ux_fact_financial_latest"
  ON "fact_financial" ("projectId", "yearMonth")
  WHERE "isLatest";
```

- [ ] **Bước 8: Apply migration + sinh client**

```bash
npx prisma migrate dev
npx prisma generate
npx prisma migrate status     # phải báo: không còn migration chờ
```
Nếu apply thất bại vì dữ liệu cũ (giá trị ngoài enum, orphan FK):
`npx prisma migrate reset` rồi chạy lại — Task 6 sẽ seed lại toàn bộ.

- [ ] **Bước 9: Commit**

```bash
git add prisma
git commit -m "feat(schema): 11 bảng ERP mới, enum + khoá ngoại, fact append-only theo version/isLatest"
```

---

## Task 5: Đồng bộ 3 bản sao còn lại của data model

Model được khai lại ở **bốn** nơi và không có gì ép chúng đồng bộ. Task 4 đã làm bản 1
(`prisma/schema.prisma`). Task này làm 3 bản còn lại. Bỏ sót chỗ nào là trang ERD
`/data-schema` và từ điển `/data-dictionary` nói dối người dùng.

**Files:**
- Modify: `src/server/repo/types.ts`, `src/lib/data-schema.ts`, `src/lib/data-dictionary.ts`

**Interfaces — Produces (types.ts):**
```ts
export type StageCalcMode = 'manual' | 'volume';

export interface Stage {
  code: StageCode;
  nameVi: string;
  nameEn: string;
  sortOrder: number;
  calcMode: StageCalcMode;
}

export interface ProjectStageWeight {
  projectId: number;
  stageCode: StageCode;
  weightPct: number;      // điểm phần trăm 0..100
  applicable: boolean;
}

export interface ProjectWorkItem {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
}

export interface FactStageWorkItem {
  projectId: number;
  stageCode: StageCode;
  workItemId: number;
  yearMonth: string;      // 'YYYY-MM'
  qtyPlan: number;        // tấn
  qtyActual: number;      // tấn
}

/** Đúng 5 cột ngày có thật trong DB - dùng cho seed/ghi. */
export interface FactStageMilestone {
  projectId: number;
  stageCode: StageCode;
  plannedStart: string | null;    // 'YYYY-MM-DD'
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  forecastDate: string | null;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Cái mà repo TRẢ RA khi đọc: 5 cột DB + mốc thứ 6 "Ngày chênh lệch" tính runtime (Q1).
 * Tách riêng khỏi FactStageMilestone để `prisma.factStageMilestone.createMany` trong seed
 * không bị lỗi "Unknown arg dayVariance".
 */
export interface StageMilestoneView extends FactStageMilestone {
  /** actualFinish − plannedFinish, tính bằng ngày. Dương = trễ · âm = sớm · null = chưa kết thúc. */
  dayVariance: number | null;
}

export interface ProjectKeyMilestone {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
  plannedDate: string | null;
  actualDate: string | null;
}

export interface Contractor {
  id: number;
  name: string;
  scopeOfWork: string;
  isActive: boolean;
  mergedIntoId: number | null;
}

export interface ProjectContractor {
  projectId: number;
  contractorId: number;
}

export interface Equipment {
  id: number;
  name: string;
  unit: string;
  isActive: boolean;
}

export interface FactDailyManpower {
  projectId: number;
  contractorId: number;
  workDate: string;       // 'YYYY-MM-DD'
  plannedHeadcount: number;
  actualHeadcount: number;
}

export interface FactDailyEquipmentUsage {
  projectId: number;
  contractorId: number;
  equipmentId: number;
  workDate: string;       // 'YYYY-MM-DD'
  qtyPlanned: number;
  qtyActual: number;
}
```

- [ ] **Bước 1: `src/server/repo/types.ts` — thêm 11 interface trên + kiểu đọc `StageMilestoneView`**

Đặt sau `ValueChainProgress` (dòng 147), trước `FactFinancial`, kèm comment khối:
```ts
// ---- ERP model v2: giai đoạn có trọng số, sản lượng hạng mục, mốc, nguồn lực ----
```

- [ ] **Bước 2: `src/server/repo/types.ts` — sửa 2 interface cũ**

`FactProgressMonthly`: thêm 3 field ngay dưới `equipmentActual`:
```ts
  isLatest: boolean;       // true = bản mới nhất của (projectId, yearMonth)
  manpowerPlanned: number;
  manpowerActual: number;
```
Sửa comment dòng 135 của `version` thành:
`version: number; // append-only: mỗi lần lưu = version mới; bản mới nhất có isLatest = true`

`FactFinancial`: thêm `isLatest: boolean;` ngay dưới `version`.

- [ ] **Bước 3: `src/lib/data-schema.ts` — thêm 11 entity + cập nhật 2 entity cũ**

Giữ nguyên format `SchemaEntity`. Thêm `kind` mới không cần — dùng lại `'dim' | 'fact' | 'support'`.
Chèn `dim_stage`, `dim_contractor`, `dim_equipment` vào cụm `dim` (sau `factories`);
các bảng `project_*` và `fact_*` mới chèn sau `value_chain_progress`.

```ts
  {
    name: 'dim_stage',
    kind: 'dim',
    desc: '7 giai đoạn chuỗi giá trị - dimension thật (trước đây là hằng số trong code).',
    fields: [
      { name: 'code', type: 'string', key: 'PK', desc: 'design…handover' },
      { name: 'nameVi', type: 'string' },
      { name: 'nameEn', type: 'string' },
      { name: 'sortOrder', type: 'int', desc: 'thứ tự trong chuỗi giá trị' },
      { name: 'calcMode', type: 'string', desc: 'manual = nhập tay %HT · volume = suy từ sản lượng hạng mục' },
    ],
  },
  {
    name: 'project_stage_weight',
    kind: 'support',
    desc: 'Trọng số từng giai đoạn theo dự án. Tổng các giai đoạn áp dụng = 100.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'weightPct', type: 'number', desc: 'ĐIỂM phần trăm 0..100 (Gia công = 40), KHÔNG phải phân số' },
      { name: 'applicable', type: 'bool', desc: 'false = dự án không có giai đoạn này' },
    ],
  },
  {
    name: 'project_work_item',
    kind: 'support',
    desc: 'Hạng mục động theo dự án (Hệ giàn nâng … Hệ Walkaway).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'name', type: 'string', desc: 'duy nhất trong 1 dự án' },
      { name: 'sortOrder', type: 'int' },
    ],
  },
  {
    name: 'fact_stage_work_item',
    kind: 'fact',
    desc: 'Sản lượng KH/TT (tấn) theo hạng mục × giai đoạn × tháng. Nguồn tính %HT giai đoạn định lượng.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'workItemId', type: 'int', key: 'FK', ref: 'project_work_item.id' },
      { name: 'yearMonth', type: 'string (YYYY-MM)' },
      { name: 'qtyPlan', type: 'number', desc: 'tấn' },
      { name: 'qtyActual', type: 'number', desc: 'tấn' },
    ],
  },
  {
    name: 'fact_stage_milestone',
    kind: 'fact',
    desc: 'Các mốc ngày của từng giai đoạn trong 1 dự án. "Ngày chênh lệch" KHÔNG phải cột: hệ thống tự tính = TT kết thúc − KH hoàn thành.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' },
      { name: 'plannedStart', type: 'date?' },
      { name: 'plannedFinish', type: 'date?' },
      { name: 'actualStart', type: 'date?' },
      { name: 'actualFinish', type: 'date?' },
      { name: 'forecastDate', type: 'date?', desc: 'ngày dự báo hoàn thành hiện tại' },
      { name: 'updatedAt', type: 'datetime' },
      { name: 'updatedBy', type: 'string' },
    ],
  },
  {
    name: 'project_key_milestone',
    kind: 'support',
    desc: 'Mốc chính của dự án - danh sách động, do người dùng tự định nghĩa.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'name', type: 'string' },
      { name: 'sortOrder', type: 'int' },
      { name: 'plannedDate', type: 'date?' },
      { name: 'actualDate', type: 'date?', desc: 'null = chưa đạt mốc' },
    ],
  },
  {
    name: 'dim_contractor',
    kind: 'dim',
    desc: 'Nhà thầu phụ (chuẩn hóa, gộp trùng qua mergedIntoId như dim_customer).',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'scopeOfWork', type: 'string', desc: 'phạm vi công việc' },
      { name: 'isActive', type: 'bool' },
      { name: 'mergedIntoId', type: 'int?', key: 'FK', ref: 'dim_contractor.id' },
    ],
  },
  {
    name: 'project_contractor',
    kind: 'support',
    desc: 'Nhà thầu tham gia dự án.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'contractorId', type: 'int', key: 'FK', ref: 'dim_contractor.id' },
    ],
  },
  {
    name: 'dim_equipment',
    kind: 'dim',
    desc: 'Nhóm thiết bị thi công.',
    fields: [
      { name: 'id', type: 'int', key: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'unit', type: 'string', desc: 'đơn vị đếm (cái, bộ…)' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'fact_daily_manpower',
    kind: 'fact',
    desc: 'Nhân lực theo NGÀY theo nhà thầu.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'contractorId', type: 'int', key: 'FK', ref: 'dim_contractor.id' },
      { name: 'workDate', type: 'date' },
      { name: 'plannedHeadcount', type: 'int' },
      { name: 'actualHeadcount', type: 'int' },
    ],
  },
  {
    name: 'fact_daily_equipment_usage',
    kind: 'fact',
    desc: 'Thiết bị theo NGÀY - bảng nối nhiều-nhiều giữa nhà thầu và nhóm thiết bị.',
    fields: [
      { name: 'projectId', type: 'int', key: 'FK', ref: 'projects.id' },
      { name: 'contractorId', type: 'int', key: 'FK', ref: 'dim_contractor.id' },
      { name: 'equipmentId', type: 'int', key: 'FK', ref: 'dim_equipment.id' },
      { name: 'workDate', type: 'date' },
      { name: 'qtyPlanned', type: 'int' },
      { name: 'qtyActual', type: 'int' },
    ],
  },
```

Cập nhật entity cũ trong cùng file:
- `fact_progress_monthly` (dòng 127-153): thêm
  `{ name: 'isLatest', type: 'bool', desc: 'true = bản mới nhất của (projectId, yearMonth)' }`,
  `{ name: 'manpowerPlanned', type: 'number' }`, `{ name: 'manpowerActual', type: 'number' }`;
  sửa `desc` của `version` thành `'khoá chính gồm cả version - lịch sử KHÔNG bị ghi đè'`;
  sửa `desc` của entity thành `'Tiến độ theo tháng (%KH nhập tay, %TT, PV/EV/AC) - append-only.'`;
  sửa field `pctPlan` (dòng 133) thành
  `{ name: 'pctPlan', type: 'number', desc: '% KH NGƯỜI DÙNG NHẬP TAY - chỉ để tra lịch sử. PV/SPI và "% Kế hoạch" hiển thị đều tính từ thời gian (Q2).' }`;
  thêm `desc` cho 4 cột nguồn lực tháng:
  `'số tháng nhập tay - scorecard nhân lực/thiết bị đọc bảng theo ngày (Q3)'`.
- `fact_financial` (dòng 155-176): thêm `{ name: 'isLatest', type: 'bool' }`.
- `value_chain_progress` (dòng 188-198): đánh dấu `stageCode` là FK:
  `{ name: 'stageCode', type: 'string', key: 'FK', ref: 'dim_stage.code' }`
  và thêm field `applicable` đang bị thiếu:
  `{ name: 'applicable', type: 'bool', desc: 'false = dự án không có giai đoạn này' }`.

- [ ] **Bước 4: `src/lib/data-dictionary.ts` — thêm 2 section mới**

Chèn sau section `'Số liệu tháng'`:

```ts
  {
    titleVi: 'Chuỗi giá trị & trọng số',
    titleEn: 'Value chain & weights',
    entries: [
      { fieldVi: 'Trọng số giai đoạn', fieldEn: 'Stage weight', meaningVi: 'Mức quan trọng của từng giai đoạn trong tổng tiến độ, tính bằng ĐIỂM phần trăm. Mặc định: Thiết kế 5, Shop Drawing 10, Vật tư 10, Gia công 40, Vận chuyển 5, Lắp dựng 27, Nghiệm thu & Bàn giao 3. Tổng các giai đoạn áp dụng phải bằng 100.', meaningEn: 'How much each stage counts toward overall progress, in percentage points. Default: Design 5, Shop Drawing 10, Materials 10, Fabrication 40, Transport 5, Erection 27, Handover 3. Applicable stages must total 100.' },
      { fieldVi: '% TT tổng thể', fieldEn: '% Actual (overall)', meaningVi: 'Tiến độ chung của dự án = tổng có trọng số của 7 giai đoạn. Xong Gia công (trọng số 40) đóng góp nhiều gấp 8 lần xong Thiết kế (trọng số 5).', meaningEn: 'Overall project progress = weighted sum across the 7 stages. Finishing Fabrication (weight 40) counts 8× more than finishing Design (weight 5).', formulaVi: '% TT = Σ(trọng số × %HT giai đoạn) / Σ(trọng số áp dụng)', formulaEn: '% Actual = Σ(weight × stage %) / Σ(applicable weights)' },
      { fieldVi: 'Cách tính giai đoạn', fieldEn: 'Stage calc mode', meaningVi: 'Nhập tay = người dùng gõ %HT · Theo sản lượng = hệ thống tự tính từ khối lượng hạng mục đã làm.', meaningEn: 'Manual = user types the % · Volume = system computes it from completed work-item tonnage.', formulaVi: '%HT (theo sản lượng) = Σ khối lượng TT / Σ khối lượng KH', formulaEn: '% (volume) = Σ actual qty / Σ planned qty' },
      { fieldVi: 'Đóng góp vào tổng', fieldEn: 'Contribution', meaningVi: 'Phần điểm mà một giai đoạn đang góp vào % TT tổng thể. Cộng cả 7 dòng ra đúng % TT.', meaningEn: 'How many points a stage currently contributes to overall % actual. The 7 rows sum to % actual.', formulaVi: 'Đóng góp = trọng số × %HT / Σ trọng số áp dụng', formulaEn: 'Contribution = weight × stage % / Σ applicable weights' },
      { fieldVi: '% Kế hoạch', fieldEn: '% Plan', meaningVi: 'Theo lịch thì lẽ ra đã xong bao nhiêu phần trăm, tính bằng số ngày đã trôi so với tổng số ngày kế hoạch. Đây là ĐỊNH NGHĨA DUY NHẤT của "% Kế hoạch" trên toàn hệ thống. Thiếu ngày KH bắt đầu/kết thúc thì để trống.', meaningEn: 'How much should be done by the calendar: days elapsed over total planned days. This is the ONLY definition of "% Plan" in the system. Blank when planned start/finish is missing.', formulaVi: '% KH = (Ngày xét − Ngày BĐ KH) / (Ngày KT KH − Ngày BĐ KH), kẹp trong [0, 1]', formulaEn: '% Plan = (Date in question − Planned start) / (Planned finish − Planned start), clamped to [0, 1]' },
      { fieldVi: '% KH nhập tay', fieldEn: '% Plan (manual entry)', meaningVi: 'Con số % kế hoạch do người nhập liệu tự gõ trong form hàng tháng. Chỉ lưu để tra lịch sử và đối chiếu; hệ thống KHÔNG dùng nó để tính PV/SPI hay để hiển thị "% Kế hoạch".', meaningEn: 'The plan % typed by the data-entry user in the monthly form. Stored for history and reconciliation only; it is NOT used for PV/SPI or to display "% Plan".' },
      { fieldVi: 'PV (Giá trị kế hoạch)', fieldEn: 'PV (Planned Value)', meaningVi: 'Phần giá trị hợp đồng lẽ ra đã phải làm xong tính đến thời điểm xét, suy từ % Kế hoạch theo thời gian.', meaningEn: 'The share of contract value that should have been earned by the date in question, derived from the duration-based % Plan.', formulaVi: 'PV = % KH (theo thời gian) × BAC · SPI = EV / PV', formulaEn: 'PV = duration-based % Plan × BAC · SPI = EV / PV' },
    ],
  },
  {
    titleVi: 'Sản lượng, mốc & nguồn lực',
    titleEn: 'Volume, milestones & resources',
    entries: [
      { fieldVi: 'Hạng mục', fieldEn: 'Work item', meaningVi: 'Cụm kết cấu được theo dõi riêng trong dự án (Hệ giàn nâng, Hệ Walkaway…). Danh sách do từng dự án tự định nghĩa.', meaningEn: 'A structural package tracked separately (lifting frame, walkway…). Each project defines its own list.' },
      { fieldVi: 'Sản lượng KH / TT', fieldEn: 'Planned / actual qty', meaningVi: 'Khối lượng thép (tấn) theo kế hoạch và đã làm được, ghi theo từng hạng mục × giai đoạn × tháng.', meaningEn: 'Steel tonnage planned vs completed, recorded per work item × stage × month.' },
      { fieldVi: 'Mốc ngày giai đoạn', fieldEn: 'Stage milestones', meaningVi: 'Mỗi giai đoạn có 6 mốc: KH bắt đầu, KH kết thúc, TT bắt đầu, TT kết thúc, ngày dự báo hoàn thành, và Ngày chênh lệch.', meaningEn: 'Each stage has 6 markers: planned start/finish, actual start/finish, forecast date, and day variance.' },
      { fieldVi: 'Ngày chênh lệch', fieldEn: 'Day variance', meaningVi: 'Giai đoạn kết thúc trễ (số dương) hay sớm (số âm) bao nhiêu ngày so với kế hoạch. Hệ thống tự tính, không ai nhập. Chưa có ngày kết thúc thực tế thì để trống - khác với 0 nghĩa là đúng hạn.', meaningEn: 'How many days the stage finished late (positive) or early (negative) versus plan. Computed, never entered. Blank until there is an actual finish date - different from 0, which means exactly on time.', formulaVi: 'Ngày chênh lệch = Ngày KT thực tế − Ngày KH hoàn thành', formulaEn: 'Day variance = Actual finish − Planned finish' },
      { fieldVi: 'Mốc chính', fieldEn: 'Key milestone', meaningVi: 'Cột mốc quan trọng của dự án do người dùng tự thêm, có ngày kế hoạch và ngày thực tế. Chưa có ngày thực tế = chưa đạt mốc.', meaningEn: 'A user-defined project milestone with planned and actual dates. No actual date = not reached yet.' },
      { fieldVi: 'Nhà thầu', fieldEn: 'Contractor', meaningVi: 'Nhà thầu phụ tham gia dự án, kèm phạm vi công việc.', meaningEn: 'Subcontractor on the project, with its scope of work.' },
      { fieldVi: 'Nhân lực theo ngày', fieldEn: 'Daily manpower', meaningVi: 'Số người kế hoạch và thực tế có mặt mỗi ngày, tách theo từng nhà thầu.', meaningEn: 'Planned vs actual headcount per day, split by contractor.' },
      { fieldVi: 'Thiết bị theo ngày', fieldEn: 'Daily equipment', meaningVi: 'Số lượng từng nhóm thiết bị huy động mỗi ngày. Một nhà thầu dùng nhiều nhóm thiết bị và một nhóm thiết bị có thể dùng chung bởi nhiều nhà thầu.', meaningEn: 'Quantity of each equipment group mobilised per day. One contractor uses many groups; one group can be shared by many contractors.' },
      { fieldVi: 'Tổng nguồn lực', fieldEn: 'Resource totals', meaningVi: 'Con số tổng nhân lực/thiết bị luôn lấy từ bảng THEO NGÀY và là ẢNH CHỤP CỦA NGÀY GẦN NHẤT CÓ DỮ LIỆU, KHÔNG phải cộng dồn cả khoảng (cộng dồn 7 ngày sẽ ra số người gấp 7 lần). Ngày của số liệu luôn được ghi ngay dưới con số.', meaningEn: 'Manpower/equipment totals always come from the DAILY tables and are a SNAPSHOT OF THE LATEST DAY WITH DATA, not a sum over the range (summing 7 days would multiply headcount by 7). The date behind the number is always shown under it.' },
      { fieldVi: 'Nhân lực theo tuần / tháng', fieldEn: 'Manpower by week / month', meaningVi: 'Khi xem biểu đồ nhân lực theo tuần hoặc theo tháng, mỗi điểm là SỐ NGƯỜI TRUNG BÌNH MỖI NGÀY trong khoảng đó, không phải tổng lượt người.', meaningEn: 'In the weekly/monthly manpower chart each point is the AVERAGE HEADCOUNT PER DAY in that bucket, not a sum of person-days.' },
    ],
  },
```

- [ ] **Bước 5: Kiểm chứng + commit**

```bash
npx tsc --noEmit && npx vitest run
```
Mở `/data-schema` và `/data-dictionary` xem 11 bảng + 2 section mới hiển thị đủ.
Đối chiếu bằng mắt: mọi `model` trong `prisma/schema.prisma` đều có một `SchemaEntity`
tương ứng trong `data-schema.ts` (bảng `dim_exchange_rate` đang tên `exchange_rates` — giữ nguyên).

```bash
git commit -am "feat(model): đồng bộ types.ts + data-schema.ts + data-dictionary.ts với schema ERP v2"
```

---

## Task 6: Seed + mock-repo

Seed có **một nguồn duy nhất** `buildRepoData()` (`src/data/seed/history.ts`) chảy vào ba đích:
mock in-memory, `.data/ddc-mock.json`, và Postgres qua `prisma/seed.ts`. Giữ nguyên kiến trúc đó,
chỉ mở rộng generator.

**Files:**
- Create: `src/data/seed/erp.ts` (hằng số nhà thầu / thiết bị / hạng mục / mốc chính)
- Modify: `src/data/seed/history.ts`, `src/data/seed/history.test.ts`,
  `src/server/repo/mock-repo.ts`, `prisma/seed.ts`

**Interfaces — Consumes:** `DEFAULT_STAGE_WEIGHTS`, `STAGE_CALC_MODE` (Task 2) ·
11 interface mới trong `types.ts` (Task 5).

- [ ] **Bước 1: Tạo `src/data/seed/erp.ts` — hằng số dimension mới**

```ts
import type { Contractor, Equipment, Stage } from '@/server/repo/types';
import { DEFAULT_STAGE_WEIGHTS, STAGE_CALC_MODE, STAGE_ORDER } from '@/lib/stages';

/** 7 giai đoạn thành dimension thật. Tên song ngữ khớp i18n key stage.* trong src/lib/labels.ts. */
export const stages: Stage[] = [
  { code: 'design', nameVi: 'Thiết kế', nameEn: 'Design', sortOrder: 1, calcMode: STAGE_CALC_MODE.design },
  { code: 'shop', nameVi: 'Shop Drawing', nameEn: 'Shop Drawing', sortOrder: 2, calcMode: STAGE_CALC_MODE.shop },
  { code: 'procurement', nameVi: 'Vật tư', nameEn: 'Materials', sortOrder: 3, calcMode: STAGE_CALC_MODE.procurement },
  { code: 'fabrication', nameVi: 'Gia công', nameEn: 'Fabrication', sortOrder: 4, calcMode: STAGE_CALC_MODE.fabrication },
  { code: 'transport', nameVi: 'Vận chuyển', nameEn: 'Transport', sortOrder: 5, calcMode: STAGE_CALC_MODE.transport },
  { code: 'erection', nameVi: 'Lắp dựng', nameEn: 'Erection', sortOrder: 6, calcMode: STAGE_CALC_MODE.erection },
  { code: 'handover', nameVi: 'Nghiệm thu & Bàn giao', nameEn: 'Handover', sortOrder: 7, calcMode: STAGE_CALC_MODE.handover },
];

/** 6 nhà thầu phụ đã chốt (Q8). */
export const contractors: Contractor[] = [
  { id: 1, name: 'Nhà thầu Lắp dựng A', scopeOfWork: 'Lắp dựng kết cấu chính', isActive: true, mergedIntoId: null },
  { id: 2, name: 'Nhà thầu Lắp dựng B', scopeOfWork: 'Lắp dựng mái & sàn', isActive: true, mergedIntoId: null },
  { id: 3, name: 'Nhà thầu Cơ khí C', scopeOfWork: 'Gia công tại công trường', isActive: true, mergedIntoId: null },
  { id: 4, name: 'Nhà thầu Sơn D', scopeOfWork: 'Sơn hoàn thiện', isActive: true, mergedIntoId: null },
  { id: 5, name: 'Nhà thầu Vận chuyển E', scopeOfWork: 'Vận chuyển & tập kết', isActive: true, mergedIntoId: null },
  { id: 6, name: 'Nhà thầu An toàn F', scopeOfWork: 'Giàn giáo & an toàn', isActive: true, mergedIntoId: null },
];

/** 7 nhóm thiết bị đã chốt (Q8). */
export const equipments: Equipment[] = [
  { id: 1, name: 'Cẩu bánh xích', unit: 'cái', isActive: true },
  { id: 2, name: 'Cẩu bánh lốp', unit: 'cái', isActive: true },
  { id: 3, name: 'Xe nâng người', unit: 'cái', isActive: true },
  { id: 4, name: 'Máy hàn', unit: 'bộ', isActive: true },
  { id: 5, name: 'Máy phát điện', unit: 'cái', isActive: true },
  { id: 6, name: 'Xe tải chuyên dụng', unit: 'xe', isActive: true },
  { id: 7, name: 'Giàn giáo di động', unit: 'bộ', isActive: true },
];

/** 10 hạng mục đã chốt (Q6), thứ tự này = sortOrder 1..10. */
export const workItemNames: string[] = [
  'Hệ giàn nâng',
  'Hệ cột chính',
  'Hệ dầm sàn',
  'Hệ vì kèo mái',
  'Hệ xà gồ',
  'Hệ giằng',
  'Hệ sàn thao tác',
  'Hệ lan can',
  'Hệ cầu thang',
  'Hệ Walkaway',
];

/** 5 mốc chính đã chốt (Q7) - đúng 2 mốc đầu đã có ngày thực tế. */
export const keyMilestoneSeed: { name: string; plannedDate: string; actualDate: string | null }[] = [
  { name: 'Duyệt thiết kế kỹ thuật', plannedDate: '2026-01-15', actualDate: '2026-01-18' },
  { name: 'Duyệt Shop Drawing đợt 1', plannedDate: '2026-03-01', actualDate: '2026-03-06' },
  { name: 'Xuất xưởng lô đầu tiên', plannedDate: '2026-06-30', actualDate: null },
  { name: 'Hoàn thành lắp dựng', plannedDate: '2026-09-15', actualDate: null },
  { name: 'Nghiệm thu bàn giao', plannedDate: '2026-09-29', actualDate: null },
];

/**
 * Nhân lực ngày cuối cùng của cửa sổ tracking - tổng KH 520 / TT 486 (theo mock-up đã duyệt).
 * Các ngày trước nhân hệ số DAY_FACTORS rồi làm tròn; chỉ ngày cuối được assert trong test.
 */
export const manpowerLastDay: { contractorId: number; planned: number; actual: number }[] = [
  { contractorId: 1, planned: 120, actual: 112 },
  { contractorId: 2, planned: 100, actual: 95 },
  { contractorId: 3, planned: 90, actual: 82 },
  { contractorId: 4, planned: 80, actual: 76 },
  { contractorId: 5, planned: 70, actual: 65 },
  { contractorId: 6, planned: 60, actual: 56 },
];
// Tổng: 520 / 486

/**
 * Thiết bị ngày cuối - tổng KH 72 / TT 63.
 * Cố ý dựng quan hệ nhiều-nhiều: NT1 dùng 3 nhóm thiết bị (TB1/TB2/TB3),
 * TB1 dùng chung bởi NT1+NT2+NT3, TB2 dùng chung bởi NT1+NT6.
 */
export const equipmentLastDay: { contractorId: number; equipmentId: number; planned: number; actual: number }[] = [
  { contractorId: 1, equipmentId: 1, planned: 6, actual: 5 },
  { contractorId: 2, equipmentId: 1, planned: 5, actual: 4 },
  { contractorId: 3, equipmentId: 1, planned: 3, actual: 3 },   // TB1 = 14 / 12
  { contractorId: 1, equipmentId: 2, planned: 8, actual: 7 },
  { contractorId: 6, equipmentId: 2, planned: 4, actual: 4 },   // TB2 = 12 / 11
  { contractorId: 1, equipmentId: 3, planned: 11, actual: 10 }, // TB3 = 11 / 10
  { contractorId: 2, equipmentId: 4, planned: 10, actual: 9 },  // TB4 = 10 / 9
  { contractorId: 3, equipmentId: 5, planned: 9, actual: 8 },   // TB5 = 9 / 8
  { contractorId: 4, equipmentId: 6, planned: 8, actual: 7 },   // TB6 = 8 / 7
  { contractorId: 5, equipmentId: 7, planned: 8, actual: 6 },   // TB7 = 8 / 6
];
// Tổng: 72 / 63

/** Hệ số 7 ngày tracking, ngày cuối = 1 (đúng con số mock-up). */
export const DAY_FACTORS = [0.86, 0.88, 0.91, 0.93, 0.96, 0.98, 1];

/** Dự án nhận trọn bộ dữ liệu ERP chi tiết: id = 1 (SVĐ PVF) - đã chốt (Q9). */
export const ERP_DETAIL_PROJECT_ID = 1;

export { DEFAULT_STAGE_WEIGHTS, STAGE_ORDER };
```

- [ ] **Bước 2: Sửa `buildAssignments` trong `src/data/seed/history.ts` (dòng 256-270)**

Seed hiện gán PIC cho `dev@localhost`, `pm1@daidung.com.vn`, `pm2@daidung.com.vn` —
**không email nào tồn tại trong `userRoles`**, nên `requireProjectRead` (`src/server/authz.ts`,
viết ở chunk sau — xem "Bản đồ file") sẽ khoá sạch 4 tài khoản thật. Sửa sang email thật (Q10 đã chốt):

```ts
/**
 * Phân quyền PIC từng dự án. Email PHẢI khớp userRoles bên dưới, nếu không
 * data-entry/viewer sẽ không đọc được dự án nào sau khi requireProjectRead có hiệu lực.
 */
function buildAssignments(projects: Project[]): ProjectAssignment[] {
  const pmOwns = new Set([1, 2, 3, 5, 7, 11]);       // pm@daidung.com.vn là PIC
  const viewerSees = new Set([1, 2, 4, 6, 8, 10]);   // viewer@ được gán Backup để có quyền đọc
  const out: ProjectAssignment[] = [];
  for (const p of projects) {
    out.push({
      projectId: p.id,
      userEmail: pmOwns.has(p.id) ? 'pm@daidung.com.vn' : 'admin@daidung.com.vn',
      roleInProject: 'PIC',
      assignedBy: 'Trưởng phòng KHDATT',
      assignedAt: '2026-01-01T00:00:00Z',
    });
    if (viewerSees.has(p.id)) {
      out.push({
        projectId: p.id,
        userEmail: 'viewer@daidung.com.vn',
        roleInProject: 'Backup',
        assignedBy: 'Trưởng phòng KHDATT',
        assignedAt: '2026-01-01T00:00:00Z',
      });
    }
  }
  return out;
}
```
Kết quả để test authz (chunk sau) dựa vào: `pm@` là PIC của **1, 2, 3, 5, 7, 11** ·
`viewer@` đọc được **1, 2, 4, 6, 8, 10** · cả hai đều KHÔNG có quyền ở dự án **17**.

- [ ] **Bước 3: Đổi `STAGE_WEIGHTS` nội bộ sang bộ trọng số đã duyệt**

`src/data/seed/history.ts:43-51` đang là bộ cũ 6/12/10/34/5/28/5. Xoá hẳn, thay bằng:
```ts
import { DEFAULT_STAGE_WEIGHTS } from '@/lib/stages';

/** buildValueChain dùng phân số, còn DEFAULT_STAGE_WEIGHTS là điểm phần trăm → chia 100. */
const STAGE_WEIGHT_FRACTIONS = DEFAULT_STAGE_WEIGHTS.map((w) => ({
  stage: w.stageCode,
  weight: w.weightPct / 100,
}));
```
`buildValueChain` (dòng 86-95) đổi vòng lặp sang `STAGE_WEIGHT_FRACTIONS`. Không đổi logic.

- [ ] **Bước 4: Sinh dữ liệu ERP mới trong `buildRepoData()`**

Thêm các hàm generator (đặt trên `buildRepoData`):

```ts
import {
  DAY_FACTORS, ERP_DETAIL_PROJECT_ID, contractors, equipmentLastDay, equipments,
  keyMilestoneSeed, manpowerLastDay, stages, workItemNames,
} from './erp';

/** Mọi dự án nhận trọng số mặc định (5/10/10/40/5/27/3). */
function buildStageWeights(projects: Project[]): ProjectStageWeight[] {
  return projects.flatMap((p) =>
    DEFAULT_STAGE_WEIGHTS.map((w) => ({
      projectId: p.id,
      stageCode: w.stageCode,
      weightPct: w.weightPct,
      applicable: w.applicable,
    })),
  );
}

/** 7 mốc giai đoạn cho mọi dự án: chia đều khoảng KH bắt đầu → KH kết thúc theo trọng số lũy kế. */
function buildStageMilestones(projects: Project[]): FactStageMilestone[] {
  const out: FactStageMilestone[] = [];
  for (const p of projects) {
    if (!p.plannedStartDate || !p.plannedFinishDate) continue;
    const t0 = new Date(p.plannedStartDate).getTime();
    const span = new Date(p.plannedFinishDate).getTime() - t0;
    let cum = 0;
    for (const w of DEFAULT_STAGE_WEIGHTS) {
      const from = cum / 100;
      cum += w.weightPct;
      const to = cum / 100;
      const start = new Date(t0 + span * from).toISOString().slice(0, 10);
      const finish = new Date(t0 + span * to).toISOString().slice(0, 10);
      const done = p.actualStartDate != null && to <= 0.5; // demo: nửa đầu chuỗi coi như đã xong
      out.push({
        projectId: p.id,
        stageCode: w.stageCode,
        plannedStart: start,
        plannedFinish: finish,
        actualStart: p.actualStartDate ? start : null,
        actualFinish: done ? finish : null,
        forecastDate: done ? null : finish,
        updatedAt: '2026-09-02T00:00:00Z',
        updatedBy: 'system',
      });
    }
  }
  return out;
}

/** 10 hạng mục + sản lượng KH/TT theo từng giai đoạn - chỉ cho dự án chi tiết. */
function buildWorkItems(projects: Project[]): {
  workItems: ProjectWorkItem[];
  facts: FactStageWorkItem[];
} {
  const p = projects.find((x) => x.id === ERP_DETAIL_PROJECT_ID);
  if (!p) return { workItems: [], facts: [] };

  const workItems: ProjectWorkItem[] = workItemNames.map((name, i) => ({
    id: i + 1,
    projectId: p.id,
    name,
    sortOrder: i + 1,
  }));

  // Chia tấn của dự án cho 10 hạng mục theo tỷ trọng giảm dần, tổng = p.tonnage.
  const shares = [0.18, 0.15, 0.13, 0.12, 0.1, 0.09, 0.07, 0.06, 0.055, 0.045];
  const volumeStages = DEFAULT_STAGE_WEIGHTS
    .filter((w) => STAGE_CALC_MODE[w.stageCode] === 'volume')
    .map((w) => w.stageCode);

  const facts: FactStageWorkItem[] = [];
  for (const wi of workItems) {
    const itemTon = Math.round(p.tonnage * shares[wi.sortOrder - 1]);
    for (const stageCode of volumeStages) {
      // %TT giai đoạn giảm dần theo thứ tự chuỗi giá trị (Shop xong nhiều hơn Lắp dựng).
      const idx = STAGE_ORDER.indexOf(stageCode);
      const ratio = Math.max(0, Math.min(1, 1.15 - idx * 0.12));
      facts.push({
        projectId: p.id,
        stageCode,
        workItemId: wi.id,
        yearMonth: SEED_CURRENT_MONTH,
        qtyPlan: itemTon,
        qtyActual: Math.round(itemTon * ratio),
      });
    }
  }
  return { workItems, facts };
}

function buildKeyMilestones(): ProjectKeyMilestone[] {
  return keyMilestoneSeed.map((m, i) => ({
    id: i + 1,
    projectId: ERP_DETAIL_PROJECT_ID,
    name: m.name,
    sortOrder: i + 1,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate,
  }));
}

/** 7 ngày tracking gần nhất tính lùi từ SEED_REPORT_DATE (ngày cuối = SEED_REPORT_DATE). */
function trackingDates(): string[] {
  const end = SEED_REPORT_DATE.getTime();
  return DAY_FACTORS.map((_, i) =>
    new Date(end - (DAY_FACTORS.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

function buildDailyResources(): {
  projectContractors: ProjectContractor[];
  manpower: FactDailyManpower[];
  equipmentUsage: FactDailyEquipmentUsage[];
} {
  const pid = ERP_DETAIL_PROJECT_ID;
  const dates = trackingDates();

  const projectContractors: ProjectContractor[] = contractors.map((c) => ({
    projectId: pid,
    contractorId: c.id,
  }));

  const manpower: FactDailyManpower[] = [];
  const equipmentUsage: FactDailyEquipmentUsage[] = [];

  dates.forEach((workDate, d) => {
    const f = DAY_FACTORS[d];
    for (const row of manpowerLastDay) {
      manpower.push({
        projectId: pid,
        contractorId: row.contractorId,
        workDate,
        plannedHeadcount: Math.round(row.planned * f),
        actualHeadcount: Math.round(row.actual * f),
      });
    }
    for (const row of equipmentLastDay) {
      equipmentUsage.push({
        projectId: pid,
        contractorId: row.contractorId,
        equipmentId: row.equipmentId,
        workDate,
        qtyPlanned: Math.round(row.planned * f),
        qtyActual: Math.round(row.actual * f),
      });
    }
  });

  return { projectContractors, manpower, equipmentUsage };
}
```

Trong vòng lặp tạo `facts` (dòng 323-345), thêm 3 field mới vào mỗi bản ghi:
```ts
        isLatest: true,
        manpowerPlanned: p.id === ERP_DETAIL_PROJECT_ID ? 520 : 0,
        manpowerActual: p.id === ERP_DETAIL_PROJECT_ID ? 486 : 0,
        equipmentPlanned: p.id === ERP_DETAIL_PROJECT_ID ? 72 : 10,
        equipmentActual: p.id === ERP_DETAIL_PROJECT_ID ? 63 : Math.round(10 * (pctActual > 0 ? 0.7 + 0.3 * (pctActual / p.finalPctActual || 0) : 0)),
```
(thay dòng `equipmentPlanned: 10,` và `equipmentActual: …` hiện có).
Trong vòng lặp tạo `financial`, thêm `isLatest: true,`.

**Cùng vòng lặp đó: PV/SPI tính theo % KH duration (Q2).** Sửa `src/data/seed/history.ts:315-320`:

```ts
import { endOfMonth } from '@/lib/clock';
import { calcDurationPctComplete, calcSpi } from '@/lib/evm';

/**
 * % KH theo thời gian của MỘT tháng = mốc ngày cuối tháng đó.
 * Export ra để history.test.ts kiểm PV bằng đúng công thức này, không chép lại số.
 * Hàm thuần - endOfMonth không đọc đồng hồ nên seed vẫn deterministic.
 */
export function seedPctPlanDuration(p: SeedProject, yearMonth: string): number {
  const at = new Date(`${endOfMonth(yearMonth)}T00:00:00Z`);
  return calcDurationPctComplete(p.plannedStartDate, p.plannedFinishDate, at) ?? 0;
}
```

```ts
// Trước
      const pctPlan = p.finalPctPlan * tPlan;
      const pv = pctPlan * bac;
      const ev = pctActual * bac;
      const acVal = p.finalCpi ? ev / p.finalCpi : 0;
      const spi = pv ? ev / pv : null;

// Sau - pctPlan chỉ còn là "số nhập tay" lưu để audit; PV/SPI bám % KH theo thời gian
      const pctPlan = p.finalPctPlan * tPlan;              // số nhập tay, KHÔNG dùng để tính PV nữa
      const pv = seedPctPlanDuration(p, yearMonth) * bac;
      const ev = pctActual * bac;
      const acVal = p.finalCpi ? ev / p.finalCpi : 0;
      const spi = calcSpi(ev, pv);
```

Thêm `type SeedProject` vào dòng import sẵn có từ `'./projects'`.
Biến `tPlan` và `startIdx` vẫn dùng cho `pctPlan` nên **không xoá**. `cpi` giữ nguyên.
Dự án thiếu `plannedStartDate`/`plannedFinishDate` → `pv = 0` → `calcSpi` trả `null`
(đúng ý: không có lịch thì không chấm được tiến độ).

- [ ] **Bước 5: Mở rộng `interface RepoData` + `return` của `buildRepoData()`**

```ts
export interface RepoData {
  // ... field cũ giữ nguyên
  stages: Stage[];
  stageWeights: ProjectStageWeight[];
  workItems: ProjectWorkItem[];
  workItemFacts: FactStageWorkItem[];
  stageMilestones: FactStageMilestone[];
  keyMilestones: ProjectKeyMilestone[];
  contractors: Contractor[];
  projectContractors: ProjectContractor[];
  equipments: Equipment[];
  dailyManpower: FactDailyManpower[];
  dailyEquipment: FactDailyEquipmentUsage[];
}
```
Trong `return` của `buildRepoData()`:
```ts
  const wi = buildWorkItems(projects);
  const res = buildDailyResources();
  return {
    // ... field cũ
    stages,
    stageWeights: buildStageWeights(projects),
    workItems: wi.workItems,
    workItemFacts: wi.facts,
    stageMilestones: buildStageMilestones(projects),
    keyMilestones: buildKeyMilestones(),
    contractors,
    projectContractors: res.projectContractors,
    equipments,
    dailyManpower: res.manpower,
    dailyEquipment: res.equipmentUsage,
  };
```

**Quan trọng:** tăng `SEED_VERSION` lên `'2026-09-22-erp-v2'` — nếu không,
`.data/ddc-mock.json` cũ sẽ được load lại và thiếu sạch bảng mới
(`mock-repo.ts:54` so sánh version để quyết định dùng file cache hay build lại).

- [ ] **Bước 6: Sửa test PV cũ + thêm test seed vào `src/data/seed/history.test.ts`**

Trước hết sửa test đã vỡ vì Q2 — `src/data/seed/history.test.ts:26` đang so PV với `f.pctPlan`:

```ts
// Trước
      expect(f.pv).toBeCloseTo(f.pctPlan * p.contractValue, 0);

// Sau - PV bám % KH THEO THỜI GIAN, không bám số nhập tay
      const seedP = seedProjects.find((x) => x.id === f.projectId)!;
      expect(f.pv).toBeCloseTo(seedPctPlanDuration(seedP, f.yearMonth) * p.contractValue, 0);
```
Thêm import: `import { buildRepoData, SEED_CURRENT_MONTH, SEED_HISTORY_MONTHS, seedPctPlanDuration } from './history';`
và `import { seedProjects } from './projects';` (tên `CURRENT_MONTH`/`HISTORY_MONTHS` đã đổi ở Task 0 Bước 6).

Thêm 1 test khẳng định 2 con số nay khác nhau — nếu ai lỡ quay lại công thức cũ, test này đỏ:
```ts
  it('PV KHÔNG còn bám pctPlan nhập tay (dự án 1: %KH duration ≠ finalPctPlan)', () => {
    const f = data.facts.find((x) => x.projectId === 1 && x.yearMonth === SEED_CURRENT_MONTH)!;
    expect(f.pv).not.toBeCloseTo(f.pctPlan * 477.8, 0);
  });
```

Rồi thêm khối test mới:

```ts
import { DEFAULT_STAGE_WEIGHTS, validateStageWeights } from '@/lib/stages';
import { ERP_DETAIL_PROJECT_ID } from './erp';

describe('Seed ERP v2', () => {
  const data = buildRepoData();
  const lastDay = [...new Set(data.dailyManpower.map((m) => m.workDate))].sort().at(-1)!;

  it('7 giai đoạn dimension, sortOrder 1..7 không trùng', () => {
    expect(data.stages).toHaveLength(7);
    expect(data.stages.map((s) => s.sortOrder).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('mọi dự án có đủ 7 trọng số và tổng applicable = 100', () => {
    for (const p of data.projects) {
      const ws = data.stageWeights.filter((w) => w.projectId === p.id);
      expect(ws).toHaveLength(7);
      expect(validateStageWeights(ws).ok).toBe(true);
    }
  });

  it('trọng số đúng bộ đã duyệt 5/10/10/40/5/27/3 (KHÁC bộ cũ 6/12/10/34/5/28/5)', () => {
    expect(DEFAULT_STAGE_WEIGHTS.map((w) => w.weightPct)).toEqual([5, 10, 10, 40, 5, 27, 3]);
  });

  it('6 nhà thầu, tổng nhân lực ngày cuối KH 520 / TT 486', () => {
    expect(data.contractors).toHaveLength(6);
    const rows = data.dailyManpower.filter((m) => m.workDate === lastDay);
    expect(rows).toHaveLength(6);
    expect(rows.reduce((a, b) => a + b.plannedHeadcount, 0)).toBe(520);
    expect(rows.reduce((a, b) => a + b.actualHeadcount, 0)).toBe(486);
  });

  it('7 nhóm thiết bị, tổng ngày cuối KH 72 / TT 63', () => {
    expect(data.equipments).toHaveLength(7);
    const rows = data.dailyEquipment.filter((e) => e.workDate === lastDay);
    expect(rows.reduce((a, b) => a + b.qtyPlanned, 0)).toBe(72);
    expect(rows.reduce((a, b) => a + b.qtyActual, 0)).toBe(63);
  });

  it('đúng 7 ngày tracking liên tiếp', () => {
    const days = [...new Set(data.dailyManpower.map((m) => m.workDate))];
    expect(days).toHaveLength(7);
  });

  it('quan hệ nhiều-nhiều thật: 1 nhà thầu nhiều thiết bị VÀ 1 thiết bị nhiều nhà thầu', () => {
    const rows = data.dailyEquipment.filter((e) => e.workDate === lastDay);
    const byContractor = new Map<number, Set<number>>();
    const byEquipment = new Map<number, Set<number>>();
    for (const r of rows) {
      (byContractor.get(r.contractorId) ?? byContractor.set(r.contractorId, new Set()).get(r.contractorId)!).add(r.equipmentId);
      (byEquipment.get(r.equipmentId) ?? byEquipment.set(r.equipmentId, new Set()).get(r.equipmentId)!).add(r.contractorId);
    }
    expect([...byContractor.values()].some((s) => s.size > 1)).toBe(true);
    expect([...byEquipment.values()].some((s) => s.size > 1)).toBe(true);
  });

  it('10 hạng mục + 5 mốc chính, đúng 2 mốc đã có ngày thực tế', () => {
    expect(data.workItems.filter((w) => w.projectId === ERP_DETAIL_PROJECT_ID)).toHaveLength(10);
    const ms = data.keyMilestones.filter((m) => m.projectId === ERP_DETAIL_PROJECT_ID);
    expect(ms).toHaveLength(5);
    expect(ms.filter((m) => m.actualDate != null)).toHaveLength(2);
  });

  it('mọi fact seed đều isLatest = true (chưa có bản ghi đè nào)', () => {
    expect(data.facts.every((f) => f.isLatest)).toBe(true);
    expect(data.financial.every((f) => f.isLatest)).toBe(true);
  });

  it('assignment chỉ trỏ tới email có thật trong userRoles (nếu không RBAC khoá sạch app)', () => {
    const emails = new Set(data.userRoles.map((u) => u.email));
    for (const a of data.assignments) expect(emails.has(a.userEmail)).toBe(true);
  });
});
```

- [ ] **Bước 7: Bổ sung read method cho `src/server/repo/mock-repo.ts`**

`mock-repo` là bản **đồng bộ** (không `async`) — giữ đúng phong cách đó.
Thêm vào object `repo` (đặt sau `getValueChain`, dòng 150):

```ts
  // ---- ERP v2 ----
  getStages(): Stage[] {
    return [...getData().stages].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /** Không có dòng nào cho dự án → rơi về bộ trọng số mặc định (không trả mảng rỗng). */
  getStageWeights(projectId: number): ProjectStageWeight[] {
    const rows = getData().stageWeights.filter((w) => w.projectId === projectId);
    return rows.length
      ? rows
      : DEFAULT_STAGE_WEIGHTS.map((w) => ({ projectId, stageCode: w.stageCode, weightPct: w.weightPct, applicable: w.applicable }));
  },

  getWorkItems(projectId: number): ProjectWorkItem[] {
    return getData().workItems
      .filter((w) => w.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getWorkItemFacts(projectId: number, yearMonth: string, stageCode?: StageCode): FactStageWorkItem[] {
    return getData().workItemFacts.filter(
      (f) => f.projectId === projectId && f.yearMonth === yearMonth && (!stageCode || f.stageCode === stageCode),
    );
  },

  /** Trả StageMilestoneView: 5 cột DB + "Ngày chênh lệch" tính runtime (Q1). */
  getStageMilestones(projectId: number): StageMilestoneView[] {
    return getData().stageMilestones
      .filter((m) => m.projectId === projectId)
      .map((m) => ({ ...m, dayVariance: calcDayVariance(m.plannedFinish, m.actualFinish) }));
  },

  getKeyMilestones(projectId: number): ProjectKeyMilestone[] {
    return getData().keyMilestones
      .filter((m) => m.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getContractors(projectId?: number): Contractor[] {
    const all = getData().contractors.filter((c) => c.isActive);
    if (projectId == null) return all;
    const ids = new Set(
      getData().projectContractors.filter((pc) => pc.projectId === projectId).map((pc) => pc.contractorId),
    );
    return all.filter((c) => ids.has(c.id));
  },

  getEquipments(): Equipment[] {
    return getData().equipments.filter((e) => e.isActive);
  },

  /** from/to là 'YYYY-MM-DD', bao gồm cả hai đầu. */
  getDailyManpower(projectId: number, from: string, to: string): FactDailyManpower[] {
    return getData().dailyManpower
      .filter((m) => m.projectId === projectId && m.workDate >= from && m.workDate <= to)
      .sort((a, b) => a.workDate.localeCompare(b.workDate));
  },

  getDailyEquipment(projectId: number, from: string, to: string): FactDailyEquipmentUsage[] {
    return getData().dailyEquipment
      .filter((e) => e.projectId === projectId && e.workDate >= from && e.workDate <= to)
      .sort((a, b) => a.workDate.localeCompare(b.workDate));
  },
```

Import bổ sung ở đầu file: `import { calcDayVariance, calcDurationPctComplete, calcSpi } from '@/lib/evm';`,
`import { endOfMonth } from '@/lib/clock';`, và thêm `StageMilestoneView` (cùng 11 kiểu ERP mới
của Task 5) vào `import type { … } from './types';`.

Sửa thêm trong cùng file:
- `saveMonthlyFact` (dòng 518-524): PV/SPI theo % KH duration của **chính tháng đang lưu** (Q2),
  không theo `pctPlan` nhập tay:
  ```ts
    const pctPlan = patch.pctPlan ?? prev.pctPlan;          // số nhập tay, chỉ lưu để audit
    const pctActual = patch.pctActual ?? prev.pctActual;
    const ac = patch.ac ?? prev.ac;
    // Mốc là ngày CUỐI THÁNG đang lưu - sửa lại tháng cũ phải ra đúng PV của tháng đó.
    const at = new Date(`${endOfMonth(yearMonth)}T00:00:00Z`);
    const pctPlanDuration = calcDurationPctComplete(proj.plannedStartDate, proj.plannedFinishDate, at) ?? 0;
    const pv = pctPlanDuration * bac;
    const ev = pctActual * bac;
    const spi = calcSpi(ev, pv);
    const cpi = ac ? ev / ac : null;
  ```
- `saveMonthlyFact` (dòng 525-540): trước khi `d.facts.push(...)`, đặt `isLatest = false`
  cho **mọi** bản ghi cùng `(projectId, yearMonth)`; bản mới `isLatest: true`.
  ```ts
    for (const f of d.facts) if (f.projectId === projectId && f.yearMonth === yearMonth) f.isLatest = false;
    d.facts.push({ ...prev, ...patch, /* … */ isLatest: true, version: prev.version + 1, /* … */ });
  ```
  Đổi `_latestFacts()` (dòng 100-108) sang lọc `isLatest` thay vì so `version`:
  ```ts
  _latestFacts(): FactProgressMonthly[] {
    return getData().facts.filter((f) => f.isLatest);
  },
  ```
- `saveFinancial` (dòng 576-612): y hệt, `_latestFinancial()` lọc `isLatest`.
- `removeProject` (dòng 362-387): thêm dọn 8 mảng mới
  (`stageWeights`, `workItems`, `workItemFacts`, `stageMilestones`, `keyMilestones`,
  `projectContractors`, `dailyManpower`, `dailyEquipment`) theo `projectId`.
- `resetAllData` (dòng 487-502): gán 8 mảng đó về `[]`; **giữ** `stages`, `contractors`,
  `equipments` (là dim, không phải data nghiệp vụ).

- [ ] **Bước 8: `prisma/seed.ts` — ghi 11 bảng mới, đúng thứ tự FK**

Chèn **trước** khối `// ---- Projects ----` (vì `dim_stage` được `fact_*` tham chiếu):
```ts
  await prisma.stage.deleteMany();
  await prisma.stage.createMany({ data: data.stages });

  await prisma.contractor.deleteMany();
  await prisma.contractor.createMany({ data: data.contractors });

  await prisma.equipment.deleteMany();
  await prisma.equipment.createMany({ data: data.equipments });
```
Chèn **sau** `prisma.projectAssignment.createMany(...)`:
```ts
  await prisma.projectStageWeight.deleteMany();
  await prisma.projectStageWeight.createMany({ data: data.stageWeights });

  await prisma.projectWorkItem.deleteMany();
  await prisma.projectWorkItem.createMany({ data: data.workItems });

  await prisma.projectKeyMilestone.deleteMany();
  await prisma.projectKeyMilestone.createMany({
    data: data.keyMilestones.map((m) => ({ ...m, plannedDate: d(m.plannedDate), actualDate: d(m.actualDate) })),
  });

  await prisma.projectContractor.deleteMany();
  await prisma.projectContractor.createMany({ data: data.projectContractors });
```
Chèn **sau** `prisma.factVolume.createMany(...)`:
```ts
  await prisma.factStageWorkItem.deleteMany();
  await prisma.factStageWorkItem.createMany({ data: data.workItemFacts });

  await prisma.factStageMilestone.deleteMany();
  await prisma.factStageMilestone.createMany({
    data: data.stageMilestones.map((m) => ({
      ...m,
      plannedStart: d(m.plannedStart), plannedFinish: d(m.plannedFinish),
      actualStart: d(m.actualStart), actualFinish: d(m.actualFinish),
      forecastDate: d(m.forecastDate), updatedAt: new Date(m.updatedAt),
    })),
  });

  await prisma.factDailyManpower.deleteMany();
  await prisma.factDailyManpower.createMany({
    data: data.dailyManpower.map((m) => ({ ...m, workDate: new Date(`${m.workDate}T00:00:00Z`) })),
  });

  await prisma.factDailyEquipmentUsage.deleteMany();
  await prisma.factDailyEquipmentUsage.createMany({
    data: data.dailyEquipment.map((e) => ({ ...e, workDate: new Date(`${e.workDate}T00:00:00Z`) })),
  });
```
Trong `syncSequences()` (dòng 124-137) thêm 4 bảng có `autoincrement`:
`'project_work_item'`, `'project_key_milestone'`, `'dim_contractor'`, `'dim_equipment'`.

Đổi dòng log cuối cùng thành:
`console.log('Seed xong: 17 dự án + 7 giai đoạn + 6 nhà thầu + 7 nhóm thiết bị + 10 hạng mục + 5 mốc chính');`

- [ ] **Bước 9: Chạy seed + kiểm chứng + commit**

```bash
rm -rf .data/ddc-mock.json          # PowerShell: Remove-Item .data\ddc-mock.json -ErrorAction Ignore
npx prisma db seed
npx tsc --noEmit && npx vitest run
git commit -am "feat(seed): dữ liệu ERP v2 (giai đoạn, trọng số, hạng mục, mốc, nhà thầu, thiết bị)"
```

---

## Task 7: `src/server/repo/prisma-repo.ts` — append-only thật + read ERP

`prisma-repo` hiện `upsert` đè lên và tăng `version` tại chỗ (dòng 655-675, 734-753) —
tức là **huỷ lịch sử**, trái với lời hứa ở `types.ts:135` và trái hẳn với hành vi của `mock-repo`.
Task này làm hai impl hành xử giống nhau.

**Files:**
- Modify: `src/server/repo/prisma-repo.ts`, `src/server/repo/index.ts`

**Interfaces — Produces:** cùng bộ method như mock-repo (Task 6, Bước 7) nhưng `async`.

- [ ] **Bước 1: Đổi `getLatestFact` sang lọc `isLatest`**

```ts
  async getLatestFact(projectId: number, yearMonth: string): Promise<FactProgressMonthly | undefined> {
    const row = await prisma.factProgressMonthly.findFirst({
      where: { projectId, isLatest: true, ...(yearMonth === 'all' ? {} : { yearMonth }) },
      orderBy: { yearMonth: 'desc' },
    });
    return row ? mapFact(row) : undefined;
  },
```
`findUnique({ where: { projectId_yearMonth } })` **không còn tồn tại** sau khi đổi PK — mọi
chỗ dùng compound key phải sửa. Danh sách đầy đủ trong file: dòng 171-173, 656, 689, 719, 735.

- [ ] **Bước 2: Thêm `isLatest: true` vào mọi read khác của 2 bảng fact**

| Method | Dòng | Sửa |
|---|---|---|
| `getFacts` | 156-159 | `where: { projectId, isLatest: true }` |
| `getFactsForMonth` | 177-186 | thêm `isLatest: true` vào cả 2 nhánh |
| `getFinancial` | 200-203 | `where: { projectId, isLatest: true }` |
| `getFinancialForMonth` | 207-216 | thêm `isLatest: true` vào cả 2 nhánh |
| `isMonthLocked` | 625-631 | thêm `isLatest: true` vào cả 2 `count` |
| `lockMonth` | 618-623 | `where: { yearMonth, isLatest: true }` |

- [ ] **Bước 3: Viết lại `saveMonthlyFact` thành append-only trong transaction**

```ts
  async saveMonthlyFact(
    projectId: number,
    yearMonth: string,
    patch: Partial<Pick<FactProgressMonthly,
      'pctPlan' | 'pctActual' | 'ac' | 'equipmentActual' | 'manpowerActual' | 'bottleneckStage'>>,
    changedBy = 'system',
  ) {
    const prev = await this.getLatestFact(projectId, yearMonth);
    if (!prev) return;
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) return;

    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
    const bac = proj.contractValue;                 // snapshot BAC tại thời điểm ghi
    const pctPlan = patch.pctPlan ?? prev.pctPlan;  // số nhập tay - chỉ lưu để audit (Q2)
    const pctActual = patch.pctActual ?? prev.pctActual;
    const ac = patch.ac ?? prev.ac;
    // % KH = thời gian đã trôi tới CUỐI THÁNG đang lưu, không phải số nhập tay, không phải "hôm nay".
    const at = new Date(`${endOfMonth(yearMonth)}T00:00:00Z`);
    const pctPlanDuration = calcDurationPctComplete(proj.plannedStartDate, proj.plannedFinishDate, at) ?? 0;
    const pv = calcPv(pctPlanDuration, bac);
    const ev = calcEv(pctActual, bac);

    // Append-only: hạ cờ bản cũ rồi INSERT bản mới, trong CÙNG 1 transaction.
    // Partial unique index ux_fact_progress_latest chặn 2 dòng isLatest cùng lúc.
    await prisma.$transaction([
      prisma.factProgressMonthly.updateMany({
        where: { projectId, yearMonth, isLatest: true },
        data: { isLatest: false },
      }),
      prisma.factProgressMonthly.create({
        data: {
          projectId, yearMonth,
          version: prev.version + 1,
          isLatest: true,
          pctPlan, pctActual, ac, pv, ev,
          spi: calcSpi(ev, pv),
          cpi: calcCpi(ev, ac),
          bac,
          actualStartDate: d8(prev.actualStartDate),
          actualFinishDate: d8(prev.actualFinishDate),
          bottleneckStage: patch.bottleneckStage !== undefined ? patch.bottleneckStage : prev.bottleneckStage,
          manpowerPlanned: prev.manpowerPlanned,
          manpowerActual: patch.manpowerActual ?? prev.manpowerActual,
          equipmentPlanned: prev.equipmentPlanned,     // KHÔNG hardcode 0 nữa - đó là lý do
          equipmentActual: patch.equipmentActual ?? prev.equipmentActual, // isEquipmentWarning không bao giờ chạy
          snapshotLockedAt: d8(prev.snapshotLockedAt),
          lockedBy: prev.lockedBy,
          changedBy, changedAt: new Date(), changeNote: note,
        },
      }),
      prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
    ]);
    await this.logAudit('fact_progress_monthly', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
  },
```
Import thêm ở đầu file:
`import { calcCpi, calcDayVariance, calcDurationPctComplete, calcEv, calcPv, calcSpi } from '@/lib/evm';`
và `import { endOfMonth } from '@/lib/clock';`
(bỏ luôn 4 dòng tự tính `pv/ev/spi/cpi` inline — cùng lý do gỡ trùng lặp ở Task 3).

Lưu ý `proj` lấy bằng `prisma.project.findUnique` ở ngay trên nên có sẵn
`plannedStartDate`/`plannedFinishDate` kiểu `Date | null` — `calcDurationPctComplete` nhận cả `Date`.
Thêm `StageMilestoneView` vào `import type { … } from './types';` (dùng ở Bước 5).

- [ ] **Bước 4: Viết lại `saveFinancial` theo đúng khuôn đó**

Cùng mẫu: `updateMany({ …, isLatest: true } → isLatest: false)` + `create({ version: prev.version + 1, isLatest: true, … })`
trong một `$transaction`. Giữ nguyên toàn bộ công thức `arOutstanding`/`grossProfit`/`grossMarginPct`
hiện có (dòng 730-732) — chỉ đổi cách ghi, không đổi số.
Đọc `prev` bằng `findFirst({ where: { projectId, yearMonth, isLatest: true } })` thay cho `findUnique`.

- [ ] **Bước 5: Thêm read method ERP (async, cùng tên/chữ ký với mock-repo)**

```ts
  async getStages(): Promise<Stage[]> {
    const rows = await prisma.stage.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((s) => ({
      code: s.code as StageCode, nameVi: s.nameVi, nameEn: s.nameEn,
      sortOrder: s.sortOrder, calcMode: s.calcMode as StageCalcMode,
    }));
  },

  /** Chưa cấu hình trọng số → rơi về bộ mặc định, KHÔNG trả mảng rỗng (sẽ làm %TT = 0). */
  async getStageWeights(projectId: number): Promise<ProjectStageWeight[]> {
    const rows = await prisma.projectStageWeight.findMany({ where: { projectId } });
    if (!rows.length) {
      return DEFAULT_STAGE_WEIGHTS.map((w) => ({
        projectId, stageCode: w.stageCode, weightPct: w.weightPct, applicable: w.applicable,
      }));
    }
    return rows.map((w) => ({
      projectId: w.projectId, stageCode: w.stageCode as StageCode,
      weightPct: w.weightPct, applicable: w.applicable,
    }));
  },

  async getWorkItems(projectId: number): Promise<ProjectWorkItem[]> {
    return prisma.projectWorkItem.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
  },

  async getWorkItemFacts(projectId: number, yearMonth: string, stageCode?: StageCode): Promise<FactStageWorkItem[]> {
    const rows = await prisma.factStageWorkItem.findMany({
      where: { projectId, yearMonth, ...(stageCode ? { stageCode } : {}) },
    });
    return rows.map((f) => ({ ...f, stageCode: f.stageCode as StageCode }));
  },

  /** Trả StageMilestoneView: 5 cột DB + "Ngày chênh lệch" tính runtime (Q1) - giống hệt mock-repo. */
  async getStageMilestones(projectId: number): Promise<StageMilestoneView[]> {
    const rows = await prisma.factStageMilestone.findMany({
      where: { projectId },
      orderBy: { stage: { sortOrder: 'asc' } },
    });
    return rows.map((m) => ({
      projectId: m.projectId, stageCode: m.stageCode as StageCode,
      plannedStart: day(m.plannedStart), plannedFinish: day(m.plannedFinish),
      actualStart: day(m.actualStart), actualFinish: day(m.actualFinish),
      forecastDate: day(m.forecastDate),
      dayVariance: calcDayVariance(day(m.plannedFinish), day(m.actualFinish)),
      updatedAt: m.updatedAt.toISOString(), updatedBy: m.updatedBy,
    }));
  },

  async getKeyMilestones(projectId: number): Promise<ProjectKeyMilestone[]> {
    const rows = await prisma.projectKeyMilestone.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
    return rows.map((m) => ({
      id: m.id, projectId: m.projectId, name: m.name, sortOrder: m.sortOrder,
      plannedDate: day(m.plannedDate), actualDate: day(m.actualDate),
    }));
  },

  async getContractors(projectId?: number): Promise<Contractor[]> {
    return prisma.contractor.findMany({
      where: { isActive: true, ...(projectId != null ? { projects: { some: { projectId } } } : {}) },
      orderBy: { id: 'asc' },
    });
  },

  async getEquipments(): Promise<Equipment[]> {
    return prisma.equipment.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  },

  async getDailyManpower(projectId: number, from: string, to: string): Promise<FactDailyManpower[]> {
    const rows = await prisma.factDailyManpower.findMany({
      where: { projectId, workDate: { gte: dayStart(from), lte: dayStart(to) } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }],
    });
    return rows.map((m) => ({ ...m, workDate: day(m.workDate)! }));
  },

  async getDailyEquipment(projectId: number, from: string, to: string): Promise<FactDailyEquipmentUsage[]> {
    const rows = await prisma.factDailyEquipmentUsage.findMany({
      where: { projectId, workDate: { gte: dayStart(from), lte: dayStart(to) } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }, { equipmentId: 'asc' }],
    });
    return rows.map((e) => ({ ...e, workDate: day(e.workDate)! }));
  },
```
Thêm 2 helper cạnh `iso`/`d8` (dòng 42-43):
```ts
/** Date → 'YYYY-MM-DD' (cột @db.Date). */
const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
/** 'YYYY-MM-DD' → Date tại 00:00:00Z, để so sánh với cột @db.Date. */
const dayStart = (s: string): Date => new Date(`${s}T00:00:00Z`);
```

- [ ] **Bước 6: Đơn giản hoá `removeProject` và `resetAllData` nhờ cascade**

`removeProject` (dòng 849-871) — cascade đã khai ở schema nên bỏ hết `deleteMany` con:
```ts
  async removeProject(id: number) {
    const proj = await prisma.project.findUnique({ where: { id } });
    if (!proj) return;
    // FK onDelete: Cascade khai ở schema tự dọn mọi bảng con - không xoá tay từng bảng nữa.
    await prisma.project.delete({ where: { id } });
    // dim cleanup: chỉ xoá customer/team khi không còn dự án nào dùng (FK Restrict sẽ chặn nếu còn).
    const stillUsesCustomer = await prisma.project.findFirst({ where: { customerId: proj.customerId } });
    if (!stillUsesCustomer) await prisma.customer.deleteMany({ where: { id: proj.customerId } });
    const stillUsesTeam = await prisma.project.findFirst({ where: { teamKdId: proj.teamKdId } });
    if (!stillUsesTeam) await prisma.teamKd.deleteMany({ where: { id: proj.teamKdId } });
  },
```
`resetAllData` (dòng 873-889): giữ `prisma.project.deleteMany()` (cascade dọn con) +
`prisma.auditLog.deleteMany()`. **Không** xoá `stage`, `contractor`, `equipment`, `customer`,
`teamKd`, `factory`, `currency` — đó là dimension.

- [ ] **Bước 7: `actions.ts` truyền trọng số thật vào `calcChainPctActual`**

`src/server/actions.ts:133-137`:
```ts
  let derivedPctActual: number | undefined;
  let bottleneckStage: StageCode | null | undefined;
  if (chain) {
    await repo.saveValueChain(projectId, month, chain, by);
    // Trọng số theo dự án, không dùng mặc định cứng - dự án có thể bỏ giai đoạn.
    const weights = await repo.getStageWeights(projectId);
    derivedPctActual = calcChainPctActual(chain, weights);
    bottleneckStage = findCurrentStage(chain);
  }
```
Seed ghi đúng `DEFAULT_STAGE_WEIGHTS` cho mọi dự án nên kết quả bằng hệt Task 2 —
test ở Task 2 vẫn xanh.

- [ ] **Bước 8: Kiểm chứng + commit**

```bash
npx tsc --noEmit && npx vitest run
npx prisma migrate status
git commit -am "feat(repo): prisma-repo append-only theo isLatest + read ERP, cascade thay xoá tay"
```

Kiểm bằng tay trên DB (đảm bảo `version` không còn nói dối):
```sql
-- Lưu 2 lần cùng 1 tháng rồi chạy: phải ra 2 dòng, đúng 1 dòng isLatest.
SELECT "version", "isLatest" FROM fact_progress_monthly
 WHERE "projectId" = 1 AND "yearMonth" = '2026-09' ORDER BY "version";
```

---

## Task 8: Nguồn lực theo NGÀY ở trang Chi tiết dự án — 2 scorecard + biểu đồ nhân lực KH/TT

Chốt Q3. Hai việc dùng chung một nguồn dữ liệu nên nằm chung một task:
(a) scorecard nhân lực/thiết bị đổi từ `fact_progress_monthly` sang bảng theo ngày, mỗi cái có
dòng nhỏ ghi rõ ngày của số liệu; (b) line chart 2 đường "nhân lực kế hoạch / thực tế"
ở **cuối** trang `/projects/[id]`, drill-down Tuần/Tháng, trục X là khoảng ngày thật.

**Files:**
- Create: `src/lib/daily-series.ts`, `src/lib/daily-series.test.ts`,
  `src/server/project-queries.ts`, `src/server/project-queries.test.ts`,
  `src/components/project/ManpowerDailyChart.tsx`
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx`,
  `src/components/dashboard/charts.tsx:45` (export `TOOLTIP_STYLE`),
  `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`

**Interfaces — Consumes:** `repo.getDailyManpower(projectId, from, to)` /
`repo.getDailyEquipment(projectId, from, to)` (Task 6 Bước 7 + Task 7 Bước 5) ·
`addDaysIso`, `endOfMonth`, `todayIso`, type `IsoDate` (`@/lib/clock`, Task 0) ·
`CHART_COLORS` (`@/components/dashboard/charts`).

**Interfaces — Produces:**
```ts
// src/lib/daily-series.ts  (pure, không chạm repo)
export type Bucket = 'week' | 'month';
export interface DailyPoint { date: IsoDate; planned: number; actual: number }
export interface SeriesPoint {
  key: string;        // = from, React key ổn định
  label: string;      // '21.09 - 27.09'
  from: IsoDate;
  to: IsoDate;
  planned: number;    // số người TRUNG BÌNH/ngày trong bucket, đã làm tròn
  actual: number;
  days: number;       // số ngày có dữ liệu trong bucket
}
export function sumByDate(
  rows: { workDate: string; plannedHeadcount: number; actualHeadcount: number }[],
): DailyPoint[];
export function bucketOf(date: IsoDate, bucket: Bucket): { from: IsoDate; to: IsoDate };
export function rangeLabel(from: IsoDate, to: IsoDate): string;
export function groupByBucket(points: DailyPoint[], bucket: Bucket): SeriesPoint[];
export function yearsLabel(points: SeriesPoint[]): string;

// src/server/project-queries.ts
export interface ResourceSnapshot {
  asOfDate: IsoDate | null;   // null = chưa có dữ liệu ngày nào trong cửa sổ
  manpowerPlanned: number;
  manpowerActual: number;
  equipmentPlanned: number;
  equipmentActual: number;
}
export function resourceWindow(yearMonth: string): { from: IsoDate; to: IsoDate };
export function getResourceSnapshot(projectId: number, yearMonth: string): Promise<ResourceSnapshot>;
export function getManpowerDaily(projectId: number, yearMonth: string): Promise<DailyPoint[]>;

// src/components/project/ManpowerDailyChart.tsx
export function ManpowerDailyChart(props: { data: DailyPoint[] }): JSX.Element;
```

Quy ước chốt (không ai phải đoán):
- **Tuần = Thứ Hai → Chủ Nhật** (ISO). Tháng = ngày 1 → ngày cuối tháng.
- **Nhãn trục X là khoảng ngày thật** `'dd.mm - dd.mm'` (`'21.09 - 27.09'`). Cấm nhãn kiểu `W1`, `W2`.
  Nhãn không có năm → **badge năm ở góc trên trái chart** (`yearsLabel`, vắt năm thì `'2026 - 2027'`).
- **Gộp bucket = TRUNG BÌNH mỗi ngày, làm tròn số nguyên**, không cộng dồn. Nhân lực là số *tồn*
  (người có mặt), cộng 7 ngày sẽ ra số người gấp 7 lần.
- **Scorecard = ảnh chụp NGÀY GẦN NHẤT CÓ DỮ LIỆU** ≤ `min(hôm nay, cuối tháng đang xem)`,
  cộng ngang các nhà thầu trong đúng ngày đó. Không có dữ liệu → hiện `-` và dòng "Chưa có dữ liệu theo ngày".
- **Không tạo endpoint mới cho chart.** Trang RSC gọi `getManpowerDaily()` rồi truyền `data` xuống
  client component — đúng pattern `SCurve`/`SpiCpiLine` (`projects/[id]/page.tsx:14-15`).
  Route `GET /api/projects/[id]/resources` (chunk sau) gọi lại đúng 2 hàm này và trả
  `{ snapshot: ResourceSnapshot, daily: DailyPoint[] }` — không viết công thức lần hai.

- [ ] **Bước 1: Viết test trước (`src/lib/daily-series.test.ts`)**

```ts
import { describe, expect, it } from 'vitest';
import {
  bucketOf, groupByBucket, rangeLabel, sumByDate, yearsLabel, type DailyPoint,
} from './daily-series';

const p = (date: string, planned: number, actual: number): DailyPoint => ({ date, planned, actual });

describe('sumByDate - cộng ngang các nhà thầu trong CÙNG một ngày', () => {
  it('2 nhà thầu cùng ngày → 1 điểm, cộng đủ', () => {
    expect(sumByDate([
      { workDate: '2026-09-16', plannedHeadcount: 120, actualHeadcount: 112 },
      { workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 95 },
      { workDate: '2026-09-17', plannedHeadcount: 90, actualHeadcount: 82 },
    ])).toEqual([p('2026-09-16', 220, 207), p('2026-09-17', 90, 82)]);
  });
  it('đầu vào lộn xộn → kết quả luôn tăng dần theo ngày', () => {
    const out = sumByDate([
      { workDate: '2026-09-17', plannedHeadcount: 1, actualHeadcount: 1 },
      { workDate: '2026-09-16', plannedHeadcount: 2, actualHeadcount: 2 },
    ]);
    expect(out.map((x) => x.date)).toEqual(['2026-09-16', '2026-09-17']);
  });
  it('rỗng → rỗng', () => {
    expect(sumByDate([])).toEqual([]);
  });
});

describe('bucketOf - khoảng ngày của bucket', () => {
  it('tuần bắt đầu THỨ HAI (2026-09-22 là thứ Ba)', () => {
    expect(bucketOf('2026-09-22', 'week')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });
  it('Chủ Nhật thuộc tuần bắt đầu từ Thứ Hai TRƯỚC đó, không mở tuần mới', () => {
    expect(bucketOf('2026-09-27', 'week')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });
  it('tuần vắt qua ranh giới năm', () => {
    expect(bucketOf('2026-12-31', 'week')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });
  it('tháng = ngày 1 → ngày cuối, tháng 2 nhuận đúng 29 ngày', () => {
    expect(bucketOf('2026-09-22', 'month')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(bucketOf('2024-02-10', 'month')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
});

describe('rangeLabel - trục X là khoảng ngày thật, KHÔNG phải "W1"', () => {
  it('định dạng dd.mm - dd.mm', () => {
    expect(rangeLabel('2026-09-21', '2026-09-27')).toBe('21.09 - 27.09');
  });
  it('vắt năm vẫn chỉ hiện ngày.tháng (năm nằm ở badge góc chart)', () => {
    expect(rangeLabel('2026-12-28', '2027-01-03')).toBe('28.12 - 03.01');
  });
});

describe('groupByBucket - mỗi điểm là SỐ NGƯỜI TRUNG BÌNH/NGÀY, không cộng dồn', () => {
  it('2 ngày 100 và 200 người → 150, KHÔNG phải 300', () => {
    const out = groupByBucket([p('2026-09-21', 100, 90), p('2026-09-22', 200, 190)], 'week');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      from: '2026-09-21', to: '2026-09-27', label: '21.09 - 27.09',
      planned: 150, actual: 140, days: 2,
    });
  });
  it('2 tuần khác nhau → 2 điểm, xếp tăng dần theo ngày', () => {
    const out = groupByBucket([p('2026-09-28', 10, 10), p('2026-09-21', 20, 20)], 'week');
    expect(out.map((x) => x.from)).toEqual(['2026-09-21', '2026-09-28']);
  });
  it('gộp theo tháng', () => {
    const out = groupByBucket([p('2026-08-31', 10, 10), p('2026-09-01', 30, 20)], 'month');
    expect(out.map((x) => x.label)).toEqual(['01.08 - 31.08', '01.09 - 30.09']);
  });
  it('làm tròn số nguyên - không có 0.5 người', () => {
    const out = groupByBucket([p('2026-09-21', 100, 100), p('2026-09-22', 101, 101)], 'week');
    expect(out[0].planned).toBe(101);
    expect(Number.isInteger(out[0].actual)).toBe(true);
  });
  it('rỗng → rỗng, không NaN và không chia cho 0', () => {
    expect(groupByBucket([], 'week')).toEqual([]);
    expect(groupByBucket([], 'month')).toEqual([]);
  });
});

describe('yearsLabel - badge năm ở góc chart', () => {
  it('cùng năm → 1 năm', () => {
    expect(yearsLabel(groupByBucket([p('2026-09-21', 1, 1)], 'week'))).toBe('2026');
  });
  it('vắt năm → "2026 - 2027"', () => {
    expect(yearsLabel(groupByBucket([p('2026-12-28', 1, 1), p('2027-01-05', 1, 1)], 'week')))
      .toBe('2026 - 2027');
  });
  it('rỗng → chuỗi rỗng (không hiện badge)', () => {
    expect(yearsLabel([])).toBe('');
  });
});
```

- [ ] **Bước 2: Chạy test cho chắc là FAIL**

`npx vitest run src/lib/daily-series.test.ts` → FAIL `Cannot find module './daily-series'`.

- [ ] **Bước 3: Viết `src/lib/daily-series.ts`**

```ts
import { addDaysIso, endOfMonth, type IsoDate } from './clock';

/**
 * Gộp chuỗi số liệu theo ngày thành bucket tuần/tháng cho biểu đồ.
 * Pure function - không chạm repo, không đọc đồng hồ, unit-test được.
 */

export type Bucket = 'week' | 'month';

export interface DailyPoint {
  date: IsoDate;
  planned: number;
  actual: number;
}

export interface SeriesPoint {
  key: string;
  label: string;
  from: IsoDate;
  to: IsoDate;
  planned: number;
  actual: number;
  days: number;
}

/** Nhiều nhà thầu trong cùng một ngày = một điểm: cộng ngang rồi xếp tăng dần theo ngày. */
export function sumByDate(
  rows: { workDate: string; plannedHeadcount: number; actualHeadcount: number }[],
): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    const cur = byDate.get(r.workDate) ?? { date: r.workDate, planned: 0, actual: 0 };
    cur.planned += r.plannedHeadcount;
    cur.actual += r.actualHeadcount;
    byDate.set(r.workDate, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Tuần theo ISO: Thứ Hai → Chủ Nhật. Tháng: ngày 1 → ngày cuối. */
export function bucketOf(date: IsoDate, bucket: Bucket): { from: IsoDate; to: IsoDate } {
  if (bucket === 'month') {
    const ym = date.slice(0, 7);
    return { from: `${ym}-01`, to: endOfMonth(ym) };
  }
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Chủ Nhật
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const from = addDaysIso(date, -backToMonday);
  return { from, to: addDaysIso(from, 6) };
}

/** Nhãn trục X: khoảng ngày thật 'dd.mm - dd.mm'. KHÔNG dùng 'W1'/'W2' - người dùng không đọc được. */
export function rangeLabel(from: IsoDate, to: IsoDate): string {
  const dm = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return `${dm(from)} - ${dm(to)}`;
}

/**
 * Gộp ngày thành tuần/tháng bằng TRUNG BÌNH mỗi ngày.
 * Nhân lực là số tồn (người có mặt hôm đó), không phải dòng chảy - cộng dồn 7 ngày
 * sẽ ra số người gấp 7 lần.
 */
export function groupByBucket(points: DailyPoint[], bucket: Bucket): SeriesPoint[] {
  const acc = new Map<string, { from: IsoDate; to: IsoDate; planned: number; actual: number; days: number }>();
  for (const pt of points) {
    const { from, to } = bucketOf(pt.date, bucket);
    const cur = acc.get(from) ?? { from, to, planned: 0, actual: 0, days: 0 };
    cur.planned += pt.planned;
    cur.actual += pt.actual;
    cur.days += 1;
    acc.set(from, cur);
  }
  return [...acc.values()]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((b) => ({
      key: b.from,
      label: rangeLabel(b.from, b.to),
      from: b.from,
      to: b.to,
      planned: Math.round(b.planned / b.days),
      actual: Math.round(b.actual / b.days),
      days: b.days,
    }));
}

/** Badge năm cho góc chart - nhãn trục X cố tình không có năm nên phải ghi ở đây. */
export function yearsLabel(points: SeriesPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0].from.slice(0, 4);
  const last = points[points.length - 1].to.slice(0, 4);
  return first === last ? first : `${first} - ${last}`;
}
```

- [ ] **Bước 4: Chạy test tới khi PASS**

`npx vitest run src/lib/daily-series.test.ts` → PASS.

- [ ] **Bước 5: Viết `src/server/project-queries.ts`**

```ts
import { addDaysIso, endOfMonth, todayIso, type IsoDate } from '@/lib/clock';
import { sumByDate, type DailyPoint } from '@/lib/daily-series';
import { repo } from './repo';

/** Cửa sổ đọc bảng theo ngày: đủ dài để vẽ ~6 tháng mà không quét cả bảng. */
const RESOURCE_WINDOW_DAYS = 180;

export interface ResourceSnapshot {
  /** Ngày mà con số thuộc về; null = chưa có dữ liệu ngày nào trong cửa sổ. */
  asOfDate: IsoDate | null;
  manpowerPlanned: number;
  manpowerActual: number;
  equipmentPlanned: number;
  equipmentActual: number;
}

/** Kết thúc ở min(hôm nay, cuối tháng đang xem) - xem tháng quá khứ phải ra số của tháng đó. */
export function resourceWindow(yearMonth: string): { from: IsoDate; to: IsoDate } {
  const monthEnd = endOfMonth(yearMonth);
  const today = todayIso();
  const to = monthEnd < today ? monthEnd : today;
  return { from: addDaysIso(to, -(RESOURCE_WINDOW_DAYS - 1)), to };
}

/**
 * Nguồn lực = ẢNH CHỤP ngày gần nhất CÓ dữ liệu, cộng ngang nhà thầu trong đúng ngày đó (Q3).
 * KHÔNG cộng dồn cả khoảng: 7 ngày × 520 người không phải 3.640 người.
 * Nhân lực và thiết bị có thể nhập lệch ngày → mỗi bên lấy ngày cuối của chính nó,
 * asOfDate trả ngày mới hơn trong hai ngày (đó là ngày ghi dưới scorecard).
 */
export async function getResourceSnapshot(projectId: number, yearMonth: string): Promise<ResourceSnapshot> {
  const { from, to } = resourceWindow(yearMonth);
  const manpower = await repo.getDailyManpower(projectId, from, to);
  const equipment = await repo.getDailyEquipment(projectId, from, to);

  // Cả 2 repo đều trả đã sort tăng dần theo workDate (Task 6 Bước 7 / Task 7 Bước 5).
  const lastManpowerDay = manpower.at(-1)?.workDate ?? null;
  const lastEquipmentDay = equipment.at(-1)?.workDate ?? null;
  const manpowerRows = manpower.filter((m) => m.workDate === lastManpowerDay);
  const equipmentRows = equipment.filter((e) => e.workDate === lastEquipmentDay);
  const days = [lastManpowerDay, lastEquipmentDay].filter((d): d is IsoDate => d != null).sort();

  return {
    asOfDate: days.at(-1) ?? null,
    manpowerPlanned: manpowerRows.reduce((s, m) => s + m.plannedHeadcount, 0),
    manpowerActual: manpowerRows.reduce((s, m) => s + m.actualHeadcount, 0),
    equipmentPlanned: equipmentRows.reduce((s, e) => s + e.qtyPlanned, 0),
    equipmentActual: equipmentRows.reduce((s, e) => s + e.qtyActual, 0),
  };
}

/** Chuỗi nhân lực theo ngày (đã cộng ngang nhà thầu) để client tự gộp tuần/tháng. */
export async function getManpowerDaily(projectId: number, yearMonth: string): Promise<DailyPoint[]> {
  const { from, to } = resourceWindow(yearMonth);
  return sumByDate(await repo.getDailyManpower(projectId, from, to));
}
```

Test đi kèm — `src/server/project-queries.test.ts` (mock repo theo đúng khuôn
`src/server/compliance-page.test.ts:29-32`; đồng hồ đã ghim `2026-09-16` ở Task 0 Bước 5):

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { getManpowerDaily, getResourceSnapshot, resourceWindow } from './project-queries';

const MONTH = '2026-09';

describe('getResourceSnapshot - ảnh chụp ngày gần nhất, KHÔNG cộng dồn', () => {
  it('dự án 1: đúng số của ngày cuối (520/486 người, 72/63 thiết bị) + ngày kèm theo', async () => {
    const s = await getResourceSnapshot(1, MONTH);
    expect(s.asOfDate).toBe('2026-09-16');
    expect(s.manpowerPlanned).toBe(520);
    expect(s.manpowerActual).toBe(486);
    expect(s.equipmentPlanned).toBe(72);
    expect(s.equipmentActual).toBe(63);
  });

  it('KHÔNG phải tổng 7 ngày (nếu cộng dồn sẽ ra > 3000 người)', async () => {
    const s = await getResourceSnapshot(1, MONTH);
    expect(s.manpowerPlanned).toBeLessThan(600);
  });

  it('dự án chưa có dữ liệu ngày → asOfDate null, mọi số = 0 (UI hiện "-")', async () => {
    const s = await getResourceSnapshot(17, MONTH);
    expect(s.asOfDate).toBeNull();
    expect(s.manpowerPlanned + s.manpowerActual + s.equipmentPlanned + s.equipmentActual).toBe(0);
  });
});

describe('resourceWindow', () => {
  it('tháng hiện tại → kết thúc ở HÔM NAY, không phải cuối tháng', () => {
    expect(resourceWindow('2026-09').to).toBe('2026-09-16');
  });
  it('tháng quá khứ → kết thúc ở cuối tháng đó', () => {
    expect(resourceWindow('2026-07').to).toBe('2026-07-31');
  });
});

describe('getManpowerDaily', () => {
  it('7 ngày tracking, mỗi ngày 1 điểm đã cộng ngang 6 nhà thầu', async () => {
    const rows = await getManpowerDaily(1, MONTH);
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toEqual({ date: '2026-09-16', planned: 520, actual: 486 });
    expect([...rows].sort((a, b) => a.date.localeCompare(b.date))).toEqual(rows);
  });
});
```

`npx vitest run src/server/project-queries.test.ts` → PASS.

- [ ] **Bước 6: Thêm đúng 9 key i18n (ngoại lệ đã ghi ở Global Constraints)**

`src/i18n/messages/vi.json`, trong block `"detail"`, ngay sau `"actual": "Thực tế"`
(nhớ thêm dấu phẩy vào dòng đó):
```json
    "manpower": "Nhân lực (TT/KH)",
    "equipment": "Thiết bị (TT/KH)",
    "asOfDate": "Số liệu ngày {date}",
    "noDailyData": "Chưa có dữ liệu theo ngày",
    "manpowerTrend": "Nhân lực theo thời gian (KH vs TT)",
    "byWeek": "Theo tuần",
    "byMonth": "Theo tháng",
    "plannedHeadcount": "Số nhân lực kế hoạch",
    "actualHeadcount": "Số nhân lực thực tế"
```
`src/i18n/messages/en.json`, cùng vị trí trong block `"detail"`:
```json
    "manpower": "Manpower (actual/plan)",
    "equipment": "Equipment (actual/plan)",
    "asOfDate": "As of {date}",
    "noDailyData": "No daily data yet",
    "manpowerTrend": "Manpower over time (plan vs actual)",
    "byWeek": "By week",
    "byMonth": "By month",
    "plannedHeadcount": "Planned headcount",
    "actualHeadcount": "Actual headcount"
```
Đúng 9 key, hai file phải khớp nhau từng key — thiếu một bên là lỗi runtime của next-intl.

- [ ] **Bước 7: Viết `src/components/project/ManpowerDailyChart.tsx`**

Trước hết mở `src/components/dashboard/charts.tsx:45`, đổi `const TOOLTIP_STYLE = {`
thành `export const TOOLTIP_STYLE = {` để dùng lại, không chép style lần hai.

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/dashboard/charts';
import { groupByBucket, yearsLabel, type Bucket, type DailyPoint } from '@/lib/daily-series';

/**
 * Nhân lực kế hoạch vs thực tế, drill-down theo TUẦN hoặc THÁNG.
 * Trục X là khoảng ngày thật ('21.09 - 27.09') nên không có năm → năm nằm ở badge góc trái.
 * Màu bám bộ đỏ-vàng của dashboard: kế hoạch = vàng, thực tế = đỏ.
 */
export function ManpowerDailyChart({ data }: { data: DailyPoint[] }) {
  const t = useTranslations();
  const [bucket, setBucket] = useState<Bucket>('week');
  const series = groupByBucket(data, bucket);

  if (series.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{t('detail.noDailyData')}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">
          {yearsLabel(series)}
        </span>
        <div className="flex gap-1">
          {(['week', 'month'] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-md px-2 py-1 text-xs ${
                bucket === b ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t(b === 'week' ? 'detail.byWeek' : 'detail.byMonth')}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="planned"
            name={t('detail.plannedHeadcount')}
            stroke={CHART_COLORS.ac}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name={t('detail.actualHeadcount')}
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Bước 8: Gắn vào `app/[locale]/(app)/projects/[id]/page.tsx`**

Import (đặt cạnh 2 dynamic import chart sẵn có, dòng 14-15):
```tsx
const ManpowerDailyChart = dynamic(
  () => import('@/components/project/ManpowerDailyChart').then((m) => m.ManpowerDailyChart),
  { ssr: false, loading: () => <div className="h-60 animate-pulse rounded-lg bg-slate-200/70" /> },
);
import { getManpowerDaily, getResourceSnapshot } from '@/server/project-queries';
```

Trong thân hàm, cạnh các lệnh đọc dữ liệu khác (sau dòng 56 `const dims = …`):
```tsx
  const resources = await getResourceSnapshot(id, month);
  const manpowerDaily = await getManpowerDaily(id, month);
  const asOf = resources.asOfDate ? t('detail.asOfDate', { date: formatDate(resources.asOfDate, locale) }) : t('detail.noDailyData');
```

Ngay **dưới** lưới 6 KPI card (sau `</div>` của khối dòng 111-118) — 2 scorecard nguồn lực,
mỗi cái có dòng nhỏ ghi ngày của số liệu (prop `sub` của `KpiCard`, xem `KpiCard.tsx:68`):
```tsx
      {/* Nguồn lực: ảnh chụp NGÀY gần nhất có dữ liệu, không phải số theo tháng (Q3) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label={t('detail.manpower')}
          value={resources.asOfDate ? `${resources.manpowerActual}/${resources.manpowerPlanned}` : '-'}
          sub={asOf}
          delta={null}
          tone="neutral"
          icon={IconProject}
        />
        <KpiCard
          label={t('detail.equipment')}
          value={resources.asOfDate ? `${resources.equipmentActual}/${resources.equipmentPlanned}` : '-'}
          sub={asOf}
          delta={null}
          tone="neutral"
          icon={IconGauge}
        />
      </div>
```

**Cuối cùng**, ngay trước `</div>` đóng của trang (sau Card "Ảnh hiện trường", dòng 342) —
biểu đồ phải nằm ở CUỐI trang:
```tsx
      {/* Biểu đồ nhân lực KH vs TT - đặt cuối trang theo yêu cầu */}
      <Card>
        <CardHeader title={t('detail.manpowerTrend')} />
        <CardBody>
          <ManpowerDailyChart data={manpowerDaily} />
        </CardBody>
      </Card>
```

- [ ] **Bước 9: Kiểm chứng + commit**

```bash
npx tsc --noEmit && npx vitest run
npm run dev
```
Mở `http://localhost:3000/vi/projects/1` và kiểm bằng mắt:
1. 2 scorecard hiện `486/520` và `63/72`, dưới mỗi cái có dòng `Số liệu ngày 16/09/2026`.
2. Biểu đồ nằm **cuối trang**, 2 đường (vàng = kế hoạch, đỏ = thực tế).
3. Mặc định **Theo tuần**: seed có 7 ngày `2026-09-10 → 2026-09-16` nên ra đúng **2 điểm**,
   nhãn `07.09 - 13.09` và `14.09 - 20.09` — không có nhãn nào kiểu `W1`.
4. Bấm **Theo tháng**: còn **1 điểm**, nhãn `01.09 - 30.09`.
5. Badge góc trái chart ghi `2026`.
6. Mở `/en/projects/1`: nhãn tiếng Anh, không thấy key thô kiểu `detail.manpower`.

```bash
git commit -am "feat(project): scorecard nguồn lực theo ngày + biểu đồ nhân lực KH/TT (tuần/tháng)"
```

---

## Kiểm chứng cuối Run 1

Chạy sau khi xong cả 9 task. Mỗi dòng là một quyết định đã chốt — sai một dòng là Run 1 chưa xong.

- [ ] `npx tsc --noEmit` → 0 lỗi · `npx vitest run` → toàn bộ xanh · `npx prisma migrate status` → không còn migration chờ.
- [ ] **Q1:** `GET`-path của `fact_stage_milestone` (repo → page/API) trả `dayVariance`;
  `grep -n "dayVariance" prisma/schema.prisma` **không khớp dòng nào** (đúng: không lưu cột).
- [ ] **Q2:** `grep -rn "pctPlan" src/server/queries.ts` chỉ còn khai báo kiểu + biến duration;
  không còn `fact.pctPlan` hay `fact?.pctPlan`. Trang `/projects/1` và
  `GET /api/projects/1/summary` (chunk sau) trả **cùng một** `pctPlan` duy nhất, tính từ duration.
  Không tồn tại field `pctPlanDuration` / `pctPlanSource` ở bất kỳ response nào.
- [ ] **Q2:** lưu cùng một tháng 2 lần rồi chạy
  `SELECT "version","isLatest","pctPlan","pv","spi" FROM fact_progress_monthly
   WHERE "projectId"=1 AND "yearMonth"='2026-09' ORDER BY "version";`
  → 2 dòng, đúng 1 dòng `isLatest`, và `pv` **không** bằng `pctPlan × bac`.
- [ ] **Q3:** 2 scorecard + biểu đồ lấy số từ `fact_daily_manpower`/`fact_daily_equipment_usage`;
  `grep -rn "manpowerPlanned\|equipmentPlanned" app/\[locale\]` không khớp
  (trang không còn đọc cột tháng nữa).
- [ ] **Q4:** `grep -n "qtyPlanned\|qtyActual" prisma/schema.prisma` khớp trong
  `fact_daily_equipment_usage`; không còn cột `qty` trần.
- [ ] **Q5/Q6/Q7/Q8/Q9/Q10/Q11:** `grep -rn "TODO(Q" src prisma app` → **không khớp dòng nào**.

<!-- CHUNK-D-END -->
