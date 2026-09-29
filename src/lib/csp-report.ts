/**
 * Đọc và lọc báo cáo vi phạm CSP (P5-B, chế độ Report-Only). Endpoint công khai nên MỌI đầu vào đều
 * bị coi là không tin cậy: body có trần, chỉ giữ các trường đã lọc, bỏ query string (trang đặt lại
 * mật khẩu có token trong URL), thay ký tự điều khiển để không chèn được dòng log giả.
 */

export const CSP_REPORT_MAX_BYTES = 16_384;
export const CSP_REPORT_MAX_ITEMS = 10;
export const CSP_REPORT_GLOBAL_PER_MIN = 60;
export const CSP_REPORT_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'application/csp-report',
  'application/reports+json',
  'application/json',
]);

export interface CspViolation {
  documentPath: string;
  blocked: string;
  directive: string;
  disposition: 'report' | 'enforce' | 'unknown';
  source: string | null;
  line: number | null;
  column: number | null;
  sample: string | null;
}

const MAX_URL_CHARS = 200;
const MAX_DIRECTIVE_CHARS = 100;
const MAX_SAMPLE_CHARS = 80;
const CSP_KEYWORDS = new Set(['inline', 'eval', 'wasm-eval', 'self', 'data', 'blob', 'trusted-types-policy', '']);

function stripControl(s: string): string {
  // Điều khiển C0/C1, LS/PS (U+2028/2029) và bidi (U+202A..202E, U+2066..2069): các ký tự này ngắt dòng hoặc đảo chiều hiển thị log.
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ');
}

/** Đọc body tối đa maxBytes; vượt thì huỷ stream và trả null; body null thì ''. */
export async function readBodyCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string | null> {
  if (body === null) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Bỏ query + hash; từ khoá CSP giữ nguyên; data:/blob: rút gọn; http(s) chỉ giữ origin + path. */
export function sanitizeReportUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const clean = stripControl(raw).trim();
  if (CSP_KEYWORDS.has(clean)) return clean;
  if (/^data:/i.test(clean)) return 'data';
  if (/^blob:/i.test(clean)) return 'blob';
  if (/^https?:/i.test(clean)) {
    try {
      const u = new URL(clean);
      return `${u.protocol}//${u.host}${u.pathname}`.slice(0, MAX_URL_CHARS);
    } catch {
      // roi xuong nhanh cat chuoi ben duoi
    }
  }
  return clean.split(/[?#]/)[0].slice(0, MAX_URL_CHARS);
}

function documentPathOf(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  try {
    return stripControl(new URL(raw).pathname).slice(0, MAX_URL_CHARS);
  } catch {
    return sanitizeReportUrl(raw).split(/[?#]/)[0].slice(0, MAX_URL_CHARS);
  }
}

function nonNegInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? stripControl(v).slice(0, max) : '';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function disposition(v: unknown): CspViolation['disposition'] {
  return v === 'report' || v === 'enforce' ? v : 'unknown';
}

function fromReportUri(r: Record<string, unknown>): CspViolation {
  return {
    documentPath: documentPathOf(r['document-uri']),
    blocked: sanitizeReportUrl(r['blocked-uri']),
    directive: str(r['effective-directive'] || r['violated-directive'], MAX_DIRECTIVE_CHARS),
    disposition: disposition(r['disposition']),
    source: r['source-file'] ? sanitizeReportUrl(r['source-file']) : null,
    line: nonNegInt(r['line-number']),
    column: nonNegInt(r['column-number']),
    sample: r['script-sample'] ? str(r['script-sample'], MAX_SAMPLE_CHARS) : null,
  };
}

function fromReportingApi(b: Record<string, unknown>): CspViolation {
  return {
    documentPath: documentPathOf(b['documentURL']),
    blocked: sanitizeReportUrl(b['blockedURL']),
    directive: str(b['effectiveDirective'] || b['violatedDirective'], MAX_DIRECTIVE_CHARS),
    disposition: disposition(b['disposition']),
    source: b['sourceFile'] ? sanitizeReportUrl(b['sourceFile']) : null,
    line: nonNegInt(b['lineNumber']),
    column: nonNegInt(b['columnNumber']),
    sample: b['sample'] ? str(b['sample'], MAX_SAMPLE_CHARS) : null,
  };
}

/** Không bao giờ ném. JSON hỏng hoặc sai dạng thì []. Tối đa CSP_REPORT_MAX_ITEMS phần tử. */
export function parseCspReports(contentType: string, text: string): CspViolation[] {
  void contentType; // hai dang duoc nhan ra tu noi dung, `application/json` chap nhan ca hai
  try {
    const data: unknown = JSON.parse(text);
    const out: CspViolation[] = [];
    if (Array.isArray(data)) {
      for (const item of data) {
        if (out.length >= CSP_REPORT_MAX_ITEMS) break;
        if (isRecord(item) && item['type'] === 'csp-violation' && isRecord(item['body'])) {
          out.push(fromReportingApi(item['body']));
        }
      }
    } else if (isRecord(data) && isRecord(data['csp-report'])) {
      out.push(fromReportUri(data['csp-report']));
    }
    return out;
  } catch {
    return [];
  }
}
