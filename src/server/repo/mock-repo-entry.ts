import type { RepoData } from '@/data/seed/history';
import type { AuditLogEntry, Contractor, FactDailyManpowerShift, Shift } from './types';

export interface EntryMockDeps {
  getData: () => RepoData;
  persist: () => void;
}

/** Ghi 1 dòng audit_log trong mock (khuôn `logAudit` của mock-repo.ts). */
function auditMock(
  d: RepoData,
  tableName: string,
  recordId: string,
  field: string,
  oldValue: string,
  newValue: string,
  changedBy: string,
  note = '',
): void {
  const entry: AuditLogEntry = {
    id: d.auditLog.length + 1,
    tableName,
    recordId,
    field,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date().toISOString(),
    note,
  };
  d.auditLog.push(entry);
}

/**
 * Hàm repo P2A (Task 1, 3-8) cho mock-repo - hợp nhất qua spread ở mock-repo.ts, KHÔNG sửa trực
 * tiếp `coreRepo` cho từng Task để giảm xung đột với B (K3, ke-hoach.md P2A).
 */
export function makeEntryMockRepo({ getData, persist }: EntryMockDeps) {
  return {
    getShifts(): Shift[] {
      return getData()
        .shifts.filter((s) => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },

    getDailyManpowerByShift(projectId: number, from: string, to: string): FactDailyManpowerShift[] {
      const d = getData();
      const shiftOrder = new Map(d.shifts.map((s) => [s.code, s.sortOrder]));
      return d.dailyManpowerShifts
        .filter((m) => m.projectId === projectId && m.workDate >= from && m.workDate <= to)
        .sort((a, b) => {
          if (a.workDate !== b.workDate) return a.workDate < b.workDate ? -1 : 1;
          if (a.contractorId !== b.contractorId) return a.contractorId - b.contractorId;
          return (shiftOrder.get(a.shiftCode) ?? 0) - (shiftOrder.get(b.shiftCode) ?? 0);
        });
    },

    /** G-18: gan 1 nha thau vao du an. not_found = du an hoac nha thau khong ton tai/khong active. */
    addProjectContractor(projectId: number, contractorId: number, by: string): 'added' | 'exists' | 'not_found' {
      const d = getData();
      const project = d.projects.find((p) => p.id === projectId && p.isActive);
      const contractor = d.contractors.find((c) => c.id === contractorId && c.isActive);
      if (!project || !contractor) return 'not_found';
      const exists = d.projectContractors.some((pc) => pc.projectId === projectId && pc.contractorId === contractorId);
      if (exists) return 'exists';
      d.projectContractors.push({ projectId, contractorId });
      auditMock(d, 'project_contractor', `${projectId}/${contractorId}`, 'add', '', contractor.name, by);
      persist();
      return 'added';
    },

    /** Q5=a: chan go khi nha thau da co so lieu nhan luc/thiet bi o du an nay. */
    removeProjectContractor(projectId: number, contractorId: number, by: string): 'removed' | 'has_data' | 'not_member' {
      const d = getData();
      const idx = d.projectContractors.findIndex((pc) => pc.projectId === projectId && pc.contractorId === contractorId);
      if (idx < 0) return 'not_member';
      const hasData =
        d.dailyManpowerShifts.some((m) => m.projectId === projectId && m.contractorId === contractorId) ||
        d.dailyEquipment.some((e) => e.projectId === projectId && e.contractorId === contractorId);
      if (hasData) return 'has_data';
      const contractor = d.contractors.find((c) => c.id === contractorId);
      d.projectContractors.splice(idx, 1);
      auditMock(d, 'project_contractor', `${projectId}/${contractorId}`, 'remove', contractor?.name ?? '', '', by);
      persist();
      return 'removed';
    },

    /** Q4=a: tao nha thau moi trong buoc nhap; trung ten (khong phan biet hoa thuong) voi nha thau
     * active thi tra ve nha thau do, khong tao them. */
    createContractor(name: string, scopeOfWork: string, by: string): Contractor {
      const d = getData();
      const trimmed = name.trim();
      const existing = d.contractors.find((c) => c.isActive && c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;
      const id = d.contractors.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      const created: Contractor = { id, name: trimmed, scopeOfWork, isActive: true, mergedIntoId: null };
      d.contractors.push(created);
      auditMock(d, 'dim_contractor', String(id), 'create', '', created.name, by);
      persist();
      return created;
    },
  };
}

export { auditMock as audit };
