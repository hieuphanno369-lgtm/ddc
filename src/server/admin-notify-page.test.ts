import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SECRET_KEY_ENV } from '@/lib/secret-box';
import type { CurrentUser } from '@/lib/session';

/**
 * Task 8 (P3B) - trang /admin truyen du kenh thong bao cho NotifyChannelEditor, khong bao gio
 * lo secretEnc/v1:/URL goc qua props RSC. Boilerplate khuon operation-pages-render.test.ts.
 */
const { notifyEditorProps } = vi.hoisted(() => ({ notifyEditorProps: [] as Record<string, unknown>[] }));

vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
  homeForRole: () => '/overview',
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/server/audit-log-page', async () => {
  const { repo } = await import('@/server/repo/mock-repo');
  const { paginate, logSince } = await import('@/lib/log-paging');
  return {
    getAuditLogPage: vi.fn(async ({ page, range, pageSize = 20, now = new Date() }: { page: number; range: 'all' | '14d'; pageSize?: number; now?: Date }) => {
      const since = logSince(range, now);
      const rows = repo.getAuditLog().filter((a) => !since || new Date(a.changedAt) >= since);
      return { ...paginate(rows, page, pageSize), pageSize };
    }),
  };
});
vi.mock('@/components/admin/UserEditor', () => ({ UserEditor: () => null }));
vi.mock('@/components/admin/ActivityViewer', () => ({ ActivityViewer: () => null }));
vi.mock('@/components/admin/FieldEditor', () => ({ FieldEditor: () => null }));
vi.mock('@/components/admin/DeleteProject', () => ({ DeleteProject: () => null }));
vi.mock('@/components/admin/AuditMiniTable', () => ({ AuditMiniTable: () => null }));
vi.mock('@/components/admin/FactoryEditor', () => ({ FactoryEditor: () => null }));
vi.mock('@/components/admin/StageEditor', () => ({ StageEditor: () => null }));
vi.mock('@/components/admin/ExchangeRateEditor', () => ({ ExchangeRateEditor: () => null }));
vi.mock('@/components/admin/NotifyChannelEditor', () => ({
  NotifyChannelEditor: (props: Record<string, unknown>) => {
    notifyEditorProps.push(props);
    return null;
  },
}));

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import AdminPage from '../../app/[locale]/(app)/admin/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

const KEY_32 = Buffer.from('a'.repeat(32), 'utf8').toString('base64');

beforeEach(() => {
  repo.reset();
  notifyEditorProps.length = 0;
  process.env[SECRET_KEY_ENV] = KEY_32;
});

afterEach(() => {
  delete process.env[SECRET_KEY_ENV];
  vi.clearAllMocks();
});

describe('/admin - the NotifyChannelEditor nhan du props, khong lo bi mat', () => {
  it('admin: props co du kenh + nguoi nhan, khong chua secretEnc/v1:/URL goc', async () => {
    const created = repo.saveNotifyChannel(
      { kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', settings: {}, secret: { enc: 'v1:a:b:c', hint: '••••1234' } },
      'admin@daidung.com.vn',
    ) as { id: number };
    const emailCh = repo.saveNotifyChannel(
      { kind: 'email', name: 'E', isEnabled: false, minSeverity: 'Red', settings: { smtpHost: 'smtp.x.com', fromAddress: 'a@x.com' } },
      'admin@daidung.com.vn',
    ) as { id: number };
    repo.saveNotifyRecipient({ channelId: emailCh.id, email: 'r@x.com', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');

    (getCurrentUser as Mock).mockResolvedValue(ADMIN);
    renderToStaticMarkup((await AdminPage()) as React.ReactElement);

    expect(notifyEditorProps).toHaveLength(1);
    const props = notifyEditorProps[0] as { channels: Array<{ id: number }>; recipients: Array<{ id: number }>; secretKeyReady: boolean };
    expect(props.channels.map((c) => c.id).sort()).toEqual([created.id, emailCh.id].sort());
    expect(props.recipients).toHaveLength(1);
    expect(props.secretKeyReady).toBe(true);
    const dump = JSON.stringify(props);
    expect(dump).not.toContain('secretEnc');
    expect(dump).not.toContain('v1:');
    expect(dump).not.toContain('hooks.example.com');
  });

  it('thieu NOTIFY_SECRET_KEY -> secretKeyReady false', async () => {
    delete process.env[SECRET_KEY_ENV];
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);
    renderToStaticMarkup((await AdminPage()) as React.ReactElement);
    expect((notifyEditorProps[0] as { secretKeyReady: boolean }).secretKeyReady).toBe(false);
  });

  it('viewer -> bi redirect', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    await expect(AdminPage()).rejects.toThrow('REDIRECT:');
  });
});
