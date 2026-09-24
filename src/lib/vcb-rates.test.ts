import { describe, expect, it } from 'vitest';
import { parseVcbXml } from './vcb-rates';

const XML = `<?xml version="1.0" encoding="utf-8"?>
<ExrateList>
<DateTime>9/24/2026 8:15:00 AM</DateTime>
<Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="25,110.00" Transfer="25,140.00" Sell="25,500.00"/>
<Exrate CurrencyCode="EUR" CurrencyName="EURO" Buy="27,200.00" Transfer="27,500.00" Sell="28,700.00"/>
<Exrate CurrencyCode="JPY" CurrencyName="JAPANESE YEN" Buy="160.00" Transfer="162.00" Sell="169.00"/>
<Exrate CurrencyCode="AUD" CurrencyName="AUSTRALIAN DOLLAR" Buy="-" Transfer="-" Sell="-"/>
</ExrateList>`;

describe('parseVcbXml', () => {
  it("mac dinh Transfer -> USD 25140", () => {
    const { rates } = parseVcbXml(XML);
    expect(rates.USD).toBe(25140);
    expect(rates.EUR).toBe(27500);
  });

  it('chi lay FX_CURRENCIES (bo JPY, AUD khong thuoc danh sach)', () => {
    const { rates } = parseVcbXml(XML);
    expect(Object.keys(rates).sort()).toEqual(['EUR', 'USD']);
  });

  it("kind: 'Sell'", () => {
    const { rates } = parseVcbXml(XML, 'Sell');
    expect(rates.USD).toBe(25500);
    expect(rates.EUR).toBe(28700);
  });

  it("dong 'Transfer=\"-\"' bi bo qua (AUD khong nam trong FX_CURRENCIES nen da bi loai truoc)", () => {
    const { rates } = parseVcbXml(XML);
    expect(rates).not.toHaveProperty('AUD');
  });

  it('XML rac -> rates rong', () => {
    const { rates, sourceTime } = parseVcbXml('khong-phai-xml');
    expect(rates).toEqual({});
    expect(sourceTime).toBeNull();
  });

  it('sourceTime doc tu DateTime', () => {
    const { sourceTime } = parseVcbXml(XML);
    expect(sourceTime).toBe('9/24/2026 8:15:00 AM');
  });
});
