import type { IsoDate } from '@/lib/clock';
import { mobilizationRatio } from '@/lib/resources';
import type { FactDailyEquipmentUsage, FactDailyManpower } from '@/server/repo/types';

export const TRACKING_DAYS = 7;

/** Dữ liệu thô của thẻ Tracking (mock-up dòng 768-787, 1794-1927). */
export interface WeeklyTracking {
  days: IsoDate[];                                   // liên tiếp, tăng dần
  today: IsoDate;                                    // todayIso()
  contractors: { id: number; name: string; scopeOfWork: string }[];
  equipments: { id: number; name: string }[];        // thiết bị xuất hiện trong tuần, id tăng dần
  manpower: FactDailyManpower[];                     // chỉ dòng nằm trong `days`
  equipmentUsage: FactDailyEquipmentUsage[];         // chỉ dòng nằm trong `days`
}

/** Màu chip thiết bị theo thứ tự (mock-up EQ_COLOR dòng 1802). */
export const EQUIPMENT_COLORS = ['var(--s-actual)', 'var(--s-plan)', 'var(--s-third)', 'var(--s-cost)', 'var(--s-third-lt)', 'var(--s-neutral)', 'var(--accent-2)'];
export const equipmentColor = (index: number) => EQUIPMENT_COLORS[((index % EQUIPMENT_COLORS.length) + EQUIPMENT_COLORS.length) % EQUIPMENT_COLORS.length];

const findMan = (w: WeeklyTracking, date: IsoDate, contractorId: number) =>
  w.manpower.find((m) => m.workDate === date && m.contractorId === contractorId);
/** "Đã dùng" = qtyActual > 0 (có KH mà TT = 0 thì KHÔNG tính). */
const used = (w: WeeklyTracking, date: IsoDate, contractorId: number, equipmentId: number) =>
  w.equipmentUsage.some((u) => u.workDate === date && u.contractorId === contractorId && u.equipmentId === equipmentId && u.qtyActual > 0);
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

export interface LogRow { contractorId: number; name: string; scope: string; planned: number; actual: number; diff: number; ratio: number | null; equipmentIds: number[] }
export interface LogDay { date: IsoDate; isToday: boolean; planned: number; actual: number; ratio: number | null; equipmentTypeCount: number; rows: LogRow[] }

/** Tab "Nhật ký theo ngày": ngày mới nhất trên cùng (mock-up dòng 1837); chỉ nhà thầu có dòng nhân lực ngày đó. */
export function buildLogView(w: WeeklyTracking): LogDay[] {
  return [...w.days].reverse().map((date) => {
    const rows: LogRow[] = w.contractors.flatMap((c) => {
      const m = findMan(w, date, c.id);
      if (!m) return [];
      return [{
        contractorId: c.id, name: c.name, scope: c.scopeOfWork,
        planned: m.plannedHeadcount, actual: m.actualHeadcount, diff: m.actualHeadcount - m.plannedHeadcount,
        ratio: mobilizationRatio(m.actualHeadcount, m.plannedHeadcount),
        equipmentIds: w.equipments.filter((e) => used(w, date, c.id, e.id)).map((e) => e.id),
      }];
    });
    const planned = sum(rows, (r) => r.planned);
    const actual = sum(rows, (r) => r.actual);
    const types = new Set(w.equipmentUsage.filter((u) => u.workDate === date && u.qtyActual > 0).map((u) => u.equipmentId));
    return { date, isToday: date === w.today, planned, actual, ratio: mobilizationRatio(actual, planned), equipmentTypeCount: types.size, rows };
  });
}

export interface MatrixCell { planned: number; actual: number; ratio: number | null }
export interface MatrixRow { contractorId: number; name: string; scope: string; cells: (MatrixCell | null)[]; weekRatio: number | null }
export interface MatrixView { rows: MatrixRow[]; totals: MatrixCell[]; weekRatio: number | null }

/** Tab "Ma trận nhân lực" (mock-up dòng 1857-1879). Ô null = nhà thầu không có dòng ngày đó. */
export function buildMatrixView(w: WeeklyTracking): MatrixView {
  const rows = w.contractors.map((c) => {
    const cells = w.days.map((date): MatrixCell | null => {
      const m = findMan(w, date, c.id);
      return m ? { planned: m.plannedHeadcount, actual: m.actualHeadcount, ratio: mobilizationRatio(m.actualHeadcount, m.plannedHeadcount) } : null;
    });
    const filled = cells.filter((x): x is MatrixCell => x != null);
    return { contractorId: c.id, name: c.name, scope: c.scopeOfWork, cells, weekRatio: mobilizationRatio(sum(filled, (x) => x.actual), sum(filled, (x) => x.planned)) };
  });
  const totals = w.days.map((date) => {
    const ms = w.manpower.filter((m) => m.workDate === date);
    const planned = sum(ms, (m) => m.plannedHeadcount);
    const actual = sum(ms, (m) => m.actualHeadcount);
    return { planned, actual, ratio: mobilizationRatio(actual, planned) };
  });
  return { rows, totals, weekRatio: mobilizationRatio(sum(totals, (x) => x.actual), sum(totals, (x) => x.planned)) };
}

export interface EquipmentUser { contractorId: number; name: string; actualHeadcount: number | null }
export interface EquipmentRow { equipmentId: number; name: string; color: string; cells: EquipmentUser[][]; daysUsed: number }

/** Tab "Theo thiết bị" (mock-up dòng 1880-1896): mỗi ô = các nhà thầu đã dùng thiết bị hôm đó. */
export function buildEquipmentView(w: WeeklyTracking): EquipmentRow[] {
  return w.equipments.map((e, idx) => {
    const cells = w.days.map((date) => w.contractors
      .filter((c) => used(w, date, c.id, e.id))
      .map((c) => ({ contractorId: c.id, name: c.name, actualHeadcount: findMan(w, date, c.id)?.actualHeadcount ?? null })));
    return { equipmentId: e.id, name: e.name, color: equipmentColor(idx), cells, daysUsed: cells.filter((u) => u.length > 0).length };
  });
}

export interface TrackingSummary { from: IsoDate; to: IsoDate; contractorCount: number; equipmentCount: number; lastDayIsToday: boolean; lastPlanned: number; lastActual: number; weekRatio: number | null }

/** Thanh tổng kết `#trackSum` (mock-up dòng 1916-1926). */
export function buildTrackingSummary(w: WeeklyTracking): TrackingSummary {
  const to = w.days[w.days.length - 1];
  const last = w.manpower.filter((m) => m.workDate === to);
  return {
    from: w.days[0], to,
    contractorCount: new Set(w.manpower.map((m) => m.contractorId)).size,
    equipmentCount: new Set(w.equipmentUsage.filter((u) => u.qtyActual > 0).map((u) => u.equipmentId)).size,
    lastDayIsToday: to === w.today,
    lastPlanned: sum(last, (m) => m.plannedHeadcount),
    lastActual: sum(last, (m) => m.actualHeadcount),
    weekRatio: mobilizationRatio(sum(w.manpower, (m) => m.actualHeadcount), sum(w.manpower, (m) => m.plannedHeadcount)),
  };
}
