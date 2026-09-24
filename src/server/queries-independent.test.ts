import { describe, expect, it, vi } from 'vitest';

/**
 * Kiểm tra ĐỘC LẬP của tester (không phải test do coder viết): dựng lại logic TRƯỚC khi refactor
 * T1 Bước 5 (nguyên văn từ `git show 10cda5a:src/server/queries.ts`, đổi tên hàm thêm hậu tố
 * `Old`) rồi chạy song song với `queries.ts` SAU refactor trên CÙNG mock repo (seed mặc định),
 * so sánh GIÁ TRỊ trả về (không chỉ số lần gọi repo như `queries-n1.test.ts`).
 *
 * KHÔNG sửa file sản phẩm nào - toàn bộ "bản cũ" chỉ tồn tại trong file test này để đối chiếu.
 */

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { calcDurationPctComplete, calcEac, calcVac, deriveStatus, isOnTrack, penaltyState } from '@/lib/evm';
import { THRESHOLDS } from '@/lib/thresholds';
import { historyMonths, isValidYearMonth, prevMonth, today } from '@/lib/clock';
import { repo } from '@/server/repo';
import type { FactProgressMonthly, Project } from './repo/types';
import * as NewQ from './queries';
import type { DashboardFilters, GroupBy, ProjectSummary } from './queries';

// ---------------------------------------------------------------------------
// Bản sao logic TRƯỚC refactor (10cda5a) - CHỈ dùng để đối chiếu trong test.
// ---------------------------------------------------------------------------

function round2Old(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100;
}

async function summarizeOld(project: Project, fact: FactProgressMonthly | undefined): Promise<ProjectSummary> {
  const dims = await repo.getDims();
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
    spi: round2Old(fact?.spi ?? null),
    cpi: round2Old(fact?.cpi ?? null),
    eac: round2Old(eac),
    vac: round2Old(calcVac(bac, eac)),
    bottleneckStage: fact?.bottleneckStage ?? null,
  };
}

async function matchesGroupOld(project: Project, groupKey: string, groupBy: GroupBy): Promise<boolean> {
  const dims = await repo.getDims();
  if (groupBy === 'team') return (dims.teams.find((t) => t.id === project.teamKdId)?.name ?? '-') === groupKey;
  if (groupBy === 'type') return project.projectType === groupKey;
  return project.marketCode === groupKey;
}

async function filterSummariesOld(summaries: ProjectSummary[], filters: DashboardFilters): Promise<ProjectSummary[]> {
  let rows = summaries;
  if (filters.status && filters.status !== 'all') rows = rows.filter((r) => r.status === filters.status);
  if (filters.teamKdId && filters.teamKdId !== 'all') rows = rows.filter((r) => r.teamKdId === filters.teamKdId);
  if (filters.customerId && filters.customerId !== 'all') rows = rows.filter((r) => r.customerId === filters.customerId);
  if (filters.priority && filters.priority !== 'all') rows = rows.filter((r) => r.priority === filters.priority);
  if (filters.market && filters.market !== 'all') rows = rows.filter((r) => r.marketCode === filters.market);
  if (filters.projectType && filters.projectType !== 'all') rows = rows.filter((r) => r.projectType === filters.projectType);
  if (filters.groupKey && filters.groupBy) {
    const matches = await Promise.all(
      rows.map(async (r) => ({ r, ok: await matchesGroupOld((await repo.getProject(r.id))!, filters.groupKey!, filters.groupBy!) })),
    );
    rows = matches.filter((m) => m.ok).map((m) => m.r);
  }
  return rows;
}

