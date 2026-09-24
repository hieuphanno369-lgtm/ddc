import { loadPortfolioKpis, loadWatchlist } from '@/server/cache';
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
  // Backlog từng dòng dùng chung định nghĩa với thẻ KPI Tổng quan (chủ dự án chốt 2026-09-24,
  // P1B/T12a, bước 8A-4): giá trị HĐ nếu dự án đang "Chuẩn bị", còn lại 0. `summary.spi/cpi` đã
  // làm tròn 2 số giống hệt cách cũ (Math.round(x*100)/100) - không cần getLatestFact riêng nữa.
  const rows: ReportRow[] = (await getProjectSummaries(month)).map((s) => ({
    id: s.id,
    code: s.currentAliasCode,
    name: s.projectName,
    spi: s.spi,
    cpi: s.cpi,
    pctActual: s.pctActual,
    backlog: s.status === 'Chuan_bi' ? s.contractValue : 0,
  }));
  return { kpis, p0Red, rows };
}
