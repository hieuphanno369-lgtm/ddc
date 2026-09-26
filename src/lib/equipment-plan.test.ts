import { describe, expect, it } from 'vitest';
import {
  EQUIP_GROUP_MAX, EQUIP_PLAN_MAX_ROWS, EQUIP_QTY_MAX, equipGroupsAuditText, equipPlanAuditText, findOverloads,
  nextUnitNo, normalizeEquipmentGroups, normalizeEquipmentPlans, toEquipmentGroupDrafts, toEquipmentPlanDraft,
  validateEquipmentPlan, validateEquipmentPlans, type EquipmentGroupDraft, type EquipmentPlanDraft,
} from './equipment-plan';
import type {
  EquipmentPlanGroupInput, EquipmentPlanInput, EquipmentPlanSegment, EquipmentQuota, EquipmentSegmentInput,
  ProjectEquipmentPlan,
} from '@/server/repo/types';

const CTX = { equipmentIds: new Set([1, 2]), workItemIds: new Set([10, 11]) };

function row(over: Partial<EquipmentPlanInput> = {}): EquipmentPlanInput {
  return { equipmentId: 1, unitNo: 1, workItemId: null, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '', ...over };
}

describe('toEquipmentPlanDraft / normalizeEquipmentPlans', () => {
  it('roundtrip: draft -> input giu nguyen gia tri', () => {
    const plan: ProjectEquipmentPlan = {
      id: 1, projectId: 1, equipmentId: 2, unitNo: 3, qty: 1, workItemId: 10,
      plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: 'ghi chu', updatedAt: '', updatedBy: '',
    };
    const draft = toEquipmentPlanDraft(plan);
    const [input] = normalizeEquipmentPlans([draft]);
    expect(input).toEqual({ equipmentId: 2, unitNo: 3, workItemId: 10, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: 'ghi chu' });
  });

  it('workItemId rong -> null; note duoc trim', () => {
    const draft: EquipmentPlanDraft = { equipmentId: '1', unitNo: '1', workItemId: '', plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '  x  ' };
    const [input] = normalizeEquipmentPlans([draft]);
    expect(input.workItemId).toBeNull();
    expect(input.note).toBe('x');
  });
});

describe('nextUnitNo', () => {
  it('danh sach rong -> 1', () => {
    expect(nextUnitNo([], '1')).toBe(1);
  });

  it('da co unitNo 1,2 cua thiet bi 1 -> 3', () => {
    const rows: EquipmentPlanDraft[] = [
      { equipmentId: '1', unitNo: '1', workItemId: '', plannedStart: '', plannedFinish: '', note: '' },
      { equipmentId: '1', unitNo: '2', workItemId: '', plannedStart: '', plannedFinish: '', note: '' },
    ];
    expect(nextUnitNo(rows, '1')).toBe(3);
  });
});

describe('validateEquipmentPlans', () => {
  it('du lieu hop le -> ok', () => {
    const r = validateEquipmentPlans([row()], CTX);
    expect(r.ok).toBe(true);
    expect(r.overlaps).toEqual([]);
  });

  it('equipmentId khong ton tai -> loi equipmentId', () => {
    const r = validateEquipmentPlans([row({ equipmentId: 999 })], CTX);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('equipmentId');
  });

  it('workItemId khong ton tai -> loi workItemId', () => {
    const r = validateEquipmentPlans([row({ workItemId: 999 })], CTX);
    expect(r.errors[0]).toContain('workItemId');
  });

  it('unitNo ngoai khoang 1..99 -> loi unitNo', () => {
    expect(validateEquipmentPlans([row({ unitNo: 0 })], CTX).errors[0]).toContain('unitNo');
    expect(validateEquipmentPlans([row({ unitNo: 100 })], CTX).errors[0]).toContain('unitNo');
  });

  it('plannedFinish truoc plannedStart -> loi o plannedFinish', () => {
    const r = validateEquipmentPlans([row({ plannedStart: '2026-09-10', plannedFinish: '2026-09-01' })], CTX);
    expect(r.errors[0]).toContain('plannedFinish');
  });

  it('note qua 200 ky tu -> loi note', () => {
    const r = validateEquipmentPlans([row({ note: 'x'.repeat(201) })], CTX);
    expect(r.errors[0]).toContain('note');
  });

  it('qua 300 dong -> loi tu dong thu 300 (index) tro di', () => {
    const rows = Array.from({ length: EQUIP_PLAN_MAX_ROWS + 1 }, (_, i) => row({ unitNo: (i % 99) + 1 }));
    const r = validateEquipmentPlans(rows, CTX);
    expect(r.ok).toBe(false);
    expect(r.errors[EQUIP_PLAN_MAX_ROWS]).toContain('equipmentId');
  });

  it('chong ngay cung chiec -> overlaps [[0,1]]', () => {
    const rows = [row({ plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }), row({ plannedStart: '2026-09-05', plannedFinish: '2026-09-15' })];
    const r = validateEquipmentPlans(rows, CTX);
    expect(r.overlaps).toEqual([[0, 1]]);
    expect(r.ok).toBe(false);
  });

  it('2 chiec khac unitNo, cung ngay -> khong trung (ok)', () => {
    const rows = [row({ unitNo: 1 }), row({ unitNo: 2 })];
    const r = validateEquipmentPlans(rows, CTX);
    expect(r.overlaps).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('cham mep (finish A = start B) -> van tinh la trung', () => {
    const rows = [row({ plannedStart: '2026-09-01', plannedFinish: '2026-09-05' }), row({ plannedStart: '2026-09-05', plannedFinish: '2026-09-10' })];
    const r = validateEquipmentPlans(rows, CTX);
    expect(r.overlaps).toEqual([[0, 1]]);
  });
});

describe('equipPlanAuditText', () => {
  it('dung dinh dang "eq#unit start..finish"', () => {
    expect(equipPlanAuditText([row()])).toBe('1#1 2026-09-01..2026-09-10');
  });

  it('co workItemId -> them "wiN"', () => {
    expect(equipPlanAuditText([row({ workItemId: 10 })])).toBe('1#1 2026-09-01..2026-09-10 wi10');
  });
});

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
