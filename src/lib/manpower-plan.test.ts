import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHIFT_RATIO, MANPOWER_PLAN_MAX_MONTHS, MANPOWER_PLAN_MAX_CELL, defaultShiftRatios, isRatioSumValid,
  manpowerMonthAuditText, monthTotal, ratioAuditText, recomputeMonth, resetMonthToRatio, resolveShiftRatios,
  splitTotal, validateManpowerPlan, type PlanCell,
} from './manpower-plan';
import type { ManpowerPlanInput } from '@/server/repo/types';

describe('splitTotal', () => {
  it('450 [0.6,0.4] -> [270,180]', () => {
    expect(splitTotal(450, [0.6, 0.4])).toEqual([270, 180]);
  });
  it('700 -> [420,280]', () => {
    expect(splitTotal(700, [0.6, 0.4])).toEqual([420, 280]);
  });
  it('800 -> [480,320]', () => {
    expect(splitTotal(800, [0.6, 0.4])).toEqual([480, 320]);
  });
  it('900 -> [540,360]', () => {
    expect(splitTotal(900, [0.6, 0.4])).toEqual([540, 360]);
  });
  it('650 -> [390,260]', () => {
    expect(splitTotal(650, [0.6, 0.4])).toEqual([390, 260]);
  });
  it('400 -> [240,160]', () => {
    expect(splitTotal(400, [0.6, 0.4])).toEqual([240, 160]);
  });
  it('7 [0.6,0.4] -> [4,3]', () => {
    expect(splitTotal(7, [0.6, 0.4])).toEqual([4, 3]);
  });
  it('5 [0.5,0.5] -> [3,2]', () => {
    expect(splitTotal(5, [0.5, 0.5])).toEqual([3, 2]);
  });
  it('1 [0.5,0.5,0] -> [1,0,0]', () => {
    expect(splitTotal(1, [0.5, 0.5, 0])).toEqual([1, 0, 0]);
  });
  it('0 [0.6,0.4] -> [0,0]', () => {
    expect(splitTotal(0, [0.6, 0.4])).toEqual([0, 0]);
  });
  it('10 [1] -> [10]', () => {
    expect(splitTotal(10, [1])).toEqual([10]);
  });

  it('tong luon = total voi 50 bo ngau nhien co seed co dinh', () => {
    // LCG don gian, seed co dinh -> ket qua lap lai duoc giua cac lan chay.
    let seed = 20260926;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 50; i++) {
      const total = Math.floor(rand() * 10000);
      const n = 2 + Math.floor(rand() * 3); // 2..4 ca
      const raw = Array.from({ length: n }, () => rand());
      const sum = raw.reduce((s, x) => s + x, 0) || 1;
      const pcts = raw.map((x) => x / sum);
      const parts = splitTotal(total, pcts);
      expect(parts.reduce((s, x) => s + x, 0)).toBe(total);
      expect(parts.every((x) => x >= 0)).toBe(true);
    }
  });
});

describe('recomputeMonth', () => {
  it('1000, [{300,manual},{0}], [0.6,0.4] -> [{300,manual},{700}]', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 0, isManual: false }];
    const r = recomputeMonth(1000, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: true, cells: [{ planned: 300, isManual: true }, { planned: 700, isManual: false }] });
  });

  it('1000, [{0},{0}] -> [600,400]', () => {
    const cells: PlanCell[] = [{ planned: 0, isManual: false }, { planned: 0, isManual: false }];
    const r = recomputeMonth(1000, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: true, cells: [{ planned: 600, isManual: false }, { planned: 400, isManual: false }] });
  });

  it('200, [{300,manual},{0}] -> below_manual', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 0, isManual: false }];
    const r = recomputeMonth(200, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: false, reason: 'below_manual' });
  });

  it('500, [{300,manual},{200,manual}] -> ok giu nguyen', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 200, isManual: true }];
    const r = recomputeMonth(500, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: true, cells: [{ planned: 300, isManual: true }, { planned: 200, isManual: true }] });
  });

  it('600, [{300,manual},{200,manual}] -> all_manual', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 200, isManual: true }];
    const r = recomputeMonth(600, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: false, reason: 'all_manual' });
  });

  it('3 ca [0.6,0.4,0], o 1 manual -> phan con lai chia cho o 2,3 theo 0.4/0 -> o 2 nhan het', () => {
    const cells: PlanCell[] = [{ planned: 100, isManual: true }, { planned: 0, isManual: false }, { planned: 0, isManual: false }];
    const r = recomputeMonth(500, cells, [0.6, 0.4, 0]);
    expect(r).toEqual({
      ok: true,
      cells: [{ planned: 100, isManual: true }, { planned: 400, isManual: false }, { planned: 0, isManual: false }],
    });
  });
});

describe('defaultShiftRatios', () => {
  it('2 ca -> 0.6/0.4', () => {
    expect(defaultShiftRatios(['morning', 'evening'])).toEqual([
      { shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 },
    ]);
  });
  it('3 ca -> 0.6/0.4/0', () => {
    expect(defaultShiftRatios(['morning', 'evening', 'night'])).toEqual([
      { shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }, { shiftCode: 'night', pct: 0 },
    ]);
  });
  it('1 ca -> 1', () => {
    expect(defaultShiftRatios(['morning'])).toEqual([{ shiftCode: 'morning', pct: 1 }]);
  });
  it('0 ca -> []', () => {
    expect(defaultShiftRatios([])).toEqual([]);
  });
});

