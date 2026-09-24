import { buildGantt, type GanttModel } from '@/lib/equipment-gantt';
import { repo } from './repo';

/**
 * Dữ liệu Gantt thiết bị (T14) cho trang Chi tiết dự án. KHÔNG tự kiểm quyền - chỉ được gọi từ
 * trang đã `requireProjectRead`.
 */
export async function getEquipmentGantt(projectId: number, noWorkItemName: string): Promise<GanttModel | null> {
  const plans = await repo.readEquipmentPlans(projectId);
  if (plans.length === 0) return null;

  const minStart = plans.map((p) => p.plannedStart).reduce((m, s) => (s < m ? s : m));
  const maxFinish = plans.map((p) => p.plannedFinish).reduce((m, s) => (s > m ? s : m));

  const [usage, equipments, workItems] = await Promise.all([
    repo.readEquipmentUsageDays(projectId, minStart, maxFinish),
    repo.getEquipments(),
    repo.getWorkItems(projectId),
  ]);

  return buildGantt({ plans, usage, equipments, workItems, noWorkItemName });
}
