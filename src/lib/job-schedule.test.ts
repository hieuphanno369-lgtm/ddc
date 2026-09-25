import { describe, expect, it } from 'vitest';
import { isAlertsDailyDue, isRatesDue, vnDateOf, type JobRunLite } from './job-schedule';

const TODAY = '2026-09-16';
const NOW = new Date('2026-09-16T10:00:00Z');

describe('vnDateOf', () => {
  it('quy doi UTC+7', () => {
    expect(vnDateOf('2026-09-15T18:00:00Z')).toBe('2026-09-16');
    expect(vnDateOf('2026-09-16T00:00:00Z')).toBe('2026-09-16');
  });
});

describe('isAlertsDailyDue', () => {
  it('chua chay hom nay -> due', () => {
    expect(isAlertsDailyDue([], TODAY, NOW)).toBe(true);
  });

  it("da 'ok' hom nay (gio VN) -> khong due", () => {
    const runs: JobRunLite[] = [{ status: 'ok', startedAt: '2026-09-15T18:00:00Z' }];
    expect(isAlertsDailyDue(runs, TODAY, NOW)).toBe(false);
  });

  it("'running' 10 phut -> khong due", () => {
    const runs: JobRunLite[] = [{ status: 'running', startedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() }];
    expect(isAlertsDailyDue(runs, TODAY, NOW)).toBe(false);
  });

  it("'running' 40 phut -> due (coi nhu chet)", () => {
    const runs: JobRunLite[] = [{ status: 'running', startedAt: new Date(NOW.getTime() - 40 * 60_000).toISOString() }];
    expect(isAlertsDailyDue(runs, TODAY, NOW)).toBe(true);
  });

  it("'ok' cua ngay khac -> khong tinh, van due", () => {
    const runs: JobRunLite[] = [{ status: 'ok', startedAt: '2026-09-14T18:00:00Z' }];
    expect(isAlertsDailyDue(runs, TODAY, NOW)).toBe(true);
  });
});

describe('isRatesDue', () => {
  it('missing=false -> false', () => {
    expect(isRatesDue([], false, NOW)).toBe(false);
  });

  it('missing=true, chua co run nao -> true', () => {
    expect(isRatesDue([], true, NOW)).toBe(true);
  });

  it('error 2 gio truoc -> false (chua toi han thu lai)', () => {
    const runs: JobRunLite[] = [{ status: 'error', startedAt: new Date(NOW.getTime() - 2 * 3_600_000).toISOString() }];
    expect(isRatesDue(runs, true, NOW)).toBe(false);
  });

  it('error 7 gio truoc -> true (qua han thu lai)', () => {
    const runs: JobRunLite[] = [{ status: 'error', startedAt: new Date(NOW.getTime() - 7 * 3_600_000).toISOString() }];
    expect(isRatesDue(runs, true, NOW)).toBe(true);
  });

  it("'running' da stale (40 phut) khong chan thu lai", () => {
    const runs: JobRunLite[] = [{ status: 'running', startedAt: new Date(NOW.getTime() - 40 * 60_000).toISOString() }];
    expect(isRatesDue(runs, true, NOW)).toBe(true);
  });
});
