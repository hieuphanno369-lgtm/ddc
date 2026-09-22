# Kế hoạch: 4 trang nghiệp vụ mới (thay mục "Hệ thống" trong sidebar)

Skill đã dùng: `writing-plans`.

## QUYẾT ĐỊNH ĐÃ CHỐT (user 20/09/2026 — "làm luôn")

1. **BOD ĐÓNG ĐƯỢC alert** — chọn phương án (a): sửa `closeAlertAction` thêm nhánh cho `bod`. Admin+bod đóng được mọi alert; data-entry chỉ alert dự án mình là PIC. (BOD = Trưởng phòng, spec giao xử lý alert cho Trưởng phòng.)
2. **"Chưa nộp số liệu"** = chỉ dự án `Dang_trien_khai` VÀ `!getLatestFact(p.id, currentMonth)` (khớp `getMissingMonth`). Bỏ "fact chưa cập nhật" (chưa có ngưỡng rõ).

3. **Quy ước mặc định (không cần hỏi, áp luôn):**
   - Cột "Mã DA" trong bảng report = `currentAliasCode` (khớp `ProjectTable.tsx`).
   - Backlog trong bảng report = `FactFinancial.backlog` của tháng hiện tại (có thể = 0 với nhiều dự án — đúng dữ liệu). LƯU Ý: KPI "Backlog" dùng `kpis.backlog` (tổng contractValue dự án `Chuan_bi`) — hai số khác nhau, đã có TODO ở queries.ts:177, KHÔNG sửa.
   - "Ngày cập nhật gần nhất" ở `/compliance` = `repo.getLatestFact(p.id, 'all')?.changedAt` (fact của tháng gần nhất có data).

## Ràng buộc & quy ước (copy pattern từ các file này)

- **Role guard page (server component)**: copy `app/[locale]/(app)/admin/page.tsx:14-19` và `app/[locale]/(app)/data-dictionary/page.tsx:7-13`. Pattern:
  ```tsx
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (!['admin', 'bod'].includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
  ```
  (`/audit` chỉ cho `admin`: `if (user.role !== 'admin')`).
- **Card/table**: `src/components/ui/Card.tsx` (Card/CardHeader/CardBody), bảng dùng class `table-zebra` + `min-w-[980px]` như `src/components/dashboard/ProjectTable.tsx:57-58`.
- **Badge tone**: `src/components/ui/Badge.tsx` + `src/components/ui/Badges.tsx` (PriorityBadge/StatusBadge/PenaltyBadge). Dot: `Dot` trong Badge.tsx.
- **Format**: `formatPct`, `formatTyd`, `formatDate`, `formatDateTime`, `formatRatio` trong `src/lib/format.ts` (luôn truyền `locale`).
- **Close alert UX (client)**: copy `AlertTab` trong `src/components/form/DataEntryForm.tsx:712-752` (busy state + `router.refresh()`).
- **Excel export**: copy pattern ExcelJS trong `app/api/export/route.ts` (header fill `FF0A1F3D`, font trắng đậm, `wb.xlsx.writeBuffer()`).
- **i18n**: `src/i18n/messages/vi.json` + `en.json` (mọi key mới phải có đủ vi+en).
- **Route page**: đặt tại `app/[locale]/(app)/<route>/page.tsx` (xem `data-dictionary/page.tsx`). Không cần đăng ký route trong i18n routing (routing.ts dùng localePrefix mặc định, không có pathnames map).
- **KHÔNG** sửa middleware (trang tự guard), KHÔNG đổi UI brand (sidebar `bg-[#B91C1C]`, nút `bg-accent`, giữ class hiện có).

---

## Tổng quan file

**Tạo mới:**
- `src/server/report.ts`
- `src/components/alerts/AlertList.tsx`
- `app/[locale]/(app)/report/page.tsx`
- `app/[locale]/(app)/alerts/page.tsx`
- `app/[locale]/(app)/compliance/page.tsx`
- `app/[locale]/(app)/audit/page.tsx`
- `app/api/report/export/route.ts`

**Sửa:**
- `src/components/icons/index.tsx` (thêm 4 icon)
- `src/components/layout/AppShell.tsx` (sidebar)
- `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`

---

## 1. `src/components/icons/index.tsx` (SỬA — thêm 4 icon cuối file, trước comment `// ---- Action ----` không bắt buộc, chỉ cần đúng style IconBase)

Style thống nhất: 24×24 viewBox, `fill="none" stroke="currentColor" strokeWidth={1.7}` round cap/join, bọc trong `<IconBase {...p}>`. Thêm:

