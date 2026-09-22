import { describe, expect, it } from 'vitest';
import {
  calcCpi,
  calcDayVariance,
  calcDurationPctComplete,
  calcEac,
  calcEv,
  calcPv,
  calcScheduleGap,
  calcSpi,
  calcVac,
  computeEvm,
  deriveStatus,
  findBottleneck,
  isCapacityWarning,
  isEquipmentWarning,
  isOnTrack,
  isOverdueWarning,
  penaltyState,
} from './evm';
import type { ValueChainProgress } from '@/server/repo/types';

const D = (s: string) => new Date(`${s}T00:00:00Z`);

describe('EVM công thức', () => {
  it('PV = %KH × BAC', () => {
    expect(calcPv(0.5, 100)).toBe(50);
  });
  it('EV = %TT × BAC', () => {
    expect(calcEv(0.4, 100)).toBe(40);
  });
  it('SPI = EV/PV', () => {
    expect(calcSpi(40, 50)).toBeCloseTo(0.8);
  });
  it('SPI null khi PV = 0', () => {
    expect(calcSpi(40, 0)).toBeNull();
  });
  it('CPI = EV/AC', () => {
    expect(calcCpi(40, 35)).toBeCloseTo(1.1428);
  });
  it('EAC = BAC/CPI', () => {
    expect(calcEac(100, 0.8)).toBe(125);
  });
  it('VAC = BAC − EAC', () => {
    expect(calcVac(100, 125)).toBe(-25);
  });
  it('computeEvm đầy đủ snapshot', () => {
    const s = computeEvm(100, 0.5, 0.4, 35);
    expect(s.pv).toBe(50);
    expect(s.ev).toBe(40);
    expect(s.sv).toBe(-10);
    expect(s.cv).toBe(5);
    expect(s.spi).toBeCloseTo(0.8);
    expect(s.cpi).toBeCloseTo(1.1428);
    expect(s.eac).toBeCloseTo(87.5);
  });
});

describe('Trạng thái dự án', () => {
  it('Chuẩn bị khi chưa có ngày BĐ thực tế', () => {
    expect(deriveStatus({ actualStartDate: null, actualFinishDate: null, pctActual: 0 })).toBe('Chuan_bi');
  });
  it('Đang triển khai khi có ngày BĐ và %TT < 100%', () => {
    expect(
      deriveStatus({ actualStartDate: '2026-01-01', actualFinishDate: null, pctActual: 0.5 }),
    ).toBe('Dang_trien_khai');
  });
  it('Hoàn thành khi %TT ≥ 100% và có ngày KT', () => {
    expect(
      deriveStatus({ actualStartDate: '2026-01-01', actualFinishDate: '2026-06-01', pctActual: 1 }),
    ).toBe('Hoan_thanh');
  });
});

describe('Đúng/Trễ tiến độ (biên 5%)', () => {
  it('Đúng khi %TT ≥ %KH − 5%', () => {
    expect(isOnTrack(0.9, 0.95)).toBe(true);
  });
  it('Trễ khi %TT < %KH − 5%', () => {
    expect(isOnTrack(0.89, 0.95)).toBe(false);
  });
});

describe('Nguy cơ phạt HĐ', () => {
  const today = new Date('2026-09-16');
  it('Đã phạt khi cờ penalized', () => {
    expect(
      penaltyState({ committedHandoverDate: '2026-10-01', pctActual: 0.5, penalized: true, today }),
    ).toBe('penalized');
  });
  it('Nguy cơ khi ≤30 ngày và chưa đạt 100%', () => {
    expect(
      penaltyState({ committedHandoverDate: '2026-09-20', pctActual: 0.8, penalized: false, today }),
    ).toBe('risk');
  });
  it('Không rủi ro khi còn >30 ngày', () => {
    expect(
      penaltyState({ committedHandoverDate: '2026-12-01', pctActual: 0.8, penalized: false, today }),
    ).toBe('none');
  });
  it('Không rủi ro khi không có ngày cam kết', () => {
    expect(penaltyState({ committedHandoverDate: null, pctActual: 0.5, penalized: false, today })).toBe('none');
  });
});

describe('Khâu nghẽn chuỗi giá trị', () => {
  const chain = (pcts: [number, number, number, number, number, number, number]): ValueChainProgress[] =>
    (['design', 'shop', 'procurement', 'fabrication', 'transport', 'erection', 'handover'] as const).map(
      (stageCode, i) => ({ projectId: 1, stageCode, yearMonth: '2026-09', pctComplete: pcts[i], applicable: true }),
    );
  it('Trả về stage đầu tiên < 100%', () => {
    expect(findBottleneck(chain([1, 1, 0.8, 0.5, 0, 0, 0]))).toBe('procurement');
  });
  it('Không có khâu nghẽn khi tất cả 100%', () => {
    expect(findBottleneck(chain([1, 1, 1, 1, 1, 1, 1]))).toBeNull();
  });
  it('Bỏ qua giai đoạn không áp dụng - design non-applicable → shop', () => {
    const stages = chain([0, 0, 0, 0, 0, 0, 0]).map((c) =>
      c.stageCode === 'design' ? { ...c, applicable: false } : c,
    );
    expect(findBottleneck(stages)).toBe('shop');
  });
});

