import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * P5-B Task 3 - /api/health/db kiem DB that (pg $queryRaw), cong khai, khong tra chi tiet loi,
 * co gioi han tan suat theo IP. Khuon theo `src/server/csp-report-route.test.ts`.
 */
const queryRaw = vi.fn();
vi.mock('@/server/db', () => ({ prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }));

let ipSeq = 0;
const nextIp = () => `203.0.113.${++ipSeq}`;

function req(ip = nextIp()): NextRequest {
  return new NextRequest('http://localhost/api/health/db', { headers: { 'x-forwarded-for': ip } });
}

afterEach(() => {
  vi.restoreAllMocks();
  queryRaw.mockReset();
});

describe('GET /api/health/db', () => {
  it('DB song -> 200, body { status, db }, khong luu cache', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const { GET } = await import('../../app/api/health/db/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['db', 'status']);
    expect(body.status).toBe('ok');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('DB chet -> 503, khong lo chi tiet loi, console.warn khong chua bi mat', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=x'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { GET } = await import('../../app/api/health/db/route');
    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: 'error', db: 'down' });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('10.0.0.5');
    expect(raw).not.toContain('password');
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(JSON.parse(line).event).toBe('health.db_down');
    expect(line).not.toContain('password=x');
  });

  it('cung 1 IP: 60 lan khong 429, lan 61 -> 429 co Retry-After', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const { GET } = await import('../../app/api/health/db/route');
    const ip = nextIp();
    for (let i = 0; i < 60; i++) {
      const res = await GET(req(ip));
      expect(res.status).toBe(200);
    }
    const res = await GET(req(ip));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('IP A gui 400 lan (bi 429 tu lan 61) khong duoc tinh vao bo dem toan cuc, IP B van nhan 200 (B-1)', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const { GET } = await import('../../app/api/health/db/route');
    const ipA = nextIp();
    for (let i = 0; i < 400; i++) {
      const res = await GET(req(ipA));
      expect(res.status).toBe(i < 60 ? 200 : 429);
    }
    const ipB = nextIp();
    const resB = await GET(req(ipB));
    expect(resB.status).toBe(200);
  });
});
