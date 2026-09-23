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
 * class .kpi/.key/.tag + prop heroTagLabel mới, xem .bangiao/thay-doi.md mục
 * 3.1). Render tĩnh để khẳng định đúng markup người dùng nhìn thấy (class,
 * text, có/không có icon), không chỉ khẳng định "không throw".
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
  it('hero=true: doi sang the .kpi.key, hien tag heroTagLabel, KHONG hien icon', () => {
    const out = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, heroTagLabel: 'Trọng tâm' })
    );

    expect(out).toContain('class="kpi rise key"');
    expect(out).toContain('class="tag">Trọng tâm</span>');
    expect(out).not.toContain('data-testid="dummy-icon"');
  });

  it('hero=true nhung KHONG truyen heroTagLabel: the .tag render RONG (khoa lai hop dong hien tai)', () => {
    // Ca 3 noi goi that (OverviewWidgets/report/projects[id]) luon truyen kem
    // heroTagLabel khi hero=true nen truong hop nay chua xay ra tren san pham
    // that. Test nay chi khoa lai hanh vi hien tai (khong crash, chi rong) de
    // bat regression neu sau nay co noi goi moi thieu heroTagLabel.
    const out = renderToStaticMarkup(React.createElement(KpiCard, { ...BASE, hero: true }));

    expect(out).toContain('<span class="tag"></span>');
  });

  it('hero=true + tone warn/danger: chu gia tri phai la mau vang --gold, KHONG con trang cung (B-3)', () => {
    const warn = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, heroTagLabel: 'Trọng tâm', tone: 'warn' })
    );
    const danger = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, heroTagLabel: 'Trọng tâm', tone: 'danger' })
    );

    expect(warn).toContain('style="color:var(--gold)"');
    expect(danger).toContain('style="color:var(--gold)"');
  });

  it('hero=true + tone ok/neutral: khong co mau inline (van la chu trang ke thua tu nen gradient)', () => {
    const ok = renderToStaticMarkup(
      React.createElement(KpiCard, { ...BASE, hero: true, heroTagLabel: 'Trọng tâm', tone: 'ok' })
    );

    expect(ok).not.toContain('style=');
  });
});
