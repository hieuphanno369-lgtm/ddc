import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { EquipmentPlanGroupInput } from '@/server/repo/types';
import type { ReadRepo } from '@/server/repo/read-types';

// `mock-repo.ts` gắn các hàm đọc (read-mock.ts) qua Object.assign SAU khi `repo` đã có kiểu tĩnh,
// nên TS không thấy `readEquipmentPlanSegments` trên `repo` - ép kiểu để gọi được (khuôn read-mock.test.ts).
const repo = mockRepo as typeof mockRepo & ReadRepo;

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { saveEquipmentPlansAction } from '@/server/actions-entry';
import { saveEquipmentPlansSchema } from '@/server/validation';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

const GROUP = (over: Partial<EquipmentPlanGroupInput> = {}): EquipmentPlanGroupInput => ({
  equipmentId: 4, totalQty: 5, segments: [{ from: '2026-09-01', to: '2026-09-10', qty: 2 }], ...over,
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveEquipmentPlansAction - quyen', () => {
  it('admin -> ok', async () => {
    login(ADMIN);
    const res = await saveEquipmentPlansAction(1, [GROUP()]);
    expect(res.ok).toBe(true);
  });

  it('pm@ la PIC du an 1 -> ok', async () => {
    login(PM);
    const res = await saveEquipmentPlansAction(1, [GROUP()]);
    expect(res.ok).toBe(true);
  });

  it('pm@ khong duoc gan du an 16 -> Forbidden', async () => {
    login(PM);
    const res = await saveEquipmentPlansAction(16, [GROUP()]);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    expect(await saveEquipmentPlansAction(1, [GROUP()])).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod -> Forbidden', async () => {
    login(BOD);
    expect(await saveEquipmentPlansAction(1, [GROUP()])).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('saveEquipmentPlansAction - luat + hanh vi', () => {
  beforeEach(() => login(ADMIN));

  it('equipmentId khong ton tai -> invalid_plan, check.groupErrors[0] co equipmentId', async () => {
    const res = await saveEquipmentPlansAction(1, [GROUP({ equipmentId: 999 })]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('invalid_plan');
      expect(res.check?.groupErrors[0]).toContain('equipmentId');
    }
  });

  it('2 dot chong vuot Tong SL -> invalid_plan, overload dung, du lieu cu khong doi', async () => {
    const before = await repo.readEquipmentPlanSegments(1);
    const res = await saveEquipmentPlansAction(1, [{
      equipmentId: 4, totalQty: 3,
      segments: [
        { from: '2026-09-01', to: '2026-09-10', qty: 2 },
        { from: '2026-09-05', to: '2026-09-15', qty: 2 },
      ],
    }]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('invalid_plan');
      expect(res.check?.overloads[0]).toMatchObject({ from: '2026-09-05', to: '2026-09-10', used: 4, total: 3 });
    }
    expect(await repo.readEquipmentPlanSegments(1)).toEqual(before);
  });

  it('payload totalQty 0 -> Invalid input (zod)', async () => {
    const res = await saveEquipmentPlansAction(1, [GROUP({ totalQty: 0 })]);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('luu hop le 2 nhom (1 nhom 0 dot) -> ok, doc lai dung, audit co "tong"', async () => {
    const res = await saveEquipmentPlansAction(1, [
      { equipmentId: 4, totalQty: 5, segments: [{ from: '2026-09-01', to: '2026-09-10', qty: 2 }] },
      { equipmentId: 5, totalQty: 3, segments: [] },
    ]);
    expect(res).toEqual({ ok: true, groups: 2, segments: 1 });
    const quotas = await repo.readEquipmentQuotas(1);
    expect(quotas).toHaveLength(2);
    expect(quotas.map((q) => [q.equipmentId, q.totalQty])).toEqual([[4, 5], [5, 3]]);
    const segments = await repo.readEquipmentPlanSegments(1);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ equipmentId: 4, from: '2026-09-01', to: '2026-09-10', qty: 2 });
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_equipment_plan' && a.field === 'replace');
    expect(entry?.newValue).toContain('tong');
  });

  it('luu mang rong -> xoa het quota + dot cua du an do, du an khac khong doi', async () => {
    const otherBefore = await repo.readEquipmentPlanSegments(2);
    const res = await saveEquipmentPlansAction(1, []);
    expect(res).toEqual({ ok: true, groups: 0, segments: 0 });
    expect(await repo.readEquipmentQuotas(1)).toEqual([]);
    expect(await repo.readEquipmentPlanSegments(1)).toEqual([]);
    expect(await repo.readEquipmentPlanSegments(2)).toEqual(otherBefore);
  });
});

describe('saveEquipmentPlansAction - L-1 chan tong so dot truoc khi parse sau', () => {
  beforeEach(() => login(ADMIN));

  const SEG = { from: '2026-09-01', to: '2026-09-02', qty: 1 };
  const many = (n: number) => Array.from({ length: n }, () => SEG);

  it('2 loai x 200 dot (tong 400 > 300) -> Invalid input, repo khong bi goi', async () => {
    const spy = vi.spyOn(repo, 'replaceEquipmentPlans');
    const res = await saveEquipmentPlansAction(1, [
      GROUP({ equipmentId: 4, segments: many(200) }),
      GROUP({ equipmentId: 5, segments: many(200) }),
    ]);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('schema dung ngay o buoc dem: 100 loai x 300 dot rac -> dung 1 loi, khong duyet tung dot', () => {
    const junk = Array.from({ length: 300 }, () => ({ from: 'x', to: 'y', qty: -1 }));
    const groups = Array.from({ length: 100 }, (_, i) => ({ equipmentId: i + 1, totalQty: 1, segments: junk }));
    const r = saveEquipmentPlansSchema.safeParse({ projectId: 1, groups });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues).toHaveLength(1);
      expect(r.error.issues[0].message).toBe('Qua nhieu dot');
    }
  });

  it('dung 300 dot chia 2 loai -> van qua zod (khong chan nham)', () => {
    const r = saveEquipmentPlansSchema.safeParse({
      projectId: 1,
      groups: [
        { equipmentId: 4, totalQty: 5, segments: many(150) },
        { equipmentId: 5, totalQty: 5, segments: many(150) },
      ],
    });
    expect(r.success).toBe(true);
  });
});
