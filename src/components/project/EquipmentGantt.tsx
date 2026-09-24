'use client';

import { useTranslations } from 'next-intl';
import { addDaysIso } from '@/lib/clock';
import type { GanttBar, GanttModel } from '@/lib/equipment-gantt';
import { formatDateShort, formatDayMonth } from '@/lib/format';
import { xOf } from '@/lib/stage-timeline';
import { ChartTip, useChartTip } from './ChartTip';

const W = 1000, ML = 190, MR = 100, MT = 30, ROW_H = 34, BH = 16, MB = 8;
const IW = W - ML - MR;
/** Nhãn dd/mm cần chỗ tối thiểu ~84px để không đè lên thanh/tuần kế tiếp. */
const LABEL_MIN_W = 84;

export function EquipmentGantt({ model }: { model: GanttModel }) {
  const t = useTranslations();
  const { tip, show, hide } = useChartTip();
  const H = MT + model.rows.length * ROW_H + MB;
  const dom = { from: model.from, to: addDaysIso(model.to, 1), ticks: [] };
  const X = (d: string) => xOf(d, dom, ML, IW);
  const gridTop = MT - 12;
  const gridBottom = MT + model.rows.length * ROW_H;
  const step = Math.max(1, Math.ceil(model.ticks.length / 16));

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('equipmentGantt.title')}>
        {model.ticks.map((tk, i) => (
          <g key={tk}>
            <line x1={X(tk)} x2={X(tk)} y1={gridTop} y2={gridBottom} style={{ stroke: 'var(--grid)' }} />
            {i % step === 0 && (
              <text x={X(tk)} y={gridTop - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: 'var(--axis)' }}>
                {formatDayMonth(tk)}
              </text>
            )}
          </g>
        ))}
        {model.rows.map((row, i) => {
          const top = MT + i * ROW_H;
          const cy = top + ROW_H / 2;
          const by = top + (ROW_H - BH) / 2;
          return (
            <g key={row.key}>
              {i > 0 && <line x1={0} x2={W} y1={top} y2={top} style={{ stroke: 'var(--grid)' }} />}
              <text x={ML - 10} y={cy + 4} textAnchor="end" fontSize={13} fontWeight={700} style={{ fill: 'var(--label)' }}>{row.label}</text>
              {row.bars.map((bar, j) => (
                <GanttBarShape
                  key={bar.planId}
                  bar={bar}
                  by={by}
                  X={X}
                  nextStartX={j + 1 < row.bars.length ? X(row.bars[j + 1].start) : W}
                  rowLabel={row.label}
                  t={t}
                  show={show}
                  hide={hide}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <ChartTip tip={tip} />
      {model.unplannedUsage > 0 && (
        <p className="hintline">{t('equipmentGantt.unplanned', { n: model.unplannedUsage })}</p>
      )}
    </>
  );
}

function GanttBarShape({
  bar, by, X, nextStartX, rowLabel, t, show, hide,
}: {
  bar: GanttBar; by: number; X: (d: string) => number; nextStartX: number; rowLabel: string;
  t: ReturnType<typeof useTranslations>;
  show: ReturnType<typeof useChartTip>['show']; hide: ReturnType<typeof useChartTip>['hide'];
}) {
  const barStartX = X(bar.start);
  const barEndX = X(addDaysIso(bar.finish, 1));
  const barWidth = Math.max(barEndX - barStartX, 3);
  const gap = nextStartX - barEndX;
  const showAfter = gap >= LABEL_MIN_W;
  const showInside = !showAfter && barWidth >= LABEL_MIN_W;

  const tipRows = [
    { k: t('equipmentGantt.tipWorkItem'), v: bar.workItemName, color: bar.color },
    { k: t('equipmentGantt.tipPlan'), v: `${formatDateShort(bar.start)} → ${formatDateShort(bar.finish)}` },
    { k: t('equipmentGantt.tipPlanDays'), v: String(bar.planDays) },
    { k: t('equipmentGantt.tipUsedDays'), v: String(bar.usedDays.length) },
  ];

  return (
    <g
      onMouseMove={(ev) => show(ev, rowLabel, tipRows)}
      onMouseLeave={hide}
      style={{ cursor: 'pointer' }}
    >
      <rect x={barStartX} y={by} width={barWidth} height={BH} rx={4} fillOpacity={0.38} style={{ fill: bar.color }} />
      {bar.usedDays.map((d) => {
        const dx = X(d);
        const dw = Math.max(X(addDaysIso(d, 1)) - dx, 1.5);
        return <rect key={d} x={dx} y={by} width={dw} height={BH} style={{ fill: bar.color }} />;
      })}
      {showAfter && (
        <text x={barEndX + 4} y={by + BH / 2 + 4} fontSize={11} style={{ fill: 'var(--label2)' }}>{bar.rangeLabel}</text>
      )}
      {showInside && (
        <text x={barEndX - 4} y={by + BH / 2 + 4} textAnchor="end" fontSize={11} fill="white">{bar.rangeLabel}</text>
      )}
    </g>
  );
}
