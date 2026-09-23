import { describe, expect, it } from 'vitest';
import {
  buildEquipmentView, buildLogView, buildMatrixView, buildTrackingSummary, type WeeklyTracking,
} from './tracking';

const W: WeeklyTracking = {
  days: ['2026-09-14', '2026-09-15', '2026-09-16'],
  today: '2026-09-16',
  contractors: [{ id: 1, name: 'A', scopeOfWork: 'Lắp dựng' }, { id: 2, name: 'B', scopeOfWork: 'Sơn' }, { id: 3, name: 'C', scopeOfWork: '' }],
  equipments: [{ id: 10, name: 'Cẩu' }, { id: 11, name: 'Hàn' }],
  manpower: [
    { projectId: 1, contractorId: 1, workDate: '2026-09-15', plannedHeadcount: 100, actualHeadcount: 80 },
    { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 96 },
    { projectId: 1, contractorId: 2, workDate: '2026-09-16', plannedHeadcount: 0, actualHeadcount: 5 },
  ],
  equipmentUsage: [
    { projectId: 1, contractorId: 1, equipmentId: 10, workDate: '2026-09-16', qtyPlanned: 2, qtyActual: 2 },
    { projectId: 1, contractorId: 2, equipmentId: 10, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
    { projectId: 1, contractorId: 1, equipmentId: 11, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 0 }, // co KH nhung KHONG dung
    { projectId: 1, contractorId: 1, equipmentId: 11, workDate: '2026-09-15', qtyPlanned: 1, qtyActual: 1 },
  ],
};

describe('buildLogView', () => {
  it('thu tu ngay giam dan', () => {
    const days = buildLogView(W).map((d) => d.date);
    expect(days).toEqual(['2026-09-16', '2026-09-15', '2026-09-14']);
  });
  it('ngay 16: isToday, tong dung, rows dung, equipmentTypeCount = 1 (chi TB co qtyActual > 0)', () => {
    const d16 = buildLogView(W).find((d) => d.date === '2026-09-16')!;
    expect(d16.isToday).toBe(true);
    expect(d16.planned).toBe(100);
    expect(d16.actual).toBe(101);
    expect(d16.ratio).toBeCloseTo(1.01, 10);
    expect(d16.equipmentTypeCount).toBe(1);
    expect(d16.rows).toEqual([
      { contractorId: 1, name: 'A', scope: 'Lắp dựng', planned: 100, actual: 96, diff: -4, ratio: 0.96, equipmentIds: [10] },
      { contractorId: 2, name: 'B', scope: 'Sơn', planned: 0, actual: 5, diff: 5, ratio: null, equipmentIds: [10] },
    ]);
  });
  it('ngay 15: A dung thiet bi 11', () => {
    const d15 = buildLogView(W).find((d) => d.date === '2026-09-15')!;
    expect(d15.rows.find((r) => r.contractorId === 1)?.equipmentIds).toEqual([11]);
  });
  it('ngay 14: khong co du lieu', () => {
    const d14 = buildLogView(W).find((d) => d.date === '2026-09-14')!;
    expect(d14.rows).toEqual([]);
    expect(d14.planned).toBe(0);
    expect(d14.ratio).toBeNull();
    expect(d14.equipmentTypeCount).toBe(0);
  });
});

describe('buildMatrixView', () => {
  it('3 hang, cells + weekRatio dung', () => {
    const v = buildMatrixView(W);
    expect(v.rows).toHaveLength(3);
    const a = v.rows.find((r) => r.contractorId === 1)!;
    expect(a.cells).toEqual([null, { planned: 100, actual: 80, ratio: 0.8 }, { planned: 100, actual: 96, ratio: 0.96 }]);
    expect(a.weekRatio).toBeCloseTo(176 / 200, 10);
    const b = v.rows.find((r) => r.contractorId === 2)!;
    expect(b.weekRatio).toBeNull();
    const c = v.rows.find((r) => r.contractorId === 3)!;
    expect(c.cells.every((cell) => cell == null)).toBe(true);
  });
  it('totals + weekRatio tong', () => {
    const v = buildMatrixView(W);
    expect(v.totals[0]).toEqual({ planned: 0, actual: 0, ratio: null });
    expect(v.totals[2].actual).toBe(101);
    expect(v.weekRatio).toBeCloseTo(181 / 200, 10);
  });
});

describe('buildEquipmentView', () => {
  it('hang thiet bi 10 (Cau)', () => {
    const rows = buildEquipmentView(W);
    const r10 = rows.find((r) => r.equipmentId === 10)!;
    expect(r10.color).toBe('var(--s-actual)');
    expect(r10.cells[2]).toEqual([
      { contractorId: 1, name: 'A', actualHeadcount: 96 },
      { contractorId: 2, name: 'B', actualHeadcount: 5 },
    ]);
    expect(r10.daysUsed).toBe(1);
  });
  it('hang thiet bi 11 (Han): co KH nhung khong dung ngay 16 -> cells[2] rong', () => {
    const rows = buildEquipmentView(W);
    const r11 = rows.find((r) => r.equipmentId === 11)!;
    expect(r11.color).toBe('var(--s-plan)');
    expect(r11.cells[1]).toEqual([{ contractorId: 1, name: 'A', actualHeadcount: 80 }]);
    expect(r11.cells[2]).toEqual([]);
    expect(r11.daysUsed).toBe(1);
  });
});

describe('buildTrackingSummary', () => {
  it('tong ket dung', () => {
    const s = buildTrackingSummary(W);
    expect(s.from).toBe('2026-09-14');
    expect(s.to).toBe('2026-09-16');
    expect(s.contractorCount).toBe(2);
    expect(s.equipmentCount).toBe(2);
    expect(s.lastDayIsToday).toBe(true);
    expect(s.lastPlanned).toBe(100);
    expect(s.lastActual).toBe(101);
    expect(s.weekRatio).toBeCloseTo(181 / 200, 10);
  });
});
