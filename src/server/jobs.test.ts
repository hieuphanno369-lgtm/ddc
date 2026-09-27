import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/server/repo/mock-repo';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { __resetJobThrottleForTest, runDueJobs, runJob } from './jobs';

beforeEach(() => {
  repo.reset();
  __resetJobThrottleForTest();
});

describe('runJob', () => {
  it("alerts_daily -> ghi run 'ok' detail checked=", async () => {
    const res = await runJob('alerts_daily', 'cron');
    expect(res.status).toBe('ok');
    expect(res.detail).toMatch(/^checked=\d+ created=\d+$/);
    expect(repo.getRecentJobRuns('alerts_daily', 5)[0].status).toBe('ok');
  });

  it('engine alerts_daily throw (spy) -> run error, KHONG throw', async () => {
    const spy = vi.spyOn(await import('./alert-engine'), 'runAlertEngine').mockRejectedValue(new Error('boom'));
    try {
      const res = await runJob('alerts_daily', 'cron');
      expect(res.status).toBe('error');
      expect(res.detail).toContain('boom');
      expect(repo.getRecentJobRuns('alerts_daily', 5)[0].status).toBe('error');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('runDueJobs', () => {
  it('goi 2 lan lien chi chay 1 lan (throttle)', async () => {
    await runDueJobs('lazy');
    const after1 = repo.getRecentJobRuns('alerts_daily', 5).length;
    expect(after1).toBeGreaterThan(0);

    await runDueJobs('lazy');
    const after2 = repo.getRecentJobRuns('alerts_daily', 5).length;
    expect(after2).toBe(after1);
  });

  it('da bo tinh nang tu lay VCB - khong con tao job_run ten rates_monthly, khong goi fetch', async () => {
    for (const r of repo.getExchangeRates()) repo.deleteExchangeRate(r.currencyCode, r.yearMonth, 'system');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      await runDueJobs('lazy');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(repo.getRecentJobRuns('rates_monthly', 5)).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
