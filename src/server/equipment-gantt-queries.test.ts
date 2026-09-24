import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { getEquipmentGantt } from './equipment-gantt-queries';

const NO_WORK_ITEM = 'Chưa gán';

describe('getEquipmentGantt', () => {
  it('du an 1 -> 5 hang (thiet bi 1 No.1..3, thiet bi 2 No.1..2)', async () => {
    const model = await getEquipmentGantt(1, NO_WORK_ITEM);
    expect(model).not.toBeNull();
    expect(model!.rows).toHaveLength(5);
    expect(model!.rows.map((r) => r.key).sort()).toEqual(['1-1', '1-2', '1-3', '2-1', '2-2']);
  });

  it('du an 17 (khong co ke hoach thiet bi) -> null', async () => {
    const model = await getEquipmentGantt(17, NO_WORK_ITEM);
    expect(model).toBeNull();
  });
});
