# P1B — UI nhanh: Kế hoạch triển khai

> **Cho agent thực thi:** làm lần lượt từng Task, mỗi Task 1 commit. Bước dùng checkbox `- [ ]`.
> Skill planner đã dùng: `writing-plans`.

**Mục tiêu:** 7 hạng mục UI của P1B (A, T7, T5, T9, T10, T12a, T13) — không đụng DB/schema.
**Kiến trúc:** logic thuần tách ra `src/lib/*` để test bằng Vitest (môi trường `node`, KHÔNG có jsdom/testing-library —
không thêm thư viện); component chỉ gọi logic đó. Truy vấn phân trang audit_log nằm ở file MỚI, không sửa `prisma-repo.ts`.
**Tech:** Next.js 14 app router, Prisma 6, next-intl 3.26, React 18.3, Vitest 2.1 (`renderToStaticMarkup`).
**Nguồn yêu cầu:** `D:\_project\DDC_dieu-phoi\lo-trinh.md` mục "Tài khoản B" → P1B + bảng rà soát mục 1.

---

## ĐÃ CHỐT — chủ dự án trả lời 2026-09-24 (thay cho mục câu hỏi bên dưới)

- **Q1 (T12a): chọn (a)** — backlog = tổng giá trị HĐ các dự án trạng thái "Chuẩn bị". Làm **nhánh 8A**, gồm cả bước 8A-4
  (đổi cột Backlog từng dự án ở /report + Excel sang định nghĩa (a) cho thống nhất). Bỏ nhánh 8B.
- **Q2 (T13): chọn (T)** — số tuyệt đối = tấn thực tế/kế hoạch của từng giai đoạn. Làm **nhánh (T)** của Task 3;
  Thiết kế và Nghiệm thu không có số tấn → để trống/"-". Bỏ nhánh (V).
- **D1: giữ "Số liệu ngày dd/mm"** (chủ dự án đồng ý đề xuất). D2–D6 giữ nguyên mặc định của planner.
- Không còn câu hỏi chặn — coder làm đủ Task 1 → 8.

## Câu hỏi (ĐÃ TRẢ LỜI — xem mục trên)

**Q1 (chặn Task 8 — T12a). Backlog tính theo định nghĩa nào?** Hiện có 2 công thức lệch nhau (`src/server/queries.ts:185`):

| | (a) Giá trị HĐ của dự án trạng thái "Chuẩn bị" | (b) Cột `backlog` trong bảng tài chính `fact_financial` |
|---|---|---|
| Đang dùng ở | Thẻ KPI "Backlog" trang Tổng quan, số to trong card Backlog & Công nợ, trang /report (thẻ KPI), Từ điển dữ liệu (`data-dictionary.ts:119`) | Đường line chart trong card Backlog & Công nợ (`OverviewWidgets.tsx:128`), cột Backlog từng dự án ở /report + file Excel (`src/server/report.ts:42`) |
| Nguồn số | `Project.contractValue` + trạng thái suy ra từ ngày BĐ thực tế / %TT | Chỉ do seed ghi (`history.ts:556`: dự án chưa khởi công = BAC, còn lại = 0). **App không có ô nhập nào**; `saveFinancial` chép nguyên giá trị cũ (`prisma-repo.ts:862`); dự án tạo mới không có dòng → 0 |
| Hệ quả | Số tự sống theo dữ liệu thật; dự án khởi công là tự ra khỏi backlog. Không phản ánh HĐ đã ký nhưng còn phần việc chưa làm của dự án đang chạy | Số đứng yên từ lúc seed cho tới khi có màn nhập cột này (ngoài P1B, đụng form/`actions.ts` của A). Nếu sau này nhập tay thì có thể là "giá trị HĐ còn lại chưa thực hiện" |

**Q1-phụ (chỉ hỏi nếu chọn (a)):** cột Backlog **từng dự án** ở /report và file Excel export (`report.ts:42`, đang dùng (b)) có đổi sang (a) luôn không
(dự án "Chuẩn bị" = giá trị HĐ, dự án khác = 0)? Mặc định trong kế hoạch: **CÓ** (bước 8A-4), bỏ bước đó nếu chủ dự án nói không.

**Q2 (chặn Task 3 — T13b). "Số tuyệt đối cạnh %" ở Chuỗi giá trị là số gì?**
- (T) **Tấn TT/KH** của giai đoạn — lấy Σ từ bảng sản lượng hạng mục `fact_stage_work_item` (đúng số mà chart "Biểu đồ so sánh" đang vẽ).
  Chỉ có ở 5 giai đoạn định lượng (Shop, Vật tư, Gia công, Vận chuyển, Lắp dựng); **Thiết kế và Nghiệm thu không có số** (không hiện gì).
- (V) **Giá trị tỷ đồng đã làm được** của giai đoạn = BAC × trọng số × %HT. Có ở cả 7 giai đoạn; cộng 7 dòng ra EV của dự án.

Task 3 viết sẵn cả 2 nhánh. Mọi Task khác làm được ngay, không chờ.

### Quyết định mặc định của planner (không chặn — chủ dự án có thể phủ quyết khi duyệt)
- D1. Nhãn ngày trên thẻ A dùng chữ "**Số liệu ngày dd/mm**" (giống cách app đang ghi "Số liệu ngày {date}"); yêu cầu gốc ghi "Số ngày dd/mm" dễ đọc thành "bao nhiêu ngày".
- D2. "n nhà thầu" = số nhà thầu **khác nhau có dòng dữ liệu** trong đúng ngày gần nhất đó (nhân lực đếm trên bảng nhân lực, thiết bị đếm trên bảng thiết bị).
- D3. Số to trên thẻ = **thực tế (TT)**; "KH x" ở dòng phụ = kế hoạch cùng ngày.
- D4. Bấm thẻ nhân lực → cuộn tới card "Nhân lực theo nhà thầu"; thẻ thiết bị → card "Thiết bị theo nhóm" (2 card cùng ngày chụp với thẻ). Nhảy bằng anchor `#id`, không bật cuộn mượt toàn cục.
- D5. T5 trang /audit có nút chuyển "14 ngày gần nhất | Tất cả" (mặc định 14 ngày) — vì audit_log giữ lâu, phải có đường xem bản ghi cũ. Bảng rút gọn ở /admin chỉ hiện 20 dòng mới nhất trong 14 ngày (không phân trang, trang /audit đã có trong menu).
- D6. T12a: 2 scorecard kèm mũi tên so tháng trước (giống thẻ KPI Tổng quan) để giữ thông tin xu hướng mà line chart bị bỏ đi.

---

