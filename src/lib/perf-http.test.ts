import { describe, expect, it } from 'vitest';
import { cookieHeader, hasSessionCookie, mergeCookies, type CookieJar } from './perf-http';

function headersWith(...lines: string[]): Headers {
  const h = new Headers();
  for (const l of lines) h.append('set-cookie', l);
  return h;
}

describe('perf-http cookie jar', () => {
  it('gom 2 Set-Cookie, bo attribute, dung header Cookie', () => {
    const jar: CookieJar = new Map();
    mergeCookies(jar, headersWith('a=1; Path=/; HttpOnly', 'b=2; Max-Age=10'));
    expect(Object.fromEntries(jar)).toEqual({ a: '1', b: '2' });
    expect(cookieHeader(jar)).toBe('a=1; b=2');
  });
  it('cookie cung ten sau ghi de truoc', () => {
    const jar: CookieJar = new Map();
    mergeCookies(jar, headersWith('a=1'));
    mergeCookies(jar, headersWith('a=9'));
    expect(jar.get('a')).toBe('9');
  });
  it('gia tri rong xoa cookie', () => {
    const jar: CookieJar = new Map([['a', '1']]);
    mergeCookies(jar, headersWith('a=; Max-Age=0'));
    expect(jar.has('a')).toBe(false);
  });
  it('gia tri chua dau = duoc giu nguyen', () => {
    const jar: CookieJar = new Map();
    mergeCookies(jar, headersWith('t=x=y; Path=/'));
    expect(jar.get('t')).toBe('x=y');
  });
  it('hasSessionCookie nhan ca 2 ten, tu choi csrf', () => {
    expect(hasSessionCookie(new Map([['next-auth.session-token', 'x']]))).toBe(true);
    expect(hasSessionCookie(new Map([['__Secure-next-auth.session-token', 'x']]))).toBe(true);
    expect(hasSessionCookie(new Map([['next-auth.csrf-token', 'x']]))).toBe(false);
  });
});
