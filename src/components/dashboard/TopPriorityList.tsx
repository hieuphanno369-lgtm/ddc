'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatPct } from '@/lib/format';
import { isBehindSchedule } from '@/lib/top-priority';
import { maxHeightForRows, WATCHLIST_VISIBLE_ROWS } from '@/lib/visible-rows';
import type { SafeProjectSummary } from '@/lib/finance-gate';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconChevronRight } from '@/components/icons';

/** Thẻ "Top dự án trọng điểm" (T2): P0 đang triển khai, trễ xếp trước. Không hiện số tiền. */
export function TopPriorityList({ items }: { items: SafeProjectSummary[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const listRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const overflow = items.length > WATCHLIST_VISIBLE_ROWS;

  useEffect(() => {
    if (!overflow || !listRef.current) return;
    function measure() {
      const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
      setMeasured(maxHeightForRows(rows, WATCHLIST_VISIBLE_ROWS));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <Card>
      <CardHeader title={t('topPriority.title')} subtitle={t('topPriority.subtitle')} />
      <CardBody>
        {items.length === 0 ? (
          <p className="empty">{t('topPriority.empty')}</p>
        ) : (
          <div
            ref={listRef}
            className="flex flex-col gap-2.5"
            style={overflow ? { maxHeight: measured ?? 400, overflowY: 'auto' } : undefined}
          >
            {items.map((s) => {
              const behind = isBehindSchedule(s);
              return (
                <Link key={s.id} href={`/projects/${s.id}`} className="alert">
                  <span className="dot" style={{ background: behind ? 'var(--danger)' : 'var(--ok)' }} />
                  <div className="min-w-0 flex-1">
                    <h4>{s.projectName}</h4>
                    <div className="mt">
                      {behind ? (
                        <Badge tone="danger">{t('topPriority.behind')}</Badge>
                      ) : (
                        <Badge tone="ok">{t('topPriority.onTrack')}</Badge>
                      )}
                      <span>
                        {t('metric.pctActual')} {formatPct(s.pctActual, locale)} · {t('metric.pctPlan')}{' '}
                        {formatPct(s.pctPlan, locale)}
                      </span>
                    </div>
                  </div>
                  <IconChevronRight size={18} className="shrink-0 text-label3" />
                </Link>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
