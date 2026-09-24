import type { Contractor, Equipment, Shift, Stage } from '@/server/repo/types';
import { DEFAULT_STAGE_WEIGHTS, STAGE_CALC_MODE, STAGE_ORDER } from '@/lib/stages';

/** 7 giai đoạn thành dimension thật. Tên song ngữ khớp i18n key stage.* trong src/lib/labels.ts. */
export const stages: Stage[] = [
  { code: 'design', nameVi: 'Thiết kế', nameEn: 'Design', sortOrder: 1, calcMode: STAGE_CALC_MODE.design },
  { code: 'shop', nameVi: 'Shop Drawing', nameEn: 'Shop Drawing', sortOrder: 2, calcMode: STAGE_CALC_MODE.shop },
  { code: 'procurement', nameVi: 'Vật tư', nameEn: 'Materials', sortOrder: 3, calcMode: STAGE_CALC_MODE.procurement },
  { code: 'fabrication', nameVi: 'Gia công', nameEn: 'Fabrication', sortOrder: 4, calcMode: STAGE_CALC_MODE.fabrication },
  { code: 'transport', nameVi: 'Vận chuyển', nameEn: 'Transport', sortOrder: 5, calcMode: STAGE_CALC_MODE.transport },
  { code: 'erection', nameVi: 'Lắp dựng', nameEn: 'Erection', sortOrder: 6, calcMode: STAGE_CALC_MODE.erection },
  { code: 'handover', nameVi: 'Nghiệm thu & Bàn giao', nameEn: 'Handover', sortOrder: 7, calcMode: STAGE_CALC_MODE.handover },
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
  { code: 'afternoon', nameVi: 'Ca chiều', nameEn: 'Afternoon', sortOrder: 2, isActive: true },
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

export { DEFAULT_STAGE_WEIGHTS, STAGE_ORDER };
