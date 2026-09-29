import { describe, expect, it, vi } from 'vitest';

// Cùng fixture với queries-period.test.ts (số kiểm chứng được bằng tay). Đồng hồ ghim DDC_FAKE_TODAY = 2026-09-16.
vi.mock('@/server/repo', async () => {
  const fx = await import('./queries-period.fixture');
  return { repo: fx.repo };
});

import type { Period } from '@/lib/period';
import {
  getCapacityData, getPortfolioKpis, getPortfolioSCurve, getProjectCounts, getProjectSummaries, getSpiCpiTrend,
  getStatusBreakdown, getTonnageValueByGroup, type ProjectSummary,
} from './queries';

const per = (from: string, to: string): Period => ({ from, to });
const byName = (rows: ProjectSummary[], name: string) => rows.find((r) => r.projectName === name);

/**
 * P4 tester - các trường hợp biên của mục 4 kế hoạch mà queries-period.test.ts (B1) chưa phủ:
 * kỳ cắt ngang tháng, kỳ trống số, dự án bắt đầu/kết thúc giữa kỳ, không mang số từ tương lai về quá khứ,
 * kỳ nằm hẳn trong tương lai, kỳ 1 ngày.
 * Fixture: A có số 03, 06, 07, 09 (thiếu 08); B có số 03, 06 và kết thúc 06-20; C chưa khởi công (HĐ 08-01).
 */
