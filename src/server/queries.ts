import { cache as reactCache } from 'react';
import { calcDurationPctComplete, calcEac, calcVac, deriveStatus, isOnTrack, penaltyState, type PenaltyState } from '@/lib/evm';
import { THRESHOLDS } from '@/lib/thresholds';
import { repo } from './repo';
import { currentMonth, endOfMonth, isValidYearMonth, todayIso, type IsoDate, type YearMonth } from '@/lib/clock';
import { carrySeries, dataStateOf, pickAsOf, type AsOf, type DataState } from '@/lib/as-of';
import { intersectsPeriod, periodAsOfDate, periodMonths, previousPeriod, type Period } from '@/lib/period';
import type { FactSeriesRow, FactSnapshot } from './repo/read-types';
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
  pctPlan: number | null;   // % KH THEO THỜI GIAN (duration) tại mốc; null = thiếu ngày kế hoạch
  pctActual: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
  vac: number | null;
  bottleneckStage: string | null;
  /** Số tại mốc lấy từ tháng nào: current (đúng tháng mốc), carried (mang số tháng trước), completed, none. */
  dataState: DataState;
}

export type GroupBy = 'team' | 'type' | 'market';

/** Bộ filter scope - áp dụng cho KPI/chart/bảng (status là snapshot tại mốc cuối kỳ). */
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

/** Ngày dạng 'YYYY-MM-DD' (cột ngày của Postgres có thể trả ISO đầy đủ) hoặc null. */
const day10 = (d: string | null): IsoDate | null => (d ? d.slice(0, 10) : null);

/**
 * Đồng bộ - `dims` lấy 1 lần ở tầng gọi, không tự query nữa (T1: tránh N+1 theo số dự án).
 * Mọi số tính TẠI `asOfDate` (không dùng "hôm nay"): %KH, nguy cơ phạt và trạng thái đều theo mốc.
 * Ngày thực tế sau mốc coi như chưa xảy ra.
 */
function summarize(project: Project, asOf: AsOf<FactSnapshot> | null, dims: Dims, asOfDate: IsoDate): ProjectSummary {
  const fact = asOf?.row;
  const customer = dims.customers.find((c) => c.id === project.customerId);
  const team = dims.teams.find((t) => t.id === project.teamKdId);
  const upToAsOf = (d: string | null) => {
    const v = day10(d);
    return v && v <= asOfDate ? v : null;
  };
  const actualFinishDate = upToAsOf(project.actualFinishDate);
  const status = deriveStatus({
    actualStartDate: upToAsOf(project.actualStartDate),
    actualFinishDate,
    pctActual: fact?.pctActual ?? 0,
  });
  const asOfAt = new Date(`${asOfDate}T00:00:00Z`);
  const penalty = penaltyState({
    committedHandoverDate: project.committedHandoverDate,
    pctActual: fact?.pctActual ?? 0,
    penalized: project.penalized,
    today: asOfAt,
  });
  const bac = fact?.bac ?? project.contractValue;
  // % Kế hoạch = thời gian đã trôi tới mốc. KHÔNG dùng fact.pctPlan nữa - đó chỉ còn là số nhập tay (audit).
  const pctPlan = calcDurationPctComplete(project.plannedStartDate, project.plannedFinishDate, asOfAt);
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
    dataState: dataStateOf(asOf, status, actualFinishDate),
  };
}

/** Làm tròn 2 chữ số, giữ null. Chỉ để hiển thị - KHÔNG dùng để tính tiếp. */
function round2(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100;
}

// + 0 để -0 (làm tròn số âm rất nhỏ) thành 0, tránh hiện "-0".
const round1 = (v: number) => Math.round(v * 10) / 10 + 0;

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

/**
 * Dedupe trong 1 request Next.js (T1 Bước 11): trang /overview gọi `getProjectSummaries` 6-8
 * lần/lần render (KpiGrid+BacklogOverdueCard cùng gọi loadPortfolioKpis, AlertBanner+WatchlistCard
 * cùng gọi loadWatchlist, cộng getStatusBreakdown/getTonnageValueByGroup/getCapacityData/
 * listProjects) - mỗi lần lặp lại đủ 3 query + `summarize()` trên toàn bộ dự án (đo trên 10 triệu
 * dòng: ~50-100ms/lần cho summarize() riêng, KHÔNG giảm dù lặp lại - không phải "cache nguội").
 * Từ React 19, `cache` có export thật ở MỌI bản React (kể cả chạy qua `tsx` scripts/perf/* hay
 * Vitest); nhưng ngoài Server Component nó chỉ gọi thẳng hàm gốc, không memo gì (không có request
 * scope để nhớ). `typeof reactCache === 'function'` vẫn giữ để an toàn (không bao giờ ném 'cache is
 * not a function' nếu môi trường nào đó thiếu export này), dù nay luôn true.
 * Memo theo THAM CHIẾU đối số: page phải truyền cùng 1 object `period`/`filters` xuống mọi widget.
 */
