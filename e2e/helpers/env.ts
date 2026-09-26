import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Đọc `.env` gốc repo (không dùng dotenv - tránh thêm dependency chỉ cho e2e). */
export function loadDotEnv(): Record<string, string> {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Thiếu key trong process.env (đã nạp .env qua loadDotEnv trước đó) → throw rõ ràng. */
export function need(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Thieu ${key} trong .env - xem .env.example`);
  return value;
}

/** Cặp DB + cổng dev đã đăng ký cho e2e. KHÔNG BAO GIỜ thêm 'ddc_control_tower' (DB của A, dữ liệu thật). */
export const E2E_TARGETS: ReadonlyArray<{ dbName: string; port: string }> = [
  { dbName: 'ddc_control_tower_b', port: '3001' },
  { dbName: 'ddc_control_tower_c', port: '3003' },
];

/** NEXTAUTH_URL phải đúng dạng http://localhost:<cổng> (pathname '/', không query/hash/user). Sai -> null. */
export function parseE2eBaseUrl(nextAuthUrl: string): { baseURL: string; port: string } | null {
  let u: URL;
  try {
    u = new URL(nextAuthUrl);
  } catch {
    return null;
  }
  if (
    u.protocol !== 'http:' ||
    u.hostname !== 'localhost' ||
    u.port === '' ||
    u.pathname !== '/' ||
    u.search !== '' ||
    u.hash !== '' ||
    u.username !== '' ||
    u.password !== ''
  ) {
    return null;
  }
  return { baseURL: `http://localhost:${u.port}`, port: u.port };
}

/**
 * L-5 (danh-gia-bao-mat.md): DATABASE_URL phải khớp CHÍNH XÁC host/port/tên DB của cặp đã đăng ký
 * có cổng trùng tham số `port` - không dùng `includes('/ddc_control_tower_b')` vì khớp nhầm cả
 * `ddc_control_tower_b2` (hoặc bất kỳ tên nào chứa chuỗi con này) và không kiểm host/port.
 */
export function isExpectedDbUrl(dbUrl: string, port: string): boolean {
  let u: URL;
  try {
    u = new URL(dbUrl);
  } catch {
    return false;
  }
  if (u.hostname !== 'localhost' || u.port !== '5433') return false;
  return E2E_TARGETS.some((t) => t.port === port && u.pathname === '/' + t.dbName);
}

/** Gộp 2 hàm trên. Hợp lệ -> trả target; sai -> throw Error (thông điệp KHÔNG chứa DATABASE_URL). */
export function resolveE2eTarget(env: Record<string, string | undefined>): {
  baseURL: string;
  port: string;
  databaseUrl: string;
} {
  const nextAuthUrl = env.NEXTAUTH_URL ?? '';
  const databaseUrl = env.DATABASE_URL ?? '';
  const parsed = parseE2eBaseUrl(nextAuthUrl);
  if (!parsed) {
    throw new Error('NEXTAUTH_URL phai co dang http://localhost:<cong> (vd http://localhost:3003) - sua .env');
  }
  if (!isExpectedDbUrl(databaseUrl, parsed.port)) {
    const pairs = E2E_TARGETS.map((t) => `${t.dbName} + ${t.port}`).join(', ');
    throw new Error(
      `DATABASE_URL + NEXTAUTH_URL khong khop cap da dang ky (${pairs}) - dung chay e2e (co the dinh DB cua A). Kiem tra .env.`,
    );
  }
  return { baseURL: parsed.baseURL, port: parsed.port, databaseUrl };
}
