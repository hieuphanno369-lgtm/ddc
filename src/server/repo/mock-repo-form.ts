import type { RepoData } from '@/data/seed/history';
import { DEFAULT_STAGE_WEIGHTS, STAGE_ORDER } from '@/lib/stages';
import { planAliasChange } from '@/lib/project-code';
import { equipPlanAuditText } from '@/lib/equipment-plan';
import { audit, type EntryMockDeps } from './mock-repo-entry';
import type { AuditLogEntry, EquipmentPlanInput, ProjectMember, StageWeightInput } from './types';

/**
 * S-2 (vòng sửa 1): thân `isProjectCodeTaken` tách nhận `d: RepoData` để dùng lại ở `createProject`
 * (mock-repo.ts) - so `trim().toLowerCase()` với masterCode/currentAliasCode của dự án khác, và
 * alias của dự án khác.
 */
export function isProjectCodeTakenIn(d: RepoData, code: string, exceptProjectId: number | null): boolean {
  const target = code.trim().toLowerCase();
  const projectMatch = d.projects.some(
    (p) => p.id !== exceptProjectId && (p.masterCode.toLowerCase() === target || p.currentAliasCode.toLowerCase() === target),
  );
  if (projectMatch) return true;
  return d.aliases.some((a) => a.projectId !== exceptProjectId && a.aliasCode.toLowerCase() === target);
}

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
 * Hàm repo P3A (Task 4) cho mock-repo - hợp nhất qua spread ở mock-repo.ts, cùng khuôn
 * `mock-repo-entry.ts` (giảm xung đột với B khi cùng sửa file nóng).
 */
