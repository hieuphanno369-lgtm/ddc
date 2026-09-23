'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Recharts dat mau bang presentation attribute cua SVG; var() KHONG chay o do.
 * Nen phai doc gia tri that tu CSS variable luc chay - giong ham cssv() cua
 * mock-up (dong 1317) va ve lai khi doi theme (dong 2296).
 */
export interface ChartTokens {
  plan: string;
  actual: string;
  cost: string;
  third: string;
  thirdLt: string;
  neutral: string;
  grid: string;
  axis: string;
  label2: string;
  ok: string;
  warn: string;
  danger: string;
  accent: string;
  accent2: string;
  gold: string;
}

const VARS: Record<keyof ChartTokens, string> = {
  plan: '--s-plan',
  actual: '--s-actual',
  cost: '--s-cost',
  third: '--s-third',
  thirdLt: '--s-third-lt',
  neutral: '--s-neutral',
  grid: '--grid',
  axis: '--axis',
  label2: '--label2',
  ok: '--ok',
  warn: '--warn',
  danger: '--danger',
  accent: '--accent',
  accent2: '--accent-2',
  gold: '--gold',
};

/** Gia tri dung cho lan render dau (truoc khi doc duoc DOM) - bang bo sang. */
const FALLBACK: ChartTokens = {
  plan: '#93b8e0', actual: '#1d5a9e', cost: '#a86a12', third: '#0f8a63',
  thirdLt: '#6fbf9b', neutral: '#c3cddb',
  grid: 'rgba(10,31,61,.08)', axis: 'rgba(10,31,61,.42)', label2: 'rgba(10,31,61,.62)',
  ok: '#248a3d', warn: '#b25000', danger: '#c30d0d',
  accent: '#1d5a9e', accent2: '#2a6db4', gold: '#f5b301',
};

function read(): ChartTokens {
  if (typeof window === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const out = {} as ChartTokens;
  for (const k of Object.keys(VARS) as (keyof ChartTokens)[]) {
    out[k] = cs.getPropertyValue(VARS[k]).trim() || FALLBACK[k];
  }
  return out;
}

export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(FALLBACK);
  const refresh = useCallback(() => setTokens(read()), []);

  useEffect(() => {
    refresh();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('ddc:theme', refresh);
    mq.addEventListener('change', refresh);
    return () => {
      window.removeEventListener('ddc:theme', refresh);
      mq.removeEventListener('change', refresh);
    };
  }, [refresh]);

  return tokens;
}
