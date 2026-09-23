import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { repo } from '@/server/repo/mock-repo';
import { buildStageTimelineRows } from '@/lib/stage-timeline';
import { StageExplorer } from './StageExplorer';

describe('StageExplorer', () => {
  it('du 7 chuoi ten giai doan, co hint, dung so lan "0 ngay" theo seed', () => {
    const rows = buildStageTimelineRows(repo.getStageMilestones(1), repo.getStageWeights(1));
    const out = renderToStaticMarkup(React.createElement(StageExplorer, { rows, today: '2026-09-16', locale: 'vi' }));

    for (const s of ['stage.design', 'stage.shop', 'stage.procurement', 'stage.fabrication', 'stage.transport', 'stage.erection', 'stage.handover']) {
      expect(out).toContain(s);
    }
    expect(out).toContain('detail.stageMs.hint');
    expect([...out.matchAll(/detail\.stageMs\.days\|0/g)]).toHaveLength(3);
  });

  it('rows rong -> hien trang thai trong', () => {
    const out = renderToStaticMarkup(React.createElement(StageExplorer, { rows: [], today: '2026-09-16', locale: 'vi' }));
    expect(out).toContain('detail.stageMs.empty');
  });
});
