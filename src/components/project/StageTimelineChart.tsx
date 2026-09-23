'use client';

import { useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { formatDateShort } from '@/lib/format';
import { stageKey } from '@/lib/labels';
import { buildTimeDomain, stageMarkers, xOf, type StageMarkerShape, type StageTimelineRow } from '@/lib/stage-timeline';
import type { StageCode } from '@/server/repo/types';
import { ChartTip, useChartTip } from './ChartTip';
import { varianceColor, varianceText } from './stageText';

const W = 1000, ROW_H = 54, MT = 56, MB = 16, ML = 212, MR = 132, IW = W - ML - MR, BH = 9;

function Marker({ shape, x, y, color }: { shape: StageMarkerShape; x: number; y: number; color: string }) {
  if (shape === 'ring') return <circle cx={x} cy={y} r={5.4} strokeWidth={2.4} style={{ fill: 'var(--glass-3)', stroke: color }} />;
  if (shape === 'dot') return <circle cx={x} cy={y} r={5.6} strokeWidth={1.6} style={{ fill: color, stroke: 'var(--glass-3)' }} />;
  if (shape === 'diamondO') return <rect x={x - 4.9} y={y - 4.9} width={9.8} height={9.8} rx={1} strokeWidth={2.2} transform={`rotate(45 ${x} ${y})`} style={{ fill: 'var(--glass-3)', stroke: color }} />;
  if (shape === 'diamond') return <rect x={x - 5} y={y - 5} width={10} height={10} rx={1} strokeWidth={1.4} transform={`rotate(45 ${x} ${y})`} style={{ fill: color, stroke: 'var(--glass-3)' }} />;
  return <path d={`M ${x} ${y - 6} L ${x + 5.5} ${y + 4.5} L ${x - 5.5} ${y + 4.5} Z`} strokeWidth={1.3} strokeLinejoin="round" style={{ fill: color, stroke: 'var(--glass-3)' }} />;
}

export function StageTimelineChart({ rows, today, selected, onToggle }: {
  rows: StageTimelineRow[]; today: IsoDate; selected: StageCode | null; onToggle: (c: StageCode) => void;
}) {
  const t = useTranslations();
  const { tip, show, hide } = useChartTip();
  const dom = buildTimeDomain(rows, today);
  if (!dom) return <p className="empty">{t('detail.stageMs.empty')}</p>;
  const X = (d: IsoDate) => xOf(d, dom, ML, IW);
  const H = MT + rows.length * ROW_H + MB;
  const tx = X(today);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('detail.stageMs.title')}>
        {dom.ticks.map((tk) => (
          <g key={tk.date}>
            <line x1={X(tk.date)} x2={X(tk.date)} y1={MT - 12} y2={MT + rows.length * ROW_H} style={{ stroke: 'var(--grid)' }} />
            {tk.label && <text x={X(tk.date)} y={MT - 19} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--axis)' }}>{tk.label}</text>}
          </g>
        ))}
        <line x1={tx} x2={tx} y1={19} y2={MT + rows.length * ROW_H + 4} strokeWidth={2} strokeDasharray="6 5" style={{ stroke: 'var(--danger)' }} />
        <rect x={tx - 36} y={1} width={72} height={20} rx={10} style={{ fill: 'var(--danger)' }} />
        <text x={tx} y={14.5} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="white">{t('common.today')}</text>
        <text x={W - 6} y={MT - 19} textAnchor="end" fontSize={9.5} fontWeight={800} style={{ fill: 'var(--label3)' }}>{t('detail.stageMs.varianceCol')}</text>
        {rows.map((r, i) => {
          const top = MT + i * ROW_H;
          const cy = top + ROW_H / 2;
          const pY = cy - 13;
          const aY = cy + 4;
          const on = selected === r.stageCode;
          const aEnd = r.actualFinish ?? r.forecastDate;
          const title = r.weightPct == null ? t(stageKey[r.stageCode]) : `${t(stageKey[r.stageCode])} · ${t('detail.stageMs.weight', { n: r.weightPct })}`;
          const tipRows = [
            ...STAGE_MARKER_ROWS(t, r),
            { k: t('detail.stageMs.variance'), v: varianceText(t, r.dayVariance), valueColor: varianceColor(r.dayVariance, 'var(--label)') },
          ];
          return (
            <g key={r.stageCode}>
              {on && <rect x={2} y={top + 3} width={W - 4} height={ROW_H - 6} rx={10} strokeWidth={1.2} style={{ fill: 'var(--accent-tint)', stroke: 'var(--accent)' }} />}
              {i > 0 && <line x1={0} x2={W} y1={top} y2={top} style={{ stroke: 'var(--grid)' }} />}
              <text x={8} y={cy + 5} fontSize={14} fontWeight={700} style={{ fill: on ? 'var(--accent)' : 'var(--label)' }}>{t(stageKey[r.stageCode])}</text>
              <text x={196} y={cy + 5} textAnchor="end" fontSize={11} fontWeight={800} style={{ fill: 'var(--label3)' }}>{r.weightPct == null ? '-' : `${r.weightPct}%`}</text>
              {r.plannedStart && r.plannedFinish && (
                <rect x={X(r.plannedStart)} y={pY} width={Math.max(X(r.plannedFinish) - X(r.plannedStart), 3)} height={BH} rx={4.5} fillOpacity={0.55} style={{ fill: 'var(--s-plan)' }} />
              )}
              {r.actualStart && aEnd && (
                <rect x={X(r.actualStart)} y={aY} width={Math.max(X(aEnd) - X(r.actualStart), 3)} height={BH} rx={4.5} fillOpacity={0.42} style={{ fill: r.actualFinish ? 'var(--s-third)' : 'var(--s-cost)' }} />
              )}
              {stageMarkers(r).map((m) => (
                <Marker key={m.key} shape={m.shape} x={X(r[m.key]!)} y={(m.lane === 'plan' ? pY : aY) + BH / 2} color={m.color} />
              ))}
              <text x={W - 6} y={cy + 5} textAnchor="end" fontSize={13.5} fontWeight={800} style={{ fill: varianceColor(r.dayVariance, 'var(--label)') }}>{varianceText(t, r.dayVariance)}</text>
              <rect x={0} y={top} width={W} height={ROW_H} fill="transparent" style={{ cursor: 'pointer' }}
                onClick={() => onToggle(r.stageCode)}
                onMouseMove={(ev) => show(ev, title, tipRows)}
                onMouseLeave={hide}
              />
            </g>
          );
        })}
      </svg>
      <ChartTip tip={tip} />
    </>
  );
}

function STAGE_MARKER_ROWS(t: ReturnType<typeof useTranslations>, r: StageTimelineRow) {
  return [
    { k: t('detail.stageMs.plannedStart'), v: formatDateShort(r.plannedStart), color: 'var(--s-plan)' },
    { k: t('detail.stageMs.plannedFinish'), v: formatDateShort(r.plannedFinish), color: 'var(--s-actual)' },
    { k: t('detail.stageMs.actualStart'), v: formatDateShort(r.actualStart), color: 'var(--s-third-lt)' },
    { k: t('detail.stageMs.actualFinish'), v: formatDateShort(r.actualFinish), color: 'var(--s-third)' },
    { k: t('detail.stageMs.forecast'), v: formatDateShort(r.forecastDate), color: 'var(--s-cost)' },
  ];
}
