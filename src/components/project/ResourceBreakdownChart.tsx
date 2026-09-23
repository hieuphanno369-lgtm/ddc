'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSpringProgress, staggered } from '@/components/ui/motion';
import { mobilizationRatio, mobilizationTone, mobilizationTotalTone, TONE_VAR, type ResourceRow } from '@/lib/resources';
import { ChartTip, useChartTip } from './ChartTip';

const W = 560, ROW_H = 32, HEAD = 24, FOOT = 32, ML = 152, MR = 126;
const IW = W - ML - MR, C_KH = W - 92, C_TT = W - 46, C_PC = W - 4;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function ResourceBreakdownChart({ rows, kind }: { rows: ResourceRow[]; kind: 'manpower' | 'equipment' }) {
  const t = useTranslations();
  const locale = useLocale();
  const p = useSpringProgress('smooth');
  const { tip, show, hide } = useChartTip();

  const nf = (n: number, d = 0) =>
    new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

  if (rows.length === 0) return <p className="empty">{t('detail.noDailyData')}</p>;

  const H = HEAD + rows.length * ROW_H + FOOT;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual)));
  const colorTT = kind === 'manpower' ? 'var(--s-third)' : 'var(--s-cost)';
  const unit = t(kind === 'manpower' ? 'detail.res.people' : 'detail.res.units');
  const title = t(kind === 'manpower' ? 'detail.res.manTitle' : 'detail.res.eqpTitle');

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalRatio = mobilizationRatio(totalActual, totalPlanned);
  const ty = HEAD + rows.length * ROW_H;

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <text x={ML} y={14} fontSize={9.5} fontWeight={800} letterSpacing={0.4} style={{ fill: 'var(--label3)' }}>{t('detail.res.header')}</text>
        <text x={C_KH} y={14} textAnchor="end" fontSize={9.5} fontWeight={800} letterSpacing={0.4} style={{ fill: 'var(--label3)' }}>{t('detail.res.planShort')}</text>
        <text x={C_TT} y={14} textAnchor="end" fontSize={9.5} fontWeight={800} letterSpacing={0.4} style={{ fill: 'var(--label3)' }}>{t('detail.res.actualShort')}</text>
        <text x={C_PC} y={14} textAnchor="end" fontSize={9.5} fontWeight={800} letterSpacing={0.4} style={{ fill: 'var(--label3)' }}>{t('detail.res.rate')}</text>
        <line x1={0} x2={W} y1={HEAD - 5} y2={HEAD - 5} style={{ stroke: 'var(--sep)' }} />
        {rows.map((r, i) => {
          const top = HEAD + i * ROW_H;
          const cy = top + ROW_H / 2;
          const k = staggered(p, i, rows.length);
          const ratio = mobilizationRatio(r.actual, r.planned);
          const rows5 = [
            { k: t('detail.res.owner'), v: r.note || '-' },
            { k: t('detail.planned'), v: `${nf(r.planned)} ${unit}`, color: 'var(--s-plan)' },
            { k: t('detail.actual'), v: `${nf(r.actual)} ${unit}`, color: colorTT },
            { k: t('detail.res.shortfall'), v: `${nf(r.planned - r.actual)} ${unit}`, valueColor: r.planned > r.actual ? 'var(--danger)' : 'var(--label)' },
            { k: t('detail.res.rate'), v: ratio == null ? '-' : `${nf(ratio * 100, 1)}%` },
          ];
          return (
            <g key={r.id}>
              {i > 0 && <line x1={0} x2={W} y1={top} y2={top} style={{ stroke: 'var(--grid)' }} />}
              <text x={4} y={cy - 2} fontSize={10.5} fontWeight={650} style={{ fill: 'var(--label)' }}>{cut(r.name, 24)}</text>
              <text x={4} y={cy + 10} fontSize={9} style={{ fill: 'var(--label3)' }}>{cut(r.note, 28)}</text>
              <rect x={ML} y={cy - 9} height={7} rx={3.5} width={Math.max((IW * r.planned / max) * k, 2)} style={{ fill: 'var(--s-plan)' }} />
              <rect x={ML} y={cy + 2} height={7} rx={3.5} width={Math.max((IW * r.actual / max) * k, 2)} style={{ fill: colorTT }} />
              <text x={C_KH} y={cy + 4} textAnchor="end" fontSize={11} fontWeight={700} style={{ fill: 'var(--label2)' }}>{nf(r.planned)}</text>
              <text x={C_TT} y={cy + 4} textAnchor="end" fontSize={11} fontWeight={800} style={{ fill: colorTT }}>{nf(r.actual)}</text>
              <text x={C_PC} y={cy + 4} textAnchor="end" fontSize={10.5} fontWeight={800} style={{ fill: TONE_VAR[mobilizationTone(ratio)] }}>
                {ratio == null ? '-' : `${nf(ratio * 100)}%`}
              </text>
              <rect x={0} y={top} width={W} height={ROW_H} fill="transparent"
                onMouseMove={(ev) => show(ev, r.name, rows5)} onMouseLeave={hide} />
            </g>
          );
        })}
        <line x1={0} x2={W} y1={ty} y2={ty} strokeWidth={1.4} style={{ stroke: 'var(--sep-2)' }} />
        <text x={4} y={ty + 20} fontSize={10.5} fontWeight={800} style={{ fill: 'var(--label)' }}>
          {t(kind === 'manpower' ? 'detail.res.totalMan' : 'detail.res.totalEqp', { n: rows.length })}
        </text>
        <text x={C_KH} y={ty + 20} textAnchor="end" fontSize={11.5} fontWeight={800} style={{ fill: 'var(--label2)' }}>{nf(totalPlanned)}</text>
        <text x={C_TT} y={ty + 20} textAnchor="end" fontSize={11.5} fontWeight={800} style={{ fill: colorTT }}>{nf(totalActual)}</text>
        <text x={C_PC} y={ty + 20} textAnchor="end" fontSize={10.5} fontWeight={800} style={{ fill: TONE_VAR[mobilizationTotalTone(totalRatio)] }}>
          {totalRatio == null ? '-' : `${nf(totalRatio * 100, 1)}%`}
        </text>
      </svg>
      <ChartTip tip={tip} />
    </>
  );
}
