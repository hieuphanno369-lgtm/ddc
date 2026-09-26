import type { ActivityLogEntry, AuditLogEntry, FactProgressMonthly, Shift } from './types';

/** Nhân lực theo tuần ISO (Thứ 2) × nhà thầu, đã cộng mọi ca + mọi ngày trong tuần. */
export interface WeekContractorRow { weekStart: string; contractorId: number; planned: number; actual: number }
export interface DateRange { from: string; to: string } // 'YYYY-MM-DD', from <= to

// --- Bước 5 (T1) ---
export type FactSnapshot = Pick<FactProgressMonthly,
  'projectId' | 'yearMonth' | 'pctActual' | 'bac' | 'pv' | 'ev' | 'ac' | 'spi' | 'cpi' | 'bottleneckStage'>;
export interface FinancialSnapshot { projectId: number; yearMonth: string; revenuePeriod: number; arOverdue: number }
export interface VolumeSnapshot { projectId: number; factoryId: number; yearMonth: string; tonnageProcessed: number }
export interface MonthlyEvmRow { yearMonth: string; pv: number; ev: number; ac: number; spiAvg: number | null; cpiAvg: number | null }
// --- Bước 6 (T1) ---
export interface AuditLogPageResult { items: AuditLogEntry[]; total: number; page: number; totalPages: number; pageSize: number }
/** Thực tế nhân lực theo tháng, cộng mọi nhà thầu + mọi ca. days = số NGÀY KHÁC NHAU có dòng trong tháng. */
export interface ManpowerActualMonthRow { yearMonth: string; actualSum: number; days: number }

export interface ReadRepo {
  readShifts(): Promise<Shift[]>;                                                   // mọi ca, sortOrder tăng
  readManpowerWeekly(projectId: number): Promise<WeekContractorRow[]>;              // sort weekStart, contractorId
  readManpowerRange(projectId: number): Promise<DateRange | null>;                  // min/max workDate; không có dòng → null
  // Bước 5
  readFactSnapshots(yearMonth: string): Promise<FactSnapshot[]>;         // 'all' = bản isLatest của THÁNG MỚI NHẤT mỗi dự án
  readFinancialSnapshots(yearMonth: string): Promise<FinancialSnapshot[]>; // như trên cho fact_financial
  readVolumeSnapshots(yearMonth: string): Promise<VolumeSnapshot[]>;       // 'all' = tháng mới nhất mỗi (projectId, factoryId)
  readMonthlyEvm(months: string[], projectIds: number[]): Promise<MonthlyEvmRow[]>; // chỉ isLatest; tháng không có dòng → không trả
  // Bước 6
  readLastAuditAt(): Promise<string | null>;                                 // ISO; bảng rỗng → null
  readActivitySince(since: Date): Promise<ActivityLogEntry[]>;               // createdAt >= since, mới nhất trước
  readAuditLogPage(opts: { since: Date | null; page: number; pageSize: number }): Promise<AuditLogPageResult>;
  // Bước 6 (P3C-B T5)
  readManpowerActualByMonth(projectId: number): Promise<ManpowerActualMonthRow[]>; // sort yearMonth; không có dòng -> []
}
