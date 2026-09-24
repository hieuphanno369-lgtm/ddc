import type { RepoData } from '@/data/seed/history';
import type { AuditLogEntry, FactDailyManpowerShift, Shift } from './types';

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
export function makeEntryMockRepo({ getData }: EntryMockDeps) {
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
  };
}

export { auditMock as audit };
