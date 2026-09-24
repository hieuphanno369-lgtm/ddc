import { prisma } from '@/server/db';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FactDailyManpowerShift, Shift } from './types';

/** 'YYYY-MM-DD' → Date tại 00:00:00Z, để so sánh với cột @db.Date (khớp prisma-repo.ts). */
const dayStart = (s: string): Date => new Date(`${s}T00:00:00Z`);
/** Date → 'YYYY-MM-DD' (cột @db.Date). */
const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

type Tx = Prisma.TransactionClient | PrismaClient;

/** Ghi 1 dòng audit_log - dùng lại trong transaction (Task 3-8) và ngoài transaction. */
export async function audit(
  tx: Tx,
  tableName: string,
  recordId: string,
  field: string,
  oldValue: string,
  newValue: string,
  changedBy: string,
  note = '',
) {
  await tx.auditLog.create({ data: { tableName, recordId, field, oldValue, newValue, changedBy, note } });
}

/**
 * Hàm repo P2A (Task 1, 3-8) - hợp nhất vào `repo` ở prisma-repo.ts qua spread, KHÔNG sửa trực
 * tiếp file đó cho từng Task để giảm xung đột với B (K3, ke-hoach.md P2A).
 */
export const entryPrismaRepo = {
  async getShifts(): Promise<Shift[]> {
    return prisma.shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  },

  async getDailyManpowerByShift(projectId: number, from: string, to: string): Promise<FactDailyManpowerShift[]> {
    const rows = await prisma.factDailyManpower.findMany({
      where: { projectId, workDate: { gte: dayStart(from), lte: dayStart(to) } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }, { shift: { sortOrder: 'asc' } }],
    });
    return rows.map((m) => ({
      projectId: m.projectId,
      contractorId: m.contractorId,
      workDate: day(m.workDate)!,
      shiftCode: m.shiftCode,
      plannedHeadcount: m.plannedHeadcount,
      actualHeadcount: m.actualHeadcount,
    }));
  },
};
