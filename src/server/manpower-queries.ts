import { buildWeeklyStack, projectTimeline, type ContractorInfo, type ProjectDates, type ShiftInfo, type WeekBucket } from '@/lib/manpower-charts';
import { buildManpowerMonthModel, type ManpowerMonthModel } from '@/lib/manpower-month-chart';
import type { DateRange } from '@/server/repo/read-types';
import { repo } from './repo';

/**
 * Dữ liệu chart nhân lực cho trang Chi tiết dự án. KHÔNG tự kiểm quyền - chỉ được
 * gọi từ trang đã `requireProjectRead`.
 */

export interface WeeklyChartData { contractors: ContractorInfo[]; weeks: WeekBucket[]; range: DateRange }

/**
 * `range = projectTimeline(project, readManpowerRange)`; không xác định được (thiếu ngày dự án
 * lẫn dữ liệu) hoặc chưa có dòng nhân lực nào → `null` (trạng thái rỗng).
 */
export async function getWeeklyChartData(projectId: number, project: ProjectDates): Promise<WeeklyChartData | null> {
  const dataRange = await repo.readManpowerRange(projectId);
  if (!dataRange) return null;
  const range = projectTimeline(project, dataRange);
  if (!range) return null;

  const [rows, contractorRows] = await Promise.all([repo.readManpowerWeekly(projectId), repo.getContractors()]);
  const weeks = buildWeeklyStack(rows, range);

  const totalActual = new Map<number, number>();
  for (const r of rows) totalActual.set(r.contractorId, (totalActual.get(r.contractorId) ?? 0) + r.actual);
  const nameById = new Map(contractorRows.map((c) => [c.id, c.name]));
  const contractors: ContractorInfo[] = [...totalActual.keys()]
    .sort((a, b) => (totalActual.get(b) ?? 0) - (totalActual.get(a) ?? 0))
    .map((id) => ({ id, name: nameById.get(id) ?? `#${id}` }));

  return { contractors, weeks, range };
}


/**
 * T5 - model chart KH nhân lực theo tháng (hợp đồng P3C) cho trang Chi tiết dự án. KHÔNG tự kiểm
 * quyền - chỉ được gọi từ trang đã `requireProjectRead`.
 */
export async function getManpowerMonthChartData(projectId: number, locale: string): Promise<ManpowerMonthModel | null> {
  const [plan, ratios, shiftRows, actual] = await Promise.all([
    repo.readManpowerPlanMonths(projectId),
    repo.readShiftRatios(projectId),
    repo.readShifts(),
    repo.readManpowerActualByMonth(projectId),
  ]);
  const shifts: ShiftInfo[] = shiftRows.map((s) => ({
    code: s.code,
    name: locale === 'vi' ? s.nameVi : s.nameEn,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  }));
  return buildManpowerMonthModel({ plan, ratios, shifts, actual });
}