async function getScopedProjectIdsOld(filters: DashboardFilters): Promise<Set<number>> {
  let projects = await repo.listProjects();
  if (filters.teamKdId && filters.teamKdId !== 'all') projects = projects.filter((p) => p.teamKdId === filters.teamKdId);
  if (filters.customerId && filters.customerId !== 'all') projects = projects.filter((p) => p.customerId === filters.customerId);
  if (filters.priority && filters.priority !== 'all') projects = projects.filter((p) => p.priority === filters.priority);
  if (filters.market && filters.market !== 'all') projects = projects.filter((p) => p.marketCode === filters.market);
  if (filters.projectType && filters.projectType !== 'all') projects = projects.filter((p) => p.projectType === filters.projectType);
  if (filters.groupKey && filters.groupBy) {
    const matches = await Promise.all(projects.map(async (p) => ({ p, ok: await matchesGroupOld(p, filters.groupKey!, filters.groupBy!) })));
    projects = matches.filter((m) => m.ok).map((m) => m.p);
  }
  return new Set(projects.map((p) => p.id));
}

async function getProjectSummariesOld(yearMonth: string, filters?: DashboardFilters): Promise<ProjectSummary[]> {
  const projects = await repo.listProjects();
  const summaries = await Promise.all(projects.map(async (p) => summarizeOld(p, await repo.getLatestFact(p.id, yearMonth))));
  return filters ? filterSummariesOld(summaries, filters) : summaries;
}

async function kpisForMonthOld(yearMonth: string, filters: DashboardFilters) {
  const summaries = await getProjectSummariesOld(yearMonth, filters);
  return {
    totalProjects: summaries.length,
    inProgress: summaries.filter((s) => s.status === 'Dang_trien_khai').length,
    behindSchedule: summaries.filter((s) => s.status === 'Dang_trien_khai' && !s.onTrack).length,
    penaltyRisk: summaries.filter((s) => s.penalty === 'risk').length,
    penalized: summaries.filter((s) => s.penalty === 'penalized').length,
    backlog: summaries.filter((s) => s.status === 'Chuan_bi').reduce((sum, s) => sum + s.contractValue, 0),
  };
}

const ZERO_DELTA_OLD = { totalProjects: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, backlog: 0 };

async function getPortfolioKpisOld(yearMonth: string, filters: DashboardFilters = {}) {
  const cur = await kpisForMonthOld(yearMonth, filters);
  if (yearMonth === 'all' || !isValidYearMonth(yearMonth)) return { ...cur, delta: ZERO_DELTA_OLD };
  const prevYm = prevMonth(yearMonth);
  const [curFacts, prevFacts] = await Promise.all([repo.getFactsForMonth(yearMonth), repo.getFactsForMonth(prevYm)]);
  if (curFacts.length === 0 || prevFacts.length === 0) return { ...cur, delta: ZERO_DELTA_OLD };
  const prev = await kpisForMonthOld(prevYm, filters);
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

async function getTonnageValueByGroupOld(yearMonth: string, groupBy: GroupBy, filters: DashboardFilters = {}) {
  const summaries = await getProjectSummariesOld(yearMonth, filters);
  const volumes = await repo.getVolumesForMonth(yearMonth);
  const financial = await repo.getFinancialForMonth(yearMonth);
  const dims = await repo.getDims();
  const groups = new Map<string, { tonnage: number; value: number }>();
  for (const s of summaries) {
    const proj = (await repo.getProject(s.id))!;
    const key = groupBy === 'team' ? dims.teams.find((t) => t.id === proj.teamKdId)?.name ?? '-' : groupBy === 'type' ? s.projectType : s.marketCode;
    const vol = volumes.filter((v) => v.projectId === s.id).reduce((a, b) => a + b.tonnageProcessed, 0);
    const fin = financial.filter((f) => f.projectId === s.id).reduce((a, b) => a + b.revenuePeriod, 0);
    const g = groups.get(key) ?? { tonnage: 0, value: 0 };
    g.tonnage += vol;
    g.value += fin;
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, v]) => ({ key, tonnage: Math.round(v.tonnage), value: Math.round(v.value * 10) / 10 }));
}

