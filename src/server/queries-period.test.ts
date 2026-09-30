import { describe, expect, it, vi } from 'vitest';

// Stub repo riêng (fixture) - số liệu kiểm chứng được bằng tay, không dùng seed mock-repo.
vi.mock('@/server/repo', async () => {
  const fx = await import('./queries-period.fixture');
  return { repo: fx.repo };
});

import { todayIso } from '@/lib/clock';
import { resolveDetailTime } from '@/lib/detail-time';
import { periodAsOfDate, type Period } from '@/lib/period';
import {
  getCapacityData, getPortfolioKpis, getPortfolioSCurve, getProjectCounts, getProjectSummaries, getSpiCpiTrend,
  getProjectSummary, getStatusBreakdown, getTonnageValueByGroup, type ProjectSummary,
} from './queries';
import { PROJECT_A, PROJECT_B, TEAM_NAME } from './queries-period.fixture';

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

describe('P4 N-4: delta KPI xét theo bộ lọc, không theo cả danh mục', () => {
  it('N-4: lọc nhóm chưa có số nào (C, P3) thì delta = null dù danh mục có số ở kỳ trước', async () => {
    const period = per('2026-08-01', '2026-08-31');
    expect((await getPortfolioKpis(period)).delta.projectsInPeriod).toBe(0);
    const kpis = await getPortfolioKpis(period, { priority: 'P3' });
    expect(Object.values(kpis.delta).every((d) => d === null)).toBe(true);
  });

  it('N-4: lọc nhóm có số ở cả 2 kỳ (A, P1) vẫn có delta', async () => {
    const kpis = await getPortfolioKpis(per('2026-08-01', '2026-08-31'), { priority: 'P1' });
    expect(kpis.delta.projectsInPeriod).toBe(0);
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

describe('P4 N-3: công suất kỳ chỉ nhân số tháng tới mốc, không tính tháng sau hôm nay', () => {
  it('kỳ 06..12 khi hôm nay 2026-09-16: 4 tháng (06..09), công suất = 1200/12 x 4 = 400 (không phải x 7)', async () => {
    const rows = await getCapacityData(per('2026-06-01', '2026-12-31'));
    expect(rows[0].capacity).toBe(400);
    expect(rows[0].processed).toBe(160);
  });

  it('kỳ hoàn toàn ở tương lai: không ném lỗi, công suất 0 và không cảnh báo', async () => {
    const rows = await getCapacityData(per('2027-01-01', '2027-03-31'));
    expect(rows[0].capacity).toBe(0);
    expect(rows[0].warn).toBe(false);
  });

  it('kỳ đã kết thúc trước hôm nay giữ nguyên: 06..08 = 3 tháng', async () => {
    expect((await getCapacityData(per('2026-06-01', '2026-08-31')))[0].capacity).toBe(300);
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

describe('P4 C-3: trang Chi tiết và Tổng quan cùng kỳ cho cùng một số (mốc = min(to, hôm nay))', () => {
  // Kỳ kết thúc giữa tháng: B kết thúc thực tế 06-20 (sau mốc 06-15), nên ở Tổng quan B còn "Đang triển khai".
  const period = per('2026-06-01', '2026-06-15');

  it('C-3: getProjectSummary nhận ngày mốc trần của kỳ, ra cùng trạng thái/%KH/phạt với danh sách', async () => {
    const asOfCap = periodAsOfDate(period, todayIso());
    const list = await getProjectSummaries(period);
    for (const id of [101, 102]) {
      const row = list.find((r) => r.id === id)!;
      const detail = (await getProjectSummary(id, '2026-06', asOfCap))!;
      expect(detail.status, `status #${id}`).toBe(row.status);
      expect(detail.pctPlan, `pctPlan #${id}`).toBe(row.pctPlan);
      expect(detail.penalty, `penalty #${id}`).toBe(row.penalty);
      expect(detail.onTrack, `onTrack #${id}`).toBe(row.onTrack);
    }
    expect((await getProjectSummary(102, '2026-06', asOfCap))!.status).toBe('Dang_trien_khai');
  });

  it('C-3: không truyền trần thì giữ hành vi cũ (min(cuối tháng, hôm nay)): B đã Hoàn thành tại 06-30', async () => {
    expect((await getProjectSummary(102, '2026-06'))!.status).toBe('Hoan_thanh');
  });
});

describe('P4 N-1: Chi tiết mở mặc định cho cùng một số với dòng dự án ở Tổng quan (mốc = tháng hiện tại, mang số)', () => {
  // Hôm nay ghim 2026-09-16. Tổng quan mặc định: kỳ tới hôm nay. B chỉ có số tới 2026-06 nên ở Tổng quan là số mang sang.
  const today = todayIso();
  const factMonths = { 101: ['2026-03', '2026-06', '2026-07', '2026-09'], 102: ['2026-03', '2026-06'] };

  it('N-1: mốc mặc định của Chi tiết dự án đang mang số = tháng hiện tại, và trạng thái/%TT/%KH/phạt/dataState khớp dòng ở Tổng quan', async () => {
    const overviewPeriod = per('2026-01-01', today);
    const list = await getProjectSummaries(overviewPeriod);
    for (const [project, months] of [[PROJECT_A, factMonths[101]], [PROJECT_B, factMonths[102]]] as const) {
      const t = resolveDetailTime({}, project, months, today);
      expect(t.asOfMonth, `mốc #${project.id}`).toBe(today.slice(0, 7));
      const row = list.find((r) => r.id === project.id)!;
      const detail = (await getProjectSummary(project.id, t.asOfMonth, periodAsOfDate(t.period, today)))!;
      expect(detail.status, `status #${project.id}`).toBe(row.status);
      expect(detail.pctActual, `pctActual #${project.id}`).toBe(row.pctActual);
      expect(detail.pctPlan, `pctPlan #${project.id}`).toBe(row.pctPlan);
      expect(detail.penalty, `penalty #${project.id}`).toBe(row.penalty);
      expect(detail.onTrack, `onTrack #${project.id}`).toBe(row.onTrack);
      expect(detail.dataState, `dataState #${project.id}`).toEqual(row.dataState);
    }
  });

  it('N-1: B mang số 2026-06 sang tháng hiện tại; Chi tiết mặc định giữ nhãn mang số (lastDataMonth = 2026-06)', () => {
    const t = resolveDetailTime({}, PROJECT_B, factMonths[102], today);
    expect(t.asOfMonth).toBe('2026-09');
    expect(t.lastDataMonth).toBe('2026-06');
  });
});
