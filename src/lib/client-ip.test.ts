import { describe, expect, it } from 'vitest';
import { clientIpFrom } from './client-ip';

/** K13 - lấy phần tử đầu `x-forwarded-for`, rồi `x-real-ip`, cắt 64 ký tự. */
function headersOf(map: Record<string, string>): Pick<Headers, 'get'> {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe('clientIpFrom', () => {
  it('lay phan tu dau cua x-forwarded-for', () => {
    expect(clientIpFrom(headersOf({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });

  it('chi co x-real-ip -> tra gia tri do', () => {
    expect(clientIpFrom(headersOf({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });

  it('khong co header nao -> chuoi rong', () => {
    expect(clientIpFrom(headersOf({}))).toBe('');
  });

  it('chuoi 200 ky tu -> cat con 64', () => {
    const long = 'a'.repeat(200);
    const ip = clientIpFrom(headersOf({ 'x-forwarded-for': long }));
    expect(ip).toHaveLength(64);
    expect(ip).toBe('a'.repeat(64));
  });
});
