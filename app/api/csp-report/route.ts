import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { clientIpFrom } from '@/lib/client-ip';
import {
  CSP_REPORT_CONTENT_TYPES, CSP_REPORT_MAX_BYTES, parseCspReports, readBodyCapped,
} from '@/lib/csp-report';

export const dynamic = 'force-dynamic';

/**
 * Nhận báo cáo vi phạm CSP (Report-Only, P5-B). Endpoint công khai (trình duyệt gửi không kèm phiên),
 * chỉ ghi `console.warn`, KHÔNG ghi DB (tránh làm phình bảng). Có giới hạn tần suất theo IP và toàn
 * cục, trần kích thước body; log không chứa IP, cookie, query string.
 */
function empty(status: number, extra: Record<string, string> = {}): Response {
  return new Response(null, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

function tooMany(retryAfterSec: number): Response {
  return empty(429, { 'Retry-After': String(retryAfterSec) });
}

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const perIp = rateLimit(`csp-report:${ip}`, 30, 60_000);
  if (!perIp.ok) return tooMany(perIp.retryAfterSec);
  const global = rateLimit('csp-report:global', 300, 60_000);
  if (!global.ok) return tooMany(global.retryAfterSec);

  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!CSP_REPORT_CONTENT_TYPES.has(contentType)) return empty(415);

  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > CSP_REPORT_MAX_BYTES) return empty(413);
  const text = await readBodyCapped(req.body, CSP_REPORT_MAX_BYTES);
  if (text === null) return empty(413);

  for (const v of parseCspReports(contentType, text)) console.warn('[csp-report]', JSON.stringify(v));
  return empty(204);
}
