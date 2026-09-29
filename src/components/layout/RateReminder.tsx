import { getTranslations } from 'next-intl/server';
import type { YearMonth } from '@/lib/clock';
import type { FxCurrency } from '@/lib/fx';

export interface RateReminderProps {
  locale: string;
  month: YearMonth;
  currencies: FxCurrency[];
}

/** Q13=a: dải nhắc thiếu tỷ giá VCB, hiện đầu mọi trang cho admin. */
export async function RateReminder({ locale, month, currencies }: RateReminderProps) {
  const t = await getTranslations();
  return (
    <div className="sumbar bad">
      {t('fxRates.missing', { currencies: currencies.join(', '), month })}{' '}
      <a href={`/${locale}/admin#fx-rates`} className="font-semibold underline underline-offset-2">{t('fxRates.missingLink')}</a>
    </div>
  );
}
