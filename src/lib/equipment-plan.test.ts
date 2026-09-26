import { describe, expect, it } from 'vitest';
import {
  EQUIP_GROUP_MAX, EQUIP_PLAN_MAX_ROWS, EQUIP_QTY_MAX, equipGroupsAuditText, findOverloads, normalizeEquipmentGroups,
  toEquipmentGroupDrafts, validateEquipmentPlan, type EquipmentGroupDraft,
} from './equipment-plan';
import type {
  EquipmentPlanGroupInput, EquipmentPlanSegment, EquipmentQuota, EquipmentSegmentInput,
} from '@/server/repo/types';

// ---- P3C-A (T4): ke hoach thiet bi theo dot (Tong SL + cac dot) ----

function seg(over: Partial<EquipmentSegmentInput> = {}): EquipmentSegmentInput {
  return { from: '2026-09-01', to: '2026-09-10', qty: 1, ...over };
}

const GROUP_CTX = { equipmentIds: new Set([1, 2]) };

describe('findOverloads', () => {
  it('2 dot khong chong, moi dot qty = total -> khong vuot', () => {
    const r = findOverloads(2, [
      seg({ from: '2026-09-01', to: '2026-09-10', qty: 2 }),
      seg({ from: '2026-09-11', to: '2026-09-20', qty: 2 }),
    ]);
    expect(r).toEqual([]);
  });

  it('total 3: 09-01..09-10 x2 + 09-05..09-15 x2 -> 1 overload 09-05..09-10 used 4', () => {
    const r = findOverloads(3, [
      seg({ from: '2026-09-01', to: '2026-09-10', qty: 2 }),
      seg({ from: '2026-09-05', to: '2026-09-15', qty: 2 }),
    ]);
    expect(r).toEqual([{ from: '2026-09-05', to: '2026-09-10', used: 4 }]);
  });

  it('3 dot: x2 09-01..09-10, x2 09-05..09-20, x1 09-08..09-09, total 3 -> 1 khoang 09-05..09-10 used 5', () => {
    const r = findOverloads(3, [
      seg({ from: '2026-09-01', to: '2026-09-10', qty: 2 }),
      seg({ from: '2026-09-05', to: '2026-09-20', qty: 2 }),
      seg({ from: '2026-09-08', to: '2026-09-09', qty: 1 }),
    ]);
    expect(r).toEqual([{ from: '2026-09-05', to: '2026-09-10', used: 5 }]);
  });

  it('dot ket thuc dung ngay dot kia bat dau -> tinh chong 1 ngay', () => {
    const r = findOverloads(1, [
      seg({ from: '2026-09-01', to: '2026-09-10', qty: 1 }),
      seg({ from: '2026-09-10', to: '2026-09-20', qty: 1 }),
    ]);
    expect(r).toEqual([{ from: '2026-09-10', to: '2026-09-10', used: 2 }]);
  });

  it('1 dot qty > total mot minh -> overload dung khoang dot do', () => {
    const r = findOverloads(2, [seg({ from: '2026-09-01', to: '2026-09-05', qty: 3 })]);
    expect(r).toEqual([{ from: '2026-09-01', to: '2026-09-05', used: 3 }]);
  });

  it('to < from hoac ngay khong hop le -> bo qua, khong dua vao quet', () => {
    const r = findOverloads(1, [
      seg({ from: '2026-09-10', to: '2026-09-01', qty: 5 }),
      seg({ from: '2026-02-30', to: '2026-09-01', qty: 5 }),
    ]);
    expect(r).toEqual([]);
  });
});