```tsx
export const IconReport = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 15v-2M12 15V9M17 15v-4" />
  </IconBase>
);

export const IconBell = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </IconBase>
);

export const IconChecklist = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m8 11 2 2 4-4" />
    <path d="M8 16h8" />
  </IconBase>
);

export const IconHistory = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3.5 2" />
  </IconBase>
);
```

## 2. `src/components/layout/AppShell.tsx` (SỬA — thay section "Hệ thống")

- Dòng import (13-24): thêm `IconBell, IconChecklist, IconHistory, IconReport`.
- Xóa hẳn `SYSTEM_NAV` (dòng 39-44), thay bằng:

```tsx
const OPERATIONS_NAV: NavItem[] = [
  { href: '/report', labelKey: 'nav.report', icon: IconReport, roles: ['admin', 'bod'] },
  { href: '/alerts', labelKey: 'nav.alerts', icon: IconBell, roles: ['admin', 'bod'] },
  { href: '/compliance', labelKey: 'nav.compliance', icon: IconChecklist, roles: ['admin', 'bod'] },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/audit', labelKey: 'nav.audit', icon: IconHistory, roles: ['admin'] },
  { href: '/import', labelKey: 'nav.import', icon: IconUpload, roles: ['admin'] },
  { href: '/data-dictionary', labelKey: 'nav.dataDictionary', icon: IconBook, roles: ['admin'] },
  { href: '/data-schema', labelKey: 'nav.dataSchema', icon: IconSchema, roles: ['admin'] },
  { href: '/admin', labelKey: 'nav.admin', icon: IconAdmin, roles: ['admin'] },
];
```

- Trong component: đổi
  ```tsx
  const systemItems = SYSTEM_NAV.filter((n) => n.roles.includes(user.role));
  const allNav = [...NAV, ...SYSTEM_NAV];
  ```
  thành
  ```tsx
  const operationsItems = OPERATIONS_NAV.filter((n) => n.roles.includes(user.role));
  const adminItems = ADMIN_NAV.filter((n) => n.roles.includes(user.role));
  const allNav = [...NAV, ...OPERATIONS_NAV, ...ADMIN_NAV];
  ```
- Khối render section (dòng 111-118): bỏ `nav.system`, thay bằng 2 section lặp lại đúng cấu trúc cũ (mỗi section render nếu mảng không rỗng), tiêu đề `t('nav.operations')` và `t('nav.administration')`, bên trong `.map(renderNavItem)`.

## 3. `src/server/report.ts` (TẠO MỚI — data nguồn chung cho trang report + export)

```ts
import { loadPortfolioKpis, loadWatchlist } from '@/server/cache';
import { repo, currentMonth } from '@/server/repo';
import type { PortfolioKpis, ProjectSummary } from '@/server/queries';

export interface ReportRow {
  id: number;
  code: string;      // currentAliasCode
  name: string;      // projectName
  spi: number | null;
  cpi: number | null;
  pctActual: number;
  backlog: number;   // FactFinancial.backlog tháng hiện tại
}

export interface ReportData {
  kpis: PortfolioKpis;
  p0Red: ProjectSummary[];
  rows: ReportRow[];
}

export async function getReportData(month: string = currentMonth): Promise<ReportData> {
  const kpis = await loadPortfolioKpis(month, {});
  const watchlist = await loadWatchlist(month, {});
  const p0Red = watchlist.filter(
    (w) => w.priority === 'P0' && (w.penalty === 'risk' || w.penalty === 'penalized'),
  );
  const projects = await repo.listProjects();
  const financial = await repo.getFinancialForMonth(month);
  const rows = await Promise.all(
    projects.map(async (p) => {
      const fact = await repo.getLatestFact(p.id, month);
      const fin = financial.find((f) => f.projectId === p.id);
      return {
        id: p.id,
        code: p.currentAliasCode,
        name: p.projectName,
        spi: fact?.spi != null ? Math.round(fact.spi * 100) / 100 : null,
        cpi: fact?.cpi != null ? Math.round(fact.cpi * 100) / 100 : null,
        pctActual: fact?.pctActual ?? 0,
        backlog: fin?.backlog ?? 0,
      };
    }),
  );
  return { kpis, p0Red, rows };
}
```

## 4. `app/[locale]/(app)/report/page.tsx` (TẠO MỚI — route `/report`, role admin+bod)

