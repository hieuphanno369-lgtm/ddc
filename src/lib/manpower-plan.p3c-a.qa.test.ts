import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHIFT_RATIO,
  MANPOWER_PLAN_MAX_MONTHS,
  RATIO_SUM_TOLERANCE,
  defaultShiftRatios,
  isRatioSumValid,
  manpowerMonthAuditText,
  monthTotal,
  ratioAuditText,
  recomputeMonth,
  resetMonthToRatio,
  resolveShiftRatios,
  splitTotal,
  validateManpowerPlan,
  type PlanCell,
} from '@/lib/manpower-plan';
import type { ManpowerPlanInput } from '@/server/repo/types';

/**
 * Kiem thu doc lap (Tester) cho T5 - chia ca lam tron, ca cuoi nhan phan du, o sua tay khong bi
 * ghi de, tong ty le = 1 (+-0.001). Tach khoi test cua coder (`manpower-plan.test.ts`).
 */
describe('T5 - splitTotal: duong chay thuan loi + bien tu ke hoach', () => {
  it.each([
    [450, [0.6, 0.4], [270, 180]],
    [700, [0.6, 0.4], [420, 280]],
    [800, [0.6, 0.4], [480, 320]],
    [900, [0.6, 0.4], [540, 360]],
    [650, [0.6, 0.4], [390, 260]],
    [400, [0.6, 0.4], [240, 160]],
    [7, [0.6, 0.4], [4, 3]],
    [5, [0.5, 0.5], [3, 2]],
    [1, [0.5, 0.5, 0], [1, 0, 0]],
    [0, [0.6, 0.4], [0, 0]],
    [10, [1], [10]],
  ])('splitTotal(%i, %j) -> %j', (total, pcts, expected) => {
    expect(splitTotal(total, pcts)).toEqual(expected);
  });

  it('tong cac ca luon bang total voi 50 bo ngau nhien (seed co dinh, khong flaky)', () => {
    // LCG don gian, seed co dinh -> ket qua lap lai giua cac lan chay.
    let state = 42;
    const rand = () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
    for (let i = 0; i < 50; i++) {
      const total = Math.floor(rand() * 2000);
      const n = 1 + Math.floor(rand() * 4);
      const raw = Array.from({ length: n }, () => rand());
      const sum = raw.reduce((s, x) => s + x, 0) || 1;
      const pcts = raw.map((x) => x / sum);
      const parts = splitTotal(total, pcts);
      expect(parts.reduce((s, x) => s + x, 0)).toBe(total);
      expect(parts.every((x) => x >= 0)).toBe(true);
    }
  });
});

describe('T5 - recomputeMonth: o sua tay khong bi ghi de khi doi Tong/ty le', () => {
  it('1 o manual, doi total -> o manual GIU nguyen, phan con lai chia cho o khong-manual', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 0, isManual: false }];
    const r = recomputeMonth(1000, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: true, cells: [{ planned: 300, isManual: true }, { planned: 700, isManual: false }] });
  });

  it('khong o nao manual -> chia het theo ty le', () => {
    const cells: PlanCell[] = [{ planned: 0, isManual: false }, { planned: 0, isManual: false }];
    const r = recomputeMonth(1000, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: true, cells: [{ planned: 600, isManual: false }, { planned: 400, isManual: false }] });
  });

  it('Tong < tong cac o da sua tay -> below_manual, KHONG duoc tra ok:true', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 0, isManual: false }];
    const r = recomputeMonth(200, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: false, reason: 'below_manual' });
  });

  it('mọi o deu manual va Tong dung bang tong manual -> ok, giu nguyen', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 200, isManual: true }];
    const r = recomputeMonth(500, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: true, cells });
  });

  it('mọi o deu manual nhung Tong khac tong manual -> all_manual (khong tu suy dien duoc)', () => {
    const cells: PlanCell[] = [{ planned: 300, isManual: true }, { planned: 200, isManual: true }];
    const r = recomputeMonth(600, cells, [0.6, 0.4]);
    expect(r).toEqual({ ok: false, reason: 'all_manual' });
  });

  it('3 ca, ca 1 manual, ty le [0.6,0.4,0] -> phan con lai don het vao ca 2 (ca 3 co ty le 0)', () => {
    const cells: PlanCell[] = [{ planned: 100, isManual: true }, { planned: 0, isManual: false }, { planned: 0, isManual: false }];
    const r = recomputeMonth(1000, cells, [0.6, 0.4, 0]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cells[0]).toEqual({ planned: 100, isManual: true });
      expect(r.cells[1].planned).toBe(900);
      expect(r.cells[2].planned).toBe(0);
      expect(monthTotal(r.cells)).toBe(1000);
    }
  });
});

