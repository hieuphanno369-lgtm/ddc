/**
 * Load test dong thoi that (P5-B) tren `next start -p 3001`, du lieu da seed `perf:seed`.
 * Mac dinh (Q1 = c, chu du an chot 2026-09-29): 100 nguoi dung ao, 5 phut, tieu chi trang p95 <= 3s,
 * p99 <= 5s, xuat Excel p95 <= 8s, loi < 1%. Chay muc 30/50 lam moc so sanh bang --vus=30.
 * Env bat buoc (1 trong 2):
 *   LOAD_CREDENTIALS_FILE  file JSON [{"email":"...","password":"..."}] NAM NGOAI repo (nhieu vai tro)
 *   PERF_EMAIL + PERF_PASSWORD  1 tai khoan dung chung cho moi nguoi dung ao
 * Env tuy chon: PERF_BASE (mac dinh http://localhost:3001), PERF_ALLOW_REMOTE=1.
 * Moi nguoi dung ao dang nhap DUNG 1 LAN, tuan tu, khong thu lai (khong bao gio tu khoa tai khoan).
 * Usage: npm run perf:load -- --vus=30 --duration=300 --out="$env:TEMP\ddc-load.json"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { currentMonth } from '@/lib/clock';
import {
  evaluateCriteria, summarize, summarizeBy, type LatencyStats, type LoadErrorKind, type LoadSample,
} from '@/lib/load-stats';
import {
  assertOutsideRepo, classifyResponse, DEFAULT_SCENARIOS, mulberry32, parseCredentials, parseLoadArgs,
  pickWeighted, scenariosForRole, toLoadRole, vuForwardedFor, type LoadCredential, type LoadRole,
} from '@/lib/load-test';
import { assertPerfDb, assertPerfHost, assertPerfLocalBase, PERF_PREFIX, PERF_USER } from '@/lib/perf-guard';
import { cookieHeader, mergeCookies, type CookieJar } from '@/lib/perf-http';
import { prisma } from '@/server/db';
import { login } from './http-session';

const BASE = process.env.PERF_BASE ?? 'http://localhost:3001';
const TAG = '[load-test]';

function fail(msg: string): never {
  console.error(`${TAG} ${msg}`);
  process.exit(1);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Vu { index: number; role: LoadRole; jar: CookieJar; xff: string | null }

let stopRequested = false;

function fmt(n: number | null): string {
  return n === null ? '-' : n.toFixed(0);
}

function row(name: string, s: LatencyStats): string {
  return `| ${name} | ${s.count} | ${s.errors} | ${(s.errorRate * 100).toFixed(2)}% | ${fmt(s.p50)} | ${fmt(s.p95)} | ${fmt(s.p99)} | ${fmt(s.max)} | ${s.rps.toFixed(1)} |`;
}

async function readCredentials(): Promise<LoadCredential[]> {
  const file = process.env.LOAD_CREDENTIALS_FILE;
  if (file) {
    assertOutsideRepo(file, process.cwd());
    return parseCredentials(readFileSync(file, 'utf8'));
  }
  const email = process.env.PERF_EMAIL;
  const password = process.env.PERF_PASSWORD;
  if (!email || !password) fail('Thieu env: dat LOAD_CREDENTIALS_FILE hoac PERF_EMAIL + PERF_PASSWORD.');
  return parseCredentials(JSON.stringify([{ email, password }]));
}

async function main() {
  let opts;
  try {
    opts = parseLoadArgs(process.argv.slice(2));
    assertPerfLocalBase(BASE, process.env.PERF_ALLOW_REMOTE === '1');
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  let creds: LoadCredential[];
  try {
    creds = await readCredentials();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const [{ current_database: currentDb, inet_server_addr: inetServerAddr }] = await prisma.$queryRaw<
    { current_database: string; inet_server_addr: string | null }[]
  >(Prisma.sql`SELECT current_database(), host(inet_server_addr()) AS inet_server_addr`);
  assertPerfDb(currentDb);
  assertPerfHost(inetServerAddr, process.env.DATABASE_URL ?? '');

  // Kiem vai tro/khoa TRUOC khi dang nhap bat ky ai.
  const emails = creds.map((c) => c.email);
  const roleRows = await prisma.userRole.findMany({
    where: { email: { in: emails } },
    select: { email: true, role: true, isActive: true, lockedAt: true },
  });
  const roleByEmail = new Map<string, LoadRole>();
  for (const c of creds) {
    const r = roleRows.find((x) => x.email === c.email);
    if (!r) fail(`Tai khoan ${c.email} khong ton tai trong user_roles.`);
    if (!r.isActive) fail(`Tai khoan ${c.email} dang bi tat (isActive = false).`);
    if (r.lockedAt !== null) fail(`Tai khoan ${c.email} dang bi khoa - chay 'npm run unlock-account' truoc.`);
    const role = toLoadRole(r.role);
    if (role === null) fail(`Tai khoan ${c.email} co vai tro '${r.role}' khong vao duoc Tong quan (data-entry) - bo khoi danh sach.`);
    roleByEmail.set(c.email, role);
  }

  const projects = await prisma.project.findMany({
    where: { masterCode: { startsWith: PERF_PREFIX }, createdBy: PERF_USER },
    select: { id: true },
    orderBy: { masterCode: 'asc' },
    take: 50,
  });
  await prisma.$disconnect();
  if (projects.length < 5) fail('Thieu du an PERF- - chay npm run perf:seed truoc.');
  const ids = projects.map((p) => p.id);

  // Dang nhap TUAN TU, moi nguoi dung ao 1 lan, loi dau tien la dung ngay (khong thu lai).
  console.log(`${TAG} Dang nhap tuan tu ${opts.vus} nguoi dung ao (${creds.length} tai khoan) tai ${BASE}...`);
  const vus: Vu[] = [];
  for (let i = 0; i < opts.vus; i++) {
    const cred = creds[i % creds.length];
    const xff = opts.xff === 'per-vu' ? vuForwardedFor(i) : null;
    try {
      const jar = await login({
        base: BASE, email: cred.email, password: cred.password,
        headers: xff ? { 'X-Forwarded-For': xff } : undefined, tag: TAG,
      });
      vus.push({ index: i, role: roleByEmail.get(cred.email)!, jar, xff });
    } catch (err) {
      fail(`${err instanceof Error ? err.message : String(err)} (nguoi dung ao ${i}, dung ngay, khong thu lai)`);
    }
  }

  // Lam nong (khong tinh diem): nguoi dung ao 0 goi moi kich ban cua vai tro minh 1 lan.
  const warm = vus[0];
  const month = currentMonth();
  for (const sc of scenariosForRole(DEFAULT_SCENARIOS, warm.role)) {
    const url = BASE + sc.path({ projectId: ids[0], month });
    const t = performance.now();
    const res = await fetch(url, { headers: headersFor(warm), redirect: 'manual' });
    await res.arrayBuffer();
    console.log(`${TAG} Lam nong (khong tinh diem): ${sc.path({ projectId: ids[0], month })} -> ${res.status} ${(performance.now() - t).toFixed(0)} ms`);
  }

  process.on('SIGINT', () => {
    console.log(`\n${TAG} Nhan Ctrl+C, dung vong lap va in ket qua da co...`);
    stopRequested = true;
  });

  const samples: LoadSample[] = [];
  const t0 = performance.now();
  const runEnd = t0 + opts.durationSec * 1000;
  console.log(`${TAG} Chay tai: ${opts.vus} VU, ${opts.durationSec}s, ramp ${opts.rampSec}s.`);

  await Promise.all(vus.map(async (vu) => {
    await sleep((opts.rampSec * 1000 * vu.index) / opts.vus);
    const rnd = mulberry32(opts.seed + vu.index);
    const scenarios = scenariosForRole(DEFAULT_SCENARIOS, vu.role);
    while (!stopRequested && performance.now() < runEnd) {
      const sc = pickWeighted(scenarios, rnd());
      const projectId = ids[Math.floor(rnd() * ids.length)];
      const path = sc.path({ projectId, month });
      const start = performance.now();
      let status = 0;
      let errorKind: LoadErrorKind | null;
      try {
        const res = await fetch(BASE + path, {
          headers: headersFor(vu), redirect: 'manual', signal: AbortSignal.timeout(opts.timeoutMs),
        });
        await res.arrayBuffer();
        status = res.status;
        mergeCookies(vu.jar, res.headers);
        errorKind = classifyResponse(res.status, res.headers.get('content-type'), sc.expect);
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        errorKind = name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network';
      }
      samples.push({ scenario: sc.name, group: sc.group, ms: performance.now() - start, status, errorKind });
      const think = opts.thinkMinMs + rnd() * (opts.thinkMaxMs - opts.thinkMinMs);
      await sleep(Math.max(0, Math.min(think, runEnd - performance.now())));
    }
  }));

  const wallMs = performance.now() - t0;
  const byScenario = summarizeBy(samples, wallMs, (s) => s.scenario);
  const pages = summarize(samples.filter((s) => s.group === 'page'), wallMs);
  const overall = summarize(samples, wallMs);
  const errorsByKind: Record<string, number> = {};
  for (const s of samples) if (s.errorKind) errorsByKind[s.errorKind] = (errorsByKind[s.errorKind] ?? 0) + 1;

  console.log('\n| kich ban | n | loi | loi% | p50 | p95 | p99 | max | rps |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const [name, s] of Object.entries(byScenario)) console.log(row(name, s));
  console.log(row('page', pages));
  console.log(row('TONG', overall));
  console.log(`\nLoi theo loai: ${Object.keys(errorsByKind).length ? JSON.stringify(errorsByKind) : 'khong co'}`);

  const { pass: criteriaPass, failures } = evaluateCriteria(
    { overall, pages, exportStats: byScenario['api_export'] ?? null }, opts.criteria,
  );
  const pass = criteriaPass && !stopRequested;
  if (stopRequested) failures.push('bi dung giua chung (Ctrl+C), chua du thoi luong');
  console.log(pass ? `\n${TAG} DAT` : `\n${TAG} KHONG DAT`);
  for (const f of failures) console.log(`  - ${f}`);

  if (opts.out) {
    const { out: _out, ...optionsForFile } = opts;
    writeFileSync(opts.out, JSON.stringify({
      startedAt: new Date(Date.now() - wallMs).toISOString(),
      options: optionsForFile, overall, pages, byScenario, errorsByKind, pass, failures,
    }, null, 2));
    console.log(`${TAG} Da ghi ${opts.out}`);
  }
  process.exit(pass ? 0 : 1);
}

function headersFor(vu: Vu): Record<string, string> {
  const h: Record<string, string> = { Cookie: cookieHeader(vu.jar) };
  if (vu.xff) h['X-Forwarded-For'] = vu.xff;
  return h;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
