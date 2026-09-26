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
interface Box { x0: number; x1: number; y0: number; y1: number }

// Ước lượng khung chữ SVG (chữ số/Latin ~0.58 em) để tránh nhãn đè nhau.
const CHAR_EM = 0.58;
const SHIFT_LABEL_FS = 10, SLOT_MAX = 72;
function textBox(cx: number, baseline: number, text: string, fontSize: number, padX = 1): Box {
  const half = (text.length * fontSize * CHAR_EM) / 2 + padX;
  return { x0: cx - half, x1: cx + half, y0: baseline - fontSize * 0.8, y1: baseline + 2 };
}
function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
// Nhãn điểm TT: thử dưới điểm, trên điểm, rồi xa hơn; lấy vị trí đầu tiên không đè cột, nhãn cột, nhãn Tổng KH.
// Nhãn số khác nhận lề ngang rộng (LABEL_GAP) để 2 số không nằm sát nhau cùng hàng (đọc thành 1 số).
const LABEL_GAP = 6;
const ACTUAL_LABEL_OFFSETS = [16, -8, 28, -20];

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
  // Mỗi cột ca chiếm 1 ô đủ rộng cho tên ca ở trục dưới (tên dài quá SLOT_MAX thì cắt, có tooltip).
  const longestName = Math.max(0, ...shifts.map((s) => s.name.length));
  const slot = Math.min(SLOT_MAX, Math.max(BAR_W + BAR_GAP, Math.ceil(longestName * SHIFT_LABEL_FS * CHAR_EM) + 8));
  const maxNameChars = Math.floor((slot - 8) / (SHIFT_LABEL_FS * CHAR_EM));
  const shortName = (n: string) => (n.length > maxNameChars ? `${n.slice(0, Math.max(1, maxNameChars - 1))}…` : n);
  const groupW = shifts.length * slot - (slot - BAR_W);
  const barXOf = (cx: number, j: number) => cx - groupW / 2 + j * slot;
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

  const actualLabelY = new Map<number, number>();
  months.forEach((m, i) => {
    const p = actualPoints[i];
    if (!p) return;
    const cx = cxOf(i);
    const taken: Box[] = [];
    shifts.forEach((sh, j) => {
      const v = m.planned[sh.code] ?? 0;
      const bx = barXOf(cx, j);
      taken.push({ x0: bx, x1: bx + BAR_W, y0: y(v), y1: MT + PLOT_H });
      if (v > 0) taken.push(textBox(bx + BAR_W / 2, y(v) - 4, String(v), 10, LABEL_GAP));
    });
    const pp = planPoints[i];
    if (pp) taken.push(textBox(pp.x, pp.y - 8, String(pp.v), 10.5, LABEL_GAP), { x0: pp.x - 4, x1: pp.x + 4, y0: pp.y - 4, y1: pp.y + 4 });
    const label = String(p.v);
    const fits = (dy: number) => {
      const b = textBox(p.x, p.y + dy, label, 10.5);
      return b.y0 >= MT - 14 && b.y1 <= MT + PLOT_H && !taken.some((tb) => overlaps(b, tb));
    };
    actualLabelY.set(i, p.y + (ACTUAL_LABEL_OFFSETS.find(fits) ?? ACTUAL_LABEL_OFFSETS[0]));
  });

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
        {/* Kích thước pixel thật (không viewBox): style inline đè `svg.chart { width: 100%; height: auto }` chung,
            nếu không màn hẹp sẽ ép svg nhỏ lại, nội dung tràn ra ngoài khung và khung không cuộn ngang được. */}
        <svg className="chart" width={W} height={H} style={{ width: W, height: H, maxWidth: 'none' }} role="img" aria-label={t('manpowerMonthChart.title')}>
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
                  const barX = barXOf(cx, j);
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
          {actualPoints.map((p, i) => p && (
            <g key={`act-pt-${p.x}`}>
              <circle cx={p.x} cy={p.y} r={3.5} style={{ fill: 'var(--s-third)' }} />
              <text x={p.x} y={actualLabelY.get(i) ?? p.y + 16} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: 'var(--s-third)' }}>
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
                  const barX = barXOf(cx, j) + BAR_W / 2;
                  const label = shortName(s.name);
                  return (
                    <text key={s.code} x={barX} y={MT + PLOT_H + 14} textAnchor="middle" fontSize={SHIFT_LABEL_FS} style={{ fill: 'var(--label2)' }}>
                      {label}
                      {label !== s.name && <title>{s.name}</title>}
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
