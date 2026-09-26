import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Equipment, EquipmentPlanSegment, EquipmentQuota } from '@/server/repo/types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'vi',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-entry', () => ({ saveEquipmentPlansAction: vi.fn() }));

import { EquipmentPlanEditor } from './EquipmentPlanEditor';

const EQUIPMENTS: Equipment[] = [{ id: 1, name: 'Cẩu bánh xích', unit: 'cái', isActive: true }];

function render(props: { quotas: EquipmentQuota[]; segments: EquipmentPlanSegment[]; equipments: Equipment[] }) {
  return renderToStaticMarkup(React.createElement(EquipmentPlanEditor, { projectId: 1, ...props }));
}

describe('EquipmentPlanEditor', () => {
  it('1 quota + 2 dot -> co select, 2 o date moi dot, count groups:1 segments:2', () => {
    const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cẩu bánh xích', totalQty: 3 }];
    const segments: EquipmentPlanSegment[] = [
      { id: 1, equipmentId: 1, equipmentName: 'Cẩu bánh xích', from: '2026-09-01', to: '2026-09-10', qty: 2 },
      { id: 2, equipmentId: 1, equipmentName: 'Cẩu bánh xích', from: '2026-09-11', to: '2026-09-20', qty: 1 },
    ];
    const out = render({ quotas, segments, equipments: EQUIPMENTS });
    expect(out).toContain('<select');
    expect((out.match(/type="date"/g) ?? []).length).toBe(4);
    expect(out).toContain('equipmentPlan.count:{&quot;groups&quot;:1,&quot;segments&quot;:2}');
  });

  it('quota khong dot -> equipmentPlan.noSegment', () => {
    const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cẩu bánh xích', totalQty: 3 }];
    const out = render({ quotas, segments: [], equipments: EQUIPMENTS });
    expect(out).toContain('equipmentPlan.noSegment');
  });

  it('equipments rong + quotas rong -> equipmentPlan.noEquipment', () => {
    const out = render({ quotas: [], segments: [], equipments: [] });
    expect(out).toContain('equipmentPlan.noEquipment');
  });

  it('quota cua thiet bi khong co trong equipments -> hien equipmentName + equipmentPlan.inactive', () => {
    const quotas: EquipmentQuota[] = [{ equipmentId: 99, equipmentName: 'May cu', totalQty: 1 }];
    const out = render({ quotas, segments: [], equipments: EQUIPMENTS });
    expect(out).toContain('May cu');
    expect(out).toContain('equipmentPlan.inactive');
  });
});
