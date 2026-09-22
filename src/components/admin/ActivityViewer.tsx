'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ActivityLogEntry } from '@/server/repo/types';
import { formatDate } from '@/lib/format';

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
        className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm text-navy-800 focus:border-accent focus:outline-none"
      >
        <option value="">{t('admin.allUsers')}</option>
        {users.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      <div className="max-h-64 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="py-1.5 font-medium">{t('admin.time')}</th>
              <th className="py-1.5 font-medium">{t('admin.user')}</th>
              <th className="py-1.5 font-medium">{t('admin.action')}</th>
              <th className="py-1.5 font-medium">{t('admin.detail')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="py-2 font-mono text-xs text-slate-500">{formatDate(a.createdAt, locale)}</td>
                <td className="py-2 text-navy-800">
                  {a.userName}
                  <span className="ml-1 text-xs text-slate-400">{a.userEmail}</span>
                </td>
                <td className="py-2 text-slate-600">{t(`activity.${a.action}`)}</td>
                <td className="py-2 text-xs text-slate-500">{a.detail}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
