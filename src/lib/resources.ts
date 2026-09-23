import { THRESHOLDS } from '@/lib/thresholds';

/** 1 dòng bảng nguồn lực: nhà thầu (nhân lực) hoặc nhóm thiết bị. */
export interface ResourceRow { id: number; name: string; note: string; planned: number; actual: number }
export type MobilizationTone = 'ok' | 'warn' | 'danger' | 'neutral';

/** TT/KH; KH <= 0 → null (không chia 0, UI hiện "-"). */
export function mobilizationRatio(actual: number, planned: number): number | null {
  return planned > 0 ? actual / planned : null;
}
export function mobilizationTone(ratio: number | null): MobilizationTone {
  if (ratio == null) return 'neutral';
  if (ratio < THRESHOLDS.mobilizationDangerPct) return 'danger';
  if (ratio < THRESHOLDS.mobilizationWarnPct) return 'warn';
  return 'ok';
}
export function mobilizationTotalTone(ratio: number | null): MobilizationTone {
  if (ratio == null) return 'neutral';
  return ratio < THRESHOLDS.mobilizationTotalWarnPct ? 'warn' : 'ok';
}
export const TONE_VAR: Record<MobilizationTone, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--label3)' };
export const TONE_CHIP: Record<MobilizationTone, string> = { ok: 'c-ok', warn: 'c-warn', danger: 'c-dan', neutral: 'c-plain' };
