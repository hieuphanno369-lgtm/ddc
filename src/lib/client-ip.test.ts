import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIpFrom } from './client-ip';

/** L2 - lấy IP theo `TRUSTED_PROXY_HOPS` tính từ phải của `x-forwarded-for`, rồi `x-real-ip`, cắt 64 ký tự. */
function headersOf(map: Record<string, string>): Pick<Headers, 'get'> {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('clientIpFrom', () => {
  it('mac dinh (TRUSTED_PROXY_HOPS khong dat): lay PHAN TU CUOI cua x-forwarded-for, khong phai dau', () => {
    // L2: phan tu dau la gia tri client tu gui, khong dang tin; phan tu cuoi la do proxy tin cay ghi.
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('10.0.0.1');
  });

  it('TRUSTED_PROXY_HOPS=2: lay phan tu thu 2 tinh tu phai', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '9.9.9.9, 1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });

  it('so phan tu it hon TRUSTED_PROXY_HOPS -> lay phan tu dau con lai (khong vuot mang)', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '5');
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });

  it('chi co x-real-ip -> tra gia tri do', () => {
    expect(clientIpFrom(headersOf({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it("khong co header nao -> gom vao khoa 'unknown', KHONG bo qua gioi han (L2)", () => {
    expect(clientIpFrom(headersOf({}))).toBe('unknown');
  });

  it("x-forwarded-for rong -> 'unknown', khong roi ve x-real-ip sai cach", () => {
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '' }))).toBe('unknown');
  });

  it('chuoi 200 ky tu -> cat con 64', () => {
    const long = 'a'.repeat(200);
    const ip = clientIpFrom(headersOf({ 'x-forwarded-for': long }));
    expect(ip).toHaveLength(64);
    expect(ip).toBe('a'.repeat(64));
  });

  it('TRUSTED_PROXY_HOPS dat gia tri khong hop le (0, chu, am) -> coi nhu mac dinh 1', () => {
    for (const bad of ['0', 'abc', '-1', '']) {
      vi.stubEnv('TRUSTED_PROXY_HOPS', bad);
      expect(clientIpFrom(headersOf({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('10.0.0.1');
    }
  });
});
