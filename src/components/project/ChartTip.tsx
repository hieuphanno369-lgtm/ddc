'use client';

import { useCallback, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

export interface TipRow { k: string; v: string; color?: string; valueColor?: string }
export interface TipState { x: number; y: number; title: string; rows: TipRow[] }

/**
 * Tooltip kính `.tip` của mock-up (dòng 1325-1335). PHẢI portal ra body: Card có transform (hover
 * lift, motion.ts), khiến position:fixed bên trong tính theo Card chứ không theo viewport.
 */
export function useChartTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((ev: MouseEvent, title: string, rows: TipRow[]) => {
    const w = 200;
    const h = 34 + rows.length * 20;
    let x = ev.clientX + 16;
    let y = ev.clientY + 16;
    if (x + w > window.innerWidth - 10) x = ev.clientX - w - 14;
    if (y + h > window.innerHeight - 10) y = ev.clientY - h - 14;
    setTip({ x, y, title, rows });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function ChartTip({ tip }: { tip: TipState | null }) {
  if (!tip || typeof document === 'undefined') return null;
  return createPortal(
    <div className="tip show" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.title}</b>
      {tip.rows.map((r) => (
        <div key={r.k} className="r">
          <span>{r.color && <i style={{ background: r.color }} />}{r.k}</span>
          <span style={r.valueColor ? { color: r.valueColor } : undefined}>{r.v}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
