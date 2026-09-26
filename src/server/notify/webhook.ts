import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import { promises as dnsPromises } from 'node:dns';
import { checkWebhookUrl, isBlockedIp, webhookPolicyFromEnv, type WebhookPolicy } from '@/lib/notify-url';
import type { LookupFn, SendResult } from './types';

export const WEBHOOK_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 16384;

export interface WebhookDeps {
  /** mặc định: dns.promises.lookup(host, { all: true, verbatim: true }). */
  lookup?: LookupFn;
  /** test tiêm; mặc định theo protocol: node:https.request / node:http.request. */
  request?: typeof https.request;
  /** mặc định webhookPolicyFromEnv(). */
  policy?: WebhookPolicy;
  timeoutMs?: number;
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

const defaultLookup: LookupFn = (host) => dnsPromises.lookup(host, { all: true, verbatim: true });

/**
 * L-2 (danh-gia-bao-mat.md): dns.lookup KHÔNG tự có timeout - bọc lại bằng timeoutMs (cùng ngân
 * sách với timeout kết nối/HTTP) để tránh treo vô hạn nếu resolver chậm/không phản hồi.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Gửi 1 webhook - ghim thẳng vào IP đã kiểm chống SSRF (K3, ke-hoach.md P3B): phân giải DNS 1 lần,
 * kiểm MỌI địa chỉ trả về, kết nối thẳng tới địa chỉ đã kiểm (chống DNS rebinding), không theo redirect.
 * KHÔNG bao giờ throw, KHÔNG console.log URL (có thể chứa bí mật ở query string).
 */
export async function sendWebhook(rawUrl: string, body: string, deps: WebhookDeps = {}): Promise<SendResult> {
  const policy = deps.policy ?? webhookPolicyFromEnv();
  const checked = checkWebhookUrl(rawUrl, policy);
  if (!checked.ok) return { ok: false, error: checked.error };
  const { url } = checked;

  const bodyBuf = Buffer.from(body, 'utf8');
  if (bodyBuf.length > MAX_BODY_BYTES) return { ok: false, error: 'bad_config' };

  const hostname = stripBrackets(url.hostname);
  const hostIsIp = net.isIP(hostname) !== 0;
  const timeoutMs = deps.timeoutMs ?? WEBHOOK_TIMEOUT_MS;

  let targetIp: string;
  if (hostIsIp) {
    targetIp = hostname;
  } else {
    const lookup = deps.lookup ?? defaultLookup;
    let addrs: Array<{ address: string; family: number }>;
    try {
      // L-2: bọc lookup trong cùng timeoutMs - trước đây DNS chậm/treo có thể chờ vô hạn, ngoài
      // vùng bảo vệ của timer bên dưới (chỉ tính từ lúc bắt đầu request HTTP).
      addrs = await withTimeout(lookup(hostname), timeoutMs);
    } catch (e) {
      if (e instanceof Error && e.message === 'timeout') return { ok: false, error: 'timeout' };
      return { ok: false, error: 'dns_failed' };
    }
    if (!addrs || addrs.length === 0) return { ok: false, error: 'dns_failed' };
    if (addrs.some((a) => isBlockedIp(a.address))) return { ok: false, error: 'blocked_ip' };
    targetIp = addrs[0].address;
  }

  const isHttps = url.protocol === 'https:';
  const requestFn = deps.request ?? (isHttps ? https.request : http.request);

  return new Promise<SendResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (result: SendResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const options: Record<string, unknown> = {
      host: targetIp,
      port: url.port ? Number(url.port) : isHttps ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      agent: false,
      headers: {
        Host: url.host,
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        'User-Agent': 'DDC-Control-Tower/1',
      },
    };
    if (isHttps && !hostIsIp) options.servername = hostname;

    const req = requestFn(options as never, (res: http.IncomingMessage) => {
      // L-2: không đọc/rút body (không cần dùng tới) - res.resume() trước đây rút body VÔ HẠN,
      // không còn bị ràng buộc bởi `timer` (đã bị clear ngay khi done() chạy) nên server độc hại có
      // thể giữ kết nối mở, stream dữ liệu mãi. Đóng thẳng response ngay khi đã đọc status.
      const status = res.statusCode ?? 0;
      res.destroy();
      if (status >= 200 && status < 300) done({ ok: true });
      else done({ ok: false, error: `http_${status}` });
    });

    timer = setTimeout(() => {
      req.destroy();
      done({ ok: false, error: 'timeout' });
    }, timeoutMs);

    req.on('error', () => done({ ok: false, error: 'conn_failed' }));
    req.write(bodyBuf);
    req.end();
  });
}
