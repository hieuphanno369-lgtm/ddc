import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { getEquipmentPlanGantt } from './equipment-plan-gantt-queries';

const TODAY = '2026-09-16';

describe('getEquipmentPlanGantt', () => {
  it('du an 1: co >= 3 loai thiet bi, 1 loai keo dai qua 3 thang -> truc thang', async () => {
    const model = await getEquipmentPlanGantt(1, TODAY);
    expect(model).not.toBeNull();
    expect(model!.rows.length).toBeGreaterThanOrEqual(3);
    expect(model!.axis.mode).toBe('month');
  });

  it('du an 17 (khong ton tai): khong co dot nao -> null', async () => {
    const model = await getEquipmentPlanGantt(17, TODAY);
    expect(model).toBeNull();
  });
});
