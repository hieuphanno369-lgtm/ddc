'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { ProjectSummary } from '@/server/queries';
import { typeKey } from '@/lib/labels';
import { formatPct, formatRatio, formatTyd } from '@/lib/format';
import { OnTrackBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badges';
import { IconChevronRight } from '@/components/icons';

interface Props {
  items: ProjectSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export function ProjectTable({ items, total, page, totalPages }: Props) {
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

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <h3 className="text-sm font-semibold text-navy-900">
          {t('overview.projectList')}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {total} {t('common.project').toLowerCase()}
          </span>
        </h3>
        <select
          value={searchParams.get('sort') ?? 'priority'}
          onChange={(e) => update('sort', e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-navy-800 focus:outline-none"
        >
          <option value="priority">Priority</option>
          <option value="value">{t('common.value')}</option>
          <option value="spi">SPI</option>
          <option value="pctActual">% TT</option>
          <option value="name">{t('form.projectName')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm table-zebra">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-medium">Mã DA</th>
              <th className="px-4 py-2.5 font-medium">{t('form.projectName')}</th>
              <th className="px-4 py-2.5 font-medium">{t('common.customer')}</th>
              <th className="px-4 py-2.5 font-medium">{t('common.team')}</th>
              <th className="px-4 py-2.5 font-medium">{t('common.type')}</th>
              <th className="px-4 py-2.5 font-medium">{t('common.priority')}</th>
              <th className="px-4 py-2.5 font-medium">{t('common.status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('onTrack.onTrack')}</th>
              <th className="px-4 py-2.5 text-right font-medium">% TT</th>
              <th className="px-4 py-2.5 text-right font-medium">SPI</th>
              <th className="px-4 py-2.5 text-right font-medium">CPI</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('metric.contractValue')}</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((s) => (
              <tr key={s.id} className="group">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.currentAliasCode}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/projects/${s.id}`} className="font-medium text-navy-900 hover:text-accent">
                    {s.projectName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{s.customerName}</td>
                <td className="px-4 py-2.5 text-slate-600">{s.teamName}</td>
                <td className="px-4 py-2.5 text-slate-600">{t(typeKey[s.projectType])}</td>
                <td className="px-4 py-2.5">
                  <PriorityBadge priority={s.priority} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-2.5">
                  <OnTrackBadge onTrack={s.onTrack} status={s.status} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatPct(s.pctActual, locale)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={s.spi != null && s.spi < 0.9 ? 'font-medium text-amber-600' : 'text-slate-700'}>
                    {formatRatio(s.spi)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={s.cpi != null && s.cpi < 0.9 ? 'font-medium text-amber-600' : 'text-slate-700'}>
                    {formatRatio(s.cpi)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatTyd(s.contractValue, locale)}</td>
                <td className="px-2 py-2.5">
                  <Link href={`/projects/${s.id}`} className="text-slate-300 hover:text-navy-500">
                    <IconChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-400">
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
        <button
          disabled={page <= 1}
          onClick={() => update('page', String(page - 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          ←
        </button>
        <span className="text-xs">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => update('page', String(page + 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}
