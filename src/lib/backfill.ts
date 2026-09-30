import { addMonths, isValidIsoDate, type IsoDate } from '@/lib/clock';

/** P4 (Q12): khoảng nhập bù tối đa 24 tháng (tính theo tháng lịch chạm tới), tự hết hiệu lực sau 30 ngày. */
export const BACKFILL_MAX_MONTHS = 24;
export const BACKFILL_EXPIRE_DAYS = 30;
export const BACKFILL_NOTE_MIN = 5;
export const BACKFILL_NOTE_MAX = 500;

export type BackfillRangeError = 'invalid' | 'too_long';

/** Kiểm khoảng nhập bù: ngày hợp lệ, from <= to, to <= hôm nay (nhập bù là quá khứ), không quá 24 tháng. */
export function checkBackfillRange(from: string, to: string, today: IsoDate): BackfillRangeError | null {
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return 'invalid';
  if (from > to || to > today) return 'invalid';
  const months = monthSpan(from.slice(0, 7), to.slice(0, 7));
  return months > BACKFILL_MAX_MONTHS ? 'too_long' : null;
}

/** Số tháng lịch từ `fromYm` tới `toYm` (gồm cả hai đầu). */
function monthSpan(fromYm: string, toYm: string): number {
  let n = 1;
  for (let m = fromYm; m < toYm; m = addMonths(m, 1)) n++;
  return n;
}

/** Thời điểm tự hết hiệu lực của khoảng bật lúc `now`. */
export function backfillExpiresAt(now: Date): Date {
  return new Date(now.getTime() + BACKFILL_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
}

export type BackfillState = 'active' | 'disabled' | 'expired';

/** Trạng thái 1 khoảng tại `now`: đã tắt > hết hạn > đang bật. */
export function backfillState(w: { disabledAt: string | null; expiresAt: string | null }, now: Date): BackfillState {
  if (w.disabledAt != null) return 'disabled';
  if (w.expiresAt != null && new Date(w.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'active';
}
