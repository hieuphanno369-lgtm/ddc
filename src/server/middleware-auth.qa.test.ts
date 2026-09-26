import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * P3D-B (S-1) - kiem thu doc lap cua Tester, KHONG sua middleware-auth.test.ts cua coder.
 * Tap trung vao cac truong hop bien duoc chu du an neu ten: token invalid, token thieu role
 * (phai thanh viewer, khong vong lap redirect login <-> overview), duong dan khong co locale,
 * duong dan khong ton tai khi chua dang nhap, /vi/login khong bi redirect vong, nguoi da dang
 * nhap vao /vi/login giu hanh vi hien hanh, RBAC DENIED giu nguyen.
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

describe('QA doc lap - duong chay thuan loi', () => {
  it('admin da dang nhap vao /vi/overview -> cho qua binh thuong', async () => {
    getTokenMock.mockResolvedValue({ email: 'a@daidung.com.vn', role: 'admin' });
    expect(passedThrough(await hit('/vi/overview'))).toBe(true);
  });

  it('chua dang nhap vao /vi/overview -> ve /vi/login', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/login');
  });
});

describe('QA doc lap - bien: token invalid (tai khoan bi khoa)', () => {
  it('token.invalid = true vao /vi/projects/1 -> ve /vi/login', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn', role: 'admin', invalid: true });
    expect(redirectedTo(await hit('/vi/projects/1'))).toBe('/vi/login');
  });

  it('token.invalid = true khong tao vong lap: vao /vi/login van cho qua (khong redirect ve login lan nua)', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn', role: 'admin', invalid: true });
    const res = await hit('/vi/login');
    expect(passedThrough(res)).toBe(true);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('QA doc lap - bien: token thieu role -> phai thanh vien vai viewer', () => {
  it('token thieu role vao /vi/overview -> cho qua (khong bi coi la chua dang nhap)', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn' });
    expect(passedThrough(await hit('/vi/overview'))).toBe(true);
  });

  it('token thieu role vao duong bi cam cua viewer (/vi/import) -> ve /vi/overview, khong phai /vi/login', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn' });
    expect(redirectedTo(await hit('/vi/import'))).toBe('/vi/overview');
  });

  it('token thieu role khong tao vong lap login <-> overview: vao /vi/login van cho qua', async () => {
    getTokenMock.mockResolvedValue({ email: 'x@daidung.com.vn' });
    const res = await hit('/vi/login');
    expect(passedThrough(res)).toBe(true);
    // Neu co loi coi thieu role la chua dang nhap thi ham se redirect ve chinh /vi/login -> vong lap.
    expect(redirectedTo(res)).toBeNull();
  });
});

describe('QA doc lap - bien: duong dan khong co locale', () => {
  it('/projects (khong locale) -> giao cho next-intl xu ly, khong tu redirect login', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/projects'))).toBe(true);
    expect(getTokenMock).not.toHaveBeenCalled();
  });

  it('/ (goc, khong locale) -> giao cho next-intl', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(passedThrough(await hit('/'))).toBe(true);
  });
});

describe('QA doc lap - bien: duong dan khong ton tai khi chua dang nhap', () => {
  it('/vi/duong-dan-la-lung-khong-co-that -> ve /vi/login (khong lo danh sach trang that)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/vi/duong-dan-la-lung-khong-co-that'))).toBe('/vi/login');
  });

  it('/en/duong-dan-khong-ton-tai -> ve /en/login (dung locale)', async () => {
    getTokenMock.mockResolvedValue(null);
    expect(redirectedTo(await hit('/en/duong-dan-khong-ton-tai'))).toBe('/en/login');
  });
});

describe('QA doc lap - bien: /vi/login khong bi redirect vong voi nguoi da dang nhap (moi vai)', () => {
  it.each(['admin', 'bod', 'viewer', 'data-entry'] as const)(
    'vai %s da dang nhap vao /vi/login -> cho qua, khong redirect vong',
    async (role) => {
      getTokenMock.mockResolvedValue({ email: `${role}@daidung.com.vn`, role });
      const res = await hit('/vi/login');
      expect(passedThrough(res)).toBe(true);
      expect(res.headers.get('location')).toBeNull();
    },
  );
});

describe('QA doc lap - RBAC DENIED giu nguyen (khong doi hanh vi nguoi da dang nhap)', () => {
  it('viewer vao /vi/admin -> bi tu choi, ve /vi/overview', async () => {
    getTokenMock.mockResolvedValue({ email: 'v@daidung.com.vn', role: 'viewer' });
    expect(redirectedTo(await hit('/vi/admin'))).toBe('/vi/overview');
  });

  it('data-entry vao /vi/overview -> bi tu choi, ve /vi/nhap-lieu', async () => {
    getTokenMock.mockResolvedValue({ email: 'pm@daidung.com.vn', role: 'data-entry' });
    expect(redirectedTo(await hit('/vi/overview'))).toBe('/vi/nhap-lieu');
  });
});

describe('QA doc lap - truong hop phai that bai (bi tu choi dung nhu ky vong)', () => {
  it('chua dang nhap khong the doc /vi/projects/1: phai bi day ve login, KHONG duoc tra ve trang du an (that bai neu middleware cho qua)', async () => {
    getTokenMock.mockResolvedValue(null);
    const res = await hit('/vi/projects/1');
    // Day la ca "phai that bai": neu middleware co lo hong S-1, res se la passedThrough (200) thay vi redirect.
    expect(passedThrough(res)).toBe(false);
    expect(redirectedTo(res)).toBe('/vi/login');
  });

  it('viewer khong the vao /vi/ho-so-du-an: phai bi tu choi ve /vi/overview, KHONG duoc cho qua', async () => {
    getTokenMock.mockResolvedValue({ email: 'v@daidung.com.vn', role: 'viewer' });
    const res = await hit('/vi/ho-so-du-an');
    expect(passedThrough(res)).toBe(false);
    expect(redirectedTo(res)).toBe('/vi/overview');
  });
});
