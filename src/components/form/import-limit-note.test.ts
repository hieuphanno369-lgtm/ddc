import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Task 2 (P3A): ghi chú "tối đa 10MB" phải hiện ở cả 2 màn import. */
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {} }),
}));

import { ImportPanel } from './ImportPanel';
import { DailyImportBlock } from './DailyImportBlock';

describe('import-limit-note - ghi chu 10MB o man import', () => {
  it('ImportPanel hien importLimit.note', () => {
    const out = renderToStaticMarkup(
      React.createElement(ImportPanel, { projects: [], queue: [], months: [], currentMonth: '2026-09' }),
    );
    expect(out).toContain('importLimit.note');
  });

  it('DailyImportBlock hien importLimit.note', () => {
    const out = renderToStaticMarkup(
      React.createElement(DailyImportBlock, { projectId: 1, disabled: false }),
    );
    expect(out).toContain('importLimit.note');
  });
});
