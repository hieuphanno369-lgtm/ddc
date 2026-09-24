import type { ProjectStageWeight, StageCode } from '@/server/repo/types';
import type { WorkItemCompare } from '@/lib/stage-timeline';

/** Nhãn cột trọng số: "40%", "33,3%" (vi) / "33.3%" (en); không có dòng hoặc applicable=false -> "-". */
export function stageWeightLabel(weights: ProjectStageWeight[], code: StageCode, locale: string): string {
  const w = weights.find((x) => x.stageCode === code);
  if (!w || !w.applicable) return '-';
  return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }).format(w.weightPct)}%`;
}

/** Σ KH/TT (tấn) của giai đoạn định lượng từ getWorkItemComparison; giai đoạn thủ công hoặc không có hạng mục -> null. */
export function stageTonnage(compare: WorkItemCompare, code: StageCode): { planned: number; actual: number } | null {
  const rows = compare[code];
  if (!rows || rows.length === 0) return null;
  return { planned: rows.reduce((s, r) => s + r.planned, 0), actual: rows.reduce((s, r) => s + r.actual, 0) };
}
