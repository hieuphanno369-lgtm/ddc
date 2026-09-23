import { describe, expect, it } from 'vitest';
import { MIN_ACTUAL_BAR, buildPlanActualTimeline } from './timeline';

// 2026-01-01 → 2026-12-31 = 364 ngày; 2026-01-01 → 2026-07-02 = 182 ngày
const BASE = { plannedStart: '2026-01-01', plannedFinish: '2026-12-31', actualStart: '2026-01-11', pctActual: 0.4, today: '2026-07-02' };

describe('buildPlanActualTimeline', () => {
  it('duong chay thuan: vi tri hom nay, thanh TT tu ngay BD TT toi vi tri %TT, tre khoi cong', () => {
    const r = buildPlanActualTimeline(BASE)!;
    expect(r.todayPos).toBeCloseTo(182 / 364, 10);
    expect(r.actual!.left).toBeCloseTo(10 / 364, 10);
    expect(r.actual!.width).toBeCloseTo(0.4 - 10 / 364, 10);
    expect(r.startDelayDays).toBe(10);
  });
  it('nhan ISO day du nhu prisma-repo tra ("...T00:00:00.000Z")', () => {
    const r = buildPlanActualTimeline({ ...BASE, plannedStart: '2026-01-01T00:00:00.000Z', plannedFinish: '2026-12-31T00:00:00.000Z', actualStart: '2026-01-11T00:00:00.000Z' })!;
    expect(r.startDelayDays).toBe(10);
  });
  it('thieu ngay KH hoac HT KH <= BD KH -> null', () => {
    expect(buildPlanActualTimeline({ ...BASE, plannedStart: null })).toBeNull();
    expect(buildPlanActualTimeline({ ...BASE, plannedFinish: null })).toBeNull();
    expect(buildPlanActualTimeline({ ...BASE, plannedFinish: '2026-01-01' })).toBeNull();
  });
  it('chua khoi cong -> actual null, startDelayDays null', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: null })!;
    expect(r.actual).toBeNull();
    expect(r.startDelayDays).toBeNull();
  });
  it('hom nay truoc BD KH -> 0; sau HT KH -> 1', () => {
    expect(buildPlanActualTimeline({ ...BASE, today: '2025-12-01' })!.todayPos).toBe(0);
    expect(buildPlanActualTimeline({ ...BASE, today: '2027-03-01' })!.todayPos).toBe(1);
  });
  it('BD TT som hon BD KH -> left kep 0, startDelayDays am', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: '2025-12-22' })!;
    expect(r.actual!.left).toBe(0);
    expect(r.actual!.width).toBeCloseTo(0.4, 10);
    expect(r.startDelayDays).toBe(-10);
  });
  it('%TT nho hon vi tri BD TT -> thanh van rong toi thieu', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: '2026-07-01', pctActual: 0.1 })!;
    expect(r.actual!.width).toBe(MIN_ACTUAL_BAR);
  });
  it('BD TT sau HT KH -> thanh don sat mep phai, khong tran', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: '2027-02-01', pctActual: 0 })!;
    expect(r.actual!.left + r.actual!.width).toBeCloseTo(1, 10);
  });
});
