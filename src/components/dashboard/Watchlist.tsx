'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { THRESHOLDS } from '@/lib/thresholds';
import type { ProjectSummary } from '@/server/queries';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconAlert, IconChevronRight } from '@/components/icons';

function reasonsOf(t: (k: string) => string, s: ProjectSummary) {
  const reasons: string[] = [];
  if (s.spi != null && s.spi < THRESHOLDS.spiWarn) reasons.push(`${t('metric.spi')} ${s.spi.toFixed(2)}`);
  if (s.cpi != null && s.cpi < THRESHOLDS.cpiWarn) reasons.push(`${t('metric.cpi')} ${s.cpi.toFixed(2)}`);
  if (s.penalty === 'risk') reasons.push(t('penalty.risk'));
  if (s.penalty === 'penalized') reasons.push(t('penalty.penalized'));
  return reasons;
}

export function Watchlist({ items }: { items: ProjectSummary[] }) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader title={t('overview.watchlist')} subtitle={t('watchlist.reason')} />
      <CardBody>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">{t('overview.noAlerts')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/projects/${s.id}`}
                  className="group flex items-center gap-3 px-1 py-3 transition-colors hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <IconAlert size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-navy-900">{s.projectName}</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {reasonsOf(t, s).map((r) => (
                        <Badge key={r} tone="warn">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <IconChevronRight size={18} className="shrink-0 text-slate-300 group-hover:text-navy-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
