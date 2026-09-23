import { daysBetween, type IsoDate } from '@/lib/clock';

/** Bề rộng tối thiểu (phân số trục) của thanh "Thực tế" để luôn nhìn thấy. */
export const MIN_ACTUAL_BAR = 0.02;

export interface PlanActualTimelineInput {
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  pctActual: number;
  today: IsoDate;
}

export interface PlanActualTimeline {
  /** Vị trí "Hôm nay" trên trục KH, kẹp [0,1]; cũng là bề rộng phần tô đậm `.tlfill`. */
  todayPos: number;
  /** null = chưa có ngày BĐ thực tế. */
  actual: { left: number; width: number } | null;
  /** BĐ TT − BĐ KH (ngày, dương = trễ); null nếu thiếu 1 trong 2 ngày. */
  startDelayDays: number | null;
}

const d10 = (s: string) => s.slice(0, 10);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Hình học khối "Timeline kế hoạch vs thực tế" (mock-up dòng 661-670). Trục = [BĐ KH, HT KH].
 * Thanh TT bắt đầu ở ngày BĐ TT và DÀI TỚI vị trí %TT trên trục (mock-up: left 3% + width 50,5%
 * = 53,5% = %TT), không tới một ngày cụ thể. Thiếu ngày hoặc HT <= BĐ → null (trang giữ hiển thị chữ cũ).
 */
export function buildPlanActualTimeline(i: PlanActualTimelineInput): PlanActualTimeline | null {
  if (!i.plannedStart || !i.plannedFinish) return null;
  const ps = d10(i.plannedStart);
  const span = daysBetween(ps, d10(i.plannedFinish));
  if (span <= 0) return null;
  const todayPos = clamp01(daysBetween(ps, i.today) / span);
  let actual: PlanActualTimeline['actual'] = null;
  if (i.actualStart) {
    let left = clamp01(daysBetween(ps, d10(i.actualStart)) / span);
    const width = Math.max(clamp01(i.pctActual) - left, MIN_ACTUAL_BAR);
    if (left + width > 1) left = 1 - width;
    actual = { left, width };
  }
  return { todayPos, actual, startDelayDays: i.actualStart ? daysBetween(ps, d10(i.actualStart)) : null };
}
