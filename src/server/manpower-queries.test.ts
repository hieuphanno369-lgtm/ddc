import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getShiftChartData } from './manpower-queries';

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
