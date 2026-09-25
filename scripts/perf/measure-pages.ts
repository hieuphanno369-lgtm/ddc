/**
 * Do thoi gian HTTP that (tieu chi nghiem thu T1) tren du lieu da seed 10 trieu dong. Chay SAU
 * khi build + `next start -p 3001` (xem quy trinh trong .bangiao/hieu-nang.md).
 * Env bat buoc: PERF_EMAIL, PERF_PASSWORD (tai khoan admin seed - KHONG ghi mat khau vao file).
 * Env tuy chon: PERF_BASE (mac dinh http://localhost:3001).
 * Usage: PERF_EMAIL=... PERF_PASSWORD=... npx tsx scripts/perf/measure-pages.ts
 */
import { addMonths, currentMonth } from '@/lib/clock';
import { assertPerfLocalBase, PERF_PREFIX } from '@/lib/perf-guard';
import { prisma } from '@/server/db';

const BASE = process.env.PERF_BASE ?? 'http://localhost:3001';
const EMAIL = process.env.PERF_EMAIL;
const PASSWORD = process.env.PERF_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('[measure-pages] Thieu env PERF_EMAIL / PERF_PASSWORD.');
  process.exit(1);
}

try {
  assertPerfLocalBase(BASE, process.env.PERF_ALLOW_REMOTE === '1');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

/** Gom cookie tu Set-Cookie qua nhieu request (chi giu name=value, bo attribute). */
function mergeCookies(jar: Map<string, string>, res: Response) {
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ?? '').split(/,(?=[^;]+?=)/);
  for (const line of raw) {
    const first = line.split(';')[0]?.trim();
    if (!first || !first.includes('=')) continue;
    const idx = first.indexOf('=');
    jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function login(): Promise<Map<string, string>> {
  const jar = new Map<string, string>();

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  mergeCookies(jar, csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken, email: EMAIL!, password: PASSWORD!, callbackUrl: `${BASE}/vi/overview`, json: 'true',
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(jar) },
    body: body.toString(),
    redirect: 'manual',
  });
  mergeCookies(jar, loginRes);
  if (!jar.has('next-auth.session-token') && !jar.has('__Secure-next-auth.session-token')) {
    throw new Error(`[measure-pages] Dang nhap that bai (status ${loginRes.status}) - kiem tra PERF_EMAIL/PERF_PASSWORD.`);
  }
  return jar;
}

async function measure(url: string, jar: Map<string, string>): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookieHeader(jar) }, redirect: 'manual' });
  await res.arrayBuffer();
  const ms = performance.now() - t0;
  if (res.status !== 200) throw new Error(`[measure-pages] ${url} -> status ${res.status} (ky vong 200)`);
  return ms;
}

async function main() {
  const perfProjects = await prisma.project.findMany({
    where: { masterCode: { in: Array.from({ length: 5 }, (_, i) => `${PERF_PREFIX}${String(i + 1).padStart(4, '0')}`) } },
    select: { id: true, masterCode: true },
    orderBy: { masterCode: 'asc' },
  });
  await prisma.$disconnect();
  if (perfProjects.length < 5) {
    console.error('[measure-pages] Thieu du an PERF-0001..PERF-0005 - chay `npm run perf:seed` truoc.');
    process.exit(1);
  }

  console.log(`[measure-pages] Dang nhap ${EMAIL} tai ${BASE}...`);
  const jar = await login();

  const months = [currentMonth(), ...Array.from({ length: 4 }, (_, i) => addMonths(currentMonth(), -(i + 1)))];
  const overviewUrls = [...months.map((m) => `${BASE}/vi/overview?month=${m}`), `${BASE}/vi/overview?month=all`];
  const detailUrls = [...perfProjects.map((p) => `${BASE}/vi/projects/${p.id}`), `${BASE}/vi/projects/1`];

  const results: { url: string; ms: number }[] = [];
  console.log('\n[measure-pages] Tong quan:');
  for (const url of overviewUrls) {
    const ms = await measure(url, jar);
    results.push({ url, ms });
    console.log(`  ${url} -> ${ms.toFixed(0)} ms`);
  }
  console.log('\n[measure-pages] Chi tiet:');
  for (const url of detailUrls) {
    const ms = await measure(url, jar);
    results.push({ url, ms });
    console.log(`  ${url} -> ${ms.toFixed(0)} ms`);
  }

  const max = Math.max(...results.map((r) => r.ms));
  console.log('\n| Trang | ms |');
  console.log('|---|---|');
  for (const r of results) console.log(`| ${r.url.replace(BASE, '')} | ${r.ms.toFixed(0)} |`);
  console.log(`\n[measure-pages] MAX = ${max.toFixed(0)} ms (tieu chi: <= 1500 ms moi request)`);

  if (max > 1500) {
    console.error('[measure-pages] CO REQUEST > 1500ms - xem chi tiet o bang tren, ghi vao .bangiao/hieu-nang.md.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
