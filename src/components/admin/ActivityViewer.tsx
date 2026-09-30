'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ActivityLogEntry } from '@/server/repo/types';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { LOG_PAGE_SIZE, paginate } from '@/lib/log-paging';

export function ActivityViewer({ activity }: { activity: ActivityLogEntry[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  const users = Array.from(new Set(activity.map((a) => a.userEmail)));
  const rows = filter ? activity.filter((a) => a.userEmail === filter) : activity;
  const view = paginate(rows, page, LOG_PAGE_SIZE);

  return (
    <div className="space-y-3">
      <select
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setPage(1);
        }}
        className="inp"
        style={{ width: 'auto', maxWidth: '100%' }}
      >
        <option value="">{t('admin.allUsers')}</option>
        {users.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      <div className="scroll" style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table className="tbl sticky">
          <thead>
            <tr>
              <th>{t('admin.time')}</th>
              <th>{t('admin.user')}</th>
              <th>{t('admin.action')}</th>
              <th>{t('admin.detail')}</th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((a) => (
              <tr key={a.id}>
                <td className="mono">{formatDateTime(a.createdAt, locale)}</td>
                <td>
                  {a.userName}{' '}
                  <span className="en">{a.userEmail}</span>
                </td>
                <td>
                  <Badge tone="neutral">{t(`activity.${a.action}`)}</Badge>
                </td>
                <td className="text-caption1 text-label2">{a.detail}</td>
              </tr>
            ))}
            {view.items.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">{t('common.noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-end gap-2 border-t border-sep px-4 py-3 text-caption1 text-label2">
          <button
            type="button"
            aria-label={t('logPaging.prev')}
            disabled={view.page <= 1}
            onClick={() => setPage(view.page - 1)}
            className="btn ghost disabled:opacity-40"
            style={{ padding: '5px 12px', fontSize: 'var(--t-caption1)' }}
          >
            ←
          </button>
          <span className="text-xs">{`${view.page} / ${view.totalPages}`}</span>
          <button
            type="button"
            aria-label={t('logPaging.next')}
            disabled={view.page >= view.totalPages}
            onClick={() => setPage(view.page + 1)}
            className="btn ghost disabled:opacity-40"
            style={{ padding: '5px 12px', fontSize: 'var(--t-caption1)' }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
