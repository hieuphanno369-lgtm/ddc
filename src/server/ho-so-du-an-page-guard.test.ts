import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

/** Task 8 (P3A): trang `/ho-so-du-an` tự kiểm quyền server-side (khuôn `nhap-lieu-page-guard.test.ts`). */
const { redirectCalls, formProps, auditProps, backfillProps } = vi.hoisted(() => ({
  redirectCalls: [] as string[],
  formProps: [] as Array<Record<string, unknown>>,
  auditProps: [] as Array<Record<string, unknown>>,
  backfillProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
  homeForRole: (role: string) => (role === 'data-entry' ? '/nhap-lieu' : '/overview'),
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/components/form/ProjectForm', () => ({
  ProjectForm: (props: Record<string, unknown>) => {
    formProps.push(props);
    return null;
  },
}));
vi.mock('@/components/form/BackfillPanel', () => ({
  BackfillPanel: (props: Record<string, unknown>) => {
    backfillProps.push(props);
    return null;
  },
}));
vi.mock('@/components/project/ProjectAuditCard', () => ({
  ProjectAuditCard: (props: Record<string, unknown>) => {
    auditProps.push(props);
    return null;
  },
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getCurrentUser } from '@/lib/session';
import HoSoDuAnPage from '../../app/[locale]/(app)/ho-so-du-an/page';

(globalThis as unknown as { React: typeof React }).React = React;

const user = (role: 'admin' | 'data-entry' | 'bod' | 'viewer', email = `${role}@daidung.com.vn`): CurrentUser =>
  ({ name: role, email, role, canViewFinance: role === 'admin' }) as CurrentUser;

function login(u: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(u);
}

async function visit(searchParams: Record<string, string> = {}): Promise<string | null> {
  redirectCalls.length = 0;
  try {
    const el = await HoSoDuAnPage({ searchParams: Promise.resolve(searchParams) });
    renderToStaticMarkup(el as React.ReactElement);
    return null;
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
}

afterEach(() => {
  vi.clearAllMocks();
  formProps.length = 0;
  auditProps.length = 0;
  backfillProps.length = 0;
});

describe('guard /ho-so-du-an', () => {
  it('chua dang nhap -> /vi/login', async () => {
    login(null);
    expect(await visit()).toBe('/vi/login');
  });

  it('viewer bi da ve /vi/overview', async () => {
    login(user('viewer'));
    expect(await visit()).toBe('/vi/overview');
  });

  it('bod bi da ve /vi/overview', async () => {
    login(user('bod'));
    expect(await visit()).toBe('/vi/overview');
  });

  it('data-entry (pm@) voi ?project=16 (khong duoc gan) -> notFound', async () => {
    login(user('data-entry', 'pm@daidung.com.vn'));
    await expect(visit({ project: '16' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('data-entry (pm@) voi ?project=1 (la PIC) -> mode edit, assignableUsers null', async () => {
    login(user('data-entry', 'pm@daidung.com.vn'));
    expect(await visit({ project: '1' })).toBeNull();
    expect(formProps).toHaveLength(1);
    expect(formProps[0].mode).toBe('edit');
    expect(formProps[0].assignableUsers).toBeNull();
  });

  it('admin -> assignableUsers khong co truong passwordHash', async () => {
    login(user('admin'));
    expect(await visit({ project: '1' })).toBeNull();
    const users = formProps[0].assignableUsers as Array<Record<string, unknown>>;
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => !('passwordHash' in u))).toBe(true);
  });

  it('P4 (D-24): the Nhap bu lich su chi render cho admin o mode edit, PIC va mode new khong co', async () => {
    login(user('admin'));
    expect(await visit({ project: '1' })).toBeNull();
    expect(backfillProps).toHaveLength(1);
    expect(backfillProps[0].projectId).toBe(1);
    expect(backfillProps[0].windows).toEqual([]);

    backfillProps.length = 0;
    expect(await visit()).toBeNull();
    expect(backfillProps).toHaveLength(0);

    login(user('data-entry', 'pm@daidung.com.vn'));
    expect(await visit({ project: '1' })).toBeNull();
    expect(backfillProps).toHaveLength(0);
  });

  it('khong co ?project -> mode new', async () => {
    login(user('admin'));
    expect(await visit()).toBeNull();
    expect(formProps[0].mode).toBe('new');
    expect(formProps[0].project).toBeNull();
  });
});
