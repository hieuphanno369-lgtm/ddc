/**
 * Data model - phản chiếu star-schema trong MASTER_PROMPT mục 3.
 * Single source of truth cho types. Đổi sang Prisma/Supabase sau: giữ nguyên
 * các type này, chỉ swap phần repository impl.
 */

export type Market = 'TN' | 'XK' | 'NoiBo';
export type ProjectType =
  | 'EPC'
  | 'San_van_dong'
  | 'San_bay'
  | 'Nha_xuong'
  | 'Cau_cang'
  | 'Cao_tang'
  | 'Dong_tau'
  | 'Cau_giao_thong'
  | 'Khac';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Status = 'Chuan_bi' | 'Dang_trien_khai' | 'Hoan_thanh' | 'Tam_dung';
export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'AUD' | 'SAR';

/** Chuỗi giá trị DDC - theo đúng thứ tự Thiết kế → Shop → Gia công → Vận chuyển → Lắp dựng → Nghiệm thu. */
export type StageCode =
  | 'design'
  | 'shop'
  | 'procurement'
  | 'fabrication'
  | 'transport'
  | 'erection'
  | 'handover';

export interface Customer {
  id: number;
  name: string;
  group: string;
  aliases: string[]; // tên cũ/đồng nghĩa - dùng để autocomplete + truy vết merge
  isActive: boolean;
  mergedIntoId: number | null; // id canonical sau khi merge (null = chưa merge)
}

export interface TeamKd {
  id: number;
  name: string;
  picName: string;
  aliases: string[];
  isActive: boolean;
  mergedIntoId: number | null;
}

export interface Factory {
  id: number;
  name: string;
  region: string;
  capacityTonPerYear: number;
}

export interface Currency {
  code: CurrencyCode;
  name: string;
}

export interface ExchangeRate {
  currencyCode: CurrencyCode;
  yearMonth: string; // 'YYYY-MM'
  rateToVnd: number;
}

export interface ProjectAlias {
  id: number;
  projectId: number;
  aliasCode: string;
  aliasType: 'Ma_CT' | 'Ma_noi_bo';
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  approvedBy: string;
}

export interface ProjectSapCode {
  id: number;
  projectId: number;
  sapCode: string;
  sourceDocType: string;
  linkedAt: string;
  linkedBy: string;
  note: string;
}

export interface Project {
  id: number;
  masterCode: string; // surrogate unique - KHÔNG dùng mã CCM làm khóa
  currentAliasCode: string;
  projectName: string;
  customerId: number;
  teamKdId: number;
  marketCode: Market;
  projectType: ProjectType;
  priority: Priority;
  contractValue: number; // tỷ VNĐ, trước VAT
  tonnage: number; // khối lượng kết cấu thép (tấn)
  currencyCode: CurrencyCode;
  contractDate: string | null;
  plannedStartDate: string | null;
  plannedFinishDate: string | null;
  committedHandoverDate: string | null;
  actualStartDate: string | null;
  actualFinishDate: string | null;
  penaltyValue: number | null; // giá trị phạt ước tính (tỷ VNĐ)
  penalized: boolean; // Đã bị phạt HĐ?
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface FactProgressMonthly {
  projectId: number;
  yearMonth: string; // 'YYYY-MM'
  pctPlan: number;
  pctActual: number;
  actualStartDate: string | null;
  actualFinishDate: string | null;
  bac: number; // snapshot contractValue tại thời điểm ghi - metrics lịch sử không đổi khi sửa contractValue
  pv: number;
  ev: number;
  ac: number;
  spi: number | null;
  cpi: number | null;
  bottleneckStage: StageCode | null;
  equipmentPlanned: number;
  equipmentActual: number;
  snapshotLockedAt: string | null;
  lockedBy: string | null;
  version: number; // append-only: mỗi lần lưu = version mới, latest wins
  changedBy: string;
  changedAt: string;
  changeNote: string; // auto: "pctActual: 45 → 50; ac: 100 → 110"
}

export interface ValueChainProgress {
  projectId: number;
  stageCode: StageCode;
  yearMonth: string;
  pctComplete: number;
  applicable: boolean;
}

export interface FactFinancial {
  projectId: number;
  yearMonth: string;
  revenuePeriod: number;
  revenueCumulative: number;
  costActualPeriod: number;
  costActualCumulative: number;
  grossProfit: number;
  grossMarginPct: number;
  backlog: number;
  arCollected: number;
  arOutstanding: number;
  arOverdue: number;
  version: number;
  changedBy: string;
  changedAt: string;
  changeNote: string;
}

/** Snapshot hồ sơ project trước mỗi lần sửa (append-only, không ghi đè). */
export interface ProjectHistoryEntry {
  at: string;
  by: string;
  note: string;
  snapshot: Project;
}

export interface FactVolume {
  projectId: number;
  yearMonth: string;
  factoryId: number;
  tonnageProcessed: number;
}

export interface AlertLog {
  id: number;
  projectId: number;
  alertType: 'Red' | 'Amber';
  ruleTriggered: string;
  message: string;
  openedAt: string;
  closedAt: string | null;
  owner: string;
  action: string;
  deadline: string;
}

export interface ProjectPhoto {
  id: number;
  projectId: number;
  yearMonth: string;
  url: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: string;
}

export type Role = 'admin' | 'bod' | 'data-entry' | 'viewer';

/** Tài khoản người dùng (email + password hash + quyền). */
export interface UserAccount {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  canViewFinance: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Activity log - ghi user làm gì lúc nào (retention 14 ngày). */
export interface ActivityLogEntry {
  id: number;
  userEmail: string;
  userName: string;
  action: string;
  detail: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface ProjectAssignment {
  projectId: number;
  userEmail: string;
  roleInProject: 'PIC' | 'Backup';
  assignedBy: string;
  assignedAt: string;
}

export interface AuditLogEntry {
  id: number;
  tableName: string;
  recordId: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

export interface SapQueueItem {
  id: number;
  sapCode: string;
  sourceDocType: string;
  projectNameHint: string;
  status: 'pending' | 'resolved';
  projectId: number | null;
  detectedAt: string;
}
