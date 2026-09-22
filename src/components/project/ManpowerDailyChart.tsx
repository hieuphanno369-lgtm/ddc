'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/dashboard/charts';
import { groupByBucket, yearsLabel, type Bucket, type DailyPoint } from '@/lib/daily-series';

/**
 * Nhân lực kế hoạch vs thực tế, drill-down theo TUẦN hoặc THÁNG.
 * Trục X là khoảng ngày thật ('21.09 - 27.09') nên không có năm → năm nằm ở badge góc trái.
 * Màu bám bộ đỏ-vàng của dashboard: kế hoạch = vàng, thực tế = đỏ.
 */
export function ManpowerDailyChart({ data }: { data: DailyPoint[] }) {
  const t = useTranslations();
  const [bucket, setBucket] = useState<Bucket>('week');
  const series = groupByBucket(data, bucket);

  if (series.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{t('detail.noDailyData')}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">
          {yearsLabel(series)}
        </span>
        <div className="flex gap-1">
          {(['week', 'month'] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-md px-2 py-1 text-xs ${
                bucket === b ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t(b === 'week' ? 'detail.byWeek' : 'detail.byMonth')}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="planned"
            name={t('detail.plannedHeadcount')}
            stroke={CHART_COLORS.ac}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name={t('detail.actualHeadcount')}
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
