import { addDaysIso, isValidIsoDate } from '@/lib/clock';
import type {
  EquipmentPlanGroupInput, EquipmentPlanInput, EquipmentPlanSegment, EquipmentQuota, EquipmentSegmentInput,
  ProjectEquipmentPlan,
} from '@/server/repo/types';

// P3A cu - xoa o commit Task 6 + 7
/** Task 12 (P3A): form nhập kế hoạch sử dụng thiết bị theo từng chiếc - nguồn cho Gantt thiết bị (T14). */
export const EQUIP_PLAN_MAX_ROWS = 300;
export const EQUIP_UNIT_MAX = 99;
export const EQUIP_NOTE_MAX = 200;

// P3A cu - xoa o commit Task 6 + 7
export interface EquipmentPlanDraft {
  equipmentId: string;
  unitNo: string;
  workItemId: string;
  plannedStart: string;
  plannedFinish: string;
  note: string;
}

// P3A cu - xoa o commit Task 6 + 7
export type EquipPlanField = 'equipmentId' | 'unitNo' | 'workItemId' | 'plannedStart' | 'plannedFinish' | 'note';
export type EquipPlanErrors = Record<number, EquipPlanField[]>;

// P3A cu - xoa o commit Task 6 + 7
export function toEquipmentPlanDraft(p: ProjectEquipmentPlan): EquipmentPlanDraft {
  return {
    equipmentId: String(p.equipmentId),
    unitNo: String(p.unitNo ?? ''),
    workItemId: p.workItemId != null ? String(p.workItemId) : '',
    plannedStart: p.plannedStart,
    plannedFinish: p.plannedFinish,
    note: p.note,
  };
}

// P3A cu - xoa o commit Task 6 + 7
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

// P3A cu - xoa o commit Task 6 + 7
/** Chiếc số kế tiếp của 1 thiết bị = max unitNo hiện có + 1, tối thiểu 1. */
export function nextUnitNo(rows: EquipmentPlanDraft[], equipmentId: string): number {
  const nums = rows
    .filter((r) => r.equipmentId === equipmentId)
    .map((r) => Number(r.unitNo))
    .filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

// P3A cu - xoa o commit Task 6 + 7
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

// P3A cu - xoa o commit Task 6 + 7
/** Chuỗi mô tả cho audit_log: "1#1 2026-09-01..2026-09-10 wi3; 2#1 ...", cắt 2000 ký tự. */
export function equipPlanAuditText(rows: EquipmentPlanInput[]): string {
  return rows
    .map((r) => `${r.equipmentId}#${r.unitNo} ${r.plannedStart}..${r.plannedFinish}${r.workItemId != null ? ` wi${r.workItemId}` : ''}`)
    .join('; ')
    .slice(0, 2000);
}

// ---- P3C-A (T4): kế hoạch thiết bị theo đợt (Tổng SL + các đợt), thay thế form theo từng chiếc ----
// EQUIP_PLAN_MAX_ROWS (300, khai báo ở trên) dùng chung: tổng số đợt mỗi dự án.

export const EQUIP_QTY_MAX = 999;        // Tổng SL và SL đợt
export const EQUIP_GROUP_MAX = 100;      // số loại thiết bị mỗi dự án

export interface EquipmentSegmentDraft { from: string; to: string; qty: string }
export interface EquipmentGroupDraft { equipmentId: string; totalQty: string; segments: EquipmentSegmentDraft[] }

export type EquipGroupField = 'equipmentId' | 'totalQty';
export type EquipSegField = 'from' | 'to' | 'qty';
export interface EquipOverload { groupIndex: number; equipmentId: number; from: string; to: string; used: number; total: number }
export interface EquipPlanCheck {
  ok: boolean;
  groupErrors: Record<number, EquipGroupField[]>;   // khoá = chỉ số nhóm
  segmentErrors: Record<string, EquipSegField[]>;   // khoá = `${gi}:${si}`
  overloads: EquipOverload[];
  tooManySegments: boolean;
}

/** Dữ liệu đọc → nháp form: 1 nhóm/quota (giữ thứ tự quotas), đợt gắn theo equipmentId (giữ thứ tự segments).
 *  Đợt của thiết bị không có quota → thêm nhóm cuối với totalQty = '' (buộc người dùng nhập). */
export function toEquipmentGroupDrafts(quotas: EquipmentQuota[], segments: EquipmentPlanSegment[]): EquipmentGroupDraft[] {
  const segsByEquipment = new Map<number, EquipmentPlanSegment[]>();
  for (const s of segments) {
    const list = segsByEquipment.get(s.equipmentId) ?? [];
    list.push(s);
    segsByEquipment.set(s.equipmentId, list);
  }
  const toSegDrafts = (segs: EquipmentPlanSegment[]): EquipmentSegmentDraft[] =>
    segs.map((s) => ({ from: s.from, to: s.to, qty: String(s.qty) }));

  const groups: EquipmentGroupDraft[] = quotas.map((q) => ({
    equipmentId: String(q.equipmentId),
    totalQty: String(q.totalQty),
    segments: toSegDrafts(segsByEquipment.get(q.equipmentId) ?? []),
  }));

  const quotaIds = new Set(quotas.map((q) => q.equipmentId));
  for (const [equipmentId, segs] of segsByEquipment) {
    if (quotaIds.has(equipmentId)) continue;
    groups.push({ equipmentId: String(equipmentId), totalQty: '', segments: toSegDrafts(segs) });
  }
  return groups;
}

/** Nháp → input: Number(), trim; chuỗi rỗng → NaN (để validate báo lỗi). */
export function normalizeEquipmentGroups(drafts: EquipmentGroupDraft[]): EquipmentPlanGroupInput[] {
  const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s));
  return drafts.map((g) => ({
    equipmentId: toNum(g.equipmentId),
    totalQty: toNum(g.totalQty),
    segments: g.segments.map((s) => ({ from: s.from, to: s.to, qty: toNum(s.qty) })),
  }));
}

