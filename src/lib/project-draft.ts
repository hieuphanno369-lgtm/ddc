import type { ProjectFormState } from '@/lib/project-form';
import type { KeyMilestoneDraft } from '@/lib/key-milestones';
import type { Project, StageWeightInput } from '@/server/repo/types';

/** N-2 (vòng sửa 1, vòng 2): lên 2 để bỏ nháp v1 cũ còn 3 trường tài chính trong localStorage. */
export const PROJECT_DRAFT_VERSION = 2;

/** F6 (S-3): nháp KHÔNG BAO GIỜ chứa số tài chính - máy dùng chung đọc được qua DevTools/localStorage. */
export type ProjectDraftForm = Omit<ProjectFormState, 'contractValue' | 'contractValueOriginal' | 'penaltyValue'>;

export interface ProjectDraft {
  v: typeof PROJECT_DRAFT_VERSION;
  savedAt: string;
  projectCreatedAt: string | null;
  projectUpdatedAt: string | null;
  form: ProjectDraftForm;
  keyMilestones: KeyMilestoneDraft[];
  stageWeights: StageWeightInput[];
}

export function projectDraftKey(ownerTag: string, projectId: number | null): string {
  return `ddc_pform_v1_${ownerTag}_${projectId ?? 'new'}`;
}

/** F6 (S-3): bỏ 3 trường tài chính trước khi ghi nháp vào localStorage. */
export function toProjectDraftForm(f: ProjectFormState): ProjectDraftForm {
  const { contractValue, contractValueOriginal, penaltyValue, ...rest } = f;
  void contractValue; void contractValueOriginal; void penaltyValue;
  return rest;
}

const PROJECT_FORM_STRING_KEYS: Exclude<keyof ProjectFormState, 'penalized' | 'contractValue' | 'contractValueOriginal' | 'penaltyValue'>[] = [
  'currentAliasCode', 'projectName', 'customerId', 'teamKdId', 'marketCode', 'projectType',
  'currencyCode', 'tonnage', 'priority', 'factoryId', 'contractDate', 'plannedStartDate',
  'plannedFinishDate', 'committedHandoverDate', 'actualStartDate', 'actualFinishDate',
];

/**
 * So bản nháp `ProjectForm` với dấu phiên bản dự án hiện tại.
 * `null` (đang TẠO): không có dự án thật để so - draft cũng của chế độ tạo (`projectCreatedAt == null`) thì `fresh`,
 * ngược lại (draft thuộc 1 dự án cụ thể) thì `foreign` - không áp nhầm nháp SỬA vào form TẠO.
 * Có dự án (đang SỬA): `projectCreatedAt` khác → `foreign` (id trùng nhưng khác dự án, thường sau khi seed lại DB).
 * `projectUpdatedAt` khác → `stale` (đã lưu ở nơi khác sau khi ghi nháp).
 */
export function checkProjectDraft(
  raw: string | null,
  project: Pick<Project, 'createdAt' | 'updatedAt'> | null,
): { kind: 'none' } | { kind: 'fresh' | 'stale'; draft: ProjectDraft } | { kind: 'foreign' } {
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
    (parsed as { v?: unknown }).v !== PROJECT_DRAFT_VERSION ||
    !(parsed as { form?: unknown }).form
  ) {
    return { kind: 'none' };
  }
  const draft = parsed as ProjectDraft;
  if (project === null) {
    return draft.projectCreatedAt == null ? { kind: 'fresh', draft } : { kind: 'foreign' };
  }
  if (draft.projectCreatedAt !== project.createdAt) return { kind: 'foreign' };
  return draft.projectUpdatedAt === project.updatedAt ? { kind: 'fresh', draft } : { kind: 'stale', draft };
}

/** Chỉ áp field thuộc `ProjectFormState`, kiểu phải khớp - bỏ mọi key lạ trong JSON (F6). */
export function restoreProjectDraft(base: ProjectFormState, d: ProjectDraft): ProjectFormState {
  const src = d.form as Partial<Record<keyof ProjectFormState, unknown>>;
  const next: ProjectFormState = { ...base };
  for (const k of PROJECT_FORM_STRING_KEYS) {
    const v = src[k];
    if (typeof v === 'string') next[k] = v;
  }
  if (typeof src.penalized === 'boolean') next.penalized = src.penalized;
  return next;
}
