import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ManpowerPlanMonthRow, Shift, ShiftRatio } from '@/server/repo/types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'vi',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-entry', () => ({ saveManpowerPlanAction: vi.fn() }));

import { ManpowerPlanEditor } from './ManpowerPlanEditor';

// Ten ca gia ('Ca A'/'Ca B') de chac chan khong ghi cung ma ca trong code UI/logic.
const SHIFTS: Shift[] = [
  { code: 'morning', nameVi: 'Ca A', nameEn: 'Shift A', sortOrder: 1, isActive: true },
  { code: 'evening', nameVi: 'Ca B', nameEn: 'Shift B', sortOrder: 2, isActive: true },
];
const RATIOS: ShiftRatio[] = [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }];
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

function render(months: ManpowerPlanMonthRow[], shifts: Shift[] = SHIFTS, ratios: ShiftRatio[] = RATIOS) {
  return renderToStaticMarkup(React.createElement(ManpowerPlanEditor, {
    projectId: 1, shifts, months, ratios, today: '2026-09-16',
  }));
}

describe('ManpowerPlanEditor', () => {
  it('seed 7 thang -> 7 nhan thang, ten ca lay tu prop shifts, o ty le value 60', () => {
    const out = render(seedMonths());
    for (const ym of MONTHS_YM) {
      const [y, m] = ym.split('-');
      expect(out).toContain(`${m}/${y}`);
    }
    expect(out).toContain('Ca A');
    expect(out).toContain('Ca B');
    expect(out).toContain('value="60"');
  });

  it('1 o isManual -> markup co data-manual="1" va nut recalc', () => {
    const months = seedMonths();
    months[0] = { ...months[0], planned: 300, isManual: true };
    const out = render(months);
    expect(out).toContain('data-manual="1"');
    expect(out).toContain('manpowerPlan.recalc');
  });

  it('shifts rong -> manpowerPlan.noShift', () => {
    const out = render([], []);
    expect(out).toContain('manpowerPlan.noShift');
  });

  it('P-2: ô thêm tháng là MonthField mm/yyyy (không còn input[type=month] theo ngôn ngữ trình duyệt)', () => {
    const out = render(seedMonths());
    expect(out).not.toContain('type="month"');
    // Tháng gợi ý = tháng sau tháng cuối (12/2026 -> 01/2027), hiện dạng mm/yyyy và gõ được.
    expect(out).toContain('value="01/2027"');
    expect(out).toContain('placeholder="monthField.placeholder"');
    expect(out).toContain('inputMode="numeric"');
  });

  it('P-2: chưa có tháng nào -> ô thêm tháng gợi ý tháng hiện tại (09/2026)', () => {
    expect(render([])).toContain('value="09/2026"');
  });
});
