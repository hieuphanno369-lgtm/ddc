'use client';

import { useTranslations } from 'next-intl';
import { addDaysIso } from '@/lib/clock';
import { formatDayMonthDot, type PlanGanttModel, type PlanGanttRow, type PlanGanttSegment } from '@/lib/equipment-gantt-v2';
import { formatDateShort } from '@/lib/format';
import { xOf } from '@/lib/stage-timeline';
import { ChartTip, useChartTip } from './ChartTip';

/** T4 - Gantt thiết bị theo đợt: 1 hàng/loại thiết bị, thanh = đợt sử dụng, cột "SL nay/tổng". */
const W = 1000, NAME_W = 190, QTY_W = 76, ML = NAME_W + QTY_W, MR = 16, MT = 40, LANE_H = 24, ROW_PAD = 10, BH = 16, ROW_MIN_H = 46;
const MIN_SVG_W = 720, LABEL_MIN_W = 44;
const IW = W - ML - MR;
const NAME_MAX_LEN = 24;

function rowHeight(lanes: number): number {
  return Math.max(ROW_MIN_H, ROW_PAD * 2 + lanes * LANE_H);
}

/** Đợt kế tiếp CÙNG lane (segments đã sort theo from) - dùng để tính chỗ trống đặt nhãn. */
function nextInLane(segments: PlanGanttSegment[], seg: PlanGanttSegment): PlanGanttSegment | null {
  const sameLane = segments.filter((s) => s.lane === seg.lane);
  const idx = sameLane.findIndex((s) => s.id === seg.id);
  return sameLane[idx + 1] ?? null;
}

export function EquipmentPlanGantt({ model }: { model: PlanGanttModel }) {
  const t = useTranslations();
  const { tip, show, hide } = useChartTip();
  const dom = { from: model.axis.from, to: model.axis.toExclusive, ticks: [] };
  const X = (d: string) => xOf(d, dom, ML, IW);

  const rowTops: number[] = [];
  let cursorY = MT;
  for (const row of model.rows) {
    rowTops.push(cursorY);
    cursorY += rowHeight(row.lanes);
  }
  const gridBottom = cursorY;
  const H = gridBottom + 8;
  const step = model.axis.labelStep;

  const todayXt = model.todayInRange ? X(model.today) + (X(addDaysIso(model.today, 1)) - X(model.today)) / 2 : 0;
  const todayLabel = t('equipmentPlanGantt.today', { date: formatDayMonthDot(model.today) });
  const pillW = Math.max(56, todayLabel.length * 6.4 + 16);
  const pillX = Math.min(Math.max(todayXt - pillW / 2, ML), W - MR - pillW);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: MIN_SVG_W }} role="img" aria-label={t('equipmentPlanGantt.title')}>
        <text x={8} y={MT - 18} fontSize={10} fontWeight={700} style={{ fill: 'var(--label3)' }}>
          {t('equipmentPlanGantt.colEquipment')}
        </text>
        <text x={NAME_W + QTY_W / 2} y={MT - 18} textAnchor="middle" fontSize={10} fontWeight={700} style={{ fill: 'var(--label3)' }}>
          {t('equipmentPlanGantt.colQty')}
        </text>

        {model.axis.ticks.map((tk, i) => (
          <g key={tk.date}>
            <line x1={X(tk.date)} x2={X(tk.date)} y1={MT - 8} y2={gridBottom} style={{ stroke: 'var(--grid)' }} />
            {i % step === 0 && (
              <text x={X(tk.date)} y={MT - 18} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: 'var(--axis)' }}>
                {tk.label}
              </text>
            )}
          </g>
        ))}

        {model.rows.map((row, i) => {
          const top = rowTops[i];
          const rowH = rowHeight(row.lanes);
          const cy = top + rowH / 2;
          const displayName = row.name.length > NAME_MAX_LEN ? `${row.name.slice(0, NAME_MAX_LEN)}…` : row.name;
          const spanText = row.spanFrom && row.spanTo ? `${formatDateShort(row.spanFrom)} – ${formatDateShort(row.spanTo)}` : '-';
          const qtyText = `${row.qtyNow}/${row.qtyTotal ?? '–'}`;
          return (
            <g key={row.equipmentId}>
              {i > 0 && <line x1={0} x2={W} y1={top} y2={top} style={{ stroke: 'var(--grid)' }} />}
              <text x={8} y={top + 20} fontSize={12} fontWeight={700} style={{ fill: 'var(--label)' }}>
                {displayName}
                <title>{row.name}</title>
              </text>
              <text x={8} y={top + 34} fontSize={10} style={{ fill: 'var(--label3)' }}>{spanText}</text>
              <text
                x={NAME_W + QTY_W / 2}
                y={cy + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={row.qtyNow > 0 ? 700 : 400}
                style={{ fill: row.qtyNow > 0 ? 'var(--label)' : 'var(--label3)' }}
              >
                {qtyText}
              </text>
              {row.segments.map((seg) => (
                <PlanGanttBar
                  key={seg.id}
                  row={row}
                  seg={seg}
                  top={top}
                  X={X}
                  nextInLane={nextInLane(row.segments, seg)}
                  t={t}
                  show={show}
                  hide={hide}
                />
              ))}
            </g>
          );
        })}

        {model.todayInRange && (
          <g>
            <line x1={todayXt} x2={todayXt} y1={MT - 4} y2={gridBottom} strokeWidth={1.5} style={{ stroke: 'var(--danger)' }} />
            <rect x={pillX} y={2} width={pillW} height={16} rx={8} style={{ fill: 'var(--danger)' }} />
            <text x={pillX + pillW / 2} y={13} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="white">
              {todayLabel}
            </text>
          </g>
        )}
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}