/** Các khoảng ngày mà tổng qty các đợt phủ ngày đó > total. Gộp ngày liên tiếp cùng vượt thành 1 khoảng;
 *  used = SL lớn nhất trong khoảng. Sắp from tăng. Chỉ xét đợt có ngày hợp lệ, to >= from, qty nguyên >= 1. */
export function findOverloads(total: number, segments: EquipmentSegmentInput[]): { from: string; to: string; used: number }[] {
  const valid = segments.filter(
    (s) => isValidIsoDate(s.from) && isValidIsoDate(s.to) && s.to >= s.from && Number.isInteger(s.qty) && s.qty >= 1,
  );
  if (valid.length === 0) return [];

  // Sự kiện: cộng qty tại `from`, trừ qty tại ngày sau `to`. Cộng dồn sự kiện cùng ngày qua Map.
  const deltaByDate = new Map<string, number>();
  for (const s of valid) {
    deltaByDate.set(s.from, (deltaByDate.get(s.from) ?? 0) + s.qty);
    const endExclusive = addDaysIso(s.to, 1);
    deltaByDate.set(endExclusive, (deltaByDate.get(endExclusive) ?? 0) - s.qty);
  }
  const dates = [...deltaByDate.keys()].sort();

  const result: { from: string; to: string; used: number }[] = [];
  let running = 0;
  let openFrom: string | null = null;
  let openUsed = 0;

  for (let i = 0; i < dates.length; i++) {
    running += deltaByDate.get(dates[i])!;
    const isLast = i === dates.length - 1;
    if (isLast) break; // sau điểm cuối cùng, running luôn về 0 - không còn đoạn ngày nào để xét
    const segFrom = dates[i];
    if (running > total) {
      if (openFrom == null) { openFrom = segFrom; openUsed = running; }
      else openUsed = Math.max(openUsed, running);
    } else if (openFrom != null) {
      result.push({ from: openFrom, to: addDaysIso(segFrom, -1), used: openUsed });
      openFrom = null;
      openUsed = 0;
    }
  }
  if (openFrom != null) result.push({ from: openFrom, to: addDaysIso(dates[dates.length - 1], -1), used: openUsed });

  return result;
}

