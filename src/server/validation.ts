import { z } from 'zod';
import { THRESHOLDS } from '@/lib/thresholds';
import { isValidIsoDate, isValidYearMonth } from '@/lib/clock';
import { KEY_MS_MAX_ROWS, KEY_MS_NAME_MAX } from '@/lib/key-milestones';
import { DAILY_VALUE_MAX } from '@/lib/daily-entry';
import { DAILY_IMPORT_MAX_DAYS } from '@/lib/daily-import';
import { FX_CURRENCIES } from '@/lib/fx';
import { currentMonth } from '@/lib/clock';
import { IMPORT_MAX_BYTES } from '@/lib/import-limits';
import { PROJECT_NAME_MAX } from '@/lib/project-form';
import { isValidProjectCode, PROJECT_CODE_MAX } from '@/lib/project-code';
import { EQUIP_NOTE_MAX, EQUIP_PLAN_MAX_ROWS, EQUIP_UNIT_MAX } from '@/lib/equipment-plan';

/**
 * Zod schema validate input mọi server action (spec §7.5 - không tin client).
 * Ngưỡng % dùng THRESHOLDS.pctInputMax - 1 chỗ, khớp form validate.
 */

// N-7 (danh-gia.md, vòng 2): trước đây regex ở ĐÂY (đường GHI) chỉ check format (\d{2} chấp nhận
// cả '00'/'99'), lỏng hơn isValidYearMonth() ở clock.ts (đường ĐỌC, đã validate cả tháng 01-12
// lẫn miền năm 1900-2999 từ N-3). '2026-99' từng lọt qua đây, ghi 1 dòng vĩnh viễn vào bảng
// append-only ở tháng không dropdown nào chọn được. Dùng CHUNG isValidYearMonth() - một nguồn
// định nghĩa duy nhất cho cả đọc lẫn ghi, thay vì tự định nghĩa lại regex ở đây.
const yearMonth = z.string().refine(isValidYearMonth, 'yearMonth phải dạng YYYY-MM hợp lệ (tháng 01-12)');
const pct = z.number().min(0).max(THRESHOLDS.pctInputMax);
const nonNegative = z.number().min(0);
const nullableDate = z.string().nullable().optional();
const isoDate = z.string().refine(isValidIsoDate, 'Ngày phải dạng YYYY-MM-DD hợp lệ');
export const keyMilestoneRowSchema = z.object({
  name: z.string().trim().min(1).max(KEY_MS_NAME_MAX),
  plannedDate: isoDate,
  actualDate: isoDate.nullable(),
});
export const saveKeyMilestonesSchema = z.object({
  projectId: z.number().int().positive(),
  rows: z.array(keyMilestoneRowSchema).max(KEY_MS_MAX_ROWS),
});

const MARKET = ['TN', 'XK', 'NoiBo'] as const;
const PROJECT_TYPE = [
  'EPC',
  'San_van_dong',
  'San_bay',
  'Nha_xuong',
  'Cau_cang',
  'Cao_tang',
  'Dong_tau',
  'Cau_giao_thong',
  'Khac',
] as const;
const PRIORITY = ['P0', 'P1', 'P2', 'P3'] as const;
const CURRENCY = ['VND', 'USD', 'EUR'] as const;
const STAGE_CODES = ['design', 'shop', 'procurement', 'fabrication', 'transport', 'erection', 'handover'] as const;

