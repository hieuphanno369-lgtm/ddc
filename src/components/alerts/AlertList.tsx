'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { AlertLog } from '@/server/repo/types';
import { formatDate } from '@/lib/format';
import { Badge, Dot } from '@/components/ui/Badge';
import { CloseAlertForm } from './CloseAlertForm';

type Row = AlertLog & { projectName: string };

export function AlertList({ alerts, canClose }: { alerts: Row[]; canClose: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  if (alerts.length === 0) {
    return <p className="empty">{t('overview.noAlerts')}</p>;
  }

  return (
    <div className="scroll">
      <table className="tbl" style={{ minWidth: 980 }}>
        <thead>
          <tr>
            <th>{t('common.project')}</th>
            <th>{t('common.status')}</th>
            <th>{t('alert.rule')}</th>
            <th>{t('alert.message')}</th>
            <th>{t('alert.owner')}</th>
            <th>{t('alert.deadline')}</th>
            {canClose && <th />}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td style={{ fontWeight: 600 }}>{a.projectName}</td>
              <td>
                <Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>
                  <Dot tone={a.alertType === 'Red' ? 'danger' : 'warn'} />
                  {t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}
                </Badge>
              </td>
              <td className="mono">{a.ruleTriggered}</td>
              <td>{a.message}</td>
              <td>{a.owner || '-'}</td>
              <td>{formatDate(a.deadline, locale)}</td>
              {canClose && (
                <td className="num">
                  <CloseAlertForm alertId={a.id} onDone={() => router.refresh()} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
