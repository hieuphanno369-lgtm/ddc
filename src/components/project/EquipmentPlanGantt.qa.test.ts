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

/** Doc x + do rong uoc luong (fontSize * 0.6 * so ky tu / 2, tuong tu cach trinh duyet do chu SVG textAnchor=middle) tu 1 <text> khop noi dung. */
function textCenterX(svg: string, content: string): number {
  const re = new RegExp(`<text x="([\\d.]+)"[^>]*>\\s*${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const m = svg.match(re);
  if (!m) throw new Error(`khong tim thay <text> chua "${content}"`);
  return Number(m[1]);
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

describe('EquipmentPlanGantt - BUG tim thay (PHAI THAT BAI): header "SL nay/tong" de len nhan tick truc dau tien', () => {
  // Tai hien dung du lieu seed du an 1 that (xem equipment-plan-gantt-queries.qa.test.ts):
  // truc thang luon bat dau tu mung 1 (axis.from), va tick dau tien (xOf ap dung cho axis.from)
  // LUON co toa do x bang chinh xac toa do trai cua vung ve (ML = NAME_W + QTY_W = 266), TRUNG
  // vung ma cot header "SL nay/tong" (x tam = NAME_W + QTY_W/2 = 228, chu roi rong ~60px) chiem
  // giu. Anh chup thuc te: .bangiao/anh-test/p3c-a-b11-eqgantt-1440.png (dong dau bang, chu
  // "SL nay/tổ07.2026" bi de nhau, xem crop-test5 trong bao cao).
  const segments: EquipmentPlanSegment[] = [seg({ id: 1, from: '2026-07-06', to: '2026-11-29', qty: 1 })];
  const model = buildPlanGantt(segments, [], '2026-09-16')!;
  expect(model.axis.mode).toBe('month');
  const out = render(model);

  it('khoang cach tam 2 chu (header cot SL vs nhan tick dau tien) phai >= 60px de khong de nhau - CODE HIEN TAI CHI CO 38px', () => {
    const headerX = textCenterX(out, 'equipmentPlanGantt.colQty');
    const firstTickLabel = model.axis.ticks[0].label; // vd '07.2026'
    const tickX = textCenterX(out, firstTickLabel);
    const gap = Math.abs(tickX - headerX);
    // Ky vong DUNG (san pham phai dat): gap >= 60 (nua do rong "SL nay/tong" + nua do rong "MM.YYYY").
    // Thuc te code hien tai: headerX=228, tickX=266 (= ML), gap chi 38 -> test nay THAT BAI,
    // chung minh bug de nhau la co that, khong phai loi doc anh.
    expect(gap).toBeGreaterThanOrEqual(60);
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
