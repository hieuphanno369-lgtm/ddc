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
