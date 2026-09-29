'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { YearMonth } from '@/lib/clock';
import type { Period } from '@/lib/period';
import { formatMonthShort } from '@/lib/period-format';
import { HelpTip } from '@/components/ui/HelpTip';
import { IconChevronRight } from '@/components/icons';

/**
 * Thanh kỳ + mốc tháng đầu trang Chi tiết (P4 D-14): "‹ [tháng] ›" đổi tháng mốc, 2 ô "Từ ngày/Đến ngày" đổi kỳ.
 * Chỉ đổi URL (`month`, `from`, `to`), trang server render lại; không fetch phía client.
 */
export function DetailTimeBar({
  period,
  asOfMonth,
  monthsInPeriod,
  lastDataMonth,
}: {
  period: Period;
  asOfMonth: YearMonth;
  /** Các tháng chọn được (trong kỳ, tới tháng mốc tối đa của kỳ), cũ -> mới. */
  monthsInPeriod: YearMonth[];
  lastDataMonth: YearMonth | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  // Đổi tháng mốc thì bỏ `day` để ngày nguồn lực về mặc định (cuối tháng đó).
  const setMonth = (m: YearMonth) => go((p) => { p.set('month', m); p.delete('day'); });
  const setEdge = (edge: 'from' | 'to', value: string) => {
    if (!value) return;
    go((p) => {
      p.set('from', edge === 'from' ? value : period.from);
      p.set('to', edge === 'to' ? value : period.to);
    });
  };

  const idx = monthsInPeriod.indexOf(asOfMonth);
  const prev = idx > 0 ? monthsInPeriod[idx - 1] : null;
  const next = idx >= 0 && idx < monthsInPeriod.length - 1 ? monthsInPeriod[idx + 1] : null;
  const carried = lastDataMonth != null && asOfMonth > lastDataMonth;
  const inpStyle = { width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)', minWidth: 138 } as const;
  const navBtn = { padding: '5px 9px', fontSize: 'var(--t-caption1)' } as const;

  return (
    <div className="card overflow-visible flex flex-wrap items-center gap-2 px-3 py-3" data-testid="detail-time-bar">
      <span className="flex items-center gap-1.5 text-caption1 font-semibold text-label2">
        {t('asOf.pickMonth')}
        <HelpTip text={t('helpTip.dtAsOf')} label={t('common.explain')} />
      </span>
      <button type="button" className="btn ghost" style={navBtn} disabled={!prev} onClick={() => prev && setMonth(prev)} aria-label={t('asOf.prevMonth')} title={t('asOf.prevMonth')} data-testid="month-prev">
        <IconChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <select
        className="inp"
        style={{ ...inpStyle, minWidth: 96 }}
        value={asOfMonth}
        aria-label={t('asOf.pickMonth')}
        onChange={(e) => setMonth(e.target.value)}
        data-testid="month-select"
      >
        {(monthsInPeriod.includes(asOfMonth) ? monthsInPeriod : [...monthsInPeriod, asOfMonth]).map((m) => (
          <option key={m} value={m}>{formatMonthShort(m)}</option>
        ))}
      </select>
      <button type="button" className="btn ghost" style={navBtn} disabled={!next} onClick={() => next && setMonth(next)} aria-label={t('asOf.nextMonth')} title={t('asOf.nextMonth')} data-testid="month-next">
        <IconChevronRight size={14} />
      </button>
      {carried && lastDataMonth && (
        <span className="chip c-warn" data-testid="carried-chip">{t('asOf.carried', { month: formatMonthShort(lastDataMonth) })}</span>
      )}

      <label className="ml-auto flex items-center gap-1.5 text-caption1 text-label2">
        {t('period.from')}
        <input type="date" className="inp" style={inpStyle} value={period.from} onChange={(e) => setEdge('from', e.target.value)} />
      </label>
      <label className="flex items-center gap-1.5 text-caption1 text-label2">
        {t('period.to')}
        <input type="date" className="inp" style={inpStyle} value={period.to} onChange={(e) => setEdge('to', e.target.value)} />
      </label>
    </div>
  );
}
