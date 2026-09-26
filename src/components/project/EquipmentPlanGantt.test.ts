import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlanGantt } from '@/lib/equipment-gantt-v2';
import type { EquipmentPlanSegment, EquipmentQuota } from '@/lib/p3c-contract';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { EquipmentPlanGantt } from './EquipmentPlanGantt';

function seg(over: Partial<EquipmentPlanSegment>): EquipmentPlanSegment {
  return { id: 1, equipmentId: 1, equipmentName: 'Cẩu 1250t', from: '2026-09-01', to: '2026-09-10', qty: 1, ...over };
}

function render(model: NonNullable<ReturnType<typeof buildPlanGantt>>) {
  return renderToStaticMarkup(React.createElement(EquipmentPlanGantt, { model }));
}

describe('EquipmentPlanGantt - ke hoach ngan (truc tuan)', () => {
  const segments: EquipmentPlanSegment[] = [
    seg({ id: 1, from: '2026-09-01', to: '2026-09-20', qty: 2 }),
    seg({ id: 2, from: '2026-09-15', to: '2026-09-30', qty: 1 }),
    seg({ id: 3, from: '2026-09-21', to: '2026-09-30', qty: 1 }),
  ];
  const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cẩu 1250t', totalQty: 3 }];
  const model = buildPlanGantt(segments, quotas, '2026-09-16')!;
  const out = render(model);

  it('chua ten hang, nhan tick tuan, nhan SL dot, cot SL nay/tong, marker hom nay', () => {
    expect(out).toContain('Cẩu 1250t');
    expect(out).toContain('31/08');
    expect(out).toContain('equipmentPlanGantt.qty|2');
    expect(out).toContain('3/3');
    expect(out).toContain('equipmentPlanGantt.today|16.09');
  });
});

describe('EquipmentPlanGantt - ke hoach dai (truc thang)', () => {
  const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-07-01', to: '2026-12-31', qty: 1 })];
  const model = buildPlanGantt(segments, [], '2026-09-16')!;
  const out = render(model);

  it('chua nhan thang MM.YYYY, khong chua nhan tuan dd/mm cua thang do', () => {
    expect(out).toContain('07.2026');
    expect(out).not.toContain('06/07');
  });
});

describe('EquipmentPlanGantt - chong dot (nhieu lane)', () => {
  const segments: EquipmentPlanSegment[] = [
    seg({ id: 1, from: '2026-09-01', to: '2026-09-20', qty: 2 }),
    seg({ id: 2, from: '2026-09-15', to: '2026-09-30', qty: 1 }),
    seg({ id: 3, from: '2026-09-21', to: '2026-09-30', qty: 1 }),
  ];
  // Hom nay ngoai truc -> khong co pill/rect them, de dem <rect> chi tinh thanh dot.
  const model = buildPlanGantt(segments, [], '2027-01-05')!;
  const out = render(model);

  it('so <rect> thanh = so dot; 2 thanh chong co y khac nhau', () => {
    const bars = [...out.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="16"/g)];
    expect(bars).toHaveLength(3);
    const ys = new Set(bars.map((m) => m[1]));
    expect(ys.size).toBeGreaterThanOrEqual(2);
  });

  it('hom nay ngoai truc -> khong co marker hom nay', () => {
    expect(out).not.toContain('equipmentPlanGantt.today');
  });
});

describe('EquipmentPlanGantt - quota khong co dot', () => {
  const segments: EquipmentPlanSegment[] = [seg({ id: 1, equipmentId: 1 })];
  const quotas: EquipmentQuota[] = [{ equipmentId: 9, equipmentName: 'Xe cẩu bánh lốp', totalQty: 5 }];
  const model = buildPlanGantt(segments, quotas, '2026-09-05')!;
  const out = render(model);

  it('co ten hang + cot SL 0/5', () => {
    expect(out).toContain('Xe cẩu bánh lốp');
    expect(out).toContain('0/5');
  });
});

describe('EquipmentPlanGantt - 390px cuon ngang', () => {
  const segments: EquipmentPlanSegment[] = [seg({ id: 1 })];
  const model = buildPlanGantt(segments, [], '2026-09-05')!;
  const out = render(model);

  it('markup chua overflow-x:auto va min-width:720px', () => {
    expect(out).toContain('overflow-x:auto');
    expect(out).toContain('min-width:720px');
  });

  it('khong chua tip/legend/unplanned cua Gantt cu', () => {
    expect(out).not.toContain('equipmentGantt.tipUsedDays');
    expect(out).not.toContain('legendUsed');
    expect(out).not.toContain('unplanned');
  });
});

describe('EquipmentPlanGantt - khong dung gach dai (luat chu du an)', () => {
  const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-09-01', to: '2026-09-20', qty: 2 })];
  const model = buildPlanGantt(segments, [], '2026-09-05')!;
  const out = render(model);

  it('dong ngay va o SL khi chua co Tong SL dung gach thuong, khong co U+2013/U+2014', () => {
    expect(out).not.toMatch(/[\u2013\u2014]/);
    expect(out).toContain('/-');
    expect(out).toContain('01/09/26 - 20/09/26');
  });
});
