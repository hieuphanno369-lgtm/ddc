import { todayIso } from '@/lib/clock';
import { isAlertsDailyDue } from '@/lib/job-schedule';
import { AUTH_DATA_RETENTION_MS } from '@/lib/login-policy';
import { errorFields, logger } from '@/lib/logger';
import type { JobName, JobTrigger } from './repo/types';
import { repo } from './repo';
import { runAlertEngine } from './alert-engine';
import { retryPendingNotifications } from './notify/dispatch';
import { getAuthStore } from './auth-store';

/** Chạy 1 job, luôn ghi job_run (running → ok/error) - KHÔNG BAO GIỜ throw. */
export async function runJob(
  name: JobName,
  trigger: JobTrigger,
  by = 'system',
): Promise<{ status: 'ok' | 'error'; detail: string }> {
  const id = await repo.startJobRun(name, trigger, by);
  try {
    const r = await runAlertEngine({});
    await retryPendingNotifications();
    // K19 - dọn auth_throttle + token đặt lại mật khẩu cũ hơn 24 giờ; lỗi ở đây KHÔNG được làm hỏng
    // cả job (bọc try/catch riêng, chỉ log).
    try {
      await getAuthStore().pruneAuthData(new Date(Date.now() - AUTH_DATA_RETENTION_MS).toISOString());
    } catch (e) {
      logger.error('jobs.prune_auth_failed', errorFields(e));
    }
    const result = { status: 'ok' as const, detail: `checked=${r.checked} created=${r.created}` };
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
    const today = todayIso();
    const alertsRuns = await repo.getRecentJobRuns('alerts_daily', 5);
    if (isAlertsDailyDue(alertsRuns, today, new Date())) {
      await runJob('alerts_daily', trigger, 'system');
    }
    await retryPendingNotifications();
  } catch (e) {
    logger.error('jobs.run_due_failed', errorFields(e));
  } finally {
    g.__ddcJobsBusy = false;
  }
}
