import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlanGantt } from '@/lib/equipment-gantt-v2';
import type { EquipmentPlanSegment, EquipmentQuota } from '@/server/repo/types';

/**
 * Test doc lap (Tester) cho EquipmentPlanGantt - Buoc 11.
 * Bo sung EquipmentPlanGantt.test.ts (coder): tap trung do TOA DO PIXEL that cua SVG
 * (khong chi kiem noi dung chuoi) de bat loi de nhau ma test noi dung khong thay duoc.
 */

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { EquipmentPlanGantt } from './EquipmentPlanGantt';

function seg(over: Partial<EquipmentPlanSegment>): EquipmentPlanSegment {
  return { id: 1, equipmentId: 1, equipmentName: 'Cẩu bánh xích', from: '2026-07-06', to: '2026-11-29', qty: 1, ...over };
}

function render(model: NonNullable<ReturnType<typeof buildPlanGantt>>) {
  return renderToStaticMarkup(React.createElement(EquipmentPlanGantt, { model }));
}

/** Doc x, y, textAnchor cua 1 <text> khop noi dung (thu tu thuoc tinh bat ky). */
function textAttrs(svg: string, content: string): { x: number; y: number; anchor: string } {
  const re = new RegExp(`<text([^>]*)>\\s*${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const m = svg.match(re);
  if (!m) throw new Error(`khong tim thay <text> chua "${content}"`);
  const attr = (n: string) => m[1].match(new RegExp(`\\s${n}="([^"]+)"`))?.[1];
  return { x: Number(attr('x')), y: Number(attr('y')), anchor: attr('text-anchor') ?? 'start' };
}

/** Mep trai/phai cua chu theo textAnchor (width = do rong uoc luong). */
function extent(x: number, anchor: string, width: number): { left: number; right: number } {
  if (anchor === 'middle') return { left: x - width / 2, right: x + width / 2 };
  if (anchor === 'end') return { left: x - width, right: x };
  return { left: x, right: x + width };
}

describe('EquipmentPlanGantt - duong chay thuan loi (seed du an 1 that)', () => {
  const segments: EquipmentPlanSegment[] = [
    seg({ id: 1, equipmentId: 1, from: '2026-07-06', to: '2026-08-30', qty: 1 }),
    seg({ id: 2, equipmentId: 1, from: '2026-08-31', to: '2026-11-29', qty: 3 }),
  ];
  const quotas: EquipmentQuota[] = [{ equipmentId: 1, equipmentName: 'Cẩu bánh xích', totalQty: 3 }];
  const model = buildPlanGantt(segments, quotas, '2026-09-16')!;
  const out = render(model);

  it('ve dung 2 thanh, dung ten hang, dung cot SL nay/tong', () => {
    expect(out).toContain('Cẩu bánh xích');
    expect(out).toContain('equipmentPlanGantt.qty|1');
    expect(out).toContain('equipmentPlanGantt.qty|3');
    // hom nay (2026-09-16) roi vao dot 2 (08-31..11-29, qty 3) -> SL nay = 3, tong quota = 3.
    expect(out).toContain('3/3');
  });
});

describe('EquipmentPlanGantt - truong hop bien: hom nay dung ngay cuoi ke hoach', () => {
  it('today = spanTo -> qtyNow tinh ca ngay cuoi, todayInRange true', () => {
    const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-07-06', to: '2026-09-16', qty: 4 })];
    const model = buildPlanGantt(segments, [], '2026-09-16')!;
    expect(model.todayInRange).toBe(true);
    const out = render(model);
    expect(out).toContain('equipmentPlanGantt.today|16.09');
  });
});

