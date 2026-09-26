/**
 * C-0 (ke-hoach.md P7-C1): e2e chay theo cap DB + cong dang ky trong E2E_TARGETS, khong bao gio
 * DB cua A (ddc_control_tower). isExpectedDbUrl/parseE2eBaseUrl/resolveE2eTarget phai khop CHINH
 * XAC host/port/ten DB, khong dung includes()/startsWith() (khop nham ten gan giong nhu '..._b2').
 */
import { describe, expect, it } from 'vitest';
import { E2E_TARGETS, isExpectedDbUrl, parseE2eBaseUrl, resolveE2eTarget } from './env';

const A = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower?schema=public';
const B = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower_b?schema=public';
const C = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public';

describe('isExpectedDbUrl', () => {
  it('dung cap B + 3001 -> true', () => {
    expect(isExpectedDbUrl(B, '3001')).toBe(true);
  });

  it('dung cap C + 3003 -> true', () => {
    expect(isExpectedDbUrl(C, '3003')).toBe(true);
  });

  it('DB cua A false voi moi cong', () => {
    for (const port of ['3000', '3001', '3002', '3003']) {
      expect(isExpectedDbUrl(A, port)).toBe(false);
    }
  });

  it('cap lech: DB C voi cong 3001 -> false', () => {
    expect(isExpectedDbUrl(C, '3001')).toBe(false);
  });

  it('cap lech: DB B voi cong 3003 -> false', () => {
    expect(isExpectedDbUrl(B, '3003')).toBe(false);
  });

  it('cong chua dang ky (3002) -> false', () => {
    expect(isExpectedDbUrl(C, '3002')).toBe(false);
  });

  it("ten DB gan giong ('..._b2') truoc day loi vi includes() -> false", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_b2?schema=public', '3001'),
    ).toBe(false);
  });

  it("ten DB gan giong ('..._c2') -> false", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c2?schema=public', '3003'),
    ).toBe(false);
  });

  it('dung port Postgres khac (5432) -> false', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5432/ddc_control_tower_c', '3003')).toBe(false);
  });

  it('dung host khac (khong phai localhost) -> false', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@db.example.com:5433/ddc_control_tower_c', '3003')).toBe(
      false,
    );
  });

  it('DATABASE_URL rong hoac khong parse duoc -> false (khong throw)', () => {
    expect(isExpectedDbUrl('', '3003')).toBe(false);
    expect(isExpectedDbUrl('khong-phai-url', '3003')).toBe(false);
  });

  // L-1 (danh-gia.md muc CAN SUA #1): query string truoc day bi bo qua, nen '?host=<may khac>'
  // lot qua guard trong khi Prisma uu tien host trong query hon host trong URL. Chi cho phep
  // key 'schema' voi gia tri 'public' (hoac khong co query).
  it("co query la '?host=<may khac>' -> false (truoc day loi vi bo qua query string)", () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?host=db.example.com', '3003')).toBe(
      false,
    );
  });

  it("co ca schema=public lan host=<may khac> -> false", () => {
    expect(
      isExpectedDbUrl(
        'postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public&host=db.example.com',
        '3003',
      ),
    ).toBe(false);
  });

  it("co query 'options' (vd doi search_path) -> false", () => {
    expect(
      isExpectedDbUrl(
        'postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?options=-c%20search_path%3Dx',
        '3003',
      ),
    ).toBe(false);
  });

  it("schema khac 'public' -> false", () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=khac', '3003')).toBe(
      false,
    );
  });

  it('khong co query string -> true', () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c', '3003')).toBe(true);
  });

  it("chi co '?schema=public' -> true", () => {
    expect(isExpectedDbUrl(C, '3003')).toBe(true);
  });

  // Vong 2 (danh-gia.md CAN SUA #1 da vao, kiem doc lap them bien): cac truong hop
  // key/value lap, rong, chi dau '?', va fragment '#x' ma vong 1 chua co test rieng.
  it("key viet hoa '?SCHEMA=public' -> false (khong duoc coi la 'schema' vi phan biet hoa/thuong)", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?SCHEMA=public', '3003'),
    ).toBe(false);
  });

  it("key 'schema' lap lai 2 lan (dung gia tri 'public' ca 2) -> false (chinh sach dung dung 1 lan key)", () => {
    expect(
      isExpectedDbUrl(
        'postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public&schema=public',
        '3003',
      ),
    ).toBe(false);
  });

  it("key 'schema' lap lai voi gia tri thu 2 khac (vd 'evil') -> false (guard chi doc gia tri dau qua .get(), gia tri thu 2 co the bi mot bo doc URL khac su dung)", () => {
    expect(
      isExpectedDbUrl(
        'postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public&schema=evil',
        '3003',
      ),
    ).toBe(false);
  });

  it("query chi co dau '?' khong co cap key=value nao -> true (tuong duong khong co query)", () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?', '3003')).toBe(true);
  });

  it("co fragment '#x' (khong query) -> false (doi xung voi parseE2eBaseUrl da chan hash cho NEXTAUTH_URL)", () => {
    expect(isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c#x', '3003')).toBe(false);
  });

  it("co fragment '#x' cung voi query hop le '?schema=public' -> false", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public#x', '3003'),
    ).toBe(false);
  });
});

describe('parseE2eBaseUrl', () => {
  it("'http://localhost:3003' va co dau '/' cuoi deu -> { baseURL, port }", () => {
    expect(parseE2eBaseUrl('http://localhost:3003')).toEqual({ baseURL: 'http://localhost:3003', port: '3003' });
    expect(parseE2eBaseUrl('http://localhost:3003/')).toEqual({ baseURL: 'http://localhost:3003', port: '3003' });
  });

  it('null voi URL sai dang', () => {
    for (const bad of [
      'https://localhost:3003',
      'http://127.0.0.1:3003',
      'http://localhost',
      'http://localhost:3003/vi',
      'http://localhost:3003?x=1',
      'http://evil.com:3003',
      '',
    ]) {
      expect(parseE2eBaseUrl(bad)).toBeNull();
    }
  });
});

describe('resolveE2eTarget', () => {
  it('cap C + 3003 hop le -> tra target dung', () => {
    expect(resolveE2eTarget({ NEXTAUTH_URL: 'http://localhost:3003', DATABASE_URL: C })).toEqual({
      baseURL: 'http://localhost:3003',
      port: '3003',
      databaseUrl: C,
    });
  });

  it('NEXTAUTH_URL tro cong 3000 + DATABASE_URL cua A -> throw', () => {
    expect(() => resolveE2eTarget({ NEXTAUTH_URL: 'http://localhost:3000', DATABASE_URL: A })).toThrow();
  });

  it('cap lech (NEXTAUTH_URL 3001, DATABASE_URL cua C) -> throw', () => {
    expect(() => resolveE2eTarget({ NEXTAUTH_URL: 'http://localhost:3001', DATABASE_URL: C })).toThrow();
  });

  it('thieu NEXTAUTH_URL -> throw', () => {
    expect(() => resolveE2eTarget({ DATABASE_URL: C })).toThrow();
  });

  it('thong diep loi khong chua mat khau trong DATABASE_URL', () => {
    try {
      resolveE2eTarget({ NEXTAUTH_URL: 'http://localhost:3000', DATABASE_URL: A });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain('pass@');
    }
  });

  it('E2E_TARGETS khong co phan tu nao dbName la ddc_control_tower', () => {
    expect(E2E_TARGETS.some((t) => t.dbName === 'ddc_control_tower')).toBe(false);
  });
});
