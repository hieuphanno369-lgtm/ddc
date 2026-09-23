'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { formatDate } from '@/lib/format';
import { clockOffsetMs, countdownParts, countdownTargetMs } from '@/lib/countdown';
import { spring } from '@/components/ui/motion';

/** Mỗi lần chữ số đổi: nảy bằng spring 'bouncy' như setDigit mock-up dòng 1338-1341. */
function Digit({ value, sec = false }: { value: string; sec?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return spring({
      preset: 'bouncy', from: 0, to: 1,
      onUpdate: (p) => {
        el.style.transform = `translateY(${(6 * (1 - p)).toFixed(2)}px)`;
        el.style.opacity = String(Math.min(1, 0.35 + p * 0.65));
      },
    });
  }, [value]);
  return <b ref={ref} className={sec ? 'sec' : undefined}>{value}</b>;
}

export function CountdownPanel({ targetDate, appToday, locale }: { targetDate: IsoDate; appToday: IsoDate; locale: string }) {
  const t = useTranslations();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const offset = clockOffsetMs(appToday, Date.now());
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [appToday]);
  const p = now == null ? null : countdownParts(countdownTargetMs(targetDate), now);
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="cdpanel">
      <div className="t"><span className="pulsedot" />{t('detail.cd.title')}</div>
      <div className="cd">
        <Digit value={p ? String(p.days) : '-'} /><span>{t('detail.cd.days')}</span>
        <Digit value={p ? two(p.hours) : '-'} /><span>{t('detail.cd.hours')}</span>
        <Digit value={p ? two(p.minutes) : '-'} /><span>{t('detail.cd.minutes')}</span>
        <Digit value={p ? two(p.seconds) : '-'} sec /><span>{t('detail.cd.seconds')}</span>
      </div>
      <div className="d">
        {t('detail.cd.target')}: <b>{formatDate(targetDate, locale)}</b> · {t('detail.cd.today')} {formatDate(appToday, locale)}
      </div>
    </div>
  );
}
