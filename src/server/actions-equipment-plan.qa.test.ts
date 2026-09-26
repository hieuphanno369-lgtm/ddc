import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { EquipmentPlanGroupInput } from '@/server/repo/types';
import type { ReadRepo } from '@/server/repo/read-types';

/**
 * Kiem thu doc lap (P3C-A, T4) - bo sung kich ban `actions-equipment-plan.test.ts` cua coder CHUA
 * cham o TANG ACTION: tinh atomicity khi payload MOI co 1 nhom sai (khong duoc xoa mat du lieu cu
 * truoc khi validate xong), dung nhu yeu cau "transaction" trong ke hoach.
 */
const repo = mockRepo as typeof mockRepo & ReadRepo;

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { saveEquipmentPlansAction } from '@/server/actions-entry';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

const GROUP = (over: Partial<EquipmentPlanGroupInput> = {}): EquipmentPlanGroupInput => ({
  equipmentId: 4, totalQty: 5, segments: [{ from: '2026-09-01', to: '2026-09-10', qty: 2 }], ...over,
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  login(ADMIN);
});

describe('saveEquipmentPlansAction - tinh atomicity o tang action', () => {
  it('da luu thanh cong 1 nhom tu truoc, gui lai payload MOI co 1 nhom sai -> giu nguyen du lieu CU (khong bi xoa mat)', async () => {
    // Buoc 1: luu thanh cong 1 nhom hop le.
    const firstSave = await saveEquipmentPlansAction(1, [GROUP({ equipmentId: 4, totalQty: 5 })]);
    expect(firstSave).toEqual({ ok: true, groups: 1, segments: 1 });
    const afterFirst = await repo.readEquipmentQuotas(1);
    expect(afterFirst).toEqual([{ equipmentId: 4, equipmentName: expect.any(String), totalQty: 5 }]);

    // Buoc 2: gui payload MOI (thay toan bo) nhung co 1 nhom equipmentId khong ton tai -> invalid_plan.
    const badSave = await saveEquipmentPlansAction(1, [
      GROUP({ equipmentId: 4, totalQty: 5 }),
      GROUP({ equipmentId: 999999, totalQty: 1, segments: [] }),
    ]);
    expect(badSave.ok).toBe(false);

    // Du lieu CU (buoc 1) phai con nguyen - replaceEquipmentPlans chi duoc goi SAU khi
    // validateEquipmentPlan().ok, nen action khong lam mat du lieu cu.
    const afterBad = await repo.readEquipmentQuotas(1);
    expect(afterBad).toEqual([{ equipmentId: 4, equipmentName: expect.any(String), totalQty: 5 }]);
  });

  it('2 nhom cung equipmentId trong 1 payload -> invalid_plan, du lieu cu khong doi', async () => {
    const before = await repo.readEquipmentQuotas(1);
    const res = await saveEquipmentPlansAction(1, [GROUP({ equipmentId: 4 }), GROUP({ equipmentId: 4 })]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.check?.groupErrors[1]).toContain('equipmentId');
    expect(await repo.readEquipmentQuotas(1)).toEqual(before);
  });
});
