import { addMonths, type IsoDate } from '@/lib/clock';

export interface MonthTick { date: IsoDate; label: string | null }

/** Ngày 1 của mọi tháng trong [from, to]; nhãn 'MM/YY' chỉ ở tháng lẻ (mock-up dòng 1427, 2129). */
export function monthTicks(from: IsoDate, to: IsoDate): MonthTick[] {
  const out: MonthTick[] = [];
  let ym = from.slice(0, 7);
  if (`${ym}-01` < from) ym = addMonths(ym, 1);
  while (`${ym}-01` <= to) {
    out.push({ date: `${ym}-01`, label: Number(ym.slice(5, 7)) % 2 === 1 ? `${ym.slice(5, 7)}/${ym.slice(2, 4)}` : null });
    ym = addMonths(ym, 1);
  }
  return out;
}
