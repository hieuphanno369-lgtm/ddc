import { describe, expect, it } from 'vitest';
import {
  EQUIP_GROUP_MAX,
  EQUIP_PLAN_MAX_ROWS,
  EQUIP_QTY_MAX,
  equipGroupsAuditText,
  findOverloads,
  normalizeEquipmentGroups,
  toEquipmentGroupDrafts,
  validateEquipmentPlan,
} from '@/lib/equipment-plan';
import type { EquipmentPlanGroupInput, EquipmentPlanSegment, EquipmentQuota } from '@/server/repo/types';

/**
 * Kiem thu doc lap (Tester) cho T4 - kiem tra logic thuan `findOverloads`/`validateEquipmentPlan`
 * o cac truong hop bien ma ban ke hoach neu ten: dot cham ngay dau/cuoi, 1 ngay, nhieu dot chong
 * mot phan. File nay TACH KHOI test cua coder (`equipment-plan.test.ts`).
 */
describe('T4 - findOverloads: duong chay thuan loi', () => {
  it('2 dot khong chong ngay, moi dot qty = total -> khong vuot', () => {
    const segs = [
      { from: '2026-09-01', to: '2026-09-10', qty: 3 },
      { from: '2026-09-11', to: '2026-09-20', qty: 3 },
    ];
    expect(findOverloads(3, segs)).toEqual([]);
  });

  it('mot dot dung mot minh khong vuot total -> khong bao loi', () => {
    const segs = [{ from: '2026-01-01', to: '2026-01-31', qty: 3 }];
    expect(findOverloads(3, segs)).toEqual([]);
  });
});

describe('T4 - findOverloads: truong hop bien theo ke hoach', () => {
  it('dot ket thuc DUNG ngay dot kia bat dau -> tinh chong 1 ngay', () => {
    // Dot A: 01..10 qty 2; dot B: 10..20 qty 2 -> ngay 10 tong = 4 > total 3.
    const segs = [
      { from: '2026-09-01', to: '2026-09-10', qty: 2 },
      { from: '2026-09-10', to: '2026-09-20', qty: 2 },
    ];
    const overloads = findOverloads(3, segs);
    expect(overloads).toEqual([{ from: '2026-09-10', to: '2026-09-10', used: 4 }]);
  });

  it('dot 1 ngay (from === to) tu no da vuot total -> bao dung khoang 1 ngay', () => {
    const segs = [{ from: '2026-09-05', to: '2026-09-05', qty: 5 }];
    expect(findOverloads(3, segs)).toEqual([{ from: '2026-09-05', to: '2026-09-05', used: 5 }]);
  });

  it('dot 1 ngay xen giua 2 dot khac khong vuot rieng le, cong lai moi vuot dung 1 ngay do', () => {
    // A: 01..20 qty 1; B: 01..20 qty 1 (tong 2, khong vuot total 2)
    // C: 1 ngay 09-10, qty 1 -> ngay do tong = 3 > total 2, chi ngay 09-10 bi vuot.
    const segs = [
      { from: '2026-09-01', to: '2026-09-20', qty: 1 },
      { from: '2026-09-01', to: '2026-09-20', qty: 1 },
      { from: '2026-09-10', to: '2026-09-10', qty: 1 },
    ];
    expect(findOverloads(2, segs)).toEqual([{ from: '2026-09-10', to: '2026-09-10', used: 3 }]);
  });

  it('nhieu dot chong 1 phan, 2 khoang vuot RIENG BIET (khong lien tuc) -> tra ve 2 khoang', () => {
    // total 3.
    // Doan 1: A(01..10,x2) + B(05..15,x2) -> 05..10 vuot (used4), 11..15 khong vuot (used2)
    // Doan 2 rieng: C(20..25,x4) tu no da vuot (used4), khong dinh gi doan 1.
    const segs = [
      { from: '2026-09-01', to: '2026-09-10', qty: 2 },
      { from: '2026-09-05', to: '2026-09-15', qty: 2 },
      { from: '2026-09-20', to: '2026-09-25', qty: 4 },
    ];
    const overloads = findOverloads(3, segs);
    expect(overloads).toEqual([
      { from: '2026-09-05', to: '2026-09-10', used: 4 },
      { from: '2026-09-20', to: '2026-09-25', used: 4 },
    ]);
  });

  it('3 dot chong 1 phan nhu vi du ke hoach: 09-05..09-10 used 5', () => {
    const segs = [
      { from: '2026-09-01', to: '2026-09-10', qty: 2 },
      { from: '2026-09-05', to: '2026-09-20', qty: 2 },
      { from: '2026-09-08', to: '2026-09-09', qty: 1 },
    ];
    const overloads = findOverloads(3, segs);
    expect(overloads).toHaveLength(1);
    expect(overloads[0]).toEqual({ from: '2026-09-05', to: '2026-09-10', used: 5 });
  });

  it('dot to < from bi loai khoi quet (khong duoc goi truc tiep vi validate se chan o tang tren)', () => {
    const segs = [
      { from: '2026-09-10', to: '2026-09-05', qty: 10 }, // to < from -> loai
      { from: '2026-09-01', to: '2026-09-02', qty: 1 },
    ];
    expect(findOverloads(1, segs)).toEqual([]);
  });
});

