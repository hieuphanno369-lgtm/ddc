import { describe, expect, it } from 'vitest';
import {
  calcCpi,
  calcEac,
  calcEv,
  calcPv,
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
