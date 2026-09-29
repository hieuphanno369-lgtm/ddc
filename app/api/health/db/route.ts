import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/client-ip';
import { HEALTH_DB_TIMEOUT_MS, pingDb } from '@/lib/health-db';
import { errorFields, logger } from '@/lib/logger';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

/** Kiểm DB cho compose/reverse proxy/giám sát IT. Công khai, KHÔNG trả chi tiết lỗi. */
export async function GET(req: NextRequest) {
  // Kiem per-IP TRUOC: chi request qua duoc han muc rieng cua IP moi tinh vao bo dem toan cuc,
  // de mot IP vuot han muc khong the tu lam day bo dem toan cuc va khoa lay IP khac (B-1).
  const ip = clientIpFrom(req.headers);
  const perIp = rateLimit(`health-db:${ip}`, 60, 60_000);
  if (!perIp.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(perIp.retryAfterSec) } });
  const global = rateLimit('health-db:global', 300, 60_000);
  if (!global.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(global.retryAfterSec) } });
  const r = await pingDb(() => prisma.$queryRaw`SELECT 1`, HEALTH_DB_TIMEOUT_MS);
  if (r.ok) return NextResponse.json({ status: 'ok', db: 'ok' }, { headers: NO_STORE });
  logger.warn('health.db_down', r.timedOut ? { errName: 'Timeout' } : errorFields(r.error));
  return NextResponse.json({ status: 'error', db: 'down' }, { status: 503, headers: NO_STORE });
}
