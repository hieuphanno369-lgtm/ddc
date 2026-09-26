'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Legend } from '@/components/ui/Legend';
import type { ManpowerMonthModel, MonthDatum, MonthShift } from '@/lib/manpower-month-chart';
import { ChartTip, useChartTip } from './ChartTip';

/** T5 - chart cột (KH từng ca theo tháng) + đường tổng KH + đường TT TB/ngày. SVG tự vẽ pixel thật. */
const ML = 44, MR = 16, MT = 26, PLOT_H = 220, AXIS_H = 40, BAR_W = 26, BAR_GAP = 6, MIN_MONTH_W = 96;
const SHIFT_COLORS = ['var(--s-plan)', 'var(--s-cost)', 'var(--s-third-lt)', 'var(--s-neutral)'];

interface LinePoint { x: number; y: number; v: number }

/** Cắt mảng điểm-hoặc-null thành các đoạn liên tục (null = tháng thiếu -> đường đứt). */
function splitSegments(points: (LinePoint | null)[]): LinePoint[][] {
  const segments: LinePoint[][] = [];
  let current: LinePoint[] = [];
  for (const p of points) {
    if (p == null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

function tooltipRows(m: MonthDatum, shifts: MonthShift[], t: ReturnType<typeof useTranslations>) {
  return [
    ...shifts.map((s, j) => ({ k: s.name, v: String(m.planned[s.code] ?? 0), color: SHIFT_COLORS[j % SHIFT_COLORS.length] })),
    { k: t('manpowerMonthChart.planTotal'), v: String(m.plannedTotal) },
    { k: t('manpowerMonthChart.actualAvg'), v: m.actualAvg == null ? '-' : String(m.actualAvg) },
    { k: t('manpowerMonthChart.actualDays'), v: String(m.actualDays) },
  ];
}

export function ManpowerMonthChart({ model }: { model: ManpowerMonthModel }) {
  const t = useTranslations();
  const { tip, show, hide } = useChartTip();
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { shifts, months, maxY } = model;
  const groupW = shifts.length * BAR_W + Math.max(0, shifts.length - 1) * BAR_GAP;
  const monthW = Math.max(MIN_MONTH_W, groupW + 24, (containerWidth - ML - MR) / Math.max(1, months.length));
  const W = ML + months.length * monthW + MR;
  const H = MT + PLOT_H + AXIS_H;
  const y = (v: number) => MT + PLOT_H - (v / maxY) * PLOT_H;
  const cxOf = (i: number) => ML + (i + 0.5) * monthW;
  const gridLevels = [0, maxY / 4, maxY / 2, (maxY * 3) / 4, maxY];

  const planPoints = months.map((m, i) => (m.hasPlan ? { x: cxOf(i), y: y(m.plannedTotal), v: m.plannedTotal } : null));
  const actualPoints = months.map((m, i) => (m.actualAvg != null ? { x: cxOf(i), y: y(m.actualAvg), v: m.actualAvg } : null));
  const planSegments = splitSegments(planPoints);
  const actualSegments = splitSegments(actualPoints);
  const planPointsFlat = planPoints.filter((p): p is LinePoint => p != null);
  const actualPointsFlat = actualPoints.filter((p): p is LinePoint => p != null);

  return (
    <div>
      <Legend
        items={[
          ...shifts.map((s, i) => ({
            label: s.pct != null ? `${s.name} · ${Math.round(s.pct * 100)}%` : s.name,
            color: SHIFT_COLORS[i % SHIFT_COLORS.length],
          })),
          { label: t('manpowerMonthChart.planTotal'), color: 'var(--s-actual)', line: true },
          { label: t('manpowerMonthChart.actualAvg'), color: 'var(--s-third)', line: true },
        ]}
      />
      <div ref={containerRef} style={{ overflowX: 'auto' }}>
        <svg className="chart" width={W} height={H} role="img" aria-label={t('manpowerMonthChart.title')}>
          {gridLevels.map((lv) => (
            <g key={lv}>
              <line x1={ML} x2={W - MR} y1={y(lv)} y2={y(lv)} style={{ stroke: 'var(--grid)' }} />
              <text x={ML - 6} y={y(lv) + 4} textAnchor="end" fontSize={10.5} style={{ fill: 'var(--axis)' }}>
                {Math.round(lv)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const cx = cxOf(i);
            return (
              <g key={m.yearMonth}>
                {shifts.map((s, j) => {
                  const v = m.planned[s.code] ?? 0;
                  const barX = cx - groupW / 2 + j * (BAR_W + BAR_GAP);
                  const barY = y(v);
                  const barH = MT + PLOT_H - barY;
                  return (
                    <g key={s.code}>
                      <rect x={barX} y={barY} width={BAR_W} height={barH} rx={3} style={{ fill: SHIFT_COLORS[j % SHIFT_COLORS.length] }} />
                      {v > 0 && (
                        <text x={barX + BAR_W / 2} y={barY - 4} textAnchor="middle" fontSize={10} style={{ fill: 'var(--label2)' }}>
                          {v}
                        </text>
                      )}
                    </g>
                  );
                })}
                <rect
                  x={cx - monthW / 2}
                  y={MT}
                  width={monthW}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseMove={(ev) => show(ev, m.label, tooltipRows(m, shifts, t))}
                  onMouseLeave={hide}
                />
              </g>
            );
          })}

          {planSegments.map((seg, i) => (
            <polyline key={`plan-${i}`} points={seg.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" strokeWidth={2} style={{ stroke: 'var(--s-actual)' }} />
          ))}
          {planPointsFlat.map((p) => (
            <g key={`plan-pt-${p.x}`}>
              <circle cx={p.x} cy={p.y} r={3.5} style={{ fill: 'var(--s-actual)' }} />
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: 'var(--s-actual)' }}>
                {p.v}
              </text>
            </g>
          ))}

          {actualSegments.map((seg, i) => (
            <polyline
              key={`act-${i}`}
              points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              strokeWidth={2}
              strokeDasharray="4 3"
              style={{ stroke: 'var(--s-third)' }}
            />
          ))}
          {actualPointsFlat.map((p) => (
            <g key={`act-pt-${p.x}`}>
              <circle cx={p.x} cy={p.y} r={3.5} style={{ fill: 'var(--s-third)' }} />
              <text x={p.x} y={p.y + 16} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: 'var(--s-third)' }}>
                {p.v}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const cx = cxOf(i);
            return (
              <g key={`axis-${m.yearMonth}`}>
                {i > 0 && (
                  <line x1={cx - monthW / 2} x2={cx - monthW / 2} y1={MT + PLOT_H} y2={MT + PLOT_H + AXIS_H} style={{ stroke: 'var(--grid)' }} />
                )}
                {shifts.map((s, j) => {
                  const barX = cx - groupW / 2 + j * (BAR_W + BAR_GAP) + BAR_W / 2;
                  return (
                    <text key={s.code} x={barX} y={MT + PLOT_H + 14} textAnchor="middle" fontSize={10} style={{ fill: 'var(--label2)' }}>
                      {s.name}
                    </text>
                  );
                })}
                <text x={cx} y={MT + PLOT_H + 32} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--label)' }}>
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ChartTip tip={tip} />
    </div>
  );
}
