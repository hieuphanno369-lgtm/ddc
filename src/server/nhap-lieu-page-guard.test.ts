import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

/**
 * Mục 2 (danh-gia.md, vòng sửa 1) - F2a: `/nhap-lieu` phải tự kiểm quyền server-side, không phó
 * mặc middleware (CVE-2025-29927 có thể bypass qua header x-middleware-subrequest). Đồng thời
 * fail-closed số tài chính: chỉ nạp/truyền `financial` cho `DataEntryForm` khi `user.canViewFinance`.
 */
const { redirectCalls, formProps } = vi.hoisted(() => ({
  redirectCalls: [] as string[],
  formProps: [] as Array<{
    projectId: number; financial?: unknown;
    resourcesPanel?: { props: { children: Array<{ props: Record<string, unknown> } | false> } };
  }>,
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
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
vi.mock('@/components/form/DataEntryForm', () => ({
  DataEntryForm: (props: {
    projectId: number; financial?: unknown;
    resourcesPanel?: { props: { children: Array<{ props: Record<string, unknown> } | false> } };
  }) => {
    formProps.push(props);
    return null;
  },
}));
// Link của next-intl cần provider - thay bằng thẻ <a> để render tĩnh được (Task 9, P3A).
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getCurrentUser } from '@/lib/session';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import NhapLieuPage from '../../app/[locale]/(app)/nhap-lieu/page';

// tsconfig `jsx: preserve` → esbuild hạ JSX về classic runtime (React.createElement) cho .tsx
// import → React là biến tự do trong module trang → phải có global (mẫu pages-role-guard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

const user = (
  role: 'admin' | 'data-entry' | 'bod' | 'viewer',
  canViewFinance: boolean,
  email = `${role}@daidung.com.vn`,
): CurrentUser => ({ name: role, email, role, canViewFinance }) as CurrentUser;

function login(u: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(u);
}

/**
 * Gọi page, trả về URL đã redirect (hoặc null nếu trang render bình thường). Phải render thật
 * qua `renderToStaticMarkup` (không chỉ gọi hàm page) để React thật sự invoke `DataEntryForm`
 * (mock) và ghi lại props nó nhận được - gọi hàm page chỉ trả về cây JSX chưa render.
 */
async function visit(): Promise<string | null> {
  redirectCalls.length = 0;
  try {
    const el = await NhapLieuPage({ searchParams: {} });
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

describe('guard /nhap-lieu (F2a)', () => {
  it('chưa đăng nhập → /vi/login', async () => {
    login(null);
    expect(await visit()).toBe('/vi/login');
  });

  it('bod bị đá về /vi/overview', async () => {
    login(user('bod', true));
    expect(await visit()).toBe('/vi/overview');
  });

  it('viewer bị đá về /vi/overview', async () => {
    login(user('viewer', false));
    expect(await visit()).toBe('/vi/overview');
  });

  it('admin được vào', async () => {
    login(user('admin', true));
    expect(await visit()).toBeNull();
  });

  it('data-entry được vào', async () => {
    login(user('data-entry', false, 'pm@daidung.com.vn'));
    expect(await visit()).toBeNull();
    expect(formProps).toHaveLength(1);
  });

  it('data-entry canViewFinance:false → prop financial của DataEntryForm là undefined', async () => {
    login(user('data-entry', false, 'pm@daidung.com.vn'));
    // pm@daidung.com.vn là PIC của dự án 1 (có seed tài chính '2026-09') - chứng minh page.tsx:47-48
    // KHÔNG nạp financial khi !canViewFinance (không phải nạp rồi ẩn ở UI), chứ không phải test giả
    // xanh vì dự án rỗng như trước.
    const spy = vi.spyOn(mockRepo, 'getFinancial');
    await visit();
    expect(formProps).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    const expected = (await mockRepo.getFinancial(formProps[0].projectId)).find((f) => f.yearMonth === '2026-09');
    expect(expected).toBeDefined();
    expect(formProps[0].financial).toBeUndefined();
    spy.mockRestore();
  });

  it('admin canViewFinance:true → vẫn nhận đúng financial thật từ repo (không bị ép undefined)', async () => {
    login(user('admin', true));
    await visit();
    const props = formProps.at(-1)!;
    const expected = (await mockRepo.getFinancial(props.projectId)).find((f) => f.yearMonth === '2026-09');
    expect(expected).toBeDefined();
    expect(props.financial).toEqual(expected);
  });
});

/** Task 3 (P2A) - bước "Nhân lực & Thiết bị" nạp đúng dữ liệu cho ResourceEntryPanel. */
describe('nạp dữ liệu buoc resources (Task 3)', () => {
  async function visitWithQuery(searchParams: Record<string, string>) {
    redirectCalls.length = 0;
    const el = await NhapLieuPage({ searchParams });
    renderToStaticMarkup(el as React.ReactElement);
  }

  // Task 12 (P3A): `resourcesPanel` giờ là 1 Fragment bọc <ResourceEntryPanel/> + <EquipmentPlanEditor/> -
  // phần tử đầu tiên trong `children` vẫn là ResourceEntryPanel.
  it('admin ?project=1&step=resources → members.length === 6, shifts 2 dòng', async () => {
    login(user('admin', true));
    await visitWithQuery({ project: '1', step: 'resources' });
    const resourcePanel = formProps.at(-1)!.resourcesPanel!.props.children[0] as { props: Record<string, unknown> };
    expect((resourcePanel.props.members as unknown[]).length).toBe(6);
    expect((resourcePanel.props.shifts as unknown[]).length).toBe(2);
  });

  it('?date=abc (không hợp lệ) → date === today seed 2026-09-16', async () => {
    login(user('admin', true));
    await visitWithQuery({ project: '1', date: 'abc' });
    const resourcePanel = formProps.at(-1)!.resourcesPanel!.props.children[0] as { props: Record<string, unknown> };
    expect(resourcePanel.props.date).toBe('2026-09-16');
  });
});
