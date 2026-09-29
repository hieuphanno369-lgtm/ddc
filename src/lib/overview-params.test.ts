import { describe, expect, it } from 'vitest';
import { GROUP_KEY_MAX_LENGTH, MARKETS, PRIORITIES, STATUSES, TYPES, parseDashboardFilters } from './overview-params';

describe('parseDashboardFilters (chỉ nhận giá trị hợp lệ, để khoá unstable_cache không phình)', () => {
  it('không tham số → mọi chiều là all, groupBy/groupKey undefined', () => {
    expect(parseDashboardFilters({})).toEqual({
      status: 'all', teamKdId: 'all', customerId: 'all', priority: 'all', market: 'all', projectType: 'all',
      groupBy: undefined, groupKey: undefined,
    });
  });

  it('giá trị hợp lệ được giữ nguyên', () => {
    const f = parseDashboardFilters({
      status: 'Dang_trien_khai', team: '3', customer: '12', priority: 'P0', market: 'XK', type: 'EPC',
      groupBy: 'type', groupKey: 'EPC',
    });
    expect(f).toEqual({
      status: 'Dang_trien_khai', teamKdId: 3, customerId: 12, priority: 'P0', market: 'XK', projectType: 'EPC',
      groupBy: 'type', groupKey: 'EPC',
    });
  });

  it('status/priority/market/type rác → all', () => {
    const f = parseDashboardFilters({ status: 'rac', priority: 'P9', market: 'MARS', type: '<script>' });
    expect(f.status).toBe('all');
    expect(f.priority).toBe('all');
    expect(f.market).toBe('all');
    expect(f.projectType).toBe('all');
  });

  it('team/customer không phải số nguyên dương → all', () => {
    for (const bad of ['-1', '0', '1.5', 'abc', '01', '1e3', ' 2']) {
      const f = parseDashboardFilters({ team: bad, customer: bad });
      expect(f.teamKdId, `team=${bad}`).toBe('all');
      expect(f.customerId, `customer=${bad}`).toBe('all');
    }
  });

  it('groupBy ngoài team|type|market → undefined; groupKey 500 ký tự bị cắt còn 100', () => {
    expect(parseDashboardFilters({ groupBy: 'zzz' }).groupBy).toBeUndefined();
    const f = parseDashboardFilters({ groupBy: 'team', groupKey: 'x'.repeat(500) });
    expect(f.groupKey).toHaveLength(GROUP_KEY_MAX_LENGTH);
    expect(GROUP_KEY_MAX_LENGTH).toBe(100);
  });

  it('tham số lặp (mảng) coi như không có', () => {
    expect(parseDashboardFilters({ status: ['Chuan_bi', 'Hoan_thanh'] }).status).toBe('all');
  });

  it('danh sách enum khớp kiểu dự án hiện có', () => {
    expect(STATUSES).toContain('Tam_dung');
    expect(PRIORITIES).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(MARKETS).toEqual(['TN', 'XK', 'NoiBo']);
    expect(TYPES).toHaveLength(9);
  });
});
