import { describe, expect, it } from 'vitest';
import { calcScheduleGap } from './schedule-gap';

/**
 * Vòng bổ sung P2B (2026-09-24) - dòng "Chậm/Nhanh N ngày · ±x,x%" dưới thẻ %TT.
 * gapPct = pctActual − pctPlan (phân số 0-1); gapDays = làm tròn(gapPct × số ngày kế hoạch).
 */
describe('calcScheduleGap (src/lib/schedule-gap.ts)', () => {
  it('chậm tiến độ → direction behind, gapDays/gapPct âm', () => {
    // 100 ngày kế hoạch, %TT kém %KH 10 điểm % → -10 ngày.
    const r = calcScheduleGap(0.5, 0.4, '2026-01-01', '2026-04-11');
    expect(r).not.toBeNull();
    expect(r!.direction).toBe('behind');
    expect(r!.gapDays).toBe(-10);
    expect(r!.gapPct).toBeCloseTo(-0.1, 6);
  });

  it('nhanh hơn tiến độ → direction ahead, gapDays/gapPct dương', () => {
    const r = calcScheduleGap(0.4, 0.5, '2026-01-01', '2026-04-11');
    expect(r!.direction).toBe('ahead');
    expect(r!.gapDays).toBe(10);
    expect(r!.gapPct).toBeCloseTo(0.1, 6);
  });

  it('đúng tiến độ (pctActual = pctPlan) → onTrack, gapDays = 0', () => {
    const r = calcScheduleGap(0.5, 0.5, '2026-01-01', '2026-04-11');
    expect(r!.direction).toBe('onTrack');
    expect(r!.gapDays).toBe(0);
    expect(r!.gapPct).toBe(0);
  });

  it('gapDays làm tròn về 0 (chênh lệch quá nhỏ) → vẫn coi là onTrack theo đúng gapDays', () => {
    // 100 ngày, gap 0.2 điểm % → 0.2 ngày → làm tròn 0, dù gapPct != 0.
    const r = calcScheduleGap(0.5, 0.502, '2026-01-01', '2026-04-11');
    expect(r!.gapDays).toBe(0);
    expect(r!.direction).toBe('onTrack');
    expect(r!.gapPct).toBeGreaterThan(0);
  });

  it('làm tròn: 0.5 ngày làm tròn lên (Math.round)', () => {
    // 100 ngày kế hoạch, gap 0.005 điểm % → 0.5 ngày → Math.round(0.5) = 1.
    const r = calcScheduleGap(0.5, 0.505, '2026-01-01', '2026-04-11');
    expect(r!.gapDays).toBe(1);
    expect(r!.direction).toBe('ahead');
  });

  it('dự án đã hoàn thành/vượt kế hoạch (pctPlan kẹp 1 sau ngày kết thúc) vẫn tính đúng công thức, không bịa', () => {
    // Sau ngày kết thúc: pctPlan = 1 (kẹp). pctActual = 0.9 → chậm 10 điểm %.
    const r = calcScheduleGap(1, 0.9, '2026-01-01', '2026-04-11');
    expect(r!.direction).toBe('behind');
    expect(r!.gapDays).toBe(-10);
    // pctActual = 1 đúng hạn khi đã xong → onTrack dù đã qua ngày kết thúc.
    const onTime = calcScheduleGap(1, 1, '2026-01-01', '2026-04-11');
    expect(onTime!.direction).toBe('onTrack');
  });

  it('trước ngày bắt đầu (pctPlan kẹp 0): pctActual = 0 → onTrack, pctActual > 0 → ahead', () => {
    const notStarted = calcScheduleGap(0, 0, '2026-01-01', '2026-04-11');
    expect(notStarted!.direction).toBe('onTrack');
    const earlyStart = calcScheduleGap(0, 0.05, '2026-01-01', '2026-04-11');
    expect(earlyStart!.direction).toBe('ahead');
    expect(earlyStart!.gapDays).toBeGreaterThan(0);
  });

  it('thiếu pctPlan hoặc pctActual → null', () => {
    expect(calcScheduleGap(null, 0.5, '2026-01-01', '2026-04-11')).toBeNull();
    expect(calcScheduleGap(0.5, null, '2026-01-01', '2026-04-11')).toBeNull();
    expect(calcScheduleGap(null, null, '2026-01-01', '2026-04-11')).toBeNull();
  });

  it('thiếu ngày kế hoạch (start hoặc finish null) → null', () => {
    expect(calcScheduleGap(0.5, 0.4, null, '2026-04-11')).toBeNull();
    expect(calcScheduleGap(0.5, 0.4, '2026-01-01', null)).toBeNull();
    expect(calcScheduleGap(0.5, 0.4, null, null)).toBeNull();
  });

  it('ngày rác (không parse được) → null', () => {
    expect(calcScheduleGap(0.5, 0.4, 'khong-phai-ngay', '2026-04-11')).toBeNull();
  });

  it('0 ngày kế hoạch (start === finish) → null, không chia 0', () => {
    const r = calcScheduleGap(1, 0.9, '2026-05-05', '2026-05-05');
    expect(r).toBeNull();
  });

  it('kế hoạch lỗi (finish < start) → null', () => {
    const r = calcScheduleGap(0.5, 0.4, '2026-12-31', '2026-01-01');
    expect(r).toBeNull();
  });

  it('nhận cả Date lẫn ISO string đầy đủ', () => {
    const r = calcScheduleGap(0.5, 0.4, new Date('2026-01-01T00:00:00.000Z'), '2026-04-11T00:00:00.000Z');
    expect(r!.gapDays).toBe(-10);
  });
});
