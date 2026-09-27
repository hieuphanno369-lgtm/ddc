import type { ProjectStageWeight, Stage, StageCode } from '@/server/repo/types';
import type { WorkItemCompare } from '@/lib/stage-timeline';
import { activeStages, calcChainPctActual, validateStageWeights, type StageInput } from '@/lib/stages';

function formatWeightPoints(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }).format(value)}%`;
}

/** Nhãn cột trọng số: "40%", "33,3%" (vi) / "33.3%" (en); không có dòng hoặc applicable=false -> "-". */
export function stageWeightLabel(weights: ProjectStageWeight[], code: StageCode, locale: string): string {
  const w = weights.find((x) => x.stageCode === code);
  if (!w || !w.applicable) return '-';
  return formatWeightPoints(w.weightPct, locale);
}

/** %HT cố định 1 chữ số thập phân: "100,0%" (vi) / "100.0%" (en) - khác `formatPct` (0-2 chữ số). */
export function stagePctLabel(pct: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(pct);
}

/** 2 cột (trái, phải) của thẻ "Chuỗi giá trị quản lý dự án" - chỉ giai đoạn đang dùng, mỗi cột
 * xếp theo `sortOrder` tăng dần (dùng `activeStages`); bên trái/phải do admin cấu hình (P7-C2). */
export function valueChainColumns(stages: readonly Stage[]): [Stage[], Stage[]] {
  const active = activeStages(stages);
  return [active.filter((s) => s.side === 'left'), active.filter((s) => s.side === 'right')];
}

type ChainStageRow = { stageCode: StageCode; pctComplete: number; applicable: boolean };

/** Đủ giai đoạn theo `order`, thiếu dòng -> applicable=true/pctComplete=0 (khớp cách mỗi
 * hàng trong thẻ tự suy `v?.pctComplete ?? 0` khi không có dòng chain). */
function chainStageInputs(chain: ChainStageRow[], order: readonly StageCode[]): StageInput[] {
  return order.map((code) => {
    const v = chain.find((c) => c.stageCode === code);
    return { stageCode: code, pctComplete: v?.pctComplete ?? 0, applicable: v?.applicable ?? true };
  });
}

export interface ChainFooterSummary { weightTotal: number; weightOk: boolean; pctTotal: number }

/**
 * Dòng chân thẻ "Chuỗi giá trị": Σ trọng số thật từ `project_stage_weight` (không ghi cứng 100 -
 * `weightOk=false` khi lệch, để tô cảnh báo) + %TT = Σ(trọng số × %HT giai đoạn), tính bằng đúng
 * `calcChainPctActual`/`validateStageWeights` của `src/lib/stages.ts` (nhất quán với wizard nhập liệu).
 */
export function chainFooterSummary(
  chain: ChainStageRow[],
  weights: ProjectStageWeight[],
  order: readonly StageCode[],
): ChainFooterSummary {
  const v = validateStageWeights(weights);
  const pctTotal = calcChainPctActual(chainStageInputs(chain, order), weights);
  return { weightTotal: v.total, weightOk: v.ok, pctTotal };
}

/** Nhãn Σ trọng số ở dòng chân, dùng chung định dạng số với `stageWeightLabel`. */
export function chainWeightTotalLabel(weightTotal: number, locale: string): string {
  return formatWeightPoints(weightTotal, locale);
}

/** Σ KH/TT (tấn) của giai đoạn định lượng từ getWorkItemComparison; giai đoạn thủ công hoặc không có hạng mục -> null. */
export function stageTonnage(compare: WorkItemCompare, code: StageCode): { planned: number; actual: number } | null {
  const rows = compare[code];
  if (!rows || rows.length === 0) return null;
  return { planned: rows.reduce((s, r) => s + r.planned, 0), actual: rows.reduce((s, r) => s + r.actual, 0) };
}
