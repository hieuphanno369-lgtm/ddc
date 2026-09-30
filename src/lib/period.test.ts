import { describe, expect, it } from 'vitest';
import {
  PERIOD_MAX_MONTHS, defaultOverviewPeriod, intersectsPeriod, isCacheablePeriod, parsePeriod, parsePeriodChecked, periodAsOfDate,
  periodAsOfMonth, periodContains, periodKey, periodMonths, periodSearch, previousPeriod,
} from './period';

const FB = { from: '2025-10-01', to: '2026-09-16' };

describe('parsePeriod', () => {
  it('from/to hợp lệ → đúng kỳ đó', () => {
    expect(parsePeriod({ from: '2026-07-01', to: '2026-09-16' }, FB)).toEqual({ from: '2026-07-01', to: '2026-09-16' });
  });
  it('from > to → đổi chỗ', () => {
    expect(parsePeriod({ from: '2026-09-16', to: '2026-07-01' }, FB)).toEqual({ from: '2026-07-01', to: '2026-09-16' });
  });
  it('ngày không tồn tại → fallback', () => {
    expect(parsePeriod({ from: '2026-02-30', to: '2026-03-01' }, FB)).toEqual(FB);
  });
  it('chỉ có 1 trong from/to → dùng month nếu có, không thì fallback', () => {
    expect(parsePeriod({ from: '2026-07-01' }, FB)).toEqual(FB);
    expect(parsePeriod({ from: '2026-07-01', month: '2026-03' }, FB)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });
  it('month=YYYY-MM → trọn tháng, kể cả năm nhuận', () => {
    expect(parsePeriod({ month: '2026-03' }, FB)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(parsePeriod({ month: '2024-02' }, FB)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
  it('L-4: month all / rác / ngoài khoảng / không tham số → fallback', () => {
    expect(parsePeriod({ month: 'all' }, FB)).toEqual(FB);
    expect(parsePeriod({ month: 'abc' }, FB)).toEqual(FB);
    expect(parsePeriod({ month: '9999-12' }, FB)).toEqual(FB);
    expect(parsePeriod({}, FB)).toEqual(FB);
  });
  it('from/to ngoài [2000, 2999] → fallback', () => {
    expect(parsePeriod({ from: '1999-12-31', to: '2026-01-01' }, FB)).toEqual(FB);
    expect(parsePeriod({ from: '2026-01-01', to: '3000-01-01' }, FB)).toEqual(FB);
  });
  it('kỳ dài hơn 120 tháng → from kéo lên cho đủ 120 tháng, to giữ nguyên', () => {
    const p = parsePeriod({ from: '2000-01-01', to: '2026-09-16' }, FB);
    expect(p.to).toBe('2026-09-16');
    expect(periodMonths(p)).toHaveLength(PERIOD_MAX_MONTHS);
    expect(p.from).toBe('2016-10-01');
  });
});

describe('periodMonths / mốc', () => {
  it('tính trọn tháng, cũ → mới', () => {
    expect(periodMonths({ from: '2026-06-15', to: '2026-08-02' })).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('kỳ trong 1 tháng → 1 phần tử', () => {
    expect(periodMonths({ from: '2026-06-15', to: '2026-06-20' })).toEqual(['2026-06']);
  });
  it('periodAsOfDate = min(to, today)', () => {
    expect(periodAsOfDate({ from: '2026-07-01', to: '2026-12-31' }, '2026-09-16')).toBe('2026-09-16');
    expect(periodAsOfDate({ from: '2026-01-01', to: '2026-03-31' }, '2026-09-16')).toBe('2026-03-31');
  });
  it('periodAsOfMonth lấy 7 ký tự đầu của ngày mốc', () => {
    expect(periodAsOfMonth({ from: '2026-07-01', to: '2026-12-31' }, '2026-09-16')).toBe('2026-09');
  });
});

describe('previousPeriod / key / contains / search', () => {
  it('kỳ liền trước cùng số ngày', () => {
    expect(previousPeriod({ from: '2026-07-01', to: '2026-09-30' })).toEqual({ from: '2026-03-31', to: '2026-06-30' }); // 92 ngày (07-01..09-30) nên kỳ trước bắt đầu 03-31
  });
  it('kỳ 1 ngày → lùi đúng 1 ngày', () => {
    expect(previousPeriod({ from: '2026-03-01', to: '2026-03-01' })).toEqual({ from: '2026-02-28', to: '2026-02-28' });
  });
  it('periodKey ổn định', () => {
    expect(periodKey({ from: '2026-07-01', to: '2026-09-16' })).toBe('2026-07-01_2026-09-16');
  });
  it('periodContains gồm cả 2 đầu', () => {
    const p = { from: '2026-07-01', to: '2026-07-31' };
    expect(periodContains(p, '2026-07-01')).toBe(true);
    expect(periodContains(p, '2026-07-31')).toBe(true);
    expect(periodContains(p, '2026-08-01')).toBe(false);
  });
  it('periodSearch trả đúng from/to', () => {
    expect(periodSearch({ from: '2026-07-01', to: '2026-09-16' })).toEqual({ from: '2026-07-01', to: '2026-09-16' });
  });
});

describe('intersectsPeriod', () => {
  const p = { from: '2026-08-01', to: '2026-08-31' };
  it('khoảng trước kỳ → false', () => expect(intersectsPeriod('2026-01-05', '2026-06-20', p)).toBe(false));
  it('khoảng sau kỳ → false', () => expect(intersectsPeriod('2026-11-01', '2027-06-30', p)).toBe(false));
  it('null/null → true', () => expect(intersectsPeriod(null, null, p)).toBe(true));
  it('start = cuối kỳ, không end → true', () => expect(intersectsPeriod('2026-08-31', null, p)).toBe(true));
  it('không start, end trước kỳ → false', () => expect(intersectsPeriod(null, '2026-07-31', p)).toBe(false));
  it('end = đầu kỳ → true', () => expect(intersectsPeriod('2026-01-01', '2026-08-01', p)).toBe(true));
});

describe('defaultOverviewPeriod (Q1 = 12 tháng gần nhất)', () => {
  it('ngày 01 của tháng cách 11 tháng → hôm nay', () => {
    expect(defaultOverviewPeriod('2026-09-16')).toEqual({ from: '2025-10-01', to: '2026-09-16' });
    expect(periodMonths(defaultOverviewPeriod('2026-09-16'))).toHaveLength(12);
  });
});

describe('parsePeriodChecked (T-6)', () => {
  it('không có tham số kỳ: không báo lỗi, dùng mặc định', () => {
    expect(parsePeriodChecked({}, FB)).toEqual({ period: FB, invalid: false });
    expect(parsePeriodChecked({ from: '', to: '', month: '' }, FB).invalid).toBe(false);
  });
  it('kỳ hợp lệ (from/to hoặc month): không báo lỗi', () => {
    expect(parsePeriodChecked({ from: '2026-07-01', to: '2026-09-16' }, FB).invalid).toBe(false);
    expect(parsePeriodChecked({ month: '2026-08' }, FB).invalid).toBe(false);
  });
  it('from/to rác, thiếu 1 đầu, month rác: báo lỗi và rơi về mặc định', () => {
    for (const sp of [{ from: 'rác', to: 'rác' }, { from: '2026-07-01' }, { from: '2026-02-30', to: '2026-03-01' }, { month: 'abc' }]) {
      expect(parsePeriodChecked(sp, FB), JSON.stringify(sp)).toEqual({ period: FB, invalid: true });
    }
  });
  it('link cũ ?month=all: im lặng về kỳ mặc định, không báo lỗi (chủ dự án chốt)', () => {
    expect(parsePeriodChecked({ month: 'all' }, FB)).toEqual({ period: FB, invalid: false });
  });
  it('month=all đi kèm from/to rác vẫn báo lỗi (chỉ bỏ qua riêng month=all)', () => {
    expect(parsePeriodChecked({ month: 'all', from: 'rác', to: 'rác' }, FB).invalid).toBe(true);
  });
});


describe('isCacheablePeriod (S-1): chỉ kỳ mặc định và kỳ trọn tháng gần đây mới được ghi vào unstable_cache', () => {
  const TODAY = '2026-09-16';
  it('kỳ mặc định và kỳ tròn tháng (from ngày 01, to hôm nay hoặc cuối tháng) là cacheable', () => {
    expect(isCacheablePeriod(defaultOverviewPeriod(TODAY), TODAY)).toBe(true);
    expect(isCacheablePeriod({ from: '2026-01-01', to: '2026-03-31' }, TODAY)).toBe(true);
    expect(isCacheablePeriod({ from: '2026-08-01', to: '2026-08-31' }, TODAY)).toBe(true);
    expect(isCacheablePeriod({ from: '2026-01-01', to: TODAY }, TODAY)).toBe(true);
  });
  it('kỳ tuỳ ý (giữa tháng) không cacheable', () => {
    expect(isCacheablePeriod({ from: '2026-07-15', to: '2026-08-31' }, TODAY)).toBe(false);
    expect(isCacheablePeriod({ from: '2026-07-01', to: '2026-08-20' }, TODAY)).toBe(false);
    expect(isCacheablePeriod({ from: '2026-07-01', to: '2026-09-15' }, TODAY)).toBe(false);
  });
  it('kỳ quá xa (hơn 24 tháng trước) hoặc kết thúc ở tương lai (sau tháng hiện tại) không cacheable', () => {
    expect(isCacheablePeriod({ from: '2020-01-01', to: '2020-03-31' }, TODAY)).toBe(false);
    expect(isCacheablePeriod({ from: '2026-01-01', to: '2029-01-31' }, TODAY)).toBe(false);
    expect(isCacheablePeriod({ from: '2024-09-01', to: '2024-09-30' }, TODAY)).toBe(true);
    expect(isCacheablePeriod({ from: '2024-08-01', to: '2024-08-31' }, TODAY)).toBe(false);
  });
  it('tập khoá bị chặn trên: số kỳ cacheable phân biệt nhỏ hơn 400 dù thử mọi cặp ngày 01 và cuối tháng', () => {
    let n = 0;
    for (let y = 2000; y < 2040; y++) for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const from = `${y}-${mm}-01`;
      for (let y2 = y; y2 < y + 3; y2++) for (let m2 = 1; m2 <= 12; m2++) {
        const to = endOfMonthIso(y2, m2);
        if (from <= to && isCacheablePeriod({ from, to }, TODAY)) n++;
      }
    }
    expect(n).toBeLessThan(400);
  });
});

function endOfMonthIso(y: number, m: number): string {
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
