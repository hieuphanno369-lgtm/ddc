import { describe, expect, it } from 'vitest';
import { DEFAULT_LOAD_CRITERIA, evaluateCriteria, percentile, summarize, summarizeBy, type LoadSample } from './load-stats';

const ok = (ms: number, scenario = 'a', group: 'page' | 'api' = 'page'): LoadSample => ({ scenario, group, ms, status: 200, errorKind: null });
const bad = (scenario = 'a'): LoadSample => ({ scenario, group: 'page', ms: 5, status: 500, errorKind: 'status' });

describe('percentile (nearest-rank)', () => {
  it('[15,20,35,40,50]: p40=20, p50=35, p100=50', () => {
    const v = [15, 20, 35, 40, 50];
    expect(percentile(v, 40)).toBe(20);
    expect(percentile(v, 50)).toBe(35);
    expect(percentile(v, 100)).toBe(50);
  });
  it('1..100: p1=1, p95=95, p99=99', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 1)).toBe(1);
    expect(percentile(v, 95)).toBe(95);
    expect(percentile(v, 99)).toBe(99);
  });
  it('sap xep theo so, khong theo chuoi: [10, 9, 100] p34=10, p100=100', () => {
    expect(percentile([10, 9, 100], 34)).toBe(10);
    expect(percentile([10, 9, 100], 100)).toBe(100);
  });
  it('1 phan tu -> moi p deu tra phan tu do', () => {
    expect(percentile([7], 1)).toBe(7);
    expect(percentile([7], 99)).toBe(7);
  });
  it('mang rong -> null', () => expect(percentile([], 95)).toBeNull());
  it('khong sua mang dau vao', () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });
  it.each([0, -1, 101, Number.NaN])('p=%s -> RangeError', (p) => {
    expect(() => percentile([1, 2], p)).toThrow(RangeError);
  });
  it('co NaN trong mang -> RangeError', () => expect(() => percentile([1, Number.NaN], 50)).toThrow(RangeError));
});

describe('summarize', () => {
  it('tinh loi tren tong, percentile chi tren mau thanh cong, rps theo wall', () => {
    const s = summarize([ok(100), ok(200), ok(300), bad()], 2000);
    expect(s.count).toBe(4);
    expect(s.errors).toBe(1);
    expect(s.errorRate).toBe(0.25);
    expect(s.p50).toBe(200);
    expect(s.min).toBe(100);
    expect(s.max).toBe(300);
    expect(s.mean).toBe(200);
    expect(s.rps).toBe(2);
  });
  it('khong co mau -> count 0, errorRate 0, p null, rps 0', () => {
    const s = summarize([], 1000);
    expect(s).toMatchObject({ count: 0, errors: 0, errorRate: 0, p50: null, p95: null, p99: null, rps: 0 });
  });
  it('toan loi -> p null', () => expect(summarize([bad(), bad()], 1000).p95).toBeNull());
  it('wallMs <= 0 -> rps 0', () => expect(summarize([ok(1)], 0).rps).toBe(0));
});

describe('summarizeBy', () => {
  it('nhom theo scenario', () => {
    const r = summarizeBy([ok(1, 'x'), ok(2, 'y'), ok(3, 'y')], 1000, (s) => s.scenario);
    expect(Object.keys(r).sort()).toEqual(['x', 'y']);
    expect(r.y.count).toBe(2);
  });
});

describe('evaluateCriteria', () => {
  const good = summarize([ok(100), ok(200)], 1000);
  it('dat het -> pass', () => {
    expect(evaluateCriteria({ overall: good, pages: good, exportStats: null }, DEFAULT_LOAD_CRITERIA)).toEqual({ pass: true, failures: [] });
  });
  it('khong co mau -> fail', () => {
    const empty = summarize([], 1000);
    expect(evaluateCriteria({ overall: empty, pages: empty, exportStats: null }, DEFAULT_LOAD_CRITERIA).pass).toBe(false);
  });
  it('ty le loi vuot -> fail', () => {
    const s = summarize([ok(1), bad()], 1000);
    const r = evaluateCriteria({ overall: s, pages: s, exportStats: null }, DEFAULT_LOAD_CRITERIA);
    expect(r.pass).toBe(false);
    expect(r.failures.join(' ')).toMatch(/ty le loi/);
  });
  it('page p95 vuot 3000ms -> fail', () => {
    const slow = summarize([ok(4000)], 1000);
    expect(evaluateCriteria({ overall: slow, pages: slow, exportStats: null }, DEFAULT_LOAD_CRITERIA).failures.join(' ')).toMatch(/page p95/);
  });
  it('export p95 vuot -> fail; export count 0 -> bo qua', () => {
    const slowExport = summarize([ok(9000, 'api_export', 'api')], 1000);
    expect(evaluateCriteria({ overall: good, pages: good, exportStats: slowExport }, DEFAULT_LOAD_CRITERIA).pass).toBe(false);
    expect(evaluateCriteria({ overall: good, pages: good, exportStats: summarize([], 1000) }, DEFAULT_LOAD_CRITERIA).pass).toBe(true);
  });
});

describe('DEFAULT_LOAD_CRITERIA (Q1 = c)', () => {
  it('100 VU: page p95 3000, p99 5000, export p95 8000, loi 1%', () => {
    expect(DEFAULT_LOAD_CRITERIA).toEqual({ maxErrorRate: 0.01, pageP95Ms: 3000, pageP99Ms: 5000, exportP95Ms: 8000 });
  });
  it('page p99 vuot 5000ms trong khi p95 dat -> fail', () => {
    const many = [...Array.from({ length: 98 }, () => ok(100)), ok(6000), ok(6000)];
    const s = summarize(many, 1000);
    const r = evaluateCriteria({ overall: s, pages: s, exportStats: null }, DEFAULT_LOAD_CRITERIA);
    expect(r.failures.join(' ')).toMatch(/page p99/);
  });
});
