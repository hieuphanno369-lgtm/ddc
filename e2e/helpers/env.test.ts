/**
 * C-0 (ke-hoach.md P7-C1): e2e chay theo cap DB + cong dang ky trong E2E_TARGETS, khong bao gio
 * DB cua A (ddc_control_tower). isExpectedDbUrl/parseE2eBaseUrl/resolveE2eTarget phai khop CHINH
 * XAC host/port/ten DB, khong dung includes()/startsWith() (khop nham ten gan giong nhu '..._b2').
 */
import { describe, expect, it } from 'vitest';
import { E2E_TARGETS, E2E_A_DB_NAME, E2E_A_PORT, e2eADbUrlFrom, isExpectedDbUrl, mergeE2eEnv, parseE2eBaseUrl, resolveE2eTarget } from './env';

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

  // Vong 3 (tester doc lap): kiem them bien tester duoc giao ro ten - userinfo la,
  // '?schema=public&', '?schema=Public', '?&schema=public', khoang trang. Da doi chieu
  // hanh vi that cua WHATWG URL bang script Node doc lap truoc khi viet test (khong doan).
  it("userinfo la (ten dang nhap khac 'postgres', mat khau rong) van -> true (dung thiet ke: guard chi kiem host/port/ten DB/schema, khong kiem danh tinh nguoi dung ket noi)", () => {
    expect(
      isExpectedDbUrl('postgresql://admin_evil:@localhost:5433/ddc_control_tower_c?schema=public', '3003'),
    ).toBe(true);
  });

  it("query co dau '&' du o cuoi ('?schema=public&') -> true (URLSearchParams chuan hoa ve dung 1 cap schema=public)", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public&', '3003'),
    ).toBe(true);
  });

  it("query co dau '&' du o dau ('?&schema=public') -> true (tuong tu, chuan hoa ve dung 1 cap)", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?&schema=public', '3003'),
    ).toBe(true);
  });

  it("gia tri schema viet hoa chu dau ('?schema=Public') -> false (phan biet hoa/thuong, khac 'public')", () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=Public', '3003'),
    ).toBe(false);
  });

  it('khoang trang dau/cuoi ca chuoi DATABASE_URL -> true (WHATWG URL tu dong bo khoang trang dau/cuoi)', () => {
    expect(
      isExpectedDbUrl('  postgresql://postgres:pass@localhost:5433/ddc_control_tower_c?schema=public  ', '3003'),
    ).toBe(true);
  });

  it('ky tu tab nam giua ten host bi WHATWG URL loai bo hoan toan nen chuan hoa dung thanh localhost -> true (khong phai loi bypass, la hanh vi chuan cua URL, ten DB van phai khop dung)', () => {
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@loca\tlhost:5433/ddc_control_tower_c?schema=public', '3003'),
    ).toBe(true);
  });

  it('khoang trang lam URL khong parse duoc (vd nam giua cong) -> false, khong throw', () => {
    expect(() =>
      isExpectedDbUrl('postgresql://postgres:pass@localhost: 5433/ddc_control_tower_c?schema=public', '3003'),
    ).not.toThrow();
    expect(
      isExpectedDbUrl('postgresql://postgres:pass@localhost: 5433/ddc_control_tower_c?schema=public', '3003'),
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
      reuseServer: true,
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

/**
 * A chay e2e tren DB tam rieng (chu du an chot 2026-09-27): cap `ddc_control_tower_e2e_a` + 3010 (E2E_A_PORT).
 * DB that cua A (`ddc_control_tower`) van bi chan voi moi cong; A khong bam server co san (reuseServer false).
 */
describe('A chay e2e tren DB tam', () => {
  const AE2E = 'postgresql://postgres:pass@localhost:5433/ddc_control_tower_e2e_a?schema=public';

  it('cap DB tam cua A + 3010 -> true; voi 3000 (cong dev thuong cua A) -> false', () => {
    expect(E2E_A_DB_NAME).toBe('ddc_control_tower_e2e_a');
    expect(isExpectedDbUrl(AE2E, '3010')).toBe(true);
    expect(isExpectedDbUrl(AE2E, '3000')).toBe(false);
  });

  it('DB that cua A voi 3000 va 3010 van -> false', () => {
    expect(isExpectedDbUrl(A, '3000')).toBe(false);
    expect(isExpectedDbUrl(A, '3010')).toBe(false);
  });

  it('DB tam cua A voi cong cua B/C -> false; DB B/C voi 3000 -> false', () => {
    expect(isExpectedDbUrl(AE2E, '3001')).toBe(false);
    expect(isExpectedDbUrl(AE2E, '3003')).toBe(false);
    expect(isExpectedDbUrl(B, '3010')).toBe(false);
    expect(isExpectedDbUrl(C, '3010')).toBe(false);
  });

  it("ten gan giong ('..._e2e_a2', '..._e2e') -> false", () => {
    expect(isExpectedDbUrl(AE2E.replace('_e2e_a?', '_e2e_a2?'), '3010')).toBe(false);
    expect(isExpectedDbUrl(AE2E.replace('_e2e_a?', '_e2e?'), '3010')).toBe(false);
  });

  it('cap cua A khong duoc dung lai server co san (reuseServer false); B/C giu nhu cu (true)', () => {
    const a = resolveE2eTarget({ NEXTAUTH_URL: 'http://localhost:3010', DATABASE_URL: AE2E });
    expect(a.reuseServer).toBe(false);
    const b = resolveE2eTarget({ NEXTAUTH_URL: 'http://localhost:3001', DATABASE_URL: B });
    expect(b.reuseServer).toBe(true);
  });

  it('e2eADbUrlFrom: doi dung ten DB, giu host/port/user/schema; nguon khong phai localhost:5433 -> null', () => {
    expect(e2eADbUrlFrom(A)).toBe(AE2E);
    expect(e2eADbUrlFrom('postgresql://postgres:pass@db.example.com:5433/ddc_control_tower?schema=public')).toBeNull();
    expect(e2eADbUrlFrom('postgresql://postgres:pass@localhost:5432/ddc_control_tower?schema=public')).toBeNull();
    expect(e2eADbUrlFrom('khong-phai-url')).toBeNull();
  });
});

describe('mergeE2eEnv', () => {
  it('.env thang bien shell thuong (DATABASE_URL shell khong de duoc .env)', () => {
    const out = mergeE2eEnv({ DATABASE_URL: 'shell-db' }, { DATABASE_URL: 'dotenv-db' });
    expect(out.DATABASE_URL).toBe('dotenv-db');
  });

  it('chi E2E_DATABASE_URL / E2E_NEXTAUTH_URL o shell moi de duoc .env', () => {
    const out = mergeE2eEnv(
      { E2E_DATABASE_URL: 'e2e-db', E2E_NEXTAUTH_URL: 'http://localhost:3010' },
      { DATABASE_URL: 'dotenv-db', NEXTAUTH_URL: 'http://localhost:3000', E2E_ADMIN_EMAIL: 'a@x' },
    );
    expect(out.DATABASE_URL).toBe('e2e-db');
    expect(out.NEXTAUTH_URL).toBe('http://localhost:3010');
    expect(out.E2E_ADMIN_EMAIL).toBe('a@x');
  });

  it('de roi van qua guard: E2E_DATABASE_URL tro DB that cua A -> resolveE2eTarget throw', () => {
    const env = mergeE2eEnv({ E2E_DATABASE_URL: A, E2E_NEXTAUTH_URL: 'http://localhost:3010' }, { NEXTAUTH_URL: 'http://localhost:3000', DATABASE_URL: A });
    expect(() => resolveE2eTarget(env)).toThrow();
  });
});

describe('E2E_A_PORT', () => {
  it('cong e2e cua A la 3010, khong trung cong dev cua A/B/xem/C (3000-3003)', () => {
    expect(E2E_A_PORT).toBe('3010');
    expect(['3000', '3001', '3002', '3003']).not.toContain(E2E_A_PORT);
    expect(E2E_TARGETS.find((t) => t.dbName === E2E_A_DB_NAME)?.port).toBe(E2E_A_PORT);
  });
});
