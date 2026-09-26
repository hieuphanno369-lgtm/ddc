import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

/**
 * Kiem thu doc lap trang `/ho-so-du-an` (Task 8/9) - bo sung cac nhanh ma
 * `ho-so-du-an-page-guard.test.ts` cua coder CHUA cham: admin voi id du an KHONG TON TAI (chu
 * khong phai "khong duoc gan"), tham so `?project=` khong phai so (roi ve mode 'new' thay vi loi),
 * va data-entry KHONG duoc gan bat ky du an nao van vao duoc trang o mode 'new'.
 */
const { redirectCalls, formProps } = vi.hoisted(() => ({
  redirectCalls: [] as string[],
  formProps: [] as Array<Record<string, unknown>>,
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
vi.mock('@/components/project/ProjectAuditCard', () => ({
  ProjectAuditCard: () => null,
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
    const el = await HoSoDuAnPage({ searchParams });
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
});

describe('guard /ho-so-du-an - bien them cua Tester', () => {
  it("admin voi ?project=999999 (du an KHONG TON TAI, khac voi 'khong duoc gan') -> notFound", async () => {
    login(user('admin'));
    await expect(visit({ project: '999999' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it("?project=abc (khong phai so) -> KHONG loi, roi ve mode 'new'", async () => {
    login(user('admin'));
    expect(await visit({ project: 'abc' })).toBeNull();
    expect(formProps[0].mode).toBe('new');
  });

  it('data-entry hoan toan chua duoc gan du an nao -> van vao duoc trang o mode new (khong bi chan)', async () => {
    login(user('admin'));
    // Tao 1 tai khoan data-entry moi, chua duoc gan PIC/Backup o bat ky du an nao.
    const { repo } = await import('@/server/repo/mock-repo');
    repo.createAccount({
      email: 'de-trong@daidung.com.vn', name: 'DE Trong', passwordHash: 'x', role: 'data-entry',
      canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null,
    });
    login(user('data-entry', 'de-trong@daidung.com.vn'));
    expect(await visit()).toBeNull();
    expect(formProps[0].mode).toBe('new');
    expect(formProps[0].projects).toEqual([]); // khong thay du an nao de chon sang che do sua
  });
});
