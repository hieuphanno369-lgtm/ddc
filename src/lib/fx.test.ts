import { describe, expect, it } from 'vitest';
import { missingRateCurrencies } from './fx';
import type { ExchangeRate } from '@/server/repo/types';

const rate = (over: Partial<ExchangeRate>): ExchangeRate => ({
  currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 25000, source: 'manual', updatedBy: null, updatedAt: null,
  ...over,
});

describe('missingRateCurrencies', () => {
  it('thieu ca USD/EUR khi khong co dong nao', () => {
    expect(missingRateCurrencies([], '2026-09')).toEqual(['USD', 'EUR']);
  });

  it('co USD -> chi con thieu EUR', () => {
    expect(missingRateCurrencies([rate({ currencyCode: 'USD' })], '2026-09')).toEqual(['EUR']);
  });

  it('co du USD/EUR -> []', () => {
    const rates = [rate({ currencyCode: 'USD' }), rate({ currencyCode: 'EUR' })];
    expect(missingRateCurrencies(rates, '2026-09')).toEqual([]);
  });

  it('dong cua thang khac khong tinh', () => {
    const rates = [rate({ currencyCode: 'USD', yearMonth: '2026-08' })];
    expect(missingRateCurrencies(rates, '2026-09')).toEqual(['USD', 'EUR']);
  });
});
