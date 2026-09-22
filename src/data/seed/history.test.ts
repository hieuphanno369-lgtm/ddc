import { describe, expect, it } from 'vitest';
import { buildRepoData, CURRENT_MONTH, HISTORY_MONTHS } from './history';

describe('Seed dữ liệu', () => {
  const data = buildRepoData();

  it('17 dự án thật', () => {
    expect(data.projects.length).toBe(17);
  });

  it('12 tháng lịch sử × 17 dự án = 204 bản ghi tiến độ', () => {
    expect(HISTORY_MONTHS.length).toBe(12);
    expect(data.facts.length).toBe(17 * 12);
  });

  it('%TT luôn nằm trong [0, 1.5]', () => {
    for (const f of data.facts) {
      expect(f.pctActual).toBeGreaterThanOrEqual(0);
      expect(f.pctActual).toBeLessThanOrEqual(1.5);
    }
  });

  it('PV/EV/AC nhất quán với BAC', () => {
    for (const f of data.facts) {
      const p = data.projects.find((x) => x.id === f.projectId)!;
      expect(f.pv).toBeCloseTo(f.pctPlan * p.contractValue, 0);
      expect(f.ev).toBeCloseTo(f.pctActual * p.contractValue, 0);
    }
  });

  it('Khâu nghẽn được gán cho tháng hiện tại', () => {
    const latest = data.facts.filter((f) => f.yearMonth === CURRENT_MONTH);
    expect(latest.length).toBe(17);
  });

  it('Có alert cảnh báo (SPI/CPI < 0.9 hoặc phạt)', () => {
    expect(data.alerts.length).toBeGreaterThan(0);
  });
});