## Ràng buộc chung (áp cho MỌI Task)
- KHÔNG sửa `prisma/schema.prisma`, `prisma/migrations/`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `app/globals.css`, `PROGRESS.md`, `.serena/memories/`. Không đụng thư mục `D:\_project\DDC_Control_Tower`.
- Mọi style mới viết **inline** (`style={{...}}`) hoặc class Tailwind/class CSS đã có — để khỏi phải giữ `globals.css`.
- Key i18n mới: thêm **nhóm top-level mới ở CUỐI** `vi.json` và `en.json` (sau nhóm `"activity"`), không chèn vào nhóm cũ. vi và en phải có cùng bộ key (test `src/i18n/messages.test.ts` kiểm).
- Không thêm dependency. Không thêm index/migration.
- Sau MỖI commit: cập nhật `D:\_project\DDC_dieu-phoi\phien-B.md` (task, commit cuối, bước kế tiếp, file nóng đang giữ, giờ).
- Commit message theo kiểu repo: `feat(p1b): ...` / `fix(p1b): ...`, không dấu tiếng Việt.
- Cổng kiểm sau mỗi Task: `npx tsc --noEmit` sạch + `npm test` toàn bộ pass (mốc hiện tại 712/712; số test chỉ được tăng).
- Test mới theo mẫu: shim `globalThis.React` + `renderToStaticMarkup` (mẫu `src/components/dashboard/KpiCard.test.ts`);
  mock trang theo `src/server/projects-detail-page-render.test.ts` (dòng 11-51); mock Prisma theo `src/server/repo/prisma-repo-reset.test.ts` (dòng 16-43).
- Comment code tiếng Việt ngắn, theo giọng file đang sửa.

## File nóng cần giữ
Trước khi sửa: đọc `phien-A.md`; nếu A đang giữ file đó thì dừng, ghi chú, làm Task khác. Ghi vào mục "Đang giữ" của `phien-B.md`, bỏ ra sau commit.

| File nóng | Task sửa | Mức độ |
|---|---|---|
| `src/i18n/messages/vi.json`, `en.json` | 1, 3, 6 | chỉ thêm nhóm mới ở cuối |
| `src/server/project-queries.ts` | 1 | thêm 2 field vào `ResourceSnapshot` |
| `src/server/queries.ts` | 8 | nhánh (a): chỉ thay dòng comment TODO; nhánh (b): đổi công thức `backlog` trong `kpisForMonth` |
| `app/globals.css`, `actions.ts`, `prisma-repo.ts`, `schema.prisma` | — | **KHÔNG sửa** |

## Bản đồ file

| File | Việc | Task |
|---|---|---|
| `src/components/dashboard/KpiCard.tsx` | thêm prop `href`, `note` | 1 |
| `app/[locale]/(app)/projects/[id]/page.tsx` | thẻ A, bỏ EAC/VAC + hàng `.kpis k2`, id anchor; trọng số + số tuyệt đối chuỗi giá trị | 1, 2, 3 |
| `src/lib/value-chain-view.ts` (MỚI) | `stageWeightLabel`, `stageTonnage` / `stageEarnedValue` | 2, 3 |
| `src/lib/list-nav.ts` (MỚI) | `nextActiveIndex`, `listboxKeyAction` | 4 |
| `src/components/form/Combobox.tsx`, `src/components/project/ProjectSwitcher.tsx` | bàn phím + ARIA combobox/listbox | 4 |
| `src/components/layout/SettingsMenu.tsx`, `src/components/ui/HelpTip.tsx` | bàn phím + ARIA menu/tooltip | 5 |
| `src/lib/log-paging.ts` (MỚI) | hằng số, parse, `logSince`, `paginate`, `auditHref` | 6 |
| `src/server/audit-log-page.ts` (MỚI) | `getAuditLogPage` (Prisma trực tiếp, count + skip/take) | 6 |
| `app/[locale]/(app)/audit/page.tsx` | phân trang server, lọc 14 ngày/tất cả | 6 |
| `app/[locale]/(app)/admin/page.tsx`, `src/components/admin/AuditMiniTable.tsx` (MỚI), `src/components/admin/ActivityViewer.tsx` | bảng rút gọn đúng tiêu đề + có giờ; activity 20 dòng/trang | 6 |
| `src/components/dashboard/Watchlist.tsx` | 5 dòng + cuộn | 7 |
| `app/[locale]/(app)/overview/page.tsx` | hàng Team KD/Cơ cấu dùng `.g2` | 7 |
| `src/server/overdue-scorecard.ts` (MỚI), `src/components/dashboard/OverviewWidgets.tsx`, `src/components/dashboard/charts.tsx`, `src/lib/data-dictionary.ts` (+ `queries.ts`, `report.ts` tuỳ nhánh) | 2 scorecard | 8 |

**Ngoài phạm vi T7 (đã grep `setOpen(`, `aria-expanded`, `className="pop"`, `onKeyDown`, `<select` trong `src/**/*.tsx`):**
dropdown tự viết trong app chỉ có 4 cái: `Combobox`, `ProjectSwitcher`, `SettingsMenu`, `HelpTip`. Các `<select>` gốc (FilterBar, ProjectTable,
DrillCharts, ImportPanel, DataEntryForm, UserEditor, FieldEditor, ActivityViewer, DeleteProject) trình duyệt đã hỗ trợ bàn phím → không sửa.
`CreateProjectForm` (nút mở form), `AppShell` (ngăn kéo menu), `ChangePasswordModal` không phải dropdown → không sửa.

---

### Task 1: A — Thẻ "Tổng số nhân lực" / "Tổng số thiết bị" thay EAC/VAC (trang chi tiết dự án)

**Files:**
- Modify: `src/server/project-queries.ts:12-68` (interface `ResourceSnapshot` + `getResourceSnapshot`)
- Modify: `src/components/dashboard/KpiCard.tsx`
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx:99-103, 161-189, 459-474` + imports
- Modify: `src/i18n/messages/vi.json`, `en.json` (nhóm mới `resourceKpi`)
- Test: `src/server/project-queries.test.ts`, `src/components/dashboard/KpiCard.test.ts`, `src/server/projects-detail-page-render.test.ts`

**Interfaces — Produces:**
```ts
// project-queries.ts - thêm vào ResourceSnapshot
/** Số nhà thầu KHÁC NHAU có dòng nhân lực trong ngày manpowerAsOfDate; 0 nếu chưa có dữ liệu. */
manpowerContractors: number;
/** Số nhà thầu KHÁC NHAU có dòng thiết bị trong ngày equipmentAsOfDate; 0 nếu chưa có dữ liệu. */
equipmentContractors: number;

