import { realpathSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_LOAD_CRITERIA, type LoadCriteria, type LoadErrorKind } from './load-stats';

/**
 * Phần logic thuần của load test (P5-B): tham số CLI, PRNG, chọn kịch bản, XFF theo người dùng ảo,
 * phân loại phản hồi, đọc file tài khoản. Script chạy thật ở `scripts/perf/load-test.ts`.
 */

export type LoadRole = 'admin' | 'bod' | 'viewer';
export type Expect = 'html' | 'xlsx' | 'json';

export interface Scenario {
  name: string;
  group: 'page' | 'api';
  weight: number;
  roles: readonly LoadRole[];
  expect: Expect;
  path: (ctx: { projectId: number; month: string }) => string;
}

const ALL: readonly LoadRole[] = ['admin', 'bod', 'viewer'];
/**
 * Vai vao duoc trang van hanh va du an PERF: viewer bi requireUser chuyen khoi /alerts, /report (307) va chi
 * thay du an duoc phan quyen (du an PERF tra 404). Kich ban sai vai se sinh loi gia nen chi gan admin, bod.
 * `/vi/projects` khong co kich ban rieng: trang chi redirect 307 sang du an dau tien (thiet ke), loi cua
 * script khi coi 3xx la loi van giu nghiem (classifyResponse khong noi long).
 */
const OPS: readonly LoadRole[] = ['admin', 'bod'];

export const DEFAULT_SCENARIOS: readonly Scenario[] = [
  { name: 'overview_month', group: 'page', weight: 25, roles: ALL, expect: 'html', path: ({ month }) => `/vi/overview?month=${month}` },
  { name: 'overview_all', group: 'page', weight: 10, roles: ALL, expect: 'html', path: () => '/vi/overview?month=all' },
  { name: 'project_detail', group: 'page', weight: 45, roles: OPS, expect: 'html', path: ({ projectId }) => `/vi/projects/${projectId}` },
  { name: 'alerts', group: 'page', weight: 5, roles: OPS, expect: 'html', path: () => '/vi/alerts' },
  { name: 'report', group: 'page', weight: 5, roles: OPS, expect: 'html', path: () => '/vi/report' },
  { name: 'api_export', group: 'api', weight: 3, roles: OPS, expect: 'xlsx', path: ({ month }) => `/api/export?month=${month}` },
  { name: 'api_health', group: 'api', weight: 7, roles: ALL, expect: 'json', path: () => '/api/health' },
];

export interface LoadOptions {
  vus: number;
  durationSec: number;
  rampSec: number;
  thinkMinMs: number;
  thinkMaxMs: number;
  timeoutMs: number;
  seed: number;
  xff: 'per-vu' | 'none';
  out: string | null;
  criteria: LoadCriteria;
}

/** Q1 = (c): 100 người dùng ảo, 5 phút. Mức 30/50 chạy bằng `--vus=`. */
export const DEFAULT_LOAD_VUS = 100;

function intFlag(flag: string, raw: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(n) || n < min || n > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `>= ${min}` : `trong ${min}..${max}`;
    throw new Error(`${flag} phai la so nguyen ${range}, nhan '${raw}'`);
  }
  return n;
}

export function parseLoadArgs(argv: readonly string[]): LoadOptions {
  const o: LoadOptions = {
    vus: DEFAULT_LOAD_VUS,
    durationSec: 300,
    rampSec: 30,
    thinkMinMs: 1000,
    thinkMaxMs: 3000,
    timeoutMs: 30000,
    seed: 1,
    xff: 'per-vu',
    out: null,
    criteria: { ...DEFAULT_LOAD_CRITERIA },
  };
  for (const arg of argv) {
    const eq = arg.indexOf('=');
    if (!arg.startsWith('--') || eq < 0) throw new Error(`co '${arg}' phai co dang --ten=gia-tri`);
    const flag = arg.slice(0, eq);
    const val = arg.slice(eq + 1);
    switch (flag) {
      case '--vus': o.vus = intFlag(flag, val, 1, 200); break;
      case '--duration': o.durationSec = intFlag(flag, val, 10); break;
      case '--ramp': o.rampSec = intFlag(flag, val, 0); break;
      case '--think-min': o.thinkMinMs = intFlag(flag, val, 0); break;
      case '--think-max': o.thinkMaxMs = intFlag(flag, val, 0); break;
      case '--timeout': o.timeoutMs = intFlag(flag, val, 1000); break;
      case '--seed': o.seed = intFlag(flag, val, 0); break;
      case '--xff':
        if (val !== 'per-vu' && val !== 'none') throw new Error(`--xff phai la per-vu hoac none, nhan '${val}'`);
        o.xff = val;
        break;
      case '--out':
        if (!val) throw new Error('--out khong duoc rong');
        o.out = val;
        break;
      case '--max-error-rate': {
        const n = Number(val);
        if (val.trim() === '' || !Number.isFinite(n) || n < 0 || n > 1) {
          throw new Error(`--max-error-rate phai la so thuc 0..1, nhan '${val}'`);
        }
        o.criteria.maxErrorRate = n;
        break;
      }
      case '--page-p95': o.criteria.pageP95Ms = intFlag(flag, val, 1); break;
      case '--page-p99': o.criteria.pageP99Ms = intFlag(flag, val, 1); break;
      case '--export-p95': o.criteria.exportP95Ms = intFlag(flag, val, 1); break;
      default: throw new Error(`co la '${flag}'`);
    }
  }
  if (o.rampSec > o.durationSec) throw new Error(`--ramp (${o.rampSec}) khong duoc lon hon --duration (${o.durationSec})`);
  if (o.thinkMinMs > o.thinkMaxMs) throw new Error(`--think-min (${o.thinkMinMs}) khong duoc lon hon --think-max (${o.thinkMaxMs})`);
  return o;
}

