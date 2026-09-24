import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/server/repo/mock-repo';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { runAlertEngine, runAlertEngineSafe } from './alert-engine';

const PROJECT1_PIC = 'pm@daidung.com.vn';
const LAST_SEED_DAY = '2026-09-16'; // = today (DDC_FAKE_TODAY)

beforeEach(() => {
  repo.reset();
});

describe('runAlertEngine', () => {
  it('chay tren seed: created >= 0, chay lan 2 tao 0 (khong trung)', async () => {
    const first = await runAlertEngine({});
    expect(first.checked).toBeGreaterThan(0);
    expect(first.created).toBeGreaterThanOrEqual(0);

    const second = await runAlertEngine({});
    expect(second.created).toBe(0);
  });

  it("alert seed 'spi_low' dang mo khong bi tao trung", async () => {
    const before = repo.getAlerts().filter((a) => a.ruleCode === 'spi_low' && !a.closedAt).length;
    await runAlertEngine({});
    const after = repo.getAlerts().filter((a) => a.ruleCode === 'spi_low' && !a.closedAt).length;
    expect(after).toBe(before);
  });

  it('dong 1 alert engine vua tao roi chay lai -> khong bat lai', async () => {
    // Ha manpower ngay cuoi seed cua du an 1 xuong ~50% de chac chan co alert manpower_low moi.
    const rows = repo.getDailyManpowerByShift(1, LAST_SEED_DAY, LAST_SEED_DAY);
    repo.saveDailyResources(
      1, LAST_SEED_DAY,
      { manpower: rows.map((r) => ({ contractorId: r.contractorId, shiftCode: r.shiftCode, plannedHeadcount: r.plannedHeadcount, actualHeadcount: Math.round(r.actualHeadcount / 2) })), equipment: [] },
      'system', '',
    );

    const first = await runAlertEngine({ projectIds: [1] });
    expect(first.created).toBeGreaterThan(0);
    const created = repo.getAlerts().find((a) => a.projectId === 1 && a.ruleCode === 'manpower_low' && !a.closedAt);
    expect(created).toBeDefined();

    repo.closeAlert(created!.id, 'Đã bổ sung nhân lực', 'admin@daidung.com.vn', '');
    await runAlertEngine({ projectIds: [1] });
    const reopened = repo.getAlerts().filter((a) => a.projectId === 1 && a.ruleCode === 'manpower_low' && !a.closedAt);
    expect(reopened).toHaveLength(0);
  });

  it("manpower_low: owner = email PIC du an 1, deadline = '2026-09-30'", async () => {
    const rows = repo.getDailyManpowerByShift(1, LAST_SEED_DAY, LAST_SEED_DAY);
    repo.saveDailyResources(
      1, LAST_SEED_DAY,
      { manpower: rows.map((r) => ({ contractorId: r.contractorId, shiftCode: r.shiftCode, plannedHeadcount: r.plannedHeadcount, actualHeadcount: Math.round(r.actualHeadcount / 2) })), equipment: [] },
      'system', '',
    );

    await runAlertEngine({ projectIds: [1] });
    const alert = repo.getAlerts().find((a) => a.projectId === 1 && a.ruleCode === 'manpower_low' && !a.closedAt);
    expect(alert).toMatchObject({ owner: PROJECT1_PIC, deadline: '2026-09-30' });
  });
});

describe('runAlertEngineSafe', () => {
  it('khong throw du repo bi loi', async () => {
    const spy = vi.spyOn(repo, 'listProjects').mockImplementation(() => { throw new Error('boom'); });
    try {
      await expect(runAlertEngineSafe(1)).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});
