import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getManpowerMonthChartData, getWeeklyChartData } from './manpower-queries';

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

  it('nha thau co so lieu nhung getContractors thieu (vd bi tat) -> van hien, ten fallback #<id>', async () => {
    const project = (await repo.getProject(1))!;
    const rows = await repo.readManpowerWeekly(1);
    const contractorIds = [...new Set(rows.map((r) => r.contractorId))];
    expect(contractorIds.length).toBeGreaterThan(0);
    const missingId = contractorIds[0];
    const allContractors = await repo.getContractors();
    vi.spyOn(repo, 'getContractors').mockResolvedValueOnce(allContractors.filter((c) => c.id !== missingId));

    const data = await getWeeklyChartData(1, project);
    expect(data).not.toBeNull();
    expect(new Set(data!.contractors.map((c) => c.id))).toEqual(new Set(contractorIds));
    expect(data!.contractors.find((c) => c.id === missingId)?.name).toBe(`#${missingId}`);
  });
});

describe('getManpowerMonthChartData', () => {
  it('du an 1: >= 7 thang, ten ca lay tu dim_shift theo locale vi', async () => {
    const model = await getManpowerMonthChartData(1, 'vi');
    expect(model).not.toBeNull();
    expect(model!.months.length).toBeGreaterThanOrEqual(7);
    const morning = model!.shifts.find((s) => s.code === 'morning');
    expect(morning?.name).toBe('Ca sáng');
  });

  it('du an 17 (khong ton tai): khong co KH lan TT -> null', async () => {
    const model = await getManpowerMonthChartData(17, 'vi');
    expect(model).toBeNull();
  });
});
