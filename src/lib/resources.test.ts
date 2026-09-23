import { describe, expect, it } from 'vitest';
import { mobilizationRatio, mobilizationTone, mobilizationTotalTone } from './resources';

describe('mobilizationRatio', () => {
  it('actual/planned binh thuong', () => expect(mobilizationRatio(96, 100)).toBe(0.96));
  it('planned <= 0 -> null (khong chia 0)', () => {
    expect(mobilizationRatio(5, 0)).toBeNull();
    expect(mobilizationRatio(0, 0)).toBeNull();
  });
});

describe('mobilizationTone', () => {
  it.each([
    [0.8499, 'danger'],
    [0.85, 'warn'],
    [0.9499, 'warn'],
    [0.95, 'ok'],
    [null, 'neutral'],
  ] as const)('%s -> %s', (ratio, tone) => {
    expect(mobilizationTone(ratio)).toBe(tone);
  });
});

describe('mobilizationTotalTone', () => {
  it.each([
    [0.8999, 'warn'],
    [0.9, 'ok'],
    [null, 'neutral'],
  ] as const)('%s -> %s', (ratio, tone) => {
    expect(mobilizationTotalTone(ratio)).toBe(tone);
  });
});
