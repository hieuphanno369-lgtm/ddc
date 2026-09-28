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

describe('pruneAuthData trong runJob (K19)', () => {
  it("alerts_daily goi getAuthStore().pruneAuthData voi moc 'now - 24h'", async () => {
    const { getAuthStore } = await import('./auth-store');
    const spy = vi.spyOn(getAuthStore(), 'pruneAuthData').mockResolvedValue(undefined);
    try {
      const before = Date.now();
      await runJob('alerts_daily', 'cron');
      expect(spy).toHaveBeenCalledTimes(1);
      const beforeIso = spy.mock.calls[0][0];
      const deltaMs = before - Date.parse(beforeIso);
      expect(deltaMs).toBeGreaterThanOrEqual(24 * 3_600_000 - 1000);
      expect(deltaMs).toBeLessThanOrEqual(24 * 3_600_000 + 5000);
    } finally {
      spy.mockRestore();
    }
  });

  it('pruneAuthData nem loi - job VAN ok, khong lam hong job chinh', async () => {
    const { getAuthStore } = await import('./auth-store');
    const spy = vi.spyOn(getAuthStore(), 'pruneAuthData').mockRejectedValue(new Error('boom-prune'));
    try {
      const res = await runJob('alerts_daily', 'cron');
      expect(res.status).toBe('ok');
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
      // Task 8: JobName gio chi con 'alerts_daily' - ep kieu de van kiem duoc khong con job_run ten cu.
      expect(repo.getRecentJobRuns('rates_monthly' as never, 5)).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
