import { describe, expect, it } from 'vitest';
import { handoverKey, isoWeekOf, monthKey, weekKey } from './alert-keys';

describe('isoWeekOf', () => {
  it.each([
    ['2026-09-16', '2026-W38'],
    ['2021-01-03', '2020-W53'],
    ['2024-12-30', '2025-W01'],
  ] as const)('%s -> %s', (d, expected) => {
    expect(isoWeekOf(d)).toBe(expected);
  });
});

describe('monthKey', () => {
  it('ghep ma luat + thang', () => {
    expect(monthKey('spi_low', '2026-09')).toBe('spi_low:2026-09');
  });
});

describe('handoverKey', () => {
  it('lay 10 ky tu dau cua ngay ban giao', () => {
    expect(handoverKey('penalty_risk', '2026-10-01T00:00:00.000Z')).toBe('penalty_risk:2026-10-01');
  });

  it('khong co ngay ban giao -> :none', () => {
    expect(handoverKey('penalty_risk', null)).toBe('penalty_risk:none');
  });
});

describe('weekKey', () => {
  it('ghep ma luat + tuan ISO', () => {
    expect(weekKey('manpower_low', '2026-09-16')).toBe('manpower_low:2026-W38');
  });
});
