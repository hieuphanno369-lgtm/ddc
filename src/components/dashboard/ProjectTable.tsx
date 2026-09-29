'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { SafeProjectSummary } from '@/lib/finance-gate';
import { typeKey } from '@/lib/labels';
import { formatPct, formatRatio, formatTyd } from '@/lib/format';
import { THRESHOLDS } from '@/lib/thresholds';
import { dataStateLabel } from '@/lib/data-state-label';
import { periodSearch, type Period } from '@/lib/period';
import { OnTrackBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badges';
import { Badge } from '@/components/ui/Badge';
import { IconChevronRight } from '@/components/icons';

interface Props {
  items: SafeProjectSummary[];
  total: number;
  page: number;
  totalPages: number;
  canViewFinance: boolean;
  /** Kỳ đang xem: link sang trang Chi tiết mang theo from/to (D-23). */
  period: Period;
}

export function ProjectTable({ items, total, page, totalPages, canViewFinance, period }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    if (key !== 'page') params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  const detailHref = (id: number) => `/projects/${id}?${new URLSearchParams(periodSearch(period))}`;

  return (
    <div className="card overflow-visible">
      <div className="hd">
        <h3>
          {t('overview.projectList')}
          <span className="en">
            {total} {t('common.project').toLowerCase()}
          </span>
        </h3>
        <select
          value={searchParams.get('sort') ?? 'priority'}
          onChange={(e) => update('sort', e.target.value)}
          className="inp"
          style={{ width: 'auto', padding: '5px 10px' }}
        >
          <option value="priority">Priority</option>
          {canViewFinance && <option value="value">{t('common.value')}</option>}
          <option value="spi">SPI</option>
          <option value="pctActual">% TT</option>
          <option value="name">{t('form.projectName')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bd scroll">
        <table className="tbl" style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              <th>Mã DA</th>
              <th>{t('form.projectName')}</th>
              <th>{t('common.customer')}</th>
              <th>{t('common.team')}</th>
              <th>{t('common.type')}</th>
              <th>{t('common.priority')}</th>
              <th>{t('common.status')}</th>
              <th>{t('onTrack.onTrack')}</th>
              <th className="num">% TT</th>
              <th>{t('asOf.colData')}</th>
              <th className="num">SPI</th>
              <th className="num">CPI</th>
              {canViewFinance && <th className="num">{t('metric.contractValue')}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.currentAliasCode}</td>
                <td style={{ whiteSpace: 'normal', maxWidth: 260, fontWeight: 600 }}>
                  <Link href={detailHref(s.id)}>{s.projectName}</Link>
                </td>
                <td>{s.customerName}</td>
                <td>{s.teamName}</td>
                <td>{t(typeKey[s.projectType])}</td>
                <td>
                  <PriorityBadge priority={s.priority} />
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td>
                  <OnTrackBadge onTrack={s.onTrack} status={s.status} />
                </td>
                <td className="num">{formatPct(s.pctActual, locale)}</td>
                <td className="whitespace-nowrap text-label2">
                  {(() => {
                    const l = dataStateLabel(s.dataState);
                    return t(l.key, { month: l.month });
                  })()}
                </td>
                <td className="num">
                  <Badge tone={s.spi == null ? 'neutral' : s.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'}>
                    {formatRatio(s.spi)}
                  </Badge>
                </td>
                <td className="num">
                  <Badge tone={s.cpi == null ? 'neutral' : s.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'}>
                    {formatRatio(s.cpi)}
                  </Badge>
                </td>
                {canViewFinance && <td className="num">{formatTyd(s.contractValue, locale)}</td>}
                <td>
                  <Link href={detailHref(s.id)} className="text-label3">
                    <IconChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={canViewFinance ? 14 : 13} className="empty">
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 border-t border-sep px-4 py-3 text-caption1 text-label2">
        <button
          disabled={page <= 1}
          onClick={() => update('page', String(page - 1))}
          className="btn ghost disabled:opacity-40"
          style={{ padding: '5px 12px', fontSize: 'var(--t-caption1)' }}
        >
          ←
        </button>
        <span className="text-xs">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => update('page', String(page + 1))}
          className="btn ghost disabled:opacity-40"
          style={{ padding: '5px 12px', fontSize: 'var(--t-caption1)' }}
        >
          →
        </button>
      </div>
    </div>
  );
}
