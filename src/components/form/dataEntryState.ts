import type { saveMonthlyData } from '@/server/actions';
import type { FactFinancial, FactProgressMonthly, Project, StageCode, ValueChainProgress } from '@/server/repo/types';
import { STAGE_ORDER, normPct } from '@/lib/stages';

/** Patch gửi lên `saveMonthlyData` - chỉ field khác base mới xuất hiện trong đây. */
export type SaveMonthlyPatch = NonNullable<Parameters<typeof saveMonthlyData>[2]>;

export interface FormState {
  projectName: string;
  customerId: string;
  teamKdId: string;
  marketCode: string;
  projectType: string;
  priority: string;
  contractValue: string;
  tonnage: string;
  currencyCode: string;
  contractDate: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  committedHandoverDate: string;
  actualStartDate: string;
  actualFinishDate: string;
  penaltyValue: string;
  penalized: boolean;
  pctPlan: string;
  stagePct: Record<StageCode, string>;
  stageApplicable: Record<StageCode, boolean>;
  ac: string;
  equipmentActual: string;
  revenueCumulative: string;
  costActualCumulative: string;
  arCollected: string;
  arOutstanding: string;
  arOverdue: string;
}

/** ISO/Date-string → 'YYYY-MM-DD' cho <input type="date">. Lấy 10 ký tự đầu nếu khớp /^\d{4}-\d{2}-\d{2}/, còn lại ''. */
export function toDateInput(v: string | null | undefined): string {
  if (!v) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '';
}

/** Dựng FormState gốc (chưa áp bản nháp) từ dữ liệu DB - dùng để khởi tạo form và làm mốc so sánh. */
export function buildBaseForm(
  project: Project,
  fact: FactProgressMonthly | undefined,
  financial: FactFinancial | undefined,
  chain: ValueChainProgress[],
): FormState {
  const stagePct = {} as Record<StageCode, string>;
  const stageApplicable = {} as Record<StageCode, boolean>;
  for (const s of STAGE_ORDER) {
    const v = chain.find((c) => c.stageCode === s);
    stagePct[s] = v ? String(v.pctComplete) : '';
    stageApplicable[s] = v ? v.applicable : true;
  }
  return {
    projectName: project.projectName,
    customerId: String(project.customerId),
    teamKdId: String(project.teamKdId),
    marketCode: project.marketCode,
    projectType: project.projectType,
    priority: project.priority,
    contractValue: String(project.contractValue),
    tonnage: String(project.tonnage),
    currencyCode: project.currencyCode,
    contractDate: toDateInput(project.contractDate),
    plannedStartDate: toDateInput(project.plannedStartDate),
    plannedFinishDate: toDateInput(project.plannedFinishDate),
    committedHandoverDate: toDateInput(project.committedHandoverDate),
    actualStartDate: toDateInput(project.actualStartDate),
    actualFinishDate: toDateInput(project.actualFinishDate),
    penaltyValue: project.penaltyValue != null ? String(project.penaltyValue) : '',
    penalized: project.penalized,
    pctPlan: fact ? String(fact.pctPlan) : '',
    stagePct,
    stageApplicable,
    ac: fact ? String(fact.ac) : '',
    equipmentActual: fact ? String(fact.equipmentActual) : '',
    revenueCumulative: financial ? String(financial.revenueCumulative) : '',
    costActualCumulative: financial ? String(financial.costActualCumulative) : '',
    arCollected: financial ? String(financial.arCollected) : '',
    arOutstanding: financial ? String(financial.arOutstanding) : '',
    arOverdue: financial ? String(financial.arOverdue) : '',
  };
}

/** 7 giai đoạn từ form (giống stageInputs hiện tại). */
export function stageInputsOf(form: FormState): { stageCode: StageCode; pctComplete: number; applicable: boolean }[] {
  return STAGE_ORDER.map((s) => ({
    stageCode: s,
    pctComplete: normPct(form.stagePct?.[s] ?? '') ?? 0,
    applicable: form.stageApplicable?.[s] ?? true,
  }));
}

