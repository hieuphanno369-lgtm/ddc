/**
 * `npm run test:e2e:a [-- <tham số playwright>]` - e2e cho tài khoản A trên DB tạm riêng
 * (`ddc_control_tower_e2e_a`, cổng 3000), không bao giờ đụng DB thật `ddc_control_tower` (chủ dự án chốt 2026-09-27).
 *
 * 1. Dựng URL DB tạm từ `DATABASE_URL` trong `.env` (cùng host/port/user), kiểm lại bằng guard `isExpectedDbUrl`.
 * 2. Cổng 3000 đang có server (thường là dev server của A trỏ DB thật) -> dừng, không chạy.
 * 3. `prisma migrate deploy` lên DB tạm (tạo DB nếu chưa có). Đặt cả `DIRECT_URL` vì migration đọc biến này.
 * 4. Chạy Playwright với `E2E_DATABASE_URL` / `E2E_NEXTAUTH_URL`; global-setup seed lại DB tạm trước mọi spec.
 */
import { execSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { e2eADbUrlFrom, isExpectedDbUrl, loadDotEnv } from '../e2e/helpers/env';

const PORT = '3000';

function fail(msg: string): never {
  console.error(`[test:e2e:a] ${msg}`);
  process.exit(1);
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

async function main(): Promise<void> {
  const dot = loadDotEnv();
  const e2eDbUrl = e2eADbUrlFrom(dot.DATABASE_URL ?? '');
  if (!e2eDbUrl || !isExpectedDbUrl(e2eDbUrl, PORT)) {
    fail('DATABASE_URL trong .env phai tro Postgres localhost:5433 - khong dung duoc URL DB tam e2e.');
  }
  if (!(await portFree(Number(PORT)))) {
    fail(`Cong ${PORT} dang co server (co the tro DB that cua A). Tat server do roi chay lai.`);
  }

  const dbEnv = { ...process.env, DATABASE_URL: e2eDbUrl, DIRECT_URL: e2eDbUrl };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: dbEnv });

  const args = process.argv.slice(2);
  const res = spawnSync('npx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, E2E_DATABASE_URL: e2eDbUrl, E2E_NEXTAUTH_URL: `http://localhost:${PORT}` },
  });
  process.exit(res.status ?? 1);
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
