/**
 * Sửa lỗi P2028 (đăng nhập đúng mật khẩu bị báo sai khi máy chậm) - test DB THẬT cho hạn giao dịch auth
 * (`AUTH_TX_OPTIONS`, `auth-tx.ts`). Bỏ qua khi `npm test` thường (không có DATABASE_URL); chạy tay:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/repo/prisma-repo-auth-tx-real-db.test.ts
 * Tự tạo + tự dọn dữ liệu test (email `test-tx-real-db@daidung.com.vn`, key `test-tx-real-db-*`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_TX_OPTIONS } from './auth-tx';

const hasDb = Boolean(process.env.DATABASE_URL);

/** Chặn event loop `ms` mili giây ngay sau khi giao dịch vừa bắt đầu (giống webpack dev dịch code trong cùng tiến trình). */
function blockEventLoopSoon(ms: number): void {
  setImmediate(() => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      /* chặn event loop */
    }
  });
}

describe.skipIf(!hasDb)('giao dich auth khong bi huy khi may cham (P2028, DB _c)', () => {
  let prisma: typeof import('@/server/db').prisma;
  let prismaAuthStore: typeof import('./prisma-repo-auth').prismaAuthStore;

  const EMAIL = 'test-tx-real-db@daidung.com.vn';
  const KEY_PREFIX = 'test-tx-real-db-';

  async function cleanup(): Promise<void> {
    await prisma.authThrottle.deleteMany({
      where: { OR: [{ kind: 'login_fail_ip', key: { startsWith: KEY_PREFIX } }, { kind: 'account_guess', key: EMAIL }] },
    });
    await prisma.userRole.deleteMany({ where: { email: EMAIL } });
  }

  function windowIso(): { nowIso: string; sinceIso: string } {
    const now = new Date();
    return { nowIso: now.toISOString(), sinceIso: new Date(now.getTime() - 60_000).toISOString() };
  }

  /** Chờ tới khi advisory lock `login_fail_ip:<key>` đang bị giữ (thử khoá không chờ, thất bại = đang bị giữ). */
  async function waitUntilLockHeld(key: string): Promise<void> {
    for (let i = 0; i < 50; i++) {
      const rows = await prisma.$queryRaw<{ held: boolean }[]>`SELECT NOT pg_try_advisory_xact_lock(hashtext(${'login_fail_ip'} || ':' || ${key})) AS held`;
      if (rows[0]?.held) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('khong thay advisory lock bi giu sau 5s');
  }

  beforeAll(async () => {
    ({ prisma } = await import('@/server/db'));
    ({ prismaAuthStore } = await import('./prisma-repo-auth'));
    await cleanup();
    await prisma.userRole.create({
      data: { email: EMAIL, name: 'Test TX', passwordHash: 'x', role: 'viewer', canViewFinance: false, isActive: true },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('reserveThrottle: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)', async () => {
    const key = `${KEY_PREFIX}loop`;
    const { nowIso, sinceIso } = windowIso();
    const p = prismaAuthStore.reserveThrottle('login_fail_ip', key, nowIso, sinceIso, 100);
    blockEventLoopSoon(6000);
    expect(await p).not.toBeNull();
    expect(await prisma.authThrottle.count({ where: { kind: 'login_fail_ip', key } })).toBe(1);
  }, 30_000);

  it('reserveAccountGuess: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)', async () => {
    const { nowIso, sinceIso } = windowIso();
    const p = prismaAuthStore.reserveAccountGuess(EMAIL, nowIso, sinceIso, 5);
    blockEventLoopSoon(6000);
    const id = await p;
    expect(id).not.toBeNull();
    await prismaAuthStore.releaseThrottle(id as number);
  }, 30_000);

  it('advisory lock bi giu lau hon AUTH_TX_OPTIONS.timeout -> reserveThrottle bao P2028 va KHONG de lai dong giu cho (co che e2e 42)', async () => {
    const key = `${KEY_PREFIX}lock`;
    const holdSeconds = AUTH_TX_OPTIONS.timeout / 1000 + 5;
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'login_fail_ip'} || ':' || ${key}))`;
        await tx.$executeRaw`SELECT pg_sleep(${holdSeconds}::float8)`;
      },
      { maxWait: 10_000, timeout: (holdSeconds + 30) * 1000 },
    );
    await waitUntilLockHeld(key);
    const { nowIso, sinceIso } = windowIso();
    await expect(prismaAuthStore.reserveThrottle('login_fail_ip', key, nowIso, sinceIso, 100)).rejects.toMatchObject({ code: 'P2028' });
    await holder;
    expect(await prisma.authThrottle.count({ where: { kind: 'login_fail_ip', key } })).toBe(0);
  }, 90_000);
});
