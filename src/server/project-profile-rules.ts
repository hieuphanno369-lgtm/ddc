import { checkDateChain, PROJECT_NAME_MAX, REQUIRED_DATE_FIELDS, type DateChainInput, type DateIssueCode } from '@/lib/project-form';
import { findMonthRate, toVndBillion } from '@/lib/fx';
import type { ExchangeRate, Project } from '@/server/repo/types';

/**
 * Luật hồ sơ dự án dùng chung cho `createProjectAction`, `updateProjectAction` và
 * `saveMonthlyData` (G-4/7/8/11/12) - MỘT nguồn luật duy nhất, không phải thuần UI.
 * `before === null` = đang TẠO dự án; ngược lại là SỬA.
 */
export type ProfileRuleError =
  | 'name_too_long'
  | 'tonnage_required'
  | 'date_required'
  | 'date_plan_order'
  | 'date_handover_before_finish'
  | 'date_contract_after_start'
  | 'date_actual_order'
  | 'fx_contract_date_required'
  | 'fx_rate_missing';

export type ProfileFields = Pick<
  Project,
  | 'projectName'
  | 'tonnage'
  | 'currencyCode'
  | 'contractValue'
  | 'contractValueOriginal'
  | 'contractDate'
  | 'plannedStartDate'
  | 'plannedFinishDate'
  | 'committedHandoverDate'
  | 'actualStartDate'
  | 'actualFinishDate'
>;

const DATE_ISSUE_TO_ERROR: Record<DateIssueCode, ProfileRuleError> = {
  plan_order: 'date_plan_order',
  handover_before_finish: 'date_handover_before_finish',
  contract_after_start: 'date_contract_after_start',
  actual_order: 'date_actual_order',
};

// Cặp ngày mà mỗi luật xét tới - dùng để biết luật có "đụng" tới patch hay không khi SỬA.
const DATE_ISSUE_PAIR: Record<DateIssueCode, [keyof ProfileFields, keyof ProfileFields]> = {
  plan_order: ['plannedStartDate', 'plannedFinishDate'],
  handover_before_finish: ['committedHandoverDate', 'plannedFinishDate'],
  contract_after_start: ['contractDate', 'plannedStartDate'],
  actual_order: ['actualStartDate', 'actualFinishDate'],
};

function toDateChainInput(merged: ProfileFields): DateChainInput {
  return {
    contractDate: merged.contractDate ?? '',
    plannedStartDate: merged.plannedStartDate ?? '',
    plannedFinishDate: merged.plannedFinishDate ?? '',
    committedHandoverDate: merged.committedHandoverDate ?? '',
    actualStartDate: merged.actualStartDate ?? '',
    actualFinishDate: merged.actualFinishDate ?? '',
  };
}

export function checkProfileRules<P extends Partial<ProfileFields>>(
  before: ProfileFields | null,
  patch: P,
  rates: ExchangeRate[],
): { ok: true; patch: P } | { ok: false; error: ProfileRuleError } {
  const isCreate = before === null;
  const merged: ProfileFields = { ...(before as ProfileFields | null), ...patch } as ProfileFields;
  const nextPatch: P = { ...patch };

  // 1) Tên dự án.
  if (patch.projectName !== undefined && patch.projectName.trim().length > PROJECT_NAME_MAX) {
    return { ok: false, error: 'name_too_long' };
  }

  // 2) Khối lượng thép.
  if (isCreate) {
    if (!(merged.tonnage > 0)) return { ok: false, error: 'tonnage_required' };
  } else if (patch.tonnage !== undefined && !(patch.tonnage > 0)) {
    return { ok: false, error: 'tonnage_required' };
  }

  // 3) 3 ngày bắt buộc.
  for (const f of REQUIRED_DATE_FIELDS) {
    if (isCreate) {
      if (!merged[f]) return { ok: false, error: 'date_required' };
    } else if (f in patch && (patch as Partial<ProfileFields>)[f] == null) {
      return { ok: false, error: 'date_required' };
    }
  }

  // 4) Chuỗi ngày - chỉ xét khi TẠO, hoặc khi SỬA có đụng tới 1 trong 2 ngày của luật.
  const chain = checkDateChain(toDateChainInput(merged));
  for (const issue of chain.hard) {
    if (isCreate) return { ok: false, error: DATE_ISSUE_TO_ERROR[issue] };
    const [a, b] = DATE_ISSUE_PAIR[issue];
    if (a in patch || b in patch) return { ok: false, error: DATE_ISSUE_TO_ERROR[issue] };
  }

  // 5) G-7: quy đổi nguyên tệ - chỉ xét khi TẠO, hoặc khi SỬA đụng 1 trong 3 trường liên quan.
  const fxRelevant = isCreate || 'contractValueOriginal' in patch || 'currencyCode' in patch || 'contractDate' in patch;
  if (fxRelevant) {
    if (merged.currencyCode === 'VND') {
      if (merged.contractValueOriginal != null) {
        (nextPatch as Partial<ProfileFields>).contractValueOriginal = null;
      }
    } else if (merged.contractValueOriginal != null) {
      if (!merged.contractDate) return { ok: false, error: 'fx_contract_date_required' };
      const rate = findMonthRate(rates, merged.currencyCode, merged.contractDate.slice(0, 7));
      if (rate == null) return { ok: false, error: 'fx_rate_missing' };
      (nextPatch as Partial<ProfileFields>).contractValue = toVndBillion(merged.contractValueOriginal, rate);
    }
  }

  return { ok: true, patch: nextPatch };
}
