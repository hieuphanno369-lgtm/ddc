import { describe, expect, it, vi } from 'vitest';

// getOverdueScorecard đọc qua barrel '@/server/repo', mặc định trỏ prisma-repo (Postgres thật).
// Mock về mock-repo cho test nhanh, xác định, giống mọi test khác trong repo (queries.test.ts:5-8).
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { prevMonth } from '@/lib/clock';
import { getOverdueScorecard } from './overdue-scorecard';

const MONTH = '2026-09';

describe('getOverdueScorecard - đường chạy thuận lợi', () => {
  it('tháng hợp lệ: value khớp tổng tay từ getFinancialForMonth (không lọc status)', async () => {
    const r = await getOverdueScorecard(MONTH, {});
    const expected = (await repo.getFinancialForMonth(MONTH)).reduce((sum, f) => sum + f.arOverdue, 0);
    expect(r.value).toBe(expected);
  });

  it('delta = value(tháng) - value(prevMonth), khớp oracle', async () => {
    const r = await getOverdueScorecard(MONTH, {});
    const prevExpected = (await repo.getFinancialForMonth(prevMonth(MONTH))).reduce((sum, f) => sum + f.arOverdue, 0);
    const curExpected = (await repo.getFinancialForMonth(MONTH)).reduce((sum, f) => sum + f.arOverdue, 0);
    expect(r.delta).toBe(Math.round((curExpected - prevExpected) * 10) / 10);
  });

  it('filter theo team: chỉ cộng dự án của team đó', async () => {
    const projects = await repo.listProjects();
    const teamId = projects[0].teamKdId;
    const r = await getOverdueScorecard(MONTH, { teamKdId: teamId });
    const scopedIds = new Set(projects.filter((p) => p.teamKdId === teamId).map((p) => p.id));
    const expected = (await repo.getFinancialForMonth(MONTH))
      .filter((f) => scopedIds.has(f.projectId))
      .reduce((sum, f) => sum + f.arOverdue, 0);
    expect(r.value).toBe(expected);
  });
});

describe('getOverdueScorecard - biên', () => {
  it("month='all' -> delta null (không có tháng liền trước hợp lệ)", async () => {
    const r = await getOverdueScorecard('all', {});
    expect(r.delta).toBeNull();
  });

  it('tháng rác -> delta null', async () => {
    const r = await getOverdueScorecard('abc', {});
    expect(r.delta).toBeNull();
  });

  it('tháng trước cửa sổ dữ liệu (2020-01) -> value 0, delta null (chưa có dòng tài chính nào)', async () => {
    const r = await getOverdueScorecard('2020-01', {});
    expect(r.value).toBe(0);
    expect(r.delta).toBeNull();
  });
});
