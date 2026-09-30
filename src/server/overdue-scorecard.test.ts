import { describe, expect, it, vi } from 'vitest';

// getOverdueScorecard đọc qua barrel '@/server/repo', mặc định trỏ prisma-repo (Postgres thật).
// Mock về mock-repo cho test nhanh, xác định, giống mọi test khác trong repo (queries.test.ts:5-8).
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { previousPeriod, type Period } from '@/lib/period';
import { getProjectSummaries } from './queries';
import { getOverdueScorecard } from './overdue-scorecard';

// Kỳ trọn tháng 09/2026 (mốc = 2026-09-16 do DDC_FAKE_TODAY), kỳ liền trước cùng độ dài = 2026-08-01..2026-08-31.
const PERIOD: Period = { from: '2026-09-01', to: '2026-09-30' };

/** Oracle độc lập: công nợ quá hạn của các dự án `ids` = dòng tài chính isLatest gần nhất <= ym (đọc bằng repo.getFinancial). */
async function arOverdueAt(ids: Set<number>, ym: string): Promise<number> {
  let sum = 0;
  for (const id of ids) {
    const rows = (await repo.getFinancial(id)).filter((f) => f.yearMonth <= ym);
    if (rows.length) sum += rows[rows.length - 1].arOverdue;
  }
  return sum;
}

const idsOf = async (period: Period, filters = {}) => new Set((await getProjectSummaries(period, filters)).map((s) => s.id));

describe('getOverdueScorecard - đường chạy thuận lợi', () => {
  it('value = Σ công nợ quá hạn tại tháng mốc của dự án thuộc kỳ (không lọc status)', async () => {
    const r = await getOverdueScorecard(PERIOD, {});
    expect(r.value).toBe(await arOverdueAt(await idsOf(PERIOD), '2026-09'));
  });

  it('delta = value(kỳ) - value(kỳ liền trước cùng độ dài), khớp oracle', async () => {
    const r = await getOverdueScorecard(PERIOD, {});
    const prev = previousPeriod(PERIOD);
    const cur = await arOverdueAt(await idsOf(PERIOD), '2026-09');
    const before = await arOverdueAt(await idsOf(prev), '2026-08');
    expect(r.delta).toBe(Math.round((cur - before) * 10) / 10);
  });

  it('filter theo team: chỉ cộng dự án của team đó', async () => {
    const projects = await repo.listProjects();
    const teamId = projects[0].teamKdId;
    const r = await getOverdueScorecard(PERIOD, { teamKdId: teamId });
    const scoped = new Set((await idsOf(PERIOD)).values());
    const teamIds = new Set(projects.filter((p) => p.teamKdId === teamId && scoped.has(p.id)).map((p) => p.id));
    expect(r.value).toBe(await arOverdueAt(teamIds, '2026-09'));
  });

  // Tester (P1B): delta khi có filter team CŨNG dùng phạm vi lọc đó cho cả kỳ trước.
  it('filter theo team: delta tính trên PHẠM VI ĐÃ LỌC cho cả kỳ hiện tại lẫn kỳ trước', async () => {
    const projects = await repo.listProjects();
    const teamId = projects[0].teamKdId;
    const filters = { teamKdId: teamId };
    const r = await getOverdueScorecard(PERIOD, filters);
    const cur = await arOverdueAt(await idsOf(PERIOD, filters), '2026-09');
    const before = await arOverdueAt(await idsOf(previousPeriod(PERIOD), filters), '2026-08');
    expect(r.delta).toBe(Math.round((cur - before) * 10) / 10);
  });

  it('F-1: filter status áp cho công nợ (cùng tập id với KPI)', async () => {
    const r = await getOverdueScorecard(PERIOD, { status: 'Hoan_thanh' });
    const ids = await idsOf(PERIOD, { status: 'Hoan_thanh' });
    expect(r.value).toBe(await arOverdueAt(ids, '2026-09'));
  });
});

describe('getOverdueScorecard - biên', () => {
  it('kỳ mà kỳ liền trước nằm trước cửa sổ dữ liệu -> delta null (không bịa)', async () => {
    const r = await getOverdueScorecard({ from: '2025-10-01', to: '2025-10-31' }, {});
    expect(r.delta).toBeNull();
  });

  it('kỳ trước cửa sổ dữ liệu (2020-01) -> value 0, delta null (chưa có dòng tài chính nào)', async () => {
    const r = await getOverdueScorecard({ from: '2020-01-01', to: '2020-01-31' }, {});
    expect(r.value).toBe(0);
    expect(r.delta).toBeNull();
  });
});
