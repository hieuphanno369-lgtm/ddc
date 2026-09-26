import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_STAGE_WEIGHTS } from '@/lib/stages';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'vi',
}));

import { StageWeightEditor } from './StageWeightEditor';

describe('StageWeightEditor', () => {
  it('DEFAULT_STAGE_WEIGHTS -> co projectForm.weights.ok', () => {
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: DEFAULT_STAGE_WEIGHTS, onChange: () => {} }));
    expect(out).toContain('projectForm.weights.ok');
  });

  it('tong 99 -> weights.bad', () => {
    const rows = DEFAULT_STAGE_WEIGHTS.map((r, i) => (i === 0 ? { ...r, weightPct: r.weightPct - 1 } : r));
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: rows, onChange: () => {} }));
    expect(out).toContain('projectForm.weights.bad');
  });

  it('tat ca tat -> weights.empty', () => {
    const rows = DEFAULT_STAGE_WEIGHTS.map((r) => ({ ...r, applicable: false }));
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: rows, onChange: () => {} }));
    expect(out).toContain('projectForm.weights.empty');
  });

  it('khong truyen onApplyPreset -> khong co nut weights.applyPreset', () => {
    const out = renderToStaticMarkup(React.createElement(StageWeightEditor, { value: DEFAULT_STAGE_WEIGHTS, onChange: () => {} }));
    expect(out).not.toContain('projectForm.weights.applyPreset');
  });
});
