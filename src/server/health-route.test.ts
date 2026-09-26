import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/health/route';

/**
 * P3D-B: /api/health khong kiem phien (theo thiet ke, dung de kiem tra song/chet) nhung phai
 * CHI tra trang thai, khong lo them field nao khac.
 */
describe('GET /api/health', () => {
  it('tra 200 va chi co status + time', async () => {
    const res = await GET(new NextRequest('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['status', 'time']);
    expect(body.status).toBe('ok');
  });
});
