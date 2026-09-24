import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActivityLogEntry } from '@/server/repo/types';

/**
 * Bang chung tim thay khi kiem mat that qua Playwright tren /vi/admin (dark
 * theme): cot "Nguoi dung" hien "Adminadmin@daidung.com.vn" dinh lien khong
 * doc duoc, thay vi "Admin" + "admin@daidung.com.vn" tach biet.
 *
 * Goc re: Task 8 (.bangiao/thay-doi.md) doi span hien email tu class Tailwind
 * cu "ml-1 text-xs text-slate-400" (co margin-left) sang class moi "en" (xem
 * app/globals.css dong 160: .en{font-size:...;color:...;letter-spacing:...} -
 * KHONG co margin/gap). O ProjectTable.tsx/Card.tsx, class "en" nam trong
 * ".card>.hd h3" - selector nay co display:flex;gap:8px (globals.css dong
 * 159) nen tu dong co khoang cach du khong co ky tu trang. O ActivityViewer,
 * ".en" nam thang trong <td> (.tbl td chi co padding/white-space:nowrap,
 * KHONG co flex/gap - globals.css dong 273) nen khong co gi bu lai khoang
 * trang da mat.
 *
 * Test render that component that (khong mock ActivityViewer) de khang dinh
 * dung hanh vi nguoi dung nhin thay - khong phai chi tiet class/CSS.
 */
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}));

import { ActivityViewer } from './ActivityViewer';

const ROW: ActivityLogEntry = {
  id: 1,
  userEmail: 'admin@daidung.com.vn',
  userName: 'Admin',
  action: 'login',
  detail: '-',
  ip: '127.0.0.1',
  userAgent: 'test',
  createdAt: '2026-09-23T00:00:00.000Z',
};

describe('ActivityViewer - cot "Nguoi dung" (ten + email)', () => {
  it('ten va email phai hien tach biet, khong dinh lien thanh mot chuoi khong doc duoc', () => {
    const out = renderToStaticMarkup(React.createElement(ActivityViewer, { activity: [ROW] }));
    const plainText = out.replace(/<[^>]+>/g, '');

    // Bang chung truc tiep: day la chuoi THAT xuat hien tren /vi/admin.
    expect(plainText).not.toContain('Adminadmin@daidung.com.vn');
    // Hanh vi dung: phai co khoang trang (hoac dau phan cach khac) giua ten va email.
    expect(out).toMatch(/Admin\s+<span class="en">/);
  });
});

describe('ActivityViewer - phan trang 20 dong/trang (P1B Task 6)', () => {
  it('25 dong -> chi 20 <tr trong tbody, co chu "1 / 2", o thoi gian co gio', () => {
    const rows: ActivityLogEntry[] = Array.from({ length: 25 }, (_, i) => ({ ...ROW, id: i + 1 }));
    const out = renderToStaticMarkup(React.createElement(ActivityViewer, { activity: rows }));
    const tbodyMatch = out.match(/<tbody>([\s\S]*?)<\/tbody>/);
    const trCount = (tbodyMatch?.[1].match(/<tr>/g) ?? []).length;

    expect(trCount).toBe(20);
    expect(out).toContain('1 / 2');
    expect(out).toMatch(/class="mono">\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}</);
  });
});
