import type { FactDailyManpower, FactDailyManpowerShift } from '@/server/repo/types';

/** Ca mặc định khi seed/migrate dữ liệu cũ (dữ liệu cũ là tổng ngày -> dồn vào ca sáng). */
export const DEFAULT_SHIFT_CODE = 'morning';

/** Cộng các ca thành tổng ngày theo (projectId, contractorId, workDate). Sắp workDate asc, rồi contractorId asc. */
export function sumManpowerShifts(rows: FactDailyManpowerShift[]): FactDailyManpower[] {
  const map = new Map<string, FactDailyManpower>();
  for (const row of rows) {
    const key = `${row.projectId}|${row.contractorId}|${row.workDate}`;
    const existing = map.get(key);
    if (existing) {
      existing.plannedHeadcount += row.plannedHeadcount;
      existing.actualHeadcount += row.actualHeadcount;
    } else {
      map.set(key, {
        projectId: row.projectId,
        contractorId: row.contractorId,
        workDate: row.workDate,
        plannedHeadcount: row.plannedHeadcount,
        actualHeadcount: row.actualHeadcount,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.workDate !== b.workDate) return a.workDate < b.workDate ? -1 : 1;
    return a.contractorId - b.contractorId;
  });
}

/** Chia 1 số nguyên ≥0 thành [ca sáng, ca tối]: sáng = ceil(x/2), tối = x - sáng. */
export function splitHeadcount(total: number): [number, number] {
  const morning = Math.ceil(total / 2);
  const evening = total - morning;
  return [morning, evening];
}
