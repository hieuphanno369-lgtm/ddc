import { calcDurationPctComplete, calcEac, calcVac, deriveStatus, isOnTrack, penaltyState, type PenaltyState } from '@/lib/evm';
import { THRESHOLDS } from '@/lib/thresholds';
import { repo } from './repo';
import { currentMonth, historyMonths, isValidYearMonth, prevMonth, today } from '@/lib/clock';
import type { FactSnapshot } from './repo/read-types';
import type {
  Market,
  Priority,
  Project,
  ProjectType,
  Status,
} from './repo/types';

export interface ProjectSummary {
  id: number;
  masterCode: string;
  currentAliasCode: string;
  projectName: string;
  customerId: number;
  customerName: string;
  teamName: string;
  teamKdId: number;
  projectType: ProjectType;
  marketCode: Market;
  priority: Priority;
  status: Status;
  onTrack: boolean;
  penalty: PenaltyState;
  contractValue: number;
  tonnage: number;
  pctPlan: number | null;   // % KH THEO THỜI GIAN (duration); null = thiếu ngày kế hoạch
  pctActual: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
  vac: number | null;
  bottleneckStage: string | null;
}

export type GroupBy = 'team' | 'type' | 'market';

/** Bộ filter scope - áp dụng cho KPI/chart/bảng (status là snapshot theo tháng). */
export interface DashboardFilters {
  status?: Status | 'all';
  teamKdId?: number | 'all';
  customerId?: number | 'all';
  priority?: Priority | 'all';
  market?: Market | 'all';
  projectType?: ProjectType | 'all';
  groupBy?: GroupBy;
  groupKey?: string;
}

type Dims = Awaited<ReturnType<typeof repo.getDims>>;

/** Đồng bộ - `dims` lấy 1 lần ở tầng gọi, không tự query nữa (T1: tránh N+1 theo số dự án). */
function summarize(project: Project, fact: FactSnapshot | undefined, dims: Dims): ProjectSummary {
  const customer = dims.customers.find((c) => c.id === project.customerId);
  const team = dims.teams.find((t) => t.id === project.teamKdId);
  const status = deriveStatus({
    actualStartDate: project.actualStartDate,
    actualFinishDate: project.actualFinishDate,
    pctActual: fact?.pctActual ?? 0,
  });
  const penalty = penaltyState({
    committedHandoverDate: project.committedHandoverDate,
    pctActual: fact?.pctActual ?? 0,
    penalized: project.penalized,
    today: today(),
  });
  const bac = fact?.bac ?? project.contractValue;
  // % Kế hoạch = thời gian đã trôi. KHÔNG dùng fact.pctPlan nữa - đó chỉ còn là số nhập tay (audit).
  const pctPlan = calcDurationPctComplete(project.plannedStartDate, project.plannedFinishDate, today());
  const eac = calcEac(bac, fact?.cpi ?? null);
  return {
    id: project.id,
    masterCode: project.masterCode,
    currentAliasCode: project.currentAliasCode,
    projectName: project.projectName,
    customerId: project.customerId,
    customerName: customer?.name ?? '-',
    teamName: team?.name ?? '-',
    teamKdId: project.teamKdId,
    projectType: project.projectType,
    marketCode: project.marketCode,
    priority: project.priority,
    status,
    onTrack: status === 'Dang_trien_khai' && isOnTrack(fact?.pctActual ?? 0, pctPlan ?? 0),
    penalty,
    contractValue: project.contractValue,
    tonnage: project.tonnage,
    pctPlan,
    pctActual: fact?.pctActual ?? 0,
    spi: round2(fact?.spi ?? null),
    cpi: round2(fact?.cpi ?? null),
    eac: round2(eac),
    vac: round2(calcVac(bac, eac)),
    bottleneckStage: fact?.bottleneckStage ?? null,
  };
}

/** Làm tròn 2 chữ số, giữ null. Chỉ để hiển thị - KHÔNG dùng để tính tiếp. */
function round2(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100;
}

function matchesGroup(p: Pick<Project, 'teamKdId' | 'projectType' | 'marketCode'>, groupKey: string, groupBy: GroupBy, dims: Dims): boolean {
  if (groupBy === 'team') return (dims.teams.find((t) => t.id === p.teamKdId)?.name ?? '-') === groupKey;
  if (groupBy === 'type') return p.projectType === groupKey;
  return p.marketCode === groupKey;
}

