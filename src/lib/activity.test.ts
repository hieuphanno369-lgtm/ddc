import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logActivityMock } = vi.hoisted(() => ({ logActivityMock: vi.fn() }));
vi.mock('@/server/repo', () => ({ repo: { logActivity: logActivityMock } }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));

import { headers } from 'next/headers';
import { logActivity } from './activity';

beforeEach(() => {
  logActivityMock.mockClear();
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'user-agent' ? 'UA-test' : null),
  } as never);
});

/**
 * R7 (bao-mat.md vòng 2) - `logActivity` phải tự cắt độ dài TRƯỚC khi ghi (không phụ thuộc từng
 * nơi gọi tự kiểm), vì nhánh Google chưa xác minh (`auth.ts`) chuyển thẳng dữ liệu chưa đáng tin.
 */
describe('logActivity - R7: cat do dai truoc khi ghi', () => {
  it('userEmail cat con toi da 254 ky tu', async () => {
    const longEmail = `${'a'.repeat(300)}@daidung.com.vn`;
    await logActivity({ name: 'A', email: longEmail }, 'test_action');

    expect(logActivityMock).toHaveBeenCalledTimes(1);
    const arg = logActivityMock.mock.calls[0][0];
    expect(arg.userEmail.length).toBeLessThanOrEqual(254);
    expect(arg.userEmail).toBe(longEmail.slice(0, 254));
  });

  it('userName cat con toi da 100 ky tu', async () => {
    const longName = 'X'.repeat(300);
    await logActivity({ name: longName, email: 'a@daidung.com.vn' }, 'test_action');

    const arg = logActivityMock.mock.calls[0][0];
    expect(arg.userName.length).toBeLessThanOrEqual(100);
    expect(arg.userName).toBe(longName.slice(0, 100));
  });

  it('userAgent cat con toi da 256 ky tu', async () => {
    const longUa = 'U'.repeat(500);
    vi.mocked(headers).mockResolvedValue({ get: (name: string) => (name === 'user-agent' ? longUa : null) } as never);

    await logActivity({ name: 'A', email: 'a@daidung.com.vn' }, 'test_action');

    const arg = logActivityMock.mock.calls[0][0];
    expect(arg.userAgent.length).toBeLessThanOrEqual(256);
    expect(arg.userAgent).toBe(longUa.slice(0, 256));
  });

  it('detail cat con toi da 500 ky tu', async () => {
    const longDetail = 'D'.repeat(1000);
    await logActivity({ name: 'A', email: 'a@daidung.com.vn' }, 'test_action', longDetail);

    const arg = logActivityMock.mock.calls[0][0];
    expect(arg.detail.length).toBeLessThanOrEqual(500);
    expect(arg.detail).toBe(longDetail.slice(0, 500));
  });

  it('gia tri ngan hon gioi han thi giu nguyen, khong bi doi', async () => {
    await logActivity({ name: 'A', email: 'a@daidung.com.vn' }, 'test_action', 'ngan');

    const arg = logActivityMock.mock.calls[0][0];
    expect(arg).toEqual(
      expect.objectContaining({ userEmail: 'a@daidung.com.vn', userName: 'A', action: 'test_action', detail: 'ngan' }),
    );
  });
});