describe('T5 - resetMonthToRatio: nut "tinh lai theo ty le" bo het co sua tay', () => {
  it('tra ve cells moi, isManual = false, chia dung theo pcts', () => {
    const cells = resetMonthToRatio(450, [0.6, 0.4]);
    expect(cells).toEqual([{ planned: 270, isManual: false }, { planned: 180, isManual: false }]);
  });
});

describe('T5 - isRatioSumValid: dung sai +-0.001', () => {
  it('tong dung 1 -> hop le', () => expect(isRatioSumValid([0.6, 0.4])).toBe(true));
  it('lech dung 0.001 (bien tren) -> van hop le', () => expect(isRatioSumValid([0.6, 0.401])).toBe(true));
  it('lech 0.0011 (vuot bien mot chut) -> KHONG hop le', () => expect(isRatioSumValid([0.6, 0.4011])).toBe(false));
  it('0.6 + 0.5 = 1.1 -> khong hop le', () => expect(isRatioSumValid([0.6, 0.5])).toBe(false));
});

describe('T5 - defaultShiftRatios / resolveShiftRatios', () => {
  it('0 ca -> mang rong; 1 ca -> ca do nhan 1; 3 ca -> 0.6/0.4/0', () => {
    expect(defaultShiftRatios([])).toEqual([]);
    expect(defaultShiftRatios(['morning'])).toEqual([{ shiftCode: 'morning', pct: 1 }]);
    expect(defaultShiftRatios(['morning', 'evening', 'night'])).toEqual([
      { shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }, { shiftCode: 'night', pct: 0 },
    ]);
  });

  it('resolveShiftRatios: stored rong -> mac dinh; du an chua co dong tra dung DEFAULT_SHIFT_RATIO', () => {
    expect(resolveShiftRatios(['morning', 'evening'], [])).toEqual([
      { shiftCode: 'morning', pct: DEFAULT_SHIFT_RATIO[0] }, { shiftCode: 'evening', pct: DEFAULT_SHIFT_RATIO[1] },
    ]);
  });

  it('resolveShiftRatios: co dong luu 1 phan -> ca thieu = 0, bo dong ca khong con active', () => {
    const r = resolveShiftRatios(['morning', 'evening'], [{ shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'night', pct: 0.9 }]);
    expect(r).toEqual([{ shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'evening', pct: 0 }]);
  });
});

