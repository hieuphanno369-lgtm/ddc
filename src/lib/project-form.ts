import { daysBetween, isValidIsoDate } from '@/lib/clock';
import { findMonthRate, toVndBillion } from '@/lib/fx';
import { isValidProjectCode } from '@/lib/project-code';
import type { UpdateProjectPatch } from '@/server/actions-project';
import type { CreateProjectInput, CurrencyCode, ExchangeRate, Market, Priority, Project, ProjectType, Role } from '@/server/repo/types';

/** Task 8: người admin có thể gán làm PIC/Backup - null = người xem trang không phải admin. */
export interface AssignableUser {
  email: string;
  name: string;
  role: Role;
}

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

// ---- Task 8: state + validate cho ProjectForm ----

export interface ProjectFormState {
  currentAliasCode: string;
  projectName: string;
  customerId: string;
  teamKdId: string;
  marketCode: string;
  projectType: string;
  contractValue: string;
  currencyCode: string;
  contractValueOriginal: string;
  tonnage: string;
  priority: string;
  factoryId: string;
  contractDate: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  committedHandoverDate: string;
  actualStartDate: string;
  actualFinishDate: string;
  penaltyValue: string;
  penalized: boolean;
}

export function emptyProjectForm(): ProjectFormState {
  return {
    currentAliasCode: '', projectName: '', customerId: '', teamKdId: '', marketCode: '', projectType: '',
    contractValue: '', currencyCode: 'VND', contractValueOriginal: '', tonnage: '', priority: '', factoryId: '',
    contractDate: '', plannedStartDate: '', plannedFinishDate: '', committedHandoverDate: '',
    actualStartDate: '', actualFinishDate: '', penaltyValue: '', penalized: false,
  };
}

export function projectFormFromProject(p: Project): ProjectFormState {
  return {
    currentAliasCode: p.currentAliasCode,
    projectName: p.projectName,
    customerId: String(p.customerId),
    teamKdId: String(p.teamKdId),
    marketCode: p.marketCode,
    projectType: p.projectType,
    contractValue: String(p.contractValue),
    currencyCode: p.currencyCode,
    contractValueOriginal: p.contractValueOriginal != null ? String(p.contractValueOriginal) : '',
    tonnage: String(p.tonnage),
    priority: p.priority,
    factoryId: p.factoryId != null ? String(p.factoryId) : '',
    contractDate: dateInput(p.contractDate),
    plannedStartDate: dateInput(p.plannedStartDate),
    plannedFinishDate: dateInput(p.plannedFinishDate),
    committedHandoverDate: dateInput(p.committedHandoverDate),
    actualStartDate: dateInput(p.actualStartDate),
    actualFinishDate: dateInput(p.actualFinishDate),
    penaltyValue: p.penaltyValue != null ? String(p.penaltyValue) : '',
    penalized: p.penalized,
  };
}

/** 19 trường đếm "đã điền" ở thanh dính - mọi key trừ `penalized` (không phải trường nhập). */
export const FORM_COUNT_FIELDS: readonly Exclude<keyof ProjectFormState, 'penalized'>[] = [
  'currentAliasCode', 'projectName', 'customerId', 'teamKdId', 'marketCode', 'projectType', 'contractValue',
  'currencyCode', 'contractValueOriginal', 'tonnage', 'priority', 'factoryId', 'contractDate', 'plannedStartDate',
  'plannedFinishDate', 'committedHandoverDate', 'actualStartDate', 'actualFinishDate', 'penaltyValue',
];

export function countFilled(f: ProjectFormState): number {
  return FORM_COUNT_FIELDS.filter((k) => f[k].trim() !== '').length;
}

export type ProjectFieldError = 'required' | 'positive' | 'too_long' | 'code_invalid' | 'date_order' | 'fx';

export type FxPreview =
  | { kind: 'vnd' }
  | { kind: 'manual' }
  | { kind: 'no_date' }
  | { kind: 'no_rate'; ym: string }
  | { kind: 'converted'; rate: number; ym: string; value: number };