export const saveMonthlyDataSchema = z.object({
  projectId: z.number().int().positive(),
  month: yearMonth,
  patch: z.object({
    pctPlan: pct.optional(),
    chain: z.array(z.object({
      stageCode: z.enum(STAGE_CODES),
      pctComplete: pct,
      applicable: z.boolean(),
    })).length(7)
      .refine((arr) => new Set(arr.map((s) => s.stageCode)).size === 7, { message: 'stageCode phải đủ 7 giai đoạn khác nhau' })
      .optional(),
    ac: nonNegative.optional(),
    equipmentActual: nonNegative.optional(),
    projectName: z.string().optional(),
    customerId: z.number().int().positive().optional(),
    teamKdId: z.number().int().positive().optional(),
    marketCode: z.enum(MARKET).optional(),
    projectType: z.enum(PROJECT_TYPE).optional(),
    priority: z.enum(PRIORITY).optional(),
    contractValue: z.number().positive().optional(),
    tonnage: nonNegative.optional(),
    currencyCode: z.enum(CURRENCY).optional(),
    contractDate: nullableDate,
    plannedStartDate: nullableDate,
    plannedFinishDate: nullableDate,
    committedHandoverDate: nullableDate,
    actualStartDate: nullableDate,
    actualFinishDate: nullableDate,
    penaltyValue: z.number().min(0).nullable().optional(),
    penalized: z.boolean().optional(),
    revenueCumulative: nonNegative.optional(),
    costActualCumulative: nonNegative.optional(),
    arCollected: nonNegative.optional(),
    arOutstanding: nonNegative.optional(),
    arOverdue: nonNegative.optional(),
    factoryId: z.number().int().positive().nullable().optional(),
    volumeTonnage: z.number().min(0).max(1_000_000).optional(),
  }),
});

/** P3A (Task 5): bảng trọng số 7 giai đoạn gửi từ form - đủ 7 mã khác nhau. */
export const stageWeightRowsSchema = z
  .array(
    z.object({
      stageCode: z.enum(STAGE_CODES),
      weightPct: z.number().min(0).max(100),
      applicable: z.boolean(),
    }),
  )
  .length(7)
  .refine((arr) => new Set(arr.map((s) => s.stageCode)).size === 7, { message: 'stageCode phải đủ 7 giai đoạn khác nhau' });

/** P3A (Task 5): các trường hồ sơ dùng chung cho tạo mới VÀ sửa (G-4/7/8/11/12). */
const PROFILE_SHAPE = {
  projectName: z.string().trim().min(1).max(PROJECT_NAME_MAX),
  customerId: z.number().int().positive(),
  teamKdId: z.number().int().positive(),
  marketCode: z.enum(MARKET),
  projectType: z.enum(PROJECT_TYPE),
  priority: z.enum(PRIORITY),
  contractValue: z.number().positive(),
  tonnage: nonNegative,
  currencyCode: z.enum(CURRENCY),
  contractValueOriginal: z.number().positive().nullable(),
  contractDate: isoDate.nullable(),
  plannedStartDate: isoDate.nullable(),
  plannedFinishDate: isoDate.nullable(),
  committedHandoverDate: isoDate.nullable(),
  actualStartDate: isoDate.nullable(),
  actualFinishDate: isoDate.nullable(),
  penaltyValue: z.number().min(0).nullable(),
  penalized: z.boolean(),
  factoryId: z.number().int().positive().nullable(),
};

/** P3A (Task 5): patch hồ sơ khi SỬA dự án (`updateProjectAction`) - chỉ nhận field đã khai báo. */
export const updateProjectSchema = z.object({
  projectId: z.number().int().positive(),
  patch: z.object(PROFILE_SHAPE).partial().strict(),
});

/** P3A (Task 5, G-3): đổi mã CT hiện hành. */
export const projectCodeSchema = z.object({
  projectId: z.number().int().positive(),
  code: z.string().trim().min(1).max(PROJECT_CODE_MAX).refine(isValidProjectCode, 'Mã CT không hợp lệ'),
  reason: z.string().trim().min(5).max(300),
});

/** P3A (Task 5): gỡ 1 mã SAP khỏi dự án. */
export const removeSapSchema = z.object({
  projectId: z.number().int().positive(),
  sapCodeId: z.number().int().positive(),
});

/** P3A (Task 6, G-17): gán/gỡ PIC hoặc Backup cho dự án - chỉ admin. */
export const projectMemberSchema = z.object({
  projectId: z.number().int().positive(),
  email: z.string().trim().toLowerCase().email(),
  roleInProject: z.enum(['PIC', 'Backup']),
});

