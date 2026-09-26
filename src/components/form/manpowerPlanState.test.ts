import { describe, expect, it } from 'vitest';
import {
  addMonth, initPlanState, parsePcts, removeMonth, resetRow, setCell, setPct, setTotal, toPlanInput,
} from './manpowerPlanState';
import type { ManpowerPlanMonthRow, Shift, ShiftRatio } from '@/server/repo/types';

const SHIFTS: Shift[] = [
  { code: 'morning', nameVi: 'Ca sáng', nameEn: 'Morning', sortOrder: 1, isActive: true },
  { code: 'evening', nameVi: 'Ca tối', nameEn: 'Evening', sortOrder: 2, isActive: true },
];
const RATIOS: ShiftRatio[] = [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }];

const TOTALS = [450, 700, 800, 900, 800, 650, 400];
const MONTHS_YM = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
const MORNING = [270, 420, 480, 540, 480, 390, 240];
const EVENING = [180, 280, 320, 360, 320, 260, 160];

function seedMonths(): ManpowerPlanMonthRow[] {
  const rows: ManpowerPlanMonthRow[] = [];
  MONTHS_YM.forEach((ym, i) => {
    rows.push({ yearMonth: ym, shiftCode: 'morning', planned: MORNING[i], isManual: false });
    rows.push({ yearMonth: ym, shiftCode: 'evening', planned: EVENING[i], isManual: false });
  });
  return rows;
}

describe('initPlanState', () => {
  it('7 thang, pctInputs [60,40], dong 1 totalInput 450', () => {
    const s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    expect(s.rows).toHaveLength(7);
    expect(s.pctInputs).toEqual(['60', '40']);
    expect(s.rows[0].totalInput).toBe('450');
    expect(s.rows[0].yearMonth).toBe('2026-06');
  });
});

describe('setTotal / setCell', () => {
  it('setTotal(row0,1000) -> cells 600/400 khong manual', () => {
    let s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    s = setTotal(s, 0, '1000');
    expect(s.rows[0].cells).toEqual([{ planned: 600, isManual: false }, { planned: 400, isManual: false }]);
    expect(s.rows[0].totalInput).toBe('1000');
    expect(s.rows[0].error).toBeNull();
  });

  it('setCell(row0,0,300) -> o0 manual 300, o1 giu 180, totalInput 480; setTotal(1000) -> o0 300 o1 700; setTotal(200) -> below_manual', () => {
    let s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    s = setCell(s, 0, 0, '300');
    expect(s.rows[0].cells).toEqual([{ planned: 300, isManual: true }, { planned: 180, isManual: false }]);
    expect(s.rows[0].totalInput).toBe('480');

    s = setTotal(s, 0, '1000');
    expect(s.rows[0].cells).toEqual([{ planned: 300, isManual: true }, { planned: 700, isManual: false }]);

    const before = s.rows[0].cells;
    s = setTotal(s, 0, '200');
    expect(s.rows[0].error).toBe('below_manual');
    expect(s.rows[0].cells).toEqual(before);
    expect(toPlanInput(s)).toBeNull();
  });

  it('setCell gia tri am hoac le -> state khong doi', () => {
    let s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    const before = s;
    s = setCell(s, 0, 0, '-1');
    expect(s).toEqual(before);
    s = setCell(s, 0, 0, '1.5');
    expect(s).toEqual(before);
  });
});

describe('setPct', () => {
  it('setPct(0,70) -> tong 110, parsePcts null, cells khong doi; setPct(1,30) -> chia lai 70/30, giu o manual', () => {
    let s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    s = setCell(s, 0, 0, '300'); // dong 0 co o manual
    const cellsBefore = s.rows.map((r) => r.cells);

    s = setPct(s, 0, '70');
    expect(parsePcts(s.pctInputs)).toBeNull();
    expect(s.rows.map((r) => r.cells)).toEqual(cellsBefore);

    s = setPct(s, 1, '30');
    expect(parsePcts(s.pctInputs)).toEqual([0.7, 0.3]);
    // dong 0: manual 300 giu nguyen, tong van 480 (khong-manual nhan het phan con lai 180)
    expect(s.rows[0].cells[0]).toEqual({ planned: 300, isManual: true });
    expect(s.rows[0].cells[0].planned + s.rows[0].cells[1].planned).toBe(480);
    // dong khong manual: tong thang giu nguyen, chia lai theo 70/30
    const total1 = TOTALS[1];
    expect(s.rows[1].cells[0].planned + s.rows[1].cells[1].planned).toBe(total1);
  });
});

describe('resetRow', () => {
  it('bo het cờ sua tay, chia lai theo ty le', () => {
    let s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    s = setCell(s, 0, 0, '300');
    expect(s.rows[0].cells.some((c) => c.isManual)).toBe(true);
    s = resetRow(s, 0);
    expect(s.rows[0].cells.every((c) => !c.isManual)).toBe(true);
    // totalInput dang la '480' (300 manual + 180 cu) - resetRow dung so trong totalInput, khong phai 450 goc.
    expect(s.rows[0].cells[0].planned + s.rows[0].cells[1].planned).toBe(480);
  });
});

describe('addMonth / removeMonth', () => {
  it("addMonth('2026-06') tren seed -> duplicate", () => {
    const s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    expect(addMonth(s, '2026-06')).toBe('duplicate');
  });

  it("addMonth('2027-01') -> them cuoi", () => {
    const s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    const r = addMonth(s, '2027-01');
    expect(typeof r).not.toBe('string');
    if (typeof r !== 'string') {
      expect(r.rows[r.rows.length - 1].yearMonth).toBe('2027-01');
      expect(r.rows).toHaveLength(8);
    }
  });

  it("addMonth('2026-05') -> chen dau", () => {
    const s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    const r = addMonth(s, '2026-05');
    if (typeof r !== 'string') expect(r.rows[0].yearMonth).toBe('2026-05');
  });

  it("addMonth('2026-13') -> invalid", () => {
    const s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    expect(addMonth(s, '2026-13')).toBe('invalid');
  });

  it('60 dong -> too_many', () => {
    let s = initPlanState(SHIFTS, [], RATIOS);
    for (let i = 0; i < 60; i++) {
      const ym = `2020-${String((i % 12) + 1).padStart(2, '0')}-${i}`.slice(0, 7); // gia lap 60 thang khac nhau qua nam
      const r = addMonth(s, `20${20 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
      if (typeof r === 'string') { expect(r).toBe('too_many'); return; }
      s = r;
    }
    const r = addMonth(s, '2030-01');
    expect(r).toBe('too_many');
  });

  it('removeMonth xoa dung dong', () => {
    let s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    s = removeMonth(s, 0);
    expect(s.rows).toHaveLength(6);
    expect(s.rows[0].yearMonth).toBe('2026-07');
  });
});

describe('toPlanInput', () => {
  it('hop le -> ratios 0.6/0.4, months[0].cells dung thu tu ca', () => {
    const s = initPlanState(SHIFTS, seedMonths(), RATIOS);
    const input = toPlanInput(s);
    expect(input).not.toBeNull();
    expect(input!.ratios).toEqual([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }]);
    expect(input!.months[0]).toEqual({
      yearMonth: '2026-06',
      cells: [{ shiftCode: 'morning', planned: 270, isManual: false }, { shiftCode: 'evening', planned: 180, isManual: false }],
    });
  });
});
