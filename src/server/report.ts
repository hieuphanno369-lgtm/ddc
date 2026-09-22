import { loadPortfolioKpis, loadWatchlist } from '@/server/cache';
import { repo } from '@/server/repo';
import { currentMonth } from '@/lib/clock';
import type { PortfolioKpis, ProjectSummary } from '@/server/queries';

export interface ReportRow {
  id: number;
  code: string; // currentAliasCode
  name: string; // projectName
  spi: number | null;
  cpi: number | null;
  pctActual: number;
  backlog: number; // FactFinancial.backlog tháng hiện tại
}

export interface ReportData {
  kpis: PortfolioKpis;
  p0Red: ProjectSummary[];
  rows: ReportRow[];
}

/** Nguồn data chung cho trang /report + export Excel. */
export async function getReportData(month: string = currentMonth()): Promise<ReportData> {
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