export const createProjectSchema = z.object({
  projectName: z.string().trim().min(1).max(PROJECT_NAME_MAX),
  customerId: z.number().int().positive(),
  teamKdId: z.number().int().positive(),
  marketCode: z.enum(MARKET),
  projectType: z.enum(PROJECT_TYPE),
  priority: z.enum(PRIORITY),
  contractValue: z.number().positive(),
  tonnage: z.number().positive(),
  currencyCode: z.enum(CURRENCY).optional(),
  contractDate: isoDate.nullable().optional(),
  plannedStartDate: isoDate,
  plannedFinishDate: isoDate,
  committedHandoverDate: isoDate,
  actualStartDate: isoDate.nullable().optional(),
  actualFinishDate: isoDate.nullable().optional(),
  penaltyValue: z.number().min(0).nullable().optional(),
  penalized: z.boolean().optional(),
  factoryId: z.number().int().positive().nullable().optional(),
  contractValueOriginal: z.number().positive().nullable().optional(),
  currentAliasCode: z.string().trim().min(1).max(PROJECT_CODE_MAX).refine(isValidProjectCode, 'Mã CT không hợp lệ').optional(),
  keyMilestones: z.array(keyMilestoneRowSchema).max(KEY_MS_MAX_ROWS).optional(),
  stageWeights: stageWeightRowsSchema.optional(),
});

export const addSapCodeSchema = z.object({
  projectId: z.number().int().positive(),
  sapCode: z.string().trim().min(1),
  sourceDocType: z.string(),
});

export const userRoleSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'bod', 'data-entry', 'viewer']),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const createAccountSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  role: z.enum(['admin', 'bod', 'data-entry', 'viewer']),
  password: z.string().min(8),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
});

export const lockMonthSchema = z.object({
  yearMonth,
});

export const commitImportSchema = z.object({
  month: yearMonth,
  rows: z
    .array(
      z.object({
        projectId: z.number().int().positive(),
        pctActual: pct,
      }),
    )
    .min(1),
});

// ---- Import Excel ----

/** Giới hạn dung lượng 1 file import (10MB) - chặn ở action trước khi parse (chống DoS). */
export { IMPORT_MAX_BYTES };

/** H-1a (danh-gia.md vòng 1): giới hạn số dòng đọc ở `importExcelAction` (import SAP legacy) - chặn TRƯỚC khi dựng preview. */
export const IMPORT_LEGACY_MAX_ROWS = 5000;

/** Nợ F4 (P2A, Task 9): đọc bằng exceljs - không còn nhận .xls (chỉ .xlsx/.csv). */
export const importFileSchema = z.object({
  name: z.string().regex(/\.(xlsx|csv)$/i, 'Chỉ chấp nhận file .xlsx/.csv'),
  size: z.number().int().positive().max(IMPORT_MAX_BYTES, 'File vượt quá 10MB'),
});

// ---- Ảnh hiện trường ----

