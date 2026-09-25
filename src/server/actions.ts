'use server';

import { revalidateTag } from 'next/cache';
import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { getCurrentUser, type CurrentUser } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { hashPassword, verifyPassword } from '@/lib/password';
import { calcChainPctActual, findCurrentStage, normPct, validateStageWeights } from '@/lib/stages';
import { cellText, type CellValue } from '@/lib/daily-import';
import { assertXlsxInflatedSize, readBoundedSheet } from './daily-import';
import type { CreateProjectInput, CurrencyCode, KeyMilestoneInput, Market, Priority, Project, ProjectType, Role, StageCode, StageWeightInput } from './repo/types';
import { listTag, overviewTag, profileTag, trendTag } from './cache';
import { addSapCodeSchema, changePasswordSchema, closeAlertSchema, commitImportSchema, createAccountSchema, createDimSchema, createProjectSchema, deletePhotoSchema, importFileSchema, IMPORT_LEGACY_MAX_ROWS, lockMonthSchema, mergeDimSchema, renameDimSchema, resetPasswordSchema, saveKeyMilestonesSchema, saveMonthlyDataSchema, userRoleSchema } from './validation';
import { repo } from './repo';
import { deletePhotoFile } from '@/lib/uploads';
import { addPhotoForUser } from './photo-service';
import { historyMonths } from '@/lib/clock';
import { runAlertEngineSafe } from './alert-engine';
import { checkProfileRules } from './project-profile-rules';

/** Chặn write theo role - viewer không được ghi, khóa số liệu chỉ Admin/Trưởng phòng. */
async function requireRole(allowed: Role[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || !allowed.includes(user.role)) return null;
  return user;
}

/** Field tài chính - chỉ Admin/BOD được ghi (không cho data-entry/viewer). */
const FINANCE_FIELDS = ['revenueCumulative', 'costActualCumulative', 'arCollected', 'arOutstanding', 'arOverdue'] as const;

/** Chặn write theo project_assignments - data-entry chỉ sửa dự án mình được gán (PIC hoặc Backup - chủ dự án chốt 2026-09-23, I-3). */
async function requireProject(projectId: number): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === 'admin') return user;
  if (user.role === 'data-entry' && (await repo.getAssignmentsForUser(user.email)).includes(projectId)) return user;
  return null;
}

