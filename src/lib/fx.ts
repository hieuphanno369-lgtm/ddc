import type { YearMonth } from '@/lib/clock';
import type { CurrencyCode, ExchangeRate } from '@/server/repo/types';

/** Q8: tiền tệ ngoài VND chỉ còn USD/EUR - đây là những mã tự lấy tỷ giá VCB hằng tháng. */
export const FX_CURRENCIES = ['USD', 'EUR'] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

/** Những mã trong FX_CURRENCIES chưa có dòng tỷ giá của tháng `ym`. */
export function missingRateCurrencies(rates: ExchangeRate[], ym: YearMonth): FxCurrency[] {
  const have = new Set(rates.filter((r) => r.yearMonth === ym).map((r) => r.currencyCode));
  return FX_CURRENCIES.filter((c) => !have.has(c));
}

/** G-7: tỷ giá VNĐ/1 đơn vị `currency` của tháng `ym`. VND luôn quy đổi 1:1. */
export function findMonthRate(rates: ExchangeRate[], currency: CurrencyCode, ym: YearMonth): number | null {
  if (currency === 'VND') return 1;
  const row = rates.find((r) => r.currencyCode === currency && r.yearMonth === ym);
  return row ? row.rateToVnd : null;
}

/** G-7: quy đổi giá trị nguyên tệ sang tỷ VNĐ (làm tròn 6 chữ số thập phân). */
export function toVndBillion(original: number, rateToVnd: number): number {
  return Math.round((original * rateToVnd) / 1e9 * 1e6) / 1e6;
}