- Guard: admin+bod (pattern mục "Ràng buộc").
- Data source: `getReportData()` + `currentMonth` (đã bao gồm `loadPortfolioKpis`, `loadWatchlist`, `repo.listProjects()`, `repo.getLatestFact`, `repo.getFinancialForMonth`).
- Bố cục:
  1. Header row: `<h1>{t('report.title')}</h1>` + nút Xuất Excel:
     ```tsx
     <a href="/api/report/export" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
       <IconExport size={16} /> {t('common.export')}
     </a>
     ```
  2. KPI grid (6 card, copy mapping từ `OverviewWidgets.tsx:55-64`, `canViewFinance=true`):
     - `KpiCard label={t('kpi.totalProjects')} value={String(kpis.totalProjects)} delta={kpis.delta.totalProjects} deltaSuffix={prevLabel} icon={IconProject}`
     - `inProgress` tone="ok" icon=IconFactory; `behindSchedule` tone="warn" invertDelta hero icon=IconTrend; `penaltyRisk` tone="warn" invertDelta icon=IconFlag; `penalized` tone="danger" invertDelta icon=IconAlert; `backlog` value=`formatTyd(kpis.backlog, locale)` tone="neutral" icon=IconMoney.
     - `prevLabel = t('common.previousMonth')`. Import `KpiCard` từ `@/components/dashboard/KpiCard`.
  3. Card P0-Red: `CardHeader title={t('report.p0Red')}`; body: nếu `p0Red.length === 0` hiện `<p>{t('common.noData')}</p>`, ngược lại `<ul>` liệt kê `w.projectName` + `PriorityBadge priority={w.priority}` + `PenaltyBadge penalty={w.penalty}`.
  4. Card bảng dự án: `CardHeader title={t('report.projectTable')}`; bảng cột `Mã DA | Tên dự án | SPI | CPI | % TT | Backlog`:
     - code: `<td className="font-mono text-xs text-slate-500">{r.code}</td>`
     - name: `<Link href={`/projects/${r.id}`} className="font-medium text-navy-900 hover:text-accent">{r.name}</Link>` (`import { Link } from '@/i18n/navigation';`)
     - spi/cpi: `formatRatio(r.spi)` / `formatRatio(r.cpi)` (tô `text-amber-600` khi `< 0.9` như ProjectTable).
     - `% TT`: `formatPct(r.pctActual, locale)`.
     - backlog: `formatTyd(r.backlog, locale)`.
     - hàng rỗng: `t('common.noData')`.

## 5. `app/[locale]/(app)/alerts/page.tsx` (TẠO MỚI — route `/alerts`, role admin+bod)

- Guard: admin+bod.
- Data source: `repo.getAlerts()` (AlertLog), `repo.listProjects()`.
- Nối tên dự án rồi lọc đang mở:
  ```tsx
  const projects = await repo.listProjects();
  const nameById = new Map(projects.map((p) => [p.id, p.projectName]));
  const open = (await repo.getAlerts())
    .filter((a) => !a.closedAt)
    .map((a) => ({ ...a, projectName: nameById.get(a.projectId) ?? '-' }));
  ```
- Render: `<h1>{t('alert.title')}</h1>` + `<AlertList alerts={open} canClose={user.role === 'admin'} />` (xem câu hỏi 1 — nếu chốt (a) thì bỏ `canClose` hoặc truyền `true`).

## 6. `src/components/alerts/AlertList.tsx` (TẠO MỚI — client, nút "Đóng")

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { closeAlertAction } from '@/server/actions';
import type { AlertLog } from '@/server/repo/types';
import { formatDate } from '@/lib/format';
import { Badge, Dot } from '@/components/ui/Badge';

type Row = AlertLog & { projectName: string };

