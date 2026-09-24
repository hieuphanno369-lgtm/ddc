import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/server/repo/mock-repo';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { fetchVcbRates, refreshMonthRates } from './fx-rates';

const XML = `<ExrateList><DateTime>9/24/2026 8:15:00 AM</DateTime>
<Exrate CurrencyCode="USD" Transfer="25,140.00"/>
<Exrate CurrencyCode="EUR" Transfer="27,500.00"/>
</ExrateList>`;

function fakeFetch(status: number, body: string) {
  return vi.fn(async () => ({ ok: status < 400, status, text: async () => body }) as Response);
}

beforeEach(() => {
  repo.reset();
});

describe('fetchVcbRates', () => {
  it('ok -> tra dung rates', async () => {
    const res = await fetchVcbRates({ fetchImpl: fakeFetch(200, XML) });
    expect(res).toEqual({ ok: true, rates: { USD: 25140, EUR: 27500 }, sourceTime: '9/24/2026 8:15:00 AM' });
  });

  it('status 500 -> http', async () => {
    const res = await fetchVcbRates({ fetchImpl: fakeFetch(500, '') });
    expect(res).toEqual({ ok: false, error: 'http', detail: 'HTTP 500' });
  });

  it('body rac -> parse', async () => {
    const res = await fetchVcbRates({ fetchImpl: fakeFetch(200, 'khong-phai-xml') });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('parse');
  });

  it('fetch throw -> network', async () => {
    const throwing = vi.fn(async () => { throw new Error('ECONNRESET'); });
    const res = await fetchVcbRates({ fetchImpl: throwing as unknown as typeof fetch });
    expect(res).toEqual({ ok: false, error: 'network', detail: 'ECONNRESET' });
  });
});

describe('refreshMonthRates', () => {
  it('ok -> upsert USD/EUR source vcb', async () => {
    const res = await refreshMonthRates('2026-10', 'admin@daidung.com.vn', fakeFetch(200, XML));
    expect(res).toEqual({ ok: true, saved: ['USD', 'EUR'], keptManual: [], missingFromSource: [] });
    const rates = repo.getExchangeRates();
    expect(rates.find((r) => r.currencyCode === 'USD' && r.yearMonth === '2026-10')).toMatchObject({ rateToVnd: 25140, source: 'vcb' });
  });

  it("da co EUR manual -> keptManual: ['EUR'], giu so cu", async () => {
    repo.upsertExchangeRate({ currencyCode: 'EUR', yearMonth: '2026-10', rateToVnd: 99999, source: 'manual' }, 'admin@daidung.com.vn');
    const res = await refreshMonthRates('2026-10', 'admin@daidung.com.vn', fakeFetch(200, XML));
    expect(res).toEqual({ ok: true, saved: ['USD'], keptManual: ['EUR'], missingFromSource: [] });
    const eur = repo.getExchangeRates().find((r) => r.currencyCode === 'EUR' && r.yearMonth === '2026-10');
    expect(eur?.rateToVnd).toBe(99999);
  });

  it('fetch throw -> network, khong ghi gi', async () => {
    const before = repo.getExchangeRates().length;
    const throwing = vi.fn(async () => { throw new Error('boom'); });
    const res = await refreshMonthRates('2026-10', 'admin@daidung.com.vn', throwing as unknown as typeof fetch);
    expect(res).toEqual({ ok: false, error: 'network', detail: 'boom' });
    expect(repo.getExchangeRates().length).toBe(before);
  });
});
