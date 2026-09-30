import { describe, expect, it } from 'vitest';
import { dailyDateWindow, hasFutureActual, isBackfillOnly, isInWindow, needsReason } from './daily-entry';
import type { FactDailyEquipmentUsage, FactDailyManpowerShift } from '@/server/repo/types';

const TODAY = '2026-09-16';

describe('dailyDateWindow', () => {
  it('admin: min null, max = today + 30', () => {
    expect(dailyDateWindow('admin', TODAY)).toEqual({ min: null, max: '2026-10-16' });
  });

  it('data-entry: min = today - 7, max = today + 30', () => {
    expect(dailyDateWindow('data-entry', TODAY)).toEqual({ min: '2026-09-09', max: '2026-10-16' });
  });
});

describe('dailyDateWindow + nhap bu (P4)', () => {
  const backfill = [{ from: '2026-01-01', to: '2026-03-31' }];

  it('data-entry: mo them khoang nhap bu, van chan ngay cu ngoai khoang', () => {
    const w = dailyDateWindow('data-entry', TODAY, backfill);
    expect(w).toEqual({ min: '2026-09-09', max: '2026-10-16', extra: backfill });
    expect(isInWindow('2026-02-15', w)).toBe(true);
    expect(isInWindow('2026-01-01', w)).toBe(true);
    expect(isInWindow('2026-03-31', w)).toBe(true);
    expect(isInWindow('2026-04-01', w)).toBe(false);
    expect(isInWindow('2025-12-31', w)).toBe(false);
  });

  it('nhap bu khong bao gio vuot max', () => {
    const w = dailyDateWindow('data-entry', TODAY, [{ from: '2026-09-01', to: '2026-12-31' }]);
    expect(isInWindow('2026-10-16', w)).toBe(true);
    expect(isInWindow('2026-10-17', w)).toBe(false);
  });

  it('admin khong bi anh huong boi khoang nhap bu', () => {
    expect(dailyDateWindow('admin', TODAY, backfill)).toEqual({ min: null, max: '2026-10-16' });
  });

  it('isBackfillOnly: chi ngay cu hon min ma nam trong khoang', () => {
    const w = dailyDateWindow('data-entry', TODAY, backfill);
    expect(isBackfillOnly('2026-02-15', w)).toBe(true);
    expect(isBackfillOnly('2026-09-10', w)).toBe(false);
    expect(isBackfillOnly('2026-04-10', w)).toBe(false);
    expect(isBackfillOnly('2026-02-15', dailyDateWindow('admin', TODAY))).toBe(false);
  });
});

describe('isInWindow', () => {
  const w = { min: '2026-09-09', max: '2026-10-16' };
  it('biên đúng min/max', () => {
    expect(isInWindow('2026-09-09', w)).toBe(true);
    expect(isInWindow('2026-10-16', w)).toBe(true);
    expect(isInWindow('2026-09-08', w)).toBe(false);
    expect(isInWindow('2026-10-17', w)).toBe(false);
  });

  it('min null -> không giới hạn dưới', () => {
    expect(isInWindow('2000-01-01', { min: null, max: '2026-10-16' })).toBe(true);
  });
});

describe('hasFutureActual', () => {
  it('ngày mai TT 1 -> true', () => {
    expect(hasFutureActual('2026-09-17', TODAY, [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 0, actualHeadcount: 1 }], [])).toBe(true);
  });

  it('ngày mai KH 5 TT 0 -> false', () => {
    expect(hasFutureActual('2026-09-17', TODAY, [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 0 }], [])).toBe(false);
  });

  it('hôm nay TT > 0 -> false (không phải tương lai)', () => {
    expect(hasFutureActual(TODAY, TODAY, [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 0, actualHeadcount: 5 }], [])).toBe(false);
  });
});

describe('needsReason', () => {
  const existingMp: FactDailyManpowerShift[] = [
    { projectId: 1, contractorId: 1, workDate: '2026-09-15', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
  ];
  const existingEq: FactDailyEquipmentUsage[] = [];

  it('hôm nay sửa -> false', () => {
    expect(
      needsReason(TODAY, TODAY, [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 9, actualHeadcount: 9 }], [], existingMp, existingEq),
    ).toBe(false);
  });

  it('hôm qua đổi ô đã có -> true', () => {
    expect(
      needsReason('2026-09-15', TODAY, [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 9, actualHeadcount: 9 }], [], existingMp, existingEq),
    ).toBe(true);
  });

  it('hôm qua chỉ thêm ô mới -> false', () => {
    expect(
      needsReason('2026-09-15', TODAY, [{ contractorId: 2, shiftCode: 'morning', plannedHeadcount: 3, actualHeadcount: 3 }], [], existingMp, existingEq),
    ).toBe(false);
  });

  it('hôm qua gửi y hệt -> false', () => {
    expect(
      needsReason('2026-09-15', TODAY, [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 }], [], existingMp, existingEq),
    ).toBe(false);
  });
});
