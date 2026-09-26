import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DimValueRow } from './FieldEditor';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions', () => ({ mergeDimAction: vi.fn(), renameDimAction: vi.fn() }));
vi.mock('@/server/actions-project', () => ({ approveCustomerAction: vi.fn() }));

import { FieldEditor } from './FieldEditor';

const ROW = (over: Partial<DimValueRow>): DimValueRow => ({
  id: 1, name: 'CDT A', isActive: true, mergedIntoId: null, needsReview: false, refCount: 0, ...over,
});

describe('FieldEditor - hang cho duyet chu dau tu (G-5)', () => {
  it('field=customer, co 1 dong needsReview -> chua customerReview.pending va dung dau danh sach', () => {
    const values = [ROW({ id: 1, name: 'A cu', needsReview: false }), ROW({ id: 2, name: 'B moi', needsReview: true })];
    const out = renderToStaticMarkup(React.createElement(FieldEditor, { field: 'customer', values }));
    expect(out).toContain('customerReview.pending');
    const idxPending = out.indexOf('B moi');
    const idxOther = out.indexOf('A cu');
    expect(idxPending).toBeGreaterThan(-1);
    expect(idxOther).toBeGreaterThan(-1);
    expect(idxPending).toBeLessThan(idxOther);
  });

  it('field=team -> khong co chip du needsReview true (khong ap dung cho team)', () => {
    const values = [ROW({ id: 1, name: 'Team A', needsReview: true })];
    const out = renderToStaticMarkup(React.createElement(FieldEditor, { field: 'team', values }));
    expect(out).not.toContain('customerReview.pending');
  });
});
