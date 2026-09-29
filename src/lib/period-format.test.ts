import { describe, expect, it } from 'vitest';
import { formatMonthRange, formatMonthShort } from './period-format';

describe('period-format', () => {
  it('formatMonthShort đổi YYYY-MM thành MM/yyyy', () => {
    expect(formatMonthShort('2026-09')).toBe('09/2026');
  });
  it('formatMonthRange: nhiều tháng, 1 tháng, rỗng', () => {
    expect(formatMonthRange(['2026-07', '2026-08', '2026-09'])).toBe('07/2026 - 09/2026');
    expect(formatMonthRange(['2026-07'])).toBe('07/2026');
    expect(formatMonthRange([])).toBe('');
  });
});
