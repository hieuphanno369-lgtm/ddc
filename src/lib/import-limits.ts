/** Giới hạn dung lượng tệp import ở UI (đồng bộ với `IMPORT_MAX_BYTES` phía server, `src/server/validation.ts`). */
export const IMPORT_MAX_MB = 10;
export const IMPORT_MAX_BYTES = IMPORT_MAX_MB * 1024 * 1024;

export function isImportTooBig(size: number): boolean {
  return size > IMPORT_MAX_BYTES;
}