export function makeFormMockRepo({ getData, persist }: EntryMockDeps) {
  return {
    /** So `trim().toLowerCase()` với masterCode/currentAliasCode của dự án khác, và alias của dự án khác. */
    isProjectCodeTaken(code: string, exceptProjectId: number | null): boolean {
      return isProjectCodeTakenIn(getData(), code, exceptProjectId);
    },

    /** S-2 (vòng sửa 1, QĐ-11): trùng mã (kể cả masterCode/alias cũ của dự án khác) -> `'taken'`. */
    changeProjectCode(projectId: number, newCode: string, reason: string, by: string, today: string): 'changed' | 'unchanged' | 'not_found' | 'taken' {
      const d = getData();
      const p = d.projects.find((x) => x.id === projectId);
      if (!p) return 'not_found';
      if (newCode === p.currentAliasCode) return 'unchanged';
      if (isProjectCodeTakenIn(d, newCode, projectId)) return 'taken';

      const aliases = d.aliases.filter((a) => a.projectId === projectId);
      const plan = planAliasChange({
        projectId, aliases, oldCode: p.currentAliasCode, newCode, today, reason, by, projectCreatedAt: p.createdAt,
      });

      if (plan.retypeId != null) {
        const row = d.aliases.find((a) => a.id === plan.retypeId);
        if (row) { row.aliasCode = newCode; row.reason = reason; row.approvedBy = by; }
      }
      if (plan.closeId != null) {
        const row = d.aliases.find((a) => a.id === plan.closeId);
        if (row) row.effectiveTo = plan.closeTo;
      }
      if (plan.insertOld) {
        const id = d.aliases.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        d.aliases.push({ id, ...plan.insertOld });
      }
      if (plan.insertNew) {
        const id = d.aliases.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        d.aliases.push({ id, ...plan.insertNew });
      }

      const old = p.currentAliasCode;
      const now = new Date().toISOString();
      d.projectHistory.push({ at: now, by, note: `currentAliasCode: ${old} → ${newCode}`, snapshot: { ...p } });
      p.currentAliasCode = newCode;
      p.updatedAt = now;
      p.updatedBy = by;
      audit(d, 'dim_project_alias', String(projectId), 'aliasCode', old, newCode, by, reason);
      persist();
      return 'changed';
    },

    replaceStageWeights(projectId: number, rows: StageWeightInput[], by: string): void {
      const d = getData();
      const own = d.stageWeights.filter((w) => w.projectId === projectId);
      const beforeRows = own.length ? own : DEFAULT_STAGE_WEIGHTS;
      const beforeText = (own.length ? '' : 'default ') + stageWeightAuditText(beforeRows);
      const afterText = stageWeightAuditText(rows);
      d.stageWeights = d.stageWeights
        .filter((w) => w.projectId !== projectId)
        .concat(rows.map((r) => ({ projectId, ...r })));
      audit(d, 'project_stage_weight', String(projectId), 'replace', beforeText, afterText, by);
      persist();
    },

    removeSapCode(projectId: number, sapCodeId: number, by: string): 'removed' | 'not_found' {
      const d = getData();
      const idx = d.sapCodes.findIndex((s) => s.id === sapCodeId && s.projectId === projectId);
      if (idx < 0) return 'not_found';
      const row = d.sapCodes[idx];
      d.sapCodes.splice(idx, 1);
      audit(d, 'project_sap_codes', String(projectId), 'remove', row.sapCode, '', by);
      persist();
      return 'removed';
    },

    getProjectMembers(projectId: number): ProjectMember[] {
      const d = getData();
      return d.assignments
        .filter((a) => a.projectId === projectId)
        .map((a) => {
          const u = d.userRoles.find((x) => x.email === a.userEmail);
          return {
            userEmail: a.userEmail,
            name: u?.name ?? a.userEmail,
            role: u?.role ?? null,
            roleInProject: a.roleInProject,
            assignedBy: a.assignedBy,
            assignedAt: a.assignedAt,
          };
        })
        .sort((a, b) => {
          if (a.roleInProject !== b.roleInProject) return a.roleInProject === 'PIC' ? -1 : 1;
          return a.userEmail.localeCompare(b.userEmail);
        });
    },

    /** S-6 (vòng sửa 1, QĐ-11): gán PIC khi đã có PIC khác (partial unique index ở Prisma) -> `'pic_exists'`. */
    setProjectMember(projectId: number, email: string, roleInProject: 'PIC' | 'Backup', by: string): 'added' | 'changed' | 'unchanged' | 'pic_exists' {
      const d = getData();
      const prev = d.assignments.find((a) => a.projectId === projectId && a.userEmail === email);
      const now = new Date().toISOString();
      if (prev) {
        if (prev.roleInProject === roleInProject) return 'unchanged';
        if (roleInProject === 'PIC' && d.assignments.some((a) => a.projectId === projectId && a.roleInProject === 'PIC' && a.userEmail !== email)) {
          return 'pic_exists';
        }
        const old = prev.roleInProject;
        prev.roleInProject = roleInProject;
        prev.assignedBy = by;
        prev.assignedAt = now;
        audit(d, 'project_assignments', `${projectId}/${email}`, 'roleInProject', old, roleInProject, by);
        persist();
        return 'changed';
      }
      if (roleInProject === 'PIC' && d.assignments.some((a) => a.projectId === projectId && a.roleInProject === 'PIC')) {
        return 'pic_exists';
      }
      d.assignments.push({ projectId, userEmail: email, roleInProject, assignedBy: by, assignedAt: now });
      audit(d, 'project_assignments', `${projectId}/${email}`, 'roleInProject', '', roleInProject, by);
      persist();
      return 'added';
    },

    removeProjectMember(projectId: number, email: string, by: string): 'removed' | 'not_member' {
      const d = getData();
      const idx = d.assignments.findIndex((a) => a.projectId === projectId && a.userEmail === email);
      if (idx < 0) return 'not_member';
      const old = d.assignments[idx].roleInProject;
      d.assignments.splice(idx, 1);
      audit(d, 'project_assignments', `${projectId}/${email}`, 'roleInProject', old, '', by);
      persist();
      return 'removed';
    },

    approveCustomer(id: number, by: string): 'approved' | 'not_found' | 'not_pending' {
      const d = getData();
      const c = d.customers.find((x) => x.id === id);
      if (!c) return 'not_found';
      if (!c.needsReview) return 'not_pending';
      c.needsReview = false;
      audit(d, 'dim_customer', String(id), 'needsReview', 'true', 'false', by);
      persist();
      return 'approved';
    },

    readProjectAuditTrail(projectId: number, limit: number): AuditLogEntry[] {
      const d = getData();
      const exact = new Set(['dim_project', 'dim_project_alias', 'project_key_milestone', 'project_sap_codes', 'project_stage_weight', 'project_equipment_plan']);
      const prefixed = new Set(['project_contractor', 'project_assignments']);
      const prefix = `${projectId}/`;
      return d.auditLog
        .filter((a) => (exact.has(a.tableName) && a.recordId === String(projectId)) || (prefixed.has(a.tableName) && a.recordId.startsWith(prefix)))
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .slice(0, limit);
    },

    /** Task 12 (P3A, T14): thay TOÀN BỘ kế hoạch thiết bị của 1 dự án - nguồn Gantt thiết bị. */
    replaceEquipmentPlans(projectId: number, rows: EquipmentPlanInput[], by: string): void {
      const d = getData();
      // P3C-A: unitNo co the null (dot nhap theo SL) - EquipmentPlanInput (form P3A) van doi unitNo la so.
      const before = d.equipmentPlans.filter((p) => p.projectId === projectId).map((p) => ({ ...p, unitNo: p.unitNo ?? 0 }));
      const beforeText = equipPlanAuditText(before);
      const afterText = equipPlanAuditText(rows);
      const now = new Date().toISOString();
      let nextId = d.equipmentPlans.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      d.equipmentPlans = d.equipmentPlans
        .filter((p) => p.projectId !== projectId)
        .concat(rows.map((r) => ({ id: nextId++, projectId, ...r, qty: 1, updatedAt: now, updatedBy: by })));
      audit(d, 'project_equipment_plan', String(projectId), 'replace', beforeText, afterText, by);
      persist();
    },
  };
}
