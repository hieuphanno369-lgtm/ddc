import type { ProjectSummary } from '@/server/queries';

type TopInput = Pick<ProjectSummary, 'priority' | 'status' | 'onTrack' | 'pctActual' | 'projectName'>;

/** Đang trễ = cùng định nghĩa KPI "Trễ tiến độ" (queries.ts kpisForMonth): đang triển khai và !onTrack. */
export function isBehindSchedule(s: Pick<ProjectSummary, 'status' | 'onTrack'>): boolean {
  return s.status === 'Dang_trien_khai' && !s.onTrack;
}

/**
 * Chỉ P0 + status 'Dang_trien_khai'; sort: trễ trước → pctActual tăng dần → projectName localeCompare(vi).
 * Không cắt số dòng (UI cuộn). Trả mảng mới, không sửa mảng đầu vào.
 */
export function selectTopPriority<T extends TopInput>(list: T[]): T[] {
  return list
    .filter((s) => s.priority === 'P0' && s.status === 'Dang_trien_khai')
    .sort((a, b) => {
      const behindA = isBehindSchedule(a) ? 0 : 1;
      const behindB = isBehindSchedule(b) ? 0 : 1;
      if (behindA !== behindB) return behindA - behindB;
      if (a.pctActual !== b.pctActual) return a.pctActual - b.pctActual;
      return a.projectName.localeCompare(b.projectName, 'vi');
    });
}
