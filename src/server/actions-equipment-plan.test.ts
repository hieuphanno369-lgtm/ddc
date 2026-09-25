import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { EquipmentPlanInput } from '@/server/repo/types';
import type { ReadRepo } from '@/server/repo/read-types';

// `mock-repo.ts` gắn các hàm đọc (read-mock.ts) qua Object.assign SAU khi `repo` đã có kiểu tĩnh,
// nên TS không thấy `readEquipmentPlans` trên `repo` - ép kiểu để gọi được (khuôn read-mock.test.ts).
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
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

const ROW = (over: Partial<EquipmentPlanInput> = {}): EquipmentPlanInput => ({
  equipmentId: 1, unitNo: 90, workItemId: null, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '', ...over,
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveEquipmentPlansAction - quyen', () => {
  it('admin -> ok', async () => {
    login(ADMIN);
    const res = await saveEquipmentPlansAction(1, [ROW()]);
    expect(res.ok).toBe(true);
  });

  it('pm@ la PIC du an 1 -> ok', async () => {
    login(PM);
    const res = await saveEquipmentPlansAction(1, [ROW()]);
    expect(res.ok).toBe(true);
  });

  it('pm@ khong duoc gan du an 16 -> Forbidden', async () => {
    login(PM);
    const res = await saveEquipmentPlansAction(16, [ROW()]);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    expect(await saveEquipmentPlansAction(1, [ROW()])).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod -> Forbidden', async () => {
    login(BOD);
    expect(await saveEquipmentPlansAction(1, [ROW()])).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('saveEquipmentPlansAction - luat + hanh vi', () => {
  beforeEach(() => login(ADMIN));

  it('equipmentId khong ton tai -> invalid_rows kem errors', async () => {
    const res = await saveEquipmentPlansAction(1, [ROW({ equipmentId: 999 })]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('invalid_rows');
      expect(res.errors?.[0]).toContain('equipmentId');
    }
  });

  it('workItemId thuoc du an khac (du an 16 khong co hang muc nao) -> invalid_rows', async () => {
    const res = await saveEquipmentPlansAction(16, [ROW({ workItemId: 1 })]);
    // du an 16 khong phai admin-only? admin luon vao duoc; nhung workItemId=1 thuoc du an 1 -> khong hop le o du an 16.
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_rows');
  });

  it('luu 2 dong hop le -> readEquipmentPlans(1) tra dung 2 dong, audit co project_equipment_plan', async () => {
    const rows: EquipmentPlanInput[] = [ROW({ equipmentId: 1, unitNo: 91 }), ROW({ equipmentId: 2, unitNo: 92 })];
    const res = await saveEquipmentPlansAction(1, rows);
    expect(res).toEqual({ ok: true, count: 2 });
    const saved = await repo.readEquipmentPlans(1);
    expect(saved).toHaveLength(2);
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_equipment_plan');
    expect(entry).toBeTruthy();
  });
});
