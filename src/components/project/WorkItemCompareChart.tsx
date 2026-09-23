'use client';

import { useTranslations } from 'next-intl';
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { TOOLTIP_STYLE } from '@/components/dashboard/charts';
import { useChartTokens } from '@/components/dashboard/useChartTokens';
import type { WorkItemCompareRow } from '@/lib/stage-timeline';

export function WorkItemCompareChart({ rows, locale }: { rows: WorkItemCompareRow[]; locale: string }) {
  const t = useTranslations();
  const c = useChartTokens();
  const nf = (v: number) => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 }).format(v);
  const data = rows.map((r) => ({ ...r, short: r.name.length > 19 ? `${r.name.slice(0, 18)}…` : r.name }));

  return (
    <div>
      <div className="hintline">{t('detail.cmp.unit')}</div>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 18, right: 10, left: 0, bottom: 0 }} barGap={3} barCategoryGap="17%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="short" interval={0} angle={-38} textAnchor="end" height={92} tick={{ fontSize: 10, fill: c.label2 }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis width={48} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} tickFormatter={(v: number) => nf(v)} />
          <Tooltip cursor={{ fill: c.grid }} content={({ active, payload }) => <CompareTip active={active} row={payload?.[0]?.payload as WorkItemCompareRow | undefined} nf={nf} />} />
          <Bar dataKey="planned" name={t('detail.planned')} fill={c.plan} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="planned" position="top" fontSize={9} fontWeight={700} fill={c.label2} formatter={(v: unknown) => nf(Number(v))} />
          </Bar>
          <Bar dataKey="actual" name={t('detail.actual')} fill={c.actual} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="actual" position="top" fontSize={9} fontWeight={700} fill={c.actual} formatter={(v: unknown) => nf(Number(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompareTip({ active, row, nf }: { active?: boolean; row?: WorkItemCompareRow; nf: (v: number) => string }) {
  const t = useTranslations();
  if (!active || !row) return null;
  const unit = t('detail.cmp.unit');
  const pct = row.planned > 0 ? `${((row.actual / row.planned) * 100).toFixed(1)}%` : '-';
  return (
    <div style={TOOLTIP_STYLE.contentStyle}>
      <div style={TOOLTIP_STYLE.labelStyle}>{row.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: 'var(--label2)' }}>
        <span>{t('detail.planned')}</span><span>{nf(row.planned)} {unit}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: 'var(--label2)' }}>
        <span>{t('detail.actual')}</span><span>{nf(row.actual)} {unit}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: 'var(--label2)' }}>
        <span>{t('detail.cmp.diff')}</span><span style={{ color: 'var(--danger)' }}>{nf(row.actual - row.planned)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: 'var(--label2)' }}>
        <span>{t('detail.cmp.pct')}</span><span>{pct}</span>
      </div>
    </div>
  );
}
