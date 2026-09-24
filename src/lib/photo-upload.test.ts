import { describe, expect, it } from 'vitest';
import { overallPercent, precheckPhotos } from './photo-upload';

const MAX = 5 * 1024 * 1024;

describe('precheckPhotos', () => {
  it('pdf -> not_image', () => {
    const { accepted, rejected } = precheckPhotos([{ name: 'a.pdf', type: 'application/pdf', size: 100 }], MAX);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ name: 'a.pdf', reason: 'not_image' }]);
  });

  it('0 byte -> too_big', () => {
    const { rejected } = precheckPhotos([{ name: 'a.png', type: 'image/png', size: 0 }], MAX);
    expect(rejected).toEqual([{ name: 'a.png', reason: 'too_big' }]);
  });

  it('max+1 -> too_big', () => {
    const { rejected } = precheckPhotos([{ name: 'a.png', type: 'image/png', size: MAX + 1 }], MAX);
    expect(rejected).toEqual([{ name: 'a.png', reason: 'too_big' }]);
  });

  it('dung max -> accepted', () => {
    const { accepted, rejected } = precheckPhotos([{ name: 'a.png', type: 'image/png', size: MAX }], MAX);
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it('giu thu tu, tron accepted/rejected', () => {
    const files = [
      { name: '1.png', type: 'image/png', size: 10 },
      { name: '2.pdf', type: 'application/pdf', size: 10 },
      { name: '3.jpg', type: 'image/jpeg', size: 10 },
    ];
    const { accepted, rejected } = precheckPhotos(files, MAX);
    expect(accepted.map((f) => f.name)).toEqual(['1.png', '3.jpg']);
    expect(rejected.map((f) => f.name)).toEqual(['2.pdf']);
  });
});

describe('overallPercent', () => {
  it.each([
    [0, 0, 0, 0],
    [50, 0, 100, 50],
    [50, 25, 100, 75],
    [100, 10, 100, 100],
  ] as const)('doneBytes=%s currentLoaded=%s totalBytes=%s -> %s', (done, cur, total, expected) => {
    expect(overallPercent(done, cur, total)).toBe(expected);
  });

  it('lam tron xuong', () => {
    expect(overallPercent(1, 0, 3)).toBe(33);
  });
});
