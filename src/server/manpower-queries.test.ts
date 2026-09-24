import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getShiftChartData, getWeeklyChartData } from './manpower-queries';

describe('getShiftChartData', () => {
  it('du an 1: shifts ten theo locale vi, contractors chi gom nha thau co dong', async () => {
    const data = await getShiftChartData(1, 'vi');
    const morning = data.shifts.find((s) => s.code === 'morning');
    expect(morning?.name).toBe('Ca sáng');

    const rows = await repo.readManpowerByShiftMonth(1);
    const rowContractorIds = new Set(rows.map((r) => r.contractorId));
    expect(new Set(data.contractors.map((c) => c.id))).toEqual(rowContractorIds);
  });

  it('du an 1: shifts ten theo locale en', async () => {
    const data = await getShiftChartData(1, 'en');
    const morning = data.shifts.find((s) => s.code === 'morning');
    expect(morning?.name).toBe('Morning');
  });

  it('du an 17 (khong ton tai): rows rong, contractors rong', async () => {
    const data = await getShiftChartData(17, 'vi');
    expect(data.rows).toEqual([]);
    expect(data.contractors).toEqual([]);
  });
});

describe('getWeeklyChartData', () => {
  it('du an 1: co >=1 tuan, tuan cuoi co so lieu khop tong actual tho (sai so lam tron <= days)', async () => {
    const project = (await repo.getProject(1))!;
    const data = await getWeeklyChartData(1, project);
    expect(data).not.toBeNull();
    expect(data!.weeks.length).toBeGreaterThanOrEqual(1);

    const rows = await repo.readManpowerWeekly(1);
    const weeksWithData = data!.weeks.filter((w) => Object.keys(w.actualByContractor).length > 0);
    const lastWeek = weeksWithData[weeksWithData.length - 1];
    const rawActual = rows.filter((r) => r.weekStart === lastWeek.weekStart).reduce((s, r) => s + r.actual, 0);
    expect(Math.abs(lastWeek.actualAvg * lastWeek.days - rawActual)).toBeLessThanOrEqual(lastWeek.days);
  });

  it('du an 17 (chua co du lieu ngay) -> null', async () => {
    const project = (await repo.getProject(17))!;
    const data = await getWeeklyChartData(17, project);
    expect(data).toBeNull();
  });
});
