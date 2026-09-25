import { describe, expect, it } from 'vitest';
import { checkWebhookUrl, hostMatchesAllowList, isBlockedIp, isBlockedSmtpIp, webhookPolicyFromEnv } from './notify-url';

const NO_ALLOW = { allowHttp: false, allowHosts: [] };
const ALLOW_HTTP = { allowHttp: true, allowHosts: [] };

describe('checkWebhookUrl', () => {
  it('https hop le, khong IP, khong allowHosts -> ok', () => {
    const res = checkWebhookUrl('https://hooks.slack.com/services/X', NO_ALLOW);
    expect(res.ok).toBe(true);
  });

  it("http bi chan khi allowHttp=false, duoc phep khi true", () => {
    expect(checkWebhookUrl('http://x.com', NO_ALLOW)).toEqual({ ok: false, error: 'bad_protocol' });
    expect(checkWebhookUrl('http://x.com', ALLOW_HTTP).ok).toBe(true);
  });

  it('giao thuc la -> bad_protocol', () => {
    expect(checkWebhookUrl('ftp://x', NO_ALLOW)).toEqual({ ok: false, error: 'bad_protocol' });
    expect(checkWebhookUrl('file:///etc/passwd', NO_ALLOW)).toEqual({ ok: false, error: 'bad_protocol' });
    expect(checkWebhookUrl('javascript:alert(1)', NO_ALLOW)).toEqual({ ok: false, error: 'bad_protocol' });
  });

  it('URL co username/password -> has_credentials', () => {
    expect(checkWebhookUrl('https://u:p@x.com', NO_ALLOW)).toEqual({ ok: false, error: 'has_credentials' });
  });

  it.each([
    'https://127.0.0.1/',
    'https://2130706433/',
    'https://0x7f.1/',
    'https://[::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://169.254.169.254/latest/meta-data',
    'https://10.1.2.3/',
    'https://192.168.1.1/',
    'https://localhost/',
    'https://db.internal/',
  ])('IP/ten noi bo bi chan -> blocked_ip: %s', (u) => {
    expect(checkWebhookUrl(u, NO_ALLOW)).toEqual({ ok: false, error: 'blocked_ip' });
  });

  it('allowHosts ten con (.office.com): x.webhook.office.com OK, office.com/evil.com bi chan', () => {
    const policy = { allowHttp: false, allowHosts: ['.office.com'] };
    expect(checkWebhookUrl('https://x.webhook.office.com/', policy).ok).toBe(true);
    expect(checkWebhookUrl('https://office.com/', policy)).toEqual({ ok: false, error: 'host_not_allowed' });
    expect(checkWebhookUrl('https://evil.com/', policy)).toEqual({ ok: false, error: 'host_not_allowed' });
  });

  it('allowHosts co 127.0.0.1 van bi blocked_ip (kiem IP truoc allowHosts)', () => {
    const policy = { allowHttp: false, allowHosts: ['127.0.0.1'] };
    expect(checkWebhookUrl('https://127.0.0.1/', policy)).toEqual({ ok: false, error: 'blocked_ip' });
  });

  it('URL qua dai (>2048 ky tu) -> too_long', () => {
    const long = `https://example.com/${'a'.repeat(2049)}`;
    expect(checkWebhookUrl(long, NO_ALLOW)).toEqual({ ok: false, error: 'too_long' });
  });
});

describe('webhookPolicyFromEnv', () => {
  it('doc tu env: allowHttp theo === 1, allowHosts tach phay/trim/lowercase/bo rong', () => {
    const policy = webhookPolicyFromEnv({
      NOTIFY_WEBHOOK_ALLOW_HTTP: '1',
      NOTIFY_WEBHOOK_ALLOW_HOSTS: ' A.com, , .B.com ',
    } as unknown as NodeJS.ProcessEnv);
    expect(policy).toEqual({ allowHttp: true, allowHosts: ['a.com', '.b.com'] });
  });

  it('thieu env -> mac dinh chan http, allowHosts rong', () => {
    expect(webhookPolicyFromEnv({} as unknown as NodeJS.ProcessEnv)).toEqual({ allowHttp: false, allowHosts: [] });
  });
});

describe('hostMatchesAllowList', () => {
  it("'a.com' = dung ten", () => {
    expect(hostMatchesAllowList('a.com', ['a.com'])).toBe(true);
    expect(hostMatchesAllowList('x.a.com', ['a.com'])).toBe(false);
  });

  it("'.a.com' = ten con, KHONG gom a.com", () => {
    expect(hostMatchesAllowList('x.a.com', ['.a.com'])).toBe(true);
    expect(hostMatchesAllowList('a.com', ['.a.com'])).toBe(false);
  });
});

describe('isBlockedIp', () => {
  it('IP cong khai -> false', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
  });

  it('chuoi khong phai IP -> true (fail-closed)', () => {
    expect(isBlockedIp('abc')).toBe(true);
  });

  it('NAT64 nhung IPv4 loopback -> true', () => {
    expect(isBlockedIp('64:ff9b::7f00:1')).toBe(true);
  });
});

describe('isBlockedSmtpIp - Q3=(a) cho private, chan loopback/link-local/metadata', () => {
  it('IP private (LAN) -> false', () => {
    expect(isBlockedSmtpIp('10.0.0.5')).toBe(false);
  });

  it('loopback -> true', () => {
    expect(isBlockedSmtpIp('127.0.0.1')).toBe(true);
  });

  it('link-local metadata 169.254.169.254 -> true', () => {
    expect(isBlockedSmtpIp('169.254.169.254')).toBe(true);
  });
});
