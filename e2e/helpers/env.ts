import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Đọc `.env` gốc repo (không dùng dotenv - tránh thêm dependency chỉ cho e2e). */
export function loadDotEnv(): Record<string, string> {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Thiếu key trong process.env (đã nạp .env qua loadDotEnv trước đó) → throw rõ ràng. */
export function need(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Thieu ${key} trong .env - xem .env.example`);
  return value;
}

/**
 * P3E (Task 6, bước 6.10) - mật khẩu dùng chung cho 2 tài khoản e2e tạo sẵn ở `global-setup.ts`
 * (`e2e-khoa@daidung.com.vn`, `e2e-quenmk@daidung.com.vn`); KHÔNG phải mật khẩu thật, chỉ tồn tại
 * trên DB tạm/DB dev của e2e.
 */
export const E2E_LOCK_PASSWORD = 'E2e-Khoa-2026!';

/** DB tạm riêng cho e2e của A (chủ dự án chốt 2026-09-27). Seed xoá/nạp lại mỗi lần chạy, không phải DB thật. */
export const E2E_A_DB_NAME = 'ddc_control_tower_e2e_a';
/**
 * Cổng e2e riêng của A: không trùng cổng dev của ai (A 3000, B 3001, xem 3002, C 3003). Nhờ vậy (1) không có khe
 * để server dev thường của A (DB thật) chiếm cổng giữa lúc Playwright kiểm và lúc Next e2e bind, (2) e2e của A
 * không giữ 3000, nên `npm run dev` của A không bị đẩy sang 3001 rồi bị e2e của B bám nhầm (bảo mật TR-1, T-2).
 */
export const E2E_A_PORT = '3010';

/**
 * Cặp DB + cổng dev đã đăng ký cho e2e. KHÔNG BAO GIỜ thêm 'ddc_control_tower' (DB của A, dữ liệu thật).
 * `reuseServer`: có được bám vào server đang chạy sẵn ở cổng đó không. A = false vì server dev thường
 * của A trỏ DB thật; bám nhầm server đó thì spec ghi dữ liệu thử vào DB thật (N-P7-1).
 */
export const E2E_TARGETS: ReadonlyArray<{ dbName: string; port: string; reuseServer: boolean }> = [
  { dbName: 'ddc_control_tower_b', port: '3001', reuseServer: true },
  { dbName: 'ddc_control_tower_c', port: '3003', reuseServer: true },
  { dbName: E2E_A_DB_NAME, port: E2E_A_PORT, reuseServer: false },
];

/**
 * Gộp biến môi trường cho e2e: `.env` thắng biến shell thường (tránh lỡ tay `DATABASE_URL` ở shell),
 * riêng `E2E_DATABASE_URL` / `E2E_NEXTAUTH_URL` đặt ở shell (script `test:e2e:a`) được đè `.env`.
 * Kết quả vẫn phải qua `resolveE2eTarget`, nên đè sang DB chưa đăng ký (vd DB thật của A) vẫn bị chặn.
 */
export function mergeE2eEnv(
  processEnv: Record<string, string | undefined>,
  dotEnv: Record<string, string>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...processEnv, ...dotEnv };
  if (processEnv.E2E_DATABASE_URL) out.DATABASE_URL = processEnv.E2E_DATABASE_URL;
  if (processEnv.E2E_NEXTAUTH_URL) out.NEXTAUTH_URL = processEnv.E2E_NEXTAUTH_URL;
  return out;
}

/** `mergeE2eEnv(process.env, .env)` - điểm vào duy nhất cho config, global-setup và spec. */
export function loadE2eEnv(): Record<string, string | undefined> {
  return mergeE2eEnv(process.env, loadDotEnv());
}

/** Từ DATABASE_URL của A (localhost:5433) dựng URL DB tạm e2e cùng host/port/user/query. Nguồn lạ -> null. */
export function e2eADbUrlFrom(sourceDbUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(sourceDbUrl);
  } catch {
    return null;
  }
  if (u.hostname !== 'localhost' || u.port !== '5433') return null;
  u.pathname = '/' + E2E_A_DB_NAME;
  return u.toString();
}

/** NEXTAUTH_URL phải đúng dạng http://localhost:<cổng> (pathname '/', không query/hash/user). Sai -> null. */
export function parseE2eBaseUrl(nextAuthUrl: string): { baseURL: string; port: string } | null {
  let u: URL;
  try {
    u = new URL(nextAuthUrl);
  } catch {
    return null;
  }
  if (
    u.protocol !== 'http:' ||
    u.hostname !== 'localhost' ||
    u.port === '' ||
    u.pathname !== '/' ||
    u.search !== '' ||
    u.hash !== '' ||
    u.username !== '' ||
    u.password !== ''
  ) {
    return null;
  }
  return { baseURL: `http://localhost:${u.port}`, port: u.port };
}

/**
 * L-5 (danh-gia-bao-mat.md): DATABASE_URL phải khớp CHÍNH XÁC host/port/tên DB của cặp đã đăng ký
 * có cổng trùng tham số `port` - không dùng `includes('/ddc_control_tower_b')` vì khớp nhầm cả
 * `ddc_control_tower_b2` (hoặc bất kỳ tên nào chứa chuỗi con này) và không kiểm host/port.
 *
 * L-1 (danh-gia.md muc CAN SUA #1): query string chỉ được chứa đúng key `schema` với giá trị
 * `public` (hoặc không có query nào). Trước đây hàm bỏ qua toàn bộ query string, nên
 * `?host=<máy khác>` lọt qua guard trong khi tầng kết nối của Prisma ưu tiên `host` trong query
 * hơn host trong URL - guard tưởng là `localhost` nhưng kết nối thực lại đi nơi khác.
 *
 * Vòng 2 (ket-qua-test.md muc "Vong 2"): bản vá L-1 dùng `.every((k) => k === 'schema')` +
 * `.get('schema')` chỉ kiểm TÊN key, không đếm SỐ LẦN key `schema` xuất hiện - `.get()` luôn đọc
 * giá trị ĐẦU TIÊN nên `?schema=public&schema=evil` vẫn qua được guard trong khi giá trị `evil`
 * vẫn nằm nguyên trong chuỗi kết nối thật truyền cho Prisma/pg (lặp lại đúng mô hình lỗi của L-1
 * gốc: bộ đọc dùng để kiểm khác bộ đọc dùng để kết nối). Hàm cũng thiếu kiểm `u.hash` dù
 * `parseE2eBaseUrl` trong cùng file đã chặn hash cho `NEXTAUTH_URL` - sửa lại: đếm tổng số cặp
 * query (`entries()`), chỉ chấp nhận 0 cặp hoặc đúng 1 cặp `['schema','public']`, và luôn chặn
 * `u.hash !== ''`.
 */
export function isExpectedDbUrl(dbUrl: string, port: string): boolean {
  let u: URL;
  try {
    u = new URL(dbUrl);
  } catch {
    return false;
  }
  if (u.hostname !== 'localhost' || u.port !== '5433') return false;
  if (u.hash !== '') return false;
  const entries = [...u.searchParams.entries()];
  if (entries.length > 1) return false;
  if (entries.length === 1 && (entries[0][0] !== 'schema' || entries[0][1] !== 'public')) return false;
  return E2E_TARGETS.some((t) => t.port === port && u.pathname === '/' + t.dbName);
}

/** Gộp 2 hàm trên. Hợp lệ -> trả target; sai -> throw Error (thông điệp KHÔNG chứa DATABASE_URL). */
export function resolveE2eTarget(env: Record<string, string | undefined>): {
  baseURL: string;
  port: string;
  databaseUrl: string;
  reuseServer: boolean;
} {
  const nextAuthUrl = env.NEXTAUTH_URL ?? '';
  const databaseUrl = env.DATABASE_URL ?? '';
  const parsed = parseE2eBaseUrl(nextAuthUrl);
  if (!parsed) {
    throw new Error('NEXTAUTH_URL phai co dang http://localhost:<cong> (vd http://localhost:3003) - sua .env');
  }
  if (!isExpectedDbUrl(databaseUrl, parsed.port)) {
    const pairs = E2E_TARGETS.map((t) => `${t.dbName} + ${t.port}`).join(', ');
    throw new Error(
      `DATABASE_URL + NEXTAUTH_URL khong khop cap da dang ky (${pairs}) - dung chay e2e (co the dinh DB cua A). B/C: kiem tra .env; A: dung \`npm run test:e2e:a\` (DB tam), khong sua .env.`,
    );
  }
  const reuseServer = E2E_TARGETS.find((t) => t.port === parsed.port)?.reuseServer ?? false;
  return { baseURL: parsed.baseURL, port: parsed.port, databaseUrl, reuseServer };
}
