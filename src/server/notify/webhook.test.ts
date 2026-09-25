import { describe, expect, it, vi } from 'vitest';
import { sendWebhook } from './webhook';
import type { WebhookDeps } from './webhook';

const NO_ALLOW = { allowHttp: false, allowHosts: [] };

/** Request giả (khuôn ClientRequest) - ghi lại options nhận được, tự lái theo kịch bản. */
function fakeRequest(script: {
  onCreate?: (options: Record<string, unknown>) => void;
  respondStatus?: number;
  neverRespond?: boolean;
  emitError?: boolean;
}) {
  const calls: Record<string, unknown>[] = [];
  const request = vi.fn((options: Record<string, unknown>, callback?: (res: unknown) => void) => {
    calls.push(options);
    script.onCreate?.(options);
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const req = {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = cb;
        return req;
      },
      write: vi.fn(),
      end: vi.fn(() => {
        if (script.emitError) {
          queueMicrotask(() => handlers.error?.(new Error('boom')));
          return;
        }
        if (script.neverRespond) return;
        queueMicrotask(() => {
          callback?.({ statusCode: script.respondStatus ?? 200, resume: () => {} });
        });
      }),
      destroy: vi.fn(),
    };
    return req;
  });
  return { request: request as unknown as typeof import('node:https').request, calls };
}

describe('sendWebhook - kiem URL truoc (khong bao gio goi request neu bi chan)', () => {
  it('URL IP noi bo -> blocked_ip, request KHONG duoc goi', async () => {
    const { request, calls } = fakeRequest({});
    const res = await sendWebhook('https://127.0.0.1/x', '{}', { request, policy: NO_ALLOW });
    expect(res).toEqual({ ok: false, error: 'blocked_ip' });
    expect(calls).toHaveLength(0);
  });
});

describe('sendWebhook - phan giai DNS, kiem MOI dia chi', () => {
  it('lookup tra lan IP cong khai + IP noi bo -> blocked_ip', async () => {
    const lookup = vi.fn(async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    const { request } = fakeRequest({});
    const res = await sendWebhook('https://hooks.example.com/x', '{}', { request, lookup, policy: NO_ALLOW });
    expect(res).toEqual({ ok: false, error: 'blocked_ip' });
  });

  it('lookup nem loi -> dns_failed', async () => {
    const lookup = vi.fn(async () => {
      throw new Error('ENOTFOUND');
    });
    const { request } = fakeRequest({});
    const res = await sendWebhook('https://hooks.example.com/x', '{}', { request, lookup, policy: NO_ALLOW });
    expect(res).toEqual({ ok: false, error: 'dns_failed' });
  });

  it('lookup rong -> dns_failed', async () => {
    const lookup = vi.fn(async () => []);
    const { request } = fakeRequest({});
    const res = await sendWebhook('https://hooks.example.com/x', '{}', { request, lookup, policy: NO_ALLOW });
    expect(res).toEqual({ ok: false, error: 'dns_failed' });
  });
});

describe('sendWebhook - ghim IP da kiem, gui thanh cong', () => {
  it("lookup [93.184.216.34] + request tra 204 -> ok, request nhan host/servername/Host dung", async () => {
    const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const { request, calls } = fakeRequest({ respondStatus: 204 });

    const res = await sendWebhook('https://example.com/hook', '{"a":1}', { request, lookup, policy: NO_ALLOW });

    expect(res).toEqual({ ok: true });
    expect(calls[0].host).toBe('93.184.216.34');
    expect(calls[0].servername).toBe('example.com');
    expect((calls[0].headers as Record<string, string>).Host).toBe('example.com');
    expect(calls[0].method).toBe('POST');
  });

  it('request tra 302 -> http_302 (khong theo redirect)', async () => {
    const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const { request } = fakeRequest({ respondStatus: 302 });

    const res = await sendWebhook('https://example.com/hook', '{}', { request, lookup, policy: NO_ALLOW });

    expect(res).toEqual({ ok: false, error: 'http_302' });
  });

  it('request khong bao gio phan hoi + timeoutMs 50 -> timeout', async () => {
    const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const { request } = fakeRequest({ neverRespond: true });

    const res = await sendWebhook('https://example.com/hook', '{}', { request, lookup, policy: NO_ALLOW, timeoutMs: 50 });

    expect(res).toEqual({ ok: false, error: 'timeout' });
  });

  it("request emit 'error' -> conn_failed", async () => {
    const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const { request } = fakeRequest({ emitError: true });

    const res = await sendWebhook('https://example.com/hook', '{}', { request, lookup, policy: NO_ALLOW });

    expect(res).toEqual({ ok: false, error: 'conn_failed' });
  });
});

describe('sendWebhook - bien: body qua lon', () => {
  it('body > 16384 byte -> bad_config, khong goi request', async () => {
    const { request, calls } = fakeRequest({});
    const res = await sendWebhook('https://example.com/hook', 'x'.repeat(16385), { request, policy: NO_ALLOW });
    expect(res).toEqual({ ok: false, error: 'bad_config' });
    expect(calls).toHaveLength(0);
  });
});
