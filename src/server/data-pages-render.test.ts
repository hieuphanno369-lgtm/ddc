import { describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

/**
 * Render trang `/data-schema` + `/data-dictionary` (T4 Bước 9) - server component thuần, không
 * đụng DB. Theo boilerplate `src/server/operation-pages-render.test.ts`.
 */
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
  homeForRole: () => '/overview',
}));

(globalThis as unknown as { React: typeof React }).React = React;

import { getCurrentUser } from '@/lib/session';
import DataSchemaPage from '../../app/[locale]/(app)/data-schema/page';
import DataDictionaryPage from '../../app/[locale]/(app)/data-dictionary/page';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

describe('/data-schema', () => {
  it('admin: co <svg, dim_shift, project_equipment_plan', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);
    const out = renderToStaticMarkup((await DataSchemaPage()) as React.ReactElement);
    expect(out).toContain('<svg');
    expect(out).toContain('dim_shift');
    expect(out).toContain('project_equipment_plan');
  });

  it('viewer: bi redirect', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    await expect(DataSchemaPage()).rejects.toThrow('REDIRECT:');
  });
});

describe('/data-dictionary', () => {
  it('admin: co muc → dim_project.id', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);
    const out = renderToStaticMarkup((await DataDictionaryPage()) as React.ReactElement);
    expect(out).toContain('→ dim_project.id');
  });

  it('viewer: bi redirect', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    await expect(DataDictionaryPage()).rejects.toThrow('REDIRECT:');
  });
});
