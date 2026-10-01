import { describe, expect, it } from 'vitest';
import { LOGIN_SYSTEM_BUSY, loginErrorKey } from './login-errors';

describe('loginErrorKey - anh xa res.error cua next-auth sang key i18n', () => {
  it('locked / ip_limited giu nguyen nhu cu', () => {
    expect(loginErrorKey('locked')).toBe('authSecurity.locked');
    expect(loginErrorKey('ip_limited')).toBe('authSecurity.ipLimited');
  });
  it('system_busy -> loginBusy.systemBusy', () => {
    expect(LOGIN_SYSTEM_BUSY).toBe('system_busy');
    expect(loginErrorKey('system_busy')).toBe('loginBusy.systemBusy');
  });
  it('CredentialsSignin va chuoi la -> auth.invalidCredentials', () => {
    expect(loginErrorKey('CredentialsSignin')).toBe('auth.invalidCredentials');
    expect(loginErrorKey('bat-ky')).toBe('auth.invalidCredentials');
  });
});
