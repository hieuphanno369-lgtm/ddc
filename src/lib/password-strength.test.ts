import { describe, expect, it } from 'vitest';
import { passwordStrength4 } from './password-strength';

describe('passwordStrength4', () => {
  it.each([
    ['', 0],
    ['abc', 1],
    ['abcdefgh', 1],
    ['abcdefg1', 2],
    ['Abcdefg1', 3],
    ['Abcdef1!', 4],
    ['ABCDEFGH', 1],
    ['12345678', 1],
  ])('%j -> %i', (pw, expected) => {
    expect(passwordStrength4(pw)).toBe(expected);
  });
});
