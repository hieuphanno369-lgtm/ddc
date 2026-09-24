import { deriveStatus, isEquipmentWarning, isOverdueWarning, penaltyState } from './evm';
import { formatDayMonth } from './format';
import { THRESHOLDS } from './thresholds';
import { handoverKey, monthKey, weekKey, type AlertRuleCode } from './alert-keys';
import type { IsoDate, YearMonth } from '@/lib/clock';
import type { FactFinancial, FactProgressMonthly, Project } from '@/server/repo/types';

/**
 * T11 (Task 8, P2A): bộ luật cảnh báo (Q9) - hàm THUẦN, không đọc repo/đồng hồ hệ thống
 * (`src/server/alert-engine.ts` gom input rồi gọi). Ngưỡng lấy từ `THRESHOLDS`, không ghi cứng số.
 */
export const ALERT_DEADLINE_DAYS = { Red: 7, Amber: 14 } as const; // Q11

export interface AlertRuleInput {
  project: Pick<Project, 'id' | 'contractValue' | 'committedHandoverDate' | 'penalized' | 'actualStartDate' | 'actualFinishDate'>;
  yearMonth: YearMonth;
  today: IsoDate;
  /** Bản isLatest của đúng yearMonth. */
  fact: Pick<FactProgressMonthly, 'spi' | 'cpi' | 'pctActual'> | null;
  /** Bản isLatest của đúng yearMonth. */
  financial: Pick<FactFinancial, 'arOverdue'> | null;
  /** Tổng ngày gần nhất có KH > 0 trong [today-6, today]. */
  manpower: { workDate: IsoDate; planned: number; actual: number } | null;
  equipment: { workDate: IsoDate; planned: number; actual: number } | null;
}

export interface AlertCandidate {
  projectId: number;
  ruleCode: AlertRuleCode;
  alertType: 'Red' | 'Amber';
  ruleTriggered: string;
  message: string;
  dedupeKey: string;
}

function mobilizationMessage(row: { workDate: IsoDate; planned: number; actual: number }): string {
  const pct = Math.round((row.actual / row.planned) * 100);
  return `Ngày ${formatDayMonth(row.workDate)}: TT ${row.actual} / KH ${row.planned} (${pct}%)`;
}

/** Q9: R1-R7. Bỏ qua mọi luật khi dự án đã "Hoàn thành". */
export function evaluateProjectAlerts(input: AlertRuleInput): AlertCandidate[] {
  const { project, yearMonth, today, fact, financial, manpower, equipment } = input;

  const status = deriveStatus({
    actualStartDate: project.actualStartDate,
    actualFinishDate: project.actualFinishDate,
    pctActual: fact?.pctActual ?? 0,
  });
  if (status === 'Hoan_thanh') return [];

  const candidates: AlertCandidate[] = [];

  if (fact?.spi != null && fact.spi < THRESHOLDS.spiWarn) {
    candidates.push({
      projectId: project.id,
      ruleCode: 'spi_low',
      alertType: 'Amber',
      ruleTriggered: `SPI < ${THRESHOLDS.spiWarn}`,
      message: `SPI = ${fact.spi.toFixed(2)} - trễ tiến độ theo giá trị`,
      dedupeKey: monthKey('spi_low', yearMonth),
    });
  }

  if (fact?.cpi != null && fact.cpi < THRESHOLDS.cpiWarn) {
    candidates.push({
      projectId: project.id,
      ruleCode: 'cpi_low',
      alertType: 'Amber',
      ruleTriggered: `CPI < ${THRESHOLDS.cpiWarn}`,
      message: `CPI = ${fact.cpi.toFixed(2)} - vượt chi phí`,
      dedupeKey: monthKey('cpi_low', yearMonth),
    });
  }

  const pen = penaltyState({
    committedHandoverDate: project.committedHandoverDate,
    pctActual: fact?.pctActual ?? 0,
    penalized: project.penalized,
    today: new Date(`${today}T00:00:00Z`),
  });
  if (pen === 'penalized') {
    candidates.push({
      projectId: project.id,
      ruleCode: 'penalty_overdue',
      alertType: 'Red',
      ruleTriggered: 'Đã quá mốc cam kết',
      message: 'Đã quá ngày cam kết bàn giao, chưa nghiệm thu',
      dedupeKey: handoverKey('penalty_overdue', project.committedHandoverDate),
    });
  } else if (pen === 'risk') {
    candidates.push({
      projectId: project.id,
      ruleCode: 'penalty_risk',
      alertType: 'Red',
      ruleTriggered: 'Nguy cơ phạt HĐ (≤30 ngày)',
      message: `Còn ≤30 ngày đến mốc bàn giao (${project.committedHandoverDate}), %TT chưa đạt 100%`,
      dedupeKey: handoverKey('penalty_risk', project.committedHandoverDate),
    });
  }

  if (financial && isOverdueWarning(financial.arOverdue, project.contractValue)) {
    const pct = project.contractValue ? (financial.arOverdue / project.contractValue) * 100 : 0;
    candidates.push({
      projectId: project.id,
      ruleCode: 'ar_overdue',
      alertType: 'Amber',
      ruleTriggered: 'Công nợ quá hạn > 5% HĐ',
      message: `Công nợ quá hạn ${financial.arOverdue} tỷ = ${pct.toFixed(1)}% giá trị HĐ`,
      dedupeKey: monthKey('ar_overdue', yearMonth),
    });
  }

  if (manpower && manpower.planned > 0 && manpower.actual / manpower.planned < THRESHOLDS.mobilizationDangerPct) {
    candidates.push({
      projectId: project.id,
      ruleCode: 'manpower_low',
      alertType: 'Amber',
      ruleTriggered: 'Huy động nhân lực < 85%',
      message: mobilizationMessage(manpower),
      dedupeKey: weekKey('manpower_low', manpower.workDate),
    });
  }

  if (equipment && isEquipmentWarning(equipment.actual, equipment.planned)) {
    candidates.push({
      projectId: project.id,
      ruleCode: 'equipment_low',
      alertType: 'Amber',
      ruleTriggered: 'Huy động thiết bị < 80%',
      message: mobilizationMessage(equipment),
      dedupeKey: weekKey('equipment_low', equipment.workDate),
    });
  }

  return candidates;
}