describe('validateEquipmentPlan', () => {
  it('2 dot khong chong, moi dot qty = total -> ok', () => {
    const groups: EquipmentPlanGroupInput[] = [{
      equipmentId: 1, totalQty: 2,
      segments: [seg({ from: '2026-09-01', to: '2026-09-10', qty: 2 }), seg({ from: '2026-09-11', to: '2026-09-20', qty: 2 })],
    }];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.ok).toBe(true);
  });

  it('vuot Tong SL -> overload + segmentErrors qty ca 2 dot', () => {
    const groups: EquipmentPlanGroupInput[] = [{
      equipmentId: 1, totalQty: 3,
      segments: [
        seg({ from: '2026-09-01', to: '2026-09-10', qty: 2 }),
        seg({ from: '2026-09-05', to: '2026-09-15', qty: 2 }),
      ],
    }];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.ok).toBe(false);
    expect(r.overloads).toEqual([{ groupIndex: 0, equipmentId: 1, from: '2026-09-05', to: '2026-09-10', used: 4, total: 3 }]);
    expect(r.segmentErrors['0:0']).toContain('qty');
    expect(r.segmentErrors['0:1']).toContain('qty');
  });

  it('to < from -> loi to; ngay khong hop le -> loi from', () => {
    const groups: EquipmentPlanGroupInput[] = [{
      equipmentId: 1, totalQty: 2,
      segments: [seg({ from: '2026-09-10', to: '2026-09-01' }), seg({ from: '2026-02-30', to: '2026-09-01' })],
    }];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.segmentErrors['0:0']).toContain('to');
    expect(r.segmentErrors['0:1']).toContain('from');
  });

  it('equipmentId trung -> nhom thu 2 co loi equipmentId', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 1, segments: [] },
      { equipmentId: 1, totalQty: 1, segments: [] },
    ];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.groupErrors[0]).toBeUndefined();
    expect(r.groupErrors[1]).toContain('equipmentId');
  });

  it('equipmentId la -> loi equipmentId', () => {
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 999, totalQty: 1, segments: [] }];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.groupErrors[0]).toContain('equipmentId');
  });

  it('totalQty 0, 1.5, 1000 -> loi totalQty', () => {
    for (const totalQty of [0, 1.5, EQUIP_QTY_MAX + 1]) {
      const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty, segments: [] }];
      const r = validateEquipmentPlan(groups, GROUP_CTX);
      expect(r.groupErrors[0]).toContain('totalQty');
    }
  });

  it('301 dot -> tooManySegments', () => {
    const segments = Array.from({ length: EQUIP_PLAN_MAX_ROWS + 1 }, (_, i) => seg({ from: '2026-01-01', to: '2026-01-02', qty: 1 }));
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty: 1, segments }];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.tooManySegments).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('qua EQUIP_GROUP_MAX nhom -> tooManySegments', () => {
    const groups: EquipmentPlanGroupInput[] = Array.from({ length: EQUIP_GROUP_MAX + 1 }, () => ({
      equipmentId: 1, totalQty: 1, segments: [],
    }));
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.tooManySegments).toBe(true);
  });

  it('nhom 0 dot -> ok', () => {
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty: 1, segments: [] }];
    const r = validateEquipmentPlan(groups, GROUP_CTX);
    expect(r.ok).toBe(true);
  });
});

describe('toEquipmentGroupDrafts', () => {
  it('quota khong dot -> nhom segments rong', () => {
    const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cau', totalQty: 3 }];
    const groups = toEquipmentGroupDrafts(quotas, []);
    expect(groups).toEqual([{ equipmentId: '1', totalQty: '3', segments: [] }]);
  });

  it('dot khong co quota -> nhom cuoi totalQty rong', () => {
    const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cau', totalQty: 3 }];
    const segments: EquipmentPlanSegment[] = [
      { id: 1, equipmentId: 1, equipmentName: 'Cau', from: '2026-09-01', to: '2026-09-10', qty: 2 },
      { id: 2, equipmentId: 2, equipmentName: 'Xe cau', from: '2026-09-01', to: '2026-09-05', qty: 1 },
    ];
    const groups = toEquipmentGroupDrafts(quotas, segments);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ equipmentId: '1', totalQty: '3', segments: [{ from: '2026-09-01', to: '2026-09-10', qty: '2' }] });
    expect(groups[1]).toEqual({ equipmentId: '2', totalQty: '', segments: [{ from: '2026-09-01', to: '2026-09-05', qty: '1' }] });
  });
});

describe('normalizeEquipmentGroups', () => {
  it('chuoi rong -> NaN de validate bao loi', () => {
    const drafts: EquipmentGroupDraft[] = [{ equipmentId: '1', totalQty: '', segments: [{ from: '2026-09-01', to: '2026-09-10', qty: '' }] }];
    const [g] = normalizeEquipmentGroups(drafts);
    expect(Number.isNaN(g.totalQty)).toBe(true);
    expect(Number.isNaN(g.segments[0].qty)).toBe(true);
  });
});

describe('equipGroupsAuditText', () => {
  it('dung chuoi mau: nhieu dot, nhom khong dot -> "-"', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 3, segments: [seg({ from: '2026-07-06', to: '2026-08-30', qty: 1 }), seg({ from: '2026-08-31', to: '2026-10-25', qty: 3 })] },
      { equipmentId: 2, totalQty: 2, segments: [] },
    ];
    expect(equipGroupsAuditText(groups)).toBe('1 tong 3: 2026-07-06..2026-08-30 x1, 2026-08-31..2026-10-25 x3; 2 tong 2: -');
  });

  it('dai hon 2000 ky tu -> cat dung 2000', () => {
    const groups: EquipmentPlanGroupInput[] = Array.from({ length: 200 }, (_, i) => ({
      equipmentId: i + 1, totalQty: 1, segments: [seg({ from: '2026-09-01', to: '2026-09-10', qty: 1 })],
    }));
    expect(equipGroupsAuditText(groups).length).toBe(2000);
  });
});
