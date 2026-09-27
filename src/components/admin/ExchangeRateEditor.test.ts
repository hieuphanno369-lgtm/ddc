/**
 * P3E Task 1 (D4) - test ĐỘC LẬP mới cho `ExchangeRateEditor` (chưa từng có test file trước hay
 * sau Task 1). Kiểm đúng "Trường hợp biên" ghi trong ke-hoach.md: dòng tỷ giá cũ `source='vcb'`
 * vẫn hiện được (badge nguồn) và sửa tay được; không còn nút "Lấy ngay" / dòng "Lần lấy gần nhất".
 */
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExchangeRate } from '@/server/repo/types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-master', () => ({ saveExchangeRateAction: vi.fn(), deleteExchangeRateAction: vi.fn() }));

import { ExchangeRateEditor } from './ExchangeRateEditor';

const RATE = (over: Partial<ExchangeRate> = {}): ExchangeRate => ({
  currencyCode: 'USD',
  yearMonth: '2026-09',
  rateToVnd: 25500,
  source: 'manual',
  updatedBy: 'admin@daidung.com.vn',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('ExchangeRateEditor - D4 chi nhap tay', () => {
  it('duong chay thuan loi: dong nguon manual hien badge + nut Sua', () => {
    const out = renderToStaticMarkup(
      React.createElement(ExchangeRateEditor, { months: ['2026-09'], rates: [RATE()] }),
    );
    expect(out).toContain('fxRates.source.manual');
    expect(out).toContain('fxRates.edit');
  });

  it('bien: dong ty gia cu nguon vcb van hien duoc (badge nguon vcb) va co nut Sua nhu dong manual', () => {
    const out = renderToStaticMarkup(
      React.createElement(ExchangeRateEditor, { months: ['2026-08'], rates: [RATE({ yearMonth: '2026-08', source: 'vcb' })] }),
    );
    expect(out).toContain('fxRates.source.vcb');
    expect(out).toContain('fxRates.edit');
  });

  it('khong con nut "Lay ngay" / key fetchNow, khong con dong "Lan lay gan nhat" (da bo D4)', () => {
    const out = renderToStaticMarkup(
      React.createElement(ExchangeRateEditor, { months: ['2026-09'], rates: [RATE()] }),
    );
    expect(out).not.toContain('fxRates.fetchNow');
    expect(out).not.toContain('fxRates.lastRun');
    expect(out).not.toContain('fxRates.never');
  });

  it('phai that bai: thang chua co ty gia (khong co dong khop cur+month) hien dau "-", khong hien badge/nut Sua nao', () => {
    const out = renderToStaticMarkup(
      React.createElement(ExchangeRateEditor, { months: ['2026-10'], rates: [] }),
    );
    expect(out).not.toContain('fxRates.source.manual');
    expect(out).not.toContain('fxRates.source.vcb');
  });
});
