import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * saveMonthlyData - session + repo + cache được mock để test tầng action như một đơn vị
 * hành vi: action phải từ chối trước khi chạm DB khi không đủ quyền.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { saveMonthlyData } from '@/server/actions';

const YM = '2026-09';

const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveMonthlyData - luu tao moi khi chua co dong fact/tai chinh', () => {
  it('du an moi chua co thang nao - luu duoc ca fact lan tai chinh', async () => {
    login(ADMIN);
    const created = repo.createProject({
      projectName: 'Du an test P1A', customerId: 1, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 100,
    });
    const res = await saveMonthlyData(created.id, '2026-09', { pctPlan: 0.1, revenueCumulative: 3 });
    expect(res).toEqual({ ok: true });
    expect(repo.getLatestFact(created.id, '2026-09')).toBeDefined();
    expect(repo.getFinancial(created.id).find((f) => f.yearMonth === '2026-09')).toBeDefined();
  });

  it('du an khong ton tai -> Not found', async () => {
    login(ADMIN);
    const res = await saveMonthlyData(999999, '2026-09', { pctPlan: 0.1 });
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('saveMonthlyData - T8 (Task 6, P2A): khu vuc san xuat + san luong', () => {
  it('PIC gui { factoryId: 2, volumeTonnage: 120 } du an 1 -> ok, ghi ca 2', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await saveMonthlyData(1, YM, { factoryId: 2, volumeTonnage: 120 });
    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.factoryId).toBe(2);
    expect(repo.getVolumes(1, YM).find((v) => v.factoryId === 2)?.tonnageProcessed).toBe(120);
  });

  it('du an moi (factoryId null) chi gui volumeTonnage -> no_factory, khong ghi gi', async () => {
    login(ADMIN);
    const created = repo.createProject({
      projectName: 'Du an chua co khu vuc', customerId: 1, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 100,
    });
    const before = repo.getFacts(created.id).length;
    const res = await saveMonthlyData(created.id, YM, { volumeTonnage: 50 });
    expect(res).toEqual({ ok: false, error: 'no_factory' });
    expect(repo.getFacts(created.id).length).toBe(before);
  });

  it('factory da ngung dung -> invalid_factory', async () => {
    login(ADMIN);
    repo.setFactoryActive(1, false, 'admin@daidung.com.vn');
    const res = await saveMonthlyData(1, YM, { factoryId: 1 });
    expect(res).toEqual({ ok: false, error: 'invalid_factory' });
  });
});

describe('saveMonthlyData - T11 (Task 8, P2A): engine canh bao', () => {
  it("lam SPI < 0.9 cho du an 3 (chua co alert SPI thang nay) -> co alert 'spi_low' moi", async () => {
    login(ADMIN);
    const before = repo.getAlerts().filter((a) => a.projectId === 3 && a.ruleCode === 'spi_low' && !a.closedAt);
    expect(before).toHaveLength(0);

    const weights = repo.getStageWeights(3);
    const chain = weights.map((w) => ({ stageCode: w.stageCode, pctComplete: 0.1, applicable: w.applicable }));
    const res = await saveMonthlyData(3, YM, { chain });

    expect(res).toEqual({ ok: true });
    const after = repo.getAlerts().filter((a) => a.projectId === 3 && a.ruleCode === 'spi_low' && !a.closedAt);
    expect(after).toHaveLength(1);
  });

  it('runAlertEngineSafe bi spy throw -> saveMonthlyData van { ok: true }', async () => {
    login(ADMIN);
    const spy = vi.spyOn(await import('@/server/alert-engine'), 'runAlertEngineSafe').mockRejectedValue(new Error('boom'));
    try {
      const res = await saveMonthlyData(1, YM, { ac: 10 });
      expect(res).toEqual({ ok: true });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('saveMonthlyData - S-4 (P3A vong sua 1): ngay ISO + ten co gioi han, ep VIET HOA', () => {
  it('plannedFinishDate sai dinh dang -> Invalid input, du an khong doi', async () => {
    login(ADMIN);
    const before = repo.getProject(1)!;
    const res = await saveMonthlyData(1, YM, { plannedFinishDate: 'abc' });
    expect(res.ok).toBe(false);
    expect(repo.getProject(1)).toEqual(before);
  });

  it('plannedFinishDate dung dinh dang ISO van luu duoc', async () => {
    login(ADMIN);
    const finish = repo.getProject(1)!.plannedFinishDate!;
    const res = await saveMonthlyData(1, YM, { plannedFinishDate: finish });
    expect(res).toEqual({ ok: true });
  });

  it('projectName rong hoac qua 160 ky tu -> tu choi; chu thuong -> luu VIET HOA', async () => {
    login(ADMIN);
    expect((await saveMonthlyData(1, YM, { projectName: '   ' })).ok).toBe(false);
    expect((await saveMonthlyData(1, YM, { projectName: 'x'.repeat(161) })).ok).toBe(false);
    expect(await saveMonthlyData(1, YM, { projectName: 'ten moi s4' })).toEqual({ ok: true });
    expect(repo.getProject(1)!.projectName).toBe('TEN MOI S4');
  });
});
