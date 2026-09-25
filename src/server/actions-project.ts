'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { historyMonths, todayIso } from '@/lib/clock';
import { validateStageWeights } from '@/lib/stages';
import { normalizeProjectCode } from '@/lib/project-code';
import { logActivity } from '@/lib/activity';
import { requireRoleUser, requireWriteProject } from './action-guards';
import { runAlertEngineSafe } from './alert-engine';
import { checkProfileRules, type ProfileRuleError } from './project-profile-rules';
import { listTag, overviewTag, profileTag, trendTag } from './cache';
import { projectCodeSchema, projectMemberSchema, removeSapSchema, stageWeightRowsSchema, updateProjectSchema } from './validation';
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

/** G-17: gán PIC/Backup - CHỈ admin (đây là cấp quyền, xem `src/server/authz.ts`). */
export async function setProjectMemberAction(
  projectId: number,
  email: string,
  roleInProject: 'PIC' | 'Backup',
): Promise<
  | { ok: true; result: 'added' | 'changed' | 'unchanged' }
  | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'user_not_found' | 'role_not_allowed' | 'pic_exists' }
> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = projectMemberSchema.safeParse({ projectId, email, roleInProject });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const project = await repo.getProject(parsed.data.projectId);
  if (!project) return { ok: false, error: 'Not found' };

  const account = await repo.findAccount(parsed.data.email);
  if (!account || !account.isActive) return { ok: false, error: 'user_not_found' };
  if (parsed.data.roleInProject === 'PIC' && account.role !== 'data-entry') return { ok: false, error: 'role_not_allowed' };
  if (parsed.data.roleInProject === 'Backup' && account.role !== 'data-entry' && account.role !== 'viewer') {
    return { ok: false, error: 'role_not_allowed' };
  }
  if (parsed.data.roleInProject === 'PIC') {
    const members = await repo.getProjectMembers(parsed.data.projectId);
    if (members.some((m) => m.roleInProject === 'PIC' && m.userEmail !== parsed.data.email)) {
      return { ok: false, error: 'pic_exists' };
    }
  }

  const result = await repo.setProjectMember(parsed.data.projectId, parsed.data.email, parsed.data.roleInProject, user.email);
  await logActivity(user, 'project_member_set', `project ${parsed.data.projectId} · ${parsed.data.email} · ${parsed.data.roleInProject}`);
  revalidateTag(profileTag);
  return { ok: true, result };
}

/** G-17: gỡ PIC/Backup - CHỈ admin. */
export async function removeProjectMemberAction(
  projectId: number,
  email: string,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_member' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = z.object({ projectId: z.number().int().positive(), email: z.string().trim().toLowerCase().email() }).safeParse({ projectId, email });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.removeProjectMember(parsed.data.projectId, parsed.data.email, user.email);
  if (result === 'not_member') return { ok: false, error: 'not_member' };

  await logActivity(user, 'project_member_remove', `project ${parsed.data.projectId} · ${parsed.data.email}`);
  revalidateTag(profileTag);
  return { ok: true };
}

/** G-5: duyệt chủ đầu tư do data-entry tạo từ form - CHỈ admin. */
export async function approveCustomerAction(
  customerId: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'not_pending' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = z.number().int().positive().safeParse(customerId);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.approveCustomer(parsed.data, user.email);
  if (result === 'not_found') return { ok: false, error: 'not_found' };
  if (result === 'not_pending') return { ok: false, error: 'not_pending' };

  await logActivity(user, 'approve_customer', `customer ${parsed.data}`);
  revalidateTag(profileTag);
  return { ok: true };
}
