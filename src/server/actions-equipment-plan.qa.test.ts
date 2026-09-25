import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { EquipmentPlanInput } from '@/server/repo/types';
import type { ReadRepo } from '@/server/repo/read-types';

/**
 * Kiem thu doc lap Task 10/12 (P3A) - bo sung 2 kich ban ma `actions-equipment-plan.test.ts` cua
 * coder CHUA cham o TANG ACTION (coder da kiem trung ngay o tang thuan `equipment-plan.test.ts`,
 * nhung chua kiem action THAT SU tra ve overlaps, va chua kiem tinh "khong luu mot phan" khi 1
 * dong sai - dung nhu yeu cau "transaction" trong ke hoach).
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

const ROW = (over: Partial<EquipmentPlanInput> = {}): EquipmentPlanInput => ({
  equipmentId: 1, unitNo: 77, workItemId: null, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '', ...over,
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  login(ADMIN);
});

describe('saveEquipmentPlansAction - chan trung ngay cung chiec o tang action', () => {
  it('2 dong cung (equipmentId, unitNo) chong ngay -> invalid_rows kem overlaps [[0,1]], KHONG dong nao duoc luu (giu nguyen du lieu seed cu)', async () => {
    const before = await repo.readEquipmentPlans(1);
    const rows: EquipmentPlanInput[] = [
      ROW({ equipmentId: 1, unitNo: 77, plannedStart: '2026-09-01', plannedFinish: '2026-09-10' }),
      ROW({ equipmentId: 1, unitNo: 77, plannedStart: '2026-09-05', plannedFinish: '2026-09-15' }),
    ];
    const res = await saveEquipmentPlansAction(1, rows);
    expect(res).toMatchObject({ ok: false, error: 'invalid_rows', overlaps: [[0, 1]] });
    const saved = await repo.readEquipmentPlans(1);
    // Khong bi ghi de: van dung so dong seed cu, khong co dong unitNo 77 nao lot vao.
    expect(saved).toEqual(before);
    expect(saved.some((p) => p.unitNo === 77)).toBe(false);
  });

  it('tinh atomicity: da co 1 dong hop le tu truoc, gui lai payload MOI co 1 dong sai -> giu nguyen du lieu CU (khong bi xoa mat)', async () => {
    // Buoc 1: luu thanh cong 1 dong hop le.
    const firstSave = await saveEquipmentPlansAction(1, [ROW({ equipmentId: 1, unitNo: 78 })]);
    expect(firstSave).toEqual({ ok: true, count: 1 });
    const afterFirst = await repo.readEquipmentPlans(1);
    expect(afterFirst).toHaveLength(1);

    // Buoc 2: gui payload MOI (thay toan bo) nhung co 1 dong equipmentId khong ton tai -> invalid_rows.
    const badSave = await saveEquipmentPlansAction(1, [
      ROW({ equipmentId: 1, unitNo: 78 }),
      ROW({ equipmentId: 999999, unitNo: 79 }),
    ]);
    expect(badSave.ok).toBe(false);

    // Du lieu CU (buoc 1) phai con nguyen - khong bi xoa truoc khi validate that bai (replaceEquipmentPlans
    // chi duoc goi SAU khi validateEquipmentPlans().ok, nen action khong lam mat du lieu cu).
    const afterBad = await repo.readEquipmentPlans(1);
    expect(afterBad).toHaveLength(1);
    expect(afterBad[0].unitNo).toBe(78);
  });
});
