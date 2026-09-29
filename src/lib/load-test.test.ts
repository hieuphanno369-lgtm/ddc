import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOAD_CRITERIA } from './load-stats';
import {
  assertOutsideRepo, classifyResponse, DEFAULT_SCENARIOS, mulberry32, parseCredentials, parseLoadArgs,
  pickWeighted, scenariosForRole, toLoadRole, vuForwardedFor,
} from './load-test';

describe('parseLoadArgs', () => {
  it('mac dinh theo Q1 = c: 100 VU, 5 phut, tieu chi 3000/5000/8000', () => {
    expect(parseLoadArgs([])).toEqual({
      vus: 100, durationSec: 300, rampSec: 30, thinkMinMs: 1000, thinkMaxMs: 3000, timeoutMs: 30000,
      seed: 1, xff: 'per-vu', out: null, criteria: DEFAULT_LOAD_CRITERIA,
    });
  });
  it('doc dung tung co hop le', () => {
    const o = parseLoadArgs([
      '--vus=30', '--duration=60', '--ramp=10', '--think-min=5', '--think-max=50', '--timeout=2000', '--seed=7',
      '--xff=none', '--out=x.json', '--max-error-rate=0.05', '--page-p95=1500', '--page-p99=3000', '--export-p95=5000',
    ]);
    expect(o).toMatchObject({
      vus: 30, durationSec: 60, rampSec: 10, thinkMinMs: 5, thinkMaxMs: 50, timeoutMs: 2000, seed: 7, xff: 'none', out: 'x.json',
      criteria: { maxErrorRate: 0.05, pageP95Ms: 1500, pageP99Ms: 3000, exportP95Ms: 5000 },
    });
  });
  it('khong lam hong DEFAULT_LOAD_CRITERIA khi ghi de', () => {
    parseLoadArgs(['--page-p95=1']);
    expect(parseLoadArgs([]).criteria.pageP95Ms).toBe(3000);
  });
  it.each([
    [['--vus=0']], [['--vus=201']], [['--vus=1.5']], [['--ramp=400', '--duration=300']], [['--think-min=5', '--think-max=1']],
    [['--xff=abc']], [['--max-error-rate=2']], [['--foo=1']], [['--vus']], [['--duration=5']], [['--timeout=10']],
  ])('ne loi voi %j', (args) => {
    expect(() => parseLoadArgs(args)).toThrow(Error);
  });
});

