import { describe, expect, it } from 'vitest';
import { isAlertsDailyDue, vnDateOf, type JobRunLite } from './job-schedule';

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
