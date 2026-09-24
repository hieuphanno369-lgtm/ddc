import { prisma } from '@/server/db';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { EquipmentCellInput, ManpowerCellInput } from '@/lib/daily-entry';
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

  /** Ghi nhan luc theo ca + thiet bi theo ngay cua 1 (projectId, workDate). Khong bao gio xoa dong. */
  async saveDailyResources(
    projectId: number,
    workDate: string,
    input: { manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] },
    by: string,
    note: string,
  ): Promise<{ created: number; updated: number; unchanged: number }> {
    const date = dayStart(workDate);
    return prisma.$transaction(async (tx) => {
      const [existingMp, existingEq] = await Promise.all([
        tx.factDailyManpower.findMany({ where: { projectId, workDate: date } }),
        tx.factDailyEquipmentUsage.findMany({ where: { projectId, workDate: date } }),
      ]);
      let created = 0;
      let updated = 0;
      let unchanged = 0;

      for (const m of input.manpower) {
        const prev = existingMp.find((e) => e.contractorId === m.contractorId && e.shiftCode === m.shiftCode);
        if (!prev) {
          if (m.plannedHeadcount === 0 && m.actualHeadcount === 0) {
            unchanged++;
            continue;
          }
          await tx.factDailyManpower.create({
            data: {
              projectId, contractorId: m.contractorId, workDate: date, shiftCode: m.shiftCode,
              plannedHeadcount: m.plannedHeadcount, actualHeadcount: m.actualHeadcount, updatedBy: by,
            },
          });
          created++;
          continue;
        }
        if (prev.plannedHeadcount === m.plannedHeadcount && prev.actualHeadcount === m.actualHeadcount) {
          unchanged++;
          continue;
        }
        await tx.factDailyManpower.update({
          where: {
            projectId_contractorId_workDate_shiftCode: {
              projectId, contractorId: m.contractorId, workDate: date, shiftCode: m.shiftCode,
            },
          },
          data: { plannedHeadcount: m.plannedHeadcount, actualHeadcount: m.actualHeadcount, updatedBy: by },
        });
        await audit(
          tx, 'fact_daily_manpower', `${projectId}/${m.contractorId}/${workDate}/${m.shiftCode}`,
          'plannedHeadcount,actualHeadcount',
          `${prev.plannedHeadcount}/${prev.actualHeadcount}`, `${m.plannedHeadcount}/${m.actualHeadcount}`, by, note,
        );
        updated++;
      }

      for (const e of input.equipment) {
        const prev = existingEq.find((x) => x.contractorId === e.contractorId && x.equipmentId === e.equipmentId);
        if (!prev) {
          if (e.qtyPlanned === 0 && e.qtyActual === 0) {
            unchanged++;
            continue;
          }
          await tx.factDailyEquipmentUsage.create({
            data: {
              projectId, contractorId: e.contractorId, equipmentId: e.equipmentId, workDate: date,
              qtyPlanned: e.qtyPlanned, qtyActual: e.qtyActual, updatedBy: by,
            },
          });
          created++;
          continue;
        }
        if (prev.qtyPlanned === e.qtyPlanned && prev.qtyActual === e.qtyActual) {
          unchanged++;
          continue;
        }
        await tx.factDailyEquipmentUsage.update({
          where: {
            projectId_contractorId_equipmentId_workDate: {
              projectId, contractorId: e.contractorId, equipmentId: e.equipmentId, workDate: date,
            },
          },
          data: { qtyPlanned: e.qtyPlanned, qtyActual: e.qtyActual, updatedBy: by },
        });
        await audit(
          tx, 'fact_daily_equipment_usage', `${projectId}/${e.contractorId}/${e.equipmentId}/${workDate}`,
          'qtyPlanned,qtyActual', `${prev.qtyPlanned}/${prev.qtyActual}`, `${e.qtyPlanned}/${e.qtyActual}`, by, note,
        );
        updated++;
      }

      return { created, updated, unchanged };
    });
  },
};
