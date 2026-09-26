/**
 * Kiểu TẠM, chép nguyên văn hợp đồng P3C (D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md).
 * `src/server/repo/types.ts` là file của A - khi A merge P3C-A thì xoá file này và đổi import sang
 * '@/server/repo/types' (Bước 11). p3c-contract.test.ts chặn lệch trường giữa 2 nơi.
 */
export interface EquipmentPlanSegment {
  id: number; equipmentId: number; equipmentName: string;
  from: string; to: string;   // 'YYYY-MM-DD'
  qty: number;                // SL dùng trong đợt
}
export interface EquipmentQuota { equipmentId: number; equipmentName: string; totalQty: number }
export interface ManpowerPlanMonthRow { yearMonth: string; shiftCode: string; planned: number; isManual: boolean }
export interface ShiftRatio { shiftCode: string; pct: number }