/** Cập nhật hồ sơ + số liệu tháng + tài chính. */
export async function saveMonthlyData(
  projectId: number,
  month: string,
  patch: {
    pctPlan?: number;
    chain?: { stageCode: StageCode; pctComplete: number; applicable: boolean }[];
    ac?: number;
    equipmentActual?: number;
    projectName?: string;
    customerId?: number;
    teamKdId?: number;
    marketCode?: Market;
    projectType?: ProjectType;
    priority?: Priority;
    contractValue?: number;
    tonnage?: number;
    currencyCode?: CurrencyCode;
    contractDate?: string | null;
    plannedStartDate?: string | null;
    plannedFinishDate?: string | null;
    committedHandoverDate?: string | null;
    actualStartDate?: string | null;
    actualFinishDate?: string | null;
    penaltyValue?: number | null;
    penalized?: boolean;
    revenueCumulative?: number;
    costActualCumulative?: number;
    arCollected?: number;
    arOutstanding?: number;
    arOverdue?: number;
    factoryId?: number | null;
    volumeTonnage?: number;
  },
) {
  const user = await requireProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (await repo.isMonthLocked(month)) return { ok: false, error: 'locked' };
  // RBAC tài chính: data-entry/viewer không được ghi field tài chính dù được gán vào dự án.
  if (!['admin', 'bod'].includes(user.role) && FINANCE_FIELDS.some((f) => patch[f] != null)) {
    return { ok: false, error: 'Forbidden' };
  }
  const project = await repo.getProject(projectId);
  if (!project) return { ok: false, error: 'Not found' };
  const by = user.email;
  const parsed = saveMonthlyDataSchema.safeParse({ projectId, month, patch });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const {
    pctPlan,
    chain,
    ac,
    equipmentActual,
    projectName,
    customerId,
    teamKdId,
    marketCode,
    projectType,
    priority,
    contractValue,
    tonnage,
    currencyCode,
    contractDate,
    plannedStartDate,
    plannedFinishDate,
    committedHandoverDate,
    actualStartDate,
    actualFinishDate,
    penaltyValue,
    penalized,
    revenueCumulative,
    costActualCumulative,
    arCollected,
    arOutstanding,
    arOverdue,
    factoryId,
    volumeTonnage,
  } = patch;

  // T8 (Task 6, P2A): khu vực sản xuất + sản lượng tháng - kiểm TRƯỚC mọi ghi.
  if (factoryId != null) {
    const active = (await repo.getDims()).factories.some((f) => f.id === factoryId && f.isActive);
    if (!active) return { ok: false, error: 'invalid_factory' };
  }
  const volumeTarget = factoryId !== undefined ? factoryId : project.factoryId;
  if (volumeTonnage != null && volumeTarget == null) return { ok: false, error: 'no_factory' };

  const profilePatch: Partial<Project> = {};
  if (projectName) profilePatch.projectName = projectName;
  if (customerId != null) profilePatch.customerId = customerId;
  if (teamKdId != null) profilePatch.teamKdId = teamKdId;
  if (marketCode) profilePatch.marketCode = marketCode;
  if (projectType) profilePatch.projectType = projectType;
  if (priority) profilePatch.priority = priority;
  if (contractValue != null) profilePatch.contractValue = contractValue;
  if (tonnage != null) profilePatch.tonnage = tonnage;
  if (currencyCode) profilePatch.currencyCode = currencyCode;
  if (contractDate !== undefined) profilePatch.contractDate = contractDate;
  if (plannedStartDate !== undefined) profilePatch.plannedStartDate = plannedStartDate;
  if (plannedFinishDate !== undefined) profilePatch.plannedFinishDate = plannedFinishDate;
  if (committedHandoverDate !== undefined) profilePatch.committedHandoverDate = committedHandoverDate;
  if (actualStartDate !== undefined) profilePatch.actualStartDate = actualStartDate;
  if (actualFinishDate !== undefined) profilePatch.actualFinishDate = actualFinishDate;
  if (penaltyValue !== undefined) profilePatch.penaltyValue = penaltyValue;
  if (penalized !== undefined) profilePatch.penalized = penalized;
  if (factoryId !== undefined) profilePatch.factoryId = factoryId;

  const profileChanged = Object.keys(profilePatch).length > 0;
  if (profileChanged) {
    const rates = await repo.getExchangeRates();
    const rules = checkProfileRules(project, profilePatch, rates);
    if (!rules.ok) return { ok: false, error: rules.error };
    await repo.saveProjectProfile(projectId, rules.patch, by);
  }

  let derivedPctActual: number | undefined;
  let bottleneckStage: StageCode | null | undefined;
  if (chain) {
    await repo.saveValueChain(projectId, month, chain, by);
    // Trọng số theo dự án, không dùng mặc định cứng - dự án có thể bỏ giai đoạn.
    const weights = await repo.getStageWeights(projectId);
    derivedPctActual = calcChainPctActual(chain, weights);
    bottleneckStage = findCurrentStage(chain);
  }
  if (pctPlan != null || derivedPctActual != null || ac != null || equipmentActual != null || bottleneckStage !== undefined) {
    const r = await repo.saveMonthlyFact(
      projectId,
      month,
      {
        ...(pctPlan != null ? { pctPlan } : {}),
        ...(derivedPctActual != null ? { pctActual: derivedPctActual } : {}),
        ...(ac != null ? { ac } : {}),
        ...(equipmentActual != null ? { equipmentActual } : {}),
        ...(bottleneckStage !== undefined ? { bottleneckStage } : {}),
      },
      by,
    );
    if (r === 'not_found') return { ok: false, error: 'Not found' };
  }

  // Tài chính đã bị chặn ở guard role phía trên (chỉ Admin/BOD tới được đây).
  if (
    revenueCumulative != null ||
    costActualCumulative != null ||
    arCollected != null ||
    arOutstanding != null ||
    arOverdue != null
  ) {
    const r = await repo.saveFinancial(
      projectId,
      month,
      {
        ...(revenueCumulative != null ? { revenueCumulative } : {}),
        ...(costActualCumulative != null ? { costActualCumulative } : {}),
        ...(arCollected != null ? { arCollected } : {}),
        ...(arOutstanding != null ? { arOutstanding } : {}),
        ...(arOverdue != null ? { arOverdue } : {}),
      },
      by,
    );
    if (r === 'not_found') return { ok: false, error: 'Not found' };
  }

  if (volumeTonnage != null && volumeTarget != null) {
    await repo.saveVolume(projectId, month, volumeTarget, volumeTonnage, by);
  }

  await runAlertEngineSafe(projectId).catch(() => {});
  await logActivity(user, 'save_data', `project ${projectId} · ${month}`);
  revalidateTag(overviewTag(month));
  revalidateTag(trendTag);
  revalidateTag(listTag(month));
  if (profileChanged) revalidateTag(profileTag);
  return { ok: true };
}

