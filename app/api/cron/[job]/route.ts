import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runJob } from '@/server/jobs';
import type { JobName } from '@/server/repo/types';

/**
 * Cron ngoài gọi (K4, ke-hoach.md P2A). Ví dụ:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/alerts_daily
 *   (06:00 mỗi ngày)
 */
export const dynamic = 'force-dynamic';

const JOB_NAMES: JobName[] = ['alerts_daily'];

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });

  const auth = req.headers.get('authorization') ?? '';
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { job } = await params;
  if (!(JOB_NAMES as string[]).includes(job)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = await runJob(job as JobName, 'cron');
  return NextResponse.json(result, { status: 200 });
}
