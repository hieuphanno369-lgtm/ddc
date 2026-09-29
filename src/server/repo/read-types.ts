import type { ActivityLogEntry, AuditLogEntry, FactProgressMonthly, Shift, ValueChainProgress } from './types';

/** Nhân lực theo tuần ISO (Thứ 2) × nhà thầu, đã cộng mọi ca + mọi ngày trong tuần. */
export interface WeekContractorRow { weekStart: string; contractorId: number; planned: number; actual: number }
export interface DateRange { from: string; to: string } // 'YYYY-MM-DD', from <= to

// --- Bước 5 (T1) ---
export type FactSnapshot = Pick<FactProgressMonthly,
  'projectId' | 'yearMonth' | 'pctActual' | 'bac' | 'pv' | 'ev' | 'ac' | 'spi' | 'cpi' | 'bottleneckStage'>;
export interface FinancialSnapshot { projectId: number; yearMonth: string; revenuePeriod: number; arOverdue: number }
export interface VolumeSnapshot { projectId: number; factoryId: number; yearMonth: string; tonnageProcessed: number }
export interface MonthlyEvmRow { yearMonth: string; pv: number; ev: number; ac: number; spiAvg: number | null; cpiAvg: number | null }
// --- P4 (theo mốc/kỳ) ---
export type FactAsOfRow = FactSnapshot;
export interface FinancialAsOfRow { projectId: number; yearMonth: string; arOverdue: number }
/** Σ revenuePeriod (isLatest) của 1 dự án trong khoảng tháng. */
export interface FlowRow { projectId: number; revenue: number }
/** Σ tonnageProcessed của 1 (dự án, nhà máy) trong khoảng tháng. */
export interface VolumeFlowRow { projectId: number; factoryId: number; tonnage: number }
export interface FactSeriesRow { projectId: number; yearMonth: string; pctActual: number; pv: number; ev: number; ac: number }
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
  // P4: số tồn theo mốc, số phát sinh theo kỳ
  /** Mỗi dự án đang hoạt động: dòng isLatest có yearMonth lớn nhất <= ym. Dự án chưa có dòng nào <= ym: không trả. */
  readFactSnapshotsAsOf(ym: string): Promise<FactAsOfRow[]>;
  /** Như trên cho fact_financial (chỉ arOverdue). */
  readFinancialAsOf(ym: string): Promise<FinancialAsOfRow[]>;
  /** Σ revenuePeriod (isLatest) theo dự án cho yearMonth trong [fromYm, toYm]; không có dòng thì không trả. */
  readRevenueInRange(fromYm: string, toYm: string): Promise<FlowRow[]>;
  /** Σ tonnageProcessed theo (dự án, nhà máy) cho yearMonth trong [fromYm, toYm]. */
  readVolumeInRange(fromYm: string, toYm: string): Promise<VolumeFlowRow[]>;
  /** Dòng isLatest trong [fromYm, toYm] CỘNG dòng cuối cùng < fromYm của mỗi dự án (để mang số vào tháng đầu kỳ). Sắp projectId, yearMonth tăng. projectIds rỗng → []. */
  readFactSeries(fromYm: string, toYm: string, projectIds: number[]): Promise<FactSeriesRow[]>;
  /** Chuỗi giá trị của tháng lớn nhất <= ym có dòng; không có → []. */
  readValueChainAsOf(projectId: number, ym: string): Promise<ValueChainProgress[]>;
  /** MAX(workDate) <= onOrBefore của bảng ngày; không có → null. */
  readLastDailyDate(projectId: number, kind: 'manpower' | 'equipment', onOrBefore: string): Promise<string | null>;
}
