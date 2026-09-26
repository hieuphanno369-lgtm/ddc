import { describe, expect, it } from 'vitest';
import { addDaysIso } from '@/lib/clock';
import { equipmentColor } from '@/lib/tracking';
import { assignLanes, buildGanttAxis, buildPlanGantt, WEEK_MODE_MAX_DAYS } from './equipment-gantt-v2';
import type { EquipmentPlanSegment, EquipmentQuota } from '@/lib/p3c-contract';

/**
 * QA doc lap cho equipment-gantt-v2.ts (T4). Du lieu/moc thoi gian khac voi test cua coder
 * (equipment-gantt-v2.test.ts) de khong chi lap lai cung 1 bo so - kiem tra logic that su,
 * khong phai kiem tra "coder da viet dung con so nao".
 */

function seg(over: Partial<EquipmentPlanSegment>): EquipmentPlanSegment {
  return { id: 1, equipmentId: 1, equipmentName: 'May xuc', from: '2026-01-01', to: '2026-01-10', qty: 1, ...over };
}

describe('QA buildGanttAxis - bien 92/93 ngay (tham so hoa, doc lap voi moc thoi gian cua coder)', () => {
  it('span dung 92 ngay (WEEK_MODE_MAX_DAYS) -> truc tuan', () => {
    const from = '2026-02-01';
    const to = addDaysIso(from, WEEK_MODE_MAX_DAYS - 1); // span = 92
    expect(buildGanttAxis(from, to).mode).toBe('week');
  });

  it('span 93 ngay (vuot 1 ngay) -> truc thang', () => {
    const from = '2026-02-01';
    const to = addDaysIso(from, WEEK_MODE_MAX_DAYS); // span = 93
    expect(buildGanttAxis(from, to).mode).toBe('month');
  });
});

describe('QA buildGanttAxis - moc thang rut gon khi rat dai (vd 2 nam)', () => {
  it('ke hoach dung 24 thang -> labelStep = ceil(24/12) = 2, van du 24 tick', () => {
    const axis = buildGanttAxis('2025-01-01', '2026-12-31');
    expect(axis.mode).toBe('month');
    expect(axis.ticks).toHaveLength(24);
    expect(axis.labelStep).toBe(2);
    // Chi hien nhan o tick 0, 2, 4... (i % labelStep === 0) - kiem it nhat 1 tick khong hien nhan
    // van co du lieu (label van ton tai trong model, chi UI moi bo qua ve theo labelStep).
    expect(axis.ticks[1].label).toBe('02.2025');
  });

  it('ke hoach dung 12 thang (bien duoi) -> labelStep 1 (khong rut gon)', () => {
    const axis = buildGanttAxis('2025-01-01', '2025-12-31');
    expect(axis.ticks).toHaveLength(12);
    expect(axis.labelStep).toBe(1);
  });
});

describe('QA assignLanes - dung 1 ngay chong (bien ranh gioi)', () => {
  it('doi A ket thuc dung ngay doi B bat dau -> van coi la chong (theo dung dinh nghia), khac lane', () => {
    const A = { id: 1, from: '2026-05-01', to: '2026-05-10' };
    const B = { id: 2, from: '2026-05-10', to: '2026-05-20' }; // B.from === A.to
    const lanes = assignLanes([A, B]);
    expect(lanes.get(1)).not.toBe(lanes.get(2));
  });

  it('doi C bat dau ngay hom sau khi doi A ket thuc -> khong chong, dung chung lane', () => {
    const A = { id: 1, from: '2026-05-01', to: '2026-05-10' };
    const C = { id: 3, from: '2026-05-11', to: '2026-05-20' };
    const lanes = assignLanes([A, C]);
    expect(lanes.get(1)).toBe(lanes.get(3));
  });
});

describe('QA buildPlanGantt - 1 hang = 1 loai thiet bi (T4a) du co nhieu dot', () => {
  it('3 dot cung equipmentId -> chi 1 hang duy nhat, segments dai 3', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, from: '2026-01-01', to: '2026-01-05', qty: 1 }),
      seg({ id: 2, from: '2026-02-01', to: '2026-02-05', qty: 2 }),
      seg({ id: 3, from: '2026-03-01', to: '2026-03-05', qty: 3 }),
    ];
    const model = buildPlanGantt(segments, [], '2026-01-01')!;
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].segments).toHaveLength(3);
  });

  it('2 loai thiet bi khac nhau -> 2 hang, sap theo equipmentId tang', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, equipmentId: 20, equipmentName: 'B' }),
      seg({ id: 2, equipmentId: 5, equipmentName: 'A' }),
    ];
    const model = buildPlanGantt(segments, [], '2026-01-01')!;
    expect(model.rows.map((r) => r.equipmentId)).toEqual([5, 20]);
  });
});