function requestMemo<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>): (...args: Args) => Promise<R> {
  return typeof reactCache === 'function' ? reactCache(fn) : fn;
}

/** Mốc của kỳ: ngày mốc = min(cuối kỳ, hôm nay), tháng mốc = 7 ký tự đầu. */
function asOfOf(period: Period): { asOfDate: IsoDate; asOfMonth: YearMonth } {
  const asOfDate = periodAsOfDate(period, todayIso());
  return { asOfDate, asOfMonth: asOfDate.slice(0, 7) };
}

interface PeriodEntry { project: Project; summary: ProjectSummary }

/**
 * Nền chung của mọi hàm theo kỳ: MỌI dự án đang hoạt động, tính số tồn tại mốc (dòng isLatest có
 * yearMonth lớn nhất <= tháng mốc, mang số tháng trước sang). Việc lọc "thuộc kỳ" và filter làm ở trên.
 * `factRows` = số dự án có ít nhất 1 dòng fact <= mốc (0 → chưa có gì để so sánh, delta = null).
 */
async function getPeriodBaseUncached(period: Period) {
  const { asOfDate, asOfMonth } = asOfOf(period);
  const [projects, dims, facts] = await Promise.all([
    repo.listProjects(),
    repo.getDims(),
    repo.readFactSnapshotsAsOf(asOfMonth),
  ]);
  const byId = new Map(facts.map((f) => [f.projectId, f]));
  const entries: PeriodEntry[] = projects.map((project) => {
    const row = byId.get(project.id);
    const asOf: AsOf<FactSnapshot> | null = row ? { row, sourceYm: row.yearMonth, carried: row.yearMonth !== asOfMonth } : null;
    return { project, summary: summarize(project, asOf, dims, asOfDate) };
  });
  return { entries, dims, asOfDate, asOfMonth, factRows: facts.length };
}
const getPeriodBase = requestMemo(getPeriodBaseUncached);

/** Dự án thuộc kỳ: [bắt đầu, kết thúc] giao với kỳ (Q4: thiếu ngày bắt đầu lấy ngày ký HĐ, thiếu cả 2 thì thuộc mọi kỳ). */
function inPeriod(project: Project, period: Period): boolean {
  const start = day10(project.actualStartDate) ?? day10(project.plannedStartDate) ?? day10(project.contractDate);
  const end = day10(project.actualFinishDate) ?? day10(project.plannedFinishDate);
  return intersectsPeriod(start, end, period);
}

async function getProjectSummariesUncached(period: Period, filters?: DashboardFilters): Promise<ProjectSummary[]> {
  const { entries, dims } = await getPeriodBase(period);
  const summaries = entries.filter((e) => inPeriod(e.project, period)).map((e) => e.summary);
  return filters ? filterSummaries(summaries, filters, dims) : summaries;
}

/** Dự án thuộc kỳ (đã qua filters) với số tồn tại mốc cuối kỳ. */
export const getProjectSummaries = requestMemo(getProjectSummariesUncached);

/** Trang Chi tiết: 1 dự án tại tháng mốc, KHÔNG lọc theo kỳ. Ngày mốc = min(cuối tháng, hôm nay). */
export async function getProjectSummary(projectId: number, asOfMonth: YearMonth): Promise<ProjectSummary | undefined> {
  // TODO: BOLA - không check quyền đọc project. Viewer/data-entry đọc được detail dự án ngoài scope.
  const p = await repo.getProject(projectId);
  if (!p) return undefined;
  const ym = isValidYearMonth(asOfMonth) ? asOfMonth : currentMonth();
  const today = todayIso();
  const asOfDate = endOfMonth(ym) < today ? endOfMonth(ym) : today;
  const [facts, dims] = await Promise.all([repo.getFacts(projectId), repo.getDims()]);
  return summarize(p, pickAsOf(facts, ym), dims, asOfDate);
}

