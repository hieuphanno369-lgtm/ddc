'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { TOOLTIP_STYLE } from '@/components/dashboard/charts';
import { useChartTokens } from '@/components/dashboard/useChartTokens';
import { groupByBucket, yearsLabel, type Bucket, type DailyPoint } from '@/lib/daily-series';

/**
 * Nhân lực kế hoạch vs thực tế, drill-down theo TUẦN hoặc THÁNG.
 * Trục X là khoảng ngày thật ('21.09 - 27.09') nên không có năm → năm nằm ở badge góc trái.
 * Mau bam bo series cua mock-up: ke hoach = --s-plan, thuc te = --s-third (mock-up dong 762).
 */
export function ManpowerDailyChart({ data }: { data: DailyPoint[] }) {
  const t = useTranslations();
  const c = useChartTokens();
  const [bucket, setBucket] = useState<Bucket>('week');
  const series = groupByBucket(data, bucket);

  if (series.length === 0) {
    return <p className="empty">{t('detail.noDailyData')}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="chip c-plain">
          {yearsLabel(series)}
        </span>
        <div className="seg">
          {(['week', 'month'] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={bucket === b ? 'on' : ''}
            >
              {t(b === 'week' ? 'detail.byWeek' : 'detail.byMonth')}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: c.axis }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: c.axis }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
          <Line
            type="monotone"
            dataKey="planned"
            name={t('detail.plannedHeadcount')}
            stroke={c.plan}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name={t('detail.actualHeadcount')}
            stroke={c.third}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
