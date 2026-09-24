import { APP_TIMEZONE, type IsoDate } from '@/lib/clock';

/**
 * K4 (ke-hoach.md P2A): job định kỳ chạy "lười" khi có người mở app (tối đa 1 lần/10 phút/tiến
 * trình) hoặc qua cron ngoài gọi `/api/cron/[job]`. File THUẦN - không đọc DB/đồng hồ hệ thống.
 */
export interface JobRunLite {
  status: 'running' | 'ok' | 'error';
  startedAt: string; // ISO timestamp
}

/** 'running' quá 30 phút coi như tiến trình cũ đã chết (crash, không kịp finishJobRun). */
export const JOB_STALE_MINUTES = 30;
/** Tỷ giá lỗi (mạng) thì thử lại sau tối thiểu 6 giờ, không spam gọi VCB mỗi lần có người mở app. */
export const RATES_RETRY_HOURS = 6;

/** Ngày theo giờ VN của 1 mốc ISO (en-CA cho ra đúng 'YYYY-MM-DD'). */
export function vnDateOf(isoTs: string): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(isoTs));
}

function isStaleRunning(r: JobRunLite, now: Date): boolean {
  if (r.status !== 'running') return false;
  return now.getTime() - new Date(r.startedAt).getTime() >= JOB_STALE_MINUTES * 60_000;
}

/** Chưa có run 'ok' hoặc 'running' (chưa stale) mang ngày VN = today. */
export function isAlertsDailyDue(runs: JobRunLite[], today: IsoDate, now: Date): boolean {
  const hasCoveringRun = runs.some((r) => {
    if (vnDateOf(r.startedAt) !== today) return false;
    if (r.status === 'ok') return true;
    if (r.status === 'running' && !isStaleRunning(r, now)) return true;
    return false;
  });
  return !hasCoveringRun;
}

/**
 * missing = true VÀ không có run nào (mọi status) trong RATES_RETRY_HOURS giờ qua, trừ 'running'
 * đã stale (coi như không tồn tại - không chặn thử lại).
 */
export function isRatesDue(runs: JobRunLite[], missing: boolean, now: Date): boolean {
  if (!missing) return false;
  const cutoffMs = RATES_RETRY_HOURS * 3_600_000;
  const hasRecentRun = runs.some((r) => {
    if (isStaleRunning(r, now)) return false;
    return now.getTime() - new Date(r.startedAt).getTime() < cutoffMs;
  });
  return !hasRecentRun;
}