function PlanGanttBar({
  row, seg, top, X, nextInLane: next, t, show, hide,
}: {
  row: PlanGanttRow; seg: PlanGanttSegment; top: number; X: (d: string) => number; nextInLane: PlanGanttSegment | null;
  t: ReturnType<typeof useTranslations>;
  show: ReturnType<typeof useChartTip>['show']; hide: ReturnType<typeof useChartTip>['hide'];
}) {
  const by = top + ROW_PAD + seg.lane * LANE_H + (LANE_H - BH) / 2;
  const barStartX = X(seg.from);
  const barEndX = X(addDaysIso(seg.to, 1));
  const barWidth = Math.max(barEndX - barStartX, 3);
  const nextStartX = next ? X(next.from) : W - MR;
  const gap = nextStartX - barEndX;
  const showInside = barWidth >= LABEL_MIN_W;
  const showAfter = !showInside && gap >= LABEL_MIN_W;
  const qtyLabel = t('equipmentPlanGantt.qty', { n: seg.qty });

  const tipRows = [
    { k: t('equipmentPlanGantt.tipRange'), v: `${formatDateShort(seg.from)} → ${formatDateShort(seg.to)}`, color: row.color },
    { k: t('equipmentPlanGantt.tipQty'), v: String(seg.qty) },
    { k: t('equipmentPlanGantt.tipDays'), v: String(seg.days) },
  ];

  return (
    <g onMouseMove={(ev) => show(ev, row.name, tipRows)} onMouseLeave={hide} style={{ cursor: 'pointer' }}>
      <rect x={barStartX} y={by} width={barWidth} height={BH} rx={4} style={{ fill: row.color }} />
      {showInside && (
        <text x={barStartX + barWidth / 2} y={by + BH / 2 + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="white">
          {qtyLabel}
        </text>
      )}
      {showAfter && (
        <text x={barEndX + 4} y={by + BH / 2 + 4} fontSize={10.5} fontWeight={700} style={{ fill: 'var(--label2)' }}>
          {qtyLabel}
        </text>
      )}
    </g>
  );
}