function filterSummaries(summaries: ProjectSummary[], filters: DashboardFilters, dims: Dims): ProjectSummary[] {
  let rows = summaries;
  if (filters.status && filters.status !== 'all') rows = rows.filter((r) => r.status === filters.status);
  if (filters.teamKdId && filters.teamKdId !== 'all') rows = rows.filter((r) => r.teamKdId === filters.teamKdId);
  if (filters.customerId && filters.customerId !== 'all') rows = rows.filter((r) => r.customerId === filters.customerId);
  if (filters.priority && filters.priority !== 'all') rows = rows.filter((r) => r.priority === filters.priority);
  if (filters.market && filters.market !== 'all') rows = rows.filter((r) => r.marketCode === filters.market);
  if (filters.projectType && filters.projectType !== 'all') rows = rows.filter((r) => r.projectType === filters.projectType);
  if (filters.groupKey && filters.groupBy) {
    rows = rows.filter((r) => matchesGroup(r, filters.groupKey!, filters.groupBy!, dims));
  }
  return rows;
}

/** Project ids theo filter cấp dự án (KHÔNG theo status - dùng cho trend nhiều tháng). */
export async function getScopedProjectIds(filters: DashboardFilters): Promise<Set<number>> {
  let projects = await repo.listProjects();
  if (filters.teamKdId && filters.teamKdId !== 'all') projects = projects.filter((p) => p.teamKdId === filters.teamKdId);
  if (filters.customerId && filters.customerId !== 'all') projects = projects.filter((p) => p.customerId === filters.customerId);
  if (filters.priority && filters.priority !== 'all') projects = projects.filter((p) => p.priority === filters.priority);
  if (filters.market && filters.market !== 'all') projects = projects.filter((p) => p.marketCode === filters.market);
  if (filters.projectType && filters.projectType !== 'all') projects = projects.filter((p) => p.projectType === filters.projectType);
  if (filters.groupKey && filters.groupBy) {
    const dims = await repo.getDims();
    projects = projects.filter((p) => matchesGroup(p, filters.groupKey!, filters.groupBy!, dims));
  }
  return new Set(projects.map((p) => p.id));
}

export async function getProjectSummaries(yearMonth: string, filters?: DashboardFilters): Promise<ProjectSummary[]> {
  const [projects, dims, facts] = await Promise.all([
    repo.listProjects(),
    repo.getDims(),
    repo.readFactSnapshots(yearMonth),
  ]);
  const byId = new Map(facts.map((f) => [f.projectId, f]));
  const summaries = projects.map((p) => summarize(p, byId.get(p.id), dims));
  return filters ? filterSummaries(summaries, filters, dims) : summaries;
}

export async function getProjectSummary(projectId: number, yearMonth: string): Promise<ProjectSummary | undefined> {
  // TODO: BOLA - không check quyền đọc project. Viewer/data-entry đọc được detail dự án ngoài scope.
  const p = await repo.getProject(projectId);
  if (!p) return undefined;
  return summarize(p, await repo.getLatestFact(projectId, yearMonth), await repo.getDims());
}

// ---- Portfolio KPI ----
export interface PortfolioKpis {
  totalProjects: number;
  inProgress: number;
  behindSchedule: number;
  penaltyRisk: number;
  penalized: number;
  backlog: number;
  delta: {
    totalProjects: number;
    inProgress: number;
    behindSchedule: number;
    penaltyRisk: number;
    penalized: number;
    backlog: number;
  };
}

async function kpisForMonth(yearMonth: string, filters: DashboardFilters) {
  const summaries = await getProjectSummaries(yearMonth, filters);
  return {
    totalProjects: summaries.length,
    inProgress: summaries.filter((s) => s.status === 'Dang_trien_khai').length,
    behindSchedule: summaries.filter((s) => s.status === 'Dang_trien_khai' && !s.onTrack).length,
    penaltyRisk: summaries.filter((s) => s.penalty === 'risk').length,
    penalized: summaries.filter((s) => s.penalty === 'penalized').length,
    // Backlog = Σ giá trị HĐ dự án trạng thái Chuẩn bị (chủ dự án chốt 2026-09-24, P1B/T12a).
    backlog: summaries
      .filter((s) => s.status === 'Chuan_bi')
      .reduce((sum, s) => sum + s.contractValue, 0),
  };
}

const ZERO_DELTA: PortfolioKpis['delta'] = {
  totalProjects: 0,
  inProgress: 0,
  behindSchedule: 0,
  penaltyRisk: 0,
  penalized: 0,
  backlog: 0,
};