describe('T4 - validateEquipmentPlan: bien theo dung ten trong ke hoach', () => {
  const ctx = { equipmentIds: new Set([1, 2, 3]) };

  it('duong chay thuan loi: nhieu nhom, moi nhom co dot hop le, khong vuot -> ok', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 3, segments: [{ from: '2026-01-01', to: '2026-01-31', qty: 3 }] },
      { equipmentId: 2, totalQty: 2, segments: [{ from: '2026-02-01', to: '2026-02-10', qty: 2 }] },
    ];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.ok).toBe(true);
    expect(check.overloads).toEqual([]);
  });

  it('nhom 0 dot la HOP LE (Gantt hien hang trong 0/tong)', () => {
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty: 5, segments: [] }];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.ok).toBe(true);
  });

  it('dot cham ca ngay dau va ngay cuoi cua dot khac deu bi tinh chong', () => {
    // Dot A het han 09-10, dot B bat dau 09-10 (cham dau); dot C bat dau 09-10, dot D ket thuc 09-10.
    const groups: EquipmentPlanGroupInput[] = [
      {
        equipmentId: 1,
        totalQty: 2,
        segments: [
          { from: '2026-09-01', to: '2026-09-10', qty: 2 },
          { from: '2026-09-10', to: '2026-09-20', qty: 2 },
        ],
      },
    ];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.ok).toBe(false);
    expect(check.overloads[0]).toEqual({ groupIndex: 0, equipmentId: 1, from: '2026-09-10', to: '2026-09-10', used: 4, total: 2 });
    // Ca 2 dot cham ngay do deu bi to do (segmentErrors chua 'qty').
    expect(check.segmentErrors['0:0']).toContain('qty');
    expect(check.segmentErrors['0:1']).toContain('qty');
  });

  it('1 dot vuot mot minh (qty > total) van bi bao dung khoang cua chinh no', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 2, segments: [{ from: '2026-05-01', to: '2026-05-05', qty: 5 }] },
    ];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.ok).toBe(false);
    expect(check.overloads).toEqual([{ groupIndex: 0, equipmentId: 1, from: '2026-05-01', to: '2026-05-05', used: 5, total: 2 }]);
  });

  it('equipmentId khong thuoc danh sach hop le -> loi equipmentId', () => {
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 999, totalQty: 1, segments: [] }];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.ok).toBe(false);
    expect(check.groupErrors[0]).toContain('equipmentId');
  });

  it('equipmentId trung nhau giua 2 nhom -> nhom SAU bi bao loi', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 1, segments: [] },
      { equipmentId: 1, totalQty: 2, segments: [] },
    ];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.groupErrors[0]).toBeUndefined();
    expect(check.groupErrors[1]).toContain('equipmentId');
  });

  it('totalQty 0, so thap phan, vuot EQUIP_QTY_MAX deu bi bao loi totalQty', () => {
    for (const bad of [0, 1.5, EQUIP_QTY_MAX + 1]) {
      const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty: bad, segments: [] }];
      const check = validateEquipmentPlan(groups, ctx);
      expect(check.groupErrors[0], `totalQty=${bad}`).toContain('totalQty');
    }
  });

  it('to < from -> loi o truong to, khong tinh vao quet chong ngay', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 1, segments: [{ from: '2026-09-10', to: '2026-09-05', qty: 1 }] },
    ];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.segmentErrors['0:0']).toContain('to');
    expect(check.overloads).toEqual([]);
  });

  it('ngay khong hop le (2026-02-30) -> loi truong from', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 1, segments: [{ from: '2026-02-30', to: '2026-03-01', qty: 1 }] },
    ];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.segmentErrors['0:0']).toContain('from');
  });

  it('301 dot (vuot EQUIP_PLAN_MAX_ROWS = 300) -> tooManySegments', () => {
    const segments = Array.from({ length: EQUIP_PLAN_MAX_ROWS + 1 }, (_, i) => ({
      from: '2026-01-01', to: '2026-01-01', qty: 1,
    }));
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty: EQUIP_QTY_MAX, segments }];
    const check = validateEquipmentPlan(groups, ctx);
    expect(check.tooManySegments).toBe(true);
    expect(check.ok).toBe(false);
  });

  it('so nhom vuot EQUIP_GROUP_MAX -> tooManySegments (du moi nhom hop le)', () => {
    const manyIds = new Set(Array.from({ length: EQUIP_GROUP_MAX + 1 }, (_, i) => i + 1));
    const groups: EquipmentPlanGroupInput[] = Array.from({ length: EQUIP_GROUP_MAX + 1 }, (_, i) => ({
      equipmentId: i + 1, totalQty: 1, segments: [],
    }));
    const check = validateEquipmentPlan(groups, { equipmentIds: manyIds });
    expect(check.tooManySegments).toBe(true);
  });
});

