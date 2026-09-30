import type { CSSProperties } from 'react';
import type { PlanActualTimeline as Geometry } from '@/lib/timeline';

export interface PlanActualTimelineProps {
  geometry: Geometry;
  labels: { planned: string; actual: string; todayPill: string; notStarted: string };
  planRange: string;      // "15/12/2025 → 29/09/2026"
  actualRange: string;    // "15/12/2025 → đang chạy" (chỉ dùng khi geometry.actual != null)
  planPctText: string;
  actualPctText: string;
}

const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
/** Cột nhãn 76px + gap 12px = 88px (mock-up dòng 313, 662). Điện thoại hẹp (<= 560px) nhãn xếp trên thanh nên `--tl-off` = 0 (globals.css). */
const onAxis = (x: number) => `calc(var(--tl-off, 88px) + (100% - var(--tl-off, 88px)) * ${x.toFixed(5)})`;

export function PlanActualTimeline({ geometry: g, labels, planRange, actualRange, planPctText, actualPctText }: PlanActualTimelineProps) {
  // Viên "Hôm nay" sát mép thì neo trái/phải để không bị .card (overflow:hidden) cắt.
  const pill: CSSProperties = { left: onAxis(g.todayPos) };
  if (g.todayPos < 0.1) pill.transform = 'translateX(0)';
  else if (g.todayPos > 0.9) pill.transform = 'translateX(-100%)';
  const planChip = g.todayPos > 0.85 ? `calc(${pct(g.todayPos)} - 64px)` : `calc(${pct(g.todayPos)} + 10px)`;
  const actRight = g.actual ? g.actual.left + g.actual.width : 0;
  const actChip = actRight < 0.12 ? `calc(${pct(actRight)} + 10px)` : `calc(${pct(actRight)} - 54px)`;
  return (
    <div className="tl">
      <div className="todaypill" style={pill}>{labels.todayPill}</div>
      <div className="today" style={{ left: onAxis(g.todayPos) }} />
      <div className="tlrow">
        <div className="lb">{labels.planned}</div>
        <div className="tltrack">
          <div className="tlbar plan" style={{ left: 0, width: '100%' }}>{planRange}</div>
          <div className="tlfill" style={{ width: pct(g.todayPos) }} />
          <div className="tlchip" style={{ left: planChip }}>{planPctText}</div>
        </div>
      </div>
      <div className="tlrow">
        <div className="lb">{labels.actual}</div>
        <div className="tltrack">
          {g.actual ? (
            <>
              <div className="tlbar act" style={{ left: pct(g.actual.left), width: pct(g.actual.width) }}>{actualRange}</div>
              <div className="tlchip" style={{ left: actChip }}>{actualPctText}</div>
            </>
          ) : (
            <div className="tlbar" style={{ left: 0, width: '100%', color: 'var(--label3)' }}>{labels.notStarted}</div>
          )}
        </div>
      </div>
    </div>
  );
}
