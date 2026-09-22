'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Market, Priority, ProjectType, Status } from '@/server/repo/types';
import { marketKey, statusKey, typeKey } from '@/lib/labels';
import { IconFilter } from '@/components/icons';

const STATUSES: Status[] = ['Chuan_bi', 'Dang_trien_khai', 'Hoan_thanh', 'Tam_dung'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const MARKETS: Market[] = ['TN', 'XK', 'NoiBo'];
const TYPES: ProjectType[] = [
  'EPC',
  'San_van_dong',
  'San_bay',
  'Nha_xuong',
  'Cau_cang',
  'Cao_tang',
  'Dong_tau',
  'Cau_giao_thong',
  'Khac',
];

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

  const selectCls =
    'h-8 rounded-lg border border-slate-200 bg-white/70 px-2 text-xs text-navy-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200';

  return (
    <div className="card flex flex-wrap items-center gap-2 px-3 py-3">
      <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-slate-500">
        <IconFilter size={15} className="text-slate-500" />
        {t('common.filter')}
      </span>

      <select className={selectCls} value={searchParams.get('month') ?? currentMonth} onChange={(e) => update('month', e.target.value)}>
        <option value="all">{t('common.all')}</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select className={selectCls} value={searchParams.get('status') ?? 'all'} onChange={(e) => update('status', e.target.value)}>
        <option value="all">{t('common.status')}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{t(statusKey[s])}</option>
        ))}
      </select>

      <select className={selectCls} value={searchParams.get('team') ?? 'all'} onChange={(e) => update('team', e.target.value)}>
        <option value="all">{t('common.team')}</option>
        {teams.map((tm) => (
          <option key={tm.id} value={tm.id}>{tm.name}</option>
        ))}
      </select>

      <select className={selectCls} value={searchParams.get('customer') ?? 'all'} onChange={(e) => update('customer', e.target.value)}>
        <option value="all">{t('common.customer')}</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select className={selectCls} value={searchParams.get('priority') ?? 'all'} onChange={(e) => update('priority', e.target.value)}>
        <option value="all">{t('common.priority')}</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select className={selectCls} value={searchParams.get('market') ?? 'all'} onChange={(e) => update('market', e.target.value)}>
        <option value="all">{t('common.market')}</option>
        {MARKETS.map((m) => (
          <option key={m} value={m}>{t(marketKey[m])}</option>
        ))}
      </select>

      <select className={selectCls} value={searchParams.get('type') ?? 'all'} onChange={(e) => update('type', e.target.value)}>
        <option value="all">{t('common.type')}</option>
        {TYPES.map((ty) => (
          <option key={ty} value={ty}>{t(typeKey[ty])}</option>
        ))}
      </select>

      {activeCount > 0 && (
        <button onClick={clearAll} className="rounded-lg bg-accent-soft px-2 py-1.5 text-xs text-accent hover:bg-accent-soft/70">
          ✕ {t('common.filter')}
        </button>
      )}
    </div>
  );
}
