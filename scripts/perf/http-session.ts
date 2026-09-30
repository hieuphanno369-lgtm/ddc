/**
 * Dang nhap next-auth (credentials) bang fetch, dung chung cho measure-pages.ts va load-test.ts.
 * Luong: GET /api/auth/csrf -> POST /api/auth/callback/credentials. Khong in mat khau, khong thu lai.
 */
import { cookieHeader, hasSessionCookie, mergeCookies, type CookieJar } from '@/lib/perf-http';

export async function login(opts: {
  base: string;
  email: string;
  password: string;
  headers?: Record<string, string>;
  tag: string;
}): Promise<CookieJar> {
  const { base, email, password, tag } = opts;
  const extra = opts.headers ?? {};
  const jar: CookieJar = new Map();

  const csrfRes = await fetch(`${base}/api/auth/csrf`, { headers: extra });
  mergeCookies(jar, csrfRes.headers);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken, email, password, callbackUrl: `${base}/vi/overview`, json: 'true',
  });
  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { ...extra, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(jar) },
    body: body.toString(),
    redirect: 'manual',
  });
  mergeCookies(jar, loginRes.headers);
  if (!hasSessionCookie(jar)) {
    throw new Error(`${tag} Dang nhap that bai (status ${loginRes.status}) cho ${email}`);
  }
  return jar;
}