describe('QA buildPlanGantt - hom nay tren ranh gioi 2 dot (dot A ket thuc = dot B bat dau)', () => {
  it('hom nay = ngay ca 2 dot deu phu (A.to === today === B.from) -> qtyNow cong ca 2', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, from: '2026-04-01', to: '2026-04-15', qty: 3 }),
      seg({ id: 2, from: '2026-04-15', to: '2026-04-30', qty: 4 }),
    ];
    const model = buildPlanGantt(segments, [], '2026-04-15')!;
    expect(model.rows[0].qtyNow).toBe(7);
  });
});

describe('QA buildPlanGantt - hom nay ngoai truc (truoc ca planFrom, khac tinh huong voi test cua coder)', () => {
  it('today truoc axis.from mot ngay -> todayInRange false', () => {
    const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-06-01', to: '2026-06-10' })];
    const model = buildPlanGantt(segments, [], '2026-01-01')!;
    expect(model.todayInRange).toBe(false);
  });
});

describe('QA buildPlanGantt - loai co Tong SL nhung chua co dot van hien 0/tong (nhieu loai cung luc)', () => {
  it('2 loai chi co quota (khong dot nao) -> ca 2 deu co hang, qtyNow 0, qtyTotal dung', () => {
    const quotas: EquipmentQuota[] = [
      { equipmentId: 1, equipmentName: 'Cau A', totalQty: 4 },
      { equipmentId: 2, equipmentName: 'Cau B', totalQty: 7 },
    ];
    // Can it nhat 1 dot hop le o mot thiet bi khac de co truc thoi gian (buildPlanGantt tra null
    // neu khong co dot hop le nao - dung dac ta Buoc 4 diem 2).
    const segments: EquipmentPlanSegment[] = [seg({ id: 1, equipmentId: 9, from: '2026-01-01', to: '2026-01-05' })];
    const model = buildPlanGantt(segments, [...quotas, { equipmentId: 9, equipmentName: 'X', totalQty: 1 }], '2026-01-01')!;
    const r1 = model.rows.find((r) => r.equipmentId === 1)!;
    const r2 = model.rows.find((r) => r.equipmentId === 2)!;
    expect(r1.qtyNow).toBe(0);
    expect(r1.qtyTotal).toBe(4);
    expect(r2.qtyNow).toBe(0);
    expect(r2.qtyTotal).toBe(7);
  });
});

describe('QA buildPlanGantt - mau on dinh theo thu tu hang, khong phu thuoc gia tri equipmentId', () => {
  it('equipmentId khong lien tuc (5, 100) -> mau van la equipmentColor(0)/equipmentColor(1) theo thu tu hang', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, equipmentId: 100, equipmentName: 'Z' }),
      seg({ id: 2, equipmentId: 5, equipmentName: 'A' }),
    ];
    const model = buildPlanGantt(segments, [], '2026-01-01')!;
    // Sort theo equipmentId tang -> hang 0 la equipmentId 5, hang 1 la equipmentId 100.
    expect(model.rows[0].equipmentId).toBe(5);
    expect(model.rows[0].color).toBe(equipmentColor(0));
    expect(model.rows[1].equipmentId).toBe(100);
    expect(model.rows[1].color).toBe(equipmentColor(1));
  });
});

describe('QA buildPlanGantt - truong hop PHAI THAT BAI (du lieu hong bi tu choi, khong duoc lam vo hieu axis)', () => {
  it('qty = 0 hoac am -> dot bi loai, khong lam sai lech planFrom/planTo cua cac dot con lai', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, from: '2026-01-01', to: '2026-01-05', qty: 0 }), // hong: qty < 1
      seg({ id: 2, from: '2025-01-01', to: '2025-01-05', qty: -3 }), // hong: qty am, ngay som hon nhieu
      seg({ id: 3, from: '2026-06-01', to: '2026-06-10', qty: 2 }), // hop le duy nhat
    ];
    const model = buildPlanGantt(segments, [], '2026-06-05')!;
    expect(model.rows[0].segments).toHaveLength(1);
    // Neu dot hong khong bi loc, planFrom se la '2025-01-01' - sai. Phai la '2026-06-01'.
    expect(model.planFrom).toBe('2026-06-01');
    expect(model.planTo).toBe('2026-06-10');
  });

  it('ngay khong dung dinh dang YYYY-MM-DD -> bi loai am tham, khong nem loi', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, from: '01/06/2026', to: '10/06/2026', qty: 2 }), // sai dinh dang
    ];
    expect(() => buildPlanGantt(segments, [], '2026-06-05')).not.toThrow();
    expect(buildPlanGantt(segments, [], '2026-06-05')).toBeNull();
  });
});
