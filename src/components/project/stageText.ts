type T = (key: string, values?: Record<string, string | number>) => string;
/** Q5 (a): dayVariance > 0 = trễ → "+N ngày"; null → "-". */
export function varianceText(t: T, v: number | null): string {
  return v == null ? '-' : t('detail.stageMs.days', { n: v > 0 ? `+${v}` : String(v) });
}
export function varianceColor(v: number | null, fallback: string): string {
  return v != null && v > 0 ? 'var(--danger)' : fallback;
}
