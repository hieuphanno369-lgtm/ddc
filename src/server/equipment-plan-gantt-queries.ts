import { buildPlanGantt, type PlanGanttModel } from '@/lib/equipment-gantt-v2';
import { repo } from './repo';

/**
 * T4 - Gantt thiết bị theo đợt (hợp đồng P3C) cho trang Chi tiết dự án. KHÔNG tự kiểm quyền - chỉ
 * được gọi từ trang đã `requireProjectRead`.
 */
export async function getEquipmentPlanGantt(projectId: number, today: string): Promise<PlanGanttModel | null> {
  const [segments, quotas] = await Promise.all([
    repo.readEquipmentPlanSegments(projectId),
    repo.readEquipmentQuotas(projectId),
  ]);
  return buildPlanGantt(segments, quotas, today);
}
