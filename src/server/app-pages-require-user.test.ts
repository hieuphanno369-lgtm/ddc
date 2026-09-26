import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * P3D-B (S-1): moi page trong app/[locale]/(app) (va layout) phai goi requireUser la lenh await
 * dau tien (cho phep dung truoc no dung 1 lenh `await getLocale()`), truoc moi lenh doc du lieu.
 * Test nay chan page MOI quen chot dang nhap.
 */
const APP_DIR = path.resolve(__dirname, '../../app/[locale]/(app)');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

const rel = (f: string) => path.relative(APP_DIR, f).split(path.sep).join('/');
const PAGES = walk(APP_DIR);
const FILES = [...PAGES, path.join(APP_DIR, 'layout.tsx')];

const EXPECTED = [
  'overview/page.tsx', 'projects/page.tsx', 'projects/[id]/page.tsx', 'report/page.tsx', 'alerts/page.tsx',
  'compliance/page.tsx', 'audit/page.tsx', 'admin/page.tsx', 'import/page.tsx', 'data-dictionary/page.tsx',
  'data-schema/page.tsx', 'nhap-lieu/page.tsx', 'ho-so-du-an/page.tsx',
];

/** Ten ham duoc await theo thu tu xuat hien trong than ham export default. */
function awaitedCallees(src: string): string[] {
  const start = src.indexOf('export default async function');
  expect(start, 'phai co export default async function').toBeGreaterThanOrEqual(0);
  return [...src.slice(start).matchAll(/await\s+([A-Za-z_$][\w$.]*)\s*\(/g)].map((m) => m[1]);
}

describe('page (app) deu chot dang nhap bang requireUser', () => {
  it('quet ra du cac page da biet (walk khong rong)', () => {
    expect(PAGES.map(rel).sort()).toEqual(expect.arrayContaining(EXPECTED));
  });

  it.each(FILES.map((f) => [rel(f), f]))('%s goi requireUser truoc moi await khac', (_name, file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain("from '@/lib/require-user'");
    expect(src).not.toMatch(/getCurrentUser/);
    const calls = awaitedCallees(src);
    const ok = calls[0] === 'requireUser' || (calls[0] === 'getLocale' && calls[1] === 'requireUser');
    expect(ok, `thu tu await: ${calls.slice(0, 3).join(', ')}`).toBe(true);
  });
});
