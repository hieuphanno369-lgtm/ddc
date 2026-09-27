import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * P7-C2 Task 7: danh sách giai đoạn chỉ đọc động từ repo.getStages().
 * Test tĩnh chặn hằng giai đoạn cứng quay lại trong code chạy thật.
 */
const ROOT = process.cwd();
const ALLOWED_SEED_USERS = ['src/lib/stages.ts', 'src/lib/stage-weight-presets.ts'];
const SEED_DIR = 'src/data/seed/';
const THIS_FILE = 'src/lib/stages-nguon-dong.test.ts';

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(relative(ROOT, full).split(sep).join('/'));
  }
  return out;
}

const allFiles = [...walk(join(ROOT, 'app'), []), ...walk(join(ROOT, 'src'), [])];
const runtimeFiles = allFiles.filter((f) => !/\.test\.tsx?$/.test(f));

describe('nguồn giai đoạn động (P7-C2)', () => {
  it('code chạy thật không dùng SEED_STAGE_CODES / LEGACY_STAGE_WEIGHTS (trừ stages.ts, preset, seed)', () => {
    const offenders = runtimeFiles
      .filter((f) => !ALLOWED_SEED_USERS.includes(f) && !f.startsWith(SEED_DIR))
      .filter((f) => /\b(SEED_STAGE_CODES|LEGACY_STAGE_WEIGHTS)\b/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('không file nào còn STAGE_ORDER / STAGE_CALC_MODE / VALUE_CHAIN_COLUMNS / stageKey', () => {
    const offenders = allFiles
      .filter((f) => f !== THIS_FILE)
      .filter((f) => /\b(STAGE_ORDER|STAGE_CALC_MODE|VALUE_CHAIN_COLUMNS|stageKey)\b/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
