import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_BYTES, IMPORT_MAX_MB, isImportTooBig } from './import-limits';

describe('import-limits', () => {
  it('IMPORT_MAX_MB la 10', () => {
    expect(IMPORT_MAX_MB).toBe(10);
    expect(IMPORT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it('dung dung IMPORT_MAX_BYTES khong phai qua lon', () => {
    expect(isImportTooBig(IMPORT_MAX_BYTES)).toBe(false);
  });

  it('vuot 1 byte la qua lon', () => {
    expect(isImportTooBig(IMPORT_MAX_BYTES + 1)).toBe(true);
  });
});
