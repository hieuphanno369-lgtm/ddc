import { describe, expect, it } from 'vitest';
import { equipmentPlanSeed, equipments, workItemNames } from '@/data/seed/erp';
import type { EquipmentUsageDay } from '@/server/repo/read-types';
import type { ProjectEquipmentPlan } from '@/server/repo/types';
import { assignUsage, buildGantt, type GanttInput } from './equipment-gantt';

const NO_WORK_ITEM = 'Chưa gán';
const SEED_WORK_ITEMS = workItemNames.map((name, i) => ({ id: i + 1, name, sortOrder: i + 1 }));

function plan(overrides: Partial<ProjectEquipmentPlan>): ProjectEquipmentPlan {
  return {
    id: 1, projectId: 1, equipmentId: 1, unitNo: 1, qty: 1, workItemId: 1,
    plannedStart: '2026-09-01', plannedFinish: '2026-09-10',
    note: '', updatedAt: '2026-09-01T00:00:00Z', updatedBy: 'system',
    ...overrides,
  };
}

describe('assignUsage (Q1 b)', () => {
  it('N=3 nhung chi 2 chiec co KH phu ngay do -> gan 2, unplanned += 1', () => {
    const plans = [
      plan({ id: 1, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
      plan({ id: 2, unitNo: 2, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
      plan({ id: 3, unitNo: 3, plannedStart: '2026-10-01', plannedFinish: '2026-10-10' }), // khong phu ngay 09-05
    ];
    const usage: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-05', qtyActual: 3 }];
    const { byPlan, unplanned } = assignUsage(plans, usage);
    expect(byPlan.get(1)).toEqual(['2026-09-05']);
    expect(byPlan.get(2)).toEqual(['2026-09-05']);
    expect(byPlan.has(3)).toBe(false);
    expect(unplanned).toBe(1);
  });

  it('ngay dung khong co KH nao phu -> chi tang unplanned', () => {
    const usage: EquipmentUsageDay[] = [{ equipmentId: 5, workDate: '2026-09-05', qtyActual: 2 }];
    const { byPlan, unplanned } = assignUsage([], usage);
    expect(byPlan.size).toBe(0);
    expect(unplanned).toBe(2);
  });

  it('2 plan cung chiec chong ngay -> gan vao plan id nho hon', () => {
    const plans = [
      plan({ id: 10, unitNo: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-15' }),
      plan({ id: 5, unitNo: 1, plannedStart: '2026-09-03', plannedFinish: '2026-09-20' }),
    ];
    const usage: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-05', qtyActual: 1 }];
    const { byPlan } = assignUsage(plans, usage);
    expect(byPlan.get(5)).toEqual(['2026-09-05']);
    expect(byPlan.has(10)).toBe(false);
  });
});

describe('buildGantt', () => {
  it('plans rong -> null', () => {
    expect(buildGantt({ plans: [], usage: [], equipments: [], workItems: [], noWorkItemName: NO_WORK_ITEM })).toBeNull();
  });

  it('seed du an 1: 5 hang, 1 chiec 2 thanh lien nhau (equipmentId 1 unitNo 1)', () => {
    const model = buildGantt({ plans: equipmentPlanSeed, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model).not.toBeNull();
    expect(model.rows).toHaveLength(5);
    const row = model.rows.find((r) => r.key === '1-1')!;
    expect(row.bars).toHaveLength(2);
    expect(row.bars.map((b) => b.start)).toEqual(['2026-08-03', '2026-08-31']);
    expect(row.bars[0].rangeLabel).toBe('03/08 - 30/08');
    expect(row.bars[0].planDays).toBe(28);
  });

  it('workItemId null -> mau neutral + legend "chua gan"', () => {
    const plans = [plan({ id: 1, workItemId: null })];
    const model = buildGantt({ plans, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model.rows[0].bars[0].color).toBe('var(--s-neutral)');
    expect(model.rows[0].bars[0].workItemName).toBe(NO_WORK_ITEM);
    expect(model.legend).toEqual([{ key: 'unassigned', name: NO_WORK_ITEM, color: 'var(--s-neutral)' }]);
  });

  it('thiet bi bi tat isActive (khong con trong equipments) -> nhan #id', () => {
    const plans = [plan({ id: 1, equipmentId: 99 })];
    const model = buildGantt({ plans, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model.rows[0].label).toBe('#99');
  });

  it('nhom chi 1 chiec unitNo=1 -> nhan khong co "No."', () => {
    const plans = [plan({ id: 1, equipmentId: 1, unitNo: 1 })];
    const model = buildGantt({ plans, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model.rows[0].label).toBe('Cẩu bánh xích');
    expect(model.rows[0].label).not.toContain('No.');
  });

  it('nhom co 2 chiec -> ca unitNo=1 cung co "No."', () => {
    const plans = [
      plan({ id: 1, equipmentId: 1, unitNo: 1 }),
      plan({ id: 2, equipmentId: 1, unitNo: 2 }),
    ];
    const model = buildGantt({ plans, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    const row1 = model.rows.find((r) => r.unitNo === 1)!;
    expect(row1.label).toBe('Cẩu bánh xích No.1');
  });

  it('ngay ra dung Thu 2 (from) / Chu nhat (to)', () => {
    const model = buildGantt({ plans: equipmentPlanSeed, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(new Date(`${model.from}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(new Date(`${model.to}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(model.planFrom).toBe('2026-08-03');
    expect(model.planTo).toBe('2026-10-25');
  });

  it('unplannedUsage cong don tu assignUsage', () => {
    const plans = [plan({ id: 1, equipmentId: 1, unitNo: 1 })];
    const usage: EquipmentUsageDay[] = [{ equipmentId: 1, workDate: '2026-09-05', qtyActual: 3 }];
    const model = buildGantt({ plans, usage, equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model.unplannedUsage).toBe(2);
    expect(model.rows[0].bars[0].usedDays).toEqual(['2026-09-05']);
  });

  it('legend chi gom hang muc thuc su co trong plans, theo sortOrder', () => {
    const plans: ProjectEquipmentPlan[] = [
      plan({ id: 1, equipmentId: 1, unitNo: 1, workItemId: 4 }),
      plan({ id: 2, equipmentId: 1, unitNo: 2, workItemId: 1 }),
    ];
    const model = buildGantt({ plans, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model.legend.map((l) => l.key)).toEqual(['1', '4']);
  });

  const GANTT_INPUT_FIXTURE: GanttInput = { plans: equipmentPlanSeed, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM };
  it('input co du field theo GanttInput (khong loi type)', () => {
    expect(buildGantt(GANTT_INPUT_FIXTURE)).not.toBeNull();
  });

  it('P3C-A (K9): unitNo null (dot nhap theo SL) -> 1 hang key "<eq>-0", nhan = ten thiet bi', () => {
    const plans = [plan({ id: 1, equipmentId: 1, unitNo: null, qty: 3 })];
    const model = buildGantt({ plans, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: NO_WORK_ITEM })!;
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].key).toBe('1-0');
    expect(model.rows[0].label).toBe('Cẩu bánh xích');
  });
});