// ---- Portfolio KPI ----
type KpiDelta = number | null;
export interface PortfolioKpis {
  projectsInPeriod: number;
  inProgress: number;
  behindSchedule: number;
  penaltyRisk: number;
  penalized: number;
  /** "HĐ chưa khởi công" (Q3 = a): Σ giá trị HĐ đã ký (ngày ký <= mốc, thiếu ngày ký vẫn tính) và chưa khởi công tại mốc, KHÔNG phụ thuộc kỳ. */
  notStartedValue: number;
  revenueInPeriod: number;
  tonnageInPeriod: number;
  /** So với kỳ liền trước cùng độ dài (Q2 = a); null = không có số để so (không bịa). */
  delta: {
    projectsInPeriod: KpiDelta;
    inProgress: KpiDelta;
    behindSchedule: KpiDelta;
    penaltyRisk: KpiDelta;
    penalized: KpiDelta;
    notStartedValue: KpiDelta;
    revenueInPeriod: KpiDelta;
    tonnageInPeriod: KpiDelta;
  };
  asOfDate: IsoDate;
  months: YearMonth[];
}

type KpiValues = Omit<PortfolioKpis, 'delta' | 'asOfDate' | 'months'>;

async function kpisForPeriod(period: Period, filters: DashboardFilters) {
  const base = await getPeriodBase(period);
  const { entries, dims, asOfDate } = base;
  const months = periodMonths(period);
  const scoped = filterSummaries(entries.map((e) => e.summary), filters, dims);
  const scopedIds = new Set(scoped.map((s) => s.id));
  const summaries = entries.filter((e) => scopedIds.has(e.summary.id) && inPeriod(e.project, period)).map((e) => e.summary);
  const ids = new Set(summaries.map((s) => s.id));
  const [revenue, volume] = await Promise.all([
    repo.readRevenueInRange(months[0], months[months.length - 1]),
    repo.readVolumeInRange(months[0], months[months.length - 1]),
  ]);
  const notStartedValue = entries
    .filter((e) => scopedIds.has(e.summary.id) && e.summary.status === 'Chuan_bi')
    .filter((e) => {
      const signed = day10(e.project.contractDate);
      return signed == null || signed <= asOfDate;
    })
    .reduce((sum, e) => sum + e.summary.contractValue, 0);
  const values: KpiValues = {
    projectsInPeriod: summaries.length,
    inProgress: summaries.filter((s) => s.status === 'Dang_trien_khai').length,
    behindSchedule: summaries.filter((s) => s.status === 'Dang_trien_khai' && !s.onTrack).length,
    penaltyRisk: summaries.filter((s) => s.penalty === 'risk').length,
    penalized: summaries.filter((s) => s.penalty === 'penalized').length,
    notStartedValue,
    revenueInPeriod: round1(revenue.filter((r) => ids.has(r.projectId)).reduce((a, r) => a + r.revenue, 0)),
    tonnageInPeriod: Math.round(volume.filter((v) => ids.has(v.projectId)).reduce((a, v) => a + v.tonnage, 0)),
  };
  return { values, asOfDate, months, factRows: base.factRows };
}

const DELTA_KEYS = [
  'projectsInPeriod', 'inProgress', 'behindSchedule', 'penaltyRisk', 'penalized',
  'notStartedValue', 'revenueInPeriod', 'tonnageInPeriod',
] as const;

export async function getPortfolioKpis(period: Period, filters: DashboardFilters = {}): Promise<PortfolioKpis> {
  const [cur, prev] = await Promise.all([
    kpisForPeriod(period, filters),
    kpisForPeriod(previousPeriod(period), filters),
  ]);
  // Kỳ đang xem HOẶC kỳ liền trước CHƯA CÓ dòng fact nào tới mốc của nó (vd kỳ trước nằm trước cửa sổ dữ liệu)
  // khác hẳn "%TT = 0 thật": không có dữ liệu để so thì không bịa ra một cú tăng/tụt KPI giả.
  const comparable = cur.factRows > 0 && prev.factRows > 0;
  const delta = Object.fromEntries(
    DELTA_KEYS.map((k) => [k, comparable ? round1(cur.values[k] - prev.values[k]) : null]),
  ) as PortfolioKpis['delta'];
  return { ...cur.values, delta, asOfDate: cur.asOfDate, months: cur.months };
}

