'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { marketKey, statusKey, typeKey } from '@/lib/labels';
import { IconFilter } from '@/components/icons';
import { MARKETS, PRIORITIES, STATUSES, TYPES } from '@/lib/overview-params';

const SCOPE_KEYS = ['status', 'team', 'customer', 'priority', 'market', 'type', 'search', 'groupBy', 'groupKey', 'page'];

export function FilterBar({
  teams,
  customers,
  months,
  currentMonth,
}: {
  teams: { id: number; name: string }[];
  customers: { id: number; name: string }[];
  months: string[];
  currentMonth: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else if (key === 'month') params.set(key, value); // month giữ 'all' để hiển thị "Tất cả"
    else if (value === 'all') params.delete(key);
    else params.set(key, value);
    if (key !== 'page') params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    const month = params.get('month');
    for (const k of SCOPE_KEYS) params.delete(k);
    if (month) params.set('month', month);
    router.replace(`?${params}`, { scroll: false });
  }

  const activeCount = SCOPE_KEYS.filter((k) => searchParams.get(k) && k !== 'page').length;

  const selectCls = 'inp';
  const selStyle = { width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)' } as const;

  return (
    <div className="card overflow-visible flex flex-wrap items-center gap-2 px-3 py-3">
      <span className="flex items-center gap-1.5 px-1 text-caption1 font-semibold text-label2">
        <IconFilter size={15} />
        {t('common.filter')}
      </span>

      <select className={selectCls} style={selStyle} value={searchParams.get('month') ?? currentMonth} onChange={(e) => update('month', e.target.value)}>
        <option value="all">{t('common.all')}</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select className={selectCls} style={selStyle} value={searchParams.get('status') ?? 'all'} onChange={(e) => update('status', e.target.value)}>
        <option value="all">{t('common.status')}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{t(statusKey[s])}</option>
        ))}
      </select>

      <select className={selectCls} style={selStyle} value={searchParams.get('team') ?? 'all'} onChange={(e) => update('team', e.target.value)}>
        <option value="all">{t('common.team')}</option>
        {teams.map((tm) => (
          <option key={tm.id} value={tm.id}>{tm.name}</option>
        ))}
      </select>

      <select className={selectCls} style={selStyle} value={searchParams.get('customer') ?? 'all'} onChange={(e) => update('customer', e.target.value)}>
        <option value="all">{t('common.customer')}</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select className={selectCls} style={selStyle} value={searchParams.get('priority') ?? 'all'} onChange={(e) => update('priority', e.target.value)}>
        <option value="all">{t('common.priority')}</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select className={selectCls} style={selStyle} value={searchParams.get('market') ?? 'all'} onChange={(e) => update('market', e.target.value)}>
        <option value="all">{t('common.market')}</option>
        {MARKETS.map((m) => (
          <option key={m} value={m}>{t(marketKey[m])}</option>
        ))}
      </select>

      <select className={selectCls} style={selStyle} value={searchParams.get('type') ?? 'all'} onChange={(e) => update('type', e.target.value)}>
        <option value="all">{t('common.type')}</option>
        {TYPES.map((ty) => (
          <option key={ty} value={ty}>{t(typeKey[ty])}</option>
        ))}
      </select>

      {activeCount > 0 && (
        <button onClick={clearAll} className="btn ghost" style={{ padding: '5px 10px', fontSize: 'var(--t-caption1)' }}>
          ✕ {t('common.filter')}
        </button>
      )}
    </div>
  );
}
