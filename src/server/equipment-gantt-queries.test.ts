import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getEquipmentGantt } from './equipment-gantt-queries';

const NO_WORK_ITEM = 'Chưa gán';

describe('getEquipmentGantt', () => {
  it('du an 1 -> 3 hang (P3C-A: dot khong danh so, unitNo null -> K9 gop 1 hang/thiet bi)', async () => {
    const model = await getEquipmentGantt(1, NO_WORK_ITEM);
    expect(model).not.toBeNull();
    expect(model!.rows).toHaveLength(3);
    expect(model!.rows.map((r) => r.key).sort()).toEqual(['1-0', '2-0', '3-0']);
  });

  it('du an 17 (khong co ke hoach thiet bi) -> null', async () => {
    const model = await getEquipmentGantt(17, NO_WORK_ITEM);
    expect(model).toBeNull();
  });

  it('ngay dung truoc plan dau van tinh vao unplannedUsage, truc from/to khong doi', async () => {
    const plans = [
      {
        id: 1, projectId: 1, equipmentId: 1, unitNo: 1, qty: 1, workItemId: null,
        plannedStart: '2026-01-10', plannedFinish: '2026-01-20',
        note: '', updatedAt: '2026-01-01', updatedBy: 'test',
      },
    ];
    // Mo phong hanh vi loc theo from/to that su cua repo: chi tra dong nam trong [from, to] duoc goi.
    const fixture = [
      { equipmentId: 1, workDate: '2026-01-05', qtyActual: 2 }, // truoc plannedStart 5 ngay
      { equipmentId: 1, workDate: '2026-01-15', qtyActual: 1 }, // trong khoang plan
    ];
    vi.spyOn(repo, 'readEquipmentPlans').mockResolvedValueOnce(plans);
    const usageSpy = vi
      .spyOn(repo, 'readEquipmentUsageDays')
      .mockImplementationOnce(async (_projectId, from, to) => fixture.filter((r) => r.workDate >= from && r.workDate <= to));
    vi.spyOn(repo, 'getEquipments').mockResolvedValueOnce([{ id: 1, name: 'May xuc', unit: 'chiec', isActive: true }]);
    vi.spyOn(repo, 'getWorkItems').mockResolvedValueOnce([]);

    const model = await getEquipmentGantt(1, NO_WORK_ITEM);
    expect(model).not.toBeNull();
    // 2 ngay-thiet-bi truoc plan dau khong gan duoc vao bar nao -> unplannedUsage = 2.
    expect(model!.unplannedUsage).toBe(2);
    // Truc Gantt van dung tu plan, khong bi keo rong theo usage ngoai khoang.
    expect(model!.planFrom).toBe('2026-01-10');
    expect(model!.planTo).toBe('2026-01-20');

    const [, from, to] = usageSpy.mock.calls[0];
    expect(from <= '2026-01-05').toBe(true);
    expect(to >= '2026-01-20').toBe(true);
  });
});
