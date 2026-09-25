/**
 * L-5 (danh-gia-bao-mat.md): isExpectedDbUrl() phải khớp CHÍNH XÁC host/port/tên DB của worktree B,
 * không dùng includes() (khớp nhầm cả tên gần giống, vd '..._b2').
 */
import { describe, expect, it } from 'vitest';
import { isExpectedDbUrl } from './env';

describe('isExpectedDbUrl', () => {
  it('dung host/port/ten DB cua worktree B -> true', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_b?schema=public')).toBe(true);
  });

  it("ten DB gan giong ('..._b2') truoc day loi vi includes() -> false", () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_b2?schema=public')).toBe(false);
  });

  it('dung DB cua A (ddc_control_tower, khong co _b) -> false', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower?schema=public')).toBe(false);
  });

  it('dung port khac (vd cong cua A hoac Postgres mac dinh 5432) -> false', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5432/ddc_control_tower_b')).toBe(false);
  });

  it('dung host khac (khong phai localhost) -> false', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@db.example.com:5433/ddc_control_tower_b')).toBe(false);
  });

  it('DATABASE_URL rong hoac khong parse duoc -> false (khong throw)', () => {
    expect(isExpectedDbUrl('')).toBe(false);
    expect(isExpectedDbUrl('khong-phai-url')).toBe(false);
  });
});
