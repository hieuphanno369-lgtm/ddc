import { addDaysIso, addMonths, daysBetween } from '@/lib/clock';
import { bucketOf } from '@/lib/daily-series';
import { formatDayMonth } from '@/lib/format';
import { equipmentColor } from '@/lib/tracking';
import type { EquipmentPlanSegment, EquipmentQuota } from '@/lib/p3c-contract';

/**
 * T4 - Gantt thiết bị theo đợt (hợp đồng P3C): 1 hàng = 1 loại thiết bị, mỗi hàng có nhiều đợt sử
 * dụng (chồng ngày -> nhiều lane). Trục thời gian tự động tuần/tháng theo tổng độ dài kế hoạch.
 */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export type GanttAxisMode = 'week' | 'month';
/** "≤ ~3 tháng" (chủ dự án T4c) = tổng số ngày kế hoạch ≤ 92 thì dùng trục tuần, dài hơn -> trục tháng. */
export const WEEK_MODE_MAX_DAYS = 92;

export interface PlanGanttTick { date: string; label: string }
export interface PlanGanttAxis { mode: GanttAxisMode; from: string; toExclusive: string; ticks: PlanGanttTick[]; labelStep: number }
export interface PlanGanttSegment { id: number; from: string; to: string; qty: number; days: number; lane: number }
export interface PlanGanttRow {
  equipmentId: number; name: string; color: string;
  spanFrom: string | null; spanTo: string | null;
  qtyNow: number;
  qtyTotal: number | null;
  lanes: number;
  segments: PlanGanttSegment[];
}
export interface PlanGanttModel { rows: PlanGanttRow[]; axis: PlanGanttAxis; planFrom: string; planTo: string; today: string; todayInRange: boolean }

/** '2026-09-25' -> '25.09' */
export function formatDayMonthDot(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export function buildGanttAxis(planFrom: string, planTo: string): PlanGanttAxis {
  const span = daysBetween(planFrom, planTo) + 1;
  if (span <= WEEK_MODE_MAX_DAYS) {
    const from = bucketOf(planFrom, 'week').from;
    const toExclusive = addDaysIso(bucketOf(planTo, 'week').to, 1);
    const ticks: PlanGanttTick[] = [];
    for (let d = from; d < toExclusive; d = addDaysIso(d, 7)) {
      ticks.push({ date: d, label: formatDayMonth(d) });
    }
    return { mode: 'week', from, toExclusive, ticks, labelStep: Math.max(1, Math.ceil(ticks.length / 16)) };
  }
  const fromYm = planFrom.slice(0, 7);
  const toYmExclusive = addMonths(planTo.slice(0, 7), 1);
  const ticks: PlanGanttTick[] = [];
  for (let ym = fromYm; ym !== toYmExclusive; ym = addMonths(ym, 1)) {
    ticks.push({ date: `${ym}-01`, label: `${ym.slice(5, 7)}.${ym.slice(0, 4)}` });
  }
  return {
    mode: 'month',
    from: `${fromYm}-01`,
    toExclusive: `${toYmExclusive}-01`,
    ticks,
    labelStep: Math.max(1, Math.ceil(ticks.length / 12)),
  };
}

/**
 * Xếp lane cho các đợt chồng ngày (trùng 1 ngày cũng coi là chồng, vì cả 2 đợt cùng dùng ngày đó):
 * sort theo `from` rồi `id`, mỗi đợt vào lane nhỏ nhất có `to` cuối cùng < `from` của đợt; không có
 * thì mở lane mới.
 */
export function assignLanes(segs: { id: number; from: string; to: string }[]): Map<number, number> {
  const sorted = [...segs].sort((a, b) => a.from.localeCompare(b.from) || a.id - b.id);
  const laneEnds: string[] = [];
  const lanes = new Map<number, number>();
  for (const s of sorted) {
    let lane = laneEnds.findIndex((end) => end < s.from);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.to);
    } else {
      laneEnds[lane] = s.to;
    }
    lanes.set(s.id, lane);
  }
  return lanes;
}

export function buildPlanGantt(segments: EquipmentPlanSegment[], quotas: EquipmentQuota[], today: string): PlanGanttModel | null {
  const validSegments = segments.filter(
    (s) => ISO_RE.test(s.from) && ISO_RE.test(s.to) && s.from <= s.to && s.qty >= 1,
  );
  if (validSegments.length === 0) return null;

  const planFrom = validSegments.map((s) => s.from).reduce((m, s) => (s < m ? s : m));
  const planTo = validSegments.map((s) => s.to).reduce((m, s) => (s > m ? s : m));
  const axis = buildGanttAxis(planFrom, planTo);
  const todayInRange = axis.from <= today && today < axis.toExclusive;

  const quotaByEquipment = new Map(quotas.map((q) => [q.equipmentId, q]));
  const segmentsByEquipment = new Map<number, EquipmentPlanSegment[]>();
  for (const s of validSegments) {
    const list = segmentsByEquipment.get(s.equipmentId) ?? [];
    list.push(s);
    segmentsByEquipment.set(s.equipmentId, list);
  }

  const equipmentIds = [...new Set([...segmentsByEquipment.keys(), ...quotaByEquipment.keys()])].sort((a, b) => a - b);

  const rows: PlanGanttRow[] = equipmentIds.map((equipmentId, index) => {
    const segsForRow = segmentsByEquipment.get(equipmentId) ?? [];
    const quota = quotaByEquipment.get(equipmentId);
    const sorted = [...segsForRow].sort((a, b) => a.from.localeCompare(b.from) || a.id - b.id);
    const laneById = assignLanes(sorted);
    const planSegments: PlanGanttSegment[] = sorted.map((s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      qty: s.qty,
      days: daysBetween(s.from, s.to) + 1,
      lane: laneById.get(s.id) ?? 0,
    }));

    return {
      equipmentId,
      name: sorted[0]?.equipmentName ?? quota?.equipmentName ?? `#${equipmentId}`,
      color: equipmentColor(index),
      spanFrom: sorted.length ? sorted.map((s) => s.from).reduce((m, f) => (f < m ? f : m)) : null,
      spanTo: sorted.length ? sorted.map((s) => s.to).reduce((m, t) => (t > m ? t : m)) : null,
      qtyNow: sorted.filter((s) => s.from <= today && today <= s.to).reduce((sum, s) => sum + s.qty, 0),
      qtyTotal: quota?.totalQty ?? null,
      lanes: planSegments.length ? Math.max(...planSegments.map((s) => s.lane)) + 1 : 1,
      segments: planSegments,
    };
  });

  return { rows, axis, planFrom, planTo, today, todayInRange };
}
