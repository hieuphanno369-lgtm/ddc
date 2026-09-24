import type { ProjectStageWeight, StageCode } from '@/server/repo/types';

/** Nhãn cột trọng số: "40%", "33,3%" (vi) / "33.3%" (en); không có dòng hoặc applicable=false -> "-". */
export function stageWeightLabel(weights: ProjectStageWeight[], code: StageCode, locale: string): string {
  const w = weights.find((x) => x.stageCode === code);
  if (!w || !w.applicable) return '-';
  return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }).format(w.weightPct)}%`;
}
