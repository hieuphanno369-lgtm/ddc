'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TOOLTIP_STYLE } from '@/components/dashboard/charts';
import { useChartTokens } from '@/components/dashboard/useChartTokens';
import { buildShiftBars, monthLabel, shiftChartMonths, shiftsForMonth, type ShiftBarDatum, type ShiftInfo } from '@/lib/manpower-charts';
import type { ShiftChartData } from '@/server/manpower-queries';

/** Chart ca × nhà thầu (T12b Q2): mỗi nhà thầu 1 nhóm cột, mỗi ca 1 cột. */
export function ShiftManpowerChart({ data, initialMonth }: { data: ShiftChartData; initialMonth: string }) {
  const t = useTranslations();
  const c = useChartTokens();
  const [month, setMonth] = useState(initialMonth);
  const months = shiftChartMonths(data.rows, initialMonth);
  const shifts = shiftsForMonth(data.rows, month, data.shifts);
  const bars = buildShiftBars(data.rows, month, data.contractors);
  const palette = [c.actual, c.third, c.cost, c.plan, c.thirdLt, c.neutral, c.accent2];

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <select
          className="inp"
          style={{ width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)' }}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>
      {bars.length === 0 ? (
        <p className="empty">{t('manpowerCharts.noDataMonth', { month: monthLabel(month) })}</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={bars} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} content={shiftTooltip(shifts, t)} />
            {shifts.map((s, i) => (
              <Bar
                key={s.code}
                dataKey={(d: ShiftBarDatum) => d.actual[s.code] ?? 0}
                name={s.name}
                fill={palette[i % palette.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function shiftTooltip(shifts: ShiftInfo[], t: ReturnType<typeof useTranslations>) {
  return ({ active, payload }: { active?: boolean; payload?: { payload?: ShiftBarDatum }[] }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    if (!row) return null;
    return (
      <div style={TOOLTIP_STYLE.contentStyle}>
        <div style={TOOLTIP_STYLE.labelStyle}>{row.name}</div>
        {shifts.map((s) => {
          const actual = row.actual[s.code] ?? 0;
          const planned = row.planned[s.code] ?? 0;
          const days = row.days[s.code] ?? 0;
          const pct = planned === 0 ? '-' : `${Math.round((actual / planned) * 100)}%`;
          return (
            <div key={s.code} style={TOOLTIP_STYLE.itemStyle}>
              {s.name}: {t('manpowerCharts.tipLine', { actual, planned, pct, days })}
            </div>
          );
        })}
      </div>
    );
  };
}
