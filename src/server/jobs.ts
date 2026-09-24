import { currentMonth } from '@/lib/clock';
import { missingRateCurrencies } from '@/lib/fx';
import { isRatesDue } from '@/lib/job-schedule';
import type { JobName, JobTrigger } from './repo/types';
import { repo } from './repo';
import { refreshMonthRates } from './fx-rates';

/** Chạy 1 job, luôn ghi job_run (running → ok/error) - KHÔNG BAO GIỜ throw. */
export async function runJob(
  name: JobName,
  trigger: JobTrigger,
  by = 'system',
  deps?: { fetchImpl?: typeof fetch },
): Promise<{ status: 'ok' | 'error'; detail: string }> {
  const id = await repo.startJobRun(name, trigger, by);
  try {
    let result: { status: 'ok' | 'error'; detail: string };
    if (name === 'rates_monthly') {
      const r = await refreshMonthRates(currentMonth(), by, deps?.fetchImpl);
      result = r.ok
        ? { status: 'ok', detail: `saved ${r.saved.join(',') || '-'}; manual: ${r.keptManual.join(',') || '-'}; missing: ${r.missingFromSource.join(',') || '-'}` }
        : { status: 'error', detail: `${r.error}: ${r.detail}` };
    } else {
      // 'alerts_daily' - Task 8 se thay bang engine that (chua co o Task 7).
      result = { status: 'error', detail: 'unknown_job' };
    }
    await repo.finishJobRun(id, result.status, result.detail);
    return result;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await repo.finishJobRun(id, 'error', detail);
    return { status: 'error', detail };
  }
}

const THROTTLE_MS = 10 * 60_000;

type JobsGlobal = { __ddcJobsCheckedAt?: number; __ddcJobsBusy?: boolean };
const g = globalThis as unknown as JobsGlobal;

export function __resetJobThrottleForTest(): void {
  g.__ddcJobsCheckedAt = undefined;
  g.__ddcJobsBusy = false;
}

/** Chạy "lười" khi có người mở app - tối đa 1 lần/10 phút/tiến trình. KHÔNG BAO GIỜ throw. */
export async function runDueJobs(trigger: 'lazy' | 'cron'): Promise<void> {
  const now = Date.now();
  if (g.__ddcJobsBusy) return;
  if (g.__ddcJobsCheckedAt != null && now - g.__ddcJobsCheckedAt < THROTTLE_MS) return;
  g.__ddcJobsCheckedAt = now;
  g.__ddcJobsBusy = true;
  try {
    const ym = currentMonth();
    const [rates, ratesRuns] = await Promise.all([repo.getExchangeRates(), repo.getRecentJobRuns('rates_monthly', 5)]);
    const missing = missingRateCurrencies(rates, ym).length > 0;
    if (isRatesDue(ratesRuns, missing, new Date())) {
      await runJob('rates_monthly', trigger, 'system');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[jobs] runDueJobs loi (khong lam vo trang):', e);
  } finally {
    g.__ddcJobsBusy = false;
  }
}
