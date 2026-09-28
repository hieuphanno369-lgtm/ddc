import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tester vong 3 (doc lap): khoa lai chu `stageAdmin.hint` dung sua o vong sua reviewer muc 4 - cau
 * cu "them 0% vao trong so MOI du an" sai voi code that (chi du an DA CO dong trong so rieng moi
 * duoc chen 0% - xem `mock-repo-entry.ts` `saveStage`/`setStageActive`, da co test hanh vi rieng o
 * `entry.test.ts`). Test nay chi khoa CHU, tranh sau nay ai sua lai chu cu ma quen sua code hoac
 * nguoc lai.
 */
const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as Record<string, unknown>;

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

describe('stageAdmin.hint (vong sua reviewer muc 4, khoa chu)', () => {
  it('vi: khong con cau cu "moi du an", co cau moi "da co dong trong so rieng"', () => {
    const hint = get(read('src/i18n/messages/vi.json'), 'stageAdmin.hint') as string;
    expect(hint).toContain('đã có dòng trọng số riêng');
    expect(hint).not.toContain('mọi dự án');
    expect(hint).not.toContain('–');
    expect(hint).not.toContain('—');
  });

  it('en: khong con cau cu "every project", co cau moi "already have their own weight rows"', () => {
    const hint = get(read('src/i18n/messages/en.json'), 'stageAdmin.hint') as string;
    expect(hint).toContain('already have their own weight rows');
    expect(hint).not.toContain("every project's weights");
    expect(hint).not.toContain('–');
    expect(hint).not.toContain('—');
  });
});
