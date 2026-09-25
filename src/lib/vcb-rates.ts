import { FX_CURRENCIES, type FxCurrency } from '@/lib/fx';

/**
 * T6 (Task 7, P2A): parse XML tỷ giá Vietcombank - hàm THUẦN, không fetch (xem
 * `src/server/fx-rates.ts`). Định dạng: `<ExrateList><DateTime>..</DateTime>
 * <Exrate CurrencyCode="USD" Buy="25,110.00" Transfer="25,140.00" Sell="25,500.00"/>...</ExrateList>`.
 */
export const VCB_DEFAULT_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
/** Q7: mua chuyển khoản (khớp ghi chú seed dims.ts). */
export const VCB_RATE_KIND: 'Buy' | 'Transfer' | 'Sell' = 'Transfer';

const EXRATE_RE = /<Exrate\s+([^>]*?)\/?>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;
const DATETIME_RE = /<DateTime>([^<]*)<\/DateTime>/;

export function parseVcbXml(
  xml: string,
  kind: 'Buy' | 'Transfer' | 'Sell' = VCB_RATE_KIND,
): { rates: Partial<Record<FxCurrency, number>>; sourceTime: string | null } {
  const rates: Partial<Record<FxCurrency, number>> = {};
  let m: RegExpExecArray | null;
  EXRATE_RE.lastIndex = 0;
  while ((m = EXRATE_RE.exec(xml))) {
    const attrsText = m[1];
    const attrs: Record<string, string> = {};
    let a: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((a = ATTR_RE.exec(attrsText))) attrs[a[1]] = a[2];

    const code = attrs.CurrencyCode as FxCurrency | undefined;
    if (!code || !(FX_CURRENCIES as readonly string[]).includes(code)) continue;

    const raw = attrs[kind];
    if (!raw || raw.trim() === '' || raw.trim() === '-') continue;
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    rates[code] = n;
  }

  const dt = DATETIME_RE.exec(xml);
  return { rates, sourceTime: dt ? dt[1] : null };
}
