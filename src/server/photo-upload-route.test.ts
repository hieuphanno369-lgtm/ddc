import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { UPLOAD_ROOT } from '@/lib/uploads';
import { repo } from '@/server/repo/mock-repo';

/**
 * Task 9 (P1A) - route POST /api/photo-upload dùng chung logic quyền/validate với
 * addPhotoAction (qua addPhotoForUser), thêm chặn CSRF theo Origin (mẫu photo-route.test.ts).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { POST } from '../../app/api/photo-upload/route';

const YM = '2026-09';
// Id khac voi actions.test.ts (1/4) de tranh dung file that tren dia khi 2 file test chay song song.
const PID_PIC = 7; // pm@daidung.com.vn là PIC
const PID_OTHER = 990099; // id gia, khong ai duoc gan
const ORIGIN = 'http://localhost:3000';

const dataEntry = (email: string) => ({ name: email, email, role: 'data-entry' as const, canViewFinance: false });
const ADMIN = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin' as const, canViewFinance: true };

const png = (name = 'hien-truong.png') => new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });
const pdf = (name = 'ho-so.pdf') => new File([Buffer.from('%PDF-1.4')], name, { type: 'application/pdf' });
// F1 (danh-gia.md): nội dung SVG thật, khai type image/svg+xml - phải bị chặn dù qua được zod (regex /^image\//).
const svg = (name = 'anh.svg') =>
  new File([Buffer.from('<svg onload="alert(1)"></svg>')], name, { type: 'image/svg+xml' });
// Nội dung HTML thật nhưng khai láo type=image/png - phải bị chặn bởi magic-byte, không phải chỉ dựa vào type.
const htmlDisguisedAsPng = (name = 'gia-mao.png') =>
  new File([Buffer.from('<script>alert(1)</script>')], name, { type: 'image/png' });

function login(user: unknown) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

function req(projectId: number, file: File | null, opts: { origin?: string | null; host?: string } = {}): NextRequest {
  const fd = new FormData();
  fd.set('projectId', String(projectId));
  fd.set('yearMonth', YM);
  fd.set('caption', '');
  if (file) fd.set('file', file);
  const headers: Record<string, string> = { host: opts.host ?? 'localhost:3000' };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  return new NextRequest('http://localhost:3000/api/photo-upload', { method: 'POST', headers, body: fd });
}

afterAll(() => {
  rmSync(path.join(UPLOAD_ROOT, String(PID_PIC)), { recursive: true, force: true });
  rmSync(path.join(UPLOAD_ROOT, String(PID_OTHER)), { recursive: true, force: true });
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('POST /api/photo-upload', () => {
  it('Origin khac host -> 403', async () => {
    login(ADMIN);

    const res = await POST(req(PID_PIC, png(), { origin: 'http://evil.com' }));

    expect(res.status).toBe(403);
  });

  it('chua dang nhap -> 401', async () => {
    login(null);

    const res = await POST(req(PID_PIC, png()));

    expect(res.status).toBe(401);
  });

  it('data-entry khong duoc gan -> 403', async () => {
    login(dataEntry('pm@daidung.com.vn'));

    const res = await POST(req(PID_OTHER, png()));

    expect(res.status).toBe(403);
  });

  it('PDF -> 400', async () => {
    login(ADMIN);

    const res = await POST(req(PID_PIC, pdf()));

    expect(res.status).toBe(400);
  });

  it('anh 0 byte -> 400 (server tu chan, khong chi dua vao precheck client)', async () => {
    login(ADMIN);
    const empty = new File([], 'rong.png', { type: 'image/png' });

    const res = await POST(req(PID_PIC, empty));

    expect(res.status).toBe(400);
  });

  it('anh vuot 5MB -> 400 (server tu chan)', async () => {
    login(ADMIN);
    const big = new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'to.png', { type: 'image/png' });

    const res = await POST(req(PID_PIC, big));

    expect(res.status).toBe(400);
  });

  it('PNG hop le cua PIC -> 200 va repo.getPhotos(PID) tang 1', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const before = repo.getPhotos(PID_PIC).length;

    const res = await POST(req(PID_PIC, png()));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: number };
    expect(body.ok).toBe(true);
    expect(repo.getPhotos(PID_PIC).length).toBe(before + 1);
  });

  it('F1 (danh-gia.md) - noi dung SVG that, type=image/svg+xml -> 400', async () => {
    login(ADMIN);

    const res = await POST(req(PID_PIC, svg()));

    expect(res.status).toBe(400);
  });

  it('F1 (danh-gia.md) - noi dung PNG that ten x.svg -> 200, url luu ket thuc .png', async () => {
    login(ADMIN);

    const res = await POST(req(PID_PIC, png('x.svg')));

    expect(res.status).toBe(200);
    const photo = repo.getPhotos(PID_PIC).at(-1);
    expect(photo?.url.endsWith('.png')).toBe(true);
  });

  it('F1 (danh-gia.md) - noi dung HTML gia mao type=image/png -> 400', async () => {
    login(ADMIN);

    const res = await POST(req(PID_PIC, htmlDisguisedAsPng()));

    expect(res.status).toBe(400);
  });
});
