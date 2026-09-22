import type { StageCode } from '@/server/repo/types';
import { THRESHOLDS } from '@/lib/thresholds';

/**
 * Chuỗi giá trị 7 giai đoạn - nguồn duy nhất cho thứ tự + công thức % tổng thể.
 * Pure functions, unit-test được.
 */

export const STAGE_ORDER: StageCode[] = [
  'design',
  'shop',
  'procurement',
  'fabrication',
  'transport',
  'erection',
  'handover',
];

export interface StageInput {
  stageCode: StageCode;
  pctComplete: number; // fraction [0, 1] (tối đa pctInputMax = 1.5)
  applicable: boolean;
}

/** Chuẩn hóa input %: "0.5" → 0.5, "50" (> 1.5) → 0.5, rỗng → null. Khớp Excel import actions.ts:421. */
export function normPct(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n > THRESHOLDS.pctInputMax ? n / 100 : n;
}

export type StageCalcMode = 'manual' | 'volume';

export interface StageWeight {
  stageCode: StageCode;
  /** Điểm phần trăm 0..100 (KHÔNG phải phân số) - tổng giai đoạn applicable = 100. */
  weightPct: number;
  applicable: boolean;
}

/** Trọng số mặc định đã duyệt. Dùng khi dự án chưa có dòng nào trong project_stage_weight. */
export const DEFAULT_STAGE_WEIGHTS: StageWeight[] = [
  { stageCode: 'design', weightPct: 5, applicable: true },
  { stageCode: 'shop', weightPct: 10, applicable: true },
  { stageCode: 'procurement', weightPct: 10, applicable: true },
  { stageCode: 'fabrication', weightPct: 40, applicable: true },
  { stageCode: 'transport', weightPct: 5, applicable: true },
  { stageCode: 'erection', weightPct: 27, applicable: true },
  { stageCode: 'handover', weightPct: 3, applicable: true },
];

/** manual = nhập tay %HT; volume = suy từ sản lượng hạng mục (fact_stage_work_item). Bộ phân loại đã chốt (Q5). */
export const STAGE_CALC_MODE: Record<StageCode, StageCalcMode> = {
  design: 'manual',
  shop: 'volume',
  procurement: 'volume',
  fabrication: 'volume',
  transport: 'volume',
  erection: 'volume',
  handover: 'manual',
};

/** Giai đoạn chỉ tính vào % tổng khi applicable ở CẢ chain lẫn bảng trọng số, và w > 0. */
function effectiveWeight(stage: StageInput, weights: StageWeight[]): number {
  if (!stage.applicable) return 0;
  const row = weights.find((x) => x.stageCode === stage.stageCode);
  if (!row || !row.applicable || !(row.weightPct > 0)) return 0;
  return row.weightPct;
}

/** % tổng = Σ(w_i × pct_i) / Σ(w_i) trên giai đoạn applicable. Σw = 0 → 0. */
export function calcChainPctActual(
  stages: StageInput[],
  weights: StageWeight[] = DEFAULT_STAGE_WEIGHTS,
): number {
  let num = 0;
  let den = 0;
  for (const s of stages) {
    const w = effectiveWeight(s, weights);
    if (!w) continue;
    num += w * s.pctComplete;
    den += w;
  }
  return den ? num / den : 0;
}

export interface WorkItemQty {
  qtyPlan: number;
  qtyActual: number;
}

/** %HT giai đoạn định lượng = Σ TT / Σ KH. Mẫu số <= 0 → 0 (không Infinity/NaN). */
export function calcStagePctFromVolume(items: WorkItemQty[]): number {
  let plan = 0;
  let actual = 0;
  for (const it of items) {
    plan += it.qtyPlan;
    actual += it.qtyActual;
  }
  return plan > 0 ? actual / plan : 0;
}

export interface WeightValidation {
  ok: boolean;
  total: number;
  error?: 'empty' | 'negative' | 'sum' | 'duplicate';
}

/** Hợp lệ khi: có ít nhất 1 applicable, không âm, không trùng, tổng applicable = 100. */
export function validateStageWeights(weights: StageWeight[]): WeightValidation {
  if (weights.length === 0) return { ok: false, total: 0, error: 'empty' };
  if (new Set(weights.map((x) => x.stageCode)).size !== weights.length) {
    return { ok: false, total: 0, error: 'duplicate' };
  }
  if (weights.some((x) => !Number.isFinite(x.weightPct) || x.weightPct < 0)) {
    return { ok: false, total: 0, error: 'negative' };
  }
  const applicable = weights.filter((x) => x.applicable);
  const total = applicable.reduce((sum, x) => sum + x.weightPct, 0);
  if (applicable.length === 0) return { ok: false, total, error: 'empty' };
  const ok = Math.abs(total - THRESHOLDS.stageWeightTotal) <= THRESHOLDS.stageWeightEpsilon;
  return ok ? { ok: true, total } : { ok: false, total, error: 'sum' };
}

export interface StageContribution {
  stageCode: StageCode;
  weightPct: number;
  applicable: boolean;
  calcMode: StageCalcMode;
  pctComplete: number;
  /** Phần đóng góp vào % tổng: w×pct/Σw. Cộng cả 7 dòng = calcChainPctActual. */
  contributionPct: number;
}

/** Bảng chuỗi giá trị cho UI/API - luôn trả theo STAGE_ORDER, chỉ gồm stage có trong `stages`. */
export function calcStageContributions(
  stages: StageInput[],
  weights: StageWeight[] = DEFAULT_STAGE_WEIGHTS,
): StageContribution[] {
  const den = stages.reduce((sum, s) => sum + effectiveWeight(s, weights), 0);
  return STAGE_ORDER.flatMap((code) => {
    const s = stages.find((x) => x.stageCode === code);
    if (!s) return [];
    const row = weights.find((x) => x.stageCode === code);
    const eff = effectiveWeight(s, weights);
    return [{
      stageCode: code,
      weightPct: row?.weightPct ?? 0,
      applicable: s.applicable && (row?.applicable ?? false),
      calcMode: STAGE_CALC_MODE[code],
      pctComplete: s.pctComplete,
      contributionPct: den ? (eff * s.pctComplete) / den : 0,
    }];
  });
}

/** Giai đoạn hiện tại = giai đoạn applicable ĐẦU TIÊN (theo STAGE_ORDER) có pctComplete < 1. Không có → null. */
export function findCurrentStage(stages: StageInput[]): StageCode | null {
  for (const stage of STAGE_ORDER) {
    const item = stages.find((s) => s.stageCode === stage);
    if (item && item.applicable && item.pctComplete < THRESHOLDS.completionPct) return stage;
  }
  return null;
}