describe('resolveShiftRatios', () => {
  it('rong -> mac dinh', () => {
    expect(resolveShiftRatios(['morning', 'evening'], [])).toEqual([
      { shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 },
    ]);
  });
  it('co {morning:0.7} -> morning 0.7, evening 0', () => {
    expect(resolveShiftRatios(['morning', 'evening'], [{ shiftCode: 'morning', pct: 0.7 }])).toEqual([
      { shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'evening', pct: 0 },
    ]);
  });
  it('bo dong ca la (khong co trong shiftCodes)', () => {
    expect(resolveShiftRatios(['morning'], [{ shiftCode: 'morning', pct: 1 }, { shiftCode: 'afternoon', pct: 0 }])).toEqual([
      { shiftCode: 'morning', pct: 1 },
    ]);
  });
});

function input(over: Partial<ManpowerPlanInput> = {}): ManpowerPlanInput {
  return {
    ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
    months: [{ yearMonth: '2026-09', cells: [
      { shiftCode: 'morning', planned: 270, isManual: false }, { shiftCode: 'evening', planned: 180, isManual: false },
    ] }],
    ...over,
  };
}

describe('validateManpowerPlan', () => {
  const ACTIVE = ['morning', 'evening'];

  it('du lieu hop le -> ok', () => {
    expect(validateManpowerPlan(input(), ACTIVE).ok).toBe(true);
  });

  it('ratio thieu ca -> shifts', () => {
    const r = validateManpowerPlan(input({ ratios: [{ shiftCode: 'morning', pct: 1 }] }), ACTIVE);
    expect(r.errors.ratio).toBe('shifts');
  });

  it('0.6 + 0.5 -> sum', () => {
    const r = validateManpowerPlan(input({ ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.5 }] }), ACTIVE);
    expect(r.errors.ratio).toBe('sum');
  });

  it('0.6 + 0.4005 -> ok (trong dung sai)', () => {
    const r = validateManpowerPlan(input({ ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4005 }] }), ACTIVE);
    expect(r.errors.ratio).toBeUndefined();
  });

  it("thang '2026-13' -> yearMonth", () => {
    const r = validateManpowerPlan(input({ months: [{ yearMonth: '2026-13', cells: input().months[0].cells }] }), ACTIVE);
    expect(r.errors.months[0]).toContain('yearMonth');
  });

  it('trung thang -> duplicate', () => {
    const m = input().months[0];
    const r = validateManpowerPlan(input({ months: [m, m] }), ACTIVE);
    expect(r.errors.months[1]).toContain('duplicate');
  });

  it('o thieu ca -> cells', () => {
    const r = validateManpowerPlan(input({ months: [{ yearMonth: '2026-09', cells: [{ shiftCode: 'morning', planned: 270, isManual: false }] }] }), ACTIVE);
    expect(r.errors.months[0]).toContain('cells');
  });

  it('planned -1, 1.5, 100000 -> cells', () => {
    for (const planned of [-1, 1.5, 100000]) {
      const r = validateManpowerPlan(input({ months: [{ yearMonth: '2026-09', cells: [
        { shiftCode: 'morning', planned, isManual: false }, { shiftCode: 'evening', planned: 0, isManual: false },
      ] }] }), ACTIVE);
      expect(r.errors.months[0]).toContain('cells');
    }
  });

  it('61 thang -> tooManyMonths', () => {
    const months = Array.from({ length: MANPOWER_PLAN_MAX_MONTHS + 1 }, (_, i) => ({
      yearMonth: `2020-${String((i % 12) + 1).padStart(2, '0')}`,
      cells: input().months[0].cells,
    }));
    const r = validateManpowerPlan(input({ months }), ACTIVE);
    expect(r.errors.tooManyMonths).toBe(true);
  });
});

describe('manpowerMonthAuditText / ratioAuditText', () => {
  it('dinh dang dung, (m) cho o sua tay', () => {
    expect(manpowerMonthAuditText([
      { shiftCode: 'morning', planned: 270, isManual: false }, { shiftCode: 'evening', planned: 180, isManual: true },
    ])).toBe('morning:270,evening:180(m)');
  });

  it('ratioAuditText lam tron 4 so le', () => {
    expect(ratioAuditText([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }])).toBe('morning:0.6,evening:0.4');
  });
});

describe('monthTotal / resetMonthToRatio / isRatioSumValid', () => {
  it('monthTotal cong dung tong', () => {
    expect(monthTotal([{ planned: 270, isManual: false }, { planned: 180, isManual: true }])).toBe(450);
  });

  it('resetMonthToRatio bo het co sua tay', () => {
    expect(resetMonthToRatio(450, [0.6, 0.4])).toEqual([{ planned: 270, isManual: false }, { planned: 180, isManual: false }]);
  });

  it('isRatioSumValid', () => {
    expect(isRatioSumValid([0.6, 0.4])).toBe(true);
    expect(isRatioSumValid([0.6, 0.5])).toBe(false);
    expect(isRatioSumValid(DEFAULT_SHIFT_RATIO as number[])).toBe(true);
  });

  it('MANPOWER_PLAN_MAX_CELL la hang so duong', () => {
    expect(MANPOWER_PLAN_MAX_CELL).toBeGreaterThan(0);
  });
});
