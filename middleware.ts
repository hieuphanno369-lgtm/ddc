import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import { requireAuthSecret } from './src/lib/env';
import {
  applySecurityHeaders, buildCsp, generateNonce, securityHeaders, withCspRequestHeaders,
} from './src/lib/security-headers';
import type { Role } from './src/server/repo/types';

const intlMiddleware = createMiddleware(routing);

/** Route-level RBAC: role nào bị chặn khỏi đường dẫn nào. */
const DENIED: Record<Role, string[]> = {
  'data-entry': ['/overview', '/admin'],
  viewer: ['/nhap-lieu', '/admin', '/import', '/ho-so-du-an'],
  bod: ['/nhap-lieu', '/admin', '/import', '/ho-so-du-an'],
  admin: [],
};

/** Trang không cần đăng nhập, tính theo subpath sau /{locale}. */
const PUBLIC_PATHS = ['/login', '/quen-mat-khau', '/dat-lai-mat-khau'];

function isPublicPath(subpath: string): boolean {
  return PUBLIC_PATHS.some((p) => subpath === p || subpath.startsWith(p + '/'));
}

/**
 * Luật RBAC + đăng nhập. Nhận sẵn `intlResp` (đã dựng từ request mang CSP). Không gắn header bảo mật
 * ở đây: hàm `middleware` bọc ngoài gắn 1 lần cho MỌI response (kể cả redirect và lỗi 500).
 */
async function route(request: NextRequest, intlResp: Response): Promise<Response> {
  const pathname = request.nextUrl.pathname;
  const hasLocale = routing.locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (!hasLocale) return intlResp;

  const locale = pathname.split('/')[1];
  const subpath = '/' + pathname.split('/').slice(2).join('/');

  let secret: string;
  try {
    secret = requireAuthSecret();
  } catch {
    return new NextResponse('Server misconfigured: NEXTAUTH_SECRET', { status: 500 });
  }

  let hasSession = false;
  let role: Role = 'viewer';
  try {
    const token = await getToken({ req: request, secret });
    hasSession = token !== null && token.invalid !== true;
    if (hasSession) role = (token?.role as Role | undefined) ?? 'viewer';
  } catch {
    hasSession = false;
  }

  if (!hasSession) {
    if (isPublicPath(subpath)) return intlResp;
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  const denied = DENIED[role] ?? [];
  const isDenied = denied.some((p) => subpath === p || subpath.startsWith(p + '/'));
  if (isDenied) {
    const home = role === 'data-entry' ? '/nhap-lieu' : '/overview';
    return NextResponse.redirect(new URL(`/${locale}${home}`, request.url));
  }

  return intlResp;
}

/**
 * P5-B: gắn header bảo mật + CSP Report-Only (nonce mới mỗi request) lên MỌI response middleware trả ra.
 * Request đưa cho next-intl mang sẵn CSP + nonce để Next gắn nonce vào script; `getToken` vẫn dùng
 * request gốc. `/api`, `_next`, file tĩnh không qua middleware (xem matcher), header cho các đường này
 * do reverse proxy đặt (xem docs/csp-header-bao-mat.md).
 */
export default async function middleware(request: NextRequest) {
  const dev = process.env.NODE_ENV === 'development';
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, dev });
  const secHeaders = securityHeaders({ nonce, dev });
  const intlResp = intlMiddleware(withCspRequestHeaders(request, nonce, csp));
  return applySecurityHeaders(await route(request, intlResp), secHeaders);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
