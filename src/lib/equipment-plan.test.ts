import { describe, expect, it } from 'vitest';
import {
  EQUIP_PLAN_MAX_ROWS, equipPlanAuditText, nextUnitNo, normalizeEquipmentPlans, toEquipmentPlanDraft,
  validateEquipmentPlans, type EquipmentPlanDraft,
} from './equipment-plan';
import type { EquipmentPlanInput, ProjectEquipmentPlan } from '@/server/repo/types';

const CTX = { equipmentIds: new Set([1, 2]), workItemIds: new Set([10, 11]) };

function row(over: Partial<EquipmentPlanInput> = {}): EquipmentPlanInput {
  return { equipmentId: 1, unitNo: 1, workItemId: null, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '', ...over };
}

describe('toEquipmentPlanDraft / normalizeEquipmentPlans', () => {
  it('roundtrip: draft -> input giu nguyen gia tri', () => {
    const plan: ProjectEquipmentPlan = {
      id: 1, projectId: 1, equipmentId: 2, unitNo: 3, workItemId: 10,
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
