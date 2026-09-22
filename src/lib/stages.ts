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

/** % tổng = tổng % các giai đoạn applicable / số giai đoạn applicable. 0 giai đoạn applicable → 0. */
export function calcChainPctActual(stages: StageInput[]): number {
  const applicable = stages.filter((s) => s.applicable);
  if (applicable.length === 0) return 0;
  return applicable.reduce((sum, s) => sum + s.pctComplete, 0) / applicable.length;
}

/** Giai đoạn hiện tại = giai đoạn applicable ĐẦU TIÊN (theo STAGE_ORDER) có pctComplete < 1. Không có → null. */
export function findCurrentStage(stages: StageInput[]): StageCode | null {
  for (const stage of STAGE_ORDER) {
    const item = stages.find((s) => s.stageCode === stage);
    if (item && item.applicable && item.pctComplete < THRESHOLDS.completionPct) return stage;
  }
  return null;
}
