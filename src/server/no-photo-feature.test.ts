import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * P3E Task 2 (D5) - gỡ tính năng ảnh hiện trường (code), giữ nguyên bảng `project_photos`
 * tới Task 5. Test này khoá lại: không còn route, action, hay chuỗi tham chiếu nào sót.
 */
const ROOT = process.cwd();
const SELF = path.join(__dirname, 'no-photo-feature.test.ts');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('khong con tinh nang anh hien truong (code)', () => {
  it('khong con thu muc route upload/stream anh', () => {
    expect(existsSync(path.join(ROOT, 'app/api/photo-upload'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'app/api/photos'))).toBe(false);
  });

  it('actions.ts khong con addPhotoAction/deletePhotoAction', () => {
    const src = readFileSync(path.join(ROOT, 'src/server/actions.ts'), 'utf-8');
    expect(src).not.toContain('addPhotoAction');
    expect(src).not.toContain('deletePhotoAction');
  });

  it('khong file nao trong src/, app/ con chuoi /api/photos hoac PhotoDropzone', () => {
    const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'app'))].filter((f) => f !== SELF);
    for (const f of files) {
      const src = readFileSync(f, 'utf-8');
      expect(src.includes('/api/photos'), `${path.relative(ROOT, f)}: con chuoi "/api/photos"`).toBe(false);
      expect(src.includes('PhotoDropzone'), `${path.relative(ROOT, f)}: con chuoi "PhotoDropzone"`).toBe(false);
    }
  });
});
