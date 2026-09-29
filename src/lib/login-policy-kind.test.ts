import { describe, expect, it } from 'vitest';
import { RESET_TOKEN_TTL_MS, resetTokenKindOf, SIGNUP_INVITE_TTL_MS } from './login-policy';

describe('resetTokenKindOf', () => {
  const created = new Date('2026-09-29T03:00:00.000Z');
  const after = (ms: number) => new Date(created.getTime() + ms);

  it('hạn 30 phút -> reset, kể cả lệch đồng hồ vài giây', () => {
    expect(resetTokenKindOf(created, after(RESET_TOKEN_TTL_MS))).toBe('reset');
    expect(resetTokenKindOf(created, after(RESET_TOKEN_TTL_MS + 5_000))).toBe('reset');
    expect(resetTokenKindOf(created, after(RESET_TOKEN_TTL_MS - 5_000))).toBe('reset');
  });

  it('hạn 72 giờ -> invite', () => {
    expect(resetTokenKindOf(created, after(SIGNUP_INVITE_TTL_MS))).toBe('invite');
  });
});
