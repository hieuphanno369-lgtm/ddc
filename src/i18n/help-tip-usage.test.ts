import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** C-4: mọi chuỗi `helpTip.*` đã có trong vi.json phải được gắn vào một icon "?" (không để chuỗi mồ côi). */
const vi = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/messages/vi.json'), 'utf-8')) as { helpTip: Record<string, string> };

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [readFileSync(p, 'utf-8')] : [];
  });
}

describe('helpTip được dùng', () => {
  const code = [...sources(join(process.cwd(), 'app')), ...sources(join(process.cwd(), 'src/components'))].join('\n');
  it.each(Object.keys(vi.helpTip))('helpTip.%s có nơi dùng', (key) => {
    expect(new RegExp(`\\b${key}\\b`).test(code)).toBe(true);
  });
});
