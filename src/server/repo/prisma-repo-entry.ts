import { prisma } from '@/server/db';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Contractor, FactDailyManpowerShift, Shift } from './types';

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

  /** G-18: gan 1 nha thau vao du an. not_found = du an hoac nha thau khong ton tai/khong active. */
  async addProjectContractor(projectId: number, contractorId: number, by: string): Promise<'added' | 'exists' | 'not_found'> {
    const [project, contractor] = await Promise.all([
      prisma.project.findFirst({ where: { id: projectId, isActive: true } }),
      prisma.contractor.findFirst({ where: { id: contractorId, isActive: true } }),
    ]);
    if (!project || !contractor) return 'not_found';
    const existing = await prisma.projectContractor.findUnique({
      where: { projectId_contractorId: { projectId, contractorId } },
    });
    if (existing) return 'exists';
    await prisma.projectContractor.create({ data: { projectId, contractorId } });
    await audit(prisma, 'project_contractor', `${projectId}/${contractorId}`, 'add', '', contractor.name, by);
    return 'added';
  },

  /** Q5=a: chan go khi nha thau da co so lieu nhan luc/thiet bi o du an nay. */
  async removeProjectContractor(projectId: number, contractorId: number, by: string): Promise<'removed' | 'has_data' | 'not_member'> {
    const existing = await prisma.projectContractor.findUnique({
      where: { projectId_contractorId: { projectId, contractorId } },
    });
    if (!existing) return 'not_member';
    const [mp, eq] = await Promise.all([
      prisma.factDailyManpower.findFirst({ where: { projectId, contractorId } }),
      prisma.factDailyEquipmentUsage.findFirst({ where: { projectId, contractorId } }),
    ]);
    if (mp || eq) return 'has_data';
    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    await prisma.projectContractor.delete({ where: { projectId_contractorId: { projectId, contractorId } } });
    await audit(prisma, 'project_contractor', `${projectId}/${contractorId}`, 'remove', contractor?.name ?? '', '', by);
    return 'removed';
  },

  /** Q4=a: tao nha thau moi trong buoc nhap; trung ten (khong phan biet hoa thuong) voi nha thau
   * active thi tra ve nha thau do, khong tao them. */
  async createContractor(name: string, scopeOfWork: string, by: string): Promise<Contractor> {
    const trimmed = name.trim();
    const existing = await prisma.contractor.findFirst({
      where: { isActive: true, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) return existing;
    const created = await prisma.contractor.create({ data: { name: trimmed, scopeOfWork } });
    await audit(prisma, 'dim_contractor', String(created.id), 'create', '', created.name, by);
    return created;
  },
};
