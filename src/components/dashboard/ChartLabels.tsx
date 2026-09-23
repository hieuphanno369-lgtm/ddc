'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type LabelMode = 'smart' | 'detail';

export function useLabelMode(initial: LabelMode = 'smart') {
  const [mode, setMode] = useState<LabelMode>(initial);
  return { mode, setMode };
}

export function LabelModeSwitch({ mode, onChange }: { mode: LabelMode; onChange: (m: LabelMode) => void }) {
  const t = useTranslations();
  const base = 'rounded-[6px] px-2.5 py-1 text-caption1 font-semibold transition-all duration-fast ease-std';
  const on = 'text-label';
  const off = 'text-label2';
  return (
    <div className="seg">
      <button onClick={() => onChange('smart')} className={`${base} ${mode === 'smart' ? 'on ' + on : off}`}>
        {t('chart.smart')}
      </button>
      <button onClick={() => onChange('detail')} className={`${base} ${mode === 'detail' ? 'on ' + on : off}`}>
        {t('chart.detail')}
      </button>
    </div>
  );
}

/** Chỉ số điểm cần dán nhãn ở chế độ smart: điểm hiện tại (cuối) + max + min. */
export function smartIndices(data: Record<string, number | null | string>[], key: string): Set<number> {
  const idx: number[] = [];
  data.forEach((d, i) => {
    if (typeof d[key] === 'number') idx.push(i);
  });
  if (idx.length === 0) return new Set();
  let max = idx[0];
  let min = idx[0];
  for (const i of idx) {
    if ((data[i][key] as number) > (data[max][key] as number)) max = i;
    if ((data[i][key] as number) < (data[min][key] as number)) min = i;
  }
  return new Set([idx[idx.length - 1], max, min]);
}

/** Factory cho Recharts LabelList content - chỉ render các điểm nằm trong `selected`. */
export function valueLabel(selected: Set<number>, digits = 2) {
  return function Label(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
    value?: number | string;
  }) {
    if (props.index == null || !selected.has(props.index) || props.value == null) return null;
    const x = Number(props.x);
    const y = Number(props.y);
    const v = Number(props.value);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(v)) return null;
    return (
      <text x={x} y={y - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.85}>
        {v.toFixed(digits)}
      </text>
    );
  };
}