// KpiCard.tsx - thêm vào KpiCardProps
/** Dòng phụ thứ 2, hiện dưới `sub` (vd "KH 520 · 6 nhà thầu"). */
note?: string;
/** Có -> cả thẻ là <a href> (anchor cuộn tới chart), thêm class "tap" (đã có CSS: globals.css:253). */
href?: string;
```

- [ ] **Bước 1: Test hỏng trước**
  - `project-queries.test.ts` thêm describe mới (dùng `vi.spyOn(repo, 'getDailyManpower'/'getDailyEquipment').mockResolvedValueOnce(...)` như test N-6 dòng 47-66):
    nhân lực: ngày 16/09 nhà thầu 1 và 2, ngày 15/09 nhà thầu 3 → `manpowerContractors === 2`;
    thiết bị: 16/09 (nhà thầu 1, thiết bị 1), (nhà thầu 1, thiết bị 2), (nhà thầu 4, thiết bị 1) → `equipmentContractors === 2`.
    Dự án 17 (không có dữ liệu) → cả 2 bằng 0.
  - `KpiCard.test.ts`: có `href: '#x'` → markup chứa `<a href="#x" class="kpi rise tap"`; không `href` → vẫn `class="kpi rise"` trên `<div`;
    có `note: 'KH 5'` → xuất hiện thêm 1 `<div class="sb"><span>KH 5</span></div>`.
  - `projects-detail-page-render.test.ts`: sửa test "thu tu 6 the" thành thứ tự
    `['metric.pctPlan','metric.pctActual','metric.spi','metric.cpi','resourceKpi.manpowerTotal','resourceKpi.equipmentTotal']`;
    thêm: out KHÔNG chứa `<div class="lb">metric.eac</div>` và `<div class="lb">metric.vac</div>` (bảng EVM vẫn có `metric.eac` trong `<td>` — đừng assert chuỗi trơn);
    không chứa `kpis k2`; chứa `href="#res-manpower"`, `id="res-manpower"`, `href="#res-equipment"`, `id="res-equipment"`, `resourceKpi.planContractors`;
    dự án `'17'`: không chứa `resourceKpi.planContractors`, chứa `detail.noDailyData`.
- [ ] **Bước 2:** `npx vitest run src/server/project-queries.test.ts src/components/dashboard/KpiCard.test.ts src/server/projects-detail-page-render.test.ts` → FAIL.
- [ ] **Bước 3: Cài đặt**
  - `getResourceSnapshot`: `manpowerContractors: new Set(manpowerRows.map((m) => m.contractorId)).size`, tương tự `equipmentRows` → `equipmentContractors`.
  - `KpiCard`: giữ nguyên toàn bộ phần thân; tách thân thành biến `body`; sau khối `.sb` hiện có thêm `{note && <div className="sb"><span>{note}</span></div>}`.
    ```tsx
    const cls = `kpi rise${hero ? ' key' : ''}${href ? ' tap' : ''}`;
    return href
      ? <a href={href} className={cls} style={{ color: 'inherit', textDecoration: 'none' }}>{body}</a>
      : <div className={cls}>{body}</div>;
    ```
    KHÔNG thêm `'use client'`, không hook (component phải giữ sync — xem comment dòng 16-21).
  - `page.tsx`:
    - Xoá 2 KpiCard EAC/VAC (dòng 167-168) và cả khối `<Rise className="kpis k2">` (dòng 171-189); xoá `manpowerAsOf`/`equipmentAsOf` (dòng 99-103) nếu không còn dùng; xoá import `IconFlag` nếu không còn dùng.
    - Import `formatDayMonth` và `formatTon as formatQty` từ `@/lib/format` (trang đã có hàm nội bộ tên `formatTon` ở cuối file — phải đặt alias).
    - Thêm vào cuối hàng `.kpis` (sau CPI):
    ```tsx
    <KpiCard label={t('resourceKpi.manpowerTotal')}
      value={resources.manpowerAsOfDate ? formatQty(resources.manpowerActual, locale) : '-'}
      sub={resources.manpowerAsOfDate ? t('resourceKpi.asOf', { date: formatDayMonth(resources.manpowerAsOfDate) }) : t('detail.noDailyData')}
      note={resources.manpowerAsOfDate ? t('resourceKpi.planContractors', { planned: formatQty(resources.manpowerPlanned, locale), n: resources.manpowerContractors }) : undefined}
      href="#res-manpower" delta={null} tone="neutral" icon={IconProject} />
    <KpiCard label={t('resourceKpi.equipmentTotal')}
      value={resources.equipmentAsOfDate ? formatQty(resources.equipmentActual, locale) : '-'}
      sub={resources.equipmentAsOfDate ? t('resourceKpi.asOf', { date: formatDayMonth(resources.equipmentAsOfDate) }) : t('detail.noDailyData')}
      note={resources.equipmentAsOfDate ? t('resourceKpi.planContractors', { planned: formatQty(resources.equipmentPlanned, locale), n: resources.equipmentContractors }) : undefined}
      href="#res-equipment" delta={null} tone="neutral" icon={IconGauge} />
    ```
    - 2 Card "Tầng 4" (dòng 459, 467): `<Card id="res-manpower" style={{ scrollMarginTop: 72 }}>` và `<Card id="res-equipment" style={{ scrollMarginTop: 72 }}>` (72 = topbar sticky 56px + khoảng thở).
  - i18n nhóm mới ở cuối file:
    - vi: `"resourceKpi": { "manpowerTotal": "Tổng số nhân lực", "equipmentTotal": "Tổng số thiết bị", "asOf": "Số liệu ngày {date}", "planContractors": "KH {planned} · {n} nhà thầu" }`
    - en: `"resourceKpi": { "manpowerTotal": "Total manpower", "equipmentTotal": "Total equipment", "asOf": "Data of {date}", "planContractors": "Plan {planned} · {n} contractors" }`
- [ ] **Bước 4:** chạy lại 3 file test → PASS; `npx tsc --noEmit`; `npm test`.
- [ ] **Bước 5: Commit** `feat(p1b): the tong nhan luc/thiet bi thay EAC/VAC, bam de cuon toi chart (A)`

**Trường hợp biên bắt buộc:** chưa có dữ liệu ngày → `-` + "Chưa có dữ liệu theo ngày", không có dòng note; nhân lực và thiết bị lệch ngày → mỗi thẻ ghi ngày của chính nó (giữ N-6); KH = 0 vẫn hiện "KH 0"; chỉ trang chi tiết (không sửa `/overview`, `/report`).

---

### Task 2: T13a — Cột trọng số lấy thật từ `project_stage_weight`

**Files:**
- Create: `src/lib/value-chain-view.ts`, Test: `src/lib/value-chain-view.test.ts`
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx:97, 273`
- Test: `src/server/projects-detail-page-render.test.ts`

**Interfaces — Produces:**
```ts
import type { ProjectStageWeight, StageCode } from '@/server/repo/types';
/** Nhãn cột trọng số: "40%", "33,3%" (vi) / "33.3%" (en); không có dòng hoặc applicable=false -> "-". */
export function stageWeightLabel(weights: ProjectStageWeight[], code: StageCode, locale: string): string;
```

- [ ] **Bước 1: Test hỏng** — `value-chain-view.test.ts`: `weightPct 40` → `'40%'`; `33.333` + `'vi'` → `'33,3%'`; `33.333` + `'en'` → `'33.3%'`; `applicable:false` → `'-'`; không có dòng → `'-'`.
  Page test: dự án 1 (seed trọng số mặc định 5/10/10/40/5/27/3) → out chứa `class="w">40%</span>` và `class="w">5%</span>`, không chứa `class="w">-</span>`.
