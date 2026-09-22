import { addDaysIso, endOfMonth, type IsoDate } from './clock';

/**
 * Gộp chuỗi số liệu theo ngày thành bucket tuần/tháng cho biểu đồ.
 * Pure function - không chạm repo, không đọc đồng hồ, unit-test được.
 */

export type Bucket = 'week' | 'month';

export interface DailyPoint {
  date: IsoDate;
  planned: number;
  actual: number;
}

export interface SeriesPoint {
  key: string;
  label: string;
  from: IsoDate;
  to: IsoDate;
  planned: number;
  actual: number;
  days: number;
}

/** Nhiều nhà thầu trong cùng một ngày = một điểm: cộng ngang rồi xếp tăng dần theo ngày. */
export function sumByDate(
  rows: { workDate: string; plannedHeadcount: number; actualHeadcount: number }[],
): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    const cur = byDate.get(r.workDate) ?? { date: r.workDate, planned: 0, actual: 0 };
    cur.planned += r.plannedHeadcount;
    cur.actual += r.actualHeadcount;
    byDate.set(r.workDate, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Tuần theo ISO: Thứ Hai → Chủ Nhật. Tháng: ngày 1 → ngày cuối. */
export function bucketOf(date: IsoDate, bucket: Bucket): { from: IsoDate; to: IsoDate } {
  if (bucket === 'month') {
    const ym = date.slice(0, 7);
    return { from: `${ym}-01`, to: endOfMonth(ym) };
  }
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Chủ Nhật
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const from = addDaysIso(date, -backToMonday);
  return { from, to: addDaysIso(from, 6) };
}

/** Nhãn trục X: khoảng ngày thật 'dd.mm - dd.mm'. KHÔNG dùng 'W1'/'W2' - người dùng không đọc được. */
export function rangeLabel(from: IsoDate, to: IsoDate): string {
  const dm = (d: IsoDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return `${dm(from)} - ${dm(to)}`;
}

/**
 * Gộp ngày thành tuần/tháng bằng TRUNG BÌNH mỗi ngày.
 * Nhân lực là số tồn (người có mặt hôm đó), không phải dòng chảy - cộng dồn 7 ngày
 * sẽ ra số người gấp 7 lần.
 */
export function groupByBucket(points: DailyPoint[], bucket: Bucket): SeriesPoint[] {
  const acc = new Map<string, { from: IsoDate; to: IsoDate; planned: number; actual: number; days: number }>();
  for (const pt of points) {
    const { from, to } = bucketOf(pt.date, bucket);
    const cur = acc.get(from) ?? { from, to, planned: 0, actual: 0, days: 0 };
    cur.planned += pt.planned;
    cur.actual += pt.actual;
    cur.days += 1;
    acc.set(from, cur);
  }
  return [...acc.values()]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((b) => ({
      key: b.from,
      label: rangeLabel(b.from, b.to),
      from: b.from,
      to: b.to,
      planned: Math.round(b.planned / b.days),
      actual: Math.round(b.actual / b.days),
      days: b.days,
    }));
}

/** Badge năm cho góc chart - nhãn trục X cố tình không có năm nên phải ghi ở đây. */
export function yearsLabel(points: SeriesPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0].from.slice(0, 4);
  const last = points[points.length - 1].to.slice(0, 4);
  return first === last ? first : `${first} - ${last}`;
}
