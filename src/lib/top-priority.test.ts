import { describe, expect, it } from 'vitest';
import { isBehindSchedule, selectTopPriority } from './top-priority';
import type { ProjectSummary } from '@/server/queries';

type Sum = Pick<ProjectSummary, 'priority' | 'status' | 'onTrack' | 'pctActual' | 'projectName'>;

function proj(over: Partial<Sum>): Sum {
  return { priority: 'P0', status: 'Dang_trien_khai', onTrack: true, pctActual: 0.5, projectName: 'X', ...over };
}

describe('isBehindSchedule', () => {
  it('dang trien khai + khong onTrack -> tre', () => {
    expect(isBehindSchedule({ status: 'Dang_trien_khai', onTrack: false })).toBe(true);
  });
  it('da hoan thanh -> khong tinh la tre du onTrack false', () => {
    expect(isBehindSchedule({ status: 'Hoan_thanh', onTrack: false })).toBe(false);
  });
});

describe('selectTopPriority', () => {
  it('bo P1/P2/P3 va P0 khong dang trien khai', () => {
    const list: Sum[] = [
      proj({ priority: 'P1' }),
      proj({ priority: 'P0', status: 'Chuan_bi' }),
      proj({ priority: 'P0', status: 'Hoan_thanh' }),
      proj({ priority: 'P0', status: 'Tam_dung' }),
      proj({ priority: 'P0', status: 'Dang_trien_khai' }),
    ];
    expect(selectTopPriority(list)).toHaveLength(1);
  });

  it('4 du an P0 dang trien khai: sap xep tre truoc, roi %TT tang dan', () => {
    const A = proj({ projectName: 'A', onTrack: true, pctActual: 0.5 });
    const B = proj({ projectName: 'B', onTrack: false, pctActual: 0.6 });
    const C = proj({ projectName: 'C', onTrack: false, pctActual: 0.3 });
    const D = proj({ projectName: 'D', onTrack: true, pctActual: 0.2 });
    const out = selectTopPriority([A, B, C, D]);
    expect(out.map((s) => s.projectName)).toEqual(['C', 'B', 'D', 'A']);
  });

  it('cung tre + cung pctActual -> theo ten (vi)', () => {
    const anh = proj({ projectName: 'Ánh', onTrack: false, pctActual: 0.4 });
    const binh = proj({ projectName: 'Bình', onTrack: false, pctActual: 0.4 });
    const out = selectTopPriority([binh, anh]);
    expect(out.map((s) => s.projectName)).toEqual(['Ánh', 'Bình']);
  });

  it('mang rong -> rong; khong sua mang dau vao', () => {
    expect(selectTopPriority([])).toEqual([]);
    const list: Sum[] = [proj({ projectName: 'B' }), proj({ projectName: 'A' })];
    const copy = [...list];
    selectTopPriority(list);
    expect(list).toEqual(copy);
  });
});
