import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REQUIRED_PROD_ENV } from '@/lib/env-check';

/**
 * P5-B Task 4/5 - kiem tra van ban cac file trien khai (Docker/compose/backup) khop bien bat buoc
 * va quy uoc xoay vong log (Q3), KHONG dung thu vien YAML - chi parse van ban don gian.
 */
const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

/** Danh sach service dang ky trong `services:` cua docker-compose.yml, theo dung thu tu file. */
function servicesSectionText(compose: string): string {
  const lines = compose.split('\n');
  const startIdx = lines.findIndex((l) => l === 'services:');
  if (startIdx === -1) throw new Error('khong tim thay dong "services:"');
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx + 1, endIdx).join('\n');
}

function serviceNames(compose: string): string[] {
  const names: string[] = [];
  for (const line of servicesSectionText(compose).split('\n')) {
    const m = line.match(/^ {2}([a-z][\w-]*):\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

function extractServiceBlock(compose: string, name: string): string {
  const lines = servicesSectionText(compose).split('\n');
  const startIdx = lines.findIndex((l) => new RegExp(`^ {2}${name}:\\s*$`).test(l));
  if (startIdx === -1) throw new Error(`khong tim thay service "${name}"`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^ {2}[a-z][\w-]*:\s*$/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

describe('next.config.mjs', () => {
  it('bat che do standalone cho Dockerfile', () => {
    expect(read('next.config.mjs')).toContain('standalone');
  });
});

describe('.env.example', () => {
  it('co dong cho moi bien REQUIRED_PROD_ENV', () => {
    const env = read('.env.example');
    for (const name of REQUIRED_PROD_ENV) {
      expect(env).toMatch(new RegExp(`^${name}=`, 'm'));
    }
  });
});

describe('docker-compose.yml', () => {
  const compose = read('docker-compose.yml');

  it('khong publish cong DB ra ngoai (khong co chuoi "5432:")', () => {
    expect(compose).not.toContain('5432:');
  });

  it('cong app chi bind vao 127.0.0.1', () => {
    expect(compose).toMatch(/-\s*"127\.0\.0\.1:/);
  });

  it('khoi service app co du bien REQUIRED_PROD_ENV', () => {
    const appBlock = extractServiceBlock(compose, 'app');
    for (const name of REQUIRED_PROD_ENV) {
      expect(appBlock).toContain(`${name}:`);
    }
  });

  it('co anchor x-logging xoay vong dung json-file 10m/14 file', () => {
    const idx = compose.indexOf('x-logging: &default-logging');
    expect(idx).toBeGreaterThanOrEqual(0);
    const rest = compose.slice(idx);
    const end = rest.indexOf('\n\n');
    const block = end === -1 ? rest : rest.slice(0, end);
    expect(block).toContain('driver: json-file');
    expect(block).toContain('max-size: "10m"');
    expect(block).toContain('max-file: "14"');
  });

  it('co it nhat 4 service (db, migrate, app, tools) va MOI service deu dung logging: *default-logging', () => {
    const names = serviceNames(compose);
    expect(names.length).toBeGreaterThanOrEqual(4);
    expect(names).toEqual(expect.arrayContaining(['db', 'migrate', 'app', 'tools']));
    for (const name of names) {
      expect(extractServiceBlock(compose, name)).toContain('logging: *default-logging');
    }
  });

  it('khong chua ky tu \\r (giu LF)', () => {
    expect(compose).not.toContain('\r');
  });
});

describe('Dockerfile', () => {
  it('khong chua ky tu \\r (giu LF)', () => {
    expect(read('Dockerfile')).not.toContain('\r');
  });
});
