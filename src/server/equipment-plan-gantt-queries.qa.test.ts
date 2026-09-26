import { describe, expect, it, vi } from 'vitest';

/**
 * Test doc lap (Tester) cho getEquipmentPlanGantt - Buoc 11.
 * Khac voi equipment-plan-gantt-queries.test.ts (coder viet, dung du lieu seed du an 1/17),
 * file nay dung vi.spyOn tren repo de dung duoc cac truong hop bien ma seed khong co san
 * (quota khong dot, dot khong quota, dot toan hong, du an khong co ke hoach).
 */

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getEquipmentPlanGantt } from './equipment-plan-gantt-queries';

const TODAY = '2026-09-16';

describe('getEquipmentPlanGantt - duong chay thuan loi', () => {
  it('co segments + quota khop nhau -> tra model dung, khong null', async () => {
    vi.spyOn(repo, 'readEquipmentPlanSegments').mockResolvedValueOnce([
      { id: 1, equipmentId: 1, equipmentName: 'Cau banh xich', from: '2026-09-01', to: '2026-09-10', qty: 2 },
    ]);
    vi.spyOn(repo, 'readEquipmentQuotas').mockResolvedValueOnce([
      { equipmentId: 1, equipmentName: 'Cau banh xich', totalQty: 2 },
    ]);
    const model = await getEquipmentPlanGantt(1, TODAY);
    expect(model).not.toBeNull();
    expect(model!.rows).toHaveLength(1);
    expect(model!.rows[0].qtyTotal).toBe(2);
  });
});

describe('getEquipmentPlanGantt - truong hop bien (T4)', () => {
  it('khong co ke hoach (segments rong, quota rong) -> null', async () => {
    vi.spyOn(repo, 'readEquipmentPlanSegments').mockResolvedValueOnce([]);
    vi.spyOn(repo, 'readEquipmentQuotas').mockResolvedValueOnce([]);
    const model = await getEquipmentPlanGantt(999, TODAY);
    expect(model).toBeNull();
  });

  it('quota co nhung toan bo dot hong (to < from) -> van null (khong co dot hop le nao de ve truc)', async () => {
    vi.spyOn(repo, 'readEquipmentPlanSegments').mockResolvedValueOnce([
      { id: 1, equipmentId: 1, equipmentName: 'Cau banh xich', from: '2026-09-10', to: '2026-09-01', qty: 1 },
    ]);
    vi.spyOn(repo, 'readEquipmentQuotas').mockResolvedValueOnce([
      { equipmentId: 1, equipmentName: 'Cau banh xich', totalQty: 3 },
    ]);
    const model = await getEquipmentPlanGantt(999, TODAY);
    expect(model).toBeNull();
  });

  it('quota khong co dot (thiet bi 9) + dot khong co quota (thiet bi 1) -> ca 2 hang cung xuat hien, dung nhu ke hoach', async () => {
    vi.spyOn(repo, 'readEquipmentPlanSegments').mockResolvedValueOnce([
      { id: 1, equipmentId: 1, equipmentName: 'Cau banh xich', from: '2026-09-01', to: '2026-09-10', qty: 1 },
    ]);
    vi.spyOn(repo, 'readEquipmentQuotas').mockResolvedValueOnce([
      { equipmentId: 9, equipmentName: 'Xe cau banh lop', totalQty: 5 },
    ]);
    const model = await getEquipmentPlanGantt(999, TODAY);
    expect(model).not.toBeNull();
    const rowNoQuota = model!.rows.find((r) => r.equipmentId === 1)!;
    const rowNoSegment = model!.rows.find((r) => r.equipmentId === 9)!;
    expect(rowNoQuota.qtyTotal).toBeNull();
    expect(rowNoSegment.segments).toEqual([]);
    expect(rowNoSegment.qtyNow).toBe(0);
  });

  it('du an 17 (khong co du lieu that trong mock-repo) -> null (duong chay that qua repo, khong mock)', async () => {
    vi.restoreAllMocks();
    const model = await getEquipmentPlanGantt(17, TODAY);
    expect(model).toBeNull();
  });
});

describe('getEquipmentPlanGantt - du an 1 that (dung cho test RED o EquipmentPlanGantt.qa.test.ts)', () => {
  it('du an 1: truc luon bat dau dung ngay mung 1 cua thang (tien de cho bug header/tick trung nhau)', async () => {
    vi.restoreAllMocks();
    const model = await getEquipmentPlanGantt(1, TODAY);
    expect(model).not.toBeNull();
    expect(model!.axis.mode).toBe('month');
    // Tick dau tien luon = axis.from, va axis.from (che do thang) luon la ngay mung 1.
    // Day la NGUYEN NHAN GOC cua bug trinh bay o EquipmentPlanGantt.qa.test.ts: xOf(axis.from,...)
    // luon bang toa do trai cua vung ve (ML), trung voi vi tri cot header "SL nay/tong".
    expect(model!.axis.from.endsWith('-01')).toBe(true);
    expect(model!.axis.ticks[0].date).toBe(model!.axis.from);
  });
});
