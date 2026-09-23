import { describe, it, expect } from 'vitest';
import { formatDateShort, formatDayMonth, formatRatio, formatTyd, formatVndTyd } from './format';

/**
 * Mục 1 - tooltip S-curve hiển thị "tỷ VNĐ" + dấu phẩy ngàn; SPI/CPI toFixed(2).
 * `charts.tsx` SCurve/SpiCpiLine gọi thẳng 2 hàm này trong `formatter` của <Tooltip>,
 * nên hành vi tooltip = hợp đồng của formatTyd/formatRatio.
 */
describe('formatTyd / formatVndTyd - đơn vị tiền S-curve (Mục 1)', () => {
  it('vi: dấu chấm ngàn kiểu VN + hậu tố "tỷ"', () => {
    expect(formatTyd(1200, 'vi')).toBe('1.200 tỷ');
    expect(formatTyd(1234.5, 'vi')).toBe('1.234,5 tỷ');
  });

  it('en: dấu phẩy ngàn kiểu US + hậu tố "bn VND"', () => {
    expect(formatTyd(1200, 'en')).toBe('1,200 bn VND');
    expect(formatTyd(1234.5, 'en')).toBe('1,234.5 bn VND');
  });

  it('null / undefined / NaN → "-", không bao giờ trả "NaN" hay chuỗi rỗng', () => {
    expect(formatTyd(null, 'vi')).toBe('-');
    expect(formatTyd(undefined, 'vi')).toBe('-');
    expect(formatTyd(Number.NaN, 'vi')).toBe('-');
    expect(formatVndTyd(null, 'vi')).toBe('-');
    expect(formatVndTyd(Number.NaN, 'en')).toBe('-');
  });

  it('mặc định locale vi khi không truyền locale', () => {
    expect(formatTyd(1200)).toBe('1.200 tỷ');
  });
});

describe('formatRatio - tooltip SPI/CPI (Mục 1)', () => {
  it('làm tròn đúng 2 chữ số thập phân', () => {
    expect(formatRatio(1.239)).toBe('1.24');
    expect(formatRatio(0.9)).toBe('0.90');
    expect(formatRatio(1)).toBe('1.00');
  });

  it('null / undefined / NaN → "-"', () => {
    expect(formatRatio(null)).toBe('-');
    expect(formatRatio(undefined)).toBe('-');
    expect(formatRatio(Number.NaN)).toBe('-');
  });

  it('không rò "NaN"/"null" ra tooltip với mọi đầu vào', () => {
    const inputs: Array<number | null | undefined> = [0, 0.001, -1.5, 12345.6789, Number.NaN, null, undefined];
    for (const v of inputs) {
      expect(formatRatio(v)).toMatch(/^(-|-?\d+\.\d{2})$/);
    }
  });
});

describe('formatDateShort / formatDayMonth', () => {
  it('formatDateShort: YYYY-MM-DD -> DD/MM/YY', () => {
    expect(formatDateShort('2026-09-16')).toBe('16/09/26');
  });
  it('formatDateShort: nhan ISO day du', () => {
    expect(formatDateShort('2026-09-16T00:00:00.000Z')).toBe('16/09/26');
  });
  it('formatDateShort: null hoac chuoi sai dinh dang -> "-"', () => {
    expect(formatDateShort(null)).toBe('-');
    expect(formatDateShort('abc')).toBe('-');
  });
  it('formatDayMonth: YYYY-MM-DD -> DD/MM', () => {
    expect(formatDayMonth('2026-09-16')).toBe('16/09');
  });
  it('formatDayMonth: null -> "-"', () => {
    expect(formatDayMonth(null)).toBe('-');
  });
});
