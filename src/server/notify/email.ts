import * as net from 'node:net';
import { isBlockedSmtpIp } from '@/lib/notify-url';
import type { LookupFn, SendResult } from './types';

export const SMTP_CONNECT_TIMEOUT_MS = 5000;
export const SMTP_SOCKET_TIMEOUT_MS = 10000;

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

type Transport = { sendMail(m: Record<string, unknown>): Promise<{ accepted: unknown[]; rejected: unknown[] }> };

export interface EmailDeps {
  createTransport?: (opts: Record<string, unknown>) => Transport;
  lookup?: LookupFn;
}

function isSmtpErrorWithCode(e: unknown): e is { code: string } {
  return typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string';
}

/**
 * Gửi 1 email (Task 7, P3B) - nodemailer thật, chặn SMTP host là IP nội bộ trước khi gửi (Q3=a:
 * cho private/LAN, chỉ chặn loopback/link-local/metadata/multicast/broadcast). KHÔNG bao giờ throw.
 */
export async function sendEmail(cfg: SmtpConfig, to: string[], subject: string, text: string, deps: EmailDeps = {}): Promise<SendResult> {
  if (to.length === 0) return { ok: false, error: 'no_recipients' };

  // T-3 (danh-gia-bao-mat.md): resolve DNS 1 lần, kiểm MỌI địa chỉ trả về rồi ghim thẳng transport
  // vào địa chỉ đã kiểm (chống DNS rebinding - nếu chỉ truyền hostname cho nodemailer, nó tự
  // resolve4/6 lại nên có thể trúng địa chỉ khác lúc thực sự kết nối).
  const hostIsIp = net.isIP(cfg.host) !== 0;
  let targetIp: string;
  if (hostIsIp) {
    if (isBlockedSmtpIp(cfg.host)) return { ok: false, error: 'blocked_ip' };
    targetIp = cfg.host;
  } else {
    const lookup = deps.lookup ?? ((h: string) => import('node:dns').then((dns) => dns.promises.lookup(h, { all: true, verbatim: true })));
    let addrs: Array<{ address: string; family: number }>;
    try {
      addrs = await lookup(cfg.host);
    } catch {
      return { ok: false, error: 'dns_failed' };
    }
    if (!addrs || addrs.length === 0) return { ok: false, error: 'dns_failed' };
    if (addrs.some((a) => isBlockedSmtpIp(a.address))) return { ok: false, error: 'blocked_ip' };
    targetIp = addrs[0].address;
  }

  const createTransport = deps.createTransport ?? (await import('nodemailer')).createTransport;
  const transport = createTransport({
    host: targetIp,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
    requireTLS: !cfg.secure && !!cfg.user,
    connectionTimeout: SMTP_CONNECT_TIMEOUT_MS,
    greetingTimeout: SMTP_CONNECT_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    // EHLO/HELO: không để nodemailer tự lấy os.hostname() (tránh lộ tên máy nội bộ).
    name: 'DDC-Control-Tower/1',
    // servername (SNI) = hostname gốc để cert TLS được kiểm đúng dù kết nối thẳng bằng IP.
    // L-12: RFC 6066 khong cho SNI la IP (Node canh bao DEP0123) - host la IP thi khong dat servername.
    tls: hostIsIp ? { minVersion: 'TLSv1.2' } : { minVersion: 'TLSv1.2', servername: cfg.host },
  });

  try {
    const info = await transport.sendMail({ from: cfg.from, to: cfg.from, bcc: to, subject, text });
    if (info.accepted.length === 0) return { ok: false, error: 'smtp_rejected' };
    return { ok: true };
  } catch (e) {
    if (isSmtpErrorWithCode(e)) {
      if (e.code === 'EAUTH') return { ok: false, error: 'smtp_auth' };
      if (e.code === 'ETIMEDOUT') return { ok: false, error: 'timeout' };
      if (e.code === 'EENVELOPE') return { ok: false, error: 'smtp_rejected' };
    }
    return { ok: false, error: 'smtp_conn' };
  }
}
