import { describe, expect, it, vi } from 'vitest';

// Stub repo riêng (fixture) - số liệu kiểm chứng được bằng tay, không dùng seed mock-repo.
vi.mock('@/server/repo', async () => {
  const fx = await import('./queries-period.fixture');
  return { repo: fx.repo };
});

import type { Period } from '@/lib/period';
import {
  getCapacityData, getPortfolioKpis, getPortfolioSCurve, getProjectCounts, getProjectSummaries, getSpiCpiTrend,
  getStatusBreakdown, getTonnageValueByGroup, type ProjectSummary,
} from './queries';
import { TEAM_NAME } from './queries-period.fixture';

const per = (from: string, to: string): Period => ({ from, to });
const byName = (rows: ProjectSummary[], name: string) => rows.find((r) => r.projectName === name);

/**
 * P4 (Task B1) - mỗi ca ghi mã lỗi (L-1..L-5, F-1, F-2) của bản kế hoạch.
 * Chữ ký mới: mọi hàm nhận `Period` thay cho `yearMonth: string`.
 */
describe('P4 L-1: số tính đúng tại mốc cuối kỳ (không tính theo "hôm nay")', () => {
  it('L-1a: kỳ 2026-03, %KH của A tính tại 2026-03-31 (89/364), onTrack = true', async () => {
    const rows = await getProjectSummaries(per('2026-03-01', '2026-03-31'));
    const a = byName(rows, 'A')!;
    expect(a.pctPlan).toBeCloseTo(89 / 364, 3);
    expect(a.onTrack).toBe(true);
  });

  it('L-1b: kỳ 2026-03, nguy cơ phạt của A tính tại mốc (còn 193 ngày) nên là none', async () => {
    const a = byName(await getProjectSummaries(per('2026-03-01', '2026-03-31')), 'A')!;
    expect(a.penalty).toBe('none');
  });

  it('L-1c: kỳ 2026-06..07, B đã hoàn thành trước mốc: Hoan_thanh, mang số 06 (completed)', async () => {
    const b = byName(await getProjectSummaries(per('2026-06-01', '2026-07-31')), 'B')!;
    expect(b.status).toBe('Hoan_thanh');
    expect(b.pctActual).toBe(1);
    expect(b.dataState).toEqual({ kind: 'completed', month: '2026-06' });
  });

  it('L-1d: kỳ 2026-03, ngày kết thúc thực tế của B (06-20) sau mốc nên B chưa hoàn thành', async () => {
    const b = byName(await getProjectSummaries(per('2026-03-01', '2026-03-31')), 'B')!;
    expect(b.status).toBe('Dang_trien_khai');
  });
});

describe('P4 L-2: SPI/CPI danh mục là tỷ số có trọng số, không phải trung bình cộng', () => {
  it('L-2: tháng 2026-06 spi = (40+5)/(40+10) = 0.9, cpi = 45/52 = 0.87', async () => {
    const trend = await getSpiCpiTrend(per('2026-06-01', '2026-06-30'));
    expect(trend).toHaveLength(1);
    expect(trend[0].month).toBe('2026-06');
    expect(trend[0].spi).toBe(0.9);
    expect(trend[0].cpi).toBe(0.87);
  });
});

describe('P4 L-3: dự án thiếu số tháng thì mang số tháng trước, không tụt về 0', () => {
  it('L-3a: kỳ 2026-08, A không có số 08 nên dùng số 07 (pct 0.45, carried)', async () => {
    const a = byName(await getProjectSummaries(per('2026-08-01', '2026-08-31')), 'A')!;
    expect(a.pctActual).toBe(0.45);
    expect(a.dataState).toEqual({ kind: 'carried', month: '2026-07' });
  });

  it('L-3b: delta KPI (so kỳ trước cùng độ dài) không nhảy giả khi thiếu số tháng', async () => {
    const kpis = await getPortfolioKpis(per('2026-08-01', '2026-08-31'));
    expect(kpis.delta.projectsInPeriod).toBe(0);
    expect(kpis.delta.behindSchedule).toBe(0);
    expect(kpis.behindSchedule).toBe(1);
  });

  it('L-3c: kỳ trước chưa có dòng fact nào tới mốc kỳ trước thì delta = null (không bịa)', async () => {
    const kpis = await getPortfolioKpis(per('2026-02-01', '2026-02-28'));
    expect(kpis.delta.projectsInPeriod).toBeNull();
    expect(kpis.delta.behindSchedule).toBeNull();
  });
});

