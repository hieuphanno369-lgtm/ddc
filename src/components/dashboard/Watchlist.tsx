'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { THRESHOLDS } from '@/lib/thresholds';
import type { ProjectSummary } from '@/server/queries';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconChevronRight } from '@/components/icons';

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
          <p className="empty">{t('overview.noAlerts')}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((s) => (
              <Link key={s.id} href={`/projects/${s.id}`} className="alert">
                <span className="dot" style={{ background: 'var(--danger)' }} />
                <div className="min-w-0 flex-1">
                  <h4>{s.projectName}</h4>
                  <div className="mt">
                    {reasonsOf(t, s).map((r) => (
                      <Badge key={r} tone="warn">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <IconChevronRight size={18} className="shrink-0 text-label3" />
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