- [ ] **Bước 2:** chạy → FAIL.
- [ ] **Bước 3: Cài đặt**
  ```ts
  export function stageWeightLabel(weights: ProjectStageWeight[], code: StageCode, locale: string): string {
    const w = weights.find((x) => x.stageCode === code);
    if (!w || !w.applicable) return '-';
    return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }).format(w.weightPct)}%`;
  }
  ```
  `page.tsx`: tách `const stageWeights = await repo.getStageWeights(id);` rồi `buildStageTimelineRows(await repo.getStageMilestones(id), stageWeights)`;
  dòng 273 → `<span className="w">{stageWeightLabel(stageWeights, stage, locale)}</span>`.
  (Repo đã tự rơi về bộ mặc định khi dự án chưa cấu hình trọng số — không xử lý lại.)
- [ ] **Bước 4:** PASS + tsc + `npm test`.
- [ ] **Bước 5: Commit** `feat(p1b): cot trong so chuoi gia tri lay tu project_stage_weight (T13)`

---

### Task 3: T13b — Số tuyệt đối cạnh % (CHỜ Q2 — làm đúng 1 nhánh)

**Files:** Modify `src/lib/value-chain-view.ts` (+ test), `app/[locale]/(app)/projects/[id]/page.tsx:264-279`, `vi.json`/`en.json` (chỉ nhánh T), page render test.

**Chung cho 2 nhánh:** dòng `.stage` thêm `style={{ gridTemplateColumns: '116px 38px 1fr auto' }}` (cột cuối tự giãn để chứa số, không sửa globals.css);
số tuyệt đối là 1 `<span>` nằm TRONG `.pc`, sau text %:
`<span className="text-label3" style={{ fontWeight: 500, marginLeft: 6, whiteSpace: 'nowrap' }}>…</span>`. Không có số → không render span.

**Nhánh T (tấn):**
```ts
import type { WorkItemCompare } from '@/lib/stage-timeline';
/** Σ KH/TT (tấn) của giai đoạn định lượng từ getWorkItemComparison; giai đoạn thủ công hoặc không có hạng mục -> null. */
export function stageTonnage(compare: WorkItemCompare, code: StageCode): { planned: number; actual: number } | null {
  const rows = compare[code];
  if (!rows || rows.length === 0) return null;
  return { planned: rows.reduce((s, r) => s + r.planned, 0), actual: rows.reduce((s, r) => s + r.actual, 0) };
}
```
Trang dùng biến `compare` đã có (dòng 98), text: `t('valueChainAbs.ton', { actual: formatQty(x.actual, locale), planned: formatQty(x.planned, locale) })`.
i18n nhóm mới: vi `"valueChainAbs": { "ton": "{actual}/{planned} tấn" }`, en `"valueChainAbs": { "ton": "{actual}/{planned} t" }`.
Test: `stageTonnage` với 2 dòng → cộng đúng; `design` / stage không có key → `null`; mảng rỗng → `null`. Page dự án 1 chứa `valueChainAbs.ton`.

**Nhánh V (giá trị):**
```ts
/** Giá trị đã làm của giai đoạn = BAC × trọng số% × %HT (tỷ). Thiếu trọng số/applicable=false/BAC<=0 -> null. */
export function stageEarnedValue(bac: number, weights: ProjectStageWeight[], code: StageCode, pct: number): number | null {
  const w = weights.find((x) => x.stageCode === code);
  if (!w || !w.applicable || !(bac > 0)) return null;
  return bac * (w.weightPct / 100) * pct;
}
```
Trang: `bac = latest?.bac || project.contractValue` (giống `WhatIf` dòng 325), text `formatTyd(v, locale)`. Không cần key i18n.
Test: `(100, trọng số 40, 'fabrication', 0.5)` → `20`; applicable=false → `null`; bac 0 → `null`. Page dự án 1: trong `class="pc"` có chữ `tỷ`.

- [ ] Bước 1 test hỏng → Bước 2 FAIL → Bước 3 cài → Bước 4 PASS + tsc + `npm test`
- [ ] **Bước 5: Commit** `feat(p1b): chuoi gia tri hien so tuyet doi canh % (T13)`

**Biên:** %HT > 100% (tối đa 1.5) vẫn hiện số thật; giai đoạn bị ẩn (`v && !v.applicable`) giữ nguyên hành vi ẩn.

---

### Task 4: T7a — Bàn phím cho `Combobox` + `ProjectSwitcher`

**Files:**
- Create: `src/lib/list-nav.ts`, Test: `src/lib/list-nav.test.ts`
- Modify: `src/components/form/Combobox.tsx`, `src/components/project/ProjectSwitcher.tsx`
- Test (mới): `src/components/form/Combobox.test.ts`

**Interfaces — Produces (Task 5 dùng `nextActiveIndex`):**
```ts
/** ↓/↑ vòng tròn trong [0, count). current = -1 nghĩa là chưa chọn. count = 0 -> -1. Phím khác -> giữ current. */
export function nextActiveIndex(current: number, key: string, count: number): number;

export type ListboxAction =
  | { type: 'none' }
  | { type: 'open'; active: number }   // mở danh sách + đặt mục active
  | { type: 'move'; active: number }
  | { type: 'choose'; index: number }
  | { type: 'close' };
/** Bảng quyết định phím cho ô combobox (focus luôn ở input, dùng aria-activedescendant). */
export function listboxKeyAction(key: string, s: { open: boolean; active: number; count: number }): ListboxAction;
```
Luật `nextActiveIndex`: `count<=0 → -1`; `ArrowDown`: `current<0 ? 0 : (current+1)%count`; `ArrowUp`: `current<0 ? count-1 : (current-1+count)%count`.
Luật `listboxKeyAction`:
- `ArrowDown`: đóng → `{open, active: count>0 ? 0 : -1}`; mở → `{move, nextActiveIndex(active,'ArrowDown',count)}`.
- `ArrowUp`: đóng → `{open, active: count>0 ? count-1 : -1}`; mở → `{move, …'ArrowUp'…}`.
- `Enter`: mở và `0<=active<count` → `{choose, index: active}`; còn lại `none` (để Enter mặc định của trình duyệt chạy).
- `Escape`: mở → `close`; đóng → `none` (để modal/Esc bên ngoài xử lý).
- Phím khác → `none`.

- [ ] **Bước 1: Test hỏng** — `list-nav.test.ts` phủ đủ bảng trên, gồm biên: `count 0`, vòng từ cuối về đầu và đầu về cuối, `Enter` khi `active=-1`, `Enter` khi `active>=count`, `Escape` khi đóng.
  `Combobox.test.ts` (render tĩnh, trạng thái đóng): input có `role="combobox"`, `aria-expanded="false"`, `aria-autocomplete="list"`, `aria-controls="…"` (id khác rỗng), không có `aria-activedescendant`.
- [ ] **Bước 2:** FAIL.
- [ ] **Bước 3: Cài đặt — Combobox**
  - State thêm `const [active, setActive] = useState(-1)`; `const listId = useId()`; `optId = (i) => \`${listId}-o${i}\``.
  - `showCreate = allowCreate && !!q && !exactMatch`; `count = filtered.length + (showCreate ? 1 : 0)`; chỉ số `filtered.length` = nút tạo mới.
  - Mỗi lần `query` đổi hoặc mở/đóng → `setActive(-1)`.
  - `useEffect([active])`: `document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' })` khi `active>=0`.
  - input thêm: `role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? optId(active) : undefined}` và
    ```ts
    onKeyDown={(e) => {
      const a = listboxKeyAction(e.key, { open, active, count });
      if (a.type === 'none') return;
      e.preventDefault();
      if (a.type === 'open') { setQuery(currentLabel); setOpen(true); setActive(a.active); }
      else if (a.type === 'move') setActive(a.active);
      else if (a.type === 'choose') { if (a.index < filtered.length) pick(filtered[a.index].value); else void create(); }
      else { setOpen(false); setQuery(''); setActive(-1); } // Esc: focus vẫn ở input (trigger)
    }}
    ```
    (`pick(v)` = gom 3 dòng `onChange(v); setQuery(''); setOpen(false)` đang lặp ở onClick.)
  - `.pop` thêm `id={listId} role="listbox"`; mỗi nút option: `id={optId(i)} role="option" aria-selected={i === active} tabIndex={-1}`,
    `onMouseEnter={() => setActive(i)}`, `style={i === active ? { background: 'var(--fill)' } : undefined}`; nút tạo mới tương tự với chỉ số `filtered.length`, gộp style cũ + nền khi active.
  - Div "-" khi rỗng giữ nguyên (không role).