describe('Cảnh báo ngưỡng', () => {
  it('Công nợ quá hạn > 5% giá trị HĐ', () => {
    expect(isOverdueWarning(6, 100)).toBe(true);
    expect(isOverdueWarning(5, 100)).toBe(false);
  });
  it('Dồn tải xưởng > 85% công suất tháng', () => {
    expect(isCapacityWarning(90, 1200)).toBe(true); // 1200/12=100, 85% = 85 → 90>85
    expect(isCapacityWarning(80, 1200)).toBe(false);
  });
  it('Huy động thiết bị < 80%', () => {
    expect(isEquipmentWarning(7, 10)).toBe(true);
    expect(isEquipmentWarning(9, 10)).toBe(false);
  });
});

describe('calcDurationPctComplete - "% Kế Hoạch" theo thời gian trôi', () => {
  const start = '2026-01-01';
  const finish = '2026-12-31';   // 364 ngày

  it('trước/đúng ngày bắt đầu → 0', () => {
    expect(calcDurationPctComplete(start, finish, D('2025-06-30'))).toBe(0);
    expect(calcDurationPctComplete(start, finish, D('2026-01-01'))).toBe(0);
  });
  it('đúng/sau ngày kết thúc → 1 (kẹp, không vượt 100%)', () => {
    expect(calcDurationPctComplete(start, finish, D('2026-12-31'))).toBe(1);
    expect(calcDurationPctComplete(start, finish, D('2030-01-01'))).toBe(1);
  });
  it('giữa kỳ → tỷ lệ ngày đã trôi', () => {
    expect(calcDurationPctComplete(start, finish, D('2026-07-01'))).toBeCloseTo(181 / 364, 6);
  });
  it('thiếu ngày → null (không đoán)', () => {
    expect(calcDurationPctComplete(null, finish, D('2026-07-01'))).toBeNull();
    expect(calcDurationPctComplete(start, null, D('2026-07-01'))).toBeNull();
    expect(calcDurationPctComplete(null, null, D('2026-07-01'))).toBeNull();
  });
  it('ngày rác → null', () => {
    expect(calcDurationPctComplete('khong-phai-ngay', finish, D('2026-07-01'))).toBeNull();
  });
  it('finish < start (data lỗi) → null, KHÔNG trả số âm', () => {
    expect(calcDurationPctComplete('2026-12-31', '2026-01-01', D('2026-07-01'))).toBeNull();
  });
  it('finish === start (dự án 1 ngày) → không chia 0', () => {
    expect(calcDurationPctComplete('2026-05-05', '2026-05-05', D('2026-05-04'))).toBe(0);
    expect(calcDurationPctComplete('2026-05-05', '2026-05-05', D('2026-05-05'))).toBe(1);
  });
  it('nhận cả Date lẫn ISO string đầy đủ', () => {
    expect(calcDurationPctComplete(D(start), D(finish), D('2026-12-31'))).toBe(1);
    expect(calcDurationPctComplete('2026-01-01T00:00:00.000Z', finish, D('2026-01-01'))).toBe(0);
  });
});

describe('calcScheduleGap', () => {
  it('chậm hơn kế hoạch → behind, pct là độ lớn dương', () => {
    const r = calcScheduleGap(0.8, 0.7);
    expect(r.direction).toBe('behind');
    expect(r.pct).toBeCloseTo(0.1, 10);
  });
  it('nhanh hơn kế hoạch → ahead', () => {
    expect(calcScheduleGap(0.7, 0.8).direction).toBe('ahead');
  });
  it('bằng nhau → ahead với gap 0 (union chỉ có 2 giá trị)', () => {
    expect(calcScheduleGap(0.5, 0.5)).toEqual({ pct: 0, direction: 'ahead' });
  });
});

describe('calcDayVariance - "Ngày chênh lệch" của mốc giai đoạn (Q1)', () => {
  it('kết thúc muộn hơn kế hoạch → số DƯƠNG bằng số ngày trễ', () => {
    expect(calcDayVariance('2026-09-15', '2026-09-22')).toBe(7);
  });
  it('kết thúc sớm hơn kế hoạch → số ÂM', () => {
    expect(calcDayVariance('2026-09-22', '2026-09-15')).toBe(-7);
  });
  it('đúng hạn → 0', () => {
    expect(calcDayVariance('2026-09-22', '2026-09-22')).toBe(0);
  });
  it('chưa kết thúc thực tế → null, KHÔNG phải 0 (phân biệt với đúng hạn)', () => {
    expect(calcDayVariance('2026-09-22', null)).toBeNull();
    expect(calcDayVariance(null, '2026-09-22')).toBeNull();
    expect(calcDayVariance(null, null)).toBeNull();
  });
  it('ngày rác → null', () => {
    expect(calcDayVariance('khong-phai-ngay', '2026-09-22')).toBeNull();
  });
  it('qua ranh giới tháng/năm và nhận cả Date', () => {
    expect(calcDayVariance('2026-12-28', '2027-01-03')).toBe(6);
    expect(calcDayVariance(D('2026-02-26'), D('2026-03-02'))).toBe(4);
  });
});
