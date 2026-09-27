import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/health/route';

/**
 * P3D-B: /api/health khong kiem phien (theo thiet ke, dung de kiem tra song/chet) nhung phai
 * CHI tra trang thai + thoi gian + co (khong lo IP that hay bat ky metadata mang nao khac).
 * R4 (bao-mat.md vong 2) - them `clientIpResolved` (boolean) de giam sat trien khai phat hien
 * thieu cau hinh reverse proxy (moi nguoi dung chung khoa 'unknown'), KHONG lo IP that ra ngoai.
 */
describe('GET /api/health', () => {
  it('tra 200, status/time/clientIpResolved, khong lo them field nao khac', async () => {
    const res = await GET(new NextRequest('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['clientIpResolved', 'status', 'time']);
    expect(body.status).toBe('ok');
  });

  it("R4: khong xac dinh duoc IP (khong header nao) -> clientIpResolved = false, KHONG lo chuoi 'unknown' hay IP that", async () => {
    const res = await GET(new NextRequest('http://localhost/api/health'));
    const body = await res.json();
    expect(body.clientIpResolved).toBe(false);
    expect(JSON.stringify(body)).not.toContain('unknown');
  });

  it("R4: co X-Forwarded-For -> clientIpResolved = true, khong lo gia tri IP that trong body", async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/health', { headers: { 'x-forwarded-for': '203.0.113.9' } }),
    );
    const body = await res.json();
    expect(body.clientIpResolved).toBe(true);
    expect(JSON.stringify(body)).not.toContain('203.0.113.9');
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