export async function getPortfolioKpis(yearMonth: string, filters: DashboardFilters = {}): Promise<PortfolioKpis> {
  const cur = await kpisForMonth(yearMonth, filters);
  // 'all' không có tháng liền trước hợp lệ (prevMonth('all') ra chuỗi rác), và `month` rác/không
  // đúng format 'YYYY-MM' cũng không có gì để so sánh - giữ đúng hành vi cũ trước Run 1: delta = 0.
  if (yearMonth === 'all' || !isValidYearMonth(yearMonth)) {
    return { ...cur, delta: ZERO_DELTA };
  }
  const prevYm = prevMonth(yearMonth);
  // Tháng đang xem HOẶC tháng liền trước CHƯA CÓ dòng fact nào (vd chưa ai nhập số cho tháng mới,
  // hoặc tháng liền trước nằm trước cửa sổ dữ liệu) khác hẳn "tháng đó có %TT = 0 thật" - không có
  // dữ liệu để so sánh thì không được bịa ra một cú tăng/tụt KPI giả. Trả delta = 0 thay vì chạy
  // tiếp với pctActual mặc định 0 cho mọi dự án ở bên thiếu dữ liệu.
  const [curFacts, prevFacts] = await Promise.all([
    repo.readFactSnapshots(yearMonth),
    repo.readFactSnapshots(prevYm),
  ]);
  if (curFacts.length === 0 || prevFacts.length === 0) {
    return { ...cur, delta: ZERO_DELTA };
  }
  const prev = await kpisForMonth(prevYm, filters);
  return {
    ...cur,
    delta: {
      totalProjects: cur.totalProjects - prev.totalProjects,
      inProgress: cur.inProgress - prev.inProgress,
      behindSchedule: cur.behindSchedule - prev.behindSchedule,
      penaltyRisk: cur.penaltyRisk - prev.penaltyRisk,
      penalized: cur.penalized - prev.penalized,
      backlog: Math.round((cur.backlog - prev.backlog) * 10) / 10,
    },
  };
}

// ---- Donut ----
export async function getStatusBreakdown(yearMonth: string, filters: DashboardFilters = {}) {
  const summaries = await getProjectSummaries(yearMonth, filters);
  const counts: Record<Status, number> = {
    Chuan_bi: 0,
    Dang_trien_khai: 0,
    Hoan_thanh: 0,
    Tam_dung: 0,
  };
  for (const s of summaries) counts[s.status]++;
  return (Object.keys(counts) as Status[])
    .map((status) => ({ status, value: counts[status] }))
    .filter((x) => x.value > 0);
}

// ---- Bar: Lượng & Trị ----
export async function getTonnageValueByGroup(yearMonth: string, groupBy: GroupBy, filters: DashboardFilters = {}) {
  const summaries = await getProjectSummaries(yearMonth, filters);
  const volumes = await repo.readVolumeSnapshots(yearMonth);
  const financial = await repo.readFinancialSnapshots(yearMonth);

  const tonnageByProject = new Map<number, number>();
  for (const v of volumes) tonnageByProject.set(v.projectId, (tonnageByProject.get(v.projectId) ?? 0) + v.tonnageProcessed);
  const revenueByProject = new Map<number, number>();
  for (const f of financial) revenueByProject.set(f.projectId, (revenueByProject.get(f.projectId) ?? 0) + f.revenuePeriod);

  const groups = new Map<string, { tonnage: number; value: number }>();
  for (const s of summaries) {
    const key = groupBy === 'team' ? s.teamName : groupBy === 'type' ? s.projectType : s.marketCode;
    const g = groups.get(key) ?? { tonnage: 0, value: 0 };
    g.tonnage += tonnageByProject.get(s.id) ?? 0;
    g.value += revenueByProject.get(s.id) ?? 0;
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, v]) => ({
    key,
    tonnage: Math.round(v.tonnage),
    value: Math.round(v.value * 10) / 10,
  }));
}

// ---- Bar: Sản lượng vs công suất ----
export async function getCapacityData(yearMonth: string, filters: DashboardFilters = {}) {
  const dims = await repo.getDims();
  const ids = new Set((await getProjectSummaries(yearMonth, filters)).map((s) => s.id));
  const volumes = await repo.readVolumeSnapshots(yearMonth);
  return dims.factories.map((factory) => {
    const processed = volumes
      .filter((v) => v.factoryId === factory.id && ids.has(v.projectId))
      .reduce((a, b) => a + b.tonnageProcessed, 0);
    const capacityMonth = factory.capacityTonPerYear / 12;
    return {
      name: factory.name,
      region: factory.region,
      processed,
      capacity: Math.round(capacityMonth),
      warn: processed > THRESHOLDS.capacityWarnPct * capacityMonth,
    };
  });
}

