'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ActivityLogEntry } from '@/server/repo/types';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

export function ActivityViewer({ activity }: { activity: ActivityLogEntry[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const [filter, setFilter] = useState('');

  const users = Array.from(new Set(activity.map((a) => a.userEmail)));
  const rows = filter ? activity.filter((a) => a.userEmail === filter) : activity;

  return (
    <div className="space-y-3">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="inp"
        style={{ width: 'auto' }}
      >
        <option value="">{t('admin.allUsers')}</option>
        {users.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      <div className="scroll" style={{ maxHeight: 256 }}>
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
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="mono">{formatDate(a.createdAt, locale)}</td>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">{t('common.noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