- [ ] **Bước 4: Cài đặt — ProjectSwitcher** giống hệt khuôn trên với `count = results.length`; `choose` → `select(results[index].id)`; Esc → `setOpen(false); setQuery('')`.
  Chỉ render `role="listbox"` khi `results.length > 0`; nhánh "Không tìm thấy" giữ `<p>` không role. Nút option thêm `type="button"`.
- [ ] **Bước 5:** PASS + tsc + `npm test`.
- [ ] **Bước 6: Commit** `feat(p1b): ban phim len/xuong/Enter/Esc cho Combobox va ProjectSwitcher (T7)`

**Biên:** danh sách rỗng (↓ không lỗi, active -1); danh sách bị lọc lại khi đang active (reset -1); Enter không submit/không chọn khi chưa có mục active; Esc khi đã đóng không nuốt phím; chuột và phím dùng chung 1 mục đang sáng.

---

### Task 5: T7b — Bàn phím cho `SettingsMenu` + `HelpTip`

**Files:** Modify `src/components/layout/SettingsMenu.tsx`, `src/components/ui/HelpTip.tsx`; Test: `src/components/ui/HelpTip.test.ts` (sửa), `src/components/layout/SettingsMenu.test.ts` (mới).
**Consumes:** `nextActiveIndex` từ `@/lib/list-nav` (Task 4).

**SettingsMenu (mẫu WAI-ARIA menu button):**
- `triggerRef`, `panelRef`, `menuId = useId()`, state `focusOnOpen: 'first' | 'last'` (mặc định `'first'`).
- Nút trigger thêm `ref={triggerRef} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}` và `onKeyDown`: `ArrowDown` → mở + `'first'`; `ArrowUp` → mở + `'last'`; preventDefault. (Enter/Space dùng click gốc của `<button>` → mở, focus mục đầu.)
- Panel: `id={menuId} role="menu" ref={panelRef}`. Mọi phần tử bấm được trong panel (nút `Section`, `Link` cấu hình, nút theme, nút ngôn ngữ, nút đổi mật khẩu, nút đăng xuất) thêm `role="menuitem" tabIndex={-1}`. Nút `Section` thêm `aria-expanded={open}`.
- `useEffect([open])`: khi `open` thành true → lấy `items()` rồi focus `items()[0]` hoặc phần tử cuối theo `focusOnOpen`.
  `const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])` (truy vấn động vì Section mở/đóng làm đổi danh sách).
- Panel `onKeyDown`:
  - `ArrowDown`/`ArrowUp`: `const list = items(); const i = list.indexOf(document.activeElement as HTMLElement); list[nextActiveIndex(i, e.key, list.length)]?.focus(); e.preventDefault();`
  - `Escape`: `e.preventDefault(); close(true)`.
  - `Tab`: `close(false)` (không preventDefault — focus đi tiếp tự nhiên).
  - Enter: KHÔNG chặn — kích hoạt gốc của button/link.
- `function close(returnFocus: boolean) { setOpen(false); if (returnFocus) triggerRef.current?.focus(); }` — `choose`, `chooseLocale`, nút đổi mật khẩu gọi `close(true)`; `Link` cấu hình và click ra ngoài gọi `close(false)`.
- `ChangePasswordModal` không đổi.

**HelpTip (tooltip — ↑/↓/Enter không áp dụng vì không có danh sách; chỉ cần Esc):**
- `const bubId = useId()`; button thêm `aria-describedby={bubId}`; span `.bub` thêm `id={bubId} role="tooltip"`.
- `onKeyDown`: `Escape` → `bub.style.display = 'none'` (inline thắng CSS `:focus-visible`), focus giữ trên nút.
- Trong `place()` (chạy khi pointerenter/focus) thêm `bub.style.removeProperty('display')`; thêm `onBlur` và `onPointerLeave` cũng `removeProperty('display')` để lần mở sau hiện lại.

- [ ] **Bước 1: Test hỏng**
  - `HelpTip.test.ts`: thay assert chuỗi cứng dòng 12 bằng: có `class="help rt"`, `aria-label="Giải thích"`, `aria-describedby="X"` và `<span class="bub" id="X" role="tooltip">Nội dung</span>` với cùng X (bắt bằng regex `aria-describedby="([^"]+)"` rồi so id).
  - `SettingsMenu.test.ts`: mock `next-intl` (`useTranslations: () => (k) => k, useLocale: () => 'vi'`), `next-auth/react` (`signOut: vi.fn()`), `@/i18n/navigation` (`Link` → `<a>`, `usePathname: () => '/overview'`, `useRouter: () => ({ replace: vi.fn() })`), `./ChangePasswordModal` (`() => null`).
    Render tĩnh với user admin → nút trigger có `aria-haspopup="menu"`, `aria-expanded="false"`, `aria-controls="…"`; không có `role="menu"` (đang đóng).
- [ ] **Bước 2:** FAIL → **Bước 3:** cài → **Bước 4:** PASS + tsc + `npm test`.
- [ ] **Bước 5: Commit** `feat(p1b): ban phim cho SettingsMenu (menu button) va HelpTip (Esc an bong bong) (T7)`

**Biên:** menu mở bằng chuột vẫn focus mục đầu (đúng mẫu ARIA); Section mở/đóng khi đang điều hướng không làm mất focus; Esc luôn trả focus về nút ⚙; menu đang đóng thì ↑/↓ trên trigger mới mở, không cuộn trang.

---

### Task 6: T5 — Nhật ký: 20 dòng/trang, cuộn, có giờ, 14 ngày mặc định, sửa tiêu đề /admin