describe('P4 L-4: không còn "Tất cả" (trộn tháng mới nhất của từng dự án), số phát sinh cộng theo kỳ', () => {
  it('L-4: doanh thu nhóm kỳ 2026-06-15..07-10 = A 12 (5+7) + B 3 = 15', async () => {
    const groups = await getTonnageValueByGroup(per('2026-06-15', '2026-07-10'), 'team');
    expect(groups).toEqual([{ key: TEAM_NAME, tonnage: 160, value: 15 }]);
  });

  it('L-4: KPI doanh thu và sản lượng trong kỳ là số cộng dồn các tháng của kỳ', async () => {
    const kpis = await getPortfolioKpis(per('2026-06-15', '2026-07-10'));
    expect(kpis.revenueInPeriod).toBe(15);
    expect(kpis.tonnageInPeriod).toBe(160);
    expect(kpis.months).toEqual(['2026-06', '2026-07']);
    expect(kpis.asOfDate).toBe('2026-07-10');
  });
});

describe('P4 L-5: "Dự án trong kỳ" chỉ đếm dự án có hoạt động giao với kỳ', () => {
  it('L-5: kỳ 2026-08 chỉ có A (B kết thúc 06-20, C khởi công 11/2026 bị loại)', async () => {
    const kpis = await getPortfolioKpis(per('2026-08-01', '2026-08-31'));
    expect(kpis.projectsInPeriod).toBe(1);
    const rows = await getProjectSummaries(per('2026-08-01', '2026-08-31'));
    expect(rows.map((r) => r.projectName)).toEqual(['A']);
  });

  it('HĐ chưa khởi công (Q3 = a): không phụ thuộc kỳ, C đã ký 08-01 và chưa khởi công nên tính 50', async () => {
    const kpis = await getPortfolioKpis(per('2026-08-01', '2026-08-31'));
    expect(kpis.notStartedValue).toBe(50);
  });

  it('HĐ chưa khởi công: HĐ ký sau cuối kỳ thì chưa tính', async () => {
    const kpis = await getPortfolioKpis(per('2026-07-01', '2026-07-31'));
    expect(kpis.notStartedValue).toBe(0);
  });

  it('cơ cấu trạng thái đếm đúng dự án trong kỳ', async () => {
    expect(await getStatusBreakdown(per('2026-08-01', '2026-08-31'))).toEqual([{ status: 'Dang_trien_khai', value: 1 }]);
  });
});

describe('P4 F-1: bộ lọc trạng thái áp cho cả biểu đồ xu hướng', () => {
  it('F-1: lọc Hoan_thanh kỳ 06..07: KPI chỉ có B, S-curve chỉ cộng B (PV 06 = 10, PV 07 = 10 mang số)', async () => {
    const period = per('2026-06-01', '2026-07-31');
    const filters = { status: 'Hoan_thanh' as const };
    const kpis = await getPortfolioKpis(period, filters);
    expect(kpis.projectsInPeriod).toBe(1);
    const curve = await getPortfolioSCurve(period, filters);
    expect(curve.map((p) => [p.month, p.pv, p.carriedProjects])).toEqual([['2026-06', 10, 0], ['2026-07', 10, 1]]);
  });
});

describe('P4 F-2: biểu đồ chạy theo các tháng của kỳ, không cố định 12 tháng', () => {
  it('F-2: S-curve kỳ 06..08 có đúng 3 tháng, PV 08 = 50 (A số 07) + 10 (B số 06) = 60, carriedProjects 0/1/2', async () => {
    const curve = await getPortfolioSCurve(per('2026-06-01', '2026-08-31'));
    expect(curve.map((p) => p.month)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(curve.map((p) => p.carriedProjects)).toEqual([0, 1, 2]);
    expect(curve[2].pv).toBe(60);
  });

  it('F-2: SPI/CPI cũng theo các tháng của kỳ', async () => {
    const trend = await getSpiCpiTrend(per('2026-06-01', '2026-08-31'));
    expect(trend.map((p) => p.month)).toEqual(['2026-06', '2026-07', '2026-08']);
  });
});

describe('P4 công suất theo kỳ', () => {
  it('kỳ 3 tháng: công suất = 1200/12 x 3 = 300', async () => {
    const rows = await getCapacityData(per('2026-06-01', '2026-08-31'));
    expect(rows).toHaveLength(1);
    expect(rows[0].capacity).toBe(300);
    expect(rows[0].processed).toBe(160);
    expect(rows[0].warn).toBe(false);
  });
});

describe('P4 C1: đếm "n / total dự án" cho thanh lọc', () => {
  it('total = dự án thuộc kỳ không lọc chiều nào, count = sau lọc', async () => {
    const period = per('2026-06-01', '2026-07-31');
    const all = await getProjectCounts(period, {});
    expect(all.count).toBe(all.total);
    const filtered = await getProjectCounts(period, { status: 'Hoan_thanh' });
    expect(filtered.total).toBe(all.total);
    expect(filtered.count).toBe(1);
  });
});
