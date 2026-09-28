import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * P3D-B (S-1): middleware phai redirect /{locale}/login khi khong co phien hop le,
 * tru route public. RBAC DENIED cho nguoi da dang nhap giu nguyen.
 */
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: getTokenMock }));
vi.mock('next-intl/middleware', () => ({
  default: () => () => {
    const r = NextResponse.next();
    r.headers.set('x-test-intl', '1');
    return r;
  },
}));

import middleware from '../../middleware';

async function hit(path: string, headers: Record<string, string> = {}) {
  return middleware(new NextRequest(`http://localhost${path}`, { headers }));
}
function redirectedTo(res: Response): string | null {
  const l = res.headers.get('location');
  return l ? new URL(l).pathname : null;
}
function passedThrough(res: Response): boolean {
  return res.headers.get('x-test-intl') === '1' && !res.headers.get('location');
}

afterEach(() => getTokenMock.mockReset());

describe('middleware - khong co phien', () => {
  it.each(['/vi/overview', '/vi/projects', '/vi/projects/1', '/vi/import', '/vi/nhap-lieu', '/vi/admin', '/vi', '/vi/', '/vi/khong-ton-tai', '/vi/loginx'])(
    'khong token %s -> /vi/login',
    async (p) => {
      getTokenMock.mockResolvedValue(null);
      const res = await hit(p);
      expect(res.status).toBe(307);
      expect(redirectedTo(res)).toBe('/vi/login');
    },
  );

  it('khong token /en/projects/1 -> /en/login', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/en/projects/1'))).toBe('/en/login');
  });

  it('khong token + header RSC: 1 -> van redirect /vi/login', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/vi/overview', { RSC: '1' }))).toBe('/vi/login');
  });

  it('khong token /vi/login -> cho qua (next-intl)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/vi/login'))).toBe(true);
  });

  it('khong token /vi/quen-mat-khau -> cho qua (Task 7, trang public moi)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/vi/quen-mat-khau'))).toBe(true);
  });

  it('khong token /en/dat-lai-mat-khau?token=x -> cho qua (Task 7, trang public moi, co query token)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/en/dat-lai-mat-khau?token=x'))).toBe(true);
  });

  it('khong token /vi/quen-mat-khau-gia -> van bi redirect (so khop dung duong dan, khong phai tien to)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/vi/quen-mat-khau-gia'))).toBe('/vi/login');
  });

  it('getToken nem loi -> coi nhu khong phien -> /vi/login', async () => {
    getTokenMock.mockRejectedValue(new Error('bad jwt'));
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/login');
  });

  it('token.invalid = true (tai khoan bi khoa) -> /vi/login', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn', role: 'admin', invalid: true });
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/login');
  });

  it('token.invalid = true vao /vi/login -> cho qua (khong vong lap)', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn', role: 'admin', invalid: true });
    expect(passedThrough(await hit('/vi/login'))).toBe(true);
  });

  it('duong dan khong locale /overview -> de next-intl xu ly', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/overview'))).toBe(true);
  });
});

describe('middleware - da dang nhap (RBAC giu nguyen)', () => {
  it('admin /vi/admin -> cho qua', async () => {
    getTokenMock.mockResolvedValue({ email: 'a@daidung.com.vn', role: 'admin' });
    expect(passedThrough(await hit('/vi/admin'))).toBe(true);
  });

  it('data-entry /vi/overview -> /vi/nhap-lieu', async () => {
    getTokenMock.mockResolvedValue({ email: 'pm@daidung.com.vn', role: 'data-entry' });
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/nhap-lieu');
  });

  it('viewer /vi/import -> /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'v@daidung.com.vn', role: 'viewer' });
    expect(redirectedTo(await hit('/vi/import'))).toBe('/vi/overview');
  });

  it('bod /vi/ho-so-du-an -> /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'b@daidung.com.vn', role: 'bod' });
    expect(redirectedTo(await hit('/vi/ho-so-du-an'))).toBe('/vi/overview');
  });

  it('token thieu role -> coi la viewer: /vi/overview cho qua, /vi/admin -> /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn' });
    expect(passedThrough(await hit('/vi/overview'))).toBe(true);
    expect(redirectedTo(await hit('/vi/admin'))).toBe('/vi/overview');
  });

  it('da dang nhap vao /vi/login -> cho qua (trang login tu day ve trang chu)', async () => {
    getTokenMock.mockResolvedValue({ email: 'a@daidung.com.vn', role: 'admin' });
    expect(passedThrough(await hit('/vi/login'))).toBe(true);
  });
});
