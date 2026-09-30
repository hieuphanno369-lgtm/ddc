import { describe, expect, it } from 'vitest';
import { parseCspReports, readBodyCapped, sanitizeReportUrl } from './csp-report';

const ct = 'application/csp-report';
const LS = String.fromCharCode(0x2028);
const NEL = String.fromCharCode(0x85);
const RLO = String.fromCharCode(0x202e);


function reportUri(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    'csp-report': {
      'document-uri': 'http://localhost:3001/vi/login',
      'blocked-uri': 'inline',
      'effective-directive': 'script-src-elem',
      'violated-directive': 'script-src',
      disposition: 'report',
      'source-file': 'http://localhost:3001/_next/static/a.js?v=1',
      'line-number': 12,
      'column-number': 3,
      'script-sample': 'alert(1)',
      ...over,
    },
  });
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
}

describe('parseCspReports', () => {
  it('dang report-uri day du -> 1 violation dung truong', () => {
    expect(parseCspReports(ct, reportUri())).toEqual([{
      documentPath: '/vi/login', blocked: 'inline', directive: 'script-src-elem', disposition: 'report',
      source: 'http://localhost:3001/_next/static/a.js', line: 12, column: 3, sample: 'alert(1)',
    }]);
  });
  it('dang Reporting API: chi lay csp-violation', () => {
    const body = JSON.stringify([
      { type: 'csp-violation', body: { documentURL: 'http://x.test/vi/a', blockedURL: 'eval', effectiveDirective: 'script-src', disposition: 'report', lineNumber: 1, columnNumber: 2 } },
      { type: 'deprecation', body: {} },
    ]);
    const r = parseCspReports('application/reports+json', body);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ documentPath: '/vi/a', blocked: 'eval', directive: 'script-src', line: 1, column: 2, source: null, sample: null });
  });
  it('application/json chap nhan ca 2 dang', () => {
    expect(parseCspReports('application/json', reportUri())).toHaveLength(1);
    expect(parseCspReports('application/json', JSON.stringify([{ type: 'csp-violation', body: {} }]))).toHaveLength(1);
  });
  it('bo query va hash cua document-uri, khong lo token', () => {
    const r = parseCspReports(ct, reportUri({ 'document-uri': 'http://localhost:3001/vi/dat-lai-mat-khau?token=SECRET#x' }));
    expect(r[0].documentPath).toBe('/vi/dat-lai-mat-khau');
    expect(JSON.stringify(r)).not.toContain('SECRET');
  });
  it('blocked-uri: bo query, data -> data, inline giu', () => {
    expect(parseCspReports(ct, reportUri({ 'blocked-uri': 'https://evil.test/a.js?k=SECRET' }))[0].blocked).toBe('https://evil.test/a.js');
    expect(parseCspReports(ct, reportUri({ 'blocked-uri': 'data:image/png;base64,AAAA' }))[0].blocked).toBe('data');
    expect(parseCspReports(ct, reportUri({ 'blocked-uri': 'inline' }))[0].blocked).toBe('inline');
  });
  it('khong con ky tu xuong dong', () => {
    const r = parseCspReports(ct, reportUri({ 'effective-directive': 'a\r\nb', 'script-sample': 'x\ny', 'blocked-uri': 'q\r\nz' }));
    expect(JSON.stringify(r)).not.toMatch(/\\[rn]/);
    expect(r[0].directive).toBe('a  b');
  });
  it('script-sample cat 80 ky tu; line-number sai -> null', () => {
    expect(parseCspReports(ct, reportUri({ 'script-sample': 'a'.repeat(500) }))[0].sample).toHaveLength(80);
    for (const bad of [-1, '12', 1.5]) expect(parseCspReports(ct, reportUri({ 'line-number': bad }))[0].line).toBeNull();
  });
  it('disposition la -> unknown', () => {
    expect(parseCspReports(ct, reportUri({ disposition: 'x' }))[0].disposition).toBe('unknown');
  });
  it('50 phan tu -> dung 10', () => {
    const items = Array.from({ length: 50 }, () => ({ type: 'csp-violation', body: {} }));
    expect(parseCspReports('application/reports+json', JSON.stringify(items))).toHaveLength(10);
  });
  it.each(['{"a":', 'null', '42', '{}', '', '"x"'])('dau vao %j -> [] va khong nem', (text) => {
    expect(parseCspReports(ct, text)).toEqual([]);
  });
});

describe('sanitizeReportUrl', () => {
  it('tu khoa CSP giu nguyen, kieu la -> rong', () => {
    for (const k of ['inline', 'eval', 'wasm-eval', 'self', 'trusted-types-policy', '']) expect(sanitizeReportUrl(k)).toBe(k);
    expect(sanitizeReportUrl(42)).toBe('');
  });
  it('blob: -> blob, chuoi khac cat 200 ky tu', () => {
    expect(sanitizeReportUrl('blob:http://x/abc')).toBe('blob');
    expect(sanitizeReportUrl('a'.repeat(500))).toHaveLength(200);
  });
});

describe('readBodyCapped', () => {
  const enc = new TextEncoder();
  it('3 chunk duoi tran -> du chuoi', async () => {
    const r = await readBodyCapped(streamOf([enc.encode('ab'), enc.encode('cd'), enc.encode('ef')]), 100);
    expect(r).toBe('abcdef');
  });
  it('vuot tran -> null', async () => {
    expect(await readBodyCapped(streamOf([enc.encode('abcd'), enc.encode('efgh')]), 6)).toBeNull();
  });
  it('body null -> rong', async () => {
    expect(await readBodyCapped(null, 10)).toBe('');
  });
  it('UTF-8 tieng Viet bi cat giua chunk van giai ma dung', async () => {
    const bytes = enc.encode('Đường dẫn ạ');
    const r = await readBodyCapped(streamOf([bytes.slice(0, 1), bytes.slice(1, 8), bytes.slice(8)]), 1000);
    expect(r).toBe('Đường dẫn ạ');
  });
});

describe('stripControl qua parseCspReports (ky tu xuong dong Unicode va bidi)', () => {
  it('script-sample va blocked-uri chua U+2028, U+0085, U+202E -> khong con trong ket qua', () => {
    const dirty = `a${LS}b${NEL}c${RLO}d`;
    const out = JSON.stringify(parseCspReports(ct, reportUri({ 'script-sample': dirty, 'blocked-uri': dirty })));
    for (const ch of [LS, NEL, RLO]) expect(out.includes(ch)).toBe(false);
    expect(out).toContain('a b c d');
  });
});
