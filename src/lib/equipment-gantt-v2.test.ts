import { describe, expect, it } from 'vitest';
import { assignLanes, buildGanttAxis, buildPlanGantt, formatDayMonthDot } from './equipment-gantt-v2';
import type { EquipmentPlanSegment, EquipmentQuota } from '@/server/repo/types';
import { equipmentColor } from '@/lib/tracking';

function seg(over: Partial<EquipmentPlanSegment>): EquipmentPlanSegment {
  return { id: 1, equipmentId: 1, equipmentName: 'Cẩu 1250t', from: '2026-09-01', to: '2026-09-10', qty: 1, ...over };
}

describe('buildGanttAxis', () => {
  it('ke hoach ngan (60 ngay) -> truc tuan, tick dau la Thu 2', () => {
    const axis = buildGanttAxis('2026-09-01', '2026-10-30');
    expect(axis.mode).toBe('week');
    expect(axis.ticks[0]).toEqual({ date: '2026-08-31', label: '31/08' });
    for (const tick of axis.ticks) {
      const dow = new Date(`${tick.date}T00:00:00Z`).getUTCDay();
      expect(dow).toBe(1); // Thu 2
    }
  });

  it('ke hoach dai (6 thang) -> truc thang, label MM.YYYY, labelStep 1', () => {
    const axis = buildGanttAxis('2026-07-01', '2026-12-31');
    expect(axis.mode).toBe('month');
    expect(axis.ticks).toHaveLength(6);
    expect(axis.ticks.map((t) => t.label)).toEqual(['07.2026', '08.2026', '09.2026', '10.2026', '11.2026', '12.2026']);
    expect(axis.labelStep).toBe(1);
  });

  it('30 thang -> labelStep 3', () => {
    const axis = buildGanttAxis('2026-01-01', '2028-06-30');
    expect(axis.ticks).toHaveLength(30);
    expect(axis.labelStep).toBe(3);
  });

  it('bien 92/93 ngay: 92 -> tuan, 93 -> thang', () => {
    expect(buildGanttAxis('2026-09-01', '2026-12-01').mode).toBe('week');
    expect(buildGanttAxis('2026-09-01', '2026-12-02').mode).toBe('month');
  });
});

describe('assignLanes', () => {
  it('chong ngay -> nhieu lane, khong chong -> dung 1 lane', () => {
    const A = { id: 1, from: '2026-09-01', to: '2026-09-20' };
    const B = { id: 2, from: '2026-09-15', to: '2026-09-30' };
    const C = { id: 3, from: '2026-09-21', to: '2026-09-30' };
    const lanes = assignLanes([A, B, C]);
    expect(lanes.get(1)).toBe(0);
    expect(lanes.get(2)).toBe(1);
    expect(lanes.get(3)).toBe(0);
  });
});

describe('buildPlanGantt', () => {
  it('chong dot: lane dung, qtyNow tinh dung hom nay, spanFrom/spanTo, qtyTotal tu quota', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, equipmentId: 1, from: '2026-09-01', to: '2026-09-20', qty: 2 }),
      seg({ id: 2, equipmentId: 1, from: '2026-09-15', to: '2026-09-30', qty: 1 }),
      seg({ id: 3, equipmentId: 1, from: '2026-09-21', to: '2026-09-30', qty: 1 }),
    ];
    const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cẩu 1250t', totalQty: 3 }];
    const model = buildPlanGantt(segments, quotas, '2026-09-16');
    expect(model).not.toBeNull();
    const row = model!.rows[0];
    expect(row.segments.find((s) => s.id === 1)!.lane).toBe(0);
    expect(row.segments.find((s) => s.id === 2)!.lane).toBe(1);
    expect(row.segments.find((s) => s.id === 3)!.lane).toBe(0);
    expect(row.lanes).toBe(2);
    expect(row.qtyNow).toBe(3);
    expect(row.qtyTotal).toBe(3);
    expect(row.spanFrom).toBe('2026-09-01');
    expect(row.spanTo).toBe('2026-09-30');
  });

  it('dot ket thuc dung hom nay tinh vao qtyNow; dot bat dau ngay mai thi khong', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, equipmentId: 1, from: '2026-09-01', to: '2026-09-16', qty: 2 }),
      seg({ id: 2, equipmentId: 1, from: '2026-09-17', to: '2026-09-20', qty: 5 }),
    ];
    const model = buildPlanGantt(segments, [], '2026-09-16');
    expect(model!.rows[0].qtyNow).toBe(2);
  });

  it('quota khong co dot -> van co hang, segments rong, qtyNow 0, spanFrom null; dot khong co quota -> qtyTotal null', () => {
    const segments: EquipmentPlanSegment[] = [seg({ id: 1, equipmentId: 1 })];
    const quotas: EquipmentQuota[] = [{ equipmentId: 9, equipmentName: 'Xe cau', totalQty: 5 }];
    const model = buildPlanGantt(segments, quotas, '2026-09-05')!;
    const row9 = model.rows.find((r) => r.equipmentId === 9)!;
    expect(row9.segments).toEqual([]);
    expect(row9.qtyNow).toBe(0);
    expect(row9.spanFrom).toBeNull();
    expect(row9.spanTo).toBeNull();
    expect(row9.lanes).toBe(1);
    const row1 = model.rows.find((r) => r.equipmentId === 1)!;
    expect(row1.qtyTotal).toBeNull();
  });

  it('khong co du lieu -> null; chi co dot hong -> null', () => {
    expect(buildPlanGantt([], [], '2026-09-05')).toBeNull();
    expect(buildPlanGantt([], [{ equipmentId: 1, equipmentName: 'X', totalQty: 2 }], '2026-09-05')).toBeNull();
    const hong: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-09-10', to: '2026-09-01' })];
    expect(buildPlanGantt(hong, [], '2026-09-05')).toBeNull();
  });

  it('hom nay ngoai truc -> todayInRange false', () => {
    const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-01-01', to: '2026-01-10' })];
    const model = buildPlanGantt(segments, [], '2027-01-05')!;
    expect(model.todayInRange).toBe(false);
  });

  it('mau: 2 hang -> equipmentColor(0), equipmentColor(1)', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, equipmentId: 1, equipmentName: 'A' }),
      seg({ id: 2, equipmentId: 2, equipmentName: 'B' }),
    ];
    const model = buildPlanGantt(segments, [], '2026-09-05')!;
    expect(model.rows[0].color).toBe(equipmentColor(0));
    expect(model.rows[1].color).toBe(equipmentColor(1));
  });
});

describe('formatDayMonthDot', () => {
  it("'2026-09-25' -> '25.09'", () => {
    expect(formatDayMonthDot('2026-09-25')).toBe('25.09');
  });
});