export function validateEquipmentPlan(groups: EquipmentPlanGroupInput[], ctx: { equipmentIds: Set<number> }): EquipPlanCheck {
  const groupErrors: Record<number, EquipGroupField[]> = {};
  const segmentErrors: Record<string, EquipSegField[]> = {};
  const overloads: EquipOverload[] = [];
  const seenEquipmentIds = new Set<number>();
  let totalSegments = 0;

  function addGroupErr(gi: number, f: EquipGroupField) {
    (groupErrors[gi] ??= []).push(f);
  }
  function addSegErr(gi: number, si: number, f: EquipSegField) {
    const key = `${gi}:${si}`;
    (segmentErrors[key] ??= []).push(f);
  }

  groups.forEach((g, gi) => {
    if (!ctx.equipmentIds.has(g.equipmentId)) addGroupErr(gi, 'equipmentId');
    else if (seenEquipmentIds.has(g.equipmentId)) addGroupErr(gi, 'equipmentId');
    seenEquipmentIds.add(g.equipmentId);

    const totalQtyOk = Number.isInteger(g.totalQty) && g.totalQty >= 1 && g.totalQty <= EQUIP_QTY_MAX;
    if (!totalQtyOk) addGroupErr(gi, 'totalQty');

    totalSegments += g.segments.length;

    const validSegIdx: number[] = [];
    g.segments.forEach((s, si) => {
      const fromOk = isValidIsoDate(s.from);
      if (!fromOk) addSegErr(gi, si, 'from');
      const toOk = isValidIsoDate(s.to);
      if (!toOk || (fromOk && toOk && s.to < s.from)) addSegErr(gi, si, 'to');
      const qtyOk = Number.isInteger(s.qty) && s.qty >= 1 && s.qty <= EQUIP_QTY_MAX;
      if (!qtyOk) addSegErr(gi, si, 'qty');
      if (fromOk && toOk && s.to >= s.from && qtyOk) validSegIdx.push(si);
    });

    if (totalQtyOk) {
      const validSegs = validSegIdx.map((si) => g.segments[si]);
      const groupOverloads = findOverloads(g.totalQty, validSegs);
      for (const o of groupOverloads) {
        overloads.push({ groupIndex: gi, equipmentId: g.equipmentId, from: o.from, to: o.to, used: o.used, total: g.totalQty });
      }
      for (const si of validSegIdx) {
        const s = g.segments[si];
        const hit = groupOverloads.some((o) => s.from <= o.to && o.from <= s.to);
        if (hit) addSegErr(gi, si, 'qty');
      }
    }
  });

  const tooManySegments = totalSegments > EQUIP_PLAN_MAX_ROWS || groups.length > EQUIP_GROUP_MAX;
  const ok = Object.keys(groupErrors).length === 0 && Object.keys(segmentErrors).length === 0
    && overloads.length === 0 && !tooManySegments;

  return { ok, groupErrors, segmentErrors, overloads, tooManySegments };
}

/** Audit: "1 tong 3: 2026-07-06..2026-08-30 x1, 2026-08-31..2026-10-25 x3; 2 tong 2: -", cắt 2000 ký tự. */
export function equipGroupsAuditText(groups: EquipmentPlanGroupInput[]): string {
  return groups
    .map((g) => `${g.equipmentId} tong ${g.totalQty}: ${
      g.segments.length ? g.segments.map((s) => `${s.from}..${s.to} x${s.qty}`).join(', ') : '-'
    }`)
    .join('; ')
    .slice(0, 2000);
}
