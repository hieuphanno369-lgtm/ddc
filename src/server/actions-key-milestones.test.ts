import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { createProjectAction, saveKeyMilestonesAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

const ROW = { name: 'Mốc A', plannedDate: '2026-09-20', actualDate: null };

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('saveKeyMilestonesAction', () => {
  it('admin, du an 1 -> ok, chi con 1 moc', async () => {
    const res = await saveKeyMilestonesAction(1, [ROW]);
    expect(res).toEqual({ ok: true });
    expect(repo.getKeyMilestones(1).map((m) => m.name)).toEqual(['Mốc A']);
  });

  it('data-entry pm@ la PIC du an 1 -> ok', async () => {
    (getCurrentUser as Mock).mockResolvedValue(PM);
    const res = await saveKeyMilestonesAction(1, [ROW]);
    expect(res.ok).toBe(true);
  });

  it('data-entry pm@ KHONG phai PIC du an 4 -> Forbidden, du an 4 khong doi', async () => {
    (getCurrentUser as Mock).mockResolvedValue(PM);
    const before = repo.getKeyMilestones(4);
    const res = await saveKeyMilestonesAction(4, [ROW]);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getKeyMilestones(4)).toEqual(before);
  });

  it('viewer va bod -> Forbidden', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    expect(await saveKeyMilestonesAction(1, [ROW])).toEqual({ ok: false, error: 'Forbidden' });
    (getCurrentUser as Mock).mockResolvedValue(BOD);
    expect(await saveKeyMilestonesAction(1, [ROW])).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('ten rong -> ok:false, du an 1 van du 5 moc seed', async () => {
    const res = await saveKeyMilestonesAction(1, [{ ...ROW, name: '' }]);
    expect(res.ok).toBe(false);
    expect(repo.getKeyMilestones(1)).toHaveLength(5);
  });

  it('du an khong ton tai -> Not found', async () => {
    const res = await saveKeyMilestonesAction(999, [ROW]);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('createProjectAction voi keyMilestones', () => {
  const base = {
    projectName: 'DU AN TEST', customerId: 1, teamKdId: 1, marketCode: 'TN' as const,
    projectType: 'EPC' as const, priority: 'P1' as const, contractValue: 10,
    tonnage: 100, plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
  };

  it('kem keyMilestones -> du an moi co 1 moc', async () => {
    const res = await createProjectAction({ ...base, keyMilestones: [ROW] });
    expect(res.ok).toBe(true);
    expect(repo.getKeyMilestones(res.id!)).toHaveLength(1);
  });

  it('khong kem keyMilestones -> 0 moc', async () => {
    const res = await createProjectAction(base);
    expect(res.ok).toBe(true);
    expect(repo.getKeyMilestones(res.id!)).toHaveLength(0);
  });
});
