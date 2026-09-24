import { describe, expect, it } from 'vitest';
import { assertPerfDb, estimateRows, parsePerfArgs, PERF_DB } from './perf-guard';

const TODAY = '2026-09-24';

describe('assertPerfDb', () => {
  it("'ddc_control_tower' (DB cua A) -> nem loi", () => {
    expect(() => assertPerfDb('ddc_control_tower')).toThrow();
  });

  it(`'${PERF_DB}' (DB cua B) -> khong nem`, () => {
    expect(() => assertPerfDb(PERF_DB)).not.toThrow();
  });

  it("'' (rong) -> nem loi", () => {
    expect(() => assertPerfDb('')).toThrow();
  });
});

describe('parsePerfArgs', () => {
  it('khong co argv -> mac dinh dung', () => {
    const o = parsePerfArgs([], TODAY);
    expect(o).toEqual({ projects: 500, days: 730, audit: 1_000_000, activity: 100_000, end: TODAY, clean: false });
  });

  it('doc dung tung flag', () => {
    const o = parsePerfArgs(['--projects=10', '--days=30', '--audit=5', '--activity=2', '--end=2026-01-01'], TODAY);
    expect(o).toEqual({ projects: 10, days: 30, audit: 5, activity: 2, end: '2026-01-01', clean: false });
  });

  it('--clean-only -> clean = true', () => {
    expect(parsePerfArgs(['--clean-only'], TODAY).clean).toBe(true);
  });

  it('--projects=0 -> nem loi', () => {
    expect(() => parsePerfArgs(['--projects=0'], TODAY)).toThrow();
  });

  it('--days=abc -> nem loi', () => {
    expect(() => parsePerfArgs(['--days=abc'], TODAY)).toThrow();
  });

  it('--end=2026-13-01 (thang khong hop le) -> nem loi', () => {
    expect(() => parsePerfArgs(['--end=2026-13-01'], TODAY)).toThrow();
  });
});

describe('estimateRows', () => {
  it('mac dinh (500 du an, 730 ngay, 6 nha thau, 2 ca, 2 thiet bi, 7 giai doan) >= 10.000.000', () => {
    const o = parsePerfArgs([], TODAY);
    const n = estimateRows(o, 6, 2, 2, 7);
    expect(n).toBeGreaterThanOrEqual(10_000_000);
  });
});