describe('T5 - validateManpowerPlan: cac loi bat buoc', () => {
  const shifts = ['morning', 'evening'];
  const baseInput = (over: Partial<ManpowerPlanInput> = {}): ManpowerPlanInput => ({
    ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
    months: [{ yearMonth: '2026-09', cells: [{ shiftCode: 'morning', planned: 540, isManual: false }, { shiftCode: 'evening', planned: 360, isManual: false }] }],
    ...over,
  });

  it('duong chay thuan loi: du lieu dung hop dong -> ok', () => {
    const r = validateManpowerPlan(baseInput(), shifts);
    expect(r.ok).toBe(true);
    expect(r.errors.ratio).toBeUndefined();
    expect(Object.keys(r.errors.months)).toHaveLength(0);
  });

  it('ratio thieu 1 ca -> loi shifts', () => {
    const r = validateManpowerPlan(baseInput({ ratios: [{ shiftCode: 'morning', pct: 1 }] }), shifts);
    expect(r.ok).toBe(false);
    expect(r.errors.ratio).toBe('shifts');
  });

  it('tong ty le 0.6+0.5 -> loi sum', () => {
    const r = validateManpowerPlan(baseInput({ ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.5 }] }), shifts);
    expect(r.errors.ratio).toBe('sum');
  });

  it('thang khong hop le (2026-13) -> loi yearMonth', () => {
    const r = validateManpowerPlan(baseInput({ months: [{ yearMonth: '2026-13', cells: baseInput().months[0].cells }] }), shifts);
    expect(r.errors.months[0]).toContain('yearMonth');
  });

  it('2 thang trung yearMonth -> thang thu 2 bi loi duplicate', () => {
    const m = baseInput().months[0];
    const r = validateManpowerPlan(baseInput({ months: [m, { ...m }] }), shifts);
    expect(r.errors.months[0]).toBeUndefined();
    expect(r.errors.months[1]).toContain('duplicate');
  });

  it('ca la thanh phan LA (khong con active, vd "afternoon" cu) trong cells -> loi cells', () => {
    const r = validateManpowerPlan(
      baseInput({ months: [{ yearMonth: '2026-09', cells: [{ shiftCode: 'morning', planned: 540, isManual: false }, { shiftCode: 'afternoon', planned: 360, isManual: false }] }] }),
      shifts,
    );
    expect(r.errors.months[0]).toContain('cells');
  });

  it('planned am, so thap phan, vuot MANPOWER_PLAN_MAX_CELL -> loi cells', () => {
    for (const bad of [-1, 1.5, 100000]) {
      const r = validateManpowerPlan(
        baseInput({ months: [{ yearMonth: '2026-09', cells: [{ shiftCode: 'morning', planned: bad, isManual: false }, { shiftCode: 'evening', planned: 0, isManual: false }] }] }),
        shifts,
      );
      expect(r.errors.months[0], `planned=${bad}`).toContain('cells');
    }
  });

  it('61 thang -> tooManyMonths (vuot MANPOWER_PLAN_MAX_MONTHS = 60)', () => {
    const m = baseInput().months[0];
    const months = Array.from({ length: MANPOWER_PLAN_MAX_MONTHS + 1 }, (_, i) => ({ ...m, yearMonth: `2026-${String((i % 12) + 1).padStart(2, '0')}`, cells: m.cells }));
    // tranh trung yearMonth de chi kiem rieng co tooManyMonths, khong lan qua duplicate
    const uniqMonths = months.map((mm, i) => ({ ...mm, yearMonth: `20${20 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}` }));
    const r = validateManpowerPlan(baseInput({ months: uniqMonths }), shifts);
    expect(r.errors.tooManyMonths).toBe(true);
  });

  it('thang toan 0 la HOP LE (khong bat buoc lien tuc, khong bat buoc > 0)', () => {
    const r = validateManpowerPlan(
      baseInput({ months: [{ yearMonth: '2026-01', cells: [{ shiftCode: 'morning', planned: 0, isManual: false }, { shiftCode: 'evening', planned: 0, isManual: false }] }] }),
      shifts,
    );
    expect(r.ok).toBe(true);
  });
});

describe('T5 - manpowerMonthAuditText / ratioAuditText: dung chuoi mau', () => {
  it('danh dau (m) cho o sua tay, giu dung thu tu cells truyen vao', () => {
    expect(manpowerMonthAuditText([
      { shiftCode: 'morning', planned: 270, isManual: false },
      { shiftCode: 'evening', planned: 180, isManual: true },
    ])).toBe('morning:270,evening:180(m)');
  });

  it('ratioAuditText lam tron 4 so le', () => {
    expect(ratioAuditText([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.40001234 }]))
      .toBe('morning:0.6,evening:0.4');
  });
});

describe('T5 - truong hop PHAI THAT BAI (negative case bat buoc)', () => {
  it('gui planned la chuoi ep kieu bat thuong (NaN sau khi ep number) phai bi bao loi cells, KHONG duoc coi hop le', () => {
    const r = validateManpowerPlan(
      {
        ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
        months: [{ yearMonth: '2026-09', cells: [{ shiftCode: 'morning', planned: NaN, isManual: false }, { shiftCode: 'evening', planned: 360, isManual: false }] }],
      },
      ['morning', 'evening'],
    );
    expect(r.ok).toBe(false);
    expect(r.errors.months[0]).toContain('cells');
  });
});
