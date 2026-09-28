/**
 * Data model - phản chiếu star-schema trong MASTER_PROMPT mục 3.
 * Single source of truth cho types. Đổi sang Prisma/Supabase sau: giữ nguyên
 * các type này, chỉ swap phần repository impl.
 */
import type { AlertCandidate } from '@/lib/alert-rules';

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
export type CurrencyCode = 'VND' | 'USD' | 'EUR';

/** Mã giai đoạn - khoá dim_stage, do admin thêm được (không còn union cố định). */
export type StageCode = string;

/** Cột hiển thị ở thẻ "Chuỗi giá trị quản lý dự án": trái/phải. */
export type StageSide = 'left' | 'right';

export interface Customer {
  id: number;
  name: string;
  group: string;
  aliases: string[]; // tên cũ/đồng nghĩa - dùng để autocomplete + truy vết merge
  isActive: boolean;
  mergedIntoId: number | null; // id canonical sau khi merge (null = chưa merge)
  needsReview: boolean; // true = tao tu form boi data-entry, cho admin duyet/gop (G-5)
  createdBy: string; // email nguoi tao; 'system' = seed/import
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
  isActive: boolean;
}

export interface Currency {
  code: CurrencyCode;
  name: string;
}

export type FxSource = 'vcb' | 'manual';

