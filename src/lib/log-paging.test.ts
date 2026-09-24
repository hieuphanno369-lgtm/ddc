import { describe, expect, it } from 'vitest';
import { auditHref, logSince, paginate, parseLogRange, parsePage } from './log-paging';

describe('parseLogRange', () => {
  it('"all" -> "all"', () => {
    expect(parseLogRange('all')).toBe('all');
  });
  it('gia tri rac/thieu/mang -> "14d"', () => {
    expect(parseLogRange('x')).toBe('14d');
    expect(parseLogRange(undefined)).toBe('14d');
    expect(parseLogRange(['all'])).toBe('14d');
  });
});

describe('parsePage', () => {
  it('"3" -> 3', () => {
    expect(parsePage('3')).toBe(3);
  });
  it('rac/am/0/thieu/mang/so thap phan -> 1', () => {
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-1')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('2.5')).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage(['2'])).toBe(1);
  });
});

describe('logSince', () => {
  it('"14d" -> now - 14 ngay', () => {
    expect(logSince('14d', new Date('2026-09-24T00:00:00Z'))).toEqual(new Date('2026-09-10T00:00:00Z'));
  });
  it('"all" -> null', () => {
    expect(logSince('all', new Date('2026-09-24T00:00:00Z'))).toBeNull();
  });
});

describe('paginate', () => {
  it('25 phan tu, trang 2, size 20 -> 5 phan tu, totalPages 2', () => {
    const r = paginate(Array.from({ length: 25 }, (_, i) => i), 2, 20);
    expect(r.items).toHaveLength(5);
    expect(r.total).toBe(25);
    expect(r.page).toBe(2);
    expect(r.totalPages).toBe(2);
  });

  it('trang vuot qua totalPages -> kep ve trang cuoi', () => {
    const r = paginate(Array.from({ length: 25 }, (_, i) => i), 9, 20);
    expect(r.page).toBe(2);
  });

  it('mang rong -> items rong, total 0, page 1, totalPages 1', () => {
    expect(paginate([], 1, 20)).toEqual({ items: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe('auditHref', () => {
  it('trang 1 + 14d (mac dinh) -> "/audit"', () => {
    expect(auditHref({ page: 1, range: '14d' })).toBe('/audit');
  });
  it('trang 2 + all -> "/audit?range=all&page=2"', () => {
    expect(auditHref({ page: 2, range: 'all' })).toBe('/audit?range=all&page=2');
  });
  it('trang 1 + all -> chi range', () => {
    expect(auditHref({ page: 1, range: 'all' })).toBe('/audit?range=all');
  });
});
