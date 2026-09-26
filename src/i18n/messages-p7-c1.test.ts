import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P7-C1 (7.3, chu du an chot 2026-09-26): doi ten app hien thi (dong dam sidebar/tab/login
 * = "BAO CAO QUAN TRI" / "MANAGEMENT REPORTS", dong mo = "Danh Muc Du An" / "Project Portfolio").
 * Khuon theo src/i18n/messages-p3cb-9-10.qa.test.ts.
 */

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as Record<string, unknown>;
const readSrc = (p: string) => readFileSync(join(ROOT, p), 'utf-8');
const vi = read('src/i18n/messages/vi.json') as { app: Record<string, string> };
const en = read('src/i18n/messages/en.json') as { app: Record<string, string> };

describe('7.3 - doi ten app hien thi', () => {
  it('vi.json: app.headerTitle / app.name dung gia tri moi', () => {
    expect(vi.app.headerTitle).toBe('BÁO CÁO QUẢN TRỊ');
    expect(vi.app.name).toBe('Danh Mục Dự Án');
  });

  it('en.json: app.headerTitle / app.name dung gia tri moi', () => {
    expect(en.app.headerTitle).toBe('MANAGEMENT REPORTS');
    expect(en.app.name).toBe('Project Portfolio');
  });

  it('khong con chuoi ten cu "DDC Control Tower" (bo qua comment) trong layout/login/notify-message/AppShell', () => {
    const files = [
      'app/[locale]/layout.tsx',
      'app/[locale]/login/page.tsx',
      'src/lib/notify-message.ts',
      'src/components/layout/AppShell.tsx',
    ];
    for (const f of files) {
      const codeLines = readSrc(f)
        .split(/\r?\n/)
        .filter((line) => {
          const t = line.trim();
          return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*'));
        })
        .join('\n');
      expect(codeLines, `${f} van con "DDC Control Tower"`).not.toContain('DDC Control Tower');
    }
  });

  it('khong con chuoi "Performance Hub" trong vi.json/en.json', () => {
    for (const f of ['src/i18n/messages/vi.json', 'src/i18n/messages/en.json']) {
      expect(readSrc(f)).not.toContain('Performance Hub');
    }
  });
});
