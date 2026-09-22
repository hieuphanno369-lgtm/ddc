'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatPct, formatTyd } from '@/lib/format';
import { calcCpi, calcEac, calcEv } from '@/lib/evm';

/**
 * What-if (Phase 2): thử "nếu %HT tháng sau tăng X% thì EAC còn bao nhiêu".
 * Gọi đúng công thức ở evm.ts (calcEv/calcCpi/calcEac) - không tự tính lại inline. Tăng %HT → EAC giảm.
 */
export function WhatIf({ ac, pctActual, bac }: { ac: number; pctActual: number; bac: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const [delta, setDelta] = useState(0);

  const baseEac = calcEac(bac, calcCpi(calcEv(pctActual, bac), ac));
  const newEac = calcEac(bac, calcCpi(calcEv(pctActual + delta, bac), ac));
  const saving = baseEac != null && newEac != null ? baseEac - newEac : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{t('whatif.label')}</span>
        <span className="font-semibold text-accent">{formatPct(delta, locale)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={0.3}
        step={0.01}
        value={delta}
        onChange={(e) => setDelta(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="label">{t('whatif.currentEac')}</div>
          <div className="mt-1 text-sm font-semibold text-navy-900">{formatTyd(baseEac, locale)}</div>
        </div>
        <div className="rounded-lg bg-accent-soft p-3">
          <div className="label text-accent">{t('whatif.newEac')}</div>
          <div className="mt-1 text-sm font-semibold text-accent">{formatTyd(newEac, locale)}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="label text-emerald-700">{t('whatif.saving')}</div>
          <div className="mt-1 text-sm font-semibold text-emerald-700">{formatTyd(saving, locale)}</div>
        </div>
      </div>
    </div>
  );
}