/** PRNG mulberry32 (32-bit), cùng seed cho cùng dãy, trả [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T extends { weight: number }>(items: readonly T[], r: number): T {
  if (!(r >= 0 && r < 1)) throw new RangeError(`pickWeighted: r phai nam trong [0, 1), nhan ${r}`);
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  if (items.length === 0 || total <= 0) throw new Error('pickWeighted: danh sach rong hoac tong trong so <= 0');
  let acc = 0;
  for (const it of items) {
    acc += it.weight;
    if (r * total < acc) return it;
  }
  return items[items.length - 1];
}

export function scenariosForRole(all: readonly Scenario[], role: LoadRole): Scenario[] {
  return all.filter((s) => s.roles.includes(role));
}

/** IP giả cho người dùng ảo thứ i (mỗi người một IP riêng, như sau reverse proxy thật). */
export function vuForwardedFor(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= 250 * 256) {
    throw new RangeError(`vuForwardedFor: index khong hop le ${index}`);
  }
  return `10.77.${Math.floor(index / 250)}.${(index % 250) + 1}`;
}

export function classifyResponse(status: number, contentType: string | null, expect: Expect): LoadErrorKind | null {
  if (status === 429) return 'rate_limited';
  if (status >= 300 && status <= 399) return 'redirect';
  if (status !== 200) return 'status';
  const needle = expect === 'html' ? 'text/html' : expect === 'xlsx' ? 'spreadsheetml' : 'application/json';
  return contentType !== null && contentType.includes(needle) ? null : 'status';
}

export interface LoadCredential { email: string; password: string }

const credentialsSchema = z.array(z.object({ email: z.string().trim().email(), password: z.string().min(1) })).min(1);

/** Lỗi không bao giờ chứa mật khẩu (chỉ nêu vị trí/loại lỗi). */
export function parseCredentials(json: string): LoadCredential[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('LOAD_CREDENTIALS_FILE sai dinh dang: khong phai JSON hop le');
  }
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues.map((i) => i.path.join('.') || '(goc)').join(', ');
    throw new Error(`LOAD_CREDENTIALS_FILE sai dinh dang: can mang [{email, password}], sai o ${where}`);
  }
  const seen = new Set<string>();
  return parsed.data.map((c) => {
    const email = c.email.trim().toLowerCase();
    if (seen.has(email)) throw new Error(`LOAD_CREDENTIALS_FILE sai dinh dang: email trung ${email}`);
    seen.add(email);
    return { email, password: c.password };
  });
}

/** Đường dẫn tuyệt đối đã giải symlink/junction nếu tồn tại; không tồn tại thì chỉ resolve. */
function realOrResolved(p: string): string {
  const abs = path.resolve(p);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/** Chặn file mật khẩu nằm trong repo (tránh commit nhầm). */
export function assertOutsideRepo(filePath: string, repoRoot: string): void {
  let root = realOrResolved(repoRoot);
  let file = realOrResolved(filePath);
  if (process.platform === 'win32') {
    root = root.toLowerCase();
    file = file.toLowerCase();
  }
  const rel = path.relative(root, file);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error('LOAD_CREDENTIALS_FILE nam trong repo - dat file o ngoai repo de khong lo commit mat khau');
  }
}

export function toLoadRole(role: string): LoadRole | null {
  return role === 'admin' || role === 'bod' || role === 'viewer' ? role : null;
}
