import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * P3D-B: middleware KHONG chay cho /api/* (matcher loai api) nen moi route phai tu chan.
 * So dang ky duoi day liet ke cach chan cua tung route; them route moi ma khong dang ky -> test do.
 */
const API_DIR = path.resolve(__dirname, '../../app/api');

type Guard = 'next-auth' | 'health' | 'cron-secret' | 'session';
const GUARDS: Record<string, Guard> = {
  'auth/[...nextauth]/route.ts': 'next-auth',
  'health/route.ts': 'health',
  'cron/[job]/route.ts': 'cron-secret',
  'export/route.ts': 'session',
  'report/export/route.ts': 'session',
  'templates/daily-resources/route.ts': 'session',
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name === 'route.ts' ? [full] : [];
  });
}
const rel = (f: string) => path.relative(API_DIR, f).split(path.sep).join('/');
const ROUTES = walk(API_DIR);

describe('route API deu co cach chan da dang ky', () => {
  it('moi route.ts deu nam trong so dang ky va nguoc lai', () => {
    expect(ROUTES.map(rel).sort()).toEqual(Object.keys(GUARDS).sort());
  });

  it.each(ROUTES.map((f) => [rel(f), f]))('%s dung cach chan da khai', (name, file) => {
    const src = readFileSync(file, 'utf8');
    const guard = GUARDS[name];
    if (guard === 'session') expect(src).toMatch(/getCurrentUser\(/);
    if (guard === 'cron-secret') {
      expect(src).toContain('CRON_SECRET');
      expect(src).toContain('timingSafeEqual');
    }
    if (guard === 'health') expect(src).not.toMatch(/@\/server\//);
  });
});
