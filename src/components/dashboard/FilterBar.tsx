'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { marketKey, statusKey, typeKey } from '@/lib/labels';
import { IconFilter } from '@/components/icons';
import { HelpTip } from '@/components/ui/HelpTip';
import { MARKETS, PRIORITIES, STATUSES, TYPES } from '@/lib/overview-params';
import type { IsoDate, YearMonth } from '@/lib/clock';
import type { Period } from '@/lib/period';
import { formatDate } from '@/lib/format';
import { formatMonthShort } from '@/lib/period-format';

const SCOPE_KEYS = ['status', 'team', 'customer', 'priority', 'market', 'type', 'search', 'groupBy', 'groupKey', 'page'];

export function FilterBar({
  teams,
  customers,
  period,
  asOfDate,
  months,
  count,
  total,
}: {
  teams: { id: number; name: string }[];
  customers: { id: number; name: string }[];
  period: Period;
  asOfDate: IsoDate;
  months: YearMonth[];
  /** Số dự án sau khi lọc; total = số dự án thuộc kỳ, chưa lọc chiều nào. */
  count: number;
  total: number;
}) {
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

  // Đổi 1 đầu của kỳ: luôn ghi CẢ from và to (parsePeriod chỉ nhận cặp hợp lệ) và bỏ `month` cũ.
  function updatePeriod(edge: 'from' | 'to', value: string) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', edge === 'from' ? value : period.from);
    params.set('to', edge === 'to' ? value : period.to);
    params.delete('month');
    params.delete('page');
    router.replace(`?${params}`, { scroll: false });
  }

  // "Xoá tất cả lọc" chỉ xoá các chiều lọc, GIỮ kỳ (from/to hoặc month).
  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of SCOPE_KEYS) params.delete(k);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  function clearChartChip() {
    update('groupKey', null);
  }

  const activeCount = SCOPE_KEYS.filter((k) => searchParams.get(k) && k !== 'page').length;
  const groupBy = searchParams.get('groupBy');
  const groupKey = searchParams.get('groupKey');
  const groupKeyLabel = groupKey
    ? groupBy === 'type'
      ? t(typeKey[groupKey as keyof typeof typeKey] ?? 'type.other')
      : groupBy === 'market'
        ? t(marketKey[groupKey as keyof typeof marketKey] ?? 'market.domestic')
        : groupKey
    : null;

  /** Ô chọn có tên chiều lọc: đang chọn thì hiện "Tên chiều: giá trị" (F-4). */
  const named = (dim: string, value: string) => t('filterChip.named', { dim, value });

  const selectCls = 'inp';
  const selStyle = { width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)' } as const;

  const select = (param: string, dim: string, options: { value: string; text: string }[]) => {
    const current = searchParams.get(param) ?? 'all';
    return (
      <select className={selectCls} style={selStyle} aria-label={dim} value={current} onChange={(e) => update(param, e.target.value)}>
        <option value="all">{dim}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{current === o.value ? named(dim, o.text) : o.text}</option>
        ))}
      </select>
    );
  };

  const periodInputStyle = { ...selStyle, minWidth: 138 } as const;
  const summary = t('period.summary', {
    from: formatDate(period.from, locale),
    to: formatDate(period.to, locale),
    m1: formatMonthShort(months[0] ?? period.from.slice(0, 7)),
    m2: formatMonthShort(months[months.length - 1] ?? period.to.slice(0, 7)),
    asOf: formatDate(asOfDate, locale),
  });

  return (
    <>
      <div className="card overflow-visible flex flex-wrap items-center gap-2 px-3 py-3">
        <span className="flex items-center gap-1.5 px-1 text-caption1 font-semibold text-label2">
          <IconFilter size={15} />
          {t('common.filter')}
        </span>

        <span className="flex items-center gap-1.5 text-caption1 text-label2">
          {t('period.label')}
          <HelpTip text={t('helpTip.ovPeriod')} label={t('common.explain')} />
        </span>
        <label className="flex items-center gap-1.5 text-caption1 text-label2">
          {t('period.from')}
          <input
            type="date"
            className={selectCls}
            style={periodInputStyle}
            value={period.from}
            onChange={(e) => updatePeriod('from', e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-caption1 text-label2">
          {t('period.to')}
          <input
            type="date"
            className={selectCls}
            style={periodInputStyle}
            value={period.to}
            onChange={(e) => updatePeriod('to', e.target.value)}
          />
        </label>

        {select('status', t('common.status'), STATUSES.map((v) => ({ value: v, text: t(statusKey[v]) })))}
        {select('team', t('common.team'), teams.map((tm) => ({ value: String(tm.id), text: tm.name })))}
        {select('customer', t('common.customer'), customers.map((c) => ({ value: String(c.id), text: c.name })))}
        {select('priority', t('common.priority'), PRIORITIES.map((v) => ({ value: v, text: v })))}
        {select('market', t('common.market'), MARKETS.map((v) => ({ value: v, text: t(marketKey[v]) })))}
        {select('type', t('common.type'), TYPES.map((v) => ({ value: v, text: t(typeKey[v]) })))}

        {groupKeyLabel && (
          <button type="button" onClick={clearChartChip} className="chip c-info cursor-pointer" data-testid="chip-from-chart">
            {t('filterChip.fromChart', { value: groupKeyLabel })} ✕
          </button>
        )}

        {activeCount > 0 && (
          <button onClick={clearAll} className="btn ghost" style={{ padding: '5px 10px', fontSize: 'var(--t-caption1)' }}>
            ✕ {t('filterChip.clearAll')}
          </button>
        )}

        <span className="ml-auto text-caption1 font-semibold text-label2" data-testid="filter-count">
          {t('filterChip.count', { n: count, total })}
        </span>
      </div>
      <p className="hintline" data-testid="period-summary">{summary}</p>
    </>
  );
}
