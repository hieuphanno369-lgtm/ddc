import { daysBetween, isValidIsoDate } from '@/lib/clock';

/** G-4: tên dự án viết hoa toàn bộ, tối đa 160 ký tự. */
export const PROJECT_NAME_MAX = 160;

/** G-8: 3 ngày bắt buộc khi tạo dự án - nguồn tính % Kế hoạch. */
export const REQUIRED_DATE_FIELDS = ['plannedStartDate', 'plannedFinishDate', 'committedHandoverDate'] as const;

export type DateIssueCode =
  | 'plan_order'
  | 'handover_before_finish'
  | 'contract_after_start'
  | 'actual_order';

export interface DateChainInput {
  contractDate: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  committedHandoverDate: string;
  actualStartDate: string;
  actualFinishDate: string;
}

export interface DateChainResult {
  hard: DateIssueCode[];
  startDelayDays: number | null;
  totalPlanDays: number | null;
}

/** '' = trống; nhận cả ISO đầy đủ (lấy 10 ký tự); ngày không hợp lệ coi như trống. */
export function dateInput(v: string | null | undefined): string {
  if (!v) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '';
}

function d10(v: string): string {
  if (!v) return '';
  const s = v.length > 10 ? v.slice(0, 10) : v;
  return isValidIsoDate(s) ? s : '';
}

export function checkDateChain(i: DateChainInput): DateChainResult {
  const contractDate = d10(i.contractDate);
  const plannedStartDate = d10(i.plannedStartDate);
  const plannedFinishDate = d10(i.plannedFinishDate);
  const committedHandoverDate = d10(i.committedHandoverDate);
  const actualStartDate = d10(i.actualStartDate);
  const actualFinishDate = d10(i.actualFinishDate);

  const hard: DateIssueCode[] = [];
  if (plannedStartDate && plannedFinishDate && plannedStartDate >= plannedFinishDate) hard.push('plan_order');
  if (committedHandoverDate && plannedFinishDate && committedHandoverDate < plannedFinishDate) hard.push('handover_before_finish');
  if (contractDate && plannedStartDate && contractDate > plannedStartDate) hard.push('contract_after_start');
  if (actualStartDate && actualFinishDate && actualFinishDate < actualStartDate) hard.push('actual_order');

  const startDelayDays = plannedStartDate && actualStartDate ? daysBetween(plannedStartDate, actualStartDate) : null;
  const totalPlanDays =
    plannedStartDate && plannedFinishDate && plannedStartDate < plannedFinishDate
      ? daysBetween(plannedStartDate, plannedFinishDate)
      : null;

  return { hard, startDelayDays, totalPlanDays };
}
