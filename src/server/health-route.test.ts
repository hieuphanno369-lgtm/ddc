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

/**
 * L2 (bao-mat.md) - trước đây IP dùng để giới hạn lấy PHẦN TỬ ĐẦU của `x-forwarded-for` (client tự
 * gửi được), nên chỉ cần đổi phần tử đầu mỗi lần gọi là né được giới hạn vô hạn. Nay khoá theo
 * `TRUSTED_PROXY_HOPS` tính từ phải (mặc định 1 = phần tử CUỐI, do proxy tin cậy ghi) nên đổi phần
 * tử đầu không còn tác dụng.
 */
describe('GET /api/health - IP dung de gioi han khong con ne duoc bang cach doi phan tu dau XFF (L2)', () => {
  it('doi phan tu dau moi lan goi, giu nguyen phan tu cuoi -> van bi chan sau du gioi han', async () => {
    const REAL_IP = '203.0.113.77';
    const reqWith = (fakeFirst: string) =>
      new NextRequest('http://localhost/api/health', { headers: { 'x-forwarded-for': `${fakeFirst}, ${REAL_IP}` } });

    for (let i = 0; i < 120; i++) {
      const res = await GET(reqWith(`10.0.0.${i}`));
      expect(res.status).toBe(200);
    }
    const over = await GET(reqWith('10.0.0.999'));
    expect(over.status).toBe(429);
  });
});
