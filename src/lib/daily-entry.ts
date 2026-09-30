import { addDaysIso, type IsoDate } from '@/lib/clock';
import type { FactDailyEquipmentUsage, FactDailyManpowerShift, Role } from '@/server/repo/types';

/**
 * Quy tắc nhập/sửa nhân lực & thiết bị theo NGÀY (T/B, Task 4, P2A). File tạo ở Task 3 (chỉ
 * `dailyDateWindow`/`isInWindow`); Task 4 thêm phần còn lại (Q2).
 */
export const DAILY_EDIT_BACK_DAYS = 7; // Q2: data-entry lùi tối đa
export const DAILY_PLAN_AHEAD_DAYS = 30; // Q2: nhập KH trước tối đa
export const DAILY_REASON_MIN = 5;
export const DAILY_VALUE_MAX = 100_000;

export interface ManpowerCellInput {
  contractorId: number;
  shiftCode: string;
  plannedHeadcount: number;
  actualHeadcount: number;
}

export interface EquipmentCellInput {
  contractorId: number;
  equipmentId: number;
  qtyPlanned: number;
  qtyActual: number;
}

/** Khoảng ngày (gồm cả 2 đầu) đang được admin bật nhập bù cho 1 dự án. */
export interface BackfillRange {
  from: IsoDate;
  to: IsoDate;
}

export interface DailyWindow {
  min: IsoDate | null;
  max: IsoDate;
  /** Khoảng nhập bù đang bật: ngày nằm trong 1 khoảng vẫn hợp lệ dù cũ hơn `min` (không bao giờ vượt `max`). */
  extra?: BackfillRange[];
}

/**
 * admin: min null (không giới hạn); data-entry: min = today - 7; max = today + 30 cho mọi role.
 * `backfill` (P4): khoảng nhập bù đang bật của dự án, chỉ mở thêm ngày cũ cho data-entry.
 */
export function dailyDateWindow(role: Role, today: IsoDate, backfill: BackfillRange[] = []): DailyWindow {
  const max = addDaysIso(today, DAILY_PLAN_AHEAD_DAYS);
  if (role === 'admin') return { min: null, max };
  const min = addDaysIso(today, -DAILY_EDIT_BACK_DAYS);
  return backfill.length > 0 ? { min, max, extra: backfill } : { min, max };
}

export function isInWindow(d: IsoDate, w: DailyWindow): boolean {
  if (d > w.max) return false;
  if (w.min != null && d < w.min && !(w.extra ?? []).some((r) => d >= r.from && d <= r.to)) return false;
  return true;
}

/** true khi ngày chỉ hợp lệ nhờ khoảng nhập bù (cũ hơn `min` mà nằm trong 1 khoảng) - dùng để ghi nhãn "nhập bù". */
export function isBackfillOnly(d: IsoDate, w: DailyWindow): boolean {
  return w.min != null && d < w.min && isInWindow(d, w);
}

/** d > today và có actual > 0 ở bất kỳ ô nào → true (Q2: TT > 0 cho ngày tương lai bị từ chối). */
export function hasFutureActual(
  d: IsoDate,
  today: IsoDate,
  mp: ManpowerCellInput[],
  eq: EquipmentCellInput[],
): boolean {
  if (d <= today) return false;
  return mp.some((m) => m.actualHeadcount > 0) || eq.some((e) => e.qtyActual > 0);
}

/** true khi d < today VÀ có ít nhất 1 ô ĐÃ TỒN TẠI trong DB bị đổi giá trị (Q2: lý do sửa số cũ). */
export function needsReason(
  d: IsoDate,
  today: IsoDate,
  mp: ManpowerCellInput[],
  eq: EquipmentCellInput[],
  existingMp: FactDailyManpowerShift[],
  existingEq: FactDailyEquipmentUsage[],
): boolean {
  if (d >= today) return false;
  for (const m of mp) {
    const prev = existingMp.find((e) => e.contractorId === m.contractorId && e.shiftCode === m.shiftCode);
    if (prev && (prev.plannedHeadcount !== m.plannedHeadcount || prev.actualHeadcount !== m.actualHeadcount)) {
      return true;
    }
  }
  for (const e of eq) {
    const prev = existingEq.find((x) => x.contractorId === e.contractorId && x.equipmentId === e.equipmentId);
    if (prev && (prev.qtyPlanned !== e.qtyPlanned || prev.qtyActual !== e.qtyActual)) {
      return true;
    }
  }
  return false;
}
