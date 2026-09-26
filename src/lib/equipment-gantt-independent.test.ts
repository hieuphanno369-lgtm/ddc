import { describe, expect, it } from 'vitest';
import type { EquipmentUsageDay } from '@/server/repo/read-types';
import type { ProjectEquipmentPlan } from '@/server/repo/types';
import { assignUsage, buildGantt } from './equipment-gantt';

/**
 * Kiểm tra ĐỘC LẬP (Q1 b) của tester - bổ sung các góc coder chưa kiểm trong
 * `equipment-gantt.test.ts`: thứ tự `unitNo` không phụ thuộc thứ tự mảng plans đầu vào, biên
 * ngày plannedStart/plannedFinish (bao gồm hai đầu mút), qtyActual = 0, nhiều nhóm thiết bị trong
 * cùng 1 lần gọi, và 1 trường hợp "phải sai" (ngày lệch 1 khỏi biên không được gán).
 */

function plan(overrides: Partial<ProjectEquipmentPlan>): ProjectEquipmentPlan {
  return {
    id: 1, projectId: 1, equipmentId: 1, unitNo: 1, qty: 1, workItemId: 1,
    plannedStart: '2026-09-01', plannedFinish: '2026-09-10',
    note: '', updatedAt: '2026-09-01T00:00:00Z', updatedBy: 'system',
    ...overrides,
  };
}

describe('assignUsage (doc lap) - N chiec dau theo unitNo tang dan', () => {
  it('plans truyen vao KHONG theo thu tu unitNo (3, 1, 2) - N=2 van chon unitNo 1 va 2, khong phai 3', () => {
    const plans = [
      plan({ id: 30, unitNo: 3, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
      plan({ id: 10, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
      plan({ id: 20, unitNo: 2, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
    ];
    const usage: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-05', qtyActual: 2 }];
    const { byPlan, unplanned } = assignUsage(plans, usage);
    expect(byPlan.get(10)).toEqual(['2026-09-05']);
    expect(byPlan.get(20)).toEqual(['2026-09-05']);
    expect(byPlan.has(30)).toBe(false);
    expect(unplanned).toBe(0);
  });

  it('ngay dung bang dung plannedStart va plannedFinish (bao gom hai dau mut) -> van gan', () => {
    const plans = [plan({ id: 1, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' })];
    const usageStart: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-01', qtyActual: 1 }];
    const usageFinish: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-10', qtyActual: 1 }];
    expect(assignUsage(plans, usageStart).byPlan.get(1)).toEqual(['2026-09-01']);
    expect(assignUsage(plans, usageFinish).byPlan.get(1)).toEqual(['2026-09-10']);
  });

  it('SAD PATH: ngay le 1 ngoai bien (truoc plannedStart 1 ngay) -> KHONG duoc gan, tang unplanned', () => {
    const plans = [plan({ id: 1, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' })];
    const usage: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-08-31', qtyActual: 1 }];
    const { byPlan, unplanned } = assignUsage(plans, usage);
    expect(byPlan.has(1)).toBe(false);
    expect(unplanned).toBe(1);
    // Neu code lech logic va gan nham (vd dung >= thay vi so sanh chuoi ISO dung), assertion nay se bat duoc.
    expect(byPlan.get(1)).not.toEqual(['2026-08-31']);
  });

  it('qtyActual = 0 -> khong gan gi, khong cong vao unplanned', () => {
    const plans = [plan({ id: 1, unitNo: 1 })];
    const usage: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-05', qtyActual: 0 }];
    const { byPlan, unplanned } = assignUsage(plans, usage);
    expect(byPlan.size).toBe(0);
    expect(unplanned).toBe(0);
  });

  it('2 nhom thiet bi khac nhau trong cung 1 lan goi - khong lam lan chieu nhau', () => {
    const plans = [
      plan({ id: 1, equipmentId: 1, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
      plan({ id: 2, equipmentId: 2, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
    ];
    const usage: EquipmentUsageDay[] = [
      { equipmentId: 1, workDate: '2026-09-05', qtyActual: 1 },
      { equipmentId: 2, workDate: '2026-09-05', qtyActual: 1 },
    ];
    const { byPlan, unplanned } = assignUsage(plans, usage);
    expect(byPlan.get(1)).toEqual(['2026-09-05']);
    expect(byPlan.get(2)).toEqual(['2026-09-05']);
    expect(unplanned).toBe(0);
  });

  it('nhieu ngay dung cong don cho cung 1 chiec -> usedDays tang dan, khong trung', () => {
    const plans = [plan({ id: 1, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' })];
    const usage: EquipmentUsageDay[] = [
      { equipmentId: 1, workDate: '2026-09-07', qtyActual: 1 },
      { equipmentId: 1, workDate: '2026-09-02', qtyActual: 1 },
    ];
    const { byPlan } = assignUsage(plans, usage);
    expect(byPlan.get(1)).toEqual(['2026-09-02', '2026-09-07']);
  });
});

describe('buildGantt (doc lap) - lien ket assignUsage vao usedDays cua dung thanh', () => {
  it('2 plan cung chiec KHONG chong ngay (lien tiep) - usage roi vao dung thanh theo khoang ngay', () => {
    const plans = [
      plan({ id: 1, unitNo: 1, plannedStart: '2026-08-01', plannedFinish: '2026-08-15' }),
      plan({ id: 2, unitNo: 1, plannedStart: '2026-08-16', plannedFinish: '2026-08-31' }),
    ];
    const usage: EquipmentUsageDay[] = [
      { equipmentId: 1, workDate: '2026-08-10', qtyActual: 1 },
      { equipmentId: 1, workDate: '2026-08-20', qtyActual: 1 },
    ];
    const model = buildGantt({ plans, usage, equipments: [], workItems: [], noWorkItemName: 'x' })!;
    const bar1 = model.rows[0].bars.find((b) => b.planId === 1)!;
    const bar2 = model.rows[0].bars.find((b) => b.planId === 2)!;
    expect(bar1.usedDays).toEqual(['2026-08-10']);
    expect(bar2.usedDays).toEqual(['2026-08-20']);
  });
});
