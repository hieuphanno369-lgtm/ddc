import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KpiCard, type KpiCardProps } from './KpiCard';

// KpiCard.tsx dung JSX ma khong tu import React (dung "react-jsx" runtime cua
// Next.js). Duoi Vitest/esbuild can shim global nay - dung y het cach
// operation-pages-render.test.ts da lam.
(globalThis as unknown as { React: typeof React }).React = React;

/**
 * KpiCard chưa có file test riêng trước đợt redesign Apple Glass (đổi sang
 * class .kpi/.key, xem .bangiao/thay-doi.md mục 3.1). Render tĩnh để khẳng
 * định đúng markup người dùng nhìn thấy (class, text, có/không có icon),
 * không chỉ khẳng định "không throw".
 * Vòng bổ sung P2B (2026-09-24): bỏ tag "Trọng tâm" (prop `heroTagLabel` cũ
 * đã xoá) + thêm prop `scheduleGap` (dòng "Chậm/Nhanh N ngày · ±x,x%").
 */
const DummyIcon = (p: { size?: number; className?: string }) =>
  React.createElement('svg', { 'data-testid': 'dummy-icon', width: p.size });

const BASE: KpiCardProps = {
  label: 'Tổng số dự án',
  value: '17',
  delta: null,
  icon: DummyIcon,
};

describe('KpiCard - the thuong (hero=false, duong chay thuan loi)', () => {
  it('hien dung label/value/icon, khong doi sang the .key va khong co .tag', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, BASE));

    expect(out).toContain('Tổng số dự án');
    expect(out).toContain('>17<');
    expect(out).toContain('data-testid="dummy-icon"');
    expect(out).toContain('class="kpi rise"');
    expect(out).not.toContain('class="tag"');
  });

  it('delta duong: hien mui ten "up" kem gia tri tuyet doi va deltaSuffix', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, delta: 3, deltaSuffix: 'So thang truoc' })
    );

    expect(out).toContain('class="delta up"');
    expect(out).toContain('>3<');
    expect(out).toContain('So thang truoc');
  });

  it('invertDelta=true: delta duong nhung xau (vd so ca cham tien do tang) -> mau "down"', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, delta: 2, invertDelta: true })
    );

    expect(out).toContain('class="delta down"');
  });
});

describe('KpiCard - truong hop bien ke hoach da neu ten (Task 4: khong co delta/sub)', () => {
  it('delta=null va khong co sub: hien dau "-" thay vi o trong', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, delta: null }));

    expect(out).toContain('class="sb"');
    expect(out).toContain('<span>-</span>');
  });

  it('delta=0 (khong doi): coi nhu khong co delta, van hien dau "-"', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, delta: 0 }));

    expect(out).toContain('<span>-</span>');
    expect(out).not.toContain('class="delta');
  });
});

describe('KpiCard - the "Trong tam" (hero=true, Task 4 spec dong 958 ke-hoach.md)', () => {
  it('hero=true: doi sang the .kpi.key, KHONG con tag, KHONG hien icon (vong bo sung P2B: bo tag "Trong tam")', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, hero: true }));

    expect(out).toContain('class="kpi rise key"');
    expect(out).not.toContain('class="tag"');
    expect(out).not.toContain('data-testid="dummy-icon"');
  });

  it('hero=true + tone warn/danger: chu gia tri phai la mau vang --gold, KHONG con trang cung (B-3)', () => {
    const warn = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, tone: 'warn' })
    );
    const danger = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, tone: 'danger' })
    );

    expect(warn).toContain('style="color:var(--gold)"');
    expect(danger).toContain('style="color:var(--gold)"');
  });

  it('hero=true + tone ok/neutral: khong co mau inline (van la chu trang ke thua tu nen gradient)', () => {
    const ok = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, tone: 'ok' })
    );

    expect(ok).not.toContain('style=');
  });
});

describe('KpiCard - scheduleGap (vong bo sung P2B: dong "Cham/Nhanh N ngay · ±x,x%" duoi the %TT)', () => {
  it('direction=behind: hien dong .sb voi mau --gold (du contrast tren nen navy, giong heroAlert)', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, {
        ...BASE,
        hero: true,
        scheduleGap: { text: '▼ Chậm 5 ngày · −3,3%', direction: 'behind' },
      })
    );

    expect(out).toContain('▼ Chậm 5 ngày</span>');
    expect(out).toContain('>−3,3%</span>');
    expect(out).toContain('style="color:var(--gold)"');
  });

  it('direction=ahead: hien dong .sb voi mau xanh (khong phai --gold)', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, {
        ...BASE,
        hero: true,
        scheduleGap: { text: '▲ Nhanh 5 ngày · +3,3%', direction: 'ahead' },
      })
    );

    expect(out).toContain('▲ Nhanh 5 ngày</span>');
    expect(out).toContain('>+3,3%</span>');
    expect(out).toContain('style="color:var(--mint)"');
  });

  it('direction=onTrack: hien dong .sb, khong co mau inline rieng', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, {
        ...BASE,
        hero: true,
        scheduleGap: { text: 'Đúng tiến độ', direction: 'onTrack' },
      })
    );

    expect(out).toContain('Đúng tiến độ');
    expect(out).not.toContain('style="color:');
  });

  it('co scheduleGap, khong sub/delta: khong con dong .sb "-" rong phia tren (chi 1 dong .sb gap)', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, {
        ...BASE,
        hero: true,
        scheduleGap: { text: '▼ Chậm 56 ngày · −19,3%', direction: 'behind' },
      })
    );

    expect(out).not.toContain('<span>-</span>');
    expect(out.match(/class="sb/g)?.length).toBe(1);
    // moi doan nowrap de "−19,3%" khong bi tach khoi dau/don vi khi xuong dong
    expect(out.match(/white-space:nowrap/g)?.length).toBe(2);
  });

  it('co scheduleGap + sub: van giu dong sub, them dong gap ben duoi', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, {
        ...BASE,
        sub: 'Số liệu ngày 16/09',
        scheduleGap: { text: 'Đúng tiến độ', direction: 'onTrack' },
      })
    );

    expect(out).toContain('Số liệu ngày 16/09');
    expect(out.match(/class="sb/g)?.length).toBe(2);
  });

  it('khong truyen scheduleGap: khong render dong nay', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, hero: true }));

    expect(out).not.toContain('Chậm');
    expect(out).not.toContain('Nhanh');
  });
});

describe('KpiCard - href/note (P1B Task 1: bam de cuon toi chart)', () => {
  it('co href: ca the la <a href> kem class "tap"', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, href: '#x' }));

    expect(out).toContain('<a href="#x" class="kpi rise tap"');
  });

  it('khong co href: van la <div>, khong co class "tap"', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, BASE));

    expect(out).toContain('class="kpi rise"');
    expect(out).not.toContain('tap');
    expect(out).toMatch(/^<div/);
  });

  it('co note: them 1 dong ".sb" phu sau dong cu', () => {
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, note: 'KH 5' }));

    expect(out).toContain('<div class="sb"><span>KH 5</span></div>');
  });
});
