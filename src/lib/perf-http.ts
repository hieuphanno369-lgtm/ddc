/**
 * Cookie jar tối giản cho các script đo hiệu năng (`scripts/perf/*`): gom Set-Cookie qua nhiều
 * request, dựng lại header Cookie. Tách từ `measure-pages.ts` để dùng chung với load test.
 */

export type CookieJar = Map<string, string>;

/** Đọc mọi Set-Cookie, chỉ giữ name=value; value rỗng thì xoá cookie khỏi jar. */
export function mergeCookies(jar: CookieJar, headers: Headers): void {
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ?? '').split(/,(?=[^;]+?=)/);
  for (const line of raw) {
    const first = line.split(';')[0]?.trim();
    if (!first || !first.includes('=')) continue;
    const idx = first.indexOf('=');
    const name = first.slice(0, idx);
    const value = first.slice(idx + 1);
    if (value === '') jar.delete(name);
    else jar.set(name, value);
  }
}

export function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

export function hasSessionCookie(jar: CookieJar): boolean {
  return jar.has('next-auth.session-token') || jar.has('__Secure-next-auth.session-token');
}
