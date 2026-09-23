import { daysBetween, type IsoDate } from '@/lib/clock';

export const KEY_MS_NAME_MAX = 160;
/** Chặn payload phình (DoS) - mock-up không giới hạn, 50 mốc/dự án là quá đủ. */
export const KEY_MS_MAX_ROWS = 50;

/** Chuỗi audit_log cho bộ mốc: "tên|ngàyKH|ngàyTT; ...". */
export function keyMsAuditText(rows: { name: string; plannedDate: string | null; actualDate: string | null }[]): string {
  return rows.map((r) => `${r.name}|${r.plannedDate ?? ''}|${r.actualDate ?? ''}`).join('; ');
}

export type KeyMsTone = 'ok' | 'warn' | 'danger' | 'accent';
export interface KeyMsState { kind: 'done' | 'late' | 'next'; days: number; tone: KeyMsTone }
export const KEY_MS_TONE_VAR: Record<KeyMsTone, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', accent: 'var(--accent)' };

/** Port msState() mock-up dòng 2072-2080. done.days: dương = trễ, âm = sớm. */
export function keyMilestoneState(plannedDate: IsoDate, actualDate: IsoDate | null, today: IsoDate): KeyMsState {
  if (actualDate) {
    const slip = daysBetween(plannedDate, actualDate);
    return { kind: 'done', days: slip, tone: slip > 0 ? 'warn' : 'ok' };
  }
  const left = daysBetween(today, plannedDate);
  return left < 0 ? { kind: 'late', days: -left, tone: 'danger' } : { kind: 'next', days: left, tone: 'accent' };
}

export interface LabelBox { x: number; width: number }
export interface LabelSlot { side: -1 | 1; tier: 0 | 1 }

/** Xếp nhãn xen kẽ trên/dưới trục; chạm nhau thì đẩy ra tầng ngoài, vẫn chạm thì đổi phía (mock-up dòng 2107-2114). */
export function layoutMilestoneLabels(boxes: LabelBox[]): LabelSlot[] {
  const lastRight = { up: [-1e9, -1e9], down: [-1e9, -1e9] };
  const lane = (s: -1 | 1) => (s === -1 ? lastRight.up : lastRight.down);
  return boxes.map((b, i) => {
    let side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const left = b.x - b.width / 2;
    let tier: 0 | 1 = left < lane(side)[0] + 10 ? 1 : 0;
    if (tier === 1 && left < lane(side)[1] + 10) {
      side = side === -1 ? 1 : -1;
      tier = left < lane(side)[0] + 10 ? 1 : 0;
    }
    lane(side)[tier] = b.x + b.width / 2;
    return { side, tier };
  });
}

/** Ước lượng bề rộng khối nhãn (đơn vị viewBox 1000), thay getComputedTextLength của mock-up (dòng 2098-2103). */
export function estimateLabelWidth(name: string, sub: string): number {
  return Math.max(name.length * 7.4, sub.length * 6.2) + 18;
}

/** Miền trục: [min, max] của các ngày + hôm nay, nới 6% mỗi đầu; cùng 1 ngày → ±14 ngày (mock-up dòng 2090-2093). */
export function keyMsDomain(dates: IsoDate[], today: IsoDate): { lo: number; hi: number } {
  const ms = [...dates, today].map((d) => Date.parse(`${d}T00:00:00Z`));
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  const pad = (hi - lo) * 0.06 || 14 * 86_400_000;
  return { lo: lo - pad, hi: hi + pad };
}
