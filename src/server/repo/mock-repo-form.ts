import type { RepoData } from '@/data/seed/history';
import { DEFAULT_STAGE_WEIGHTS } from '@/lib/stages';
import { planAliasChange } from '@/lib/project-code';
import { equipGroupsAuditText } from '@/lib/equipment-plan';
import { manpowerMonthAuditText, ratioAuditText, resolveShiftRatios } from '@/lib/manpower-plan';
import { audit, type EntryMockDeps } from './mock-repo-entry';
import type {
  AuditLogEntry, EquipmentPlanGroupInput, EquipmentPlanSegment, EquipmentQuota, ManpowerPlanInput,
  ManpowerPlanMonthRow, ProjectMember, ShiftRatio, StageWeightInput,
} from './types';

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

/** Chuỗi mô tả trọng số cho audit_log: "design:5,shop:10(x),…" - (x) = không áp dụng.
 * P7-C2: duyệt theo THỨ TỰ NHẬN VÀO (danh sách giai đoạn giờ động, đọc từ repo.getStages()). */
function stageWeightAuditText(rows: { stageCode: string; weightPct: number; applicable: boolean }[]): string {
  return rows.map((r) => (r.applicable ? `${r.stageCode}:${r.weightPct}` : `${r.stageCode}:${r.weightPct}(x)`)).join(',');
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
      // T-4 (chu du an chot): CHI thay dong cua nhung ma co trong `rows` - KHONG xoa dong cua giai
      // doan da ngung dung (khong nam trong `rows` vi form khong hien thi no).
      const codes = new Set(rows.map((r) => r.stageCode));
      d.stageWeights = d.stageWeights
        .filter((w) => !(w.projectId === projectId && codes.has(w.stageCode)))
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
      const exact = new Set(['dim_project', 'dim_project_alias', 'project_key_milestone', 'project_sap_codes', 'project_stage_weight', 'project_equipment_plan', 'project_shift_ratio']);
      const prefixed = new Set(['project_contractor', 'project_assignments', 'project_manpower_plan_month']);
      const prefix = `${projectId}/`;
      return d.auditLog
        .filter((a) => (exact.has(a.tableName) && a.recordId === String(projectId)) || (prefixed.has(a.tableName) && a.recordId.startsWith(prefix)))
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .slice(0, limit);
    },

    /** P3C-A (T4): thay TOÀN BỘ quota + đợt thiết bị của dự án; 1 dòng audit. */
    replaceEquipmentPlans(projectId: number, groups: EquipmentPlanGroupInput[], by: string): void {
      const d = getData();
      const beforeQuotas = d.equipmentQuotas.filter((q) => q.projectId === projectId);
      const beforePlans = d.equipmentPlans.filter((p) => p.projectId === projectId);
      const beforeGroups: EquipmentPlanGroupInput[] = beforeQuotas.map((q) => ({
        equipmentId: q.equipmentId,
        totalQty: q.totalQty,
        segments: beforePlans
          .filter((p) => p.equipmentId === q.equipmentId)
          .map((p) => ({ from: p.plannedStart, to: p.plannedFinish, qty: p.qty }))
          .sort((a, b) => a.from.localeCompare(b.from)),
      }));
      const beforeText = equipGroupsAuditText(beforeGroups);
      const afterText = equipGroupsAuditText(groups);

      const now = new Date().toISOString();
      let nextId = d.equipmentPlans.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      d.equipmentQuotas = d.equipmentQuotas
        .filter((q) => q.projectId !== projectId)
        .concat(groups.map((g) => ({ projectId, equipmentId: g.equipmentId, totalQty: g.totalQty, updatedAt: now, updatedBy: by })));
      d.equipmentPlans = d.equipmentPlans
        .filter((p) => p.projectId !== projectId)
        .concat(groups.flatMap((g) => g.segments.map((s) => ({
          id: nextId++, projectId, equipmentId: g.equipmentId, unitNo: null, qty: s.qty, workItemId: null,
          plannedStart: s.from, plannedFinish: s.to, note: '', updatedAt: now, updatedBy: by,
        }))));
      audit(d, 'project_equipment_plan', String(projectId), 'replace', beforeText, afterText, by);
      persist();
    },

    /** P3C-A (T5): thay kế hoạch nhân lực theo tháng × ca + tỷ lệ chia ca; chỉ ghi lại tháng có đổi. */
    replaceManpowerPlan(projectId: number, input: ManpowerPlanInput, by: string): { changedMonths: number; ratioChanged: boolean } {
      const d = getData();
      const activeShifts = d.shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
      const activeCodes = activeShifts.map((s) => s.code);
      const sortOrderByCode = new Map(activeShifts.map((s) => [s.code, s.sortOrder]));

      const monthRows = d.manpowerPlanMonths.filter((m) => m.projectId === projectId);
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
        audit(d, 'project_manpower_plan_month', `${projectId}/${ym}`, 'planned', beforeByMonth.get(ym) ?? '', afterByMonth.get(ym) ?? '', by);
      }

      if (changed.length) {
        const now = new Date().toISOString();
        const changedSet = new Set(changed);
        d.manpowerPlanMonths = d.manpowerPlanMonths.filter((m) => !(m.projectId === projectId && changedSet.has(m.yearMonth)));
        const toCreate = input.months.filter((m) => changedSet.has(m.yearMonth));
        for (const m of toCreate) {
          for (const c of m.cells) {
            d.manpowerPlanMonths.push({
              projectId, yearMonth: m.yearMonth, shiftCode: c.shiftCode, planned: c.planned, isManual: c.isManual,
              updatedAt: now, updatedBy: by,
            });
          }
        }
      }

      const ratioRows = d.shiftRatios.filter((r) => r.projectId === projectId);
      const beforeRatios = resolveShiftRatios(activeCodes, ratioRows);
      const beforeRatioText = ratioAuditText(beforeRatios);
      const afterRatioText = ratioAuditText(input.ratios);
      let ratioChanged = false;
      if (beforeRatioText !== afterRatioText) {
        ratioChanged = true;
        audit(d, 'project_shift_ratio', String(projectId), 'pct', (ratioRows.length === 0 ? 'default ' : '') + beforeRatioText, afterRatioText, by);
        d.shiftRatios = d.shiftRatios
          .filter((r) => r.projectId !== projectId)
          .concat(input.ratios.map((r) => ({ projectId, shiftCode: r.shiftCode, pct: r.pct })));
      }

      if (changed.length || ratioChanged) persist();
      return { changedMonths: changed.length, ratioChanged };
    },

    // ---- P3C-A: 4 hàm đọc theo hợp đồng P3C (B chỉ import từ src/server/repo/types.ts) ----

    async readEquipmentPlanSegments(projectId: number): Promise<EquipmentPlanSegment[]> {
      const d = getData();
      const nameById = new Map(d.equipments.map((e) => [e.id, e.name]));
      return d.equipmentPlans
        .filter((p) => p.projectId === projectId)
        .map((p) => ({
          id: p.id, equipmentId: p.equipmentId, equipmentName: nameById.get(p.equipmentId) ?? `#${p.equipmentId}`,
          from: p.plannedStart, to: p.plannedFinish, qty: p.qty,
        }))
        .sort((a, b) => a.equipmentId - b.equipmentId || a.from.localeCompare(b.from) || a.id - b.id);
    },

    async readEquipmentQuotas(projectId: number): Promise<EquipmentQuota[]> {
      const d = getData();
      const nameById = new Map(d.equipments.map((e) => [e.id, e.name]));
      return d.equipmentQuotas
        .filter((q) => q.projectId === projectId)
        .map((q) => ({ equipmentId: q.equipmentId, equipmentName: nameById.get(q.equipmentId) ?? `#${q.equipmentId}`, totalQty: q.totalQty }))
        .sort((a, b) => a.equipmentId - b.equipmentId);
    },

    async readManpowerPlanMonths(projectId: number): Promise<ManpowerPlanMonthRow[]> {
      const d = getData();
      const sortOrderByCode = new Map(d.shifts.map((s) => [s.code, s.sortOrder]));
      return d.manpowerPlanMonths
        .filter((m) => m.projectId === projectId)
        .map((m) => ({ yearMonth: m.yearMonth, shiftCode: m.shiftCode, planned: m.planned, isManual: m.isManual }))
        .sort((a, b) =>
          a.yearMonth.localeCompare(b.yearMonth)
          || (sortOrderByCode.get(a.shiftCode) ?? Infinity) - (sortOrderByCode.get(b.shiftCode) ?? Infinity)
          || a.shiftCode.localeCompare(b.shiftCode));
    },

    async readShiftRatios(projectId: number): Promise<ShiftRatio[]> {
      const d = getData();
      const activeCodes = d.shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.code);
      const stored = d.shiftRatios.filter((r) => r.projectId === projectId);
      return resolveShiftRatios(activeCodes, stored);
    },
  };
}