export function fxPreview(f: ProjectFormState, rates: ExchangeRate[]): FxPreview {
  if (f.currencyCode === 'VND') return { kind: 'vnd' };
  if (!f.contractValueOriginal.trim()) return { kind: 'manual' };
  if (!f.contractDate) return { kind: 'no_date' };
  const ym = f.contractDate.slice(0, 7);
  const rate = findMonthRate(rates, f.currencyCode as CurrencyCode, ym);
  if (rate == null) return { kind: 'no_rate', ym };
  return { kind: 'converted', rate, ym, value: toVndBillion(Number(f.contractValueOriginal), rate) };
}

// Ô lỗi gắn cho từng luật chuỗi ngày - "ô ngày thứ hai của luật" (HT KH / Bàn giao / BĐ KH / HT TT).
const DATE_ERROR_FIELD: Record<DateIssueCode, keyof ProjectFormState> = {
  plan_order: 'plannedFinishDate',
  handover_before_finish: 'committedHandoverDate',
  contract_after_start: 'plannedStartDate',
  actual_order: 'actualFinishDate',
};

const REQUIRED_SIMPLE_FIELDS: Exclude<keyof ProjectFormState, 'penalized'>[] = [
  'projectName', 'customerId', 'teamKdId', 'marketCode', 'projectType', 'priority',
];

export function validateProjectForm(
  f: ProjectFormState,
  mode: 'new' | 'edit',
  base: ProjectFormState | null,
  rates: ExchangeRate[],
): { ok: boolean; errors: Partial<Record<keyof ProjectFormState, ProjectFieldError>>; dates: DateChainResult; fx: FxPreview } {
  const errors: Partial<Record<keyof ProjectFormState, ProjectFieldError>> = {};
  const fx = fxPreview(f, rates);

  for (const k of REQUIRED_SIMPLE_FIELDS) {
    if (mode === 'new') {
      if (!f[k].trim()) errors[k] = 'required';
    } else if (base && base[k].trim() !== '' && f[k].trim() === '') {
      errors[k] = 'required';
    }
  }

  for (const k of REQUIRED_DATE_FIELDS) {
    if (mode === 'new') {
      if (!f[k]) errors[k] = 'required';
    } else if (base && base[k] !== '' && f[k] === '') {
      errors[k] = 'required';
    }
  }

  const tonnageNum = Number(f.tonnage);
  if (mode === 'new') {
    if (!(tonnageNum > 0)) errors.tonnage = 'positive';
  } else if (base) {
    const baseTonnage = Number(base.tonnage);
    if (baseTonnage > 0 && !(tonnageNum > 0)) errors.tonnage = 'positive';
  }

  if (fx.kind !== 'converted' && !(Number(f.contractValue) > 0)) {
    errors.contractValue = 'positive';
  }

  if (f.projectName.trim().length > PROJECT_NAME_MAX) errors.projectName = 'too_long';
  if (f.currentAliasCode.trim() !== '' && !isValidProjectCode(f.currentAliasCode)) errors.currentAliasCode = 'code_invalid';

  const dates = checkDateChain({
    contractDate: f.contractDate,
    plannedStartDate: f.plannedStartDate,
    plannedFinishDate: f.plannedFinishDate,
    committedHandoverDate: f.committedHandoverDate,
    actualStartDate: f.actualStartDate,
    actualFinishDate: f.actualFinishDate,
  });
  for (const issue of dates.hard) errors[DATE_ERROR_FIELD[issue]] = 'date_order';

  if (fx.kind === 'no_date' || fx.kind === 'no_rate') errors.contractValueOriginal = 'fx';

  return { ok: Object.keys(errors).length === 0, errors, dates, fx };
}

export type AliasChangeIssue = 'required' | 'reason_short' | 'code_invalid';

/** Task 8: đổi mã CT bắt buộc lý do ≥ 5 ký tự - kiểm ở client trước khi gọi changeProjectCodeAction
 *  (server đã kiểm, nhưng thiếu kiểm client khiến updateProjectAction lỡ ghi hồ sơ trước khi biết lỗi). */
export function validateAliasChange(base: ProjectFormState, f: ProjectFormState, reason: string): AliasChangeIssue | null {
  if (f.currentAliasCode === base.currentAliasCode) return null;
  const trimmed = f.currentAliasCode.trim();
  if (trimmed === '') return 'required';
  if (!isValidProjectCode(trimmed)) return 'code_invalid';
  if (reason.trim().length < 5) return 'reason_short';
  return null;
}