describe('P4 biên: kỳ cắt ngang tháng (15/06 - 10/08)', () => {
  const period = per('2026-06-15', '2026-08-10');

  it('KPI: mốc = 10/08, tháng tính trọn 06, 07, 08', async () => {
    const kpis = await getPortfolioKpis(period);
    expect(kpis.asOfDate).toBe('2026-08-10');
    expect(kpis.months).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('S-curve có đúng 3 tháng trọn; PV 06 = 40 + 10, 07 = 50 + 10 (B mang số 06), 08 = 50 + 10 (A mang số 07)', async () => {
    const curve = await getPortfolioSCurve(period);
    expect(curve.map((p) => [p.month, p.pv])).toEqual([['2026-06', 50], ['2026-07', 60], ['2026-08', 60]]);
  });

  it('doanh thu trong kỳ tính trọn tháng 06 và 07 (A 5 + 7, B 3 = 15), không cắt theo ngày', async () => {
    const kpis = await getPortfolioKpis(period);
    expect(kpis.revenueInPeriod).toBe(15);
  });

  it('dự án thuộc kỳ: A và B (B kết thúc 06-20 sau ngày đầu kỳ), C (khởi công 11/2026) bị loại', async () => {
    const rows = await getProjectSummaries(period);
    expect(rows.map((r) => r.projectName).sort()).toEqual(['A', 'B']);
  });
});

describe('P4 biên: kỳ trống số (không dự án nào có số <= mốc)', () => {
  const period = per('2026-01-01', '2026-02-28');

  it('không ném lỗi, KPI phát sinh = 0, mọi delta = null (không bịa số so sánh)', async () => {
    const kpis = await getPortfolioKpis(period);
    expect(kpis.revenueInPeriod).toBe(0);
    expect(kpis.tonnageInPeriod).toBe(0);
    expect(Object.values(kpis.delta).every((d) => d === null)).toBe(true);
  });

  it('trục tháng vẫn đủ 2 tháng, giá trị 0, không dự án nào "mang số"', async () => {
    const curve = await getPortfolioSCurve(period);
    expect(curve.map((p) => p.month)).toEqual(['2026-01', '2026-02']);
    for (const p of curve) {
      expect([p.pv, p.ev, p.ac]).toEqual([0, 0, 0]);
      expect(p.carriedProjects).toBe(0);
    }
  });

  it('SPI/CPI là null (không chia cho 0), trục đủ tháng', async () => {
    const trend = await getSpiCpiTrend(period);
    expect(trend.map((p) => [p.month, p.spi, p.cpi])).toEqual([['2026-01', null, null], ['2026-02', null, null]]);
  });

  it('dự án chưa có số hiện dataState none, %TT = 0, không NaN', async () => {
    const rows = await getProjectSummaries(period);
    const a = byName(rows, 'A')!;
    expect(a.dataState.kind).toBe('none');
    expect(Number.isFinite(a.pctActual)).toBe(true);
    expect(Number.isFinite(a.pctPlan)).toBe(true);
  });
});

describe('P4 biên: dự án bắt đầu giữa kỳ, không mang số từ tương lai về quá khứ', () => {
  const period = per('2026-01-01', '2026-04-30');

  it('tháng trước tháng có số đầu tiên (01, 02) là 0 dù tháng 03 có số; tháng 03 dùng số thật; 04 mang số 03', async () => {
    const curve = await getPortfolioSCurve(period);
    expect(curve.map((p) => [p.month, p.pv, p.carriedProjects])).toEqual([
      ['2026-01', 0, 0], ['2026-02', 0, 0], ['2026-03', 25, 0], ['2026-04', 25, 2],
    ]);
  });

  it('SPI/CPI: 01 và 02 là null, 03 có số (không lấy số 03 đưa ngược về 01)', async () => {
    const trend = await getSpiCpiTrend(period);
    expect(trend.map((p) => p.spi === null)).toEqual([true, true, false, false]);
  });

  it('kỳ chỉ tới 02: A và B chưa có số nào, %TT = 0 và dataState none (không lấy số 03)', async () => {
    const a = byName(await getProjectSummaries(per('2026-01-01', '2026-02-28')), 'A')!;
    expect(a.pctActual).toBe(0);
    expect(a.dataState.kind).toBe('none');
  });
});

describe('P4 biên: dự án kết thúc giữa kỳ', () => {
  const period = per('2026-06-01', '2026-08-31');

  it('B vẫn thuộc kỳ, Hoan_thanh, %TT giữ 100% (mang số 06), nhãn completed tháng 06', async () => {
    const b = byName(await getProjectSummaries(period), 'B')!;
    expect(b).toBeDefined();
    expect(b.status).toBe('Hoan_thanh');
    expect(b.pctActual).toBe(1);
    expect(b.dataState).toEqual({ kind: 'completed', month: '2026-06' });
  });

  it('kỳ bắt đầu SAU ngày kết thúc (07-01..08-31): B rời khỏi kỳ, không còn tính vào Dự án trong kỳ', async () => {
    const rows = await getProjectSummaries(per('2026-07-01', '2026-08-31'));
    expect(rows.map((r) => r.projectName)).toEqual(['A']);
  });

  it('ngày kết thúc đúng bằng ngày đầu kỳ (06-20) vẫn giao kỳ, đúng bằng ngày trước đầu kỳ (06-21) thì không', async () => {
    expect((await getProjectSummaries(per('2026-06-20', '2026-06-30'))).map((r) => r.projectName)).toContain('B');
    expect((await getProjectSummaries(per('2026-06-21', '2026-06-30'))).map((r) => r.projectName)).not.toContain('B');
  });
});

describe('P4 biên: kỳ nằm hẳn trong tương lai (from > hôm nay 2026-09-16)', () => {
  const period = per('2026-11-01', '2026-12-31');

  it('mốc = hôm nay, số phát sinh = 0 (không bịa số tương lai), không ném lỗi', async () => {
    const kpis = await getPortfolioKpis(period);
    expect(kpis.asOfDate).toBe('2026-09-16');
    expect(kpis.revenueInPeriod).toBe(0);
    expect(kpis.tonnageInPeriod).toBe(0);
  });

  it('chart không vẽ tháng chưa tới: không có điểm nào sau tháng của hôm nay (2026-09)', async () => {
    const curve = await getPortfolioSCurve(period);
    const trend = await getSpiCpiTrend(period);
    for (const p of [...curve, ...trend]) expect(p.month <= '2026-09').toBe(true);
  });

  it('sản lượng theo nhóm và công suất không ném lỗi, đều là số hữu hạn', async () => {
    const groups = await getTonnageValueByGroup(period, 'team');
    const cap = await getCapacityData(period);
    for (const g of groups) expect(Number.isFinite(g.tonnage) && Number.isFinite(g.value)).toBe(true);
    for (const c of cap) expect(Number.isFinite(c.capacity) && Number.isFinite(c.processed)).toBe(true);
  });
});

describe('P4 biên: kỳ 1 ngày và kỳ đảo', () => {
  it('kỳ 1 ngày 2026-07-15: 1 tháng trọn (07), mốc = 07-15, S-curve 1 điểm chỉ có A (B đã kết thúc 06-20) nên PV = 50', async () => {
    const period = per('2026-07-15', '2026-07-15');
    const kpis = await getPortfolioKpis(period);
    expect(kpis.months).toEqual(['2026-07']);
    expect(kpis.asOfDate).toBe('2026-07-15');
    const curve = await getPortfolioSCurve(period);
    expect(curve.map((p) => [p.month, p.pv])).toEqual([['2026-07', 50]]);
  });

  it('bộ lọc không khớp dự án nào: mọi hàm trả rỗng/0 và không ném lỗi', async () => {
    const period = per('2026-06-01', '2026-08-31');
    const filters = { status: 'Tam_dung' as const };
    expect((await getProjectSummaries(period, filters))).toEqual([]);
    expect((await getPortfolioKpis(period, filters)).projectsInPeriod).toBe(0);
    expect((await getStatusBreakdown(period, filters))).toEqual([]);
    expect((await getProjectCounts(period, filters)).count).toBe(0);
    const trend = await getSpiCpiTrend(period, filters);
    expect(trend.every((p) => p.spi === null && p.cpi === null)).toBe(true);
  });
});
