import { describe, expect, it } from 'vitest';
import {
  assertPerfConfirm, assertPerfDb, assertPerfHost, assertPerfLocalBase, estimateRows,
  isLoopbackDatabaseUrl, parsePerfArgs, PERF_DB,
} from './perf-guard';

const TODAY = '2026-09-24';
const LOCAL_URL = `postgresql://postgres:x@localhost:5433/${PERF_DB}?schema=public`;
const REMOTE_URL = `postgresql://postgres:x@10.0.0.5:5432/${PERF_DB}?schema=public`;

describe('assertPerfDb', () => {
  it("'ddc_control_tower' (DB cua A) -> nem loi", () => {
    expect(() => assertPerfDb('ddc_control_tower')).toThrow();
  });

  it(`'${PERF_DB}' (DB cua B) -> khong nem`, () => {
    expect(() => assertPerfDb(PERF_DB)).not.toThrow();
  });

  it("'' (rong) -> nem loi", () => {
    expect(() => assertPerfDb('')).toThrow();
  });
});

describe('isLoopbackDatabaseUrl', () => {
  it('localhost -> true', () => {
    expect(isLoopbackDatabaseUrl(LOCAL_URL)).toBe(true);
  });

  it('127.0.0.1 -> true', () => {
    expect(isLoopbackDatabaseUrl(`postgresql://postgres:x@127.0.0.1:5433/${PERF_DB}`)).toBe(true);
  });

  it('IP xa -> false', () => {
    expect(isLoopbackDatabaseUrl(REMOTE_URL)).toBe(false);
  });

  it('URL khong hop le -> false (khong nem)', () => {
    expect(isLoopbackDatabaseUrl('khong-phai-url')).toBe(false);
  });
});

describe('assertPerfHost', () => {
  it('inet_server_addr = 127.0.0.1 -> khong nem', () => {
    expect(() => assertPerfHost('127.0.0.1', REMOTE_URL)).not.toThrow();
  });

  it('inet_server_addr = null (unix socket) -> khong nem', () => {
    expect(() => assertPerfHost(null, REMOTE_URL)).not.toThrow();
  });

  it('inet_server_addr xa nhung DATABASE_URL localhost -> khong nem (vi du ket noi qua tunnel)', () => {
    expect(() => assertPerfHost('10.0.0.5', LOCAL_URL)).not.toThrow();
  });

  it('inet_server_addr xa va DATABASE_URL xa -> nem loi', () => {
    expect(() => assertPerfHost('10.0.0.5', REMOTE_URL)).toThrow();
  });
});

describe('assertPerfConfirm', () => {
  it(`PERF_CONFIRM='${PERF_DB}' -> khong nem`, () => {
    expect(() => assertPerfConfirm(PERF_DB)).not.toThrow();
  });

  it('PERF_CONFIRM sai -> nem loi', () => {
    expect(() => assertPerfConfirm('sai-ten-db')).toThrow();
  });

  it('PERF_CONFIRM thieu (undefined) -> nem loi', () => {
    expect(() => assertPerfConfirm(undefined)).toThrow();
  });
});

describe('assertPerfLocalBase', () => {
  it('http://localhost:3001 -> khong nem', () => {
    expect(() => assertPerfLocalBase('http://localhost:3001', false)).not.toThrow();
  });

  it('http://127.0.0.1:3001 -> khong nem', () => {
    expect(() => assertPerfLocalBase('http://127.0.0.1:3001', false)).not.toThrow();
  });

  it('host xa, allowRemote=false -> nem loi', () => {
    expect(() => assertPerfLocalBase('http://example.com', false)).toThrow();
  });

  it('host xa, allowRemote=true -> khong nem', () => {
    expect(() => assertPerfLocalBase('http://example.com', true)).not.toThrow();
  });

  it('URL khong hop le -> nem loi', () => {
    expect(() => assertPerfLocalBase('khong-phai-url', false)).toThrow();
  });
});

describe('parsePerfArgs', () => {
  it('khong co argv -> mac dinh dung', () => {
    const o = parsePerfArgs([], TODAY);
    expect(o).toEqual({ projects: 500, days: 730, audit: 1_000_000, activity: 100_000, end: TODAY, clean: false });
  });

  it('doc dung tung flag', () => {
    const o = parsePerfArgs(['--projects=10', '--days=30', '--audit=5', '--activity=2', '--end=2026-01-01'], TODAY);
    expect(o).toEqual({ projects: 10, days: 30, audit: 5, activity: 2, end: '2026-01-01', clean: false });
  });

  it('--clean-only -> clean = true', () => {
    expect(parsePerfArgs(['--clean-only'], TODAY).clean).toBe(true);
  });

  it('--projects=0 -> nem loi', () => {
    expect(() => parsePerfArgs(['--projects=0'], TODAY)).toThrow();
  });

  it('--days=abc -> nem loi', () => {
    expect(() => parsePerfArgs(['--days=abc'], TODAY)).toThrow();
  });

  it('--end=2026-13-01 (thang khong hop le) -> nem loi', () => {
    expect(() => parsePerfArgs(['--end=2026-13-01'], TODAY)).toThrow();
  });
});

describe('estimateRows', () => {
  it('mac dinh (500 du an, 730 ngay, 6 nha thau, 2 ca, 2 thiet bi, 7 giai doan) >= 10.000.000', () => {
    const o = parsePerfArgs([], TODAY);
    const n = estimateRows(o, 6, 2, 2, 7);
    expect(n).toBeGreaterThanOrEqual(10_000_000);
  });
});
