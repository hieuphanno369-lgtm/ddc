export interface FileMeta {
  name: string;
  type: string;
  size: number;
}

export type RejectReason = 'not_image' | 'too_big';

/** Lọc trước khi gửi: type không bắt đầu 'image/' → not_image; size > maxBytes hoặc = 0 → too_big. Giữ thứ tự. */
export function precheckPhotos<T extends FileMeta>(
  files: T[],
  maxBytes: number,
): { accepted: T[]; rejected: { name: string; reason: RejectReason }[] } {
  const accepted: T[] = [];
  const rejected: { name: string; reason: RejectReason }[] = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      rejected.push({ name: f.name, reason: 'not_image' });
    } else if (f.size === 0 || f.size > maxBytes) {
      rejected.push({ name: f.name, reason: 'too_big' });
    } else {
      accepted.push(f);
    }
  }
  return { accepted, rejected };
}

/** % tổng (0..100, số nguyên, không vượt 100). totalBytes = 0 → 0. */
export function overallPercent(doneBytes: number, currentLoaded: number, totalBytes: number): number {
  if (totalBytes === 0) return 0;
  const pct = Math.floor(((doneBytes + currentLoaded) / totalBytes) * 100);
  return Math.min(100, Math.max(0, pct));
}