export function buildCreateInput(f: ProjectFormState, fx: FxPreview): CreateProjectInput {
  return {
    projectName: f.projectName,
    customerId: Number(f.customerId),
    teamKdId: Number(f.teamKdId),
    marketCode: f.marketCode as Market,
    projectType: f.projectType as ProjectType,
    priority: f.priority as Priority,
    contractValue: fx.kind === 'converted' ? fx.value : Number(f.contractValue),
    tonnage: Number(f.tonnage),
    currencyCode: f.currencyCode as CurrencyCode,
    contractDate: f.contractDate || null,
    plannedStartDate: f.plannedStartDate || null,
    plannedFinishDate: f.plannedFinishDate || null,
    committedHandoverDate: f.committedHandoverDate || null,
    actualStartDate: f.actualStartDate || null,
    actualFinishDate: f.actualFinishDate || null,
    penaltyValue: f.penaltyValue.trim() ? Number(f.penaltyValue) : null,
    penalized: f.penalized,
    factoryId: f.factoryId.trim() ? Number(f.factoryId) : null,
    contractValueOriginal: fx.kind === 'vnd' ? null : f.contractValueOriginal.trim() ? Number(f.contractValueOriginal) : null,
    currentAliasCode: f.currentAliasCode.trim() ? f.currentAliasCode.trim() : undefined,
  };
}

/** Chỉ đưa field khác `base` - KHÔNG BAO GIỜ chứa `currentAliasCode` (đổi mã CT đi qua `changeProjectCodeAction`). */
export function buildUpdatePatch(base: ProjectFormState, f: ProjectFormState, fx: FxPreview): UpdateProjectPatch {
  const patch: UpdateProjectPatch = {};

  if (f.projectName !== base.projectName) patch.projectName = f.projectName;
  if (f.customerId !== base.customerId) patch.customerId = Number(f.customerId);
  if (f.teamKdId !== base.teamKdId) patch.teamKdId = Number(f.teamKdId);
  if (f.marketCode !== base.marketCode) patch.marketCode = f.marketCode as Market;
  if (f.projectType !== base.projectType) patch.projectType = f.projectType as ProjectType;
  if (f.priority !== base.priority) patch.priority = f.priority as Priority;
  if (f.tonnage !== base.tonnage) patch.tonnage = Number(f.tonnage);
  if (f.contractDate !== base.contractDate) patch.contractDate = f.contractDate || null;
  if (f.plannedStartDate !== base.plannedStartDate) patch.plannedStartDate = f.plannedStartDate || null;
  if (f.plannedFinishDate !== base.plannedFinishDate) patch.plannedFinishDate = f.plannedFinishDate || null;
  if (f.committedHandoverDate !== base.committedHandoverDate) patch.committedHandoverDate = f.committedHandoverDate || null;
  if (f.actualStartDate !== base.actualStartDate) patch.actualStartDate = f.actualStartDate || null;
  if (f.actualFinishDate !== base.actualFinishDate) patch.actualFinishDate = f.actualFinishDate || null;
  if (f.penaltyValue !== base.penaltyValue) patch.penaltyValue = f.penaltyValue.trim() ? Number(f.penaltyValue) : null;
  if (f.penalized !== base.penalized) patch.penalized = f.penalized;
  if (f.factoryId !== base.factoryId) patch.factoryId = f.factoryId.trim() ? Number(f.factoryId) : null;
  if (f.currencyCode !== base.currencyCode) patch.currencyCode = f.currencyCode as CurrencyCode;

  // G-7: 3 trường liên quan tới quy đổi - đổi 1 trong 3 thì tính lại contractValue khi đang converted.
  const g7Touched = f.currencyCode !== base.currencyCode
    || f.contractValueOriginal !== base.contractValueOriginal
    || f.contractDate !== base.contractDate;

  if (f.contractValueOriginal !== base.contractValueOriginal) {
    patch.contractValueOriginal = fx.kind === 'vnd' || !f.contractValueOriginal.trim() ? null : Number(f.contractValueOriginal);
  } else if (fx.kind === 'vnd' && base.contractValueOriginal.trim() !== '') {
    patch.contractValueOriginal = null;
  }

  if (fx.kind === 'converted' && g7Touched) {
    patch.contractValue = fx.value;
  } else if (fx.kind !== 'converted' && f.contractValue !== base.contractValue) {
    patch.contractValue = Number(f.contractValue);
  }

  return patch;
}