export function AlertList({ alerts, canClose }: { alerts: Row[]; canClose: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function close(id: number) {
    setBusy(id);
    try {
      await closeAlertAction(id, 'Đã xử lý');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }
  // bảng: Dự án | Loại | Quy tắc | Nội dung | Người phụ trách | Hạn xử lý | (Đóng)
}
```
- Cột "Loại": `Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>{t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}</Badge>`.
- Deadline: `formatDate(a.deadline, locale)`.
- Nút "Đóng" (chỉ render khi `canClose`): `onClick={() => close(a.id)} disabled={busy === a.id}`, label `t('alert.closeAlert')`.
- Rỗng: `<p className="py-4 text-center text-sm text-slate-400">{t('overview.noAlerts')}</p>`.

## 7. `app/[locale]/(app)/compliance/page.tsx` (TẠO MỚI — route `/compliance`, role admin+bod)

- Guard: admin+bod.
- Data source: `repo.listProjects()`, `repo.getLatestFact(p.id, currentMonth)`, `repo.getLatestFact(p.id, 'all')`, `repo.getAssignments()` (tìm PIC), `repo.getUserRoles()` (email→tên). Import `deriveStatus` từ `@/lib/evm`.
- Logic tạo hàng (mặc định theo câu hỏi 2):
  ```tsx
  const projects = await repo.listProjects();
  const assignments = await repo.getAssignments();
  const users = await repo.getUserRoles();
  const month = currentMonth;
  const rows = (
    await Promise.all(
      projects.map(async (p) => {
        const fact = await repo.getLatestFact(p.id, month);
        const status = deriveStatus({
          actualStartDate: p.actualStartDate,
          actualFinishDate: p.actualFinishDate,
          pctActual: fact?.pctActual ?? 0,
        });
        if (status !== 'Dang_trien_khai' || fact) return null; // bỏ qua đã nộp + không đang triển khai
        const pic = assignments.find((a) => a.projectId === p.id && a.roleInProject === 'PIC');
        const latest = await repo.getLatestFact(p.id, 'all');
        return {
          id: p.id,
          name: p.projectName,
          code: p.currentAliasCode,
          pm: pic ? (users.find((u) => u.email === pic.userEmail)?.name ?? pic.userEmail) : '-',
          status,
          lastUpdate: latest?.changedAt ?? null,
        };
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x != null);
  ```
- Bảng cột: `Dự án | Mã DA | PM (PIC) | Trạng thái | Cập nhật gần nhất`.
  - Tên dự án: `<Link href={`/projects/${r.id}`}>`; status: `<StatusBadge status={r.status} />`; lastUpdate: `formatDateTime(r.lastUpdate, locale)` (null → `-`).
- Rỗng: `t('compliance.empty')`.

## 8. `app/[locale]/(app)/audit/page.tsx` (TẠO MỚI — route `/audit`, role admin)

- Guard: admin (`if (user.role !== 'admin')`).
- Data source: `repo.getAuditLog()` (AuditLogEntry).
- Bảng cột: `Thời gian | User | Bảng | Record | Field | Cũ → Mới`:
  - `formatDateTime(a.changedAt, locale)`, `a.changedBy`, `a.tableName`, `a.recordId` (font-mono), `a.field`, `oldValue` → `newValue` (nếu oldValue rỗng hiện `-`; hiển thị `a.oldValue` + ` → ` + `a.newValue`, cell dùng `max-w-[300px] break-all`).
- Rỗng: `t('common.noData')` (seed hiện có `auditLog: []` → bắt buộc có empty state).

## 9. `app/api/report/export/route.ts` (TẠO MỚI — Xuất Excel, role admin+bod)

```ts
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getCurrentUser } from '@/lib/session';
import { getReportData } from '@/server/report';
import { currentMonth } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'bod'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { kpis, p0Red, rows } = await getReportData(currentMonth);

  const wb = new ExcelJS.Workbook();

  const kpiWs = wb.addWorksheet('KPI');
  kpiWs.columns = [
    { header: 'Chỉ số', key: 'label', width: 24 },
    { header: 'Giá trị', key: 'value', width: 16 },
  ];
  kpiWs.addRows([
    { label: 'Tổng số dự án', value: kpis.totalProjects },
    { label: 'Đang triển khai', value: kpis.inProgress },
    { label: 'Trễ tiến độ', value: kpis.behindSchedule },
    { label: 'Nguy cơ phạt', value: kpis.penaltyRisk },
    { label: 'Đã phạt', value: kpis.penalized },
    { label: 'Backlog (tỷ)', value: kpis.backlog },
  ]);

  const p0Ws = wb.addWorksheet('P0-Red');
  p0Ws.columns = [
    { header: 'Mã DA', key: 'code', width: 18 },
    { header: 'Tên dự án', key: 'name', width: 34 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Rủi ro', key: 'penalty', width: 20 },
  ];
  p0Red.forEach((w) => p0Ws.addRow({ code: w.currentAliasCode, name: w.projectName, priority: w.priority, penalty: w.penalty }));

  const ws = wb.addWorksheet('DanhSachDuAn');
  ws.columns = [
    { header: 'Mã DA', key: 'code', width: 18 },
    { header: 'Tên dự án', key: 'name', width: 34 },
    { header: 'SPI', key: 'spi', width: 10 },
    { header: 'CPI', key: 'cpi', width: 10 },
    { header: '% TT', key: 'pctActual', width: 10 },
    { header: 'Backlog (tỷ)', key: 'backlog', width: 14 },
  ];
  rows.forEach((r) => ws.addRow({ code: r.code, name: r.name, spi: r.spi ?? '', cpi: r.cpi ?? '', pctActual: r.pctActual, backlog: r.backlog }));

  for (const sheet of [kpiWs, p0Ws, ws]) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1F3D' } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="bao-cao-ban-dieu-hanh.xlsx"',
    },
  });
}
```

## 10. i18n — `src/i18n/messages/vi.json` + `en.json` (SỬA)

**Thêm vào `nav` (vi / en):**
```
"report": "Báo cáo ban điều hành" / "Executive Report"
"alerts": "Cảnh báo" / "Alerts"
"compliance": "Chưa nộp số liệu" / "Missing Data"
"audit": "Nhật ký thay đổi" / "Audit Log"
"operations": "Vận hành" / "Operations"
"administration": "Quản trị" / "Administration"
```
(Giữ nguyên key `nav.system` trong file — không cần xóa, chỉ không còn dùng.)

**Thêm section mới `report` (vi / en):**
```
"title": "Báo cáo ban điều hành" / "Executive Report"
"p0Red": "Dự án P0 - Red" / "P0 - Red Projects"
"projectTable": "Danh sách dự án" / "Project List"
```

**Thêm section mới `compliance` (vi / en):**
```
"title": "Dự án chưa nộp số liệu" / "Projects Missing Data"
"pm": "PM (PIC)" / "PM (PIC)"
"lastUpdate": "Cập nhật gần nhất" / "Last Update"
"empty": "Tất cả dự án đã nộp số liệu tháng này" / "All projects have submitted this month's data"
```

**Thêm section mới `audit` (vi / en):**
```
"title": "Nhật ký thay đổi" / "Audit Log"
"table": "Bảng" / "Table"
"record": "Record" / "Record"
"field": "Trường" / "Field"
"old": "Cũ" / "Old"
"new": "Mới" / "New"
```

**Thêm vào section `alert` (vi / en):**
```
"title": "Cảnh báo & việc cần làm" / "Alerts & Action Items"
"owner": "Người phụ trách" / "Owner"
```

(Reuse key có sẵn: `common.noData`, `common.export`, `common.project`, `alert.rule`, `alert.message`, `alert.action`, `alert.closeAlert`, `alert.deadline`, `alert.red`, `alert.amber`, `overview.noAlerts`, `kpi.*`, `common.previousMonth`, `admin.time`, `admin.user`.)

---

## Trường hợp biên bắt buộc

- **Role gating**: chưa login → `redirect(/<locale>/login)`; role không đúng → `redirect(/<locale>${homeForRole(role)})`. Áp cho cả 4 trang. Export route trả 403 nếu chưa login/sai role.
- **Project không có fact tháng hiện tại**: `getLatestFact` trả `undefined` → report: `pctActual=0`, `spi/cpi=null` (hiển thị `-` qua `formatPct/formatRatio`); compliance: dự án đó xuất hiện trong danh sách.
- **Alert rỗng (không có alert đang mở)**: hiện `overview.noAlerts`, không crash.
- **Audit log rỗng** (seed `auditLog: []`): hiện `common.noData`.
- **Report không có dự án P0-Red**: hiện `common.noData` trong card P0-Red.
- **i18n đủ vi/en**: mọi key mới phải có ở cả 2 file; thiếu key sẽ ném lỗi next-intl lúc build.
- **Format số**: SPI/CPI → `formatRatio`; %TT → `formatPct(value, locale)`; backlog → `formatTyd(value, locale)`; ngày → `formatDate`/`formatDateTime` với `locale`. Null/undefined đều phải ra `-`.
- **`getLatestFact(p.id, 'all')`**: nhánh `yearMonth === 'all'` trong prisma-repo đã hỗ trợ — dùng cho "cập nhật gần nhất" ở compliance.

## Không làm

- Không PDF, không đổi `app/api/export/route.ts` (giữ nguyên route cũ).
- Không sửa middleware, không sửa `src/server/queries.ts`, `cache.ts`, `prisma-repo.ts` (trừ khi chốt câu hỏi 1 → chỉ sửa `closeAlertAction` trong `src/server/actions.ts`).
- Không sửa UI brand đã redesign (class/color hiện có giữ nguyên).

## Verify

- `npm run build` (hoặc `npm run dev` mở `/vi/report`, `/vi/alerts`, `/vi/compliance`, `/vi/audit` với tài khoản admin + bod) — không có lỗi TS/next-intl thiếu key.
