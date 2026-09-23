import type { KeyMsState } from '@/lib/key-milestones';

type T = (key: string, values?: Record<string, number>) => string;

/** Nhãn trạng thái mốc - dùng chung KeyMilestoneChart (Task 6) + KeyMilestoneEditor (Task 8). */
export function keyMsStateText(t: T, s: KeyMsState): string {
  if (s.kind === 'done') {
    if (s.days > 0) return t('detail.keyMs.doneLate', { n: s.days });
    if (s.days < 0) return t('detail.keyMs.doneEarly', { n: -s.days });
    return t('detail.keyMs.doneOnTime');
  }
  return s.kind === 'late' ? t('detail.keyMs.late', { n: s.days }) : t('detail.keyMs.left', { n: s.days });
}
