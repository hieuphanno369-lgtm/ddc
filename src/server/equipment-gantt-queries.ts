import { buildGantt, type GanttModel } from '@/lib/equipment-gantt';
import { repo } from './repo';

/**
 * Dữ liệu Gantt thiết bị (T14) cho trang Chi tiết dự án. KHÔNG tự kiểm quyền - chỉ được gọi từ
 * trang đã `requireProjectRead`.
 */

// Khoảng ngày rộng hết mức để đọc toàn bộ usage của dự án, không cắt theo khoảng plan.
const ALL_TIME_FROM = '0001-01-01';
const ALL_TIME_TO = '9999-12-31';

export async function getEquipmentGantt(projectId: number, noWorkItemName: string): Promise<GanttModel | null> {
  const plans = await repo.readEquipmentPlans(projectId);
  if (plans.length === 0) return null;

  // Đọc usage trên toàn bộ ngày của dự án (không cắt theo khoảng plan) để ngày dùng trước plan
  // đầu/sau plan cuối vẫn được tính vào unplannedUsage; trục Gantt vẫn dựng từ plan trong buildGantt.
  const [usage, equipments, workItems] = await Promise.all([
    repo.readEquipmentUsageDays(projectId, ALL_TIME_FROM, ALL_TIME_TO),
    repo.getEquipments(),
    repo.getWorkItems(projectId),
  ]);

  return buildGantt({ plans, usage, equipments, workItems, noWorkItemName });
}
