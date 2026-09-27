import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // L2 - dùng chung `clientIpFrom` (TRUSTED_PROXY_HOPS, không còn tin phần tử đầu XFF).
  const ip = clientIpFrom(req.headers);
  const rl = rateLimit(`health:${ip}`, 120, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  // R4 (bao-mat.md vòng 2) - CHỈ cờ đúng/sai, KHÔNG trả IP thật: cho phép giám sát triển khai phát
  // hiện thiếu cấu hình reverse proxy (mọi request rơi vào khoá `'unknown'` dùng chung) mà không lộ
  // thông tin mạng của người gọi.
  return NextResponse.json({ status: 'ok', time: new Date().toISOString(), clientIpResolved: ip !== 'unknown' });
}
