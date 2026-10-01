import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/server/repo/mock-repo';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

import { __resetJobThrottleForTest, runDueJobs, runJob } from './jobs';

beforeEach(() => {
  vi.clearAllMocks();
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
      const after = Date.now();
      expect(spy).toHaveBeenCalledTimes(1);
      const cutoff = Date.parse(spy.mock.calls[0][0]);
      // Mốc = giờ lúc job chạy trừ 24h; giờ đó nằm giữa 2 lần đọc đồng hồ quanh lời gọi, nên chặn theo [before, after]
      // thay vì dung sai cố định (job chạy chậm vài giây khi máy tải nặng thì dung sai cố định 1s bị vỡ).
      expect(cutoff).toBeGreaterThanOrEqual(before - 24 * 3_600_000);
      expect(cutoff).toBeLessThanOrEqual(after - 24 * 3_600_000);
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

describe('don dang ky cho qua 14 ngay trong runJob (S3)', () => {
  it('goi pruneStale voi moc now - 14 ngay va ghi nhat ky signup_expire khi co dong bi xoa', async () => {
    const { getSignupStore } = await import('./signup-store');
    const { logActivity } = await import('@/lib/activity');
    const spy = vi.spyOn(getSignupStore(), 'pruneStale').mockResolvedValue(3);
    const log = vi.mocked(logActivity);
    try {
      const before = Date.now();
      await runJob('alerts_daily', 'cron');
      const after = Date.now();
      expect(spy).toHaveBeenCalledTimes(1);
      const cutoff = Date.parse(spy.mock.calls[0][0]);
      expect(cutoff).toBeGreaterThanOrEqual(before - 14 * 24 * 3_600_000);
      expect(cutoff).toBeLessThanOrEqual(after - 14 * 24 * 3_600_000);
      expect(log).toHaveBeenCalledWith({ name: 'system', email: 'system' }, 'signup_expire', '3');
    } finally {
      spy.mockRestore();
    }
  });

  it('khong xoa dong nao -> khong ghi nhat ky; pruneStale nem loi -> job VAN ok', async () => {
    const { getSignupStore } = await import('./signup-store');
    const { logActivity } = await import('@/lib/activity');
    const log = vi.mocked(logActivity);
    const spy = vi.spyOn(getSignupStore(), 'pruneStale').mockResolvedValue(0);
    try {
      await runJob('alerts_daily', 'cron');
      expect(log).not.toHaveBeenCalledWith(expect.anything(), 'signup_expire', expect.anything());
      spy.mockRejectedValue(new Error('boom-signup'));
      expect((await runJob('alerts_daily', 'cron')).status).toBe('ok');
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
