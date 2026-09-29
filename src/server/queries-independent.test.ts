import { describe, expect, it, vi } from 'vitest';

/**
 * Kiểm tra ĐỘC LẬP: tính lại bằng đường đọc KHÁC (repo.getFacts / getVolumesForMonth / getFinancialForMonth
 * của mock-repo, không dùng các hàm đọc theo kỳ của P4) rồi so với `queries.ts` trên CÙNG mock repo (seed mặc định).
 * Bản trước (T1 Bước 5) đối chiếu với logic tháng cũ; P4 đổi ngữ nghĩa sang kỳ + mốc + mang số tháng trước
 * nên oracle được viết lại theo ngữ nghĩa mới, giữ nguyên các ca sad-path (groupKey lạ, getMissingMonth).
 */

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { deriveStatus } from '@/lib/evm';
import { THRESHOLDS } from '@/lib/thresholds';
import { todayIso } from '@/lib/clock';
import { periodAsOfDate, periodMonths, type Period } from '@/lib/period';
import { repo } from '@/server/repo';
import * as NewQ from './queries';

const MONTH_09: Period = { from: '2026-09-01', to: '2026-09-30' };
const RANGE: Period = { from: '2026-04-01', to: '2026-09-16' };
const byId = <T extends { id: number }>(rows: T[]) => [...rows].sort((a, b) => a.id - b.id);
const byKey = <T extends { key: string }>(rows: T[]) => [...rows].sort((a, b) => a.key.localeCompare(b.key));

/** Dòng fact isLatest gần nhất <= ym của 1 dự án (đọc bằng repo.getFacts, độc lập với readFactSnapshotsAsOf). */
async function factAtOrBefore(projectId: number, ym: string) {
  const facts = (await repo.getFacts(projectId)).filter((f) => f.yearMonth <= ym);
  return facts.length ? facts[facts.length - 1] : undefined;
}

describe('getProjectSummaries - số tồn tại mốc khớp oracle độc lập', () => {
  it('kỳ trọn tháng 09/2026: %TT = dòng fact gần nhất <= 2026-09, trạng thái theo ngày thực tế <= mốc', async () => {
    const rows = await NewQ.getProjectSummaries(MONTH_09);
    const asOfDate = periodAsOfDate(MONTH_09, todayIso());
    expect(rows.length).toBeGreaterThan(0);
    for (const s of rows) {
      const p = (await repo.getProject(s.id))!;
      const fact = await factAtOrBefore(s.id, asOfDate.slice(0, 7));
      expect(s.pctActual, s.projectName).toBe(fact?.pctActual ?? 0);
      const upTo = (d: string | null) => (d && d.slice(0, 10) <= asOfDate ? d : null);
      expect(s.status, s.projectName).toBe(deriveStatus({
        actualStartDate: upTo(p.actualStartDate), actualFinishDate: upTo(p.actualFinishDate), pctActual: fact?.pctActual ?? 0,
      }));
    }
  });

  it('filter groupBy=team (groupKey lấy từ dữ liệu thật): tập con của bản không filter, đúng team', async () => {
    const dims = await repo.getDims();
    const groupKey = dims.teams[0].name;
    const all = await NewQ.getProjectSummaries(RANGE);
    const filtered = await NewQ.getProjectSummaries(RANGE, { groupBy: 'team', groupKey });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((s) => s.teamName === groupKey)).toBe(true);
    expect(byId(filtered)).toEqual(byId(all.filter((s) => s.teamName === groupKey)));
  });

  it('groupKey không tồn tại -> mảng rỗng, KHÔNG throw', async () => {
    expect(await NewQ.getProjectSummaries(RANGE, { groupBy: 'team', groupKey: 'ten-doi-khong-ton-tai-xyz' })).toEqual([]);
  });
});