describe('T4 - toEquipmentGroupDrafts / normalizeEquipmentGroups / equipGroupsAuditText', () => {
  it('quota khong co dot -> nhom segments rong', () => {
    const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'May han', totalQty: 5 }];
    const drafts = toEquipmentGroupDrafts(quotas, []);
    expect(drafts).toEqual([{ equipmentId: '1', totalQty: '5', segments: [] }]);
  });

  it('dot khong co quota tuong ung -> them nhom cuoi voi totalQty rong', () => {
    const segs: EquipmentPlanSegment[] = [
      { id: 1, equipmentId: 9, equipmentName: 'Giai giao', from: '2026-01-01', to: '2026-01-10', qty: 2 },
    ];
    const drafts = toEquipmentGroupDrafts([], segs);
    expect(drafts).toEqual([{ equipmentId: '9', totalQty: '', segments: [{ from: '2026-01-01', to: '2026-01-10', qty: '2' }] }]);
  });

  it('normalizeEquipmentGroups: chuoi rong -> NaN de validate bao loi (khong phai 0)', () => {
    const [g] = normalizeEquipmentGroups([{ equipmentId: '1', totalQty: '', segments: [{ from: '2026-01-01', to: '2026-01-02', qty: '' }] }]);
    expect(Number.isNaN(g.totalQty)).toBe(true);
    expect(Number.isNaN(g.segments[0].qty)).toBe(true);
  });

  it('equipGroupsAuditText: dung mau "id tong n: dot,..." va nhom 0 dot la "-"', () => {
    const groups: EquipmentPlanGroupInput[] = [
      { equipmentId: 1, totalQty: 3, segments: [{ from: '2026-07-06', to: '2026-08-30', qty: 1 }, { from: '2026-08-31', to: '2026-10-25', qty: 3 }] },
      { equipmentId: 2, totalQty: 2, segments: [] },
    ];
    expect(equipGroupsAuditText(groups)).toBe('1 tong 3: 2026-07-06..2026-08-30 x1, 2026-08-31..2026-10-25 x3; 2 tong 2: -');
  });

  it('equipGroupsAuditText: chuoi dai hon 2000 ky tu bi cat dung 2000', () => {
    const groups: EquipmentPlanGroupInput[] = Array.from({ length: 200 }, (_, i) => ({
      equipmentId: i + 1, totalQty: 1, segments: [{ from: '2026-01-01', to: '2026-01-02', qty: 1 }],
    }));
    const text = equipGroupsAuditText(groups);
    expect(text.length).toBe(2000);
  });
});

describe('T4 - truong hop PHAI THAT BAI (negative case bat buoc)', () => {
  it('gui totalQty am -> validateEquipmentPlan phai bao ok=false, KHONG duoc coi la hop le', () => {
    const groups: EquipmentPlanGroupInput[] = [{ equipmentId: 1, totalQty: -1, segments: [] }];
    const check = validateEquipmentPlan(groups, { equipmentIds: new Set([1]) });
    expect(check.ok).toBe(false);
    expect(check.groupErrors[0]).toContain('totalQty');
  });
});
