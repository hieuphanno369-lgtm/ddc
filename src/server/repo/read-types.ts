import type { ProjectEquipmentPlan, Shift } from './types';

/** Nhân lực theo tháng × nhà thầu × ca (đã cộng các ngày). days = số ngày có dòng của ca đó. */
export interface ShiftMonthRow { yearMonth: string; contractorId: number; shiftCode: string; planned: number; actual: number; days: number }
/** Nhân lực theo tuần ISO (Thứ 2) × nhà thầu, đã cộng mọi ca + mọi ngày trong tuần. */
export interface WeekContractorRow { weekStart: string; contractorId: number; planned: number; actual: number }
export interface DateRange { from: string; to: string } // 'YYYY-MM-DD', from <= to
/** Thiết bị dùng thực tế theo nhóm × ngày, đã cộng ngang nhà thầu; chỉ dòng qtyActual > 0. */
export interface EquipmentUsageDay { equipmentId: number; workDate: string; qtyActual: number }

export interface ReadRepo {
  readShifts(): Promise<Shift[]>;                                                   // mọi ca, sortOrder tăng
  readManpowerByShiftMonth(projectId: number): Promise<ShiftMonthRow[]>;            // sort yearMonth, contractorId, shiftCode
  readManpowerWeekly(projectId: number): Promise<WeekContractorRow[]>;              // sort weekStart, contractorId
  readManpowerRange(projectId: number): Promise<DateRange | null>;                  // min/max workDate; không có dòng → null
  readEquipmentPlans(projectId: number): Promise<ProjectEquipmentPlan[]>;           // sort equipmentId, unitNo, plannedStart, id
  readEquipmentUsageDays(projectId: number, from: string, to: string): Promise<EquipmentUsageDay[]>; // sort equipmentId, workDate
}
