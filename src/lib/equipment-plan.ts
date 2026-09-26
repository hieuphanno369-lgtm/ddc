import { addDaysIso, isValidIsoDate } from '@/lib/clock';
import type { EquipmentPlanGroupInput, EquipmentPlanSegment, EquipmentQuota, EquipmentSegmentInput } from '@/server/repo/types';

/** Tổng số đợt (mọi loại thiết bị) tối đa mỗi dự án. */
export const EQUIP_PLAN_MAX_ROWS = 300;

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