**Files:**
- Create: `src/lib/log-paging.ts` (+ `src/lib/log-paging.test.ts`)
- Create: `src/server/audit-log-page.ts` (+ `src/server/audit-log-page.test.ts`)
- Create: `src/components/admin/AuditMiniTable.tsx` (+ `src/components/admin/AuditMiniTable.test.ts`)
- Modify: `app/[locale]/(app)/audit/page.tsx`, `app/[locale]/(app)/admin/page.tsx:23-25, 49-88`, `src/components/admin/ActivityViewer.tsx`
- Modify tests: `src/server/operation-pages-render.test.ts`, `src/server/pages-role-guard.test.ts`, `src/components/admin/ActivityViewer.test.ts`, `src/i18n/messages.test.ts`
- Modify: `vi.json`, `en.json` (nhóm mới `logPaging`)

**Interfaces — Produces:**
```ts
// src/lib/log-paging.ts
export const LOG_PAGE_SIZE = 20;
export const LOG_DEFAULT_DAYS = 14;
export type LogRange = '14d' | 'all';
/** Chỉ 'all' là 'all'; mọi giá trị khác (thiếu, rác, mảng) -> '14d'. */
export function parseLogRange(v: string | string[] | undefined): LogRange;
/** Số nguyên >= 1; thiếu/rác/<1/mảng -> 1. */
export function parsePage(v: string | string[] | undefined): number;
/** '14d' -> now - 14 ngày (ms); 'all' -> null. */
export function logSince(range: LogRange, now: Date): Date | null;
/** Kẹp page vào [1, totalPages]; totalPages >= 1 kể cả total = 0. */
export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; page: number; totalPages: number };
/** Link /audit, bỏ tham số mặc định: auditHref({page:1,range:'14d'}) === '/audit'; ({page:2,range:'all'}) === '/audit?range=all&page=2'. */
export function auditHref(p: { page: number; range: LogRange }): string;

// src/server/audit-log-page.ts - dùng `prisma` từ '@/server/db' TRỰC TIẾP (không qua repo, không sửa prisma-repo.ts)
export interface AuditLogPage { items: AuditLogEntry[]; total: number; page: number; totalPages: number; pageSize: number }
export async function getAuditLogPage(opts: { page: number; range: LogRange; pageSize?: number; now?: Date }): Promise<AuditLogPage>;
```
Cài `getAuditLogPage`: `where = since ? { changedAt: { gte: since } } : {}` → `total = await prisma.auditLog.count({ where })` →
`totalPages = max(1, ceil(total/pageSize))`, `page = min(max(1, opts.page), totalPages)` →
`prisma.auditLog.findMany({ where, orderBy: [{ changedAt: 'desc' }, { id: 'desc' }], skip: (page-1)*pageSize, take: pageSize })` → map sang `AuditLogEntry` đúng như `prisma-repo.ts:653-662` (`changedAt.toISOString()`). Không thêm index.

- [ ] **Bước 1: Test hỏng**
  - `log-paging.test.ts`: `parseLogRange('all')='all'`, `('x')`/`undefined`/`['all']` → `'14d'`; `parsePage('3')=3`, `'0'`/`'-1'`/`'abc'`/`'2.5'`/`undefined`/`['2']` → 1;
    `logSince('14d', new Date('2026-09-24T00:00:00Z'))` = `2026-09-10T00:00:00Z`, `logSince('all', …) = null`;
    `paginate` 25 phần tử trang 2 → 5 phần tử, `totalPages 2`; trang 9 → kẹp về 2; rỗng → `{items:[], total:0, page:1, totalPages:1}`; `auditHref` 3 ca.
  - `audit-log-page.test.ts` (mock `@/server/db` với `auditLog: { count, findMany }` theo mẫu `prisma-repo-reset.test.ts`): count=45, page=2, range '14d', now cố định →
    `findMany` gọi với `where.changedAt.gte` đúng mốc, `orderBy` như trên, `skip:20, take:20`; count=45 page=99 → `page 3, skip 40`; count=0 → `page 1, totalPages 1`; range 'all' → `where` = `{}`.
  - `AuditMiniTable.test.ts`: header theo đúng thứ tự `time, user, table, record, field` (lấy từ prop `labels`); ô thời gian = `formatDateTime(changedAt, 'vi')` (có giờ:phút); rỗng → hiện `labels.empty`, không có `<table`.
  - `ActivityViewer.test.ts` thêm: 25 dòng → chỉ 20 `<tr` trong tbody, có chữ `1 / 2`; ô thời gian chứa giờ (`formatDateTime`).
  - `operation-pages-render.test.ts`: 25 lần `repo.logAudit(...)` → out có đúng 20 dòng dữ liệu và `href="/audit?page=2"`; `render(() => AuditPage({ searchParams: { range: 'all' } }))` → có link `href="/audit"` (quay về 14 ngày).
- [ ] **Bước 2:** FAIL.
- [ ] **Bước 3: Mock trang (bắt buộc, nếu thiếu test sẽ chọc Postgres thật)** — thêm vào `operation-pages-render.test.ts` VÀ `pages-role-guard.test.ts`:
  ```ts
  vi.mock('@/server/audit-log-page', async () => {
    const { repo } = await import('@/server/repo/mock-repo');
    const { paginate, logSince } = await import('@/lib/log-paging');
    return {
      getAuditLogPage: vi.fn(async ({ page, range, pageSize = 20, now = new Date() }: { page: number; range: 'all' | '14d'; pageSize?: number; now?: Date }) => {
        const since = logSince(range, now);
        const rows = repo.getAuditLog().filter((a) => !since || new Date(a.changedAt) >= since);
        return { ...paginate(rows, page, pageSize), pageSize };
      }),
    };
  });
  ```
