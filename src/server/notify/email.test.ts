import { describe, expect, it, vi } from 'vitest';
import { sendEmail } from './email';
import type { SmtpConfig } from './email';

const CFG_NO_AUTH: SmtpConfig = { host: 'smtp.example.com', port: 587, secure: false, user: null, pass: null, from: 'a@daidung.com.vn' };
const CFG_AUTH: SmtpConfig = { host: 'smtp.example.com', port: 587, secure: false, user: 'u', pass: 'p', from: 'a@daidung.com.vn' };

const lookupPublic = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);

function fakeTransport(sendMailImpl: (m: Record<string, unknown>) => Promise<{ accepted: unknown[]; rejected: unknown[] }>) {
  const sendMail = vi.fn(sendMailImpl);
  const createTransport = vi.fn((_opts: Record<string, unknown>) => ({ sendMail }));
  return { createTransport, sendMail };
}

describe('sendEmail - tuy chon truyen cho nodemailer', () => {
  it('co user + secure=false -> requireTLS true, auth co user/pass', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: ['r@x.com'], rejected: [] }));

    await sendEmail(CFG_AUTH, ['r@x.com'], 'Subj', 'Text', { createTransport, lookup: lookupPublic });

    const opts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.requireTLS).toBe(true);
    expect(opts.auth).toEqual({ user: 'u', pass: 'p' });
  });

  it('khong user -> auth undefined, requireTLS false', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: ['r@x.com'], rejected: [] }));

    await sendEmail(CFG_NO_AUTH, ['r@x.com'], 'Subj', 'Text', { createTransport, lookup: lookupPublic });

    const opts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.auth).toBeUndefined();
    expect(opts.requireTLS).toBe(false);
  });

  it('[T-3 - danh-gia-bao-mat.md] createTransport nhan IP da resolve (khong phai hostname goc) - chong DNS rebinding, servername = hostname goc de kiem TLS cert', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: ['r@x.com'], rejected: [] }));

    await sendEmail(CFG_NO_AUTH, ['r@x.com'], 'Subj', 'Text', { createTransport, lookup: lookupPublic });

    const opts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.host).toBe('93.184.216.34');
    expect(opts.host).not.toBe(CFG_NO_AUTH.host);
    expect(opts.tls).toMatchObject({ minVersion: 'TLSv1.2', servername: 'smtp.example.com' });
    expect(opts.name).toBe('DDC-Control-Tower/1');
  });

  it("thu co bcc = danh sach nguoi nhan, to = from (khong lo danh sach - K9)", async () => {
    const { createTransport, sendMail } = fakeTransport(async () => ({ accepted: ['a@x.com', 'b@x.com'], rejected: [] }));

    await sendEmail(CFG_NO_AUTH, ['a@x.com', 'b@x.com'], 'Subj', 'Text', { createTransport, lookup: lookupPublic });

    const mail = sendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(mail.to).toBe(CFG_NO_AUTH.from);
    expect(mail.bcc).toEqual(['a@x.com', 'b@x.com']);
    expect(mail.subject).toBe('Subj');
    expect(mail.text).toBe('Text');
  });
});

describe('sendEmail - anh xa loi', () => {
  it("loi { code: 'EAUTH' } -> smtp_auth", async () => {
    const { createTransport } = fakeTransport(async () => {
      throw Object.assign(new Error('auth'), { code: 'EAUTH' });
    });
    const res = await sendEmail(CFG_AUTH, ['r@x.com'], 'S', 'T', { createTransport, lookup: lookupPublic });
    expect(res).toEqual({ ok: false, error: 'smtp_auth' });
  });

  it('accepted rong -> smtp_rejected', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: [], rejected: ['r@x.com'] }));
    const res = await sendEmail(CFG_NO_AUTH, ['r@x.com'], 'S', 'T', { createTransport, lookup: lookupPublic });
    expect(res).toEqual({ ok: false, error: 'smtp_rejected' });
  });

  it("loi { code: 'ETIMEDOUT' } -> timeout", async () => {
    const { createTransport } = fakeTransport(async () => {
      throw Object.assign(new Error('t'), { code: 'ETIMEDOUT' });
    });
    const res = await sendEmail(CFG_NO_AUTH, ['r@x.com'], 'S', 'T', { createTransport, lookup: lookupPublic });
    expect(res).toEqual({ ok: false, error: 'timeout' });
  });

  it("loi khac (khong co code nhan dien) -> smtp_conn", async () => {
    const { createTransport } = fakeTransport(async () => {
      throw new Error('boom');
    });
    const res = await sendEmail(CFG_NO_AUTH, ['r@x.com'], 'S', 'T', { createTransport, lookup: lookupPublic });
    expect(res).toEqual({ ok: false, error: 'smtp_conn' });
  });
});

describe('sendEmail - chan SMTP host la IP noi bo (Q3=a: cho private/LAN)', () => {
  it('host 127.0.0.1 -> blocked_ip, transport KHONG duoc tao', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: [], rejected: [] }));
    const res = await sendEmail({ ...CFG_NO_AUTH, host: '127.0.0.1' }, ['r@x.com'], 'S', 'T', { createTransport });
    expect(res).toEqual({ ok: false, error: 'blocked_ip' });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('host 10.0.0.5 (private/LAN) -> duoc gui binh thuong', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: ['r@x.com'], rejected: [] }));
    const res = await sendEmail({ ...CFG_NO_AUTH, host: '10.0.0.5' }, ['r@x.com'], 'S', 'T', { createTransport });
    expect(res).toEqual({ ok: true });
    expect(createTransport).toHaveBeenCalled();
  });

  it('to rong -> no_recipients, khong tao transport', async () => {
    const { createTransport } = fakeTransport(async () => ({ accepted: [], rejected: [] }));
    const res = await sendEmail(CFG_NO_AUTH, [], 'S', 'T', { createTransport });
    expect(res).toEqual({ ok: false, error: 'no_recipients' });
    expect(createTransport).not.toHaveBeenCalled();
  });
});
