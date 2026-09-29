import { NextRequest } from 'next/server';

/**
 * BẢN NHÁP Report-Only (P5-B): header bảo mật + Content-Security-Policy CHƯA chặn gì, chỉ báo cáo
 * vi phạm về `/api/csp-report`. Tài liệu: `docs/csp-header-bao-mat.md`.
 *
 * Các quyết định (xem ke-hoach P5-B):
 * - Nonce mới cho mỗi request + `'strict-dynamic'`: Next đọc nonce từ header request
 *   `content-security-policy(-report-only)` và gắn vào mọi thẻ script của nó. Hệ quả: layout gốc đọc
 *   `headers()` nên mọi trang render động.
 * - `style-src 'self' 'unsafe-inline'`, KHÔNG gắn nonce: app dùng thuộc tính `style={...}` khắp nơi
 *   (Recharts cũng vậy); có nonce thì trình duyệt bỏ qua `'unsafe-inline'` và báo vi phạm mọi thuộc tính.
 * - Report-Only KHÔNG chứa `frame-ancestors` và `upgrade-insecure-requests` (bị trình duyệt bỏ qua và
 *   in cảnh báo mỗi trang). Chống nhúng khung dùng `X-Frame-Options: DENY` (Q2 = a); hai chỉ thị này
 *   thêm vào bản cuối (enforce).
 * - Bốn header còn lại (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy) áp thật ngay.
 * - HSTS và nosniff cho `/api`, `_next` đặt ở reverse proxy, không đặt ở Next.
 *
 * Xem lại khi P4-X (xuất PDF/JPG) vào `main`: thư viện chụp ảnh có dùng eval/new Function không,
 * ảnh blob:/data:, worker, font, iframe tạm, tải file bằng blob: (chi tiết ở mục 6 của tài liệu).
 */

export const CSP_REPORT_PATH = '/api/csp-report';
export const CSP_REPORT_GROUP = 'csp-endpoint';
export const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';
export const NONCE_HEADER = 'x-nonce';

const NONCE_PATTERN = /^[A-Za-z0-9+/]{22}==$/;

/** 16 byte ngẫu nhiên (chạy được ở edge runtime), mã base64: 24 ký tự. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Ném Error nếu nonce sai dạng (không bao giờ ghép chuỗi lạ vào header). */
export function buildCsp(opts: { nonce: string; dev: boolean }): string {
  if (!NONCE_PATTERN.test(opts.nonce)) throw new Error('buildCsp: nonce sai dang');
  const scriptSrc = `script-src 'self' 'nonce-${opts.nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ''}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join('; ');
}

/** Bộ header gắn trên MỌI response của middleware. */
export function securityHeaders(opts: { nonce: string; dev: boolean }): Record<string, string> {
  return {
    [CSP_HEADER_NAME]: buildCsp(opts),
    'Reporting-Endpoints': `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}

/** Gán từng header (ghi đè nếu đã có) rồi trả lại chính response đó. */
export function applySecurityHeaders<T extends Response>(res: T, headers: Record<string, string>): T {
  for (const [name, value] of Object.entries(headers)) res.headers.set(name, value);
  return res;
}

/**
 * Request mới (GET, cùng URL, KHÔNG mang body) có thêm `content-security-policy-report-only` và
 * `x-nonce`, ghi đè giá trị client tự gửi. Chỉ dùng làm đầu vào cho next-intl middleware (nó sao
 * chép request.headers vào rewrite). KHÔNG dùng `new NextRequest(request, ...)`: sẽ chiếm body của
 * request gốc, hỏng server action POST.
 */
export function withCspRequestHeaders(request: NextRequest, nonce: string, csp: string): NextRequest {
  const h = new Headers(request.headers);
  // Next ưu tiên tên enforce khi đọc nonce từ request, nên phải xoá bản client gửi kèm.
  // Khi chuyển sang enforce: set tên enforce và xoá tên `-report-only`.
  h.delete('content-security-policy');
  h.set('content-security-policy-report-only', csp);
  h.set(NONCE_HEADER, nonce);
  return new NextRequest(request.url, { headers: h });
}
