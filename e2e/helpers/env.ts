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

/**
 * L-5 (danh-gia-bao-mat.md): DATABASE_URL phải trỏ ĐÚNG host/port/tên DB của worktree B
 * (localhost:5433/ddc_control_tower_b) - không dùng `includes('/ddc_control_tower_b')` vì khớp
 * nhầm cả `ddc_control_tower_b2` (hoặc bất kỳ tên nào chứa chuỗi con này) và không kiểm host/port.
 */
export function isExpectedDbUrl(dbUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(dbUrl);
  } catch {
    return false;
  }
  return u.hostname === 'localhost' && u.port === '5433' && u.pathname === '/ddc_control_tower_b';
}
