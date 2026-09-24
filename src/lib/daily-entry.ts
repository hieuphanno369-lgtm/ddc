import { addDaysIso, type IsoDate } from '@/lib/clock';
import type { Role } from '@/server/repo/types';

/**
 * Quy tắc nhập/sửa nhân lực & thiết bị theo NGÀY (T/B, Task 4, P2A). File tạo ở Task 3 (chỉ
 * `dailyDateWindow`/`isInWindow` để `nhap-lieu/page.tsx` dùng ngay); Task 4 thêm phần còn lại.
 */
export const DAILY_EDIT_BACK_DAYS = 7; // Q2: data-entry lùi tối đa
export const DAILY_PLAN_AHEAD_DAYS = 30; // Q2: nhập KH trước tối đa

/** admin: min null (không giới hạn); data-entry: min = today - 7; max = today + 30 cho mọi role. */
export function dailyDateWindow(role: Role, today: IsoDate): { min: IsoDate | null; max: IsoDate } {
  const max = addDaysIso(today, DAILY_PLAN_AHEAD_DAYS);
  if (role === 'admin') return { min: null, max };
  return { min: addDaysIso(today, -DAILY_EDIT_BACK_DAYS), max };
}

export function isInWindow(d: IsoDate, w: { min: IsoDate | null; max: IsoDate }): boolean {
  if (d > w.max) return false;
  if (w.min != null && d < w.min) return false;
  return true;
}