describe('số phát sinh theo kỳ khớp oracle độc lập', () => {
  it('getTonnageValueByGroup (theo team, tháng 09): cộng volume/doanh thu tháng 09 của dự án trong kỳ', async () => {
    const summaries = await NewQ.getProjectSummaries(MONTH_09);
    const volumes = await repo.getVolumesForMonth('2026-09');
    const financial = await repo.getFinancialForMonth('2026-09');
    const groups = new Map<string, { tonnage: number; value: number }>();
    for (const s of summaries) {
      const g = groups.get(s.teamName) ?? { tonnage: 0, value: 0 };
      g.tonnage += volumes.filter((v) => v.projectId === s.id).reduce((a, b) => a + b.tonnageProcessed, 0);
      g.value += financial.filter((f) => f.projectId === s.id).reduce((a, b) => a + b.revenuePeriod, 0);
      groups.set(s.teamName, g);
    }
    const expected = [...groups.entries()].map(([key, v]) => ({ key, tonnage: Math.round(v.tonnage), value: Math.round(v.value * 10) / 10 }));
    expect(byKey(await NewQ.getTonnageValueByGroup(MONTH_09, 'team'))).toEqual(byKey(expected));
  });

  it('getCapacityData (1 tháng): công suất = công suất năm / 12, sản lượng cộng theo nhà máy', async () => {
    const ids = new Set((await NewQ.getProjectSummaries(MONTH_09)).map((s) => s.id));
    const volumes = await repo.getVolumesForMonth('2026-09');
    const dims = await repo.getDims();
    const expected = dims.factories.map((f) => {
      const processed = volumes.filter((v) => v.factoryId === f.id && ids.has(v.projectId)).reduce((a, b) => a + b.tonnageProcessed, 0);
      return { name: f.name, region: f.region, processed, capacity: Math.round(f.capacityTonPerYear / 12), warn: processed > THRESHOLDS.capacityWarnPct * (f.capacityTonPerYear / 12) };
    });
    const actual = await NewQ.getCapacityData(MONTH_09);
    expect([...actual].sort((a, b) => a.name.localeCompare(b.name))).toEqual([...expected].sort((a, b) => a.name.localeCompare(b.name)));
  });
});

describe('chuỗi tháng danh mục khớp oracle độc lập (mang số tháng trước, SPI/CPI có trọng số)', () => {
  async function oracle() {
    const ids = (await NewQ.getProjectSummaries(RANGE)).map((s) => s.id);
    const months = periodMonths(RANGE).filter((m) => m <= periodAsOfDate(RANGE, todayIso()).slice(0, 7));
    return Promise.all(months.map(async (month) => {
      const facts = (await Promise.all(ids.map((id) => factAtOrBefore(id, month)))).filter((f) => f != null);
      const sum = (k: 'pv' | 'ev' | 'ac') => facts.reduce((a, f) => a + f![k], 0);
      return { month, pv: sum('pv'), ev: sum('ev'), ac: sum('ac') };
    }));
  }

  it('getPortfolioSCurve: PV/EV/AC = Σ số gần nhất <= tháng của từng dự án trong kỳ', async () => {
    const expected = (await oracle()).map((o) => ({ month: o.month, pv: Math.round(o.pv), ev: Math.round(o.ev), ac: Math.round(o.ac) }));
    const actual = (await NewQ.getPortfolioSCurve(RANGE)).map(({ month, pv, ev, ac }) => ({ month, pv, ev, ac }));
    expect(actual).toEqual(expected);
  });

  it('getSpiCpiTrend: SPI = ΣEV/ΣPV, CPI = ΣEV/ΣAC', async () => {
    const expected = (await oracle()).map((o) => ({
      month: o.month,
      spi: o.pv ? Math.round((o.ev / o.pv) * 100) / 100 : null,
      cpi: o.ac ? Math.round((o.ev / o.ac) * 100) / 100 : null,
    }));
    const actual = (await NewQ.getSpiCpiTrend(RANGE)).map(({ month, spi, cpi }) => ({ month, spi, cpi }));
    expect(actual).toEqual(expected);
  });
});

describe('getWatchlist / getMissingMonth', () => {
  it('getWatchlist: dự án đang triển khai có SPI/CPI thấp hoặc nguy cơ phạt, sắp SPI tăng', async () => {
    const expected = (await NewQ.getProjectSummaries(MONTH_09))
      .filter((s) => s.status === 'Dang_trien_khai' && ((s.spi != null && s.spi < THRESHOLDS.spiWarn) || (s.cpi != null && s.cpi < THRESHOLDS.cpiWarn) || s.penalty === 'risk' || s.penalty === 'penalized'))
      .sort((a, b) => (a.spi ?? 99) - (b.spi ?? 99));
    expect(await NewQ.getWatchlist(MONTH_09, {})).toEqual(expected);
  });

  it('getMissingMonth (giữ nguyên chữ ký theo tháng): tháng tương lai xa -> mọi dự án đang triển khai chưa nhập số', async () => {
    const projects = await repo.listProjects();
    const expected = projects
      .filter((p) => deriveStatus({ actualStartDate: p.actualStartDate, actualFinishDate: p.actualFinishDate, pctActual: 0 }) === 'Dang_trien_khai')
      .map((p) => ({ id: p.id, projectName: p.projectName, code: p.currentAliasCode }));
    expect(await NewQ.getMissingMonth('2030-01')).toEqual(expected);
  });
});
