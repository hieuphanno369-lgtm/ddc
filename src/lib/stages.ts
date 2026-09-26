import type { Stage, StageCode, StageWeightInput } from '@/server/repo/types';
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

/** Tối đa số giai đoạn (tính cả ngừng dùng) - chặn payload/giao diện vô hạn. */
export const STAGE_MAX_COUNT = 30;

/** 8 mã gốc (7 cũ + Thanh quyết toán) - CHỈ seed, preset và test dùng; code chạy thật đọc repo.getStages(). */
export const SEED_STAGE_CODES = [
  'design', 'shop', 'procurement', 'fabrication', 'transport', 'erection', 'handover', 'settlement',
] as const;

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

/** Trọng số mặc định đã duyệt (P7-C2, Q2a): Lắp dựng 25 + Thanh quyết toán 2 (lấy 2 từ Lắp dựng so
 * với bộ cũ 27/0). Dùng khi dự án chưa có dòng nào trong project_stage_weight. */
export const DEFAULT_STAGE_WEIGHTS: StageWeight[] = [
  { stageCode: 'design', weightPct: 5, applicable: true },
  { stageCode: 'shop', weightPct: 10, applicable: true },
  { stageCode: 'procurement', weightPct: 10, applicable: true },
  { stageCode: 'fabrication', weightPct: 40, applicable: true },
  { stageCode: 'transport', weightPct: 5, applicable: true },
  { stageCode: 'erection', weightPct: 25, applicable: true },
  { stageCode: 'handover', weightPct: 3, applicable: true },
  { stageCode: 'settlement', weightPct: 2, applicable: true },
];

/** Bộ trọng số "dự án cũ": 7 số cũ + Thanh quyết toán 0% áp dụng (khớp migration p7_c2).
 * %TT dự án cũ không đổi khi thêm giai đoạn Thanh quyết toán vì trọng số của nó = 0. */
export const LEGACY_STAGE_WEIGHTS: StageWeight[] = [
  { stageCode: 'design', weightPct: 5, applicable: true },
  { stageCode: 'shop', weightPct: 10, applicable: true },
  { stageCode: 'procurement', weightPct: 10, applicable: true },
  { stageCode: 'fabrication', weightPct: 40, applicable: true },
  { stageCode: 'transport', weightPct: 5, applicable: true },
  { stageCode: 'erection', weightPct: 27, applicable: true },
  { stageCode: 'handover', weightPct: 3, applicable: true },
  { stageCode: 'settlement', weightPct: 0, applicable: true },
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

/**
 * Giai đoạn hiện tại = giai đoạn applicable ĐẦU TIÊN (theo `order`) có pctComplete < 1. Không có → null.
 * `weights` có truyền (Q4a) -> bỏ qua giai đoạn có effectiveWeight = 0 (trọng số 0% hoặc tắt áp dụng
 * ở bảng trọng số không coi là khâu nghẽn, khớp cách tính %TT). Không truyền -> hành vi cũ (chỉ xét chain).
 */
export function findCurrentStage(
  stages: StageInput[],
  order: readonly StageCode[] = STAGE_ORDER,
  weights?: readonly StageWeight[],
): StageCode | null {
  for (const code of order) {
    const item = stages.find((s) => s.stageCode === code);
    if (!item || !item.applicable) continue;
    if (weights && effectiveWeight(item, weights as StageWeight[]) === 0) continue;
    if (item.pctComplete < THRESHOLDS.completionPct) return code;
  }
  return null;
}

/** Giai đoạn đang dùng, xếp theo `sortOrder` tăng dần; trùng `sortOrder` thì xếp theo `code` tăng dần. */
export function activeStages(stages: readonly Stage[]): Stage[] {
  return stages
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Thứ tự mã giai đoạn đang dùng (chuỗi tính khâu nghẽn, form nhập, timeline). */
export function stageOrder(stages: readonly Stage[]): StageCode[] {
  return activeStages(stages).map((s) => s.code);
}

/** Tên hiển thị theo locale: 'vi' -> nameVi, còn lại -> nameEn. */
export function stageName(stage: Pick<Stage, 'nameVi' | 'nameEn'>, locale: string): string {
  return locale === 'vi' ? stage.nameVi : stage.nameEn;
}

/** Bảng tên theo mã, gồm CẢ giai đoạn ngừng dùng (dùng để hiện tên khâu nghẽn của tháng cũ). */
export function stageNameMap(stages: readonly Stage[], locale: string): Record<StageCode, string> {
  const map: Record<StageCode, string> = {};
  for (const s of stages) map[s.code] = stageName(s, locale);
  return map;
}

/** Điền đủ trọng số cho danh sách giai đoạn `order`: thiếu dòng -> {weightPct: 0, applicable: true};
 * bỏ mã ngoài `order`; luôn trả đúng thứ tự `order`. */
export function fillWeightsForStages(
  rows: readonly StageWeightInput[],
  order: readonly StageCode[],
): StageWeightInput[] {
  return order.map((code) => {
    const found = rows.find((r) => r.stageCode === code);
    return found ?? { stageCode: code, weightPct: 0, applicable: true };
  });
}

/** So sánh tập mã KHÔNG kể thứ tự: không trùng, không thiếu, không thừa so với `order`. */
export function isSameStageSet(codes: readonly string[], order: readonly StageCode[]): boolean {
  if (codes.length !== order.length) return false;
  const set = new Set(codes);
  if (set.size !== codes.length) return false;
  return order.every((code) => set.has(code));
}

/** Mã giai đoạn admin thêm: 'custom_' + (số lớn nhất trong các mã 'custom_<n>' hiện có + 1). */
export function nextCustomStageCode(existing: readonly string[]): StageCode {
  const nums = existing
    .map((code) => /^custom_(\d+)$/.exec(code))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `custom_${next}`;
}
