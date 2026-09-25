import net from 'node:net';

export type WebhookUrlError =
  | 'invalid_url'
  | 'bad_protocol'
  | 'has_credentials'
  | 'host_not_allowed'
  | 'blocked_ip'
  | 'too_long';

export interface WebhookPolicy {
  allowHttp: boolean;
  allowHosts: string[];
}

const MAX_URL_LENGTH = 2048;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan'];

/** NOTIFY_WEBHOOK_ALLOW_HTTP === '1'; NOTIFY_WEBHOOK_ALLOW_HOSTS tách ',', trim, lowercase, bỏ rỗng. */
export function webhookPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): WebhookPolicy {
  return {
    allowHttp: env.NOTIFY_WEBHOOK_ALLOW_HTTP === '1',
    allowHosts: (env.NOTIFY_WEBHOOK_ALLOW_HOSTS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

/** 'a.com' = đúng tên; '.a.com' = tên con (x.a.com), KHÔNG gồm a.com. */
export function hostMatchesAllowList(host: string, allow: string[]): boolean {
  const h = host.toLowerCase();
  return allow.some((raw) => {
    const p = raw.toLowerCase();
    if (p.startsWith('.')) return h.length > p.length && h.endsWith(p);
    return h === p;
  });
}

/** Kiểm tĩnh (không DNS). */
export function checkWebhookUrl(raw: string, policy: WebhookPolicy): { ok: true; url: URL } | { ok: false; error: WebhookUrlError } {
  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, error: 'too_long' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }

  const isHttps = url.protocol === 'https:';
  const isHttp = url.protocol === 'http:';
  if (!isHttps && !(isHttp && policy.allowHttp)) return { ok: false, error: 'bad_protocol' };

  if (url.username || url.password) return { ok: false, error: 'has_credentials' };

  let hostname = url.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) hostname = hostname.slice(1, -1);
  if (!hostname) return { ok: false, error: 'invalid_url' };

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) return { ok: false, error: 'blocked_ip' };
  } else {
    const lower = hostname.toLowerCase();
    if (lower === 'localhost' || LOCAL_SUFFIXES.some((s) => lower.endsWith(s))) {
      return { ok: false, error: 'blocked_ip' };
    }
  }

  if (policy.allowHosts.length > 0 && !hostMatchesAllowList(hostname, policy.allowHosts)) {
    return { ok: false, error: 'host_not_allowed' };
  }

  return { ok: true, url };
}

const IPV4_BLOCKLIST = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  IPV4_BLOCKLIST.addSubnet(addr, prefix, 'ipv4');
}

const IPV6_BLOCKLIST = new net.BlockList();
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) {
  IPV6_BLOCKLIST.addSubnet(addr, prefix, 'ipv6');
}

const SMTP_IPV4_BLOCKLIST = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['224.0.0.0', 4],
  ['255.255.255.255', 32],
] as const) {
  SMTP_IPV4_BLOCKLIST.addSubnet(addr, prefix, 'ipv4');
}

const SMTP_IPV6_BLOCKLIST = new net.BlockList();
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  SMTP_IPV6_BLOCKLIST.addSubnet(addr, prefix, 'ipv6');
}

/** Phân giải 1 địa chỉ IPv6 hợp lệ ra 16 byte - hỗ trợ "::" nén và dạng nhúng IPv4 (a.b.c.d ở cuối). */
function ipv6ToBytes(ip: string): number[] | null {
  let str = ip;
  const pct = str.indexOf('%');
  if (pct >= 0) str = str.slice(0, pct);

  const hasDouble = str.includes('::');
  const [headStr, tailStr = ''] = hasDouble ? str.split('::') : [str, undefined];
  if (hasDouble && str.split('::').length > 2) return null;

  function toGroups(s: string): number[] | null {
    if (s === '') return [];
    const parts = s.split(':');
    const groups: number[] = [];
    for (const p of parts) {
      if (p.includes('.')) {
        const nums = p.split('.').map(Number);
        if (nums.length !== 4 || nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
        groups.push((nums[0] << 8) | nums[1], (nums[2] << 8) | nums[3]);
      } else {
        const n = parseInt(p, 16);
        if (Number.isNaN(n) || n < 0 || n > 0xffff) return null;
        groups.push(n);
      }
    }
    return groups;
  }

  const head = toGroups(headStr);
  const tail = hasDouble ? toGroups(tailStr) : [];
  if (head === null || tail === null) return null;

  const missing = 8 - head.length - tail.length;
  if (!hasDouble && missing !== 0) return null;
  if (hasDouble && missing < 0) return null;

  const full = [...head, ...Array(hasDouble ? missing : 0).fill(0), ...tail];
  if (full.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of full) bytes.push((g >> 8) & 0xff, g & 0xff);
  return bytes;
}

/** IPv4 nhúng trong IPv6 (::ffff:a.b.c.d dạng chuẩn/NAT64 64:ff9b::/96) - trả 'a.b.c.d' hoặc null. */
function embeddedIPv4(bytes: number[]): string | null {
  const mappedPrefix = bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const nat64Prefix = [0x00, 0x64, 0xff, 0x9b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const isNat64 = bytes.slice(0, 12).every((b, i) => b === nat64Prefix[i]);
  if (mappedPrefix || isNat64) return bytes.slice(12).join('.');
  return null;
}

/** IP không hợp lệ → true (fail-closed). */
export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return IPV4_BLOCKLIST.check(ip, 'ipv4');
  if (family === 6) {
    const bytes = ipv6ToBytes(ip);
    if (bytes) {
      const embedded = embeddedIPv4(bytes);
      if (embedded) return isBlockedIp(embedded);
    }
    return IPV6_BLOCKLIST.check(ip, 'ipv6');
  }
  return true;
}

/** Q3=(a): chỉ chặn loopback, link-local (gồm 169.254.169.254), 0.0.0.0/8, ::, multicast, 255.255.255.255; cho private. */
export function isBlockedSmtpIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return SMTP_IPV4_BLOCKLIST.check(ip, 'ipv4');
  if (family === 6) {
    const bytes = ipv6ToBytes(ip);
    if (bytes) {
      const embedded = embeddedIPv4(bytes);
      if (embedded) return isBlockedSmtpIp(embedded);
    }
    return SMTP_IPV6_BLOCKLIST.check(ip, 'ipv6');
  }
  return true;
}