// ---- Line: SPI/CPI trend ----
export async function getSpiCpiTrend(filters: DashboardFilters = {}) {
  const ids = await getScopedProjectIds(filters);
  const months = historyMonths();
  const rows = await repo.readMonthlyEvm(months, [...ids]);
  const byMonth = new Map(rows.map((r) => [r.yearMonth, r]));
  return months.map((m) => {
    const r = byMonth.get(m);
    return {
      month: m,
      spi: r?.spiAvg != null ? Math.round(r.spiAvg * 100) / 100 : null,
      cpi: r?.cpiAvg != null ? Math.round(r.cpiAvg * 100) / 100 : null,
    };
  });
}

// ---- S-curve ----
export async function getPortfolioSCurve(filters: DashboardFilters = {}) {
  const ids = await getScopedProjectIds(filters);
  const months = historyMonths();
  const rows = await repo.readMonthlyEvm(months, [...ids]);
  const byMonth = new Map(rows.map((r) => [r.yearMonth, r]));
  return months.map((m) => {
    const r = byMonth.get(m);
    return {
      month: m,
      pv: Math.round(r?.pv ?? 0),
      ev: Math.round(r?.ev ?? 0),
      ac: Math.round(r?.ac ?? 0),
    };
  });
}

// ---- Watchlist ----
export async function getWatchlist(yearMonth: string, filters: DashboardFilters = {}) {
  return (await getProjectSummaries(yearMonth, filters))
    .filter((s) => {
      if (s.status !== 'Dang_trien_khai') return false;
      const spiLow = s.spi != null && s.spi < THRESHOLDS.spiWarn;
      const cpiLow = s.cpi != null && s.cpi < THRESHOLDS.cpiWarn;
      const pen = s.penalty === 'risk' || s.penalty === 'penalized';
      return spiLow || cpiLow || pen;
    })
    .sort((a, b) => (a.spi ?? 99) - (b.spi ?? 99));
}

// ---- Missing month ----
export async function getMissingMonth(yearMonth: string) {
  const [projects, facts] = await Promise.all([repo.listProjects(), repo.readFactSnapshots(yearMonth)]);
  const byId = new Map(facts.map((f) => [f.projectId, f]));
  const rows = projects.map((p) => {
    const fact = byId.get(p.id);
    const status = deriveStatus({
      actualStartDate: p.actualStartDate,
      actualFinishDate: p.actualFinishDate,
      pctActual: fact?.pctActual ?? 0,
    });
    return status === 'Dang_trien_khai' && !fact
      ? { id: p.id, projectName: p.projectName, code: p.currentAliasCode }
      : null;
  });
  return rows.filter((x): x is { id: number; projectName: string; code: string } => x != null);
}

// ---- Bảng danh sách (filter/sort/pagination ở SERVER) ----
export interface ProjectListParams {
  month?: string;
  filters?: DashboardFilters;
  search?: string;
  sort?: 'priority' | 'name' | 'value' | 'spi' | 'pctActual';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function listProjects(params: ProjectListParams) {
  const { month = currentMonth(), filters = {}, page = 1, pageSize = 10 } = params;
  let rows = await getProjectSummaries(month, filters);

  if (params.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.projectName.toLowerCase().includes(q) ||
        r.currentAliasCode.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q),
    );
  }

  const sort = params.sort ?? 'priority';
  const dir = params.dir ?? 'asc';
  const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
  rows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sort === 'priority') cmp = prioRank[a.priority] - prioRank[b.priority];
    else if (sort === 'name') cmp = a.projectName.localeCompare(b.projectName);
    else if (sort === 'value') cmp = a.contractValue - b.contractValue;
    else if (sort === 'spi') cmp = (a.spi ?? 99) - (b.spi ?? 99);
    else if (sort === 'pctActual') cmp = a.pctActual - b.pctActual;
    return dir === 'asc' ? cmp : -cmp;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/** Export Excel: trả về toàn bộ danh sách đã filter (không phân trang). */
export async function exportProjects(params: ProjectListParams) {
  return (await listProjects({ ...params, page: 1, pageSize: 100000 })).items;
}
