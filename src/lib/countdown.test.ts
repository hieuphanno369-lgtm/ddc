import { describe, expect, it } from 'vitest';
import { clockOffsetMs, countdownParts, countdownTargetMs } from './countdown';

const at = (s: string) => Date.parse(s);

describe('countdownParts', () => {
  it('con 2 ngay 3 gio 4 phut 6 giay toi 17:00 gio VN ngay dich', () => {
    expect(countdownParts(countdownTargetMs('2026-09-29'), at('2026-09-27T13:55:54+07:00')))
      .toEqual({ days: 2, hours: 3, minutes: 4, seconds: 6, done: false });
  });
  it('qua han -> tat ca 0, done=true (mock-up Math.max(0, ...))', () => {
    expect(countdownParts(countdownTargetMs('2026-09-01'), at('2026-09-16T08:00:00+07:00')))
      .toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
  it('nhan ca ISO day du (lay 10 ky tu dau)', () => {
    expect(countdownTargetMs('2026-09-29T00:00:00.000Z')).toBe(at('2026-09-29T17:00:00+07:00'));
  });
});

describe('clockOffsetMs - dong ho app (DDC_FAKE_TODAY) vs gio that', () => {
  it('app ghim 16/09, gio that 23/09 -> lech -7 ngay', () => {
    expect(clockOffsetMs('2026-09-16', at('2026-09-23T10:00:00+07:00'))).toBe(-7 * 86_400_000);
  });
  it('cung ngay -> 0 (production)', () => {
    expect(clockOffsetMs('2026-09-22', at('2026-09-22T23:30:00+07:00'))).toBe(0);
  });
  it('tinh ngay theo gio VN, khong theo UTC: 00:30 ngay 23 gio VN (= 17:30 ngay 22 UTC) van la ngay 23', () => {
    expect(clockOffsetMs('2026-09-23', at('2026-09-23T00:30:00+07:00'))).toBe(0);
  });
});