const SIMPLE_FIELDS: (keyof FormState)[] = [
  'projectName', 'customerId', 'teamKdId', 'marketCode', 'projectType', 'priority',
  'contractValue', 'tonnage', 'currencyCode', 'contractDate', 'plannedStartDate',
  'plannedFinishDate', 'committedHandoverDate', 'actualStartDate', 'actualFinishDate',
  'penaltyValue', 'penalized', 'pctPlan', 'ac', 'equipmentActual',
  'revenueCumulative', 'costActualCumulative', 'arCollected', 'arOutstanding', 'arOverdue',
];

export function formsEqual(a: FormState, b: FormState): boolean {
  for (const k of SIMPLE_FIELDS) if (a[k] !== b[k]) return false;
  for (const s of STAGE_ORDER) {
    if (a.stagePct[s] !== b.stagePct[s]) return false;
    if (a.stageApplicable[s] !== b.stageApplicable[s]) return false;
  }
  return true;
}

/** Chỉ gửi field khác base. */
export function buildSavePatch(base: FormState, form: FormState, opts: { canEditFinance: boolean }): SaveMonthlyPatch {
  const patch: SaveMonthlyPatch = {};

  if (form.projectName !== base.projectName && form.projectName.trim() !== '') {
    patch.projectName = form.projectName;
  }
  if (form.customerId !== base.customerId && form.customerId !== '') {
    patch.customerId = Number(form.customerId);
  }
  if (form.teamKdId !== base.teamKdId && form.teamKdId !== '') {
    patch.teamKdId = Number(form.teamKdId);
  }
  if (form.marketCode !== base.marketCode && form.marketCode !== '') {
    patch.marketCode = form.marketCode as SaveMonthlyPatch['marketCode'];
  }
  if (form.projectType !== base.projectType && form.projectType !== '') {
    patch.projectType = form.projectType as SaveMonthlyPatch['projectType'];
  }
  if (form.priority !== base.priority && form.priority !== '') {
    patch.priority = form.priority as SaveMonthlyPatch['priority'];
  }
  if (form.currencyCode !== base.currencyCode && form.currencyCode !== '') {
    patch.currencyCode = form.currencyCode as SaveMonthlyPatch['currencyCode'];
  }
  if (form.contractValue !== base.contractValue && form.contractValue !== '') {
    patch.contractValue = Number(form.contractValue);
  }
  if (form.tonnage !== base.tonnage && form.tonnage !== '') {
    patch.tonnage = Number(form.tonnage);
  }
  if (form.penaltyValue !== base.penaltyValue) {
    patch.penaltyValue = form.penaltyValue === '' ? null : Number(form.penaltyValue);
  }
  if (form.penalized !== base.penalized) {
    patch.penalized = form.penalized;
  }

  const dateFields = [
    'contractDate', 'plannedStartDate', 'plannedFinishDate',
    'committedHandoverDate', 'actualStartDate', 'actualFinishDate',
  ] as const;
  for (const f of dateFields) {
    if (form[f] !== base[f]) patch[f] = form[f] || null;
  }

  if (form.pctPlan !== base.pctPlan && form.pctPlan !== '') {
    patch.pctPlan = Number(form.pctPlan);
  }
  if (form.ac !== base.ac && form.ac !== '') {
    patch.ac = Number(form.ac);
  }
  if (form.equipmentActual !== base.equipmentActual && form.equipmentActual !== '') {
    patch.equipmentActual = Number(form.equipmentActual);
  }

  const chainChanged = STAGE_ORDER.some(
    (s) => form.stagePct[s] !== base.stagePct[s] || form.stageApplicable[s] !== base.stageApplicable[s],
  );
  if (chainChanged) patch.chain = stageInputsOf(form);

  if (opts.canEditFinance) {
    if (form.revenueCumulative !== base.revenueCumulative && form.revenueCumulative !== '') {
      patch.revenueCumulative = Number(form.revenueCumulative);
    }
    if (form.costActualCumulative !== base.costActualCumulative && form.costActualCumulative !== '') {
      patch.costActualCumulative = Number(form.costActualCumulative);
    }
    if (form.arCollected !== base.arCollected && form.arCollected !== '') {
      patch.arCollected = Number(form.arCollected);
    }
    if (form.arOverdue !== base.arOverdue && form.arOverdue !== '') {
      patch.arOverdue = Number(form.arOverdue);
    }
    // arOutstanding KHÔNG bao giờ gửi - server tự tính (Giá trị HĐ - Đã thu - Quá hạn).
  }

  return patch;
}

