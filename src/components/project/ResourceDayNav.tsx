'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { addDaysIso, type IsoDate } from '@/lib/clock';
import { formatDate } from '@/lib/format';
import { HelpTip } from '@/components/ui/HelpTip';
import { DateField } from '@/components/ui/DateField';
import { IconChevronRight } from '@/components/icons';

/**
 * Điều hướng ngày cho nhóm "Huy động nguồn lực" (P4 D-15): "‹ Tuần trước · [ngày] · Tuần sau ›" điều khiển
 * thẻ KPI Nhân lực/Thiết bị, hai bảng theo nhà thầu/nhóm và Tracking 7 ngày. Chỉ đổi URL (`day`).
 * Ngày chọn chưa có số thì server lấy ngày gần nhất trước đó (Q7), nhãn ngày thật hiện ở từng thẻ.
 */
export function ResourceDayNav({
  day,
  min,
  max,
  manpowerAsOf,
  equipmentAsOf,
}: {
  day: IsoDate;
  min: IsoDate;
  max: IsoDate;
  manpowerAsOf: IsoDate | null;
  equipmentAsOf: IsoDate | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setDay(d: IsoDate) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('day', d < min ? min : d > max ? max : d);
    router.replace(`?${params}`, { scroll: false });
  }

  const prev = addDaysIso(day, -7);
  const next = addDaysIso(day, 7);
  const canPrev = day > min;
  const canNext = day < max;
  const navBtn = { padding: '5px 10px', fontSize: 'var(--t-caption1)' } as const;
  // Ngày thật của số đang hiện (có thể sớm hơn ngày chọn, Q7): người xem thấy ngay số lấy từ ngày nào.
  const shown = [manpowerAsOf, equipmentAsOf].filter((d): d is IsoDate => d != null).sort().at(-1) ?? null;

  return (
    <div className="card overflow-visible flex flex-wrap items-center gap-2 px-3 py-3" data-testid="resource-day-nav">
      <span className="flex items-center gap-1.5 text-caption1 font-semibold text-label2">
        {t('asOf.pickDay')}
        <HelpTip text={t('helpTip.dtResource')} label={t('common.explain')} />
      </span>
      <button type="button" className="btn ghost" style={navBtn} disabled={!canPrev} onClick={() => setDay(prev)} data-testid="day-prev">
        <IconChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
        {t('asOf.prevWeek')}
      </button>
      <DateField ariaLabel={t('asOf.pickDay')} value={day} min={min} max={max} onChange={setDay} testId="day-input" />
      <button type="button" className="btn ghost" style={navBtn} disabled={!canNext} onClick={() => setDay(next)} data-testid="day-next">
        {t('asOf.nextWeek')}
        <IconChevronRight size={14} />
      </button>
      {shown && (
        <span className="ml-auto text-caption1 text-label2" data-testid="resource-day-label">
          {t('asOf.day', { date: formatDate(shown, locale) })}
        </span>
      )}
    </div>
  );
}
