import { describe, expect, it } from 'vitest';
import {
  estimateLabelWidth, keyMilestoneState, keyMsDomain, layoutMilestoneLabels,
} from './key-milestones';

describe('keyMilestoneState', () => {
  it('da xong, tre', () => {
    expect(keyMilestoneState('2026-01-15', '2026-01-18', '2026-09-16')).toEqual({ kind: 'done', days: 3, tone: 'warn' });
  });
  it('da xong, som', () => {
    expect(keyMilestoneState('2026-03-01', '2026-02-27', '2026-09-16')).toEqual({ kind: 'done', days: -2, tone: 'ok' });
  });
  it('da xong, dung han', () => {
    expect(keyMilestoneState('2026-03-01', '2026-03-01', '2026-09-16')).toEqual({ kind: 'done', days: 0, tone: 'ok' });
  });
  it('da tre, chua xong', () => {
    expect(keyMilestoneState('2026-09-15', null, '2026-09-16')).toEqual({ kind: 'late', days: 1, tone: 'danger' });
  });
  it('con toi, chua xong', () => {
    expect(keyMilestoneState('2026-09-29', null, '2026-09-16')).toEqual({ kind: 'next', days: 13, tone: 'accent' });
  });
  it('dung ngay hom nay, chua xong', () => {
    expect(keyMilestoneState('2026-09-16', null, '2026-09-16')).toEqual({ kind: 'next', days: 0, tone: 'accent' });
  });
});

describe('layoutMilestoneLabels', () => {
  it('4 hop cach xa nhau -> xen ke tren/duoi, tang tang khi cham', () => {
    expect(layoutMilestoneLabels([{ x: 100, width: 100 }, { x: 150, width: 100 }, { x: 200, width: 100 }, { x: 250, width: 100 }])).toEqual([
      { side: -1, tier: 0 }, { side: 1, tier: 0 }, { side: -1, tier: 1 }, { side: 1, tier: 1 },
    ]);
  });
  it('5 hop cung vi tri -> hop thu 5 doi phia', () => {
    const boxes = Array.from({ length: 5 }, () => ({ x: 100, width: 100 }));
    expect(layoutMilestoneLabels(boxes)).toEqual([
      { side: -1, tier: 0 }, { side: 1, tier: 0 }, { side: -1, tier: 1 }, { side: 1, tier: 1 }, { side: 1, tier: 1 },
    ]);
  });
});

describe('estimateLabelWidth', () => {
  it('uoc luong theo do dai chuoi dai hon', () => {
    expect(estimateLabelWidth('abcd', 'ab')).toBeCloseTo(4 * 7.4 + 18, 5);
  });
});

describe('keyMsDomain', () => {
  it('1 ngay duy nhat -> +-14 ngay', () => {
    const T = Date.parse('2026-09-16T00:00:00Z');
    const d = keyMsDomain(['2026-09-16'], '2026-09-16');
    expect(d.lo).toBe(T - 14 * 86_400_000);
    expect(d.hi).toBe(T + 14 * 86_400_000);
  });
  it('khoang rong -> nghi them 6% moi dau', () => {
    const d = keyMsDomain(['2026-01-01', '2026-12-31'], '2026-06-01');
    expect((d.hi - d.lo) / 86_400_000).toBeCloseTo(364 * 1.12, 5);
  });
});
