import type {
  Contractor, Equipment, ProjectEquipmentPlan, ProjectEquipmentQuota, ProjectManpowerPlanMonth, ProjectShiftRatio,
  Shift, Stage,
} from '@/server/repo/types';
/** Các giai đoạn chuỗi giá trị thành dimension thật (P7-C2: thêm Thanh quyết toán, side, isActive).
 * Tên song ngữ khớp i18n key stage.* trong src/lib/labels.ts (đã gỡ ở Task 7). */
export const stages: Stage[] = [
  { code: 'design', nameVi: 'Thiết kế', nameEn: 'Design', sortOrder: 1, calcMode: 'manual', side: 'left', isActive: true },
  { code: 'shop', nameVi: 'Shop Drawing', nameEn: 'Shop Drawing', sortOrder: 2, calcMode: 'volume', side: 'left', isActive: true },
  { code: 'procurement', nameVi: 'Vật tư', nameEn: 'Procurement', sortOrder: 3, calcMode: 'volume', side: 'left', isActive: true },
  { code: 'fabrication', nameVi: 'Gia công', nameEn: 'Fabrication', sortOrder: 4, calcMode: 'volume', side: 'left', isActive: true },
  { code: 'transport', nameVi: 'Vận chuyển', nameEn: 'Transport', sortOrder: 5, calcMode: 'volume', side: 'right', isActive: true },
  { code: 'erection', nameVi: 'Lắp dựng', nameEn: 'Erection', sortOrder: 6, calcMode: 'volume', side: 'right', isActive: true },
  { code: 'handover', nameVi: 'Nghiệm thu', nameEn: 'Handover', sortOrder: 7, calcMode: 'manual', side: 'right', isActive: true },
  { code: 'settlement', nameVi: 'Thanh quyết toán', nameEn: 'Settlement', sortOrder: 8, calcMode: 'manual', side: 'right', isActive: true },
];

/** 6 nhà thầu phụ đã chốt (Q8). */
export const contractors: Contractor[] = [
  { id: 1, name: 'Nhà thầu Lắp dựng A', scopeOfWork: 'Lắp dựng kết cấu chính', isActive: true, mergedIntoId: null },
  { id: 2, name: 'Nhà thầu Lắp dựng B', scopeOfWork: 'Lắp dựng mái & sàn', isActive: true, mergedIntoId: null },
  { id: 3, name: 'Nhà thầu Cơ khí C', scopeOfWork: 'Gia công tại công trường', isActive: true, mergedIntoId: null },
  { id: 4, name: 'Nhà thầu Sơn D', scopeOfWork: 'Sơn hoàn thiện', isActive: true, mergedIntoId: null },
  { id: 5, name: 'Nhà thầu Vận chuyển E', scopeOfWork: 'Vận chuyển & tập kết', isActive: true, mergedIntoId: null },
  { id: 6, name: 'Nhà thầu An toàn F', scopeOfWork: 'Giàn giáo & an toàn', isActive: true, mergedIntoId: null },
];

/** Ca làm việc - bảng mở rộng được (thêm ca = INSERT, không migration). */
export const shifts: Shift[] = [
  { code: 'morning', nameVi: 'Ca sáng', nameEn: 'Morning', sortOrder: 1, isActive: true },
  { code: 'evening', nameVi: 'Ca tối', nameEn: 'Evening', sortOrder: 2, isActive: true },
];

/** 7 nhóm thiết bị đã chốt (Q8). */
export const equipments: Equipment[] = [
  { id: 1, name: 'Cẩu bánh xích', unit: 'cái', isActive: true },
  { id: 2, name: 'Cẩu bánh lốp', unit: 'cái', isActive: true },
  { id: 3, name: 'Xe nâng người', unit: 'cái', isActive: true },
  { id: 4, name: 'Máy hàn', unit: 'bộ', isActive: true },
  { id: 5, name: 'Máy phát điện', unit: 'cái', isActive: true },
  { id: 6, name: 'Xe tải chuyên dụng', unit: 'xe', isActive: true },
  { id: 7, name: 'Giàn giáo di động', unit: 'bộ', isActive: true },
];

