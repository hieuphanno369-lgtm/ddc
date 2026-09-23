import { APP_TIMEZONE, type IsoDate } from '@/lib/clock';

/** Mock-up dòng 1343: đếm tới TARGET + "T17:00:00". */
export const COUNTDOWN_HOUR = '17:00:00';
/** Asia/Ho_Chi_Minh cố định UTC+7, không có giờ mùa hè. */
const APP_UTC_OFFSET = '+07:00';
const DAY_MS = 86_400_000;
const appDate = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const startOfAppDay = (iso: string) => Date.parse(`${iso}T00:00:00${APP_UTC_OFFSET}`);

export function countdownTargetMs(target: IsoDate): number {
  return Date.parse(`${target.slice(0, 10)}T${COUNTDOWN_HOUR}${APP_UTC_OFFSET}`);
}

/**
 * Độ lệch giữa "hôm nay" của app (clock.ts, có thể bị DDC_FAKE_TODAY ghim ngoài production) và hôm
 * nay thật theo giờ VN. Production luôn 0. Cộng vào Date.now() để đồng hồ chạy từng giây nhưng vẫn
 * khớp ngày với %KH / "Hôm nay" trên cùng trang.
 */
export function clockOffsetMs(appToday: IsoDate, realNowMs: number): number {
  return startOfAppDay(appToday) - startOfAppDay(appDate.format(new Date(realNowMs)));
}

export interface CountdownParts { days: number; hours: number; minutes: number; seconds: number; done: boolean }

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const ms = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor((ms % DAY_MS) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    done: ms === 0,
  };
}
