import { describe, expect, it } from 'vitest';
import { backfillMonths, isBackfillMonth, isMonthAllowed } from './monthly-entry';

const TODAY = '2026-09-16';
const WIN = [{ from: '2026-01-15', to: '2026-03-10' }];

describe('isMonthAllowed (Q9 = b)', () => {
  it('admin luon duoc, ke ca thang rat cu va tuong lai', () => {
    expect(isMonthAllowed('admin', '2019-01', TODAY, [])).toBe(true);
    expect(isMonthAllowed('admin', '2030-01', TODAY, [])).toBe(true);
  });

  it('data-entry: thang hien tai va thang truoc', () => {
    expect(isMonthAllowed('data-entry', '2026-09', TODAY, [])).toBe(true);
    expect(isMonthAllowed('data-entry', '2026-08', TODAY, [])).toBe(true);
  });

  it('data-entry: thang cu hon thang truoc bi chan khi khong co khoang nhap bu', () => {
    expect(isMonthAllowed('data-entry', '2026-07', TODAY, [])).toBe(false);
    expect(isMonthAllowed('data-entry', '2025-12', TODAY, [])).toBe(false);
  });

  it('data-entry: thang tuong lai bi chan', () => {
    expect(isMonthAllowed('data-entry', '2026-10', TODAY, [])).toBe(false);
  });

  it('data-entry: thang giao khoang nhap bu thi duoc, thang ngoai khoang van chan', () => {
    expect(isMonthAllowed('data-entry', '2026-01', TODAY, WIN)).toBe(true);
    expect(isMonthAllowed('data-entry', '2026-02', TODAY, WIN)).toBe(true);
    expect(isMonthAllowed('data-entry', '2026-03', TODAY, WIN)).toBe(true);
    expect(isMonthAllowed('data-entry', '2025-12', TODAY, WIN)).toBe(false);
    expect(isMonthAllowed('data-entry', '2026-04', TODAY, WIN)).toBe(false);
  });

  it('viewer/bod khong co quyen rieng: cung luat data-entry (quyen ghi chan o tang khac)', () => {
    expect(isMonthAllowed('viewer', '2026-01', TODAY, [])).toBe(false);
  });

  it('dau nam: thang truoc cua 01 la 12 nam ngoai', () => {
    expect(isMonthAllowed('data-entry', '2025-12', '2026-01-05', [])).toBe(true);
    expect(isMonthAllowed('data-entry', '2025-11', '2026-01-05', [])).toBe(false);
  });
});

describe('isBackfillMonth / backfillMonths', () => {
  it('thang chi cham 1 ngay cua khoang van tinh', () => {
    expect(isBackfillMonth('2026-03', [{ from: '2026-03-31', to: '2026-04-02' }])).toBe(true);
    expect(isBackfillMonth('2026-02', [{ from: '2026-03-01', to: '2026-04-02' }])).toBe(false);
  });

  it('liet ke thang khong trung, cu den moi', () => {
    expect(backfillMonths([{ from: '2026-02-10', to: '2026-04-01' }, { from: '2026-03-01', to: '2026-03-05' }])).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
    expect(backfillMonths([])).toEqual([]);
  });
});