- [ ] **Bước 4: Cài đặt**
  - `/audit/page.tsx`: chữ ký `export default async function AuditPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> } = {})`
    (test cũ gọi `AuditPage()` không tham số — phải chạy). Guard RBAC giữ nguyên, chạy TRƯỚC khi đọc dữ liệu.
    `const range = parseLogRange(searchParams.range); const data = await getAuditLogPage({ page: parsePage(searchParams.page), range });`
    Badge đếm = `data.total`. Trên bảng: 2 `Link` (từ `@/i18n/navigation`) `auditHref({page:1,range:'14d'})` / `auditHref({page:1,range:'all'})`, nhãn `logPaging.range14` / `logPaging.rangeAll`,
    mục đang chọn class `btn`, còn lại `btn ghost` (style `padding:'5px 12px', fontSize:'var(--t-caption1)'` như `ProjectTable.tsx:134`).
    `CardBody` thêm `style={{ maxHeight: 600, overflowY: 'auto' }}` (giữ `className="scroll"`, `thead` sticky đã có).
    Thanh phân trang dưới bảng: markup copy `ProjectTable.tsx:129-149` nhưng dùng `Link` (← `auditHref({page:page-1,range})`, → `page+1`) có `aria-label` `logPaging.prev`/`logPaging.next`;
    ở biên thay bằng `<span className="btn ghost" aria-disabled="true" style={{…, opacity: .4}}>←</span>`; giữa là `{`${page} / ${totalPages}`}` (1 chuỗi template — nếu viết `{page} / {totalPages}` React chèn `<!-- -->` và test so chuỗi sẽ hỏng; áp dụng cả ở ActivityViewer). Rỗng → `common.noData` như cũ.
  - `AuditMiniTable.tsx` (server-safe: không `'use client'`, không hook):
    `export function AuditMiniTable({ entries, locale, labels }: { entries: AuditLogEntry[]; locale: string; labels: { time: string; user: string; table: string; record: string; field: string; empty: string } })`
    — bảng `.tbl sticky` trong `<div className="scroll" style={{ maxHeight: 480, overflowY: 'auto' }}>`, cột: `formatDateTime(changedAt)` (class `mono`) | `changedBy` | `tableName` | `recordId` (mono) | `field`.
  - `/admin/page.tsx`: bỏ `repo.getAuditLog()`; `const auditPage = await getAuditLogPage({ page: 1, range: '14d' });`
    Card: `title={t('audit.title')}` `subtitle={\`${t('logPaging.range14')} · ${auditPage.total}\`}`, thân `<AuditMiniTable entries={auditPage.items} locale={locale} labels={{ time: t('admin.time'), user: t('admin.user'), table: t('audit.table'), record: t('audit.record'), field: t('audit.field'), empty: t('common.noData') }} />`.
    Activity: `const since = logSince('14d', new Date())!; const activity = (await repo.getActivity()).filter((a) => new Date(a.createdAt) >= since);` (xoá lười chỉ chạy khi có ghi mới → phải lọc lúc đọc).
  - `ActivityViewer.tsx`: `formatDate` → `formatDateTime`; state `page` (reset về 1 khi đổi filter); `const view = paginate(rows, page, LOG_PAGE_SIZE)`; render `view.items`;
    khung cuộn `maxHeight: 480` (thay 256) + `overflowY: 'auto'`; dưới bảng thanh ← `x / y` → bằng `<button type="button">` copy markup `ProjectTable.tsx:129-149`, `aria-label` `logPaging.prev/next`.
  - i18n nhóm mới: vi `"logPaging": { "range14": "14 ngày gần nhất", "rangeAll": "Tất cả", "prev": "Trang trước", "next": "Trang sau" }`;
    en `"logPaging": { "range14": "Last 14 days", "rangeAll": "All", "prev": "Previous page", "next": "Next page" }`.
  - `messages.test.ts` `CHANGED_SOURCES` thêm `'trang /admin': 'app/[locale]/(app)/admin/page.tsx'`, `'ActivityViewer': 'src/components/admin/ActivityViewer.tsx'`.
- [ ] **Bước 5:** PASS + tsc + `npm test`.
- [ ] **Bước 6: Commit** `feat(p1b): nhat ky 20 dong/trang, co gio, mac dinh 14 ngay, sua tieu de cot /admin (T5)`

**Biên:** `?page=abc`, `?page=0`, `?page=99`, `?page=a&page=b` (mảng) → an toàn; bảng rỗng; đúng 20 dòng (1 trang, cả 2 nút mờ); nhiều bản ghi cùng `changedAt` → thứ tự ổn định nhờ `id desc`;
KHÔNG xoá audit_log; retention activity_log (`prisma-repo.ts:689-693`) giữ nguyên.
Ghi chú cho reviewer: `count` + `findMany` vẫn quét bảng vì chưa có index (T1 thuộc P2B) — chấp nhận theo yêu cầu "không thêm index".
Không đổi `repo.getAuditLog()` ở `/overview` và `/projects/[id]` (dùng cho "Cập nhật DB lần cuối" — thuộc T1).

---

### Task 7: T9 + T10 — Trang Tổng quan

**Files:** Modify `src/components/dashboard/Watchlist.tsx`, `app/[locale]/(app)/overview/page.tsx:92`; Create `src/lib/visible-rows.ts` (+ test); Test mới `src/components/dashboard/Watchlist.test.ts`.

**Interfaces — Produces:**
```ts
// src/lib/visible-rows.ts
export const WATCHLIST_VISIBLE_ROWS = 5;
/** Chiều cao khung để thấy trọn `visible` dòng đầu: (top+height của dòng thứ `visible`) - top dòng đầu. Số dòng <= visible -> null (không giới hạn). */
export function maxHeightForRows(rows: { offsetTop: number; offsetHeight: number }[], visible: number): number | null;
```
- [ ] **Bước 1: Test hỏng**
  - `visible-rows.test.ts`: 7 dòng top `[0,82,164,…]` height 72 → `4*82+72 = 400`; 5 dòng → `null`; 0 dòng → `null`; dòng đầu có top 10 → trừ 10.
  - `Watchlist.test.ts` (mock `next-intl` + `@/i18n/navigation` Link → `<a>`): 7 mục → khung danh sách có `overflow-y:auto` và `max-height:400px` (giá trị dự phòng SSR); 3 mục → không có `max-height`.
- [ ] **Bước 2:** FAIL.
- [ ] **Bước 3: Cài đặt T9** — trong `Watchlist`: `listRef` gắn vào `div.flex.flex-col.gap-2.5`; khi `items.length > WATCHLIST_VISIBLE_ROWS` style `{ maxHeight: measured ?? 400, overflowY: 'auto' }`;
  `useEffect([items.length])` đo `maxHeightForRows(Array.from(listRef.current.children) as HTMLElement[], 5)` → `setMeasured`, đăng ký lại khi `window` `resize` (gỡ listener khi unmount).
  Dùng `useEffect`, không `useLayoutEffect` (component SSR). Tiêu đề/thứ tự/nội dung dòng giữ nguyên.
- [ ] **Bước 4: Cài đặt T10** — `overview/page.tsx` dòng 92: `<div className="g21">` → `<div className="g2">` (`.g2` = `1fr 1fr`, cùng breakpoint 1180px). **Chỉ dòng 92**; `.g21` ở dòng 101 và 111 giữ nguyên; không sửa CSS `.g21`.
- [ ] **Bước 5:** PASS + tsc + `npm test`.
- [ ] **Bước 6: Commit** `feat(p1b): du an can luu y 5 dong + cuon (T9), 2 chart Team KD/Co cau rong bang nhau (T10)`

**Biên:** 0 mục → giữ "Không có cảnh báo"; ≤ 5 mục không có thanh cuộn; dòng có nhiều badge xuống dòng → đo lại khi đổi kích thước cửa sổ.

---

### Task 8: T12a — Backlog & Công nợ quá hạn thành 2 scorecard (CHỜ Q1)

