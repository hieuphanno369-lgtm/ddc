import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  UPLOAD_ROOT,
  deletePhotoFile,
  readPhotoFile,
  sanitizePhotoName,
  savePhotoFile,
} from './uploads';

/** Mục 6 - lưu ảnh ngoài `public/`, DB giữ path tương đối; route API đọc lại. */
const PID = 990001; // id giả, tránh đụng dữ liệu dự án thật
const YM = '2026-09';
const TEST_DIR = path.join(UPLOAD_ROOT, String(PID));

const img = (name: string) => new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('savePhotoFile - ghi vào data/uploads/<projectId>/<YYYY-MM>/ (Mục 6)', () => {
  it('ghi file đúng thư mục và trả path tương đối để lưu vào ProjectPhoto.url', async () => {
    const rel = await savePhotoFile(PID, YM, img('anh.png'), 'png');

    expect(UPLOAD_ROOT.endsWith(path.join('data', 'uploads'))).toBe(true);
    expect(rel).toMatch(new RegExp(`^${PID}/${YM}/\\d+-[A-Za-z0-9._-]+\\.png$`));
    expect(existsSync(path.join(UPLOAD_ROOT, rel))).toBe(true);
  });

  it('tên file có dấu tiếng Việt / ký tự lạ được sanitize', async () => {
    const rel = await savePhotoFile(PID, YM, img('Ảnh hiện trường (số 1)!.png'), 'png');
    const base = path.basename(rel);

    expect(base).toMatch(/^[0-9]+-[A-Za-z0-9._-]+\.png$/);
    expect(base).not.toMatch(/[\s()!]/);
  });

  it('2 ảnh cùng tên không ghi đè nhau (tên có timestamp)', async () => {
    const a = await savePhotoFile(PID, YM, img('trung.png'), 'png');
    const b = await savePhotoFile(PID, YM, img('trung.png'), 'png');
    expect(a).not.toBe(b);
    expect(existsSync(path.join(UPLOAD_ROOT, a))).toBe(true);
    expect(existsSync(path.join(UPLOAD_ROOT, b))).toBe(true);
  });
});

describe('sanitizePhotoName', () => {
  it('bỏ dấu, thay ký tự lạ bằng "-", cắt "-" ở hai đầu', () => {
    expect(sanitizePhotoName('Ảnh hiện trường (số 1)!')).toBe('Anh-hien-truong-so-1');
  });

  it('tên toàn ký tự lạ → chuỗi rỗng (caller tự fallback)', () => {
    expect(sanitizePhotoName('!!!')).toBe('');
  });
});

describe('readPhotoFile - content-type + chặn path traversal (Mục 6)', () => {
  it('đọc đúng nội dung + content-type image/png', async () => {
    const rel = await savePhotoFile(PID, YM, img('doc.png'), 'png');
    const got = await readPhotoFile(rel);

    expect(got?.contentType).toBe('image/png');
    expect(got?.bytes.length).toBe(4);
  });

  it.each([
    ['jpg', '.jpg', 'image/jpeg'],
    ['png', '.png', 'image/png'],
    ['webp', '.webp', 'image/webp'],
    ['gif', '.gif', 'image/gif'],
  ] as const)('suy content-type theo dinh dang da nhan dien (kind=%s)', async (kind, ext, contentType) => {
    const rel = await savePhotoFile(PID, YM, new File([Buffer.from('x')], `a${ext}`, { type: 'image/x' }), kind);
    expect(rel.endsWith(ext)).toBe(true);
    expect((await readPhotoFile(rel))?.contentType).toBe(contentType);
  });

  it('url rỗng (ảnh seed url: "") → null, không crash', async () => {
    expect(await readPhotoFile('')).toBeNull();
  });

  it('chặn path traversal "../" → null, không đọc được file ngoài data/uploads', async () => {
    expect(await readPhotoFile('../../package.json')).toBeNull();
    expect(await readPhotoFile(`${PID}/${YM}/../../../package.json`)).toBeNull();
    expect(await readPhotoFile('..')).toBeNull();
  });

  it('file không tồn tại → null (không throw)', async () => {
    expect(await readPhotoFile(`${PID}/${YM}/khong-co.png`)).toBeNull();
    expect(await readPhotoFile('etc/passwd')).toBeNull();
  });
});

describe('deletePhotoFile (Mục 6)', () => {
  it('xóa file thật khỏi disk', async () => {
    const rel = await savePhotoFile(PID, YM, img('xoa.png'), 'png');
    const abs = path.join(UPLOAD_ROOT, rel);
    expect(existsSync(abs)).toBe(true);

    await deletePhotoFile(rel);

    expect(existsSync(abs)).toBe(false);
  });

  it('url rỗng (seed) / file không tồn tại → không throw', async () => {
    await expect(deletePhotoFile('')).resolves.toBeUndefined();
    await expect(deletePhotoFile(`${PID}/${YM}/khong-co.png`)).resolves.toBeUndefined();
  });

  it('KHÔNG xóa được file ngoài UPLOAD_ROOT qua "../"', async () => {
    const target = path.join(process.cwd(), 'package.json');
    expect(existsSync(target)).toBe(true);

    await deletePhotoFile('../../package.json');

    expect(existsSync(target)).toBe(true);
  });
});
