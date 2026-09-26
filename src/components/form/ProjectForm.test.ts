import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProjectFormProps } from './ProjectForm';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key);
    t.has = () => true;
    t.rich = (key: string) => key;
    return t;
  },
  useLocale: () => 'vi',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }) }));
vi.mock('@/server/actions', () => ({ createDimValueAction: vi.fn(), saveKeyMilestonesAction: vi.fn(), createProjectAction: vi.fn() }));
vi.mock('@/server/actions-project', () => ({ changeProjectCodeAction: vi.fn(), updateProjectAction: vi.fn(), saveStageWeightsAction: vi.fn() }));

import { ProjectForm } from './ProjectForm';

const BASE_PROPS: ProjectFormProps = {
  mode: 'new',
  project: null,
  projects: [],
  customers: [],
  teams: [],
  currencies: [{ code: 'VND', name: 'VND' }, { code: 'USD', name: 'USD' }],
  factories: [],
  exchangeRates: [],
  sapCodes: [],
  stageWeights: [],
  keyMilestones: [],
  members: [],
  assignableUsers: null,
  contractorMembers: [],
  allContractors: [],
  ownerEmail: 'a@x',
  today: '2026-09-16',
};

function render(props: Partial<ProjectFormProps> = {}) {
  return renderToStaticMarkup(React.createElement(ProjectForm, { ...BASE_PROPS, ...props }));
}

describe('ProjectForm - T3 markup deu o', () => {
  it('khong con HelpTip nam ngoai nhan (dau ? xuong dong rieng)', () => {
    const out = render();
    expect(out).not.toMatch(/<\/span><button type="button" class="help/);
  });

  it('dung 5 the f4 feven o muc 1, 2, 3', () => {
    const out = render();
    const count = (out.match(/class="f4 feven"/g) ?? []).length;
    expect(count).toBe(5);
  });

  it('o Gia tri nguyen te: select + input cung 1 dong', () => {
    const out = render();
    const m = out.match(/data-field="contractValueOriginal"[\s\S]*?<\/div>\s*<\/div>/);
    expect(m).not.toBeNull();
    const block = m![0];
    expect(block).toContain('<div class="inline"><select');
    expect(block).toContain('<input');
  });
});
