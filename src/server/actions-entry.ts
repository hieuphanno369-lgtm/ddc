'use server';

import { logActivity } from '@/lib/activity';
import { requireWriteProject } from './action-guards';
import { repo } from './repo';
import { createContractorSchema, projectContractorSchema } from './validation';

/** G-18: gán 1 nhà thầu (đã có trong danh mục) vào dự án. */
export async function addProjectContractorAction(
  projectId: number,
  contractorId: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = projectContractorSchema.safeParse({ projectId, contractorId });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const result = await repo.addProjectContractor(parsed.data.projectId, parsed.data.contractorId, user.email);
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  await logActivity(user, 'project_contractor_add', `project ${projectId} · contractor ${contractorId}`);
  return { ok: true };
}

/** Q5=a: gỡ nhà thầu khỏi dự án - chặn khi đã có số liệu nhân lực/thiết bị. */
export async function removeProjectContractorAction(
  projectId: number,
  contractorId: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'has_data' | 'not_member' | 'Invalid input' }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = projectContractorSchema.safeParse({ projectId, contractorId });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const result = await repo.removeProjectContractor(parsed.data.projectId, parsed.data.contractorId, user.email);
  if (result === 'has_data' || result === 'not_member') return { ok: false, error: result };
  await logActivity(user, 'project_contractor_remove', `project ${projectId} · contractor ${contractorId}`);
  return { ok: true };
}

/** Q4=a: admin + data-entry tạo nhà thầu mới ngay trong bước nhập, rồi gắn luôn vào dự án. */
export async function createContractorAction(
  projectId: number,
  name: string,
  scopeOfWork: string,
): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = createContractorSchema.safeParse({ projectId, name, scopeOfWork });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  const contractor = await repo.createContractor(parsed.data.name, parsed.data.scopeOfWork, user.email);
  const joined = await repo.addProjectContractor(parsed.data.projectId, contractor.id, user.email);
  if (joined === 'not_found') return { ok: false, error: 'Not found' };
  await logActivity(user, 'contractor_create', contractor.name);
  return { ok: true, id: contractor.id };
}
