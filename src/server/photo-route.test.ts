import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { UPLOAD_ROOT, savePhotoFile } from '@/lib/uploads';

/**
 * Mục 6 - route stream ảnh. Route nằm ở `app/api/...` (ngoài include `src/**\/*.test.ts`
 * của vitest) nên test được đặt tại đây và import ngược lên route.
 */
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { GET } from '../../app/api/photos/[...path]/route';

const PID = 990003;
const YM = '2026-09';
const png = (name = 'a.png') => new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });

const req = () => new NextRequest(`http://localhost/api/photos/x`);
const ctx = (segments: string[]) => ({ params: { path: segments } });
const login = (u: unknown) => (getCurrentUser as Mock).mockResolvedValue(u);
const USER = { name: 'Dev', email: 'dev@localhost', role: 'data-entry', canViewFinance: false };

afterAll(() => {
  rmSync(path.join(UPLOAD_ROOT, String(PID)), { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/photos/[...path] (Mục 6)', () => {
  it('chưa đăng nhập → 401 (middleware bỏ qua /api/* nên route tự chặn)', async () => {
    login(null);

    const res = await GET(req(), ctx([String(PID), YM, 'a.png']));

    expect(res.status).toBe(401);
  });

  it('đã đăng nhập + file tồn tại → 200, đúng content-type, cache private', async () => {
    const rel = await savePhotoFile(PID, YM, png('hien-truong.png'));
    login(USER);

    const res = await GET(req(), ctx(rel.split('/')));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(Buffer.from(await res.arrayBuffer()).length).toBe(4);
  });

  it('file không tồn tại / tháng khác → 404', async () => {
    login(USER);

    expect((await GET(req(), ctx([String(PID), YM, 'khong-co.png']))).status).toBe(404);
    expect((await GET(req(), ctx([String(PID), '2026-01', 'khong-co.png']))).status).toBe(404);
  });

  it('path rỗng → 404, không crash', async () => {
    login(USER);
    expect((await GET(req(), ctx([]))).status).toBe(404);
  });

  it('chặn path traversal "../" → 404, không đọc được file ngoài data/uploads', async () => {
    login(USER);

    const attacks = [
      ['..', '..', 'package.json'],
      [String(PID), '..', '..', 'package.json'],
      [String(PID), YM, '..', '..', '..', 'package.json'],
      ['..'],
    ];
    for (const segments of attacks) {
      const res = await GET(req(), ctx(segments));
      expect(res.status, `đường dẫn ${segments.join('/')} phải bị chặn`).toBe(404);
    }
  });
});
