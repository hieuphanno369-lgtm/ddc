'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { closeAlertAction } from '@/server/actions';
import type { AlertLog } from '@/server/repo/types';
import { formatDate } from '@/lib/format';
import { Badge, Dot } from '@/components/ui/Badge';

type Row = AlertLog & { projectName: string };

export function AlertList({ alerts, canClose }: { alerts: Row[]; canClose: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function close(id: number) {
    setBusy(id);
    try {
      await closeAlertAction(id, 'Đã xử lý');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (alerts.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">{t('overview.noAlerts')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm table-zebra">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5 font-medium">{t('common.project')}</th>
            <th className="px-4 py-2.5 font-medium">{t('common.status')}</th>
            <th className="px-4 py-2.5 font-medium">{t('alert.rule')}</th>
            <th className="px-4 py-2.5 font-medium">{t('alert.message')}</th>
            <th className="px-4 py-2.5 font-medium">{t('alert.owner')}</th>
            <th className="px-4 py-2.5 font-medium">{t('alert.deadline')}</th>
            {canClose && <th className="px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {alerts.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-2.5 font-medium text-navy-900">{a.projectName}</td>
              <td className="px-4 py-2.5">
                <Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>
                  <Dot tone={a.alertType === 'Red' ? 'danger' : 'warn'} />
                  {t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{a.ruleTriggered}</td>
              <td className="px-4 py-2.5 text-navy-800">{a.message}</td>
              <td className="px-4 py-2.5 text-slate-600">{a.owner || '-'}</td>
              <td className="px-4 py-2.5 text-slate-600">{formatDate(a.deadline, locale)}</td>
              {canClose && (
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => close(a.id)}
                    disabled={busy === a.id}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t('alert.closeAlert')}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
