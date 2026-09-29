import { loadPortfolioKpis, loadWatchlist } from '@/server/cache';
import type { Period } from '@/lib/period';
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

/**
 * Nguồn data chung cho trang /report + export Excel. T-2: dùng CHUNG kỳ với Tổng quan (page/route đọc kỳ bằng
 * `parsePeriodChecked` + `defaultOverviewPeriod`); cùng 1 object `period` cho mọi lời gọi để React cache còn memo.
 */
export async function getReportData(period: Period): Promise<ReportData> {
  const kpis = await loadPortfolioKpis(period, {});
  const watchlist = await loadWatchlist(period, {});
  const p0Red = watchlist.filter(
    (w) => w.priority === 'P0' && (w.penalty === 'risk' || w.penalty === 'penalized'),
  );
  // R1: bảng liệt kê ĐÚNG tập dự án của kỳ (cùng tập với thẻ KPI "Dự án trong kỳ" và Tổng quan).
  // Backlog từng dòng dùng chung định nghĩa với thẻ KPI Tổng quan (chủ dự án chốt 2026-09-24,
  // P1B/T12a, bước 8A-4): giá trị HĐ nếu dự án đang "Chuẩn bị", còn lại 0. `summary.spi/cpi` đã
  // làm tròn 2 số giống hệt cách cũ (Math.round(x*100)/100) - không cần getLatestFact riêng nữa.
  const rows: ReportRow[] = (await getProjectSummaries(period, {})).map((s) => ({
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
