import { loadPortfolioKpis, loadWatchlist } from '@/server/cache';
import { repo } from '@/server/repo';
import { currentMonth } from '@/lib/clock';
import { getProjectSummaries, type PortfolioKpis, type ProjectSummary } from '@/server/queries';

export interface ReportRow {
  id: number;
  code: string; // currentAliasCode
  name: string; // projectName
  spi: number | null;
  cpi: number | null;
  pctActual: number;
  backlog: number; // Giá trị HĐ nếu dự án Chuẩn bị, còn lại 0
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
  // Backlog từng dòng dùng chung định nghĩa với thẻ KPI Tổng quan (chủ dự án chốt 2026-09-24,
  // P1B/T12a, bước 8A-4): giá trị HĐ nếu dự án đang "Chuẩn bị", còn lại 0.
  const summaryById = new Map((await getProjectSummaries(month)).map((x) => [x.id, x]));
  const rows = await Promise.all(
    projects.map(async (p) => {
      const fact = await repo.getLatestFact(p.id, month);
      const s = summaryById.get(p.id);
      return {
        id: p.id,
        code: p.currentAliasCode,
        name: p.projectName,
        spi: fact?.spi != null ? Math.round(fact.spi * 100) / 100 : null,
        cpi: fact?.cpi != null ? Math.round(fact.cpi * 100) / 100 : null,
        pctActual: fact?.pctActual ?? 0,
        backlog: s?.status === 'Chuan_bi' ? s.contractValue : 0,
      };
    }),
  );
  return { kpis, p0Red, rows };
}