/** Tạo dự án mới - data-entry tự gán làm PIC. */
export async function createProjectAction(
  input: CreateProjectInput & { keyMilestones?: KeyMilestoneInput[]; stageWeights?: StageWeightInput[] },
) {
  const user = await requireRole(['admin', 'data-entry']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { keyMilestones, stageWeights, currentAliasCode, ...rest } = parsed.data;

  if (currentAliasCode && (await repo.isProjectCodeTaken(currentAliasCode, null))) {
    return { ok: false, error: 'code_taken' };
  }
  if (stageWeights && !validateStageWeights(stageWeights).ok) {
    return { ok: false, error: 'weights_invalid' };
  }
  if (rest.factoryId != null) {
    const active = (await repo.getDims()).factories.some((f) => f.id === rest.factoryId && f.isActive);
    if (!active) return { ok: false, error: 'invalid_factory' };
  }

  const rates = await repo.getExchangeRates();
  const rules = checkProfileRules(null, rest, rates);
  if (!rules.ok) return { ok: false, error: rules.error };

  const p = await repo.createProject({ ...rest, ...rules.patch, currentAliasCode }, user.email);
  if (user.role === 'data-entry') await repo.addAssignment(p.id, user.email, 'PIC');
  if (stageWeights) await repo.replaceStageWeights(p.id, stageWeights, user.email);
  if (keyMilestones?.length) await repo.replaceKeyMilestones(p.id, keyMilestones, user.email);
  await runAlertEngineSafe(p.id).catch(() => {});
  await logActivity(user, 'create_project', p.projectName);
  revalidateTag(profileTag);
  revalidateTag(trendTag);
  for (const m of historyMonths()) {
    revalidateTag(overviewTag(m));
    revalidateTag(listTag(m));
  }
  return { ok: true, id: p.id };
}

/** Thay toàn bộ "Các mốc chính" của dự án. Quyền như saveMonthlyData: admin, hoặc data-entry được gán vào dự án (PIC/Backup). */
export async function saveKeyMilestonesAction(projectId: number, rows: KeyMilestoneInput[]) {
  const user = await requireProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = saveKeyMilestonesSchema.safeParse({ projectId, rows });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  if (!(await repo.getProject(projectId))) return { ok: false, error: 'Not found' };
  await repo.replaceKeyMilestones(projectId, parsed.data.rows, user.email);
  await logActivity(user, 'save_key_milestones', `project ${projectId} · ${parsed.data.rows.length}`);
  return { ok: true };
}

/** Reset go-live (chỉ Admin) - xóa hết data nghiệp vụ. */
export async function resetDataAction() {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  await repo.resetAllData();
  revalidateTag(profileTag);
  revalidateTag(trendTag);
  for (const m of historyMonths()) {
    revalidateTag(overviewTag(m));
    revalidateTag(listTag(m));
  }
  await logActivity(user, 'reset_data', 'xóa toàn bộ dữ liệu');
  return { ok: true };
}

/** Gán/chỉnh quyền 1 user (chỉ Admin). Finance suy từ role (viewer = không xem). */
export async function setUserRoleAction(email: string, role: Role) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = userRoleSchema.safeParse({ email, role });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  await repo.setUserRole(parsed.data.email.toLowerCase(), parsed.data.role, parsed.data.role !== 'viewer');
  await logActivity(user, 'set_role', `${parsed.data.email} → ${parsed.data.role}`);
  revalidateTag(profileTag);
  return { ok: true };
}