/** 10 hạng mục đã chốt (Q6), thứ tự này = sortOrder 1..10. */
export const workItemNames: string[] = [
  'Hệ giàn nâng',
  'Hệ cột chính',
  'Hệ dầm sàn',
  'Hệ vì kèo mái',
  'Hệ xà gồ',
  'Hệ giằng',
  'Hệ sàn thao tác',
  'Hệ lan can',
  'Hệ cầu thang',
  'Hệ Walkaway',
];

/** 5 mốc chính đã chốt (Q7) - đúng 2 mốc đầu đã có ngày thực tế. */
export const keyMilestoneSeed: { name: string; plannedDate: string; actualDate: string | null }[] = [
  { name: 'Duyệt thiết kế kỹ thuật', plannedDate: '2026-01-15', actualDate: '2026-01-18' },
  { name: 'Duyệt Shop Drawing đợt 1', plannedDate: '2026-03-01', actualDate: '2026-03-06' },
  { name: 'Xuất xưởng lô đầu tiên', plannedDate: '2026-06-30', actualDate: null },
  { name: 'Hoàn thành lắp dựng', plannedDate: '2026-09-15', actualDate: null },
  { name: 'Nghiệm thu bàn giao', plannedDate: '2026-09-29', actualDate: null },
];

/**
 * Nhân lực ngày cuối cùng của cửa sổ tracking - tổng KH 520 / TT 486 (theo mock-up đã duyệt).
 * Các ngày trước nhân hệ số DAY_FACTORS rồi làm tròn; chỉ ngày cuối được assert trong test.
 */
export const manpowerLastDay: { contractorId: number; planned: number; actual: number }[] = [
  { contractorId: 1, planned: 120, actual: 112 },
  { contractorId: 2, planned: 100, actual: 95 },
  { contractorId: 3, planned: 90, actual: 82 },
  { contractorId: 4, planned: 80, actual: 76 },
  { contractorId: 5, planned: 70, actual: 65 },
  { contractorId: 6, planned: 60, actual: 56 },
];
// Tổng: 520 / 486

/**
 * Thiết bị ngày cuối - tổng KH 72 / TT 63.
 * Cố ý dựng quan hệ nhiều-nhiều: NT1 dùng 3 nhóm thiết bị (TB1/TB2/TB3),
 * TB1 dùng chung bởi NT1+NT2+NT3, TB2 dùng chung bởi NT1+NT6.
 */
export const equipmentLastDay: { contractorId: number; equipmentId: number; planned: number; actual: number }[] = [
  { contractorId: 1, equipmentId: 1, planned: 6, actual: 5 },
  { contractorId: 2, equipmentId: 1, planned: 5, actual: 4 },
  { contractorId: 3, equipmentId: 1, planned: 3, actual: 3 },   // TB1 = 14 / 12
  { contractorId: 1, equipmentId: 2, planned: 8, actual: 7 },
  { contractorId: 6, equipmentId: 2, planned: 4, actual: 4 },   // TB2 = 12 / 11
  { contractorId: 1, equipmentId: 3, planned: 11, actual: 10 }, // TB3 = 11 / 10
  { contractorId: 2, equipmentId: 4, planned: 10, actual: 9 },  // TB4 = 10 / 9
  { contractorId: 3, equipmentId: 5, planned: 9, actual: 8 },   // TB5 = 9 / 8
  { contractorId: 4, equipmentId: 6, planned: 8, actual: 7 },   // TB6 = 8 / 7
  { contractorId: 5, equipmentId: 7, planned: 8, actual: 6 },   // TB7 = 8 / 6
];
// Tổng: 72 / 63

/** Hệ số 7 ngày tracking, ngày cuối = 1 (đúng con số mock-up). */
export const DAY_FACTORS = [0.86, 0.88, 0.91, 0.93, 0.96, 0.98, 1];

/** Dự án nhận trọn bộ dữ liệu ERP chi tiết: id = 1 (SVĐ PVF) - đã chốt (Q9). */
export const ERP_DETAIL_PROJECT_ID = 1;

