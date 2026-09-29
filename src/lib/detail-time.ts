/**
 * Tham số thời gian trang Chi tiết dự án (P4, Q6): kỳ, tháng mốc (tính số theo tháng), ngày (nhóm nguồn lực).
 * HÀM THUẦN: "hôm nay" nhận qua tham số; mọi tham số URL (`from`, `to`, `month`, `day`) được validate ở đây,
 * giá trị rác rơi về mặc định (không ném lỗi, tránh 500).
 * Mặc định: kỳ = cả vòng đời dự án (từ tháng đầu có số hoặc ngày bắt đầu, tới hôm nay), mốc = tháng gần nhất có số.
 */

import { endOfMonth, isValidIsoDate, isValidYearMonth, type IsoDate, type YearMonth } from './clock';
import { parsePeriodChecked, periodAsOfDate, type Period } from './period';

export interface DetailTime {
  period: Period;
  /** from/to có trên URL nhưng không dùng được: trang hiện dòng `period.invalid` (T-6). */
  invalidPeriod: boolean;
  asOfMonth: YearMonth;
  day: IsoDate;
  /** Tháng lớn nhất có số (<= tháng mốc của kỳ); null = dự án chưa có số nào tới mốc. */
  lastDataMonth: YearMonth | null;
}

const min = <T extends string>(a: T, b: T): T => (a <= b ? a : b);
const max = <T extends string>(a: T, b: T): T => (a >= b ? a : b);

export function resolveDetailTime(
  sp: { from?: string; to?: string; month?: string; day?: string },
  project: { plannedStartDate: string | null; actualStartDate: string | null },
  factMonthsAsc: readonly YearMonth[],
  today: IsoDate,
): DetailTime {
  const starts = [project.actualStartDate, project.plannedStartDate]
    .map((d) => (d ? d.slice(0, 10) : null))
    .filter((d): d is IsoDate => d != null && isValidIsoDate(d));
  const firstFact = factMonthsAsc[0] ? (`${factMonthsAsc[0]}-01` as IsoDate) : null;
  const candidates = [...starts, ...(firstFact ? [firstFact] : [])];
  const lifeFrom = candidates.length ? candidates.reduce((a, b) => min(a, b)) : (`${today.slice(0, 7)}-01` as IsoDate);
  // Kỳ mặc định phải có from <= today (dự án bắt đầu trong tương lai thì lấy đầu tháng hiện tại).
  const defaultPeriod: Period = { from: min(lifeFrom, today), to: today };

  const { period, invalid: invalidPeriod } = parsePeriodChecked({ from: sp.from, to: sp.to }, defaultPeriod);
  const asOfCap = periodAsOfDate(period, today); // min(cuối kỳ, hôm nay)
  const capMonth = asOfCap.slice(0, 7);
  const firstMonth = period.from.slice(0, 7);
  const clampMonth = (m: YearMonth) => max(min(m, capMonth), min(firstMonth, capMonth));

  const lastDataMonth = [...factMonthsAsc].reverse().find((m) => m <= capMonth) ?? null;
  const asOfMonth =
    typeof sp.month === 'string' && isValidYearMonth(sp.month) ? clampMonth(sp.month) : (lastDataMonth ?? capMonth);

  const defaultDay = min(endOfMonth(asOfMonth), asOfCap);
  const lowDay = min(period.from, asOfCap);
  const day =
    typeof sp.day === 'string' && isValidIsoDate(sp.day) ? max(min(sp.day, asOfCap), lowDay) : defaultDay;

  return { period, invalidPeriod, asOfMonth, day, lastDataMonth };
}
