import { describe, expect, it } from 'vitest';
import { monthTicks } from './time-axis';

describe('monthTicks', () => {
  it('nhieu thang, nhan chi o thang le', () => {
    expect(monthTicks('2026-02-15', '2026-06-30')).toEqual([
      { date: '2026-03-01', label: '03/26' },
      { date: '2026-04-01', label: null },
      { date: '2026-05-01', label: '05/26' },
      { date: '2026-06-01', label: null },
    ]);
  });
  it('1 thang tron', () => {
    expect(monthTicks('2026-03-01', '2026-03-31')).toEqual([{ date: '2026-03-01', label: '03/26' }]);
  });
  it('bang qua nam', () => {
    const ticks = monthTicks('2025-12-01', '2026-01-31');
    expect(ticks.map((t) => t.label)).toEqual([null, '01/26']);
  });
});