async function getCapacityDataOld(yearMonth: string, filters: DashboardFilters = {}) {
  const dims = await repo.getDims();
  const ids = new Set((await getProjectSummariesOld(yearMonth, filters)).map((s) => s.id));
  const volumes = await repo.getVolumesForMonth(yearMonth);
  return dims.factories.map((factory) => {
    const processed = volumes.filter((v) => v.factoryId === factory.id && ids.has(v.projectId)).reduce((a, b) => a + b.tonnageProcessed, 0);
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

async function getSpiCpiTrendOld(filters: DashboardFilters = {}) {
  const ids = await getScopedProjectIdsOld(filters);
  return Promise.all(
    historyMonths().map(async (m) => {
      const facts = (await repo.getFactsForMonth(m)).filter((f) => ids.has(f.projectId));
      const spis = facts.map((f) => f.spi).filter((x): x is number => x != null);
      const cpis = facts.map((f) => f.cpi).filter((x): x is number => x != null);
      const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null);
      return { month: m, spi: avg(spis), cpi: avg(cpis) };
    }),
  );
}

async function getPortfolioSCurveOld(filters: DashboardFilters = {}) {
  const ids = await getScopedProjectIdsOld(filters);
  return Promise.all(
    historyMonths().map(async (m) => {
      const facts = (await repo.getFactsForMonth(m)).filter((f) => ids.has(f.projectId));
      return {
        month: m,
        pv: Math.round(facts.reduce((a, b) => a + b.pv, 0)),
        ev: Math.round(facts.reduce((a, b) => a + b.ev, 0)),
        ac: Math.round(facts.reduce((a, b) => a + b.ac, 0)),
      };
    }),
  );
}

async function getWatchlistOld(yearMonth: string, filters: DashboardFilters = {}) {
  return (await getProjectSummariesOld(yearMonth, filters))
    .filter((s) => {
      if (s.status !== 'Dang_trien_khai') return false;
      const spiLow = s.spi != null && s.spi < THRESHOLDS.spiWarn;
      const cpiLow = s.cpi != null && s.cpi < THRESHOLDS.cpiWarn;
      const pen = s.penalty === 'risk' || s.penalty === 'penalized';
      return spiLow || cpiLow || pen;
    })
    .sort((a, b) => (a.spi ?? 99) - (b.spi ?? 99));
}

async function getMissingMonthOld(yearMonth: string) {
  const projects = await repo.listProjects();
  const rows = await Promise.all(
    projects.map(async (p) => {
      const fact = await repo.getLatestFact(p.id, yearMonth);
      const status = deriveStatus({ actualStartDate: p.actualStartDate, actualFinishDate: p.actualFinishDate, pctActual: fact?.pctActual ?? 0 });
      return status === 'Dang_trien_khai' && !fact ? { id: p.id, projectName: p.projectName, code: p.currentAliasCode } : null;
    }),
  );
  return rows.filter((x): x is { id: number; projectName: string; code: string } => x != null);
}

// ---------------------------------------------------------------------------
// So sánh giá trị TRƯỚC/SAU trên seed mặc định (mock repo).
// ---------------------------------------------------------------------------

const byId = <T extends { id: number }>(rows: T[]) => [...rows].sort((a, b) => a.id - b.id);

describe('queries.ts truoc/sau refactor T1 Buoc 5 - gia tri phai giong het nhau', () => {
  it('getProjectSummaries: thang hien tai, khong filter', async () => {
    const oldRows = await getProjectSummariesOld('2026-09');
    const newRows = await NewQ.getProjectSummaries('2026-09');
    expect(byId(newRows)).toEqual(byId(oldRows));
  });

  it('getProjectSummaries: month=all', async () => {
    const oldRows = await getProjectSummariesOld('all');
    const newRows = await NewQ.getProjectSummaries('all');
    expect(byId(newRows)).toEqual(byId(oldRows));
  });

  it('getProjectSummaries: month rac -> ca 2 ban deu ra pctActual=0 giong nhau', async () => {
    const oldRows = await getProjectSummariesOld('khong-hop-le');
    const newRows = await NewQ.getProjectSummaries('khong-hop-le');
    expect(byId(newRows)).toEqual(byId(oldRows));
  });

  it('getProjectSummaries voi filter groupBy=team (groupKey lay tu du lieu that)', async () => {
    const dims = await repo.getDims();
    const groupKey = dims.teams[0].name;
    const oldRows = await getProjectSummariesOld('2026-09', { groupBy: 'team', groupKey });
    const newRows = await NewQ.getProjectSummaries('2026-09', { groupBy: 'team', groupKey });
    expect(byId(newRows)).toEqual(byId(oldRows));
    expect(newRows.length).toBeGreaterThan(0); // dam bao filter khong loc rong het (test khong ro rang)
  });

  it('getPortfolioKpis: thang hien tai', async () => {
    expect(await NewQ.getPortfolioKpis('2026-09', {})).toEqual(await getPortfolioKpisOld('2026-09', {}));
  });

  it('getPortfolioKpis: month=all -> delta = 0 o ca 2 ban', async () => {
    expect(await NewQ.getPortfolioKpis('all', {})).toEqual(await getPortfolioKpisOld('all', {}));
  });

  it('getTonnageValueByGroup: theo team', async () => {
    const oldRows = await getTonnageValueByGroupOld('2026-09', 'team');
    const newRows = await NewQ.getTonnageValueByGroup('2026-09', 'team');
    expect([...newRows].sort((a, b) => a.key.localeCompare(b.key))).toEqual([...oldRows].sort((a, b) => a.key.localeCompare(b.key)));
  });

  it('getTonnageValueByGroup: theo market, month=all', async () => {
    const oldRows = await getTonnageValueByGroupOld('all', 'market');
    const newRows = await NewQ.getTonnageValueByGroup('all', 'market');
    expect([...newRows].sort((a, b) => a.key.localeCompare(b.key))).toEqual([...oldRows].sort((a, b) => a.key.localeCompare(b.key)));
  });

  it('getCapacityData', async () => {
    const oldRows = await getCapacityDataOld('2026-09');
    const newRows = await NewQ.getCapacityData('2026-09');
    expect([...newRows].sort((a, b) => a.name.localeCompare(b.name))).toEqual([...oldRows].sort((a, b) => a.name.localeCompare(b.name)));
  });

  it('getSpiCpiTrend: khong filter', async () => {
    expect(await NewQ.getSpiCpiTrend({})).toEqual(await getSpiCpiTrendOld({}));
  });

  it('getPortfolioSCurve: khong filter', async () => {
    expect(await NewQ.getPortfolioSCurve({})).toEqual(await getPortfolioSCurveOld({}));
  });

  it('getWatchlist: thang hien tai', async () => {
    expect(await NewQ.getWatchlist('2026-09', {})).toEqual(await getWatchlistOld('2026-09', {}));
  });

  it('getMissingMonth: thang chua nhap so cua nhieu du an (thang tuong lai xa)', async () => {
    const futureMonth = '2030-01';
    expect(await NewQ.getMissingMonth(futureMonth)).toEqual(await getMissingMonthOld(futureMonth));
  });

  // ---- Truong hop phai "that bai" theo nghia sad-path: du lieu vo ly khong duoc lam sup he thong ----
  it('groupKey khong ton tai (khong khop du an nao) -> ca 2 ban deu tra mang rong, KHONG throw', async () => {
    const oldRows = await getProjectSummariesOld('2026-09', { groupBy: 'team', groupKey: 'ten-doi-khong-ton-tai-xyz' });
    const newRows = await NewQ.getProjectSummaries('2026-09', { groupBy: 'team', groupKey: 'ten-doi-khong-ton-tai-xyz' });
    expect(newRows).toEqual([]);
    expect(newRows).toEqual(oldRows);
  });
});