export interface ExchangeRate {
  currencyCode: CurrencyCode;
  yearMonth: string; // 'YYYY-MM'
  rateToVnd: number;
  source: FxSource;
  updatedBy: string | null;
  updatedAt: string | null;
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
  factoryId: number | null; // khu vực/nhà máy SX chính
  contractValueOriginal: number | null; // G-7: giá trị HĐ theo currencyCode
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/** P3A (Task 4): input tạo dự án - mở rộng từ input cũ để nhận đủ các trường hồ sơ mới. */
export interface CreateProjectInput {
  projectName: string;
  customerId: number;
  teamKdId: number;
  marketCode: Market;
  projectType: ProjectType;
  priority: Priority;
  contractValue: number;
  tonnage?: number;
  currencyCode?: CurrencyCode;
  contractDate?: string | null;
  plannedStartDate?: string | null;
  plannedFinishDate?: string | null;
  committedHandoverDate?: string | null;
  penaltyValue?: number | null;
  actualStartDate?: string | null;
  actualFinishDate?: string | null;
  penalized?: boolean;
  factoryId?: number | null;
  contractValueOriginal?: number | null;
  currentAliasCode?: string;
  /** Vòng sửa reviewer (tạo dự án nguyên tử): ghi CÙNG transaction với việc tạo dự án - xem
   * `createProject` (prisma-repo.ts/mock-repo.ts). */
  stageWeights?: StageWeightInput[];
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
  isLatest: boolean;       // true = bản mới nhất của (projectId, yearMonth)
  manpowerPlanned: number;
  manpowerActual: number;
  snapshotLockedAt: string | null;
  lockedBy: string | null;
  version: number; // append-only: mỗi lần lưu = version mới; bản mới nhất có isLatest = true
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

// ---- ERP model v2: giai đoạn có trọng số, sản lượng hạng mục, mốc, nguồn lực ----

export type StageCalcMode = 'manual' | 'volume';

export interface Stage {
  code: StageCode;
  nameVi: string;
  nameEn: string;
  sortOrder: number;
  calcMode: StageCalcMode;
  /** Bên hiển thị ở thẻ Chuỗi giá trị quản lý dự án. */
  side: StageSide;
  /** false = ngừng dùng: ẩn khỏi chart/form, giữ số liệu cũ. */
  isActive: boolean;
}

/** Kết quả bật/tắt giai đoạn (P7-C2 Task 8): `in_use` kèm số dự án còn đặt trọng số > 0%. */
export type SetStageActiveResult = 'ok' | 'not_found' | 'last_active' | { status: 'in_use'; count: number };

export interface ProjectStageWeight {
  projectId: number;
  stageCode: StageCode;
  weightPct: number;      // điểm phần trăm 0..100
  applicable: boolean;
}

/** P3A (Task 4): 1 hàng trọng số gửi lên khi lưu (không có projectId - áp cho dự án đang sửa). */
export interface StageWeightInput {
  stageCode: StageCode;
  weightPct: number;
  applicable: boolean;
}

export interface ProjectWorkItem {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
}

export interface FactStageWorkItem {
  projectId: number;
  stageCode: StageCode;
  workItemId: number;
  yearMonth: string;      // 'YYYY-MM'
  qtyPlan: number;        // tấn
  qtyActual: number;      // tấn
}

/** Đúng 5 cột ngày có thật trong DB - dùng cho seed/ghi. */
export interface FactStageMilestone {
  projectId: number;
  stageCode: StageCode;
  plannedStart: string | null;    // 'YYYY-MM-DD'
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  forecastDate: string | null;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Cái mà repo TRẢ RA khi đọc: 5 cột DB + mốc thứ 6 "Ngày chênh lệch" tính runtime (Q1).
 * Tách riêng khỏi FactStageMilestone để `prisma.factStageMilestone.createMany` trong seed
 * không bị lỗi "Unknown arg dayVariance".
 */
export interface StageMilestoneView extends FactStageMilestone {
  /** actualFinish − plannedFinish, tính bằng ngày. Dương = trễ · âm = sớm · null = chưa kết thúc. */
  dayVariance: number | null;
}

export interface ProjectKeyMilestone {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
  plannedDate: string | null;
  actualDate: string | null;
}

/** Dòng mốc chính khi GHI (form → action → repo). sortOrder = thứ tự trong mảng, không nhận từ client. */
export interface KeyMilestoneInput {
  name: string;
  plannedDate: string;        // 'YYYY-MM-DD', bắt buộc
  actualDate: string | null;  // 'YYYY-MM-DD'
}

export interface Contractor {
  id: number;
  name: string;
  scopeOfWork: string;
  isActive: boolean;
  mergedIntoId: number | null;
}

export interface ProjectContractor {
  projectId: number;
  contractorId: number;
}

export interface Equipment {
  id: number;
  name: string;
  unit: string;
  isActive: boolean;
}

export interface FactDailyManpower {
  projectId: number;
  contractorId: number;
  workDate: string;       // 'YYYY-MM-DD'
  plannedHeadcount: number;
  actualHeadcount: number;
}

export interface Shift {
  code: string;
  nameVi: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

/** Dòng DB: nhân lực theo ngày × nhà thầu × ca. FactDailyManpower (có sẵn) = tổng NGÀY, giữ nguyên cho mọi chỗ đọc. */
export interface FactDailyManpowerShift {
  projectId: number;
  contractorId: number;
  workDate: string; // 'YYYY-MM-DD'
  shiftCode: string;
  plannedHeadcount: number;
  actualHeadcount: number;
}

export interface ProjectEquipmentPlan {
  id: number;
  projectId: number;
  equipmentId: number;
  unitNo: number | null; // P3A: số chiếc; P3C-A: null với đợt nhập theo SL
  qty: number;           // SL dùng trong đợt (>= 1), dòng cũ = 1
  workItemId: number | null;
  plannedStart: string; // 'YYYY-MM-DD'
  plannedFinish: string; // 'YYYY-MM-DD'
  note: string;
  updatedAt: string;
  updatedBy: string;
}

/** Dòng DB project_equipment_quota. */
export interface ProjectEquipmentQuota { projectId: number; equipmentId: number; totalQty: number; updatedAt: string; updatedBy: string }
/** Dòng DB project_manpower_plan_month. */
export interface ProjectManpowerPlanMonth { projectId: number; yearMonth: string; shiftCode: string; planned: number; isManual: boolean; updatedAt: string; updatedBy: string }
/** Dòng DB project_shift_ratio. */
export interface ProjectShiftRatio { projectId: number; shiftCode: string; pct: number }

// ---- Hợp đồng dữ liệu P3C (A cung cấp, B chỉ import) - chép nguyên văn hop-dong-du-lieu-P3C.md ----
export interface EquipmentPlanSegment {
  id: number; equipmentId: number; equipmentName: string; // tên từ dim_equipment
  from: string; to: string;   // 'YYYY-MM-DD'
  qty: number;                // SL dùng trong đợt
}
export interface EquipmentQuota { equipmentId: number; equipmentName: string; totalQty: number }
export interface ManpowerPlanMonthRow { yearMonth: string; shiftCode: string; planned: number; isManual: boolean }
export interface ShiftRatio { shiftCode: string; pct: number }

/** P3C-A (T4): 1 đợt gửi lên khi lưu. */
export interface EquipmentSegmentInput { from: string; to: string; qty: number }
/** P3C-A (T4): 1 loại thiết bị gửi lên khi lưu - lưu = thay toàn bộ quota + đợt của dự án. */
export interface EquipmentPlanGroupInput { equipmentId: number; totalQty: number; segments: EquipmentSegmentInput[] }
/** P3C-A (T5): 1 ô ca của 1 tháng gửi lên khi lưu. */
export interface ManpowerPlanCellInput { shiftCode: string; planned: number; isManual: boolean }
export interface ManpowerPlanMonthInput { yearMonth: string; cells: ManpowerPlanCellInput[] }
export interface ManpowerPlanInput { ratios: ShiftRatio[]; months: ManpowerPlanMonthInput[] }

/** Kết quả lưu 1 tháng: đã có dòng isLatest ('updated'), chưa có dòng nào ('created'), hoặc dự án không tồn tại ('not_found'). */
export type SaveFactResult = 'created' | 'updated' | 'not_found';

export interface FactDailyEquipmentUsage {
  projectId: number;
  contractorId: number;
  equipmentId: number;
  workDate: string;       // 'YYYY-MM-DD'
  qtyPlanned: number;
  qtyActual: number;
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
  isLatest: boolean;
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
  ruleCode: string | null;
  dedupeKey: string | null;
  closedBy: string | null;
  closeNote: string;
  /** P3B: danh sach kenh da gui, dang 'webhook:1,email:2'; null = chua gui. */
  notifyChannel: string | null;
  notifySentAt: string | null;
  notifyError: string | null;
  notifyAttempts: number;
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
  /** P3E (Task 5) - khác null nghĩa là đang bị khoá do sai mật khẩu 5 lần liên tiếp. */
  lockedAt: string | null;
}

/** P3E (Task 6) - hàng hiển thị trang quản trị: KHÔNG có `passwordHash` (S15, không lộ hash ra trình duyệt). */
export type AdminUserRow = Omit<UserAccount, 'passwordHash'> & { hasPassword: boolean };

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

/** P3A (G-17): 1 người phụ trách dự án - role = null khi tài khoản đã bị xoá. */
export interface ProjectMember {
  userEmail: string;
  name: string;
  role: Role | null;
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
  note: string;
}

export type JobName = 'alerts_daily';
export type JobTrigger = 'cron' | 'lazy' | 'admin';

export interface JobRunEntry {
  id: number;
  jobName: JobName;
  trigger: JobTrigger;
  status: 'running' | 'ok' | 'error';
  detail: string;
  startedAt: string;
  finishedAt: string | null;
  startedBy: string;
}

// ---- Thông báo P3B (kênh/người nhận) ----
export type NotifyKind = 'webhook' | 'email';
export type AlertSeverity = 'Red' | 'Amber';

export interface NotifyChannelSettings {
  webhookFormat?: 'generic' | 'slack' | 'teams'; // kind = webhook
  webhookHost?: string; // host webhook (không bí mật) để admin nhận ra kênh
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  fromAddress?: string; // kind = email
}

export interface NotifyChannel {
  id: number;
  kind: NotifyKind;
  name: string;
  isEnabled: boolean;
  minSeverity: AlertSeverity;
  settings: NotifyChannelSettings;
  secretHint: string;
  hasSecret: boolean; // KHÔNG bao giờ trả secretEnc ra UI
  updatedAt: string;
  updatedBy: string;
}

export interface NotifyRecipient {
  id: number;
  channelId: number;
  email: string;
  minSeverity: AlertSeverity;
  isEnabled: boolean;
}

/** undefined = giữ bí mật cũ; null = xoá; object = thay (đã mã hoá ở tầng action). */
export interface NotifyChannelInput {
  id?: number;
  kind: NotifyKind;
  name: string;
  isEnabled: boolean;
  minSeverity: AlertSeverity;
  settings: NotifyChannelSettings;
  secret?: { enc: string; hint: string } | null;
}

export interface NotifyRecipientInput {
  id?: number;
  channelId: number;
  email: string;
  minSeverity: AlertSeverity;
  isEnabled: boolean;
}

/** CHỈ dùng trong server (dispatcher) - không bao giờ truyền cho client. */
export interface NotifyChannelForSend extends NotifyChannel {
  secretEnc: string | null;
  recipients: NotifyRecipient[];
}

export interface NotifyFinish {
  sentChannels: string | null;
  sentAt: string | null;
  error: string | null;
}

// ---- T11 (Task 8, P2A): engine cảnh báo ----
/** `AlertCandidate` (`src/lib/alert-rules.ts`) + phần engine tự gán (owner/deadline/openedAt). */
export interface NewEngineAlert extends AlertCandidate {
  owner: string;
  deadline: string; // 'YYYY-MM-DD'
  openedAt: string; // ISO timestamp
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

// ---- P3E: khoá đăng nhập sai + giới hạn theo IP/email + token đặt lại mật khẩu ----

/**
 * R1 (bao-mat.md vòng 2) - `login_fail_unknown_email` (khoá theo `email`, cửa sổ 24h) dùng CHUNG cho
 * cả email không có tài khoản LẪN tài khoản CHỈ Google (`passwordHash === ''`) sai ở form mật khẩu:
 * cả 2 phải trả `reason` GIỐNG HỆT nhau qua từng lần sai (không lộ "email này là tài khoản chỉ
 * Google" qua khác biệt reason/`lockedAt`), xem `login-guard.ts`.
 */
/**
 * R7 phần 3, G4 (bao-mat.md) - `'google_denied'` chỉ dùng để hạn chế `activity_log` bị spam bởi các
 * lần Google từ chối lặp lại của CÙNG 1 email (Google không đi qua form mật khẩu nên không dùng
 * `login_fail_ip`/`login_fail_unknown_email`/`LOGIN_LOCK_THRESHOLD`); không phải khoá đăng nhập.
 * S-1 (bao-mat.md vòng 4) - `'reset_submit_ip'` giới hạn số lần GỬI đặt lại mật khẩu
 * (`resetPasswordWithToken`) theo IP, chặn từ chối dịch vụ CPU (bcrypt) từ người không đăng nhập.
 * S-3 (bao-mat.md vòng 4) - `'login_locked_probe'` KHÔNG dùng để quyết định gì, chỉ để nhánh "tài
 * khoản thật đang khoá" trong `checkCredentials` tốn ĐÚNG số lượt gọi DB như nhánh "email lạ" (cân
 * thời gian, chống oracle phân biệt 2 nhánh); kết quả luôn bị bỏ qua.
 */
export type ThrottleKind =
  | 'login_fail_ip'
  | 'login_fail_unknown_email'
  | 'login_locked_probe'
  | 'reset_req_email'
  | 'reset_req_ip'
  | 'reset_submit_ip'
  | 'google_denied';

export interface AuthAccountState {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  canViewFinance: boolean;
  isActive: boolean;
  failedLoginCount: number;
  lockedAt: string | null;
  passwordChangedAt: string | null;
}

/**
 * Mọi tham số `email` của các hàm dưới đây đều đã được BÊN GỌI chuẩn hoá (`trim().toLowerCase()`,
 * qua `normalizeEmail()` ở `src/lib/login-policy.ts` hoặc chuẩn hoá thủ công cùng công thức trong
 * `login-guard.ts`) TRƯỚC khi gọi vào `AuthStore`. Bên gọi KHÔNG được dựa vào việc implementation
 * (`mock-repo-auth.ts`, `prisma-repo-auth.ts`) tự chuẩn hoá: kho bộ nhớ có hạ chữ thường nhưng bản
 * Prisma có thể dùng `email` đúng như nhận được làm khoá tra cứu/khoá throttle.
 */
export interface AuthStore {
  getAccountState(email: string): Promise<AuthAccountState | null>;
  /**
   * +1 bộ đếm sai; đạt `threshold` VÀ chưa khoá thì khoá luôn trong CÙNG lần ghi - PHẢI NGUYÊN TỬ:
   * tăng bằng `increment` rồi khoá bằng điều kiện `lockedAt IS NULL` tại thời điểm ghi (không dựa vào
   * giá trị đọc trước đó), để nhiều lời gọi song song cho CÙNG 1 email chỉ có đúng 1 lời gọi thấy
   * `justLocked: true` cho ĐÚNG 1 lời gọi (không nhất thiết là lời gọi có `count === threshold`), các lời gọi khác (kể cả đến
   * sau khi đã khoá) vẫn tăng bộ đếm nhưng `justLocked: false`. `null` nếu không có tài khoản.
   */
  registerFailedLogin(
    email: string,
    threshold: number,
    nowIso: string,
  ): Promise<{ count: number; locked: boolean; justLocked: boolean } | null>;
  /**
   * L3 (bao-mat.md) - NGUYÊN TỬ, phải tự kiểm lại tại thời điểm ghi, KHÔNG dựa vào bất kỳ giá trị
   * đọc trước đó (chống race TOCTOU khi nhiều yêu cầu đăng nhập chạy đồng thời): chỉ đặt bộ đếm sai
   * về 0 khi tài khoản CHƯA bị khoá (`locked_at IS NULL`) NGAY tại thời điểm ghi; ví dụ Prisma:
   * `UPDATE user_roles SET failed_login_count = 0 WHERE email = $1 AND locked_at IS NULL`.
   * Trả `false` khi không đặt được (đã bị khoá bởi 1 yêu cầu sai khác vừa chạy xong, hoặc không có
   * tài khoản) - bên gọi PHẢI coi `false` là "đã khoá", KHÔNG được coi là đăng nhập thành công.
   */
  resetFailedLogin(email: string): Promise<boolean>;
  /** Xoá khoá + bộ đếm; false nếu không có tài khoản. */
  unlockAccount(email: string): Promise<boolean>;
  /**
   * Đổi mật khẩu; bumpChangedAt = true thì passwordChangedAt = now.
   * S-2 (bao-mat.md vòng 4, chủ dự án chốt 2026-09-28) - LUÔN huỷ (đánh dấu `usedAt = nowIso`) mọi
   * token đặt lại mật khẩu CÒN HẠN của email này, bất kể `bumpChangedAt` - mật khẩu đã đổi qua đường
   * nào đó khác (tự đổi trong Cài đặt, admin đặt mật khẩu tạm) thì 1 link đặt lại cũ (nếu còn) không
   * còn lý do để dùng được nữa.
   */
  setPassword(email: string, passwordHash: string, bumpChangedAt: boolean, nowIso: string): Promise<boolean>;
  recordThrottle(kind: ThrottleKind, key: string, nowIso: string): Promise<void>;
  countThrottle(kind: ThrottleKind, key: string, sinceIso: string): Promise<number>;
  /**
   * R2 (bao-mat.md vòng 2) - "đếm rồi ghi" (`countThrottle` trước, `recordThrottle` sau) có khoảng
   * hở TOCTOU: N yêu cầu chạy đồng thời qua `Promise.all` đều đọc thấy số đếm CŨ (chưa ai kịp ghi)
   * rồi đều được coi là hợp lệ, vượt hẳn ngưỡng. `reserveThrottle` gộp "đếm cửa sổ [sinceIso, nay]"
   * và "ghi thêm 1 dòng nếu còn chỗ" thành 1 lời gọi NGUYÊN TỬ: đếm xong ghi ngay trong CÙNG 1 lượt,
   * không có `await` nào xen giữa - ở kho bộ nhớ, thân hàm không có `await` nội bộ nên tự nguyên tử
   * theo đúng nghĩa JS đơn luồng (xem ghi chú Promise.all ở `login-guard.ts`).
   * N2 (bao-mat.md vòng 3) - "trong CÙNG 1 lời gọi" ở kho bộ nhớ KHÔNG đủ để mô tả tính nguyên tử
   * thật cho Prisma: 1 câu `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < $limit` chạy ở mức
   * cách ly mặc định READ COMMITTED của Postgres KHÔNG NGUYÊN TỬ - nhiều giao dịch cùng `kind:key`
   * chạy song song đều có thể `SELECT count(*)` thấy số cũ TRƯỚC khi bên kia COMMIT dòng mới, nên cả
   * hai vẫn "còn chỗ" dù tổng đã vượt `limit`. Bản Prisma (Task 5) BẮT BUỘC bọc trong 1 transaction có
   * `pg_advisory_xact_lock(hashtext(kind || ':' || key))` ở đầu (khoá đúng theo cặp `kind:key`, tự
   * nhả khi transaction kết thúc, không chặn các `kind:key` khác) rồi mới đếm cửa sổ + ghi dòng mới -
   * chỉ như vậy mọi giao dịch cùng `kind:key` mới chạy TUẦN TỰ với nhau. "1 câu SQL đơn thuần ở READ
   * COMMITTED" (không khoá) là KHÔNG ĐỦ, dù có `RETURNING`.
   * Cửa sổ đếm là `createdAt >= sinceIso` (TÍNH CẢ BIÊN - dòng có `createdAt` đúng bằng `sinceIso`
   * vẫn được tính vào cửa sổ, không phải `>` nghiêm ngặt).
   * Trả về `id` (khoá chính) của dòng vừa ghi (`nowIso`) nếu số dòng trong cửa sổ (TRƯỚC khi ghi) <
   * `limit`; trả `null` (KHÔNG ghi thêm) nếu đã đủ `limit` - giữ đúng hành vi cũ "vượt ngưỡng thì
   * không ghi thêm dòng nào" (không để bộ đếm phình vô hạn khi bị spam). `id` dùng để `releaseThrottle`
   * xoá ĐÚNG dòng này (xem bên dưới).
   */
  reserveThrottle(kind: ThrottleKind, key: string, nowIso: string, sinceIso: string, limit: number): Promise<number | null>;
  /**
   * Rút lại ĐÚNG 1 dòng đã ghi bởi `reserveThrottle` (nhận lại `id` nó trả về) - dùng khi cuối cùng
   * lượt đó KHÔNG được tính là 1 lần sai/1 lần xin (ví dụ đăng nhập bằng đúng mật khẩu sau khi đã
   * "đặt chỗ" ở đầu `checkCredentials`, hoặc chỗ email hết lượt nên nhả lại chỗ IP đã đặt ở
   * `requestPasswordReset` - N1, xem `login-guard.ts`/`password-reset.ts`).
   * N2 (bao-mat.md vòng 3) - xoá theo `id` (khoá chính), KHÔNG được cài bằng `deleteMany` lọc theo
   * `kind/key/createdAt`: 2 dòng ghi trùng mili giây (cùng `kind/key/createdAt`) sẽ bị xoá NHẦM cả 2
   * thay vì đúng 1 dòng cần rút. Không có dòng nào khớp `id` thì không làm gì (ví dụ dòng đã bị
   * `pruneAuthData` dọn trước đó).
   */
  releaseThrottle(id: number): Promise<void>;
  /** Xoá mọi token cũ của email rồi tạo token mới (1 transaction). */
  replaceResetToken(email: string, tokenHash: string, expiresAtIso: string, requestIp: string): Promise<void>;
  /** Token còn dùng được (chưa dùng, chưa hết hạn, tài khoản còn, có mật khẩu, isActive)? */
  peekResetToken(tokenHash: string, nowIso: string): Promise<boolean>;
  /**
   * Nguyên tử: đánh dấu token đã dùng + đặt mật khẩu + passwordChangedAt = now + bộ đếm về 0 nếu
   * chưa khoá + vô hiệu token khác của email. L5 (bao-mat.md) - phải kiểm CÙNG điều kiện tài khoản
   * như `peekResetToken` tại thời điểm tiêu token (`isActive` và `passwordHash !== ''`), không chỉ
   * lúc `peek`: tài khoản có thể đã bị tắt hoặc chuyển sang chỉ-Google SAU khi token được cấp,
   * trước khi token bị tiêu - lúc đó phải trả `{ ok: false }`, không cho đổi mật khẩu.
   */
  consumeResetToken(
    tokenHash: string,
    passwordHash: string,
    nowIso: string,
  ): Promise<{ ok: true; email: string; name: string; locked: boolean } | { ok: false }>;
  /**
   * Dọn dữ liệu cũ: xoá mọi dòng `auth_throttle` VÀ mọi token đặt lại mật khẩu có `createdAt <
   * beforeIso` - token bị xoá THEO TUỔI, BẤT KỂ đã dùng (`usedAt` khác `null`) hay chưa, còn hạn hay
   * đã hết hạn (K19, gọi định kỳ từ job `alerts_daily`).
   */
  pruneAuthData(beforeIso: string): Promise<void>;
}
