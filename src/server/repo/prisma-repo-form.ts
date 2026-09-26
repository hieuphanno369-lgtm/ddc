import { prisma } from '@/server/db';
import { Prisma, type PrismaClient } from '@prisma/client';
import { DEFAULT_STAGE_WEIGHTS } from '@/lib/stages';
import { planAliasChange } from '@/lib/project-code';
import { equipGroupsAuditText } from '@/lib/equipment-plan';
import { manpowerMonthAuditText, ratioAuditText, resolveShiftRatios } from '@/lib/manpower-plan';
import type { IsoDate } from '@/lib/clock';
import { audit } from './prisma-repo-entry';
import type {
  AuditLogEntry, EquipmentPlanGroupInput, EquipmentPlanSegment, EquipmentQuota, ManpowerPlanInput,
  ManpowerPlanMonthRow, ProjectAlias, ProjectMember, Role, ShiftRatio, StageWeightInput,
} from './types';

/** '00:00:00Z' của ngày `s` ('YYYY-MM-DD') - khớp cách lưu ngày @db.Date ở prisma-repo.ts. */
const dayStart = (s: string): Date => new Date(`${s}T00:00:00Z`);
/** Date → 'YYYY-MM-DD' (cột @db.Date). */
const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * N-1 (vòng sửa 1, vòng 2): `meta.target` của P2002 đúng bằng một trong các bộ cột cho trước (so
 * nguyên mảng). Dạng thật đã xác nhận trên PostgreSQL qua transaction tự rollback: index biểu thức mã
 * CT báo `['lower(currentAliasCode)']`, `masterCode` báo `['masterCode']`, partial index 1 PIC báo
 * `['projectId']`, khoá chính thành viên báo `['projectId', 'userEmail']`.
 */
export function isP2002On(e: unknown, targets: readonly (readonly string[])[]): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false;
  const t = (e.meta as { target?: unknown } | undefined)?.target;
  if (!Array.isArray(t)) return false;
  return targets.some((want) => want.length === t.length && want.every((c, i) => c === t[i]));
}

/** Các index unique phủ mã CT: `dim_project_currentAliasCode_lower_key` và `masterCode`. */
export const PROJECT_CODE_UNIQUE_TARGETS = [['lower(currentAliasCode)'], ['masterCode']] as const;
/** Partial index `project_assignments_one_pic_key` (tối đa 1 PIC/dự án). */
const ONE_PIC_UNIQUE_TARGETS = [['projectId']] as const;
/** Khoá chính `project_assignments` (projectId, userEmail). */
const MEMBER_PK_TARGETS = [['projectId', 'userEmail']] as const;

/**
 * S-2 (vòng sửa 1): thân `isProjectCodeTaken` tách nhận `client` để gọi lại bằng `tx` bên trong
 * transaction (chống race khi đổi mã / tạo dự án) - so `trim()` không phân biệt hoa thường với
 * masterCode/currentAliasCode của dự án khác, và alias của dự án khác. Dùng chung cho createProject
 * (prisma-repo.ts) và changeProjectCode bên dưới.
 */
export async function isProjectCodeTakenWith(client: Tx, code: string, exceptProjectId: number | null): Promise<boolean> {
  const target = code.trim();
  const projectMatch = await client.project.findFirst({
    where: {
      ...(exceptProjectId != null ? { id: { not: exceptProjectId } } : {}),
      OR: [
        { masterCode: { equals: target, mode: 'insensitive' } },
        { currentAliasCode: { equals: target, mode: 'insensitive' } },
      ],
    },
  });
  if (projectMatch) return true;
  const aliasMatch = await client.projectAlias.findFirst({
    where: {
      ...(exceptProjectId != null ? { projectId: { not: exceptProjectId } } : {}),
      aliasCode: { equals: target, mode: 'insensitive' },
    },
  });
  return !!aliasMatch;
}