**Chung cho 2 nhánh:**
- Create `src/server/overdue-scorecard.ts` (+ `src/server/overdue-scorecard.test.ts`, mock `@/server/repo` → mock-repo như `queries.test.ts:5-8`):
  ```ts
  export interface Scorecard { value: number; delta: number | null }
  /** Công nợ quá hạn tháng `month` trong phạm vi filter cấp dự án (getScopedProjectIds - KHÔNG lọc status, giống card cũ).
   *  delta = cur - prev (làm tròn 0,1); null khi month='all'/sai format hoặc tháng này/tháng trước chưa có dòng tài chính nào (không bịa delta). */
  export async function getOverdueScorecard(month: string, filters: DashboardFilters): Promise<Scorecard>;
  ```
  Cài: `ids = await getScopedProjectIds(filters)`; `cur = repo.getFinancialForMonth(month)`; `value = Σ cur.filter(ids).arOverdue`;
  nếu `month === 'all' || !isValidYearMonth(month)` → `delta null`; `prev = repo.getFinancialForMonth(prevMonth(month))`; `cur.length === 0 || prev.length === 0` → `null`;
  ngược lại `Math.round((value - Σ prev.filter(ids).arOverdue) * 10) / 10`.
  Test: tháng '2026-09' → value khớp tổng tay từ `repo.getFinancialForMonth`; 'all' → delta null; tháng trước cửa sổ dữ liệu (vd '2020-01') → value 0, delta null; filter team → chỉ cộng dự án của team.
- `OverviewWidgets.tsx` `BacklogOverdueCard`: bỏ toàn bộ tính trend 12 tháng + `<BacklogOverdueLine>`; giữ `<Card>` + `CardHeader title={t('overview.backlogOverdue')}`; thân:
  ```tsx
  <CardBody>
    <Rise className="kpis k2">
      <KpiCard label={t('kpi.backlog')} value={formatTyd(backlog.value, locale)} delta={backlog.delta} deltaSuffix={t('common.previousMonth')} tone="neutral" icon={IconMoney} />
      <KpiCard label={t('metric.overdue')} value={formatTyd(overdue.value, locale)} delta={overdue.delta} deltaSuffix={t('common.previousMonth')}
        tone={overdue.value > 0 ? 'danger' : 'neutral'} invertDelta icon={IconAlert} />
    </Rise>
  </CardBody>
  ```
  với `overdue = await getOverdueScorecard(month, filters)` và `backlog` theo nhánh bên dưới. Xoá dynamic import `BacklogOverdueLine` và import không còn dùng (`historyMonths`, `repo`, `getScopedProjectIds` nếu thừa).
  Vị trí card trong `overview/page.tsx` giữ nguyên (cột phải của `.g21` dòng 111-118, chỉ hiện khi `canViewFinance`).
- `charts.tsx`: xoá hàm `BacklogOverdueLine` (dòng 227-253) và import recharts nào thành thừa.
- `data-dictionary.ts:143`: thay mục "Sparkline" bằng `{ fieldVi: 'Scorecard Backlog & Công nợ quá hạn', fieldEn: 'Backlog & Overdue scorecards', meaningVi: 'Hai số của tháng đang xem + mũi tên so tháng trước (công nợ tăng là xấu).', meaningEn: 'Two figures for the selected month + arrow vs previous month (rising overdue is bad).' }`.

**Nhánh (a) — Backlog = giá trị HĐ dự án "Chuẩn bị":**
- 8A-1 `backlog = { value: kpis.backlog, delta: kpis.delta.backlog }` với `kpis = await loadPortfolioKpis(month, filters)` (giữ cache như cũ).
- 8A-2 `queries.ts:185`: thay dòng TODO bằng `// Backlog = Σ giá trị HĐ dự án trạng thái Chuẩn bị (chủ dự án chốt <yyyy-mm-dd>, P1B/T12a).` — không đổi công thức.
- 8A-3 `data-dictionary.ts:119` giữ nguyên.
- 8A-4 (chỉ khi Q1-phụ = CÓ) `src/server/report.ts`: `backlog` từng dòng = `s.status === 'Chuan_bi' ? s.contractValue : 0` với `s` lấy từ `new Map((await getProjectSummaries(month)).map((x) => [x.id, x]))`; comment dòng 13 sửa thành "Giá trị HĐ nếu dự án Chuẩn bị, còn lại 0".
  Sửa `report-export-route.test.ts:107-127`: dự án mới tạo (chưa khởi công → Chuẩn bị) kỳ vọng `backlog: 500`; thêm 1 ca dự án đang triển khai → `backlog: 0`.

**Nhánh (b) — Backlog = cột `fact_financial.backlog`:**
- 8B-1 `queries.ts` `kpisForMonth`: `const financial = await repo.getFinancialForMonth(yearMonth); const ids = new Set(summaries.map((s) => s.id));`
  `backlog: financial.filter((f) => ids.has(f.projectId)).reduce((sum, f) => sum + f.backlog, 0)`; xoá TODO. Delta ở `getPortfolioKpis` giữ nguyên cách tính.
  Hệ quả tự động: thẻ KPI Tổng quan, /report, Excel export cùng dùng (b); `report.ts` không đổi.
- 8B-2 `backlog = { value: kpis.backlog, delta: kpis.delta.backlog }` như 8A-1.
- 8B-3 `queries.test.ts`: oracle `aggregate()` (dòng 23-32) đổi `backlog` sang Σ `repo.getFinancialForMonth(month).backlog` của các dự án trong `summaries` (thêm tham số `month`, import mock-repo `repo`); các chỗ gọi `aggregate` truyền tháng tương ứng.
- 8B-4 `data-dictionary.ts:119` meaning → vi `'Tổng cột backlog trong bảng tài chính tháng (fact_financial) của các dự án trong phạm vi lọc.'`, en `'Sum of the monthly financial backlog column (fact_financial) for projects in scope.'`.

- [ ] Bước 1: test hỏng (`overdue-scorecard.test.ts` + test theo nhánh) → Bước 2 FAIL → Bước 3 cài → Bước 4 PASS + tsc + `npm test`
- [ ] **Bước 5: Commit** `feat(p1b): Backlog va Cong no qua han thanh 2 scorecard, chot 1 dinh nghia backlog (T12a)`

**Biên:** `month=all` → cả 2 delta hiển thị "-" (delta null/0); tháng chưa có dữ liệu tài chính → giá trị 0, không mũi tên; user không có `canViewFinance` → card vẫn ẩn như cũ.

---

## Cổng kiểm cuối phase (trước khi chuyển tester)
- `npx tsc --noEmit` sạch; `npm test` pass toàn bộ, tổng số test ≥ 712 + số test mới.
- Chạy dev cổng 3001 (`launch.json`: `ddc-control-tower-B`), kiểm tay: `/vi/projects/1` (bấm 2 thẻ → nhảy đúng card, không bị topbar che; cột trọng số có %),
  `/vi/overview` (Team KD/Cơ cấu rộng bằng nhau; Dự án cần lưu ý cuộn sau 5 dòng), `/vi/audit?page=2`, `/vi/audit?range=all`, `/vi/admin`;
  bàn phím: Tab tới ProjectSwitcher gõ "a" → ↓ ↓ Enter chuyển dự án; Esc đóng; nút ⚙ → ↓ mở menu, ↑/↓ di chuyển, Esc trả focus về ⚙; Tab tới nút "?" → Esc ẩn bong bóng.
- `git diff main --stat` KHÔNG có `prisma/`, `app/globals.css`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `PROGRESS.md`, `.serena/`.