export const DRAFT_VERSION = 2;

export interface DraftStamp {
  projectCreatedAt: string;
  projectUpdatedAt: string;
  factVersion: number | null;
  financialVersion: number | null;
}

export interface StoredDraft {
  v: 2;
  savedAt: string;
  stamp: DraftStamp;
  form: FormState;
}

/** Bản nháp hiện hành (v2), có dấu phiên bản (project.updatedAt + version fact/financial). */
export function draftKey(projectId: number, month: string): string {
  return `ddc_draft_v2_${projectId}_${month}`;
}

/** Bản nháp cũ (v1, không có dấu phiên bản) - chỉ để xoá, không bao giờ áp lại. */
export function legacyDraftKey(projectId: number, month: string): string {
  return `ddc_draft_${projectId}_${month}`;
}

export function makeStamp(
  project: Pick<Project, 'createdAt' | 'updatedAt'>,
  fact?: { version: number },
  financial?: { version: number },
): DraftStamp {
  return {
    projectCreatedAt: project.createdAt,
    projectUpdatedAt: project.updatedAt,
    factVersion: fact?.version ?? null,
    financialVersion: financial?.version ?? null,
  };
}

export type DraftCheck =
  | { kind: 'none' }
  | { kind: 'fresh'; draft: StoredDraft }
  | { kind: 'stale'; draft: StoredDraft }
  | { kind: 'foreign' };

/**
 * So bản nháp lưu trong localStorage với dấu phiên bản hiện tại của DB.
 * `foreign` = dự án khác trùng id (thường sau khi seed lại DB) - không bao giờ áp.
 */
export function checkDraft(raw: string | null, current: DraftStamp): DraftCheck {
  if (!raw) return { kind: 'none' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'none' };
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== DRAFT_VERSION ||
    !(parsed as { form?: unknown }).form ||
    !(parsed as { stamp?: unknown }).stamp
  ) {
    return { kind: 'none' };
  }
  const draft = parsed as StoredDraft;
  if (draft.stamp.projectCreatedAt !== current.projectCreatedAt) return { kind: 'foreign' };
  const fresh =
    draft.stamp.projectUpdatedAt === current.projectUpdatedAt &&
    draft.stamp.factVersion === current.factVersion &&
    draft.stamp.financialVersion === current.financialVersion;
  return fresh ? { kind: 'fresh', draft } : { kind: 'stale', draft };
}

/** Áp bản nháp lên base - field mới thêm sau này (không có trong nháp cũ) vẫn lấy từ base. */
export function restoreDraft(base: FormState, draft: StoredDraft): FormState {
  return {
    ...base,
    ...draft.form,
    stagePct: { ...base.stagePct, ...(draft.form.stagePct ?? {}) },
    stageApplicable: { ...base.stageApplicable, ...(draft.form.stageApplicable ?? {}) },
  };
}

export type SaveErrorKind = 'forbidden' | 'locked' | 'notFound' | 'generic';

export function saveErrorKind(error: string | undefined): SaveErrorKind {
  if (error === 'Forbidden') return 'forbidden';
  if (error === 'locked') return 'locked';
  if (error === 'Not found') return 'notFound';
  return 'generic';
}
