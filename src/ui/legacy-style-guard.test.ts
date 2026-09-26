import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Chan viec sot file khi doi he thiet ke. Moi Task xoa phan cua minh khoi PENDING
 * TRUOC khi sua code -> test do -> sua xong -> test xanh. Task cuoi cung PENDING = [].
 */
const ROOT = process.cwd();

/** File duoc phep chua hex tho vi ly do chinh dang (logo hang thu ba...). */
const HEX_ALLOW = new Set<string>([
  'src/components/layout/LoginForm.tsx', // mau thuong hieu Google trong icon dang nhap
]);

/** Con no: file chua doi sang he Apple Glass. Xoa dan theo tung Task. */
const PENDING: string[] = [
];

const BANNED: { re: RegExp; why: string }[] = [
  {
    re: /(?:^|[\s"'`:[])(?:[a-z-]+:)*(?:text|bg|border|ring|divide|from|via|to|fill|stroke|placeholder|outline|decoration|accent|shadow|rounded)-(?:slate|navy|red|amber|emerald|blue|accent|gold-soft|canvas|offwhite|card)(?:-(?:soft|hover|\d{1,3}))?(?:\/\d{1,3})?\b/,
    why: 'palette Tailwind cu - dung token --label/--fill/--accent...',
  },
  { re: /\bbg-white(?:\/\d{1,3})?\b/, why: 'bg-white - dung --glass/--glass-3 qua class .card/.mat' },
  { re: /\bdark:/, why: 'bien the dark: - token tu doi theo theme, khong can dark:' },
  { re: /\btable-zebra\b/, why: 'zebra cu - mock-up chi co hover, khong soc mau' },
  { re: /#B91C1C/i, why: 'do cu #B91C1C' },
  {
    re: /className=(["'])inline\1/,
    why: 'class rieng .inline trung Tailwind utility bare "inline" (P3C-A BUG-01, xem app/globals.css .inline-row) - dung .inline-row',
  },
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(relative(ROOT, p).split(sep).join('/'));
  }
  return out;
}

const FILES = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src/components'))]
  .filter((f) => f !== 'src/components/icons/index.tsx'); // chi dung currentColor

describe('canh style cu', () => {
  it('PENDING khong liet ke file khong ton tai', () => {
    expect(PENDING.filter((f) => !FILES.includes(f))).toEqual([]);
  });

  for (const file of FILES) {
    const done = !PENDING.includes(file);
    it(`${file} ${done ? '(da doi)' : '(con no - bo qua)'}`, () => {
      if (!done) return;
      const src = readFileSync(join(ROOT, file), 'utf-8');
      for (const { re, why } of BANNED) {
        const m = src.match(re);
        expect(m, `${file}: con "${m?.[0]}" -> ${why}`).toBeNull();
      }
      if (!HEX_ALLOW.has(file)) {
        const m = src.match(HEX);
        expect(m, `${file}: con hex tho "${m?.[0]}" -> dua vao app/tokens.css`).toBeNull();
      }
    });
  }

  it('BANNED chan className="inline" tran (P3C-A BUG-01), khong chan inline-row/inline-flex', () => {
    const rule = BANNED.find((b) => b.why.includes('BUG-01'));
    expect(rule, 'chua co rule chan class "inline" tran trong BANNED').toBeTruthy();
    expect('<div className="inline">').toMatch(rule!.re);
    expect("<div className='inline'>").toMatch(rule!.re);
    expect('<div className="inline-row">').not.toMatch(rule!.re);
    expect('<label className="inline-row" style={{...}}>').not.toMatch(rule!.re);
    expect('<div className="inline-flex">').not.toMatch(rule!.re);
    expect('<div className="inline-block">').not.toMatch(rule!.re);
  });

  it('khong con file nao trong src/ va app/ dung className="inline" tran', () => {
    for (const file of FILES) {
      const src = readFileSync(join(ROOT, file), 'utf-8');
      const m = src.match(/className=(["'])inline\1/);
      expect(m, `${file}: con className="inline" tran (BUG-01) -> doi sang inline-row`).toBeNull();
    }
  });

  it('globals.css khong con override .dark', () => {
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf-8');
    expect(css.includes('.dark ')).toBe(false);
  });

  it('tailwind.config.ts khong con palette di san', () => {
    const cfg = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf-8');
    for (const k of ['#B91C1C', '#FEE2E2', "canvas:", "offwhite:", "navy: {", "navy:{"]) {
      expect(cfg.includes(k), `con "${k}"`).toBe(false);
    }
  });

  it('PENDING da rong - khong con file nao chua doi', () => {
    expect(PENDING).toEqual([]);
  });
});
