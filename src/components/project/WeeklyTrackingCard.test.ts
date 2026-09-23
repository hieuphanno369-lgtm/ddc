import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WeeklyTracking } from '@/lib/tracking';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k), { rich: (k: string) => k }),
}));

import { WeeklyTrackingCard } from './WeeklyTrackingCard';

const W: WeeklyTracking = {
  days: ['2026-09-14', '2026-09-15', '2026-09-16'],
  today: '2026-09-16',
  contractors: [{ id: 1, name: 'A', scopeOfWork: 'Lắp dựng' }, { id: 2, name: 'B', scopeOfWork: 'Sơn' }, { id: 3, name: 'C', scopeOfWork: '' }],
  equipments: [{ id: 10, name: 'Cẩu' }, { id: 11, name: 'Hàn' }],
  manpower: [
    { projectId: 1, contractorId: 1, workDate: '2026-09-15', plannedHeadcount: 100, actualHeadcount: 80 },
    { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 96 },
    { projectId: 1, contractorId: 2, workDate: '2026-09-16', plannedHeadcount: 0, actualHeadcount: 5 },
  ],
  equipmentUsage: [
    { projectId: 1, contractorId: 1, equipmentId: 10, workDate: '2026-09-16', qtyPlanned: 2, qtyActual: 2 },
    { projectId: 1, contractorId: 2, equipmentId: 10, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
    { projectId: 1, contractorId: 1, equipmentId: 11, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 0 },
    { projectId: 1, contractorId: 1, equipmentId: 11, workDate: '2026-09-15', qtyPlanned: 1, qtyActual: 1 },
  ],
};

describe('WeeklyTrackingCard', () => {
  it('tab "Nhat ky theo ngay" mac dinh: 3 dayhead, chip hom nay, ngay trong, nut tab dang chon', () => {
    const out = renderToStaticMarkup(React.createElement(WeeklyTrackingCard, { data: W, locale: 'vi' }));
    expect([...out.matchAll(/class="dayhead"/g)]).toHaveLength(3);
    expect(out).toContain('class="chip c-info">common.today');
    expect(out).toContain('detail.track.noDataDay');
    expect(out).toContain('<button type="button" class="on">detail.track.tabLog</button>');
  });
});
