import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { EquipmentPlanGroupInput, ManpowerPlanInput } from '@/server/repo/types';
import type { ReadRepo } from '@/server/repo/read-types';

/**
 * Kiem thu doc lap (Tester, P3C-A) - quyen ghi cua saveEquipmentPlansAction va
 * saveManpowerPlanAction: CHI admin hoac data-entry duoc GAN PIC/Backup du an do moi duoc sua.
 * Doc lap voi `actions-equipment-plan.test.ts`, `actions-manpower-plan.test.ts` cua coder.
 */
const repo = mockRepo as typeof mockRepo & ReadRepo;

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { saveEquipmentPlansAction, saveManpowerPlanAction } from '@/server/actions-entry';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PM_PIC_1: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

const EQUIP_GROUPS = (): EquipmentPlanGroupInput[] => [
  { equipmentId: 4, totalQty: 5, segments: [{ from: '2026-09-01', to: '2026-09-10', qty: 2 }] },
];
const MANPOWER_INPUT = (): ManpowerPlanInput => ({
  ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
  months: [{ yearMonth: '2027-01', cells: [{ shiftCode: 'morning', planned: 60, isManual: false }, { shiftCode: 'evening', planned: 40, isManual: false }] }],
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveEquipmentPlansAction - quyen ghi', () => {
  it('admin sua duoc BAT KY du an nao', async () => {
    login(ADMIN);
    const res = await saveEquipmentPlansAction(1, EQUIP_GROUPS());
    expect(res.ok).toBe(true);
  });

  it('data-entry la PIC du an 1 (pm@) sua duoc du an cua minh', async () => {
    login(PM_PIC_1);
    const res = await saveEquipmentPlansAction(1, EQUIP_GROUPS());
    expect(res.ok).toBe(true);
  });

  it('data-entry KHONG duoc gan du an 16 (pm@ khong phai PIC/Backup o day) -> Forbidden', async () => {
    login(PM_PIC_1);
    const res = await saveEquipmentPlansAction(16, EQUIP_GROUPS());
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer khong bao gio duoc sua, ke ca du an minh duoc gan Backup de doc (du an 1) -> Forbidden', async () => {
    login(VIEWER);
    const res = await saveEquipmentPlansAction(1, EQUIP_GROUPS());
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod (lanh dao, chi doc) -> Forbidden', async () => {
    login(BOD);
    const res = await saveEquipmentPlansAction(1, EQUIP_GROUPS());
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('chua dang nhap (null) -> Forbidden, khong duoc lam rot ra 500', async () => {
    login(null);
    const res = await saveEquipmentPlansAction(1, EQUIP_GROUPS());
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('saveManpowerPlanAction - quyen ghi (cung luat requireWriteProject)', () => {
  it('admin sua duoc', async () => {
    login(ADMIN);
    const res = await saveManpowerPlanAction(1, MANPOWER_INPUT());
    expect(res.ok).toBe(true);
  });

  it('data-entry la PIC du an 1 sua duoc', async () => {
    login(PM_PIC_1);
    const res = await saveManpowerPlanAction(1, MANPOWER_INPUT());
    expect(res.ok).toBe(true);
  });

  it('data-entry khong duoc gan du an 16 -> Forbidden', async () => {
    login(PM_PIC_1);
    const res = await saveManpowerPlanAction(16, MANPOWER_INPUT());
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    const res = await saveManpowerPlanAction(1, MANPOWER_INPUT());
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('Truong hop PHAI THAT BAI bat buoc: payload sai kieu bi zod chan truoc khi cham repo', () => {
  it('saveEquipmentPlansAction voi totalQty am -> Invalid input (zod), KHONG goi toi validateEquipmentPlan/replace', async () => {
    login(ADMIN);
    const res = await saveEquipmentPlansAction(1, [{ equipmentId: 4, totalQty: -1, segments: [] }] as EquipmentPlanGroupInput[]);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('saveManpowerPlanAction voi planned am -> Invalid input (zod)', async () => {
    login(ADMIN);
    const bad: ManpowerPlanInput = {
      ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
      months: [{ yearMonth: '2027-02', cells: [{ shiftCode: 'morning', planned: -1, isManual: false }, { shiftCode: 'evening', planned: 40, isManual: false }] }],
    };
    const res = await saveManpowerPlanAction(1, bad);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });
});
