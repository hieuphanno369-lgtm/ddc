'use server';

import { revalidateTag } from 'next/cache';
import { historyMonths, todayIso } from '@/lib/clock';
import { validateStageWeights } from '@/lib/stages';
import { normalizeProjectCode } from '@/lib/project-code';
import { logActivity } from '@/lib/activity';
import { requireWriteProject } from './action-guards';
import { runAlertEngineSafe } from './alert-engine';
import { checkProfileRules, type ProfileRuleError } from './project-profile-rules';
import { listTag, overviewTag, profileTag, trendTag } from './cache';
import { projectCodeSchema, removeSapSchema, stageWeightRowsSchema, updateProjectSchema } from './validation';
import { repo } from './repo';
import type { Project, StageWeightInput } from './repo/types';

/** P3A (Task 5): patch hồ sơ dự án khi SỬA - chỉ các trường form "Tạo / Sửa dự án" quản lý. */
export type UpdateProjectPatch = Partial<
  Pick<
    Project,
    | 'projectName'
    | 'customerId'
    | 'teamKdId'
    | 'marketCode'
    | 'projectType'
    | 'priority'
    | 'contractValue'
    | 'tonnage'
    | 'currencyCode'
    | 'contractValueOriginal'
    | 'contractDate'
    | 'plannedStartDate'
    | 'plannedFinishDate'
    | 'committedHandoverDate'
    | 'actualStartDate'
    | 'actualFinishDate'
    | 'penaltyValue'
    | 'penalized'
    | 'factoryId'
  >
>;

function revalidateProjectTags(): void {
  revalidateTag(profileTag);
  revalidateTag(trendTag);
  for (const m of historyMonths()) {
    revalidateTag(overviewTag(m));
    revalidateTag(listTag(m));
  }
}

export async function updateProjectAction(
  projectId: number,
  patch: UpdateProjectPatch,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'invalid_factory' | ProfileRuleError }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = updateProjectSchema.safeParse({ projectId, patch });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const project = await repo.getProject(projectId);
  if (!project) return { ok: false, error: 'Not found' };

  if (parsed.data.patch.factoryId !== undefined && parsed.data.patch.factoryId != null) {
    const active = (await repo.getDims()).factories.some((f) => f.id === parsed.data.patch.factoryId && f.isActive);
    if (!active) return { ok: false, error: 'invalid_factory' };
  }

  const rates = await repo.getExchangeRates();
  const rules = checkProfileRules(project, parsed.data.patch, rates);
  if (!rules.ok) return { ok: false, error: rules.error };
  if (Object.keys(rules.patch).length === 0) return { ok: true };

  await repo.saveProjectProfile(projectId, rules.patch, user.email);
  await runAlertEngineSafe(projectId).catch(() => {});
  await logActivity(user, 'update_project', `project ${projectId}`);
  revalidateProjectTags();
  return { ok: true };
}

export async function changeProjectCodeAction(
  projectId: number,
  code: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'code_taken' | 'unchanged' }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = projectCodeSchema.safeParse({ projectId, code, reason });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const project = await repo.getProject(projectId);
  if (!project) return { ok: false, error: 'Not found' };

  const normalized = normalizeProjectCode(parsed.data.code);
  if (await repo.isProjectCodeTaken(normalized, projectId)) return { ok: false, error: 'code_taken' };

  const result = await repo.changeProjectCode(projectId, normalized, parsed.data.reason, user.email, todayIso());
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  if (result === 'unchanged') return { ok: false, error: 'unchanged' };

  await logActivity(user, 'change_project_code', `project ${projectId}`);
  revalidateProjectTags();
  return { ok: true };
}

export async function saveStageWeightsAction(
  projectId: number,
  rows: StageWeightInput[],
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'weights_invalid' }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = stageWeightRowsSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const project = await repo.getProject(projectId);
  if (!project) return { ok: false, error: 'Not found' };

  if (!validateStageWeights(parsed.data).ok) return { ok: false, error: 'weights_invalid' };

  await repo.replaceStageWeights(projectId, parsed.data, user.email);
  await logActivity(user, 'save_stage_weights', `project ${projectId}`);
  for (const m of historyMonths()) {
    revalidateTag(overviewTag(m));
    revalidateTag(listTag(m));
  }
  return { ok: true };
}

export async function removeSapCodeAction(
  projectId: number,
  sapCodeId: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = removeSapSchema.safeParse({ projectId, sapCodeId });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.removeSapCode(projectId, sapCodeId, user.email);
  if (result === 'not_found') return { ok: false, error: 'Not found' };

  await logActivity(user, 'remove_sap', `project ${projectId} · sap ${sapCodeId}`);
  return { ok: true };
}
