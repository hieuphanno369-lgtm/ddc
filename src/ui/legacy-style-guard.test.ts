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
  // Task 8 - admin editor
  'src/components/admin/UserEditor.tsx',
  'src/components/admin/FieldEditor.tsx',
  'src/components/admin/ActivityViewer.tsx',
  'src/components/admin/DeleteProject.tsx',
  'src/components/admin/ResetDataButton.tsx',
  // Task 9 - chart
  'src/components/dashboard/charts.tsx',
  'src/components/dashboard/DrillCharts.tsx',
  'src/components/dashboard/ChartLabels.tsx',
  'src/components/project/ManpowerDailyChart.tsx',
  // Task 10 - 2 dashboard chinh
  'app/[locale]/(app)/overview/page.tsx',
  'app/[locale]/(app)/projects/[id]/page.tsx',
  'src/components/dashboard/OverviewWidgets.tsx',
  // Task 11 - cac trang con lai
  'app/[locale]/(app)/report/page.tsx',
  'app/[locale]/(app)/alerts/page.tsx',
  'app/[locale]/(app)/compliance/page.tsx',
  'app/[locale]/(app)/audit/page.tsx',
  'app/[locale]/(app)/admin/page.tsx',
  'app/[locale]/(app)/nhap-lieu/page.tsx',
  'app/[locale]/(app)/import/page.tsx',
  'app/[locale]/(app)/data-dictionary/page.tsx',
  'app/[locale]/(app)/data-schema/page.tsx',
  'app/[locale]/not-found.tsx',
  // Task 12 - dang nhap
  'app/[locale]/login/page.tsx',
  'src/components/layout/LoginForm.tsx',
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
});
