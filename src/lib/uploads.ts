import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Lưu ảnh hiện trường trên filesystem (ngoài `public/` - public/ không phục vụ
 * file ghi runtime khi `next start`). DB chỉ lưu đường dẫn tương đối trong
 * `ProjectPhoto.url`; route `app/api/photos/[...path]` đọc + stream lại.
 */
export const UPLOAD_ROOT = path.join(process.cwd(), 'data', 'uploads');

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

/** Segment hợp lệ - chặn path traversal (`..`) và ký tự lạ khi ghép đường dẫn. */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Bỏ ký tự không an toàn khỏi tên file gốc, giữ lại phần nhận dạng được. */
export function sanitizePhotoName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Ghép đường dẫn tuyệt đối từ path tương đối; trả null nếu không hợp lệ. */
function resolvePhotoPath(relPath: string): string | null {
  const segments = relPath.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((s) => !SAFE_SEGMENT.test(s) || s === '..')) return null;
  const abs = path.join(UPLOAD_ROOT, ...segments);
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return abs;
}

/** Ghi file ảnh vào `data/uploads/<projectId>/<yearMonth>/`; trả path tương đối để lưu DB. */
export async function savePhotoFile(projectId: number, yearMonth: string, file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  const base = sanitizePhotoName(path.basename(file.name, ext)) || 'photo';
  // Date.now() một mình có thể trùng khi 2 lời gọi trong cùng 1 ms → ghi đè nhau.
  // Thêm uuid để tên LUÔN unique (kể cả cùng ms / khác process).
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${base}${ext}`;
  const relPath = `${projectId}/${yearMonth}/${fileName}`;
  const dir = path.join(UPLOAD_ROOT, String(projectId), yearMonth);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
  return relPath;
}

/** Xóa file ảnh - bỏ qua nếu file không tồn tại (seed/mock không có file thật). */
export async function deletePhotoFile(relPath: string): Promise<void> {
  const abs = relPath ? resolvePhotoPath(relPath) : null;
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* file không tồn tại - vẫn xóa record ở DB */
  }
}

/** Đọc file ảnh + suy ra content-type. Trả null nếu thiếu file / path không hợp lệ. */
export async function readPhotoFile(relPath: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const abs = relPath ? resolvePhotoPath(relPath) : null;
  if (!abs) return null;
  try {
    const bytes = await readFile(abs);
    const contentType = CONTENT_TYPE_BY_EXT[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
    return { bytes, contentType };
  } catch {
    return null;
  }
}
