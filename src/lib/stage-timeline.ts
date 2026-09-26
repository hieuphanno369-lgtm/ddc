import { daysBetween, endOfMonth, type IsoDate } from '@/lib/clock';
import { STAGE_ORDER, activeStages } from '@/lib/stages';
import { monthTicks, type MonthTick } from '@/lib/time-axis';
import type { ProjectStageWeight, Stage, StageCode, StageMilestoneView } from '@/server/repo/types';

export interface StageTimelineRow {
  stageCode: StageCode;
  weightPct: number | null;          // null = không áp dụng / chưa có trọng số
  plannedStart: IsoDate | null;
  plannedFinish: IsoDate | null;
  actualStart: IsoDate | null;
  actualFinish: IsoDate | null;
  forecastDate: IsoDate | null;
  dayVariance: number | null;        // Q1 Run 1 + Q5 mặc định (a)
}

export function buildStageTimelineRows(
  ms: StageMilestoneView[],
  weights: ProjectStageWeight[],
  order: readonly StageCode[] = STAGE_ORDER,
): StageTimelineRow[] {
  return order.flatMap((code) => {
    const m = ms.find((x) => x.stageCode === code);
    if (!m) return [];
    const w = weights.find((x) => x.stageCode === code);
    return [{
      stageCode: code, weightPct: w && w.applicable ? w.weightPct : null,
      plannedStart: m.plannedStart, plannedFinish: m.plannedFinish,
      actualStart: m.actualStart, actualFinish: m.actualFinish, forecastDate: m.forecastDate,
      dayVariance: m.dayVariance,
    }];
  });
}

export interface TimeDomain { from: IsoDate; to: IsoDate; ticks: MonthTick[] }

/** Trục = ngày 1 của tháng sớm nhất → ngày cuối của tháng muộn nhất (gồm cả hôm nay). */
export function buildTimeDomain(rows: StageTimelineRow[], today: IsoDate): TimeDomain | null {
  const dates = rows.flatMap((r) => [r.plannedStart, r.plannedFinish, r.actualStart, r.actualFinish, r.forecastDate])
    .filter((d): d is IsoDate => !!d);
  if (!dates.length) return null;
  const all = [...dates, today].sort();
  const from = `${all[0].slice(0, 7)}-01`;
  const to = endOfMonth(all[all.length - 1].slice(0, 7));
  return { from, to, ticks: monthTicks(from, to) };
}

export function xOf(date: IsoDate, d: TimeDomain, x0: number, width: number): number {
  return x0 + width * (daysBetween(d.from, date) / Math.max(1, daysBetween(d.from, d.to)));
}

export type StageMarkerKey = 'plannedStart' | 'plannedFinish' | 'actualStart' | 'actualFinish' | 'forecastDate';
export type StageMarkerShape = 'ring' | 'dot' | 'diamondO' | 'diamond' | 'tri';

/** 5 mốc + hình + màu theo MS_KEYS mock-up dòng 1380-1384. */
export const STAGE_MARKERS: { key: StageMarkerKey; lane: 'plan' | 'actual'; color: string; shape: StageMarkerShape; labelKey: string }[] = [
  { key: 'plannedStart', lane: 'plan', color: 'var(--s-plan)', shape: 'ring', labelKey: 'detail.stageMs.plannedStart' },
  { key: 'plannedFinish', lane: 'plan', color: 'var(--s-actual)', shape: 'dot', labelKey: 'detail.stageMs.plannedFinish' },
  { key: 'actualStart', lane: 'actual', color: 'var(--s-third-lt)', shape: 'diamondO', labelKey: 'detail.stageMs.actualStart' },
  { key: 'actualFinish', lane: 'actual', color: 'var(--s-third)', shape: 'diamond', labelKey: 'detail.stageMs.actualFinish' },
  { key: 'forecastDate', lane: 'actual', color: 'var(--s-cost)', shape: 'tri', labelKey: 'detail.stageMs.forecast' },
];

/** Mốc cần vẽ: bỏ ngày null; bỏ "dự kiến" khi đã có ngày TT HT (mock-up dòng 1451). */
export function stageMarkers(r: StageTimelineRow) {
  return STAGE_MARKERS.filter((m) => r[m.key] != null && !(m.key === 'forecastDate' && r.actualFinish));
}

export interface WorkItemCompareRow { workItemId: number; name: string; planned: number; actual: number }
export type WorkItemCompare = Partial<Record<StageCode, WorkItemCompareRow[]>>;

/** Giai đoạn mặc định của "Biểu đồ so sánh": 'fabrication' nếu đang dùng, không thì giai đoạn
 * volume đầu tiên (theo sortOrder), không thì giai đoạn đầu tiên, rỗng -> null. */
export function defaultCompareStage(stages: readonly Stage[]): StageCode | null {
  const active = activeStages(stages);
  if (!active.length) return null;
  const fab = active.find((s) => s.code === 'fabrication');
  if (fab) return fab.code;
  const vol = active.find((s) => s.calcMode === 'volume');
  if (vol) return vol.code;
  return active[0].code;
}
