import { describe, expect, it } from 'vitest';
import { backfillExpiresAt, backfillState, checkBackfillRange } from './backfill';

const TODAY = '2026-09-16';

describe('checkBackfillRange (Q12)', () => {
  it('khoang hop le', () => {
    expect(checkBackfillRange('2026-01-01', '2026-06-30', TODAY)).toBeNull();
  });

  it('ngay khong ton tai hoac chuoi rac', () => {
    expect(checkBackfillRange('2026-02-30', '2026-06-30', TODAY)).toBe('invalid');
    expect(checkBackfillRange('abc', '2026-06-30', TODAY)).toBe('invalid');
  });

  it('from > to', () => {
    expect(checkBackfillRange('2026-06-30', '2026-01-01', TODAY)).toBe('invalid');
  });

  it('to o tuong lai bi tu choi, to = hom nay thi duoc', () => {
    expect(checkBackfillRange('2026-09-01', '2026-09-17', TODAY)).toBe('invalid');
    expect(checkBackfillRange('2026-09-01', TODAY, TODAY)).toBeNull();
  });

  it('24 thang thi duoc, 25 thang thi too_long', () => {
    expect(checkBackfillRange('2024-10-01', '2026-09-16', TODAY)).toBeNull();
    expect(checkBackfillRange('2024-09-30', '2026-09-16', TODAY)).toBe('too_long');
  });
});

describe('backfillExpiresAt', () => {
  it('30 ngay sau luc bat', () => {
    const now = new Date('2026-09-16T03:00:00Z');
    expect(backfillExpiresAt(now).toISOString()).toBe('2026-10-16T03:00:00.000Z');
  });
});

describe('backfillState', () => {
  const now = new Date('2026-09-16T00:00:00Z');
  it('dang bat, da tat, het han (tat uu tien hon het han)', () => {
    expect(backfillState({ disabledAt: null, expiresAt: null }, now)).toBe('active');
    expect(backfillState({ disabledAt: null, expiresAt: '2026-10-01T00:00:00Z' }, now)).toBe('active');
    expect(backfillState({ disabledAt: null, expiresAt: '2026-09-16T00:00:00Z' }, now)).toBe('expired');
    expect(backfillState({ disabledAt: '2026-09-10T00:00:00Z', expiresAt: '2026-09-01T00:00:00Z' }, now)).toBe('disabled');
  });
});
