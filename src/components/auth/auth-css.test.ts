import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'auth.module.css'), 'utf8');

const KEYFRAMES = [
  'authUp', 'authGrow', 'authFade', 'authPing', 'authSpin', 'authTrolley',
  'authCable', 'authHook', 'authHb', 'authPlaced', 'authSpark', 'authBlink',
];

/** Lấy thân khối `@media (prefers-reduced-motion: reduce) { ... }` (khối lồng 1 cấp). */
function reducedMotionBlock(): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(start, 'thieu khoi reduced-motion').toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('khoi reduced-motion khong dong');
}

describe('auth.module.css - animation', () => {
  it.each(KEYFRAMES)('co @keyframes %s', (name) => {
    expect(css).toMatch(new RegExp(String.raw`@keyframes ${name}\s*\{`));
  });

  it.each([
    ['trolley', 'authTrolley', '10s'],
    ['cable', 'authCable', '10s'],
    ['hook', 'authHook', '10s'],
    ['hb', 'authHb', '10s'],
    ['placed', 'authPlaced', '10s'],
    ['spark', 'authSpark', '10s'],
    ['blink', 'authBlink', '1.6s'],
    ['spin', 'authSpin', '6s'],
  ])('lop .%s chay %s chu ky %s', (cls, kf, dur) => {
    const durRe = dur.replace('.', String.raw`\.`);
    expect(css).toMatch(new RegExp(String.raw`\.${cls}\s*\{[^}]*animation:\s*${kf} ${durRe}`));
  });

  it('vong lan cua diem canh bao chay authPing 1.8s', () => {
    expect(css).toMatch(/\.pulse::after\s*\{[^}]*authPing 1\.8s/);
  });

  it('reduced-motion tat moi animation, spark va placed an', () => {
    const block = reducedMotionBlock();
    for (const cls of ['.up', '.bar', '.today', '.pop', '.pulse::after', '.spin', '.trolley', '.cable', '.hook', '.hb', '.placed', '.spark', '.blink']) {
      expect(block, `${cls} chua duoc tat`).toContain(cls);
    }
    expect(block).toMatch(/animation:\s*none/);
    expect(block).toMatch(/\.spark,\s*\.placed\s*\{[^}]*opacity:\s*0/);
  });

  it('moi @keyframes chi doi transform hoac opacity', () => {
    const re = /@keyframes\s+(\w+)\s*\{((?:[^{}]*\{[^{}]*\})+)\s*\}/g;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(css))) {
      n++;
      const props = [...m[2].matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
      for (const p of props) expect(['transform', 'opacity'], `${m[1]} dung thuoc tinh ${p}`).toContain(p);
    }
    expect(n).toBeGreaterThanOrEqual(KEYFRAMES.length);
  });

  it('khong dung mau/font cu cua ban goc 28/09', () => {
    for (const bad of ['#0B1220', '#C2410C', '#F59E4B', 'Be Vietnam', 'IBM Plex']) {
      expect(css.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });
});
