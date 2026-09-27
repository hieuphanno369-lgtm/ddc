import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // L2 - dùng chung `clientIpFrom` (TRUSTED_PROXY_HOPS, không còn tin phần tử đầu XFF).
  const ip = clientIpFrom(req.headers);
  const rl = rateLimit(`health:${ip}`, 120, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
}
