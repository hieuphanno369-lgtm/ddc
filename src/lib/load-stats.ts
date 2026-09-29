/**
 * Thống kê cho load test (P5-B): percentile, tóm tắt mẫu, so với tiêu chí đạt.
 * Hàm thuần, không I/O, để unit test bằng Vitest. Script chạy tải nằm ở `scripts/perf/load-test.ts`.
 */

export type LoadErrorKind = 'status' | 'redirect' | 'timeout' | 'network' | 'rate_limited';

export interface LoadSample {
  /** Tên kịch bản, ví dụ 'overview_month'. */
  scenario: string;
  group: 'page' | 'api';
  /** Thời gian tới khi đọc xong body. */
  ms: number;
  /** 0 nếu timeout hoặc lỗi mạng. */
  status: number;
  /** null = thành công. */
  errorKind: LoadErrorKind | null;
}

export interface LatencyStats {
  /** Tổng số mẫu (cả lỗi). */
  count: number;
  errors: number;
  errorRate: number;
  /** Các percentile chỉ tính trên mẫu thành công; không có mẫu thành công thì null. */
  p50: number | null;
  p95: number | null;
  p99: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  rps: number;
}

export interface LoadCriteria {
  maxErrorRate: number;
  pageP95Ms: number;
  pageP99Ms: number;
  exportP95Ms: number;
}

/** Q1 = (c) chủ dự án chốt 2026-09-29: 100 người dùng ảo, thử sức chịu. */
export const DEFAULT_LOAD_CRITERIA: LoadCriteria = {
  maxErrorRate: 0.01,
  pageP95Ms: 3000,
  pageP99Ms: 5000,
  exportP95Ms: 8000,
};

/** Nearest-rank. Mảng rỗng -> null; p ngoài (0, 100] hoặc phần tử không hữu hạn -> RangeError. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!Number.isFinite(p) || p <= 0 || p > 100) throw new RangeError(`percentile: p phai nam trong (0, 100], nhan ${p}`);
  if (values.some((v) => !Number.isFinite(v))) throw new RangeError('percentile: mang co phan tu khong huu han');
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1];
}

export function summarize(samples: readonly LoadSample[], wallMs: number): LatencyStats {
  const okMs = samples.filter((s) => s.errorKind === null).map((s) => s.ms);
  const count = samples.length;
  const errors = count - okMs.length;
  return {
    count,
    errors,
    errorRate: count === 0 ? 0 : errors / count,
    p50: percentile(okMs, 50),
    p95: percentile(okMs, 95),
    p99: percentile(okMs, 99),
    min: okMs.length ? Math.min(...okMs) : null,
    max: okMs.length ? Math.max(...okMs) : null,
    mean: okMs.length ? okMs.reduce((a, b) => a + b, 0) / okMs.length : null,
    rps: wallMs > 0 ? count / (wallMs / 1000) : 0,
  };
}

export function summarizeBy(
  samples: readonly LoadSample[],
  wallMs: number,
  key: (s: LoadSample) => string,
): Record<string, LatencyStats> {
  const groups = new Map<string, LoadSample[]>();
  for (const s of samples) {
    const k = key(s);
    const list = groups.get(k);
    if (list) list.push(s);
    else groups.set(k, [s]);
  }
  const out: Record<string, LatencyStats> = {};
  for (const [k, list] of groups) out[k] = summarize(list, wallMs);
  return out;
}

export function evaluateCriteria(
  input: { overall: LatencyStats; pages: LatencyStats; exportStats: LatencyStats | null },
  c: LoadCriteria,
): { pass: boolean; failures: string[] } {
  const { overall, pages, exportStats } = input;
  const failures: string[] = [];
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

  if (overall.count === 0) failures.push('khong co mau nao');
  if (overall.errorRate > c.maxErrorRate) failures.push(`ty le loi ${pct(overall.errorRate)} > ${pct(c.maxErrorRate)}`);
  if (pages.p95 === null) failures.push('page khong co mau thanh cong');
  else if (pages.p95 > c.pageP95Ms) failures.push(`page p95 ${Math.round(pages.p95)}ms > ${c.pageP95Ms}ms`);
  if (pages.p99 !== null && pages.p99 > c.pageP99Ms) failures.push(`page p99 ${Math.round(pages.p99)}ms > ${c.pageP99Ms}ms`);
  if (exportStats !== null && exportStats.count > 0) {
    if (exportStats.p95 === null) failures.push('export khong co mau thanh cong');
    else if (exportStats.p95 > c.exportP95Ms) failures.push(`export p95 ${Math.round(exportStats.p95)}ms > ${c.exportP95Ms}ms`);
  }
  return { pass: failures.length === 0, failures };
}
