import { prisma } from '@/server/db';
import { DEFAULT_STAGE_WEIGHTS, STAGE_ORDER } from '@/lib/stages';
import { planAliasChange } from '@/lib/project-code';
import { equipPlanAuditText } from '@/lib/equipment-plan';
import type { IsoDate } from '@/lib/clock';
import { audit } from './prisma-repo-entry';
import type { AuditLogEntry, EquipmentPlanInput, ProjectAlias, ProjectMember, Role, StageWeightInput } from './types';

/** '00:00:00Z' của ngày `s` ('YYYY-MM-DD') - khớp cách lưu ngày @db.Date ở prisma-repo.ts. */
const dayStart = (s: string): Date => new Date(`${s}T00:00:00Z`);
/** Date → 'YYYY-MM-DD' (cột @db.Date). */
const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Chuỗi mô tả trọng số cho audit_log: "design:5,shop:10(x),…" - (x) = không áp dụng. */
function stageWeightAuditText(rows: { stageCode: string; weightPct: number; applicable: boolean }[]): string {
  return STAGE_ORDER.map((code) => {
    const r = rows.find((x) => x.stageCode === code);
    if (!r) return null;
    return r.applicable ? `${code}:${r.weightPct}` : `${code}:${r.weightPct}(x)`;
  })
    .filter((x): x is string => x !== null)
    .join(',');
}

/**
 * Hàm repo P3A (Task 4) - hợp nhất vào `repo` ở prisma-repo.ts qua spread, cùng khuôn
 * `prisma-repo-entry.ts` (giảm xung đột với B khi cùng sửa file nóng).
 */
export const formPrismaRepo = {
  /** So `trim()` (không phân biệt hoa thường) với masterCode/currentAliasCode của dự án khác, và alias của dự án khác. */
  async isProjectCodeTaken(code: string, exceptProjectId: number | null): Promise<boolean> {
    const target = code.trim();
    const projectMatch = await prisma.project.findFirst({
      where: {
        ...(exceptProjectId != null ? { id: { not: exceptProjectId } } : {}),
        OR: [
          { masterCode: { equals: target, mode: 'insensitive' } },
          { currentAliasCode: { equals: target, mode: 'insensitive' } },
        ],
      },
    });
    if (projectMatch) return true;
    const aliasMatch = await prisma.projectAlias.findFirst({
      where: {
        ...(exceptProjectId != null ? { projectId: { not: exceptProjectId } } : {}),
        aliasCode: { equals: target, mode: 'insensitive' },
      },
    });
    return !!aliasMatch;
  },

  async changeProjectCode(projectId: number, newCode: string, reason: string, by: string, today: IsoDate): Promise<'changed' | 'unchanged' | 'not_found'> {
    return prisma.$transaction(async (tx) => {
      const p = await tx.project.findUnique({ where: { id: projectId } });
      if (!p) return 'not_found';
      if (newCode === p.currentAliasCode) return 'unchanged';

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

  async setProjectMember(projectId: number, email: string, roleInProject: 'PIC' | 'Backup', by: string): Promise<'added' | 'changed' | 'unchanged'> {
    const prev = await prisma.projectAssignment.findUnique({ where: { projectId_userEmail: { projectId, userEmail: email } } });
    if (prev) {
      if (prev.roleInProject === roleInProject) return 'unchanged';
      await prisma.projectAssignment.update({
        where: { projectId_userEmail: { projectId, userEmail: email } },
        data: { roleInProject, assignedBy: by, assignedAt: new Date() },
      });
      await audit(prisma, 'project_assignments', `${projectId}/${email}`, 'roleInProject', prev.roleInProject, roleInProject, by);
      return 'changed';
    }
    await prisma.projectAssignment.create({ data: { projectId, userEmail: email, roleInProject, assignedBy: by } });
    await audit(prisma, 'project_assignments', `${projectId}/${email}`, 'roleInProject', '', roleInProject, by);
    return 'added';
  },

  async removeProjectMember(projectId: number, email: string, by: string): Promise<'removed' | 'not_member'> {
    const prev = await prisma.projectAssignment.findUnique({ where: { projectId_userEmail: { projectId, userEmail: email } } });
    if (!prev) return 'not_member';
    await prisma.projectAssignment.delete({ where: { projectId_userEmail: { projectId, userEmail: email } } });
    await audit(prisma, 'project_assignments', `${projectId}/${email}`, 'roleInProject', prev.roleInProject, '', by);
    return 'removed';
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
    const exact = ['dim_project', 'dim_project_alias', 'project_key_milestone', 'project_sap_codes', 'project_stage_weight', 'project_equipment_plan'];
    const prefixed = ['project_contractor', 'project_assignments'];
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

  /** Task 12 (P3A, T14): thay TOÀN BỘ kế hoạch thiết bị của 1 dự án - nguồn Gantt thiết bị. */
  async replaceEquipmentPlans(projectId: number, rows: EquipmentPlanInput[], by: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const before = await tx.projectEquipmentPlan.findMany({ where: { projectId } });
      const beforeText = equipPlanAuditText(before.map((p) => ({
        equipmentId: p.equipmentId, unitNo: p.unitNo, workItemId: p.workItemId,
        plannedStart: day(p.plannedStart)!, plannedFinish: day(p.plannedFinish)!, note: p.note,
      })));
      const afterText = equipPlanAuditText(rows);
      await tx.projectEquipmentPlan.deleteMany({ where: { projectId } });
      if (rows.length) {
        await tx.projectEquipmentPlan.createMany({
          data: rows.map((r) => ({
            projectId, equipmentId: r.equipmentId, unitNo: r.unitNo, workItemId: r.workItemId,
            plannedStart: dayStart(r.plannedStart), plannedFinish: dayStart(r.plannedFinish),
            note: r.note, updatedBy: by,
          })),
        });
      }
      await audit(tx, 'project_equipment_plan', String(projectId), 'replace', beforeText, afterText, by);
    });
  },
};
