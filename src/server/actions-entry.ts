'use server';

import { logActivity } from '@/lib/activity';
import { todayIso } from '@/lib/clock';
import { dailyDateWindow, isInWindow, needsReason, hasFutureActual, DAILY_REASON_MIN, type EquipmentCellInput, type ManpowerCellInput } from '@/lib/daily-entry';
import {
  DAILY_IMPORT_MAX_DAYS, DAILY_IMPORT_MAX_ROWS, groupImportByDay, parseEquipmentSheet, parseManpowerSheet, type DailyImportRow,
} from '@/lib/daily-import';
import { readDailyWorkbook } from './daily-import';
import { requireWriteProject } from './action-guards';
import { repo } from './repo';
import type { Role } from './repo/types';
import {
  commitDailyImportSchema, createContractorSchema, dailyImportFileSchema, projectContractorSchema, saveDailyResourcesSchema,
} from './validation';

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

export type DailySaveError =
  | 'Forbidden'
  | 'Invalid input'
  | 'Not found'
  | 'out_of_window'
  | 'locked'
  | 'invalid_contractor'
  | 'invalid_shift'
  | 'invalid_equipment'
  | 'actual_future'
  | 'reason_required';

interface DailyPayload {
  manpower: ManpowerCellInput[];
  equipment: EquipmentCellInput[];
}

/**
 * Chuỗi kiểm dùng chung cho `saveDailyResourcesAction` và `commitDailyImportAction` (Task 5).
 * Dừng ở lỗi đầu tiên - KHÔNG ghi gì khi có lỗi.
 */
async function checkDailyPayload(
  user: { email: string; role: Role },
  projectId: number,
  workDate: string,
  payload: DailyPayload,
  reason: string | undefined,
): Promise<{ ok: true } | { ok: false; error: DailySaveError; month?: string }> {
  const project = await repo.getProject(projectId);
  if (!project) return { ok: false, error: 'Not found' };

  const window = dailyDateWindow(user.role, todayIso());
  if (!isInWindow(workDate, window)) return { ok: false, error: 'out_of_window' };

  const month = workDate.slice(0, 7);
  if (await repo.isMonthLocked(month)) return { ok: false, error: 'locked', month };

  const members = new Set((await repo.getContractors(projectId)).map((c) => c.id));
  if (payload.manpower.some((m) => !members.has(m.contractorId)) || payload.equipment.some((e) => !members.has(e.contractorId))) {
    return { ok: false, error: 'invalid_contractor' };
  }

  const shiftCodes = new Set((await repo.getShifts()).map((s) => s.code));
  if (payload.manpower.some((m) => !shiftCodes.has(m.shiftCode))) return { ok: false, error: 'invalid_shift' };

  const equipmentIds = new Set((await repo.getEquipments()).map((e) => e.id));
  if (payload.equipment.some((e) => !equipmentIds.has(e.equipmentId))) return { ok: false, error: 'invalid_equipment' };

  const today = todayIso();
  if (hasFutureActual(workDate, today, payload.manpower, payload.equipment)) return { ok: false, error: 'actual_future' };

  const [existingMp, existingEq] = await Promise.all([
    repo.getDailyManpowerByShift(projectId, workDate, workDate),
    repo.getDailyEquipment(projectId, workDate, workDate),
  ]);
  if (
    needsReason(workDate, today, payload.manpower, payload.equipment, existingMp, existingEq) &&
    (reason ?? '').trim().length < DAILY_REASON_MIN
  ) {
    return { ok: false, error: 'reason_required' };
  }

  return { ok: true };
}

/** B (Task 4, P2A): nhập/sửa nhân lực theo ca + thiết bị theo ngày; sửa số ngày cũ phải có lý do. */
export async function saveDailyResourcesAction(
  projectId: number,
  workDate: string,
  payload: DailyPayload,
  reason?: string,
): Promise<{ ok: true; created: number; updated: number; unchanged: number } | { ok: false; error: DailySaveError; month?: string }> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };

  const parsed = saveDailyResourcesSchema.safeParse({ projectId, workDate, manpower: payload.manpower, equipment: payload.equipment, reason });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const check = await checkDailyPayload(user, projectId, workDate, { manpower: parsed.data.manpower, equipment: parsed.data.equipment }, parsed.data.reason);
  if (!check.ok) return check;

  const result = await repo.saveDailyResources(
    projectId,
    workDate,
    { manpower: parsed.data.manpower, equipment: parsed.data.equipment },
    user.email,
    parsed.data.reason?.trim() ?? '',
  );
  await logActivity(user, 'save_daily_resources', `project ${projectId} · ${workDate}`);
  return { ok: true, ...result };
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

