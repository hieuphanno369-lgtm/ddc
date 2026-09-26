'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Status } from '@/server/repo/types';
import { statusKey, typeKey, marketKey } from '@/lib/labels';
import type { GroupBy } from '@/server/queries';
import { GroupBar, StatusDonut } from './charts';
import { useChartTokens } from './useChartTokens';

function useDrill() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === 'all' || v === '') params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };
}

export function DrillDonut({ data }: { data: { status: Status; value: number }[] }) {
  const t = useTranslations();
  const drill = useDrill();
  const c = useChartTokens();
  const STATUS_COLOR: Record<Status, string> = {
    Chuan_bi: c.plan,
    Dang_trien_khai: c.actual,
    Hoan_thanh: c.third,
    Tam_dung: c.cost,
  };
  const chartData = data.map((d) => ({
    status: d.status,
    value: d.value,
    label: t(statusKey[d.status]),
    color: STATUS_COLOR[d.status],
  }));
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <StatusDonut
        data={chartData}
        onSelect={(s) => drill({ status: s })}
        center={{ value: String(total), label: t('kpi.totalProjects') }}
      />
      <div className="mt-2 space-y-1.5">
        {chartData.map((d) => (
          <button
            key={d.status}
            onClick={() => drill({ status: d.status })}
            className="flex w-full items-center gap-2 rounded-xs px-2 py-1 text-caption1 transition-colors duration-fast hover:bg-fill"
          >
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: d.color }} />
            <span className="flex-1 text-left text-label2">{d.label}</span>
            <span className="font-bold">{d.value}</span>
            <span className="text-label3">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function GroupByCard({
  data,
  groupBy,
  showValue = true,
}: {
  data: { key: string; tonnage: number; value: number | null }[];
  groupBy: GroupBy;
  showValue?: boolean;
}) {
  const t = useTranslations();
  const drill = useDrill();

  const groupLabel =
    groupBy === 'team' ? t('overview.groupTeam') : groupBy === 'type' ? t('overview.groupType') : t('overview.groupMarket');
  const displayKey = (key: string) => {
    if (groupBy === 'type') return t(typeKey[key as keyof typeof typeKey] ?? 'type.other');
    if (groupBy === 'market') return t(marketKey[key as keyof typeof marketKey] ?? 'market.domestic');
    return key;
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-footnote font-semibold">
          {showValue ? t('overview.tonnageValueByTeam', { group: groupLabel }) : t('financeGate.tonnageByGroup', { group: groupLabel })}
        </span>
        <select
          value={groupBy}
          onChange={(e) => drill({ groupBy: e.target.value, groupKey: '' })}
          className="inp"
          style={{ width: 'auto', padding: '4px 9px', fontSize: 'var(--t-caption1)' }}
        >
          <option value="team">{t('overview.groupTeam')}</option>
          <option value="type">{t('overview.groupType')}</option>
          <option value="market">{t('overview.groupMarket')}</option>
        </select>
      </div>
      <GroupBar
        data={data.map((d) => ({ ...d, key: displayKey(d.key) }))}
        showValue={showValue}
        onSelect={(key) => {
          const raw = data.find((d) => displayKey(d.key) === key);
          if (raw) drill({ groupBy, groupKey: raw.key });
        }}
      />
    </div>
  );
}
