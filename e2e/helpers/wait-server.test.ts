import { describe, expect, it, vi } from 'vitest';
import { waitForServer } from './wait-server';

describe('waitForServer', () => {
  it('trả về ngay khi server trả HTTP < 500', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 }));
    await waitForServer('http://x', { fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => {} });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('thử lại khi từ chối kết nối hoặc 500 rồi thành công', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    await waitForServer('http://x', { fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => {} });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('hết hạn thì ném lỗi có nêu nguyên nhân cuối', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      waitForServer('http://x', { timeoutMs: 10, intervalMs: 20, fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => {} }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