/** Giới hạn dung lượng 1 ảnh upload (5MB) - chặn ở action trước khi ghi filesystem. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const photoFileSchema = z.object({
  type: z.string().regex(/^image\//, 'Chỉ chấp nhận file ảnh'),
  size: z.number().int().positive().max(PHOTO_MAX_BYTES, 'Ảnh vượt quá 5MB'),
});

export const addPhotoSchema = z.object({
  projectId: z.number().int().positive(),
  yearMonth,
  caption: z.string().trim().max(200),
});

export const deletePhotoSchema = z.object({
  photoId: z.number().int().positive(),
});

// ---- Dim chuẩn hóa (customer / team) ----
export const suggestDimSchema = z.object({
  field: z.enum(['customer', 'team']),
  query: z.string().max(100),
});

export const createDimSchema = z.object({
  field: z.enum(['customer', 'team']),
  name: z.string().trim().min(1).max(120),
});

export const renameDimSchema = z.object({
  field: z.enum(['customer', 'team']),
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
});

export const mergeDimSchema = z.object({
  field: z.enum(['customer', 'team']),
  fromId: z.number().int().positive(),
  toId: z.number().int().positive(),
});

// ---- G-18: nhà thầu tham gia dự án (Task 3, P2A) ----
export const projectContractorSchema = z.object({
  projectId: z.number().int().positive(),
  contractorId: z.number().int().positive(),
});

export const createContractorSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  scopeOfWork: z.string().trim().max(200),
});

/** Task 4 (P2A): nhân lực theo ca + thiết bị theo ngày. */
const dailyValue = z.number().int().min(0).max(DAILY_VALUE_MAX);
const manpowerCellSchema = z.object({
  contractorId: z.number().int().positive(),
  shiftCode: z.string().trim().min(1).max(20),
  plannedHeadcount: dailyValue,
  actualHeadcount: dailyValue,
});
const equipmentCellSchema = z.object({
  contractorId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  qtyPlanned: dailyValue,
  qtyActual: dailyValue,
});
export const saveDailyResourcesSchema = z.object({
  projectId: z.number().int().positive(),
  workDate: z.string().refine(isValidIsoDate, 'Ngày phải dạng YYYY-MM-DD hợp lệ'),
  manpower: z.array(manpowerCellSchema).max(500),
  equipment: z.array(equipmentCellSchema).max(500),
  reason: z.string().trim().max(500).optional(),
});

/** Task 5 (P2A): file import Excel nhân lực/thiết bị theo ngày - chỉ nhận .xlsx. */
export const dailyImportFileSchema = z.object({
  name: z.string().regex(/\.xlsx$/i, 'Chỉ chấp nhận file .xlsx'),
  size: z.number().int().positive().max(IMPORT_MAX_BYTES, 'File vượt quá 10MB'),
});

/** T8 (Task 6, P2A): CRUD khu vực sản xuất / công suất. */
export const factorySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().max(60),
  capacityTonPerYear: z.number().positive().max(10_000_000),
});

/** T6 (Task 7, P2A): tỷ giá tháng - chỉ USD/EUR, tháng không được ở tương lai. */
export const saveExchangeRateSchema = z.object({
  currencyCode: z.enum(FX_CURRENCIES),
  yearMonth: yearMonth.refine((ym) => ym <= currentMonth(), 'Tháng không được ở tương lai'),
  rateToVnd: z.number().positive().max(1_000_000),
});

export const deleteExchangeRateSchema = z.object({
  currencyCode: z.enum(FX_CURRENCIES),
  yearMonth,
});

/** Task 5 (P2A): commit các ngày đã xem trước từ import Excel. */
export const commitDailyImportSchema = z.object({
  projectId: z.number().int().positive(),
  days: z
    .array(
      z.object({
        workDate: z.string().refine(isValidIsoDate, 'Ngày phải dạng YYYY-MM-DD hợp lệ'),
        manpower: z.array(manpowerCellSchema).max(500),
        equipment: z.array(equipmentCellSchema).max(500),
      }),
    )
    .min(1)
    .max(DAILY_IMPORT_MAX_DAYS),
  reason: z.string().trim().max(500).optional(),
});

/** T11 (Task 8, P2A): đóng alert - bắt buộc ghi hành động đã xử lý (Q12). */
export const closeAlertSchema = z.object({
  alertId: z.number().int().positive(),
  action: z.string().trim().min(3).max(500),
  note: z.string().trim().max(1000),
});

/** P3A (Task 12): kế hoạch sử dụng thiết bị theo từng chiếc - nguồn Gantt thiết bị (T14). */
export const saveEquipmentPlansSchema = z.object({
  projectId: z.number().int().positive(),
  rows: z
    .array(
      z.object({
        equipmentId: z.number().int().positive(),
        unitNo: z.number().int().min(1).max(EQUIP_UNIT_MAX),
        workItemId: z.number().int().positive().nullable(),
        plannedStart: isoDate,
        plannedFinish: isoDate,
        note: z.string().trim().max(EQUIP_NOTE_MAX),
      }),
    )
    .max(EQUIP_PLAN_MAX_ROWS),
});
