import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ActivityLogEntry } from '@/server/repo/types';

/**
 * Tester (P7-C1, uc 2 cua doi ky-hoach.md): 7.1 go han "xoa toan bo du lieu"
 * NHUNG van giu key `activity.reset_data` (K7) vi nhat ky hoat dong cu trong DB
 * con dong action = 'reset_data'. Test nay dung ban dich THAT (vi.json/en.json),
 * khong mock chuoi key, de chung minh hanh vi nguoi dung thay: dong nhat ky cu
 * van hien chu da dich ("Xoa du lieu" / "Reset data"), khong crash, khong hien
 * chuoi khoa tho ("activity.reset_data").
 */
(globalThis as unknown as { React: typeof React }).React = React;

const ROOT = process.cwd();
const readJson = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as Record<string, unknown>;

const VI = readJson('src/i18n/messages/vi.json');
const EN = readJson('src/i18n/messages/en.json');

let activeMessages: Record<string, unknown> = VI;

function lookup(messages: Record<string, unknown>, key: string): string {
  const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
  return typeof value === 'string' ? value : key;
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => lookup(activeMessages, key),
  useLocale: () => 'vi',
}));

import { ActivityViewer } from './ActivityViewer';

const LEGACY_ROW: ActivityLogEntry = {
  id: 1,
  userEmail: 'admin@daidung.com.vn',
  userName: 'Admin',
  action: 'reset_data',
  detail: '-',
  ip: '127.0.0.1',
  userAgent: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ActivityViewer - nhat ky cu con action reset_data (7.1, K7)', () => {
  it('vi: hien "Xoa du lieu" (ban dich that), khong hien chuoi khoa tho', () => {
    activeMessages = VI;
    const out = renderToStaticMarkup(React.createElement(ActivityViewer, { activity: [LEGACY_ROW] }));
    expect(out).toContain('Xóa dữ liệu');
    expect(out).not.toContain('activity.reset_data');
  });

  it('en: hien "Reset data" (ban dich that), khong hien chuoi khoa tho', () => {
    activeMessages = EN;
    const out = renderToStaticMarkup(React.createElement(ActivityViewer, { activity: [LEGACY_ROW] }));
    expect(out).toContain('Reset data');
    expect(out).not.toContain('activity.reset_data');
  });

  it('neu key bi xoa (gia lap mat key) thi se hien chuoi khoa tho - chung minh test nay that su kiem tra duoc', () => {
    const withoutKey = JSON.parse(JSON.stringify(VI)) as { activity: Record<string, unknown> };
    delete withoutKey.activity.reset_data;
    activeMessages = withoutKey;
    const out = renderToStaticMarkup(React.createElement(ActivityViewer, { activity: [LEGACY_ROW] }));
    expect(out).toContain('activity.reset_data');
    activeMessages = VI;
  });
});
