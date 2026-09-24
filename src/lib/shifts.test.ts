import { describe, expect, it } from 'vitest';
import { splitHeadcount, sumManpowerShifts } from './shifts';
import type { FactDailyManpowerShift } from '@/server/repo/types';

describe('sumManpowerShifts', () => {
  it('2 ca cung (p,c,ngay) -> 1 dong tong', () => {
    const rows: FactDailyManpowerShift[] = [
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'afternoon', plannedHeadcount: 3, actualHeadcount: 2 },
    ];
    const result = sumManpowerShifts(rows);
    expect(result).toEqual([
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', plannedHeadcount: 8, actualHeadcount: 6 },
    ]);
  });

  it('khac nha thau giu rieng', () => {
    const rows: FactDailyManpowerShift[] = [
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
      { projectId: 1, contractorId: 2, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 1, actualHeadcount: 1 },
    ];
    const result = sumManpowerShifts(rows);
    expect(result).toHaveLength(2);
  });

  it('thu tu workDate asc roi contractorId asc', () => {
    const rows: FactDailyManpowerShift[] = [
      { projectId: 1, contractorId: 2, workDate: '2026-09-02', shiftCode: 'morning', plannedHeadcount: 1, actualHeadcount: 1 },
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 1, actualHeadcount: 1 },
      { projectId: 1, contractorId: 2, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 1, actualHeadcount: 1 },
    ];
    const result = sumManpowerShifts(rows);
    expect(result.map((r) => `${r.workDate}|${r.contractorId}`)).toEqual([
      '2026-09-01|1',
      '2026-09-01|2',
      '2026-09-02|2',
    ]);
  });

  it('mang rong -> []', () => {
    expect(sumManpowerShifts([])).toEqual([]);
  });

  it('them ca thu 3 (vd "night") -> tu cong ca 3 nhu 2 ca cu, khong sua code (tinh tong quat)', () => {
    const rows: FactDailyManpowerShift[] = [
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'afternoon', plannedHeadcount: 3, actualHeadcount: 2 },
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'night', plannedHeadcount: 2, actualHeadcount: 1 },
    ];
    const result = sumManpowerShifts(rows);
    expect(result).toEqual([
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', plannedHeadcount: 10, actualHeadcount: 7 },
    ]);
  });

  it('1 ca duy nhat (du lieu cu don vao morning) -> tong = chinh no', () => {
    const rows: FactDailyManpowerShift[] = [
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', shiftCode: 'morning', plannedHeadcount: 7, actualHeadcount: 6 },
    ];
    const result = sumManpowerShifts(rows);
    expect(result).toEqual([
      { projectId: 1, contractorId: 1, workDate: '2026-09-01', plannedHeadcount: 7, actualHeadcount: 6 },
    ]);
  });
});

describe('splitHeadcount', () => {
  it.each([
    [0, [0, 0]],
    [1, [1, 0]],
    [7, [4, 3]],
    [120, [60, 60]],
  ] as const)('%s -> %s', (total, expected) => {
    const result = splitHeadcount(total);
    expect(result).toEqual(expected);
    expect(result[0] + result[1]).toBe(total);
  });
});
