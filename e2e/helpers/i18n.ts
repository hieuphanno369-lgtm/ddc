import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const viMessages: Record<string, unknown> = JSON.parse(
  readFileSync(join(process.cwd(), 'src/i18n/messages/vi.json'), 'utf8'),
);
const enMessages: Record<string, unknown> = JSON.parse(
  readFileSync(join(process.cwd(), 'src/i18n/messages/en.json'), 'utf8'),
);

function lookup(messages: Record<string, unknown>, key: string, vars?: Record<string, string | number>): string {
  const parts = key.split('.');
  let cur: unknown = messages;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) throw new Error(`Khong tim thay key i18n: ${key}`);
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== 'string') throw new Error(`Khong tim thay key i18n: ${key}`);
  let out = cur;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** Đọc 1 chuỗi tiếng Việt từ `src/i18n/messages/vi.json` bằng key dạng "group.key" - dùng cho
 * selector text trong spec e2e, KHÔNG gõ cứng chữ tiếng Việt (tránh lệch khi đổi bản dịch). */
export function vi(key: string, vars?: Record<string, string | number>): string {
  return lookup(viMessages, key, vars);
}

/** Như vi() nhưng đọc src/i18n/messages/en.json. */
export function en(key: string, vars?: Record<string, string | number>): string {
  return lookup(enMessages, key, vars);
}
