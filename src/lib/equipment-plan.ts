import { isValidIsoDate } from '@/lib/clock';
import type { EquipmentPlanInput, ProjectEquipmentPlan } from '@/server/repo/types';

/** Task 12 (P3A): form nhập kế hoạch sử dụng thiết bị theo từng chiếc - nguồn cho Gantt thiết bị (T14). */
export const EQUIP_PLAN_MAX_ROWS = 300;
export const EQUIP_UNIT_MAX = 99;
export const EQUIP_NOTE_MAX = 200;

export interface EquipmentPlanDraft {
  equipmentId: string;
  unitNo: string;
  workItemId: string;
  plannedStart: string;
  plannedFinish: string;
  note: string;
}

export type EquipPlanField = 'equipmentId' | 'unitNo' | 'workItemId' | 'plannedStart' | 'plannedFinish' | 'note';
export type EquipPlanErrors = Record<number, EquipPlanField[]>;

export function toEquipmentPlanDraft(p: ProjectEquipmentPlan): EquipmentPlanDraft {
  return {
    equipmentId: String(p.equipmentId),
    unitNo: String(p.unitNo),
    workItemId: p.workItemId != null ? String(p.workItemId) : '',
    plannedStart: p.plannedStart,
    plannedFinish: p.plannedFinish,
    note: p.note,
  };
}

export function normalizeEquipmentPlans(rows: EquipmentPlanDraft[]): EquipmentPlanInput[] {
  return rows.map((r) => ({
    equipmentId: Number(r.equipmentId),
    unitNo: Number(r.unitNo),
    workItemId: r.workItemId.trim() === '' ? null : Number(r.workItemId),
    plannedStart: r.plannedStart,
    plannedFinish: r.plannedFinish,
    note: r.note.trim(),
  }));
}

/** Chiếc số kế tiếp của 1 thiết bị = max unitNo hiện có + 1, tối thiểu 1. */
export function nextUnitNo(rows: EquipmentPlanDraft[], equipmentId: string): number {
  const nums = rows
    .filter((r) => r.equipmentId === equipmentId)
    .map((r) => Number(r.unitNo))
    .filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function validateEquipmentPlans(
  rows: EquipmentPlanInput[],
  ctx: { equipmentIds: Set<number>; workItemIds: Set<number> },
): { ok: boolean; errors: EquipPlanErrors; overlaps: [number, number][] } {
  const errorSets = new Map<number, Set<EquipPlanField>>();
  const overlaps: [number, number][] = [];

  function addErr(i: number, f: EquipPlanField) {
    if (!errorSets.has(i)) errorSets.set(i, new Set());
    errorSets.get(i)!.add(f);
  }

  rows.forEach((r, i) => {
    if (!ctx.equipmentIds.has(r.equipmentId)) addErr(i, 'equipmentId');
    if (!Number.isInteger(r.unitNo) || r.unitNo < 1 || r.unitNo > EQUIP_UNIT_MAX) addErr(i, 'unitNo');
    if (r.workItemId != null && !ctx.workItemIds.has(r.workItemId)) addErr(i, 'workItemId');
    const startOk = isValidIsoDate(r.plannedStart);
    const finishOk = isValidIsoDate(r.plannedFinish);
    if (!startOk) addErr(i, 'plannedStart');
    if (!finishOk) addErr(i, 'plannedFinish');
    if (startOk && finishOk && r.plannedFinish < r.plannedStart) addErr(i, 'plannedFinish');
    if (r.note.length > EQUIP_NOTE_MAX) addErr(i, 'note');
  });

  if (rows.length > EQUIP_PLAN_MAX_ROWS) {
    for (let i = EQUIP_PLAN_MAX_ROWS; i < rows.length; i++) addErr(i, 'equipmentId');
  }

  // Trùng: 2 dòng cùng (equipmentId, unitNo) có khoảng ngày giao nhau - assignUsage (equipment-gantt.ts)
  // chỉ gán 1 ngày dùng cho 1 trong 2 thanh nếu để trùng nên phải chặn ở đây.
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.equipmentId !== b.equipmentId || a.unitNo !== b.unitNo) continue;
      if (a.plannedStart <= b.plannedFinish && b.plannedStart <= a.plannedFinish) {
        addErr(i, 'plannedStart');
        addErr(i, 'plannedFinish');
        addErr(j, 'plannedStart');
        addErr(j, 'plannedFinish');
        overlaps.push([i, j]);
      }
    }
  }

  const errors: EquipPlanErrors = {};
  for (const [i, set] of errorSets) errors[i] = [...set];

  return { ok: Object.keys(errors).length === 0, errors, overlaps };
}

/** Chuỗi mô tả cho audit_log: "1#1 2026-09-01..2026-09-10 wi3; 2#1 ...", cắt 2000 ký tự. */
export function equipPlanAuditText(rows: EquipmentPlanInput[]): string {
  return rows
    .map((r) => `${r.equipmentId}#${r.unitNo} ${r.plannedStart}..${r.plannedFinish}${r.workItemId != null ? ` wi${r.workItemId}` : ''}`)
    .join('; ')
    .slice(0, 2000);
}
