import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Equipment, ProjectEquipmentPlan, ProjectWorkItem } from '@/server/repo/types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-entry', () => ({ saveEquipmentPlansAction: vi.fn() }));

import { EquipmentPlanEditor } from './EquipmentPlanEditor';

const EQUIPMENTS: Equipment[] = [{ id: 1, name: 'Cẩu bánh xích', unit: 'cái', isActive: true }];
const WORK_ITEMS: ProjectWorkItem[] = [{ id: 1, projectId: 1, name: 'Hệ cột chính', sortOrder: 1 }];
const PLAN: ProjectEquipmentPlan = {
  id: 1, projectId: 1, equipmentId: 1, unitNo: 1, qty: 1, workItemId: 1,
  plannedStart: '2026-09-01', plannedFinish: '2026-09-10', note: '', updatedAt: '', updatedBy: '',
};

describe('EquipmentPlanEditor', () => {
  it('render 1 plan -> co select thiet bi + equipmentPlan.count', () => {
    const out = renderToStaticMarkup(
      React.createElement(EquipmentPlanEditor, { projectId: 1, plans: [PLAN], equipments: EQUIPMENTS, workItems: WORK_ITEMS }),
    );
    expect(out).toContain('<select');
    expect(out).toContain('equipmentPlan.count');
  });

  it('equipments rong -> equipmentPlan.noEquipment', () => {
    const out = renderToStaticMarkup(
      React.createElement(EquipmentPlanEditor, { projectId: 1, plans: [], equipments: [], workItems: [] }),
    );
    expect(out).toContain('equipmentPlan.noEquipment');
  });
});
