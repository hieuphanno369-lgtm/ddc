import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { legacyEquipmentPlanFixture, equipments, workItemNames } from '@/data/seed/erp';
import { buildGantt } from '@/lib/equipment-gantt';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { EquipmentGantt } from './EquipmentGantt';

const SEED_WORK_ITEMS = workItemNames.map((name, i) => ({ id: i + 1, name, sortOrder: i + 1 }));

describe('EquipmentGantt', () => {
  it('render du 5 nhan hang + it nhat 1 rangeLabel', () => {
    const model = buildGantt({ plans: legacyEquipmentPlanFixture, usage: [], equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: 'Chưa gán' })!;
    const out = renderToStaticMarkup(React.createElement(EquipmentGantt, { model }));
    for (const row of model.rows) expect(out).toContain(row.label);
    const hasRangeLabel = model.rows.some((r) => r.bars.some((b) => out.includes(b.rangeLabel)));
    expect(hasRangeLabel).toBe(true);
  });

  it('unplannedUsage > 0 -> hien dong hintline', () => {
    const model = buildGantt({
      plans: [{ id: 1, projectId: 1, equipmentId: 1, unitNo: 1, qty: 1, workItemId: 1, plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '', updatedAt: '2026-09-01T00:00:00Z', updatedBy: 'system' }],
      usage: [{ equipmentId: 1, workDate: '2026-09-15', qtyActual: 2 }],
      equipments, workItems: SEED_WORK_ITEMS, noWorkItemName: 'Chưa gán',
    })!;
    const out = renderToStaticMarkup(React.createElement(EquipmentGantt, { model }));
    expect(out).toContain('equipmentGantt.unplanned|2');
  });
});
