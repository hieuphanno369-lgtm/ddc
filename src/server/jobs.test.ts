import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/server/repo/mock-repo';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { __resetJobThrottleForTest, runDueJobs, runJob } from './jobs';

const XML = `<ExrateList><DateTime>x</DateTime>
<Exrate CurrencyCode="USD" Transfer="25,140.00"/>
<Exrate CurrencyCode="EUR" Transfer="27,500.00"/>
</ExrateList>`;
const fakeFetch = (status: number, body: string) =>
  vi.fn(async () => ({ ok: status < 400, status, text: async () => body }) as Response);

beforeEach(() => {
  repo.reset();
  __resetJobThrottleForTest();
});

describe('runJob', () => {
  it("rates_monthly ok -> ghi 1 job_run 'ok'", async () => {
    const res = await runJob('rates_monthly', 'admin', 'a@x', { fetchImpl: fakeFetch(200, XML) });
    expect(res.status).toBe('ok');
    const runs = repo.getRecentJobRuns('rates_monthly', 5);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('ok');
    expect(runs[0].startedBy).toBe('a@x');
  });

  it('fetch loi -> run error + detail, KHONG throw', async () => {
    const throwing = vi.fn(async () => { throw new Error('boom'); });
    const res = await runJob('rates_monthly', 'admin', 'a@x', { fetchImpl: throwing as unknown as typeof fetch });
    expect(res.status).toBe('error');
    expect(res.detail).toContain('boom');
    expect(repo.getRecentJobRuns('rates_monthly', 5)[0].status).toBe('error');
  });

  it("alerts_daily (Task 7, chua co engine) -> error unknown_job", async () => {
    const res = await runJob('alerts_daily', 'cron');
    expect(res).toEqual({ status: 'error', detail: 'unknown_job' });
  });
});

describe('runDueJobs', () => {
  it('goi 2 lan lien chi chay 1 lan (throttle)', async () => {
    // Xoa het ty gia thang hien tai de chac chan isRatesDue = true lan dau.
    for (const r of repo.getExchangeRates()) repo.deleteExchangeRate(r.currencyCode, r.yearMonth, 'system');
    vi.stubGlobal('fetch', fakeFetch(200, XML));

    try {
      await runDueJobs('lazy');
      const after1 = repo.getRecentJobRuns('rates_monthly', 5).length;
      expect(after1).toBeGreaterThan(0);

      await runDueJobs('lazy');
      const after2 = repo.getRecentJobRuns('rates_monthly', 5).length;
      expect(after2).toBe(after1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