export type DailyImportError =
  | 'Forbidden'
  | 'Invalid input'
  | 'Not found'
  | 'bad_file'
  | 'bad_header'
  | 'too_many_rows'
  | 'too_many_days';

/** Task 5 (P2A): xem trước file Excel nhân lực/thiết bị (chưa ghi gì vào DB). */
export async function previewDailyImportAction(
  formData: FormData,
): Promise<
  | { ok: true; rows: DailyImportRow[]; okCount: number; invalidCount: number; days: number }
  | { ok: false; error: DailyImportError; sheet?: 'manpower' | 'equipment' }
> {
  const projectIdRaw = formData.get('projectId');
  const projectId = typeof projectIdRaw === 'string' ? Number(projectIdRaw) : NaN;
  if (!Number.isInteger(projectId) || projectId <= 0) return { ok: false, error: 'Invalid input' };

  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };

  const project = await repo.getProject(projectId);
  if (!project) return { ok: false, error: 'Not found' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Invalid input' };
  const fileParsed = dailyImportFileSchema.safeParse({ name: file.name, size: file.size });
  if (!fileParsed.success) return { ok: false, error: 'Invalid input' };

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = await readDailyWorkbook(buf);
  if (!wb.ok) return { ok: false, error: 'bad_file' };

  const [members, shifts, equipments] = await Promise.all([
    repo.getContractors(projectId),
    repo.getShifts(),
    repo.getEquipments(),
  ]);
  const ctx = { members, shifts, equipments, window: dailyDateWindow(user.role, todayIso()), today: todayIso() };

  const mpParsed = parseManpowerSheet(wb.manpower.header, wb.manpower.rows, ctx);
  if (!mpParsed.ok) return { ok: false, error: 'bad_header', sheet: 'manpower' };
  const eqParsed = parseEquipmentSheet(wb.equipment.header, wb.equipment.rows, ctx);
  if (!eqParsed.ok) return { ok: false, error: 'bad_header', sheet: 'equipment' };

  const rows = [...mpParsed.rows, ...eqParsed.rows];
  if (rows.length > DAILY_IMPORT_MAX_ROWS) return { ok: false, error: 'too_many_rows' };

  const days = new Set(rows.filter((r) => r.workDate).map((r) => r.workDate));
  if (days.size > DAILY_IMPORT_MAX_DAYS) return { ok: false, error: 'too_many_days' };

  const okCount = rows.filter((r) => r.status === 'ok').length;
  const invalidCount = rows.length - okCount;
  return { ok: true, rows, okCount, invalidCount, days: days.size };
}

/** Task 5 (P2A): ghi các ngày đã xem trước. Kiểm lại TOÀN BỘ trước khi ghi ngày nào. */
export async function commitDailyImportAction(
  projectId: number,
  days: { workDate: string; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }[],
  reason?: string,
): Promise<
  | { ok: true; days: number; created: number; updated: number; unchanged: number }
  | { ok: false; error: DailySaveError | 'too_many_days'; month?: string; workDate?: string }
> {
  const user = await requireWriteProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };

  const parsed = commitDailyImportSchema.safeParse({ projectId, days, reason });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };
  if (parsed.data.days.length > DAILY_IMPORT_MAX_DAYS) return { ok: false, error: 'too_many_days' };

  for (const d of parsed.data.days) {
    const check = await checkDailyPayload(user, projectId, d.workDate, { manpower: d.manpower, equipment: d.equipment }, parsed.data.reason);
    if (!check.ok) return { ...check, workDate: d.workDate };
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const d of parsed.data.days) {
    const r = await repo.saveDailyResources(projectId, d.workDate, { manpower: d.manpower, equipment: d.equipment }, user.email, parsed.data.reason?.trim() ?? '');
    created += r.created;
    updated += r.updated;
    unchanged += r.unchanged;
  }
  await logActivity(user, 'commit_daily_import', `project ${projectId} · ${parsed.data.days.length} ngày`);
  return { ok: true, days: parsed.data.days.length, created, updated, unchanged };
}
