import type { CSSProperties } from 'react';

export type LegendShape = 'ring' | 'dot' | 'diamondO' | 'diamond' | 'tri';
export interface LegendItem { label: string; color: string; line?: boolean; shape?: LegendShape }

/** `.legend` mock-up dòng 375-378; biến thể hình dạng theo renderMsLegend dòng 1396-1401. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <span className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.line ? 'ln' : undefined} style={swatch(it)} />
          {it.label}
        </span>
      ))}
    </span>
  );
}

function swatch({ color, shape }: LegendItem): CSSProperties {
  const s: CSSProperties = { background: color };
  if (shape === 'ring' || shape === 'diamondO') { s.background = 'transparent'; s.border = `2px solid ${color}`; }
  if (shape === 'diamond' || shape === 'diamondO') s.transform = 'rotate(45deg)';
  if (shape === 'tri') { s.clipPath = 'polygon(50% 0,100% 100%,0 100%)'; s.borderRadius = 0; }
  return s;
}
