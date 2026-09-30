/**
 * Logger JSON co cau truc cho server (P5-B Task 1). KHONG import Node API - middleware edge co the
 * keo gian tiep file nay qua cac module khac. Moi lan goi in DUNG 1 doi so la 1 chuoi JSON 1 dong,
 * loc cac khoa nhay cam truoc khi in, khong bao gio throw (kip su tra ve doi so hong/vong tham chieu).
 */

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

const MAX_DEPTH = 3;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LEN = 500;

/** Tu khoa nhay cam - so khop theo TU trong ten khoa (sau khi tach camelCase/snake_case). */
const SENSITIVE_WORDS = new Set([
  'password', 'passwd', 'pass', 'pwd', 'secret', 'token', 'authorization', 'cookie', 'cookies',
  'session', 'email', 'mail', 'smtp', 'webhook', 'url', 'uri', 'ip', 'key', 'hash', 'otp', 'phone',
  'header', 'headers',
]);

function isSensitiveKey(key: string): boolean {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return words.some((w) => SENSITIVE_WORDS.has(w));
}

/**
 * Loi "vong tham chieu" phat hien duoc (cung mot object xuat hien lai trong chinh nhanh cha cua no)
 * duoc bao bang cach nem loi noi bo - `emit()` bat lai va in ban rut gon `logError:'unserializable'`.
 */
class CircularFieldError extends Error {}

function redactValue(v: unknown, depth: number, seen: Set<object>): unknown {
  if (depth > MAX_DEPTH) return '[depth]';
  if (typeof v === 'string') return v.length > MAX_STRING_LEN ? v.slice(0, MAX_STRING_LEN) : v;
  if (Array.isArray(v)) {
    if (seen.has(v)) throw new CircularFieldError();
    seen.add(v);
    try {
      return v.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1, seen));
    } finally {
      seen.delete(v);
    }
  }
  if (v !== null && typeof v === 'object') {
    if (seen.has(v)) throw new CircularFieldError();
    seen.add(v);
    try {
      const out: LogFields = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = isSensitiveKey(k) ? '[redacted]' : redactValue(val, depth + 1, seen);
      }
      return out;
    } finally {
      seen.delete(v);
    }
  }
  return v;
}

/** Loc cac khoa nhay cam thanh `'[redacted]'`, de quy toi da 3 cap, cat chuoi/mang qua kho. */
export function redact(fields: LogFields): LogFields {
  const seen = new Set<object>();
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = isSensitiveKey(k) ? '[redacted]' : redactValue(v, 1, seen);
  }
  return out;
}

function hasStringProp(e: object, prop: string): string | undefined {
  const v = (e as Record<string, unknown>)[prop];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Tom tat 1 loi de ghi log AN TOAN - KHONG BAO GIO dua `e.message` vao (co the chua du lieu nhay
 * cam: mat khau, chuoi ket noi DB...). Chi lay ten loi, ma loi (dang PRISMA/HTTP quen thuoc),
 * digest (Next.js) va cac dong `at ...` dau tien cua stack.
 */
export function errorFields(e: unknown): { errName: string; errCode?: string; errDigest?: string; errStack?: string[] } {
  const errName = e instanceof Error ? e.name : typeof e;
  const result: { errName: string; errCode?: string; errDigest?: string; errStack?: string[] } = { errName };
  if (e !== null && typeof e === 'object') {
    const code = hasStringProp(e, 'code');
    if (code && /^[A-Z0-9_]{1,20}$/.test(code)) result.errCode = code;
    const digest = hasStringProp(e, 'digest');
    if (digest) result.errDigest = digest;
  }
  if (e instanceof Error && typeof e.stack === 'string') {
    const lines = e.stack
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('at '))
      .slice(0, 8);
    if (lines.length > 0) result.errStack = lines;
  }
  return result;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): string {
  const ts = new Date().toISOString();
  try {
    const redacted = redact(fields);
    const merged: LogFields = { ts, level, event };
    for (const [k, v] of Object.entries(redacted)) {
      if (k === 'ts' || k === 'level' || k === 'event') continue;
      merged[k] = v;
    }
    return JSON.stringify(merged);
  } catch {
    return JSON.stringify({ ts, level, event, logError: 'unserializable' });
  }
}

export const logger = {
  info(event: string, fields?: LogFields): void {
    console.info(emit('info', event, fields));
  },
  warn(event: string, fields?: LogFields): void {
    console.warn(emit('warn', event, fields));
  },
  error(event: string, fields?: LogFields): void {
    console.error(emit('error', event, fields));
  },
};
