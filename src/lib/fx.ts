import type { YearMonth } from '@/lib/clock';
import type { ExchangeRate } from '@/server/repo/types';

/** Q8: tiền tệ ngoài VND chỉ còn USD/EUR - đây là những mã tự lấy tỷ giá VCB hằng tháng. */
export const FX_CURRENCIES = ['USD', 'EUR'] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

/** Những mã trong FX_CURRENCIES chưa có dòng tỷ giá của tháng `ym`. */
export function missingRateCurrencies(rates: ExchangeRate[], ym: YearMonth): FxCurrency[] {
  const have = new Set(rates.filter((r) => r.yearMonth === ym).map((r) => r.currencyCode));
  return FX_CURRENCIES.filter((c) => !have.has(c));
}
