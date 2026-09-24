import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import { requireAuthSecret } from './src/lib/env';
import type { Role } from './src/server/repo/types';

const intlMiddleware = createMiddleware(routing);

/** Route-level RBAC: role nào bị chặn khỏi đường dẫn nào. */
const DENIED: Record<Role, string[]> = {
  'data-entry': ['/overview', '/admin'],
  viewer: ['/nhap-lieu', '/admin', '/import'],
  bod: ['/nhap-lieu', '/admin', '/import'],
  admin: [],
};

export default async function middleware(request: NextRequest) {
  const intlResp = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const hasLocale = routing.locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (!hasLocale) return intlResp;

  let secret: string;
  try {
    secret = requireAuthSecret();
  } catch {
    return new NextResponse('Server misconfigured: NEXTAUTH_SECRET', { status: 500 });
  }

  let role: Role | null = null;
  try {
    const token = await getToken({ req: request, secret });
    role = (token?.role as Role) ?? null;
  } catch {
    role = null;
  }

  if (!role) return intlResp;

  const locale = pathname.split('/')[1];
  const subpath = '/' + pathname.split('/').slice(2).join('/');
  const denied = DENIED[role] ?? [];
  const isDenied = denied.some((p) => subpath === p || subpath.startsWith(p + '/'));
  if (isDenied) {
    const home = role === 'data-entry' ? '/nhap-lieu' : '/overview';
    return NextResponse.redirect(new URL(`/${locale}${home}`, request.url));
  }

  return intlResp;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