export async function removeUserRoleAction(email: string) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  await repo.removeUserRole(email.toLowerCase());
  await logActivity(user, 'remove_role', email);
  revalidateTag(profileTag);
  return { ok: true };
}

/** Xóa dự án (admin) - cascade xóa data con. */
export async function removeProjectAction(id: number) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  await repo.removeProject(id);
  await logActivity(user, 'remove_project', String(id));
  revalidateTag(profileTag);
  revalidateTag(trendTag);
  for (const m of historyMonths()) {
    revalidateTag(overviewTag(m));
    revalidateTag(listTag(m));
  }
  return { ok: true };
}

/** Đổi mật khẩu chính mình. */
export async function changePasswordAction(currentPassword: string, newPassword: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const account = await repo.findAccount(user.email);
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    return { ok: false, error: 'current' };
  }
  await repo.changePassword(user.email, hashPassword(parsed.data.newPassword));
  await logActivity(user, 'change_password');
  return { ok: true };
}

/** Tạo tài khoản mới (chỉ Admin). Finance suy từ role (viewer = không xem). */
export async function createAccountAction(email: string, name: string, role: Role, password: string) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = createAccountSchema.safeParse({ email, name, role, password });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const now = new Date().toISOString();
  await repo.createAccount({
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
    passwordHash: hashPassword(parsed.data.password),
    role: parsed.data.role,
    canViewFinance: parsed.data.role !== 'viewer',
    isActive: true,
    createdAt: now,
    lastLoginAt: null,
  });
  await logActivity(user, 'create_account', parsed.data.email);
  revalidateTag(profileTag);
  return { ok: true };
}

/** Reset mật khẩu user (chỉ Admin). */
export async function resetPasswordAction(email: string, newPassword: string) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = resetPasswordSchema.safeParse({ email, newPassword });
  if (!parsed.success) return { ok: false, error: 'too_short' };
  await repo.changePassword(parsed.data.email.toLowerCase(), hashPassword(parsed.data.newPassword));
  await logActivity(user, 'reset_password', parsed.data.email);
  return { ok: true };
}

/** Khóa / mở tài khoản (chỉ Admin). */
export async function toggleAccountActiveAction(email: string, isActive: boolean) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  await repo.setAccountActive(email.toLowerCase(), isActive);
  await logActivity(user, isActive ? 'unlock_account' : 'lock_account', email);
  revalidateTag(profileTag);
  return { ok: true };
}

export async function closeAlertAction(alertId: number, action: string, note = '') {
  const alert = (await repo.getAlerts()).find((a) => a.id === alertId);
  // Admin đóng mọi alert; data-entry chỉ alert dự án mình được gán (requireProject).
  // BOD (Trưởng phòng) cũng được đóng mọi alert - không phải PIC theo assignment nên xét riêng.
  const user = (await requireProject(alert?.projectId ?? -1)) ?? (await requireRole(['bod']));
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = closeAlertSchema.safeParse({ alertId, action, note });
  if (!parsed.success) return { ok: false, error: 'action_short' };
  if (alert?.closedAt) return { ok: false, error: 'already_closed' };
  await repo.closeAlert(alertId, parsed.data.action, user.email, parsed.data.note);
  await logActivity(user, 'close_alert', `alert ${alertId}`);
  for (const m of historyMonths()) revalidateTag(overviewTag(m));
  return { ok: true };
}

