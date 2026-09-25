import { FX_CURRENCIES, type FxCurrency } from '@/lib/fx';
import { parseVcbXml, VCB_DEFAULT_URL } from '@/lib/vcb-rates';
import type { YearMonth } from '@/lib/clock';
import { repo } from './repo';

/** Lấy tỷ giá VCB qua HTTP - KHÔNG throw, mọi lỗi trả về error rõ ràng. */
export async function fetchVcbRates(
  opts: { fetchImpl?: typeof fetch; url?: string; timeoutMs?: number } = {},
): Promise<
  | { ok: true; rates: Partial<Record<FxCurrency, number>>; sourceTime: string | null }
  | { ok: false; error: 'network' | 'http' | 'parse'; detail: string }
> {
  const url = opts.url ?? process.env.VCB_RATE_URL ?? VCB_DEFAULT_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, error: 'http', detail: `HTTP ${res.status}` };
    const xml = await res.text();
    const { rates, sourceTime } = parseVcbXml(xml);
    if (rates.USD == null && rates.EUR == null) return { ok: false, error: 'parse', detail: 'khong doc duoc USD lan EUR tu XML' };
    return { ok: true, rates, sourceTime };
  } catch (e) {
    return { ok: false, error: 'network', detail: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cập nhật tỷ giá tháng `ym` từ VCB - KHÔNG ghi đè dòng đã sửa tay ('manual').
 * Bảo đảm luôn có dòng VND = 1 (source 'manual') cho tháng đó.
 */
export async function refreshMonthRates(
  ym: YearMonth,
  by: string,
  fetchImpl?: typeof fetch,
): Promise<
  | { ok: true; saved: FxCurrency[]; keptManual: FxCurrency[]; missingFromSource: FxCurrency[] }
  | { ok: false; error: 'network' | 'http' | 'parse'; detail: string }
> {
  const fetched = await fetchVcbRates({ fetchImpl });
  if (!fetched.ok) return fetched;

  const existing = await repo.getExchangeRates();
  const saved: FxCurrency[] = [];
  const keptManual: FxCurrency[] = [];
  const missingFromSource: FxCurrency[] = [];

  for (const code of FX_CURRENCIES) {
    const prev = existing.find((r) => r.currencyCode === code && r.yearMonth === ym);
    if (prev?.source === 'manual') {
      keptManual.push(code);
      continue;
    }
    const rate = fetched.rates[code];
    if (rate == null) {
      missingFromSource.push(code);
      continue;
    }
    await repo.upsertExchangeRate({ currencyCode: code, yearMonth: ym, rateToVnd: rate, source: 'vcb' }, by);
    saved.push(code);
  }

  const hasVnd = existing.some((r) => r.currencyCode === 'VND' && r.yearMonth === ym);
  if (!hasVnd) {
    await repo.upsertExchangeRate({ currencyCode: 'VND', yearMonth: ym, rateToVnd: 1, source: 'manual' }, by);
  }

  return { ok: true, saved, keptManual, missingFromSource };
}
