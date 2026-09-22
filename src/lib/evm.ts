import { THRESHOLDS } from './thresholds';
import { findCurrentStage } from './stages';
import type { StageCode, Status, ValueChainProgress } from '@/server/repo/types';

/**
 * Business logic EVM - nguồn duy nhất cho mọi công thức tính.
 * Spec mục 4 + QuyUoc_DinhNghia_NguongDanhGia.docx.
 * Pure functions, unit-test được.
 * TODO: audit EVM inline dup - mọi nơi tính SPI/CPI/EAC phải gọi hàm ở đây, không tự tính lại.
 */

export function calcPv(pctPlan: number, bac: number): number {
  return pctPlan * bac;
}

export function calcEv(pctActual: number, bac: number): number {
  return pctActual * bac;
}

export function calcSpi(ev: number, pv: number): number | null {
  if (!pv) return null;
  return ev / pv;
}

export function calcCpi(ev: number, ac: number): number | null {
  if (!ac) return null;
  return ev / ac;
}

export function calcEac(bac: number, cpi: number | null): number | null {
  if (!cpi) return null;
  return bac / cpi;
}

export function calcVac(bac: number, eac: number | null): number | null {
  if (eac == null) return null;
  return bac - eac;
}

export function calcSv(ev: number, pv: number): number {
  return ev - pv;
}

export function calcCv(ev: number, ac: number): number {
  return ev - ac;
}

/**
 * Trạng thái dự án (theo QuyUoc mục 2):
 * - Chuẩn bị: chưa có ngày BĐ thực tế
 * - Đang triển khai: có ngày BĐ thực tế và %TT < 100%
 * - Hoàn thành: %TT >= 100% và có ngày KT thực tế
 */
export function deriveStatus(input: {
  actualStartDate: string | null;
  actualFinishDate: string | null;
  pctActual: number;
}): Status {
  // TODO: 'Tam_dung' unreachable - Status enum có nhưng hàm này không bao giờ return. Thiếu input dấu hiệu tạm dừng.
  if (input.pctActual >= THRESHOLDS.completionPct && input.actualFinishDate) {
    return 'Hoan_thanh';
  }
  if (!input.actualStartDate) return 'Chuan_bi';
  return 'Dang_trien_khai';
}

/** Đúng/Trễ tiến độ - chỉ áp dụng dự án Đang triển khai. */
export function isOnTrack(pctActual: number, pctPlan: number): boolean {
  return pctActual >= pctPlan - THRESHOLDS.scheduleTolerancePct;
}

export type PenaltyState = 'penalized' | 'risk' | 'none';

/** Nguy cơ / Đã phạt HĐ (QuyUoc mục 4). */
export function penaltyState(input: {
  committedHandoverDate: string | null;
  pctActual: number;
  penalized: boolean;
  today?: Date;
}): PenaltyState {
  if (input.penalized) return 'penalized';
  const handover = input.committedHandoverDate ? new Date(input.committedHandoverDate) : null;
  if (!handover || Number.isNaN(handover.getTime())) return 'none';
  const today = input.today ?? new Date();
  const daysLeft = Math.ceil((handover.getTime() - today.getTime()) / 86_400_000);
  const willMiss = input.pctActual < THRESHOLDS.completionPct;
  if (daysLeft <= THRESHOLDS.penaltyRiskDays && willMiss) return 'risk';
  return 'none';
}

/** Khâu nghẽn: stage applicable ĐẦU TIÊN trong chuỗi có %HT < 100% (bỏ qua giai đoạn không áp dụng). */
export function findBottleneck(chain: ValueChainProgress[]): StageCode | null {
  return findCurrentStage(chain);
}

/** Cảnh báo công nợ quá hạn > 5% giá trị HĐ. */
export function isOverdueWarning(arOverdue: number, contractValue: number): boolean {
  if (!contractValue) return false;
  return arOverdue > THRESHOLDS.overdueWarnPct * contractValue;
}

/** Cảnh báo dồn tải xưởng: sản lượng tháng > 85% × (công suất năm/12). */
export function isCapacityWarning(monthTonnage: number, capacityTonPerYear: number): boolean {
  if (!capacityTonPerYear) return false;
  return monthTonnage > THRESHOLDS.capacityWarnPct * (capacityTonPerYear / 12);
}

/** Cảnh báo huy động thiết bị < 80%. */
export function isEquipmentWarning(actual: number, planned: number): boolean {
  if (!planned) return false;
  return actual / planned < THRESHOLDS.equipmentWarnPct;
}

export interface EvmSnapshot {
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  cv: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
  vac: number | null;
}

export function computeEvm(bac: number, pctPlan: number, pctActual: number, ac: number): EvmSnapshot {
  const pv = calcPv(pctPlan, bac);
  const ev = calcEv(pctActual, bac);
  const spi = calcSpi(ev, pv);
  const cpi = calcCpi(ev, ac);
  const eac = calcEac(bac, cpi);
  return {
    pv,
    ev,
    ac,
    sv: calcSv(ev, pv),
    cv: calcCv(ev, ac),
    spi,
    cpi,
    eac,
    vac: calcVac(bac, eac),
  };
}
