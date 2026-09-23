'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { formatDateShort } from '@/lib/format';
import { useSpringProgress } from '@/components/ui/motion';
import {
  KEY_MS_TONE_VAR, estimateLabelWidth, keyMilestoneState, keyMsDomain, layoutMilestoneLabels,
} from '@/lib/key-milestones';
import { monthTicks } from '@/lib/time-axis';
import type { ProjectKeyMilestone } from '@/server/repo/types';
import { ChartTip, useChartTip } from './ChartTip';
import { keyMsStateText } from './keyMsText';

const W = 1000, ML = 40, MR = 40, IW = W - ML - MR, LBH = 54;
const at = (m: ProjectKeyMilestone) => m.actualDate ?? m.plannedDate!;
const ms = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function KeyMilestoneChart({ milestones, today }: { milestones: ProjectKeyMilestone[]; today: IsoDate }) {
  const t = useTranslations();
  const grow = useSpringProgress('gentle');
  const pop = useSpringProgress('bouncy');
  const { tip, show, hide } = useChartTip();
  const gradId = `km-${useId().replace(/:/g, '')}`;

  const list = milestones.filter((m) => m.plannedDate).sort((a, b) => a.plannedDate!.localeCompare(b.plannedDate!));

  if (list.length === 0) {
    return (
      <svg className="chart" viewBox="0 0 1000 80" role="img" aria-label={t('detail.keyMs.title')}>
        <text x={500} y={46} textAnchor="middle" fontSize={13} style={{ fill: 'var(--label3)' }}>{t('detail.keyMs.empty')}</text>
      </svg>
    );
  }

  const { lo, hi } = keyMsDomain([...list.map(at), ...list.map((m) => m.plannedDate!)], today);
  const X = (d: IsoDate) => ML + IW * ((ms(d) - lo) / (hi - lo));

  const items = list.map((m) => {
    const st = keyMilestoneState(m.plannedDate!, m.actualDate, today);
    const label = keyMsStateText(t, st);
    return { m, st, label, x: X(at(m)), width: estimateLabelWidth(m.name, `${formatDateShort(at(m))} · ${label}`) };
  });
  const slots = layoutMilestoneLabels(items);

  const tiersUp = Math.max(0, ...slots.map((s) => (s.side === -1 ? s.tier + 1 : 0)));
  const tiersDn = Math.max(0, ...slots.map((s) => (s.side === 1 ? s.tier + 1 : 0)));
  const axisY = 26 + tiersUp * LBH;
  const H = axisY + 30 + tiersDn * LBH;

  const x1 = X(at(list[0]));
  const x2 = X(list[list.length - 1].plannedDate!);
  const tx = X(today);
  const dn = Math.max(0, Math.min(tx, x2) - x1);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('detail.keyMs.title')}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--accent-2)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)' }} />
          </linearGradient>
        </defs>
        {monthTicks(iso(lo), iso(hi)).map((tk) => (
          <g key={tk.date}>
            <line x1={X(tk.date)} x2={X(tk.date)} y1={axisY - 9} y2={axisY + 9} style={{ stroke: 'var(--grid)' }} />
            {tk.label && <text x={X(tk.date)} y={axisY + 24} textAnchor="middle" fontSize={10} fontWeight={600} style={{ fill: 'var(--axis)' }}>{tk.label}</text>}
          </g>
        ))}
        <rect x={x1} y={axisY - 5} width={Math.max(x2 - x1, 4)} height={10} rx={5} style={{ fill: 'var(--fill-2)' }} />
        <rect x={x1} y={axisY - 5} width={Math.max(dn * grow, 2)} height={10} rx={5} fill={`url(#${gradId})`} />
        <line x1={tx} x2={tx} y1={axisY - tiersUp * LBH - 18} y2={axisY + 22 + tiersDn * LBH} strokeWidth={2} strokeDasharray="6 5" style={{ stroke: 'var(--danger)' }} />
        <rect x={tx - 38} y={axisY - tiersUp * LBH - 36} width={76} height={20} rx={10} style={{ fill: 'var(--danger)' }} />
        <text x={tx} y={axisY - tiersUp * LBH - 22.5} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="white">{t('common.today')}</text>
        {items.map(({ m, st, label, x, width }, i) => {
          const sd = slots[i].side;
          const tier = slots[i].tier;
          const ly = axisY + sd * (26 + tier * LBH);
          const done = st.kind === 'done';
          const c = KEY_MS_TONE_VAR[st.tone];
          const ty = sd === -1 ? ly - 30 : ly + 4;
          const cw = label.length * 6 + 14;
          const rowsTip = [
            { k: t('detail.keyMs.plannedDate'), v: formatDateShort(m.plannedDate), color: 'var(--s-plan)' },
            ...(m.actualDate ? [{ k: t('detail.keyMs.actualDate'), v: formatDateShort(m.actualDate), color: 'var(--s-third)' }] : []),
            { k: t('detail.keyMs.status'), v: label, valueColor: c },
            ...(!done ? [{ k: t('detail.keyMs.prev'), v: i > 0 ? list[i - 1].name : t('detail.keyMs.first') }] : []),
          ];
          return (
            <g key={m.id}>
              <line x1={x} x2={x} y1={axisY + sd * 7} y2={ly - sd * 4} style={{ stroke: 'var(--sep-2)' }} strokeWidth={1.4} strokeDasharray="3 3" />
              {done && m.actualDate !== m.plannedDate && (
                <circle cx={X(m.plannedDate!)} cy={axisY} r={4.6} strokeWidth={2.2} style={{ fill: 'var(--glass-3)', stroke: 'var(--s-plan)' }} />
              )}
              <path
                d={`M ${x} ${axisY - 9} L ${x + 8} ${axisY} L ${x} ${axisY + 9} L ${x - 8} ${axisY} Z`}
                style={{ fill: done ? 'var(--s-third)' : 'var(--s-plan)', stroke: 'var(--glass-3)' }}
                strokeWidth={2}
                strokeLinejoin="round"
                transform={`translate(${x} ${axisY}) scale(${pop.toFixed(3)}) translate(${-x} ${-axisY})`}
              />
              <text x={x} y={ty + 12} textAnchor="middle" fontSize={13} fontWeight={700} style={{ fill: 'var(--label)' }}>{m.name}</text>
              <text x={x} y={ty + 27} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: 'var(--label2)' }}>{formatDateShort(at(m))}</text>
              <rect x={x - cw / 2} y={ty + 31} width={cw} height={15} rx={7.5} style={{ fill: c, fillOpacity: 0.13 }} />
              <text x={x} y={ty + 41} textAnchor="middle" fontSize={10.5} fontWeight={750} style={{ fill: c }}>{label}</text>
              <rect
                x={x - Math.max(width, 40) / 2} y={Math.min(ly, axisY) - 12} width={Math.max(width, 40)} height={Math.abs(ly - axisY) + 58}
                fill="transparent"
                onMouseMove={(ev) => show(ev, m.name, rowsTip)}
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
