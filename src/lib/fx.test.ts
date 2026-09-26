import { describe, expect, it } from 'vitest';
import { findMonthRate, missingRateCurrencies, toVndBillion } from './fx';
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

describe('findMonthRate', () => {
  it('VND luon tra 1', () => {
    expect(findMonthRate([], 'VND', '2026-09')).toBe(1);
  });

  it('co dong dung thang -> rateToVnd', () => {
    expect(findMonthRate([rate({ currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 25400 })], 'USD', '2026-09')).toBe(25400);
  });

  it('thang khong co rate -> null', () => {
    expect(findMonthRate([rate({ currencyCode: 'USD', yearMonth: '2026-08' })], 'USD', '2026-09')).toBeNull();
  });
});

describe('toVndBillion', () => {
  it('quy doi dung: 1.000 nguyen te x ty gia 25400 = 0,0254 ty VND', () => {
    expect(toVndBillion(1_000, 25400)).toBe(0.0254);
  });

  it('lam tron 6 chu so thap phan', () => {
    expect(toVndBillion(1, 1_234_567)).toBe(0.001235);
  });
});