describe('mulberry32', () => {
  it('cung seed cho cung day, moi gia tri trong [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 3; i++) expect(a()).toBe(b());
    const c = mulberry32(2);
    for (let i = 0; i < 1000; i++) {
      const v = c();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('pickWeighted', () => {
  const items = [{ weight: 1, id: 1 }, { weight: 3, id: 2 }];
  it('chon theo tong cong don', () => {
    expect(pickWeighted(items, 0).id).toBe(1);
    expect(pickWeighted(items, 0.24).id).toBe(1);
    expect(pickWeighted(items, 0.25).id).toBe(2);
    expect(pickWeighted(items, 0.999).id).toBe(2);
  });
  it('rong ne loi; r=1 ne RangeError', () => {
    expect(() => pickWeighted([], 0.5)).toThrow(Error);
    expect(() => pickWeighted(items, 1)).toThrow(RangeError);
  });
});

describe('DEFAULT_SCENARIOS', () => {
  it('viewer chi co kich ban dung quyen, admin du 7, tong trong so 100, ten khong trung', () => {
    expect(scenariosForRole(DEFAULT_SCENARIOS, 'viewer').map((s) => s.name).sort()).toEqual(
      ['api_health', 'overview_all', 'overview_month'],
    );
    expect(scenariosForRole(DEFAULT_SCENARIOS, 'admin')).toHaveLength(7);
    expect(scenariosForRole(DEFAULT_SCENARIOS, 'bod')).toHaveLength(7);
    expect(DEFAULT_SCENARIOS.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(new Set(DEFAULT_SCENARIOS.map((s) => s.name)).size).toBe(DEFAULT_SCENARIOS.length);
  });
  it('dung path', () => {
    const ctx = { projectId: 18, month: '2026-09' };
    const p = Object.fromEntries(DEFAULT_SCENARIOS.map((s) => [s.name, s.path(ctx)]));
    expect(p.project_detail).toBe('/vi/projects/18');
    expect(p.overview_month).toBe('/vi/overview?month=2026-09');
    expect(p.overview_all).toBe('/vi/overview?month=all');
    expect(p.api_export).toBe('/api/export?month=2026-09');
    expect(p.api_health).toBe('/api/health');
  });
});

describe('vuForwardedFor', () => {
  it('map index sang IP', () => {
    expect(vuForwardedFor(0)).toBe('10.77.0.1');
    expect(vuForwardedFor(249)).toBe('10.77.0.250');
    expect(vuForwardedFor(250)).toBe('10.77.1.1');
  });
  it.each([-1, 1.5, 64000])('index %s ne RangeError', (i) => {
    expect(() => vuForwardedFor(i)).toThrow(RangeError);
  });
});

describe('classifyResponse', () => {
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  it('phan loai', () => {
    expect(classifyResponse(200, 'text/html; charset=utf-8', 'html')).toBeNull();
    expect(classifyResponse(307, null, 'html')).toBe('redirect');
    expect(classifyResponse(429, 'text/html', 'html')).toBe('rate_limited');
    expect(classifyResponse(500, 'text/html', 'html')).toBe('status');
    expect(classifyResponse(200, 'application/json', 'html')).toBe('status');
    expect(classifyResponse(200, null, 'json')).toBe('status');
    expect(classifyResponse(200, xlsx, 'xlsx')).toBeNull();
  });
});

describe('parseCredentials', () => {
  const secret = 'MatKhauBiMat123';
  it('hop le, chuan hoa email', () => {
    expect(parseCredentials('[{"email":" A@B.com ","password":"p"}]')).toEqual([{ email: 'a@b.com', password: 'p' }]);
  });
  it('JSON hong ne loi va khong lo mat khau', () => {
    expect(() => parseCredentials(`[{"email":"a@b.com","password":"${secret}"`)).toThrow(/LOAD_CREDENTIALS_FILE sai dinh dang/);
    try {
      parseCredentials(`[{"email":"a@b.com","password":"${secret}"`);
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });
  it('sai dang ne loi va khong lo mat khau', () => {
    const bad = `[{"email":"khong-phai-email","password":"${secret}"}]`;
    expect(() => parseCredentials(bad)).toThrow(/sai o/);
    try {
      parseCredentials(bad);
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });
  it('mang rong, email trung (khac hoa thuong) ne loi', () => {
    expect(() => parseCredentials('[]')).toThrow();
    expect(() => parseCredentials('[{"email":"a@b.com","password":"1"},{"email":"A@b.com","password":"2"}]')).toThrow(/trung/);
  });
});

describe('assertOutsideRepo', () => {
  const repo = path.resolve('/tmp/repo-x/app');
  it('file trong repo ne loi', () => {
    expect(() => assertOutsideRepo(path.join(repo, 'a', 'u.json'), repo)).toThrow(/nam trong repo/);
  });
  it('dung thu muc repo ne loi', () => {
    expect(() => assertOutsideRepo(repo, repo)).toThrow();
  });
  it('file o thu muc cha khong ne loi', () => {
    expect(() => assertOutsideRepo(path.resolve(repo, '..', 'u.json'), repo)).not.toThrow();
  });
  it('thu muc anh em co tien to giong khong bi nham la trong repo', () => {
    expect(() => assertOutsideRepo(`${repo}-khac${path.sep}u.json`, repo)).not.toThrow();
  });
  it.runIf(process.platform === 'win32')('win32: khac hoa thuong van ne loi', () => {
    expect(() => assertOutsideRepo(path.join(repo, 'U.JSON').toUpperCase(), repo)).toThrow();
  });
});

describe('toLoadRole', () => {
  it('map vai tro', () => {
    expect(toLoadRole('data-entry')).toBeNull();
    expect(toLoadRole('bod')).toBe('bod');
  });
});
