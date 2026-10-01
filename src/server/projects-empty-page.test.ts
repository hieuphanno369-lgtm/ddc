import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

/**
 * Lỗi chủ dự án báo 2026-10-01: DB thật chưa có dự án, bấm "Chi tiết dự án" bị đẩy về Tổng quan (redirect im lặng).
 * Chủ dự án chốt: khi chưa có dự án thì ở lại trang, hiện thẻ "Chưa có dự án nào" + nút "Tạo dự án mới"
 * (chỉ admin/data-entry, khớp quyền trang Tạo / Sửa dự án); có dự án thì vẫn vào thẳng dự án đầu tiên như cũ.
 */
const { listProjects, currentUser } = vi.hoisted(() => ({
  listProjects: vi.fn(),
  currentUser: { value: null as CurrentUser | null },
}));

vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));
vi.mock('@/lib/require-user', () => ({ requireUser: vi.fn(async () => currentUser.value) }));
vi.mock('@/server/repo', () => ({ repo: { listProjects } }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...rest }, children),
}));

import ProjectsPage from '../../app/[locale]/(app)/projects/page';

(globalThis as unknown as { React: typeof React }).React = React;

const user = (role: CurrentUser['role']): CurrentUser => ({ name: 'U', email: 'u@daidung.com.vn', role, canViewFinance: true });
const render = async () => renderToStaticMarkup(await ProjectsPage({ params: Promise.resolve({ locale: 'vi' }) }));

describe('/projects (Chi tiết dự án)', () => {
  beforeEach(() => {
    listProjects.mockReset();
    currentUser.value = user('admin');
  });

  it('có dự án: vào thẳng dự án đầu tiên như cũ', async () => {
    listProjects.mockResolvedValue([{ id: 7 }, { id: 9 }]);
    await expect(render()).rejects.toThrow('REDIRECT:/vi/projects/7');
  });

  it('chưa có dự án: KHÔNG đẩy về Tổng quan, hiện thẻ trống + nút Tạo dự án mới (admin)', async () => {
    listProjects.mockResolvedValue([]);
    const html = await render();
    expect(html).toContain('projectsEmpty.title');
    expect(html).toContain('projectsEmpty.body');
    expect(html).toContain('href="/ho-so-du-an?mode=new"');
    expect(html).toContain('projectsEmpty.create');
  });

  it('chưa có dự án, data-entry: có nút tạo', async () => {
    currentUser.value = user('data-entry');
    listProjects.mockResolvedValue([]);
    expect(await render()).toContain('href="/ho-so-du-an?mode=new"');
  });

  it.each(['bod', 'viewer'] as const)('chưa có dự án, %s: chỉ có câu thông báo, không có nút tạo', async (role) => {
    currentUser.value = user(role);
    listProjects.mockResolvedValue([]);
    const html = await render();
    expect(html).toContain('projectsEmpty.title');
    expect(html).toContain('projectsEmpty.bodyNoCreate');
    expect(html).not.toContain('ho-so-du-an');
  });
});
