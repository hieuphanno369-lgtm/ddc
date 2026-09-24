import type { ContractorInfo, ShiftInfo } from '@/lib/manpower-charts';
import type { ShiftMonthRow } from '@/server/repo/read-types';
import { repo } from './repo';

/**
 * Dữ liệu 2 chart nhân lực (T12b) cho trang Chi tiết dự án. KHÔNG tự kiểm quyền - chỉ được
 * gọi từ trang đã `requireProjectRead`.
 */

export interface ShiftChartData { shifts: ShiftInfo[]; contractors: ContractorInfo[]; rows: ShiftMonthRow[] }

export async function getShiftChartData(projectId: number, locale: string): Promise<ShiftChartData> {
  const [rows, shiftRows, contractorRows] = await Promise.all([
    repo.readManpowerByShiftMonth(projectId),
    repo.readShifts(),
    repo.getContractors(),
  ]);
  const shifts: ShiftInfo[] = shiftRows.map((s) => ({
    code: s.code,
    name: locale === 'vi' ? s.nameVi : s.nameEn,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  }));
  const contractorIds = new Set(rows.map((r) => r.contractorId));
  const contractors: ContractorInfo[] = contractorRows
    .filter((c) => contractorIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }));
  return { shifts, contractors, rows };
}