describe('EquipmentPlanGantt - BUG-A (da sua): header "SL nay/tong" khong de len nhan tick truc dau tien', () => {
  // Tai hien dung du lieu seed du an 1 that: truc thang luon bat dau tu mung 1 (axis.from), tick dau
  // tien luon trung mep trai vung ve (ML). Truoc khi sua: header tam 228, tick tam 266 (textAnchor
  // middle) -> 2 chu de nhau ("SL nay/tổ07.2026", anh .bangiao/anh-test/p3c-a-b11-eqgantt-1440.png).
  // Do theo MEP chu that (co tinh textAnchor), khong chi tam: mep phai header + 6px <= mep trai tick.
  const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-07-06', to: '2026-11-29', qty: 1 })];
  const model = buildPlanGantt(segments, [], '2026-09-16')!;
  expect(model.axis.mode).toBe('month');
  const out = render(model);

  it.each([
    ['vi', 'SL nay/tổng'],
    ['en', 'Qty now/total'],
  ])('%s: mep phai "%s" (bold 10px) cach mep trai tick dau >= 6px', (_loc, headerText) => {
    const h = textAttrs(out, 'equipmentPlanGantt.colQty');
    const tk = textAttrs(out, model.axis.ticks[0].label);
    const headerRight = extent(h.x, h.anchor, headerText.length * 10 * 0.62).right;
    const tickLeft = extent(tk.x, tk.anchor, model.axis.ticks[0].label.length * 10.5 * 0.62).left;
    expect(tickLeft - headerRight).toBeGreaterThanOrEqual(6);
  });

  it('nhan tick nam duoi nhan "Hom nay" (pill y 2..18): dinh chu tick > 18', () => {
    const tk = textAttrs(out, model.axis.ticks[0].label);
    expect(tk.y - 10.5 * 0.8).toBeGreaterThan(18);
  });
});

describe('EquipmentPlanGantt - truong hop bien: 390px van co du lieu cuon ngang (khong lien quan bug tren)', () => {
  it('markup luon co overflow-x:auto du bao nhieu hang', () => {
    const segments: EquipmentPlanSegment[] = [
      seg({ id: 1, equipmentId: 1 }),
      seg({ id: 2, equipmentId: 2, equipmentName: 'Xe nâng người' }),
    ];
    const model = buildPlanGantt(segments, [], '2026-09-16')!;
    const out = render(model);
    expect(out).toContain('overflow-x:auto');
  });
});

describe('EquipmentPlanGantt - CS-1 reviewer: moi cap nhan tick lien ke dang hien khong de nhau', () => {
  // Do theo MEP chu (co tinh textAnchor), uoc luong 0.62 em nhu test header. Truoc khi sua, tick dau
  // neo trai (x = ML + 4, anchor start) de len tick 2 (anchor middle) voi ke hoach 12 thang / truc tuan.
  function visibleTickGaps(model: NonNullable<ReturnType<typeof buildPlanGantt>>): number[] {
    const out = render(model);
    const step = model.axis.labelStep;
    const shown = model.axis.ticks.filter((_, i) => i % step === 0);
    const boxes = shown.map((tk) => {
      const a = textAttrs(out, tk.label);
      return extent(a.x, a.anchor, tk.label.length * 10.5 * 0.62);
    });
    return boxes.slice(1).map((b, i) => b.left - boxes[i].right);
  }

  it.each([
    ['truc thang 12 thang', '2026-01-05', '2026-12-20'],
    ['truc thang 24 thang (step 2)', '2026-01-05', '2027-12-20'],
    ['truc tuan 92 ngay', '2026-03-02', '2026-06-01'],
  ])('%s: moi khoang ho >= 4px', (_name, from, to) => {
    const model = buildPlanGantt([seg({ id: 1, from, to, qty: 1 })], [], from)!;
    const gaps = visibleTickGaps(model);
    expect(gaps.length).toBeGreaterThan(3);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(4);
  });

  it('moi nhan tick deu can giua vach luoi (dong nhat, khong neo trai rieng tick dau)', () => {
    const model = buildPlanGantt([seg({ id: 1, from: '2026-01-05', to: '2026-12-20', qty: 1 })], [], '2026-01-05')!;
    const out = render(model);
    expect(textAttrs(out, model.axis.ticks[0].label).anchor).toBe('middle');
  });
});