export async function addSapCodeAction(projectId: number, sapCode: string, sourceDocType: string) {
  const user = await requireProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = addSapCodeSchema.safeParse({ projectId, sapCode, sourceDocType });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const ok = await repo.addSapCode(projectId, sapCode, sourceDocType, user.email);
  await logActivity(user, 'add_sap', sapCode);
  return { ok };
}

/** Upload ảnh hiện trường - ghi file vào data/uploads, DB lưu path tương đối. */
export async function addPhotoAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Forbidden' };
  const r = await addPhotoForUser(user, formData);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
}

/** Xóa ảnh - owner / Admin / data-entry được gán vào dự án đó (PIC/Backup) được xóa (cả file lẫn record). */
export async function deletePhotoAction(photoId: number) {
  const parsed = deletePhotoSchema.safeParse({ photoId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const photo = await repo.getPhotoById(parsed.data.photoId);
  if (!photo) return { ok: false, error: 'Not found' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Forbidden' };
  const isPic =
    user.role === 'data-entry' && (await repo.getAssignmentsForUser(user.email)).includes(photo.projectId);
  if (user.role !== 'admin' && photo.uploadedBy !== user.email && !isPic) {
    return { ok: false, error: 'Forbidden' };
  }

  await repo.deletePhoto(parsed.data.photoId);
  await deletePhotoFile(photo.url);
  await logActivity(user, 'delete_photo', `photo ${parsed.data.photoId}`);
  revalidateTag(profileTag);
  return { ok: true };
}

/** Khóa số liệu tháng (chỉ Admin) - chặn sửa retroactive. */
export async function lockMonthAction(yearMonth: string) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = lockMonthSchema.safeParse({ yearMonth });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  await repo.lockMonth(yearMonth, user.email);
  await logActivity(user, 'lock_month', yearMonth);
  return { ok: true };
}

export type ImportRowReason = 'no_sap' | 'no_pct' | 'bad_pct' | 'not_assigned';
export interface ImportRow {
  rowNo: number; // số dòng Excel (header = dòng 1)
  sapCode: string;
  projectName: string;
  pctActual: number | null;
  status: 'mapped' | 'queued' | 'invalid';
  reason: ImportRowReason | null; // chỉ khác null khi status = 'invalid'
  projectId: number | null;
}

/** Import Excel: resolve mã SAP → project_id, mã lạ đẩy vào hàng đợi chờ duyệt. */
export async function importExcelAction(formData: FormData) {
  const user = await requireRole(['admin', 'data-entry']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const file = formData.get('file') as File | null;
  if (!file) return { ok: false, error: 'No file' };

  // Chặn trước khi parse: chỉ nhận .xlsx/.csv (nợ F4: bỏ .xls) và size ≤ 10MB.
  const fileParsed = importFileSchema.safeParse({ name: file.name, size: file.size });
  if (!fileParsed.success) return { ok: false, error: fileParsed.error.issues[0]?.message ?? 'Invalid file' };

  // Nợ F4 (reviewer P1A): đọc bằng exceljs thay vì `xlsx` 0.18.5 (có lỗ hổng) - chỉ nhận .xlsx/.csv.
  const buf = Buffer.from(await file.arrayBuffer());
  const isCsv = /\.csv$/i.test(file.name);
  // H-1b: CSV không phải zip, không cần chặn zip bomb; readBoundedSheet vẫn chặn dòng/cột cho cả 2.
  if (!isCsv && !(await assertXlsxInflatedSize(buf))) return { ok: false, error: 'Invalid file' };
  const wb = new ExcelJS.Workbook();
  try {
    if (isCsv) {
      await wb.csv.read(Readable.from(buf));
    } else {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    }
  } catch {
    return { ok: false, error: 'Invalid file' };
  }
  // H-1a: đọc có giới hạn dòng/cột TRƯỚC mọi vòng lặp - không dùng ws.rowCount/ws.columnCount trực tiếp.
  const bounded = readBoundedSheet(wb.worksheets[0], IMPORT_LEGACY_MAX_ROWS);
  if (!bounded.ok) return { ok: false, error: 'File quá 5000 dòng hoặc quá 64 cột' };
  if (bounded.header.length === 0) return { ok: false, error: 'Invalid file' };
  const header: string[] = bounded.header.map((c) => cellText(c));
  const raw: Record<string, unknown>[] = [];
  const rowNos: number[] = [];
  for (const row of bounded.rows) {
    const record: Record<string, unknown> = {};
    for (let c = 0; c < row.cells.length; c++) {
      record[header[c] || `col${c + 1}`] = cellText(row.cells[c]);
    }
    raw.push(record);
    rowNos.push(row.rowNo);
  }

  const known = await repo.getSapCodes();
  // data-entry chỉ thấy preview dự án mình được gán - không lộ projectId ngoài assignment.
  const owned = user.role === 'data-entry' ? new Set(await repo.getAssignmentsForUser(user.email)) : null;
  const preview: ImportRow[] = [];
  let mapped = 0;
  let queued = 0;
  let invalid = 0;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const sapCode = pick(r, ['mã sap', 'ma sap', 'sap code', 'sap', 'mã dự án', 'ma du an', 'code']);
    const projectName = pick(r, ['tên dự án', 'ten du an', 'project name', 'name', 'dự án', 'du an']);
    const pctRaw = pick(r, ['% tt', '% hoàn thành', '% hoan thanh', '%ht', 'pctactual', '% actual', 'actual']);
    const rowNo = rowNos[i];

    // Dòng hoàn toàn trống - không tính, không hiện trong preview.
    if (!sapCode && !projectName && !pctRaw) continue;

    if (!sapCode) {
      invalid++;
      preview.push({ rowNo, sapCode: '', projectName: String(projectName), pctActual: null, status: 'invalid', reason: 'no_sap', projectId: null });
      continue;
    }

    // Dùng đúng hàm chuẩn hoá của lớp tính toán, không viết lại quy ước /100 (Task 1)
    const norm = pctRaw ? normPct(String(pctRaw).replace('%', '').replace(',', '.')) : null;
    const match = known.find((s) => s.sapCode.toLowerCase() === String(sapCode).toLowerCase());

    if (!match) {
      queued++;
      await repo.addSapQueueItem(String(sapCode), 'Import Excel', String(projectName));
      preview.push({ rowNo, sapCode: String(sapCode), projectName: String(projectName), pctActual: norm, status: 'queued', reason: null, projectId: null });
      continue;
    }

    if (owned && !owned.has(match.projectId)) {
      invalid++;
      preview.push({ rowNo, sapCode: String(sapCode), projectName: String(projectName), pctActual: null, status: 'invalid', reason: 'not_assigned', projectId: null });
      continue;
    }
    if (!pctRaw) {
      invalid++;
      preview.push({ rowNo, sapCode: String(sapCode), projectName: String(projectName), pctActual: null, status: 'invalid', reason: 'no_pct', projectId: match.projectId });
      continue;
    }
    if (norm == null) {
      invalid++;
      preview.push({ rowNo, sapCode: String(sapCode), projectName: String(projectName), pctActual: null, status: 'invalid', reason: 'bad_pct', projectId: match.projectId });
      continue;
    }
    mapped++;
    preview.push({ rowNo, sapCode: String(sapCode), projectName: String(projectName), pctActual: norm, status: 'mapped', reason: null, projectId: match.projectId });
  }

  await logActivity(user, 'import_excel', `${preview.length} rows`);
  return { ok: true, total: preview.length, mapped, queued, invalid, preview };
}

/** Commit các dòng đã map (SAP→project) vào fact_progress_monthly cho tháng chọn. */
export async function commitImportAction(month: string, rows: { projectId: number; pctActual: number }[]) {
  const user = await requireRole(['admin', 'data-entry']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = commitImportSchema.safeParse({ month, rows });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  let target = parsed.data.rows;
  const failed: { projectId: number; reason: 'not_assigned' | 'not_found' }[] = [];
  if (user.role === 'data-entry') {
    const owned = new Set(await repo.getAssignmentsForUser(user.email));
    target = target.filter((r) => {
      if (owned.has(r.projectId)) return true;
      failed.push({ projectId: r.projectId, reason: 'not_assigned' });
      return false;
    });
  }
  if (await repo.isMonthLocked(month)) return { ok: false, error: 'locked' };
  const result = await repo.importMonthlyFacts(month, target, user.email);

  const failedIds = new Set(result.failed.map((f) => f.projectId));
  const importedProjectIds = [...new Set(target.filter((r) => !failedIds.has(r.projectId)).map((r) => r.projectId))];
  for (const projectId of importedProjectIds) {
    await runAlertEngineSafe(projectId).catch(() => {});
  }

  await logActivity(user, 'commit_import', `${result.imported} rows`);
  revalidateTag(overviewTag(month));
  revalidateTag(trendTag);
  revalidateTag(listTag(month));
  return { ok: true, imported: result.imported, failed: [...failed, ...result.failed] };
}

export async function resolveSapQueueAction(id: number, projectId: number) {
  const user = await requireProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const q = (await repo.getSapQueue()).find((x) => x.id === id);
  if (q) {
    await repo.resolveSapQueue(id, projectId);
    await repo.addSapCode(projectId, q.sapCode, q.sourceDocType, user.email);
  }
  await logActivity(user, 'resolve_sap', `queue ${id}`);
  return { ok: true };
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  const found = Object.keys(row).find((k) => keys.some((key) => k.trim().toLowerCase().includes(key)));
  return found ? String(row[found]).trim() : '';
}

// ---- Dim chuẩn hóa (customer / team) ----

/** Tạo dim mới khi nhập liệu không khớp gợi ý (data-entry/admin). Trả về id. */
export async function createDimValueAction(field: 'customer' | 'team', name: string) {
  const user = await requireRole(['admin', 'data-entry']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = createDimSchema.safeParse({ field, name });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const id = await repo.createDimValue(parsed.data.field, parsed.data.name);
  await logActivity(user, 'create_dim', `${field}: ${parsed.data.name}`);
  revalidateTag(profileTag);
  return { ok: true, id };
}

/** Đổi tên dim (giữ id, alias giữ tên cũ) - admin. */
export async function renameDimAction(field: 'customer' | 'team', id: number, name: string) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = renameDimSchema.safeParse({ field, id, name });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  await repo.renameDimValue(parsed.data.field, parsed.data.id, parsed.data.name);
  await logActivity(user, 'rename_dim', `${field}#${id} → ${parsed.data.name}`);
  revalidateTag(profileTag);
  return { ok: true };
}

/** Merge dim A→B (re-point FK, mark A inactive) - admin. Trả về số project đã đổi. */
export async function mergeDimAction(field: 'customer' | 'team', fromId: number, toId: number) {
  const user = await requireRole(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = mergeDimSchema.safeParse({ field, fromId, toId });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const moved = await repo.mergeDimValue(parsed.data.field, parsed.data.fromId, parsed.data.toId);
  await logActivity(user, 'merge_dim', `${field}: ${fromId} → ${toId} (${moved} projects)`);
  revalidateTag(profileTag);
  return { ok: true, moved };
}