/** P3A cu (6 dong, theo tung chiec) - chi cho test Gantt cu, xoa o Buoc 11. */
export const legacyEquipmentPlanFixture: ProjectEquipmentPlan[] = [
  { id: 1, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: 1, qty: 1, workItemId: 1, plannedStart: '2026-08-03', plannedFinish: '2026-08-30', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 2, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: 1, qty: 1, workItemId: 4, plannedStart: '2026-08-31', plannedFinish: '2026-10-11', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 3, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: 2, qty: 1, workItemId: 2, plannedStart: '2026-08-10', plannedFinish: '2026-09-27', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 4, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: 3, qty: 1, workItemId: 3, plannedStart: '2026-09-07', plannedFinish: '2026-10-18', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 5, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 2, unitNo: 1, qty: 1, workItemId: 5, plannedStart: '2026-08-17', plannedFinish: '2026-09-20', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 6, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 2, unitNo: 2, qty: 1, workItemId: 6, plannedStart: '2026-09-14', plannedFinish: '2026-10-25', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
];

/** P3C-A (T4): kế hoạch dùng thiết bị theo đợt - dự án ERP_DETAIL_PROJECT_ID, 7 đợt (unitNo null = nhập theo SL). */
export const equipmentPlanSeed: ProjectEquipmentPlan[] = [
  { id: 1, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: null, qty: 1, workItemId: null, plannedStart: '2026-07-06', plannedFinish: '2026-08-30', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 2, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: null, qty: 3, workItemId: null, plannedStart: '2026-08-31', plannedFinish: '2026-10-25', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 3, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, unitNo: null, qty: 2, workItemId: null, plannedStart: '2026-10-26', plannedFinish: '2026-11-29', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 4, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 2, unitNo: null, qty: 2, workItemId: null, plannedStart: '2026-08-17', plannedFinish: '2026-09-20', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 5, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 2, unitNo: null, qty: 1, workItemId: null, plannedStart: '2026-09-21', plannedFinish: '2026-10-25', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 6, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 3, unitNo: null, qty: 3, workItemId: null, plannedStart: '2026-09-01', plannedFinish: '2026-09-30', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { id: 7, projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 3, unitNo: null, qty: 1, workItemId: null, plannedStart: '2026-09-15', plannedFinish: '2026-10-31', note: '', updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
];

/** P3C-A (T4): tổng SL mỗi loại thiết bị của dự án ERP_DETAIL_PROJECT_ID (đợt 6 + 7 chồng 09-15..09-30 = 4, vừa đủ). */
export const equipmentQuotaSeed: ProjectEquipmentQuota[] = [
  { projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 1, totalQty: 3, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 2, totalQty: 2, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, equipmentId: 3, totalQty: 4, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
];

/** P3C-A (T5): kế hoạch nhân lực theo tháng x ca - dự án ERP_DETAIL_PROJECT_ID, 7 tháng, ty le 60/40. */
export const manpowerPlanSeed: ProjectManpowerPlanMonth[] = [
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-06', shiftCode: 'morning', planned: 270, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-06', shiftCode: 'evening', planned: 180, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-07', shiftCode: 'morning', planned: 420, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-07', shiftCode: 'evening', planned: 280, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-08', shiftCode: 'morning', planned: 480, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-08', shiftCode: 'evening', planned: 320, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-09', shiftCode: 'morning', planned: 540, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-09', shiftCode: 'evening', planned: 360, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-10', shiftCode: 'morning', planned: 480, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-10', shiftCode: 'evening', planned: 320, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-11', shiftCode: 'morning', planned: 390, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-11', shiftCode: 'evening', planned: 260, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-12', shiftCode: 'morning', planned: 240, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
  { projectId: ERP_DETAIL_PROJECT_ID, yearMonth: '2026-12', shiftCode: 'evening', planned: 160, isManual: false, updatedAt: '2026-09-02T00:00:00Z', updatedBy: 'system' },
];

/** P3C-A (T5): tỷ lệ chia ca của dự án ERP_DETAIL_PROJECT_ID (60/40, trùng mặc định DEFAULT_SHIFT_RATIO). */
export const shiftRatioSeed: ProjectShiftRatio[] = [
  { projectId: ERP_DETAIL_PROJECT_ID, shiftCode: 'morning', pct: 0.6 },
  { projectId: ERP_DETAIL_PROJECT_ID, shiftCode: 'evening', pct: 0.4 },
];
