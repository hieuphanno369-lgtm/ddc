import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo/mock-repo';
import { buildStageTimelineRows } from '@/lib/stage-timeline';
import { stageOrder } from '@/lib/stages';
import { getWorkItemComparison } from '@/server/project-queries';
import { StageExplorer } from './StageExplorer';

describe('StageExplorer', () => {
  it('du ten giai doan tu stages (P7-C2: doc tu DB, khong con key i18n stage.*), co hint, dung so lan "0 ngay" theo seed', async () => {
    const stages = repo.getStages();
    const order = stageOrder(stages);
    const rows = buildStageTimelineRows(repo.getStageMilestones(1), repo.getStageWeights(1), order);
    const compare = await getWorkItemComparison(1, '2026-09');
    const out = renderToStaticMarkup(React.createElement(StageExplorer, { rows, compare, today: '2026-09-16', locale: 'vi', stages }));

    for (const name of ['Thiết kế', 'Shop Drawing', 'Vật tư', 'Gia công', 'Vận chuyển', 'Lắp dựng', 'Nghiệm thu']) {
      expect(out).toContain(name);
    }
    expect(out).toContain('detail.stageMs.hint');
    expect([...out.matchAll(/detail\.stageMs\.days\|0/g)]).toHaveLength(3);
    expect(out).toContain('detail.cmp.title');
    expect(out).toContain('detail.cmp.default');
  });

  it('rows rong -> hien trang thai trong; compare rong -> detail.cmp.empty', () => {
    const stages = repo.getStages();
    const out = renderToStaticMarkup(React.createElement(StageExplorer, { rows: [], compare: {}, today: '2026-09-16', locale: 'vi', stages }));
    expect(out).toContain('detail.stageMs.empty');
    expect(out).toContain('detail.cmp.empty');
  });
});
