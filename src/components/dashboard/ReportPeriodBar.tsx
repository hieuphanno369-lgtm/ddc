'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Period } from '@/lib/period';
import { HelpTip } from '@/components/ui/HelpTip';
import { DateField } from '@/components/ui/DateField';

/**
 * Thanh kỳ của trang Báo cáo (T-2): cùng bộ lọc kỳ với Tổng quan (2 ô ngày dd/mm/yyyy, ghi cả `from` và `to` lên URL).
 * Chỉ đổi URL, trang server render lại.
 */
export function ReportPeriodBar({ period }: { period: Period }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updatePeriod(edge: 'from' | 'to', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', edge === 'from' ? value : period.from);
    params.set('to', edge === 'to' ? value : period.to);
    params.delete('month');
    router.replace(`?${params}`, { scroll: false });
  }

  return (
    <div className="card overflow-visible flex flex-wrap items-center gap-2 px-3 py-3" data-testid="report-period-bar">
      <span className="flex items-center gap-1.5 text-caption1 font-semibold text-label2">
        {t('period.label')}
        <HelpTip text={t('helpTip.ovPeriod')} label={t('common.explain')} />
      </span>
      <label className="flex items-center gap-1.5 text-caption1 text-label2">
        {t('period.from')}
        <DateField ariaLabel={t('period.from')} value={period.from} onChange={(v) => updatePeriod('from', v)} testId="period-from" />
      </label>
      <label className="flex items-center gap-1.5 text-caption1 text-label2">
        {t('period.to')}
        <DateField ariaLabel={t('period.to')} value={period.to} onChange={(v) => updatePeriod('to', v)} testId="period-to" />
      </label>
    </div>
  );
}
