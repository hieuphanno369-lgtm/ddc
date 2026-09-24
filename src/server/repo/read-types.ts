import type { ActivityLogEntry, AuditLogEntry, FactProgressMonthly, ProjectEquipmentPlan, Shift } from './types';

/** Nhân lực theo tháng × nhà thầu × ca (đã cộng các ngày). days = số ngày có dòng của ca đó. */
export interface ShiftMonthRow { yearMonth: string; contractorId: number; shiftCode: string; planned: number; actual: number; days: number }
/** Nhân lực theo tuần ISO (Thứ 2) × nhà thầu, đã cộng mọi ca + mọi ngày trong tuần. */
export interface WeekContractorRow { weekStart: string; contractorId: number; planned: number; actual: number }
export interface DateRange { from: string; to: string } // 'YYYY-MM-DD', from <= to
/** Thiết bị dùng thực tế theo nhóm × ngày, đã cộng ngang nhà thầu; chỉ dòng qtyActual > 0. */
export interface EquipmentUsageDay { equipmentId: number; workDate: string; qtyActual: number }

// --- Bước 5 (T1) ---
export type FactSnapshot = Pick<FactProgressMonthly,
  'projectId' | 'yearMonth' | 'pctActual' | 'bac' | 'pv' | 'ev' | 'ac' | 'spi' | 'cpi' | 'bottleneckStage'>;
export interface FinancialSnapshot { projectId: number; yearMonth: string; revenuePeriod: number; arOverdue: number }
export interface VolumeSnapshot { projectId: number; factoryId: number; yearMonth: string; tonnageProcessed: number }
export interface MonthlyEvmRow { yearMonth: string; pv: number; ev: number; ac: number; spiAvg: number | null; cpiAvg: number | null }
// --- Bước 6 (T1) ---
export interface AuditLogPageResult { items: AuditLogEntry[]; total: number; page: number; totalPages: number; pageSize: number }

export interface ReadRepo {
  readShifts(): Promise<Shift[]>;                                                   // mọi ca, sortOrder tăng
  readManpowerByShiftMonth(projectId: number): Promise<ShiftMonthRow[]>;            // sort yearMonth, contractorId, shiftCode
  readManpowerWeekly(projectId: number): Promise<WeekContractorRow[]>;              // sort weekStart, contractorId
  readManpowerRange(projectId: number): Promise<DateRange | null>;                  // min/max workDate; không có dòng → null
  readEquipmentPlans(projectId: number): Promise<ProjectEquipmentPlan[]>;           // sort equipmentId, unitNo, plannedStart, id
  readEquipmentUsageDays(projectId: number, from: string, to: string): Promise<EquipmentUsageDay[]>; // sort equipmentId, workDate
  // Bước 5
  readFactSnapshots(yearMonth: string): Promise<FactSnapshot[]>;         // 'all' = bản isLatest của THÁNG MỚI NHẤT mỗi dự án
  readFinancialSnapshots(yearMonth: string): Promise<FinancialSnapshot[]>; // như trên cho fact_financial
  readVolumeSnapshots(yearMonth: string): Promise<VolumeSnapshot[]>;       // 'all' = tháng mới nhất mỗi (projectId, factoryId)
  readMonthlyEvm(months: string[], projectIds: number[]): Promise<MonthlyEvmRow[]>; // chỉ isLatest; tháng không có dòng → không trả
  // Bước 6
  readLastAuditAt(): Promise<string | null>;                                 // ISO; bảng rỗng → null
  readActivitySince(since: Date): Promise<ActivityLogEntry[]>;               // createdAt >= since, mới nhất trước
  readAuditLogPage(opts: { since: Date | null; page: number; pageSize: number }): Promise<AuditLogPageResult>;
}
