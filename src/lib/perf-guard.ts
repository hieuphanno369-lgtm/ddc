import { isValidIsoDate } from '@/lib/clock';

/**
 * Chốt chặn cho script seed hiệu năng (Bước 7 P2B): CHỈ chạy trên `ddc_control_tower_b` (DB của
 * B), không bao giờ chạm DB của A (`ddc_control_tower`) hay DB nào khác.
 */
export const PERF_DB = 'ddc_control_tower_b';
export const PERF_PREFIX = 'PERF-';
export const PERF_USER = 'perf-seed'; // audit_log.changedBy, dim_project.createdBy/updatedBy
export const PERF_ACTIVITY_EMAIL = 'perf@seed.local';

/** Ném Error nếu currentDb !== PERF_DB (chặn chạy nhầm DB của A 'ddc_control_tower' hay DB khác). */
export function assertPerfDb(currentDb: string): void {
  if (currentDb !== PERF_DB) {
    throw new Error(
      `perf-guard: dang ket noi database '${currentDb}', KHONG PHAI '${PERF_DB}'. ` +
      'Dung lai - kiem tra DATABASE_URL truoc khi chay script seed hieu nang.',
    );
  }
}

const PERF_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** true neu hostname trong databaseUrl la localhost/127.0.0.1/::1 (URL khong hop le -> false). */
export function isLoopbackDatabaseUrl(databaseUrl: string): boolean {
  try {
    return PERF_LOOPBACK_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Nem Error neu ket noi DB khong phai host loopback. Chan truong hop DATABASE_URL vo tinh tro toi
 * mot server khac (vd staging/prod) co DB trung ten `ddc_control_tower_b`.
 * `inetServerAddr`: ket qua `host(inet_server_addr())` - null nghia la ket noi qua unix socket (loopback).
 */
export function assertPerfHost(inetServerAddr: string | null, databaseUrl: string): void {
  const isLoopbackAddr = inetServerAddr === null || inetServerAddr === '127.0.0.1' || inetServerAddr === '::1';
  if (isLoopbackAddr || isLoopbackDatabaseUrl(databaseUrl)) return;
  throw new Error(
    `perf-guard: server DB khong phai host loopback (inet_server_addr()='${inetServerAddr}', ` +
    'DATABASE_URL khong phai localhost/127.0.0.1). Dung lai - script nay chi duoc chay tren DB dev local.',
  );
}

/**
 * Nem Error neu bien moi truong PERF_CONFIRM khong dung bang `PERF_DB`. Bat buoc xac nhan tay
 * truoc khi xoa/them 10 trieu dong, tranh chay nham vi go lenh sai thu muc/nham .env.
 */
export function assertPerfConfirm(confirmEnv: string | undefined): void {
  if (confirmEnv !== PERF_DB) {
    throw new Error(
      `perf-guard: thieu hoac sai bien moi truong PERF_CONFIRM (can '${PERF_DB}', nhan '${confirmEnv ?? ''}'). ` +
      `Chay lai voi PERF_CONFIRM=${PERF_DB} de xac nhan ban muon xoa/them du lieu tren DB nay.`,
    );
  }
}

const PERF_ALLOW_REMOTE_ENV = 'PERF_ALLOW_REMOTE';

/**
 * Nem Error neu `base` (PERF_BASE cua measure-pages.ts) khong phai host loopback, tru khi
 * `allowRemote` (bien moi truong PERF_ALLOW_REMOTE='1') duoc dat ro rang. Script gui mat khau
 * admin qua HTTP toi `base` nen khong duoc mac dinh cho phep host bat ky.
 */
export function assertPerfLocalBase(base: string, allowRemote: boolean): void {
  let hostname: string;
  try {
    hostname = new URL(base).hostname;
  } catch {
    throw new Error(`perf-guard: PERF_BASE '${base}' khong phai URL hop le.`);
  }
  if (PERF_LOOPBACK_HOSTS.has(hostname) || allowRemote) return;
  throw new Error(
    `perf-guard: PERF_BASE '${base}' khong phai host loopback (localhost/127.0.0.1/::1) - script nay gui ` +
    `mat khau admin qua HTTP toi host nay. Neu chac chan, dat ${PERF_ALLOW_REMOTE_ENV}=1 de xac nhan.`,
  );
}

export interface PerfOptions { projects: number; days: number; audit: number; activity: number; end: string; clean: boolean }

function parsePositiveInt(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} phai la so nguyen duong, nhan '${value}'`);
  }
  return n;
}

/** Đọc argv: --projects=500 --days=730 --audit=1000000 --activity=100000 --end=YYYY-MM-DD --clean-only. */
export function parsePerfArgs(argv: string[], today: string): PerfOptions {
  const opts: PerfOptions = { projects: 500, days: 730, audit: 1_000_000, activity: 100_000, end: today, clean: false };
  for (const arg of argv) {
    if (arg === '--clean-only') {
      opts.clean = true;
      continue;
    }
    const m = /^--([a-z]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'projects') opts.projects = parsePositiveInt(value, '--projects');
    else if (key === 'days') opts.days = parsePositiveInt(value, '--days');
    else if (key === 'audit') opts.audit = parsePositiveInt(value, '--audit');
    else if (key === 'activity') opts.activity = parsePositiveInt(value, '--activity');
    else if (key === 'end') {
      if (!isValidIsoDate(value)) throw new Error(`--end phai la ngay hop le 'YYYY-MM-DD', nhan '${value}'`);
      opts.end = value;
    }
  }
  return opts;
}

/** Ước lượng số dòng sẽ sinh (để in trước khi chạy). */
export function estimateRows(o: PerfOptions, contractors: number, shifts: number, equipments: number, stages: number): number {
  return o.projects * (
    1 + 36 * 3 + 36 * stages + contractors + 6
    + contractors * o.days * shifts
    + contractors * equipments * o.days
  ) + o.audit + o.activity;
}
