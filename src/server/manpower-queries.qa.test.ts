import { describe, expect, it, vi } from 'vitest';

/**
 * Test doc lap (Tester) cho getManpowerMonthChartData - Buoc 11.
 * Bo sung cac truong hop bien T5 ma manpower-queries.test.ts (coder) chua phu o TANG QUERY
 * (tich hop voi repo that qua vi.spyOn), khac voi manpower-month-chart.test.ts (chi test ham
 * thuan buildManpowerMonthModel, khong qua repo/locale).
 */

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getManpowerMonthChartData } from './manpower-queries';

describe('getManpowerMonthChartData - duong chay thuan loi', () => {
  it('du an 1 that, locale en: ten ca lay tu dim_shift.nameEn', async () => {
    const model = await getManpowerMonthChartData(1, 'en');
    expect(model).not.toBeNull();
    const morning = model!.shifts.find((s) => s.code === 'morning');
    expect(morning?.name).toBe('Morning');
  });
});

describe('getManpowerMonthChartData - truong hop bien (T5)', () => {
  it('khong co KH va khong co TT -> null', async () => {
    vi.spyOn(repo, 'readManpowerPlanMonths').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readShiftRatios').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readManpowerActualByMonth').mockResolvedValueOnce([]);
    const model = await getManpowerMonthChartData(999, 'vi');
    expect(model).toBeNull();
  });

  it('ma ca la (khong co trong dim_shift) o tang repo that -> khong nem loi, hien ma ca lam ten, xep cuoi', async () => {
    vi.spyOn(repo, 'readManpowerPlanMonths').mockResolvedValueOnce([
      { yearMonth: '2026-03', shiftCode: 'night', planned: 10, isManual: false },
      { yearMonth: '2026-03', shiftCode: 'morning', planned: 20, isManual: false },
    ]);
    vi.spyOn(repo, 'readShiftRatios').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readManpowerActualByMonth').mockResolvedValueOnce([]);
    const model = await getManpowerMonthChartData(999, 'vi');
    expect(model).not.toBeNull();
    expect(model!.shifts.at(-1)!.code).toBe('night');
    expect(model!.shifts.at(-1)!.name).toBe('night');
  });

  it('thang thieu giua dai o du lieu that tra ve tu repo (gian doan giua thang co KH) -> van co du dai, thang giua hasPlan false', async () => {
    vi.spyOn(repo, 'readManpowerPlanMonths').mockResolvedValueOnce([
      { yearMonth: '2026-01', shiftCode: 'morning', planned: 100, isManual: false },
      { yearMonth: '2026-03', shiftCode: 'morning', planned: 200, isManual: false },
    ]);
    vi.spyOn(repo, 'readShiftRatios').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readManpowerActualByMonth').mockResolvedValueOnce([]);
    const model = await getManpowerMonthChartData(999, 'vi');
    expect(model!.months.map((m) => m.yearMonth)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(model!.months.find((m) => m.yearMonth === '2026-02')!.hasPlan).toBe(false);
    expect(model!.months.find((m) => m.yearMonth === '2026-02')!.plannedTotal).toBe(0);
  });

  it('du an co TT nhung khong co KH (thang truoc khi co ke hoach) -> van tra model, khong null', async () => {
    vi.spyOn(repo, 'readManpowerPlanMonths').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readShiftRatios').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readManpowerActualByMonth').mockResolvedValueOnce([
      { yearMonth: '2026-02', actualSum: 500, days: 5 },
    ]);
    const model = await getManpowerMonthChartData(999, 'vi');
    expect(model).not.toBeNull();
    expect(model!.months).toHaveLength(1);
    expect(model!.months[0].hasPlan).toBe(false);
    expect(model!.months[0].actualAvg).toBe(100);
  });

  it('du an 17 (khong co du lieu that trong repo) -> null', async () => {
    vi.restoreAllMocks();
    const model = await getManpowerMonthChartData(17, 'vi');
    expect(model).toBeNull();
  });
});
