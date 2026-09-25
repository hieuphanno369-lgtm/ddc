import { addDaysIso, daysBetween } from '@/lib/clock';
import { bucketOf } from '@/lib/daily-series';
import { formatDayMonth } from '@/lib/format';
import { equipmentColor } from '@/lib/tracking';
import type { EquipmentUsageDay } from '@/server/repo/read-types';
import type { ProjectEquipmentPlan } from '@/server/repo/types';

/**
 * Dựng mô hình Gantt thiết bị (T14, Q1 = b): 1 hàng/chiếc, 1 thanh/dòng plan, ô đậm = ngày
 * thực tế có dùng (gán từ `fact_daily_equipment_usage` theo `unitNo` tăng dần). Hàm thuần.
 */

export interface GanttBar {
  planId: number; start: string; finish: string; workItemId: number | null; workItemName: string;
  color: string; rangeLabel: string /* 'dd/mm - dd/mm' */; planDays: number; usedDays: string[] /* tăng dần */;
}
export interface GanttRow { key: string /* `${equipmentId}-${unitNo}` */; equipmentId: number; unitNo: number; label: string; bars: GanttBar[] }
export interface GanttLegendItem { key: string; name: string; color: string }
export interface GanttModel {
  rows: GanttRow[]; legend: GanttLegendItem[]; from: string /* Thứ 2 */; to: string /* Chủ nhật */;
  ticks: string[] /* mọi Thứ 2 trong [from,to] */; planFrom: string; planTo: string; unplannedUsage: number;
}
export interface GanttInput {
  plans: ProjectEquipmentPlan[]; usage: EquipmentUsageDay[];
  equipments: { id: number; name: string }[]; workItems: { id: number; name: string; sortOrder: number }[]; noWorkItemName: string;
}

/** Q1(b): trả planId → ngày dùng (tăng dần), và số lượt thiết bị-ngày không gán được. */
export function assignUsage(plans: ProjectEquipmentPlan[], usage: EquipmentUsageDay[]): { byPlan: Map<number, string[]>; unplanned: number } {
  const byPlan = new Map<number, string[]>();
  let unplanned = 0;

  const plansByEquipment = new Map<number, ProjectEquipmentPlan[]>();
  for (const p of plans) {
    const list = plansByEquipment.get(p.equipmentId) ?? [];
    list.push(p);
    plansByEquipment.set(p.equipmentId, list);
  }

  for (const u of usage) {
    const candidates = plansByEquipment.get(u.equipmentId) ?? [];
    // Mỗi unitNo có KH phủ ngày d -> chỉ giữ plan id nhỏ nhất của chiếc đó (2 plan cùng chiếc chồng ngày -> gán id nhỏ).
    const planByUnit = new Map<number, ProjectEquipmentPlan>();
    for (const p of candidates) {
      if (p.plannedStart > u.workDate || u.workDate > p.plannedFinish) continue;
      const cur = planByUnit.get(p.unitNo);
      if (!cur || p.id < cur.id) planByUnit.set(p.unitNo, p);
    }
    const units = [...planByUnit.keys()].sort((a, b) => a - b);
    const k = Math.min(u.qtyActual, units.length);
    for (let i = 0; i < k; i++) {
      const plan = planByUnit.get(units[i])!;
      const list = byPlan.get(plan.id) ?? [];
      list.push(u.workDate);
      byPlan.set(plan.id, list);
    }
    unplanned += u.qtyActual - k;
  }

  for (const list of byPlan.values()) list.sort();
  return { byPlan, unplanned };
}

export function buildGantt(input: GanttInput): GanttModel | null {
  const { plans, usage, equipments, workItems, noWorkItemName } = input;
  if (plans.length === 0) return null;

  const equipmentNameById = new Map(equipments.map((e) => [e.id, e.name]));
  const sortedWorkItems = [...workItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const workItemIndexById = new Map(sortedWorkItems.map((w, i) => [w.id, i]));
  const workItemNameById = new Map(sortedWorkItems.map((w) => [w.id, w.name]));

  const unitsByEquipment = new Map<number, Set<number>>();
  for (const p of plans) {
    const set = unitsByEquipment.get(p.equipmentId) ?? new Set<number>();
    set.add(p.unitNo);
    unitsByEquipment.set(p.equipmentId, set);
  }

  const { byPlan, unplanned } = assignUsage(plans, usage);

  const rowByKey = new Map<string, GanttRow>();
  for (const p of plans) {
    const key = `${p.equipmentId}-${p.unitNo}`;
    let row = rowByKey.get(key);
    if (!row) {
      const chiecCount = unitsByEquipment.get(p.equipmentId)?.size ?? 1;
      const name = equipmentNameById.get(p.equipmentId) ?? `#${p.equipmentId}`;
      const label = chiecCount > 1 || p.unitNo !== 1 ? `${name} No.${p.unitNo}` : name;
      row = { key, equipmentId: p.equipmentId, unitNo: p.unitNo, label, bars: [] };
      rowByKey.set(key, row);
    }
    const idx = p.workItemId != null ? workItemIndexById.get(p.workItemId) : undefined;
    const color = idx != null ? equipmentColor(idx) : 'var(--s-neutral)';
    const workItemName = p.workItemId != null ? (workItemNameById.get(p.workItemId) ?? noWorkItemName) : noWorkItemName;
    row.bars.push({
      planId: p.id,
      start: p.plannedStart,
      finish: p.plannedFinish,
      workItemId: p.workItemId,
      workItemName,
      color,
      rangeLabel: `${formatDayMonth(p.plannedStart)} - ${formatDayMonth(p.plannedFinish)}`,
      planDays: daysBetween(p.plannedStart, p.plannedFinish) + 1,
      usedDays: byPlan.get(p.id) ?? [],
    });
  }
  for (const row of rowByKey.values()) row.bars.sort((a, b) => a.start.localeCompare(b.start));
  const rows = [...rowByKey.values()].sort((a, b) => a.equipmentId - b.equipmentId || a.unitNo - b.unitNo);

  const legend: GanttLegendItem[] = [];
  const usedWorkItemIds = new Set(plans.map((p) => p.workItemId).filter((x): x is number => x != null));
  const hasUnassigned = plans.some((p) => p.workItemId == null || !workItemIndexById.has(p.workItemId));
  for (const w of sortedWorkItems) {
    if (usedWorkItemIds.has(w.id)) legend.push({ key: String(w.id), name: w.name, color: equipmentColor(workItemIndexById.get(w.id)!) });
  }
  if (hasUnassigned) legend.push({ key: 'unassigned', name: noWorkItemName, color: 'var(--s-neutral)' });

  const planFrom = plans.map((p) => p.plannedStart).reduce((m, s) => (s < m ? s : m));
  const planTo = plans.map((p) => p.plannedFinish).reduce((m, s) => (s > m ? s : m));
  const from = bucketOf(planFrom, 'week').from;
  const to = bucketOf(planTo, 'week').to;
  const ticks: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 7)) ticks.push(d);

  return { rows, legend, from, to, ticks, planFrom, planTo, unplannedUsage: unplanned };
}
