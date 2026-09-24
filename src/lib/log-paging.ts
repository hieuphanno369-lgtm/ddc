export const LOG_PAGE_SIZE = 20;
export const LOG_DEFAULT_DAYS = 14;
export type LogRange = '14d' | 'all';

/** Chỉ 'all' là 'all'; mọi giá trị khác (thiếu, rác, mảng) -> '14d'. */
export function parseLogRange(v: string | string[] | undefined): LogRange {
  return v === 'all' ? 'all' : '14d';
}

/** Số nguyên >= 1; thiếu/rác/<1/mảng -> 1. */
export function parsePage(v: string | string[] | undefined): number {
  if (typeof v !== 'string') return 1;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** '14d' -> now - 14 ngày (ms); 'all' -> null. */
export function logSince(range: LogRange, now: Date): Date | null {
  if (range === 'all') return null;
  return new Date(now.getTime() - LOG_DEFAULT_DAYS * 24 * 60 * 60 * 1000);
}

/** Kẹp page vào [1, totalPages]; totalPages >= 1 kể cả total = 0. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((p - 1) * pageSize, p * pageSize), total, page: p, totalPages };
}

/** Link /audit, bỏ tham số mặc định: auditHref({page:1,range:'14d'}) === '/audit'; ({page:2,range:'all'}) === '/audit?range=all&page=2'. */
export function auditHref(p: { page: number; range: LogRange }): string {
  const params = new URLSearchParams();
  if (p.range === 'all') params.set('range', 'all');
  if (p.page !== 1) params.set('page', String(p.page));
  const qs = params.toString();
  return qs ? `/audit?${qs}` : '/audit';
}