/** Chuỗi mô tả trọng số cho audit_log: "design:5,shop:10(x),…" - (x) = không áp dụng.
 * P7-C2: duyệt theo THỨ TỰ NHẬN VÀO (danh sách giai đoạn giờ động, không còn STAGE_ORDER cứng). */
function stageWeightAuditText(rows: { stageCode: string; weightPct: number; applicable: boolean }[]): string {
  return rows.map((r) => (r.applicable ? `${r.stageCode}:${r.weightPct}` : `${r.stageCode}:${r.weightPct}(x)`)).join(',');
}

/**
 * Hàm repo P3A (Task 4) - hợp nhất vào `repo` ở prisma-repo.ts qua spread, cùng khuôn
 * `prisma-repo-entry.ts` (giảm xung đột với B khi cùng sửa file nóng).
 */
export const formPrismaRepo = {
  /** So `trim()` (không phân biệt hoa thường) với masterCode/currentAliasCode của dự án khác, và alias của dự án khác. */
  async isProjectCodeTaken(code: string, exceptProjectId: number | null): Promise<boolean> {
    return isProjectCodeTakenWith(prisma, code, exceptProjectId);
  },

  /**
   * S-2 (vòng sửa 1): khoá advisory theo mã mới trong transaction rồi kiểm lại trùng bằng chính
   * `tx` (chống race - index `dim_project_currentAliasCode_lower_key` chỉ phủ `currentAliasCode`,
   * không phủ `masterCode`/alias cũ) - trùng thì trả `'taken'`. `P2002` (race hiếm, 2 request cùng
   * hashtext) cũng map về `'taken'` - chỉ khi `meta.target` là index mã CT (N-1).
   */
  async changeProjectCode(projectId: number, newCode: string, reason: string, by: string, today: IsoDate): Promise<'changed' | 'unchanged' | 'not_found' | 'taken'> {
    try {
      return await prisma.$transaction(async (tx) => {
        const p = await tx.project.findUnique({ where: { id: projectId } });
        if (!p) return 'not_found';
        if (newCode === p.currentAliasCode) return 'unchanged';

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${newCode})))`;
        if (await isProjectCodeTakenWith(tx, newCode, projectId)) return 'taken';

        const aliasRows = await tx.projectAlias.findMany({ where: { projectId } });
        const aliases: ProjectAlias[] = aliasRows.map((a) => ({
          id: a.id, projectId: a.projectId, aliasCode: a.aliasCode,
          aliasType: a.aliasType as ProjectAlias['aliasType'],
          effectiveFrom: day(a.effectiveFrom)!, effectiveTo: day(a.effectiveTo),
          reason: a.reason, approvedBy: a.approvedBy,
        }));
        const plan = planAliasChange({
          projectId, aliases, oldCode: p.currentAliasCode, newCode, today, reason, by,
          projectCreatedAt: p.createdAt.toISOString(),
        });

        if (plan.retypeId != null) {
          await tx.projectAlias.update({ where: { id: plan.retypeId }, data: { aliasCode: newCode, reason, approvedBy: by } });
        }
        if (plan.closeId != null) {
          await tx.projectAlias.update({ where: { id: plan.closeId }, data: { effectiveTo: dayStart(plan.closeTo!) } });
        }
        if (plan.insertOld) {
          await tx.projectAlias.create({
            data: {
              projectId, aliasCode: plan.insertOld.aliasCode, aliasType: plan.insertOld.aliasType,
              effectiveFrom: dayStart(plan.insertOld.effectiveFrom),
              effectiveTo: plan.insertOld.effectiveTo ? dayStart(plan.insertOld.effectiveTo) : null,
              reason: plan.insertOld.reason, approvedBy: plan.insertOld.approvedBy,
            },
          });
        }
        if (plan.insertNew) {
          await tx.projectAlias.create({
            data: {
              projectId, aliasCode: plan.insertNew.aliasCode, aliasType: plan.insertNew.aliasType,
              effectiveFrom: dayStart(plan.insertNew.effectiveFrom), effectiveTo: null,
              reason: plan.insertNew.reason, approvedBy: plan.insertNew.approvedBy,
            },
          });
        }

        const old = p.currentAliasCode;
        await tx.projectHistory.create({
          data: { projectId, at: new Date(), by, note: `currentAliasCode: ${old} → ${newCode}`, snapshot: p as unknown as object },
        });
        await tx.project.update({ where: { id: projectId }, data: { currentAliasCode: newCode, updatedAt: new Date(), updatedBy: by } });
        await audit(tx, 'dim_project_alias', String(projectId), 'aliasCode', old, newCode, by, reason);
        return 'changed';
      });
    } catch (e) {
      if (isP2002On(e, PROJECT_CODE_UNIQUE_TARGETS)) return 'taken';
      throw e;
    }
  },

  async replaceStageWeights(projectId: number, rows: StageWeightInput[], by: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const ownRows = await tx.projectStageWeight.findMany({ where: { projectId } });
      const beforeRows = ownRows.length ? ownRows : DEFAULT_STAGE_WEIGHTS;
      const beforeText = (ownRows.length ? '' : 'default ') + stageWeightAuditText(beforeRows);
      const afterText = stageWeightAuditText(rows);
      await tx.projectStageWeight.deleteMany({ where: { projectId } });
      if (rows.length) {
        await tx.projectStageWeight.createMany({
          data: rows.map((r) => ({ projectId, stageCode: r.stageCode, weightPct: r.weightPct, applicable: r.applicable })),
        });
      }
      await audit(tx, 'project_stage_weight', String(projectId), 'replace', beforeText, afterText, by);
    });
  },

  async removeSapCode(projectId: number, sapCodeId: number, by: string): Promise<'removed' | 'not_found'> {
    const row = await prisma.projectSapCode.findFirst({ where: { id: sapCodeId, projectId } });
    if (!row) return 'not_found';
    await prisma.projectSapCode.delete({ where: { id: sapCodeId } });
    await audit(prisma, 'project_sap_codes', String(projectId), 'remove', row.sapCode, '', by);
    return 'removed';
  },

  async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    const rows = await prisma.projectAssignment.findMany({ where: { projectId } });
    const emails = rows.map((r) => r.userEmail);
    const users = emails.length ? await prisma.userRole.findMany({ where: { email: { in: emails } } }) : [];
    const userMap = new Map(users.map((u) => [u.email, u]));
    return rows
      .map((a) => {
        const u = userMap.get(a.userEmail);
        return {
          userEmail: a.userEmail,
          name: u?.name ?? a.userEmail,
          role: (u?.role as Role | undefined) ?? null,
          roleInProject: a.roleInProject as 'PIC' | 'Backup',
          assignedBy: a.assignedBy,
          assignedAt: a.assignedAt.toISOString(),
        };
      })
      .sort((a, b) => {
        if (a.roleInProject !== b.roleInProject) return a.roleInProject === 'PIC' ? -1 : 1;
        return a.userEmail.localeCompare(b.userEmail);
      });
  },

  /**
   * S-6 (vòng sửa 1, QĐ-11): thêm/đổi thành viên trong 1 `$transaction` cùng audit; gán PIC thì
   * kiểm lại trong `tx` đã có PIC khác chưa (partial unique index `project_assignments_one_pic_key`
   * chặn ở tầng DB) - trùng trả `'pic_exists'`. `P2002` (race) cũng map về `'pic_exists'` - chỉ khi `meta.target` là index 1 PIC (N-1).
   */
  async setProjectMember(projectId: number, email: string, roleInProject: 'PIC' | 'Backup', by: string): Promise<'added' | 'changed' | 'unchanged' | 'pic_exists'> {
    try {
      return await prisma.$transaction(async (tx) => {
        const prev = await tx.projectAssignment.findUnique({ where: { projectId_userEmail: { projectId, userEmail: email } } });
        if (prev) {
          if (prev.roleInProject === roleInProject) return 'unchanged';
          if (roleInProject === 'PIC') {
            const otherPic = await tx.projectAssignment.findFirst({ where: { projectId, roleInProject: 'PIC', userEmail: { not: email } } });
            if (otherPic) return 'pic_exists';
          }
          await tx.projectAssignment.update({
            where: { projectId_userEmail: { projectId, userEmail: email } },
            data: { roleInProject, assignedBy: by, assignedAt: new Date() },
          });
          await audit(tx, 'project_assignments', `${projectId}/${email}`, 'roleInProject', prev.roleInProject, roleInProject, by);
          return 'changed';
        }
        if (roleInProject === 'PIC') {
          const otherPic = await tx.projectAssignment.findFirst({ where: { projectId, roleInProject: 'PIC' } });
          if (otherPic) return 'pic_exists';
        }
        await tx.projectAssignment.create({ data: { projectId, userEmail: email, roleInProject, assignedBy: by } });
        await audit(tx, 'project_assignments', `${projectId}/${email}`, 'roleInProject', '', roleInProject, by);
        return 'added';
      });
    } catch (e) {
      if (isP2002On(e, ONE_PIC_UNIQUE_TARGETS)) return 'pic_exists';
      // I-1 (vòng sửa 1, vòng 2): 2 admin cùng thêm 1 người - bên kia đã ghi xong. Cùng vai thì coi như
      // không đổi; khác vai thì ném lỗi gốc (không báo 'unchanged' sai sự thật).
      if (isP2002On(e, MEMBER_PK_TARGETS)) {
        const now = await prisma.projectAssignment.findUnique({ where: { projectId_userEmail: { projectId, userEmail: email } } });
        if (now?.roleInProject === roleInProject) return 'unchanged';
      }
      throw e;
    }
  },

  async removeProjectMember(projectId: number, email: string, by: string): Promise<'removed' | 'not_member'> {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.projectAssignment.findUnique({ where: { projectId_userEmail: { projectId, userEmail: email } } });
      if (!prev) return 'not_member';
      await tx.projectAssignment.delete({ where: { projectId_userEmail: { projectId, userEmail: email } } });
      await audit(tx, 'project_assignments', `${projectId}/${email}`, 'roleInProject', prev.roleInProject, '', by);
      return 'removed';
    });
  },

  async approveCustomer(id: number, by: string): Promise<'approved' | 'not_found' | 'not_pending'> {
    const c = await prisma.customer.findUnique({ where: { id } });
    if (!c) return 'not_found';
    if (!c.needsReview) return 'not_pending';
    await prisma.customer.update({ where: { id }, data: { needsReview: false } });
    await audit(prisma, 'dim_customer', String(id), 'needsReview', 'true', 'false', by);
    return 'approved';
  },

  async readProjectAuditTrail(projectId: number, limit: number): Promise<AuditLogEntry[]> {
    const exact = ['dim_project', 'dim_project_alias', 'project_key_milestone', 'project_sap_codes', 'project_stage_weight', 'project_equipment_plan', 'project_shift_ratio'];
    const prefixed = ['project_contractor', 'project_assignments', 'project_manpower_plan_month'];
    const prefix = `${projectId}/`;
    const rows = await prisma.auditLog.findMany({
      where: {
        OR: [
          { tableName: { in: exact }, recordId: String(projectId) },
          { tableName: { in: prefixed }, recordId: { startsWith: prefix } },
        ],
      },
      orderBy: { changedAt: 'desc' },
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id, tableName: a.tableName, recordId: a.recordId, field: a.field,
      oldValue: a.oldValue, newValue: a.newValue, changedBy: a.changedBy,
      changedAt: a.changedAt.toISOString(), note: a.note,
    }));
  },

  /** P3C-A (T4): thay TOÀN BỘ quota + đợt thiết bị của dự án trong 1 transaction; 1 dòng audit. */
  async replaceEquipmentPlans(projectId: number, groups: EquipmentPlanGroupInput[], by: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const [beforeQuotas, beforePlans] = await Promise.all([
        tx.projectEquipmentQuota.findMany({ where: { projectId } }),
        tx.projectEquipmentPlan.findMany({ where: { projectId } }),
      ]);
      const beforeGroups: EquipmentPlanGroupInput[] = beforeQuotas.map((q) => ({
        equipmentId: q.equipmentId,
        totalQty: q.totalQty,
        segments: beforePlans
          .filter((p) => p.equipmentId === q.equipmentId)
          .map((p) => ({ from: day(p.plannedStart)!, to: day(p.plannedFinish)!, qty: p.qty }))
          .sort((a, b) => a.from.localeCompare(b.from)),
      }));
      const beforeText = equipGroupsAuditText(beforeGroups);
      const afterText = equipGroupsAuditText(groups);

      await tx.projectEquipmentPlan.deleteMany({ where: { projectId } });
      await tx.projectEquipmentQuota.deleteMany({ where: { projectId } });

      if (groups.length) {
        await tx.projectEquipmentQuota.createMany({
          data: groups.map((g) => ({ projectId, equipmentId: g.equipmentId, totalQty: g.totalQty, updatedBy: by })),
        });
      }
      const allSegments = groups.flatMap((g) => g.segments.map((s) => ({ equipmentId: g.equipmentId, ...s })));
      if (allSegments.length) {
        await tx.projectEquipmentPlan.createMany({
          data: allSegments.map((s) => ({
            projectId, equipmentId: s.equipmentId, unitNo: null, qty: s.qty, workItemId: null,
            plannedStart: dayStart(s.from), plannedFinish: dayStart(s.to), note: '', updatedBy: by,
          })),
        });
      }
      await audit(tx, 'project_equipment_plan', String(projectId), 'replace', beforeText, afterText, by);
    });
  },

  /** P3C-A (T5): thay kế hoạch nhân lực theo tháng × ca + tỷ lệ chia ca; chỉ ghi lại tháng có đổi. */
  async replaceManpowerPlan(projectId: number, input: ManpowerPlanInput, by: string): Promise<{ changedMonths: number; ratioChanged: boolean }> {
    return prisma.$transaction(async (tx) => {
      const [monthRows, ratioRows, activeShifts] = await Promise.all([
        tx.projectManpowerPlanMonth.findMany({ where: { projectId } }),
        tx.projectShiftRatio.findMany({ where: { projectId } }),
        tx.shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      ]);
      const activeCodes = activeShifts.map((s) => s.code);
      const sortOrderByCode = new Map(activeShifts.map((s) => [s.code, s.sortOrder]));

      const monthsByYm = new Map<string, typeof monthRows>();
      for (const r of monthRows) {
        const list = monthsByYm.get(r.yearMonth) ?? [];
        list.push(r);
        monthsByYm.set(r.yearMonth, list);
      }
      const beforeByMonth = new Map<string, string>();
      for (const [ym, rows] of monthsByYm) {
        const sorted = [...rows].sort((a, b) =>
          (sortOrderByCode.get(a.shiftCode) ?? Infinity) - (sortOrderByCode.get(b.shiftCode) ?? Infinity)
          || a.shiftCode.localeCompare(b.shiftCode));
        beforeByMonth.set(ym, manpowerMonthAuditText(sorted));
      }
      const afterByMonth = new Map<string, string>();
      for (const m of input.months) afterByMonth.set(m.yearMonth, manpowerMonthAuditText(m.cells));

      const allYms = new Set([...beforeByMonth.keys(), ...afterByMonth.keys()]);
      const changed: string[] = [];
      for (const ym of allYms) {
        if ((beforeByMonth.get(ym) ?? '') !== (afterByMonth.get(ym) ?? '')) changed.push(ym);
      }

      for (const ym of changed) {
        await audit(tx, 'project_manpower_plan_month', `${projectId}/${ym}`, 'planned', beforeByMonth.get(ym) ?? '', afterByMonth.get(ym) ?? '', by);
      }

      if (changed.length) {
        await tx.projectManpowerPlanMonth.deleteMany({ where: { projectId, yearMonth: { in: changed } } });
        const toCreate = input.months.filter((m) => changed.includes(m.yearMonth));
        if (toCreate.length) {
          await tx.projectManpowerPlanMonth.createMany({
            data: toCreate.flatMap((m) => m.cells.map((c) => ({
              projectId, yearMonth: m.yearMonth, shiftCode: c.shiftCode, planned: c.planned, isManual: c.isManual, updatedBy: by,
            }))),
          });
        }
      }

      const beforeRatios = resolveShiftRatios(activeCodes, ratioRows);
      const beforeRatioText = ratioAuditText(beforeRatios);
      const afterRatioText = ratioAuditText(input.ratios);
      let ratioChanged = false;
      if (beforeRatioText !== afterRatioText) {
        ratioChanged = true;
        await audit(tx, 'project_shift_ratio', String(projectId), 'pct', (ratioRows.length === 0 ? 'default ' : '') + beforeRatioText, afterRatioText, by);
        await tx.projectShiftRatio.deleteMany({ where: { projectId } });
        if (input.ratios.length) {
          await tx.projectShiftRatio.createMany({ data: input.ratios.map((r) => ({ projectId, shiftCode: r.shiftCode, pct: r.pct })) });
        }
      }

      return { changedMonths: changed.length, ratioChanged };
    });
  },

  // ---- P3C-A: 4 hàm đọc theo hợp đồng P3C (B chỉ import từ src/server/repo/types.ts) ----

  async readEquipmentPlanSegments(projectId: number): Promise<EquipmentPlanSegment[]> {
    const rows = await prisma.projectEquipmentPlan.findMany({
      where: { projectId },
      include: { equipment: { select: { name: true } } },
      orderBy: [{ equipmentId: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id, equipmentId: r.equipmentId, equipmentName: r.equipment.name,
      from: day(r.plannedStart)!, to: day(r.plannedFinish)!, qty: r.qty,
    }));
  },

  async readEquipmentQuotas(projectId: number): Promise<EquipmentQuota[]> {
    const rows = await prisma.projectEquipmentQuota.findMany({
      where: { projectId },
      include: { equipment: { select: { name: true } } },
      orderBy: { equipmentId: 'asc' },
    });
    return rows.map((r) => ({ equipmentId: r.equipmentId, equipmentName: r.equipment.name, totalQty: r.totalQty }));
  },

  async readManpowerPlanMonths(projectId: number): Promise<ManpowerPlanMonthRow[]> {
    const rows = await prisma.projectManpowerPlanMonth.findMany({
      where: { projectId },
      include: { shift: { select: { sortOrder: true } } },
    });
    return rows
      .map((r) => ({ yearMonth: r.yearMonth, shiftCode: r.shiftCode, planned: r.planned, isManual: r.isManual, sortOrder: r.shift.sortOrder }))
      .sort((a, b) =>
        a.yearMonth.localeCompare(b.yearMonth) || a.sortOrder - b.sortOrder || a.shiftCode.localeCompare(b.shiftCode))
      .map(({ yearMonth, shiftCode, planned, isManual }) => ({ yearMonth, shiftCode, planned, isManual }));
  },

  async readShiftRatios(projectId: number): Promise<ShiftRatio[]> {
    const [activeShifts, stored] = await Promise.all([
      prisma.shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.projectShiftRatio.findMany({ where: { projectId } }),
    ]);
    return resolveShiftRatios(activeShifts.map((s) => s.code), stored);
  },
};
