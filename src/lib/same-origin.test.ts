import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './same-origin';

describe('isSameOrigin', () => {
  it('cung host -> true', () => {
    const h = new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' });
    expect(isSameOrigin(h)).toBe(true);
  });

  it('khac host -> false', () => {
    const h = new Headers({ origin: 'http://evil.com', host: 'localhost:3000' });
    expect(isSameOrigin(h)).toBe(false);
  });

  it('thieu Origin -> false', () => {
    const h = new Headers({ host: 'localhost:3000' });
    expect(isSameOrigin(h)).toBe(false);
  });

  it('co x-forwarded-host thi so voi no (khac host header)', () => {
    const h = new Headers({
      origin: 'https://ddc.example.com',
      host: 'localhost:3000',
      'x-forwarded-host': 'ddc.example.com',
    });
    expect(isSameOrigin(h)).toBe(true);
  });
});