// ---- Donut ----
export async function getStatusBreakdown(period: Period, filters: DashboardFilters = {}) {
  const summaries = await getProjectSummaries(period, filters);
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
export async function getTonnageValueByGroup(period: Period, groupBy: GroupBy, filters: DashboardFilters = {}) {
  const months = periodMonths(period);
  const [summaries, volumes, revenue] = await Promise.all([
    getProjectSummaries(period, filters),
    repo.readVolumeInRange(months[0], months[months.length - 1]),
    repo.readRevenueInRange(months[0], months[months.length - 1]),
  ]);

  const tonnageByProject = new Map<number, number>();
  for (const v of volumes) tonnageByProject.set(v.projectId, (tonnageByProject.get(v.projectId) ?? 0) + v.tonnage);
  const revenueByProject = new Map<number, number>();
  for (const f of revenue) revenueByProject.set(f.projectId, (revenueByProject.get(f.projectId) ?? 0) + f.revenue);

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
/** Sản lượng = cộng các tháng của kỳ; công suất = công suất tháng x số tháng của kỳ. */
export async function getCapacityData(period: Period, filters: DashboardFilters = {}) {
  const months = periodMonths(period);
  const [dims, summaries, volumes] = await Promise.all([
    repo.getDims(),
    getProjectSummaries(period, filters),
    repo.readVolumeInRange(months[0], months[months.length - 1]),
  ]);
  const ids = new Set(summaries.map((s) => s.id));
  return dims.factories.map((factory) => {
    const processed = volumes
      .filter((v) => v.factoryId === factory.id && ids.has(v.projectId))
      .reduce((a, b) => a + b.tonnage, 0);
    const capacityPeriod = (factory.capacityTonPerYear / 12) * months.length;
    return {
      name: factory.name,
      region: factory.region,
      processed,
      capacity: Math.round(capacityPeriod),
      warn: processed > THRESHOLDS.capacityWarnPct * capacityPeriod,
    };
  });
}

// ---- Chuỗi tháng danh mục: SPI/CPI trend + S-curve ----
export interface TrendPoint { month: YearMonth; carriedProjects: number }

/**
 * Tập dự án = đúng tập của getProjectSummaries(period, filters) (F-1: đủ mọi filter kể cả status).
 * Mỗi tháng của kỳ (tới tháng mốc) cộng số của từng dự án theo "số gần nhất <= tháng" (mang số tháng trước).
 */
async function portfolioSeries(period: Period, filters: DashboardFilters) {
  const { asOfMonth } = asOfOf(period);
  // Không vẽ tháng sau mốc: số của tháng tương lai không tồn tại, chỉ là số cũ lặp lại.
  const months = periodMonths(period).filter((m) => m <= asOfMonth);
  if (months.length === 0) return [];
  const summaries = await getProjectSummaries(period, filters);
  const rows = await repo.readFactSeries(months[0], months[months.length - 1], summaries.map((s) => s.id));
  const byProject = new Map<number, FactSeriesRow[]>();
  for (const r of rows) {
    const list = byProject.get(r.projectId) ?? [];
    list.push(r);
    byProject.set(r.projectId, list);
  }
  const series = [...byProject.values()].map((list) => carrySeries(list, months));
  return months.map((month, i) => {
    let pv = 0;
    let ev = 0;
    let ac = 0;
    let carriedProjects = 0;
    for (const s of series) {
      const at = s[i];
      if (!at) continue;
      pv += at.row.pv;
      ev += at.row.ev;
      ac += at.row.ac;
      if (at.carried) carriedProjects++;
    }
    return { month, pv, ev, ac, carriedProjects };
  });
}

// ---- Line: SPI/CPI trend ----
/** SPI/CPI danh mục = tỷ số có trọng số (SigmaEV/SigmaPV, SigmaEV/SigmaAC), không phải trung bình cộng (L-2). */
export async function getSpiCpiTrend(period: Period, filters: DashboardFilters = {}): Promise<(TrendPoint & { spi: number | null; cpi: number | null })[]> {
  return (await portfolioSeries(period, filters)).map((p) => ({
    month: p.month,
    carriedProjects: p.carriedProjects,
    spi: p.pv ? Math.round((p.ev / p.pv) * 100) / 100 : null,
    cpi: p.ac ? Math.round((p.ev / p.ac) * 100) / 100 : null,
  }));
}

// ---- S-curve ----
export async function getPortfolioSCurve(period: Period, filters: DashboardFilters = {}): Promise<(TrendPoint & { pv: number; ev: number; ac: number })[]> {
  return (await portfolioSeries(period, filters)).map((p) => ({
    month: p.month,
    carriedProjects: p.carriedProjects,
    pv: Math.round(p.pv),
    ev: Math.round(p.ev),
    ac: Math.round(p.ac),
  }));
}

// ---- Watchlist ----
export async function getWatchlist(period: Period, filters: DashboardFilters = {}) {
  return (await getProjectSummaries(period, filters))
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
  period: Period;
  filters?: DashboardFilters;
  search?: string;
  sort?: 'priority' | 'name' | 'value' | 'spi' | 'pctActual';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function listProjects(params: ProjectListParams) {
  const { period, filters = {}, page = 1, pageSize = 10 } = params;
  let rows = await getProjectSummaries(period, filters);

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
